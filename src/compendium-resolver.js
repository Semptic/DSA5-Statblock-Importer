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
  if (!item) return item
  const obj = typeof item.toObject === 'function'
    ? item.toObject()
    : foundry.utils.deepClone(item)
  if (tier > 1 && obj.system && 'step' in obj.system) {
    obj.system = { ...obj.system, step: { ...obj.system.step, value: tier } }
  }
  return obj
}

// Extract the outermost trailing (...) from a name using balanced-paren scanning.
// "Ortskenntnis (Festum)" → "(Festum)"
// "Schriftstellerei (Betören (Liebesromane))" → "(Betören (Liebesromane))"
// "Gutaussehend" → null
function extractSpec(name) {
  let depth = 0, lastOuterOpen = -1
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '(') {
      if (depth === 0) lastOuterOpen = i
      depth++
    } else if (name[i] === ')') {
      depth--
    }
  }
  if (depth !== 0 || lastOuterOpen < 0) return null
  const base = name.slice(0, lastOuterOpen).trim()
  return base ? name.slice(lastOuterOpen) : null
}

// Like applyTier, but also ensures the item name contains the parenthesized
// specialization from originalName if the compendium item doesn't already have it.
// "Ortskenntnis ()" + "(Festum)" → "Ortskenntnis (Festum)"
// "Schnellladen (Bögen)" already ends with "(Bögen)" → no change
function applyTierAndSpec(item, tier, originalName) {
  if (!item) return item
  const obj = applyTier(item, tier)
  const spec = extractSpec(originalName)
  if (!spec) return obj
  if (obj.name.endsWith(spec)) return obj
  // Strip any existing trailing (...) from the compendium item name (e.g. "Ortskenntnis ()")
  const baseName = obj.name.replace(/\s*\(.*\)$/, '').trim()
  obj.name = `${baseName} ${spec}`
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
  return name.trim().toLowerCase().replace(TIER_RE, '')
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
  // Also strip parenthesized specialization as a last-resort fallback
  // (e.g. "Wuchtschlag I+II (Haken, Säbel)" → "Wuchtschlag I+II" when full name finds nothing).
  const strippedSpec = stripped.replace(/\s*\(.*\)$/, '').trim()

  for (const type of [preferredType, ...fallbackTypes]) {
    // Fetch once per type, then check for exact match and approximate match
    let results = await game.dsa5.itemLibrary.findCompendiumItem(name, type)
    if (!results?.length && stripped !== name) {
      results = await game.dsa5.itemLibrary.findCompendiumItem(stripped, type)
    }
    if (!results?.length && strippedSpec !== stripped) {
      results = await game.dsa5.itemLibrary.findCompendiumItem(strippedSpec, type)
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
  // SF names may include a parenthesized specialization ("Ortskenntnis (Festum)") or may
  // exist verbatim in the compendium ("Schnellladen (Bögen)"). Pass the full name to
  // resolveItem so an exact match is attempted first; the spec-stripped fallback inside
  // resolveItem handles cases where only the base name is in the compendium. After
  // resolution, applyTierAndSpec restores the original specialization in the item name.
  const sfItems = await Promise.all(
    parsed.sonderfertigkeiten.map(async s => {
      const { base: baseNoSpec, tier } = extractTier(s)
      const item = await resolve(baseNoSpec, 'specialability', [], s)
      return applyTierAndSpec(item, tier, baseNoSpec)
    })
  )
  const vorteilItems = await Promise.all(
    parsed.vorteile.map(async v => {
      const { base: baseNoSpec, tier } = extractTier(v)
      const item = await resolve(baseNoSpec || v, 'advantage', [], v)
      return applyTierAndSpec(item, tier, baseNoSpec || v)
    })
  )
  // "keine" means no disadvantages — skip
  const nachteilItems = await Promise.all(
    parsed.nachteile.filter(n => n.toLowerCase() !== 'keine')
      .map(async n => {
        const { base: baseNoSpec, tier } = extractTier(n)
        const item = await resolve(baseNoSpec || n, 'disadvantage', [], n)
        return applyTierAndSpec(item, tier, baseNoSpec || n)
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
