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
export function extractTier(name) {
  const m = name.match(TIER_RE)
  if (m) {
    const tier = Math.max(...m[1].split('+').map(romanToInt))
    if (tier > 0) return { base: name.slice(0, -m[0].length).trim(), tier }
  }
  return { base: name, tier: 1 }
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
  const baseName = obj.name.replace(/\s*\([^)]*\)$/, '').trim()
  obj.name = `${baseName} ${spec}`
  return obj
}

// Levenshtein distance for fuzzy matching
export function levenshtein(a, b) {
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
export function normalize(name) {
  return name.trim().toLowerCase().replace(TIER_RE, '')
}

// Strips trailing parenthesized specialization from a normalized name.
const stripSpec = (s) => normalize(s).replace(/\s*\([^)]*\)$/, '').trim()

// Splits a parenthesized spec containing commas at the outermost level.
// "Persönlichkeitsschwäche (Arroganz, Eitelkeit)" → { base: "Persönlichkeitsschwäche", parts: ["Arroganz", "Eitelkeit"] }
// "Ortskenntnis (Festum)" → null  (no comma)
// "Schriftstellerei (Sagen & Legenden (Märchen))" → null  (comma only inside nested parens)
export function splitCommaSpec(name) {
  // Find the outermost opening paren position using extractSpec logic
  let depth = 0, outerOpen = -1
  for (let i = 0; i < name.length; i++) {
    if (name[i] === '(') {
      if (depth === 0) outerOpen = i
      depth++
    } else if (name[i] === ')') {
      depth--
    }
  }
  if (depth !== 0 || outerOpen < 0) return null
  const base = name.slice(0, outerOpen).trim()
  if (!base) return null
  const inner = name.slice(outerOpen + 1, name.length - 1)

  // Split inner on commas at depth 0 only
  const parts = []
  let current = '', d = 0
  for (const ch of inner) {
    if (ch === '(') d++
    else if (ch === ')') d--
    if (ch === ',' && d === 0) {
      const p = current.trim()
      if (p) parts.push(p)
      current = ''
    } else {
      current += ch
    }
  }
  const last = current.trim()
  if (last) parts.push(last)

  if (parts.length < 2) return null
  return { base, parts }
}

// Parses a statblock name against an adoption registry object.
// Registry keys are like "Fertigkeitsspezialisierung ()" with base name + " ()".
// For area:true items: "Fertigkeitsspezialisierung Reiten (Kampfmanöver)"
//   → { baseName: "Fertigkeitsspezialisierung", adoptionName: "Reiten", customEntry: "Kampfmanöver", rule }
// For text/other items: "Ortskenntnis (Festum)"
//   → { baseName: "Ortskenntnis", adoptionName: "Festum", customEntry: null, rule }
export function parseAdoption(name, registry) {
  if (!name || !registry) return null

  // Sort keys longest-first to prefer "Weg der Gelehrten" over "Weg"
  const entries = Object.entries(registry).sort((a, b) => b[0].length - a[0].length)

  for (const [key, rule] of entries) {
    const baseName = key.replace(/\s*\(\)$/, '').trim()
    if (!baseName) continue

    if (rule.area) {
      // Pattern: "BaseName Skill (Spec)" or "BaseName Skill"
      if (!name.startsWith(baseName + ' ')) continue
      const rest = name.slice(baseName.length).trim()
      // Check if rest has a trailing (...) for the spec
      const specIdx = rest.lastIndexOf(' (')
      if (specIdx >= 0 && rest.endsWith(')')) {
        const adoptionName = rest.slice(0, specIdx).trim()
        const customEntry = rest.slice(specIdx + 2, rest.length - 1).trim()
        if (adoptionName) return { baseName, adoptionName, customEntry: customEntry || null, rule }
      }
      // No spec: just "BaseName Skill"
      if (rest && !rest.startsWith('(')) {
        return { baseName, adoptionName: rest, customEntry: null, rule }
      }
    } else {
      // Pattern: "BaseName (Text)" or just "BaseName" matching via normal spec-stripping
      if (name === baseName) return { baseName, adoptionName: '', customEntry: null, rule }
      if (!name.startsWith(baseName)) continue
      const rest = name.slice(baseName.length).trim()
      if (!rest.startsWith('(') || !rest.endsWith(')')) continue
      // Verify parens are balanced before slicing
      let depth = 0, valid = true
      for (const ch of rest) {
        if (ch === '(') depth++
        else if (ch === ')') depth--
        if (depth < 0) { valid = false; break }
      }
      if (!valid || depth !== 0) continue
      const adoptionName = rest.slice(1, rest.length - 1).trim()
      return { baseName, adoptionName, customEntry: null, rule }
    }
  }
  return null
}

