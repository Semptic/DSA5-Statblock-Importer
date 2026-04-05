/**
 * Resolves parsed item names against DSA5 compendiums.
 * Requires: game.dsa5.itemLibrary (Foundry runtime)
 */

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function normalize(name) {
  return name.trim().toLowerCase().replace(/\s+[IVX]+$/, '')
}

// Index is built once lazily
let _indexBuilt = false
async function ensureIndex() {
  if (_indexBuilt) return
  await game.dsa5.itemLibrary.buildEquipmentIndex()
  _indexBuilt = true
}

export async function resolveItem(name, preferredType, fallbackTypes = []) {
  await ensureIndex()

  for (const type of [preferredType, ...fallbackTypes]) {
    const results = await game.dsa5.itemLibrary.findCompendiumItem(name, type)
    const exact = results?.find(i => i.type === type && i.name.toLowerCase() === name.toLowerCase())
    if (exact) return { item: exact, matchType: 'exact' }
  }

  // Approximate: Levenshtein distance <= 2 on normalized names
  for (const type of [preferredType, ...fallbackTypes]) {
    const results = await game.dsa5.itemLibrary.findCompendiumItem(name, type)
    const approx = results?.find(i => i.type === type && levenshtein(normalize(i.name), normalize(name)) <= 2)
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

  const resolve = async (name, type, fallbacks = []) => {
    const r = await resolveItem(name, type, fallbacks)
    if (!r) { results.missing.push({ name, type }); return null }
    if (isEquipmentPack(r.item)) { results.packs.push(r); return null }
    if (r.matchType === 'approximate') results.approximate.push(r)
    else results.resolved.push(r)
    return r.item
  }

  const weaponItems = await Promise.all(
    parsed.weapons.map(w => resolve(w.name, 'meleeweapon', ['rangeweapon']))
  )
  const armorItems = await Promise.all(
    parsed.armor.map(a => resolve(a.name, 'armor'))
  )
  const sfItems = await Promise.all(
    parsed.sonderfertigkeiten.map(s => resolve(s, 'specialability'))
  )
  const vorteilItems = await Promise.all(
    parsed.vorteile.map(v => resolve(v, 'advantage'))
  )
  const nachteilItems = await Promise.all(
    parsed.nachteile.map(n => resolve(n, 'disadvantage'))
  )
  const sprachenItems = await Promise.all(
    parsed.sprachen.map(s => resolve(s, 'specialability'))
  )
  const schriftenItems = await Promise.all(
    parsed.schriften.map(s => resolve(s, 'specialability'))
  )

  return {
    ...results,
    items: [...weaponItems, ...armorItems, ...sfItems, ...vorteilItems, ...nachteilItems, ...sprachenItems, ...schriftenItems].filter(Boolean),
  }
}
