/**
 * Resolves parsed item names against DSA5 compendiums.
 * Requires: game.dsa5.itemLibrary (Foundry runtime)
 */

// Roman numeral suffix: "I", "II", "III", "I+II", "II+III", etc.
const TIER_RE = /\s+([IVX]+(?:\+[IVX]+)*)$/

function romanToInt(s) {
  const vals = { I: 1, V: 5, X: 10, L: 50, C: 100 }
  let result = 0, prev = 0
  for (const ch of [...s].reverse()) {
    const v = vals[ch] ?? 0
    result += v < prev ? -v : v
    prev = v
  }
  return result
}

// Returns { base: nameWithoutTier, tier: number }
function extractTier(name) {
  const m = name.match(TIER_RE)
  if (!m) return { base: name, tier: 1 }
  const tier = Math.max(...m[1].split('+').map(romanToInt))
  return { base: name.slice(0, -m[0].length).trim(), tier }
}

// Clone item (or plain obj) and set step.value to tier
function applyTier(item, tier) {
  if (!item || tier <= 1) return item
  const obj = typeof item.toObject === 'function' ? item.toObject() : { ...item, system: { ...item.system } }
  if (obj.system && 'step' in obj.system) {
    obj.system = { ...obj.system, step: { ...obj.system.step, value: tier } }
  }
  return obj
}

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = []
  for (let i = 0; i <= m; i++) {
    dp[i] = []
    for (let j = 0; j <= n; j++) {
      dp[i][j] = i === 0 ? j : j === 0 ? i : 0
    }
  }
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

// Strips trailing Roman numeral suffixes (e.g. "Langschwert II" → "langschwert")
// to improve fuzzy matching across tiered item names.
function normalize(name) {
  return name.trim().toLowerCase().replace(/\s+[IVX]+$/, '')
}

// Index is built once lazily. If buildEquipmentIndex() throws, _indexBuilt stays
// false so the next call retries. Does not auto-refresh if packs change at runtime.
let _indexBuilt = false
async function ensureIndex() {
  if (_indexBuilt) return
  await game.dsa5.itemLibrary.buildEquipmentIndex()
  _indexBuilt = true
}

export async function resolveItem(name, preferredType, fallbackTypes = []) {
  if (!name) return null
  await ensureIndex()

  // Strip trailing Roman numeral tier suffix before searching (e.g. "Gutaussehend I" → "Gutaussehend").
  // Some items are stored without the tier in the compendium.
  const stripped = name.replace(TIER_RE, '').trim()

  for (const type of [preferredType, ...fallbackTypes]) {
    // Fetch once per type, then check for exact match and approximate match
    let results = await game.dsa5.itemLibrary.findCompendiumItem(name, type)
    if (!results?.length && stripped !== name) {
      results = await game.dsa5.itemLibrary.findCompendiumItem(stripped, type)
    }
    if (!results?.length) continue

    const exact = results.find(i => i.type === type && i.name.toLowerCase() === name.toLowerCase())
    if (exact) return { item: exact, matchType: 'exact' }

    // Approximate: Levenshtein distance <= 2 on normalized names,
    // OR base-name match after stripping parenthesized specializations from both sides
    // (e.g. "Ortskenntnis ()" vs "Ortskenntnis", "Tradition (Geoden)" vs "Tradition")
    const stripSpec = (s) => normalize(s).replace(/\s*\(.*\)$/, '').trim()
    const approx = results.find(i => {
      if (i.type !== type) return false
      if (levenshtein(normalize(i.name), normalize(name)) <= 2) return true
      return levenshtein(stripSpec(i.name), stripSpec(name)) <= 2
    })
    if (approx) return { item: approx, matchType: 'approximate', originalName: name, matchedName: approx.name }
  }

  return null
}

export function isEquipmentPack(item) {
  return item.type === 'equipment' &&
    (item.name.toLowerCase().includes('paket') || item.system?.pack === true)
}

export async function resolveAll(parsed) {
  const results = { resolved: [], approximate: [], packs: [], missing: [] }

  const resolve = async (name, type, fallbacks = [], displayName = name) => {
    const r = await resolveItem(name, type, fallbacks)
    if (!r) { results.missing.push({ name: displayName, type }); return null }
    if (isEquipmentPack(r.item)) { results.packs.push(r); return null }
    if (r.matchType === 'approximate') results.approximate.push({ ...r, originalName: r.originalName ?? name, displayName })
    else results.resolved.push(r)
    return r.item
  }

  // "Waffenlos" is unarmed combat — not a weapon item, handled by Raufen combat skill
  const weaponItems = await Promise.all(
    parsed.weapons.filter(w => w.name.toLowerCase() !== 'waffenlos')
      .map(w => resolve(w.name, 'meleeweapon', ['rangeweapon']))
  )
  // "Keine" means no armor — skip rather than reporting as missing
  const armorItems = await Promise.all(
    parsed.armor.filter(a => a.name !== 'Keine').map(a => resolve(a.name, 'armor'))
  )
  // SF names often include a specialization in parentheses: "Ortskenntnis (Festum)"
  // The compendium stores the base item; strip the specialization before looking up.
  const sfItems = await Promise.all(
    parsed.sonderfertigkeiten.map(async s => {
      const { base: baseNoSpec, tier } = extractTier(s)
      const base = baseNoSpec.replace(/\s*\(.*\)$/, '').trim() || baseNoSpec
      const item = await resolve(base, 'specialability', [], s)
      return applyTier(item, tier)
    })
  )
  const vorteilItems = await Promise.all(
    parsed.vorteile.map(async v => {
      const { base, tier } = extractTier(v)
      const item = await resolve(base || v, 'advantage', [], v)
      return applyTier(item, tier)
    })
  )
  // "keine" means no disadvantages — skip
  const nachteilItems = await Promise.all(
    parsed.nachteile.filter(n => n.toLowerCase() !== 'keine')
      .map(async n => {
        const { base, tier } = extractTier(n)
        const item = await resolve(base || n, 'disadvantage', [], n)
        return applyTier(item, tier)
      })
  )
  // Languages are stored as "Sprache (X)" in the DSA5 compendium.
  // Statblock format: "Muttersprache Goblinisch III" → search "Sprache (Goblinisch)"
  const sprachenItems = await Promise.all(
    parsed.sprachen.map(s => {
      const base = s.replace(/^(Muttersprache|Zweitsprache|Taubstummensprache)\s+/i, '')
                    .replace(TIER_RE, '').trim()
      return resolve(`Sprache (${base})`, 'specialability', [], s)
    })
  )
  // Scripts are stored as "Schrift (X)" in the DSA5 compendium.
  const schriftenItems = await Promise.all(
    parsed.schriften.map(s => resolve(`Schrift (${s})`, 'specialability', [], s))
  )

  return {
    ...results,
    items: [...weaponItems, ...armorItems, ...sfItems, ...vorteilItems, ...nachteilItems, ...sprachenItems, ...schriftenItems].filter(Boolean),
  }
}