// Applies adoption data (name + effect.value) to a plain item object in-place.
export function applyAdoptionToItem(itemObj, adoption) {
  const { baseName, adoptionName, customEntry, rule } = adoption
  itemObj.name = customEntry
    ? `${baseName} (${adoptionName}, ${customEntry})`
    : `${baseName} (${adoptionName})`
  if (rule.effect && itemObj.system?.effect !== undefined) {
    itemObj.system.effect.value = `${adoptionName} ${rule.effect}`
  }
}

// Index is built once lazily. Storing the promise (not a boolean) means concurrent
// callers all await the same build instead of each kicking off their own.
// If buildEquipmentIndex() rejects, _indexPromise is reset so the next call retries.
let _indexPromise = null
async function ensureIndex() {
  if (!_indexPromise) {
    _indexPromise = game.dsa5.itemLibrary.buildEquipmentIndex()
      .catch(err => { _indexPromise = null; throw err })
  }
  await _indexPromise
}

export function warmIndex() {
  ensureIndex().catch(err => console.warn('DSA5 Statblock Importer: index warm-up failed', err))
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

    // Approximate: pick the closest Levenshtein match (distance <= 2), comparing both
    // normalized names and spec-stripped names to handle "Ortskenntnis ()" vs "Ortskenntnis".
    const scored = results
      .filter(i => i.type === type)
      .map(i => ({
        i,
        d: Math.min(
          levenshtein(normalize(i.name), normalize(name)),
          levenshtein(stripSpec(i.name), stripSpec(name))
        )
      }))
      .filter(({ d }) => d <= 2)
    const approx = scored.length ? scored.reduce((a, b) => a.d <= b.d ? a : b).i : undefined
    if (approx) return { item: approx, matchType: 'approximate', originalName: name, matchedName: approx.name }
  }

  return null
}

export function isEquipmentPack(item) {
  return item.type === 'equipment' &&
    (item.name.toLowerCase().includes('paket') || item.system?.pack === true)
}

// Returns the adoption registry for a given item type (requires Foundry runtime).
function getAdoptionRegistry(type) {
  if (!game.dsa5?.config) return null
  if (type === 'specialability') return game.dsa5.config.AbilitiesNeedingAdaption ?? null
  if (type === 'advantage' || type === 'disadvantage') return game.dsa5.config.vantagesNeedingAdaption ?? null
  return null
}

// Searches the compendium for all items matching the base name, then checks if each
// comma-separated part has an exact variant (e.g. "Base (Part)"). Returns an array of
// matched Foundry item documents (one per part) if ALL parts match, null otherwise.
async function resolveVariants(name, type) {
  const split = splitCommaSpec(name)
  if (!split) return null
  await ensureIndex()
  const candidates = await game.dsa5.itemLibrary.findCompendiumItem(split.base, type)
  if (!candidates?.length) return null
  const matched = []
  for (const part of split.parts) {
    const expected = `${split.base} (${part})`
    const item = candidates.find(i => i.type === type && i.name.toLowerCase() === expected.toLowerCase())
    if (!item) return null
    matched.push(item)
  }
  return matched
}

// Adoption-aware fallback: checks DSA5 adoption registries for items that need a skill/text
// selection (e.g. "Fertigkeitsspezialisierung Reiten (Kampfmanöver)"). Resolves the base
// compendium item and applies the adoption (name + effect.value). Returns a plain object.
async function tryAdoptionResolve(name, type) {
  const registry = getAdoptionRegistry(type)
  if (!registry) return null
  const adoption = parseAdoption(name, registry)
  if (!adoption) return null
  const r = await resolveItem(adoption.baseName, type)
  if (!r?.item) return null
  const obj = typeof r.item.toObject === 'function' ? r.item.toObject() : foundry.utils.deepClone(r.item)
  applyAdoptionToItem(obj, adoption)
  return obj
}

