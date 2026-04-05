/**
 * Builds a DSA5 NPC actor from a reviewed statblock state.
 * Requires Foundry runtime (Actor.create, createEmbeddedDocuments).
 */

import { resolveItem } from './compendium-resolver.js'

function buildGmNotes(fluff, gossip, stats) {
  const lines = []
  if (fluff.npcCategory) lines.push(`<h2>[${fluff.npcCategory}] ${fluff.titel ?? ''} ${fluff.name ?? ''}</h2>`)
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
  const { stats, fluff, gossip, resolution } = reviewState

  const name = [fluff?.titel, fluff?.name ?? stats?.name].filter(Boolean).join(' ')

  // attributes: statblock value - 8 = advances (base initial is 8)
  const attr = stats?.attributes ?? {}
  const adv = (v) => (v ?? 8) - 8

  const actorData = {
    name,
    type: 'npc',
    system: {
      characteristics: {
        mu: { advances: adv(attr.MU) },
        kl: { advances: adv(attr.KL) },
        in: { advances: adv(attr.IN) },
        ch: { advances: adv(attr.CH) },
        ff: { advances: adv(attr.FF) },
        ge: { advances: adv(attr.GE) },
        ko: { advances: adv(attr.KO) },
        kk: { advances: adv(attr.KK) },
      },
      status: {
        wounds: { initial: stats?.derived?.LeP?.base ?? 0 },
        astralenergy: { initial: stats?.derived?.Asp?.base ?? 0 },
        karmaenergy: { initial: stats?.derived?.KaP?.base ?? 0 },
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

  // Create resolved items (weapons, armor, abilities, etc.)
  if (resolution?.items?.length) {
    await actor.createEmbeddedDocuments('Item', resolution.items.map(i => i.toObject()))
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

  return actor
}
