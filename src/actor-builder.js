/**
 * Builds a DSA5 NPC actor from a reviewed statblock state.
 * Requires Foundry runtime (Actor.create, createEmbeddedDocuments).
 */

import { resolveItem } from './compendium-resolver.js'

function buildGmNotes(fluff, gossip, stats) {
  const lines = []
  const displayName = [fluff?.titel, fluff?.name].filter(Boolean).join(' ') || ''
  if (fluff.npcCategory) lines.push(`<h2>[${fluff.npcCategory}] ${displayName}</h2>`)
  if (fluff.kurzcharakteristik) lines.push(`<p><strong>Kurzcharakteristik:</strong> ${fluff.kurzcharakteristik}</p>`)
  if (fluff.motivation) lines.push(`<p><strong>Motivation:</strong> ${fluff.motivation}</p>`)
  if (fluff.agenda) lines.push(`<p><strong>Agenda:</strong> ${fluff.agenda}</p>`)
  if (fluff.funktion) lines.push(`<p><strong>Funktion:</strong> ${fluff.funktion}</p>`)
  if (fluff.hintergrund) lines.push(`<p><strong>Hintergrund:</strong> ${fluff.hintergrund}</p>`)
  if (fluff.feindbilder?.length) lines.push(`<p><strong>Feindbilder:</strong> ${fluff.feindbilder.join(', ')}</p>`)
  if (fluff.darstellung) lines.push(`<p><strong>Darstellung:</strong> ${fluff.darstellung}</p>`)
  if (fluff.schicksal) lines.push(`<p><strong>Schicksal:</strong> ${fluff.schicksal}</p>`)
  if (fluff.besonderheiten) lines.push(`<p><strong>Besonderheiten:</strong> ${fluff.besonderheiten}</p>`)
  if (fluff.zitate?.length) lines.push(`<p><strong>Zitate:</strong><br>${fluff.zitate.join('<br>')}</p>`)
  if (stats?.sozialstatus) lines.push(`<p><strong>Sozialstatus:</strong> ${stats.sozialstatus}</p>`)
  if (stats?.kampfverhalten) lines.push(`<p><strong>Kampfverhalten:</strong> ${stats.kampfverhalten}</p>`)
  if (stats?.flucht) lines.push(`<p><strong>Flucht:</strong> ${stats.flucht}</p>`)
  if (gossip?.entries?.length) {
    lines.push('<h3>Gerüchte</h3>')
    for (const entry of gossip.entries) lines.push(`<p>${entry.text}</p>`)
  }
  return lines.join('\n')
}

export async function buildActor(reviewState) {
  const { stats, fluff, gossip, resolution, herkunft, professionText } = reviewState

  // The review dialog stores the user-confirmed full name in fluff.name
  const name = fluff?.name ?? stats?.name ?? ''

  // For NPCs, store attribute values directly in 'initial'.
  // The DSA5 system computes ch.value = ch.initial + ch.advances + modifiers.
  // NPCs have no species-derived initial, so we own the full value here.
  const attr = stats?.attributes ?? {}

  // The DSA5 system computes wounds.current = wounds.initial + ko.value * 2 for NPCs.
  // wounds.initial is additive on top of that base, so we store only the difference.
  const koVal = attr.KO ?? 8
  const parsedLeP = stats?.derived?.LeP ?? null
  const woundsInitial = parsedLeP !== null ? Math.max(0, parsedLeP - koVal * 2) : 0

  const actorData = {
    name,
    type: 'npc',
    system: {
      characteristics: {
        mu: { initial: attr.MU ?? 8 },
        kl: { initial: attr.KL ?? 8 },
        in: { initial: attr.IN ?? 8 },
        ch: { initial: attr.CH ?? 8 },
        ff: { initial: attr.FF ?? 8 },
        ge: { initial: attr.GE ?? 8 },
        ko: { initial: attr.KO ?? 8 },
        kk: { initial: attr.KK ?? 8 },
      },
      status: {
        wounds: { initial: woundsInitial, value: parsedLeP ?? (woundsInitial + koVal * 2) },
        astralenergy: { initial: stats?.derived?.Asp ?? 0 }, // null means NPC has no Asp/KaP; default to 0
        karmaenergy: { initial: stats?.derived?.KaP ?? 0 }, // null means NPC has no Asp/KaP; default to 0
        initiative: { current: stats?.derived?.INI?.base ?? 0 },
        dodge: { modifier: 0 },
        fatePoints: { current: stats?.derived?.Schip ?? 0 },
        soulpower: { initial: stats?.derived?.SK ?? 0 },
        toughness: { initial: stats?.derived?.ZK ?? 0 },
        speed: { initial: stats?.derived?.GS ?? 0 },
      },
      details: {
        biography: { value: buildGmNotes(fluff ?? {}, gossip ?? {}, stats) },
        socialstate: { value: 0 },
      },
    },
    flags: {
      'dsa5-statblock-importer': {
        npcCategory: fluff?.npcCategory ?? null,
      },
    },
  }

  const actor = await Actor.create(actorData)
  if (!actor) {
    ui.notifications?.error('Schauspieler konnte nicht erstellt werden.')
    return null
  }

  // Create resolved items (weapons, armor, abilities, etc.)
  if (resolution?.items?.length) {
    await actor.createEmbeddedDocuments('Item', resolution.items.map(i => i.toObject?.() ?? i))
  }

  // Create skills from compendium and set values
  const skillItems = []
  for (const talents of Object.values(stats?.talente ?? {})) {
    for (const t of talents) {
      const r = await resolveItem(t.name, 'skill')
      if (r?.item) {
        const obj = r.item.toObject()
        obj.system.talentValue = { value: t.value }
        skillItems.push(obj)
      }
    }
  }

  // Create combat skills from compendium and set values
  const combatSkillItems = []
  for (const kt of stats?.kampftechniken ?? []) {
    const r = await resolveItem(kt.name, 'combatskill')
    if (r?.item) {
      const obj = r.item.toObject()
      obj.system.talentValue = { value: kt.value }
      combatSkillItems.push(obj)
    }
  }

  if (skillItems.length || combatSkillItems.length) {
    await actor.createEmbeddedDocuments('Item', [...skillItems, ...combatSkillItems])
  }

  // Add Herkunft items (Spezies, Kultur, Profession) if dragged in by user.
  // Also update system.details so DSA5 sheet header shows the names.
  const herkunftItems = Object.values(herkunft ?? {}).filter(Boolean)
  if (herkunftItems.length) {
    await actor.createEmbeddedDocuments('Item', herkunftItems.map(i => i.toObject?.() ?? i))
    const detailsUpdate = {}
    if (herkunft?.spezies) detailsUpdate['system.details.species.value'] = herkunft.spezies.name
    if (herkunft?.kultur) detailsUpdate['system.details.culture.value'] = herkunft.kultur.name
    if (herkunft?.profession) detailsUpdate['system.details.career.value'] = herkunft.profession.name
    if (Object.keys(detailsUpdate).length) await actor.update(detailsUpdate)
  }

  if (!herkunft?.profession && professionText) {
    await actor.update({ 'system.details.career.value': professionText })
  }

  return actor
}