export async function resolveAll(parsed) {
  const results = { resolved: [], approximate: [], packs: [], missing: [] }

  const resolve = async (name, type, fallbacks = [], displayName = name) => {
    const r = await resolveItem(name, type, fallbacks)
    if (!r) { results.missing.push({ name: displayName, type }); return null }
    if (isEquipmentPack(r.item)) { results.packs.push(r); return null }
    if (r.matchType === 'approximate') results.approximate.push({ ...r, originalName: displayName, matchedName: r.item.name, displayName })
    else results.resolved.push({ ...r, originalName: displayName, type })
    return r.item
  }

  // 3-step pipeline for SF / Vorteile / Nachteile:
  //   1. Variant split – "Base (A, B)" → search compendium once, match exact variants
  //   2. Adoption fallback – checked before normal resolution so "Ortskenntnis (Kirschhausen)"
  //      resolves cleanly via the adoption registry instead of approximating to "Ortskenntnis ()"
  //   3. Normal resolution + applyTierAndSpec
  const resolveEntry = async (entry, type, fallbackTypes = []) => {
    const { base: baseNoSpec, tier } = extractTier(entry)
    const types = [type, ...fallbackTypes]

    // Step 1: variant split (e.g. "Persönlichkeitsschwäche (Arroganz, Eitelkeit)")
    for (const t of types) {
      const variantItems = await resolveVariants(entry, t)
      if (variantItems) {
        for (const item of variantItems) {
          if (isEquipmentPack(item)) { results.packs.push({ item }); }
          else results.resolved.push({ item, matchType: 'exact', originalName: item.name, type: t })
        }
        // Each variant is already its own item; apply tier 1 (variants don't stack)
        return variantItems.map(item => applyTier(item, 1))
      }
    }

    // Step 2: adoption fallback (before normal resolution)
    // Adoption items like "Ortskenntnis (Kirschhausen)" or "Schlechte Angewohnheit (Belästigung: Frauen)"
    // would otherwise hit the approximate path (stripSpec match to the "()" placeholder).
    for (const t of types) {
      const adoptedObj = await tryAdoptionResolve(entry, t)
      if (adoptedObj) {
        results.resolved.push({ item: adoptedObj, matchType: 'adoption', originalName: entry, type: t })
        return Array.from({ length: tier }, (_, i) => applyTier(adoptedObj, i + 1))
      }
    }

    // Step 3: normal resolution
    for (const t of types) {
      const r = await resolveItem(baseNoSpec, t)
      if (r) {
        if (isEquipmentPack(r.item)) { results.packs.push(r); return [] }
        if (r.matchType === 'approximate') results.approximate.push({ ...r, originalName: entry, matchedName: r.item.name, displayName: entry })
        else results.resolved.push({ ...r, originalName: entry, type: t })
        return Array.from({ length: tier }, (_, i) => applyTierAndSpec(r.item, i + 1, baseNoSpec))
      }
    }

    results.missing.push({ name: entry, type })
    return []
  }

  // "Waffenlos" is unarmed combat — not a weapon item, handled by Raufen combat skill
  const nonWaffenlosWeapons = parsed.weapons.filter(w => w.name.toLowerCase() !== 'waffenlos')
  const weaponItems = await Promise.all(
    nonWaffenlosWeapons.map(w => resolve(w.name, 'meleeweapon', ['rangeweapon']))
  )
  // "Keine" means no armor — skip rather than reporting as missing
  const armorItems = await Promise.all(
    parsed.armor.filter(a => a.name !== 'Keine').map(a => resolve(a.name, 'armor', ['equipment']))
  )
  // SF / Vorteile / Nachteile use the 3-step resolveEntry pipeline.
  // For tiered items (e.g. "Hohe Lebenskraft V"), DSA5 actors need one embedded item per
  // level (I through V), because each level is purchased separately in the system.
  // SF / Vorteile / Nachteile all try specialability, advantage, and disadvantage —
  // preferred type first, then the others as fallback. Parser sometimes puts items in the
  // wrong field due to PDF extraction; this lets manual edits resolve correctly on re-analyse.
  const sfItems = (await Promise.all(
    parsed.sonderfertigkeiten.map(s => resolveEntry(s, 'specialability', ['advantage', 'disadvantage']))
  )).flat()
  // "keine" means no advantages — skip
  const vorteilItems = (await Promise.all(
    parsed.vorteile.filter(v => v.toLowerCase() !== 'keine').map(v => resolveEntry(v, 'advantage', ['specialability', 'disadvantage']))
  )).flat()
  // "keine" means no disadvantages — skip
  const nachteilItems = (await Promise.all(
    parsed.nachteile.filter(n => n.toLowerCase() !== 'keine')
      .map(n => resolveEntry(n, 'disadvantage', ['specialability', 'advantage']))
  )).flat()
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

  // Derive kampftechniken from weapons when no explicit Kampftechniken block was provided.
  // Reuses already-resolved weapon items (no extra compendium calls).
  if (!parsed.kampftechniken?.length) {
    const ktMap = new Map() // technique name → max value
    // Single pass: Waffenlos → Raufen (special case); all others read combatskill from resolved item.
    const weaponItemMap = new Map(nonWaffenlosWeapons.map((w, i) => [w, weaponItems[i]]))
    for (const w of parsed.weapons) {
      if (w.name.toLowerCase() === 'waffenlos') {
        if (w.AT != null && (ktMap.get('Raufen') ?? -1) < w.AT) ktMap.set('Raufen', w.AT)
      } else {
        const item = weaponItemMap.get(w)
        if (!item) continue
        const ct = item.system?.combatskill?.value
        if (!ct) continue
        const val = w.FK ?? w.AT
        if (val == null) continue
        if ((ktMap.get(ct) ?? -1) < val) ktMap.set(ct, val)
      }
    }
    if (ktMap.size > 0) {
      parsed.kampftechniken = Array.from(ktMap, ([name, value]) => ({ name, value, atBonus: null, paBonus: null }))
    }
  }

  return {
    ...results,
    items: [...weaponItems, ...armorItems, ...sfItems, ...vorteilItems, ...nachteilItems, ...sprachenItems, ...schriftenItems].filter(Boolean),
  }
}
