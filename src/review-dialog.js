import { buildActor } from './actor-builder.js'

export class ReviewDialog extends Application {
  constructor(data, options = {}) {
    super(options)
    this._data = data  // { stats, fluff, gossip, resolution }
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'dsa5-statblock-review',
      title: 'Import prüfen',
      template: 'modules/dsa5-statblock-importer/templates/review-dialog.hbs',
      width: 720,
      height: 800,
      resizable: true,
    })
  }

  getData() {
    const { stats, fluff, gossip, resolution } = this._data
    return {
      name: [fluff?.titel, fluff?.name ?? stats?.name].filter(Boolean).join(' ') || '',
      nameRequired: !(fluff?.name ?? stats?.name),
      npcCategory: fluff?.npcCategory,
      titel: fluff?.titel,
      attributes: stats?.attributes ?? {},
      derived: stats?.derived ?? {},
      weapons: stats?.weapons ?? [],
      armor: stats?.armor ?? [],
      kampftechniken: stats?.kampftechniken ?? [],
      talente: stats?.talente ?? {},
      sonderfertigkeiten: stats?.sonderfertigkeiten ?? [],
      vorteile: stats?.vorteile ?? [],
      nachteile: stats?.nachteile ?? [],
      sprachen: stats?.sprachen ?? [],
      schriften: stats?.schriften ?? [],
      sozialstatus: stats?.sozialstatus ?? '',
      fluff: fluff ?? {},
      gossip: gossip ?? {},
      resolved: resolution.resolved,
      approximate: resolution.approximate,
      missing: resolution.missing,
      packs: resolution.packs,
      editWeapons: (stats?.weapons ?? [])
        .filter(w => w.name.toLowerCase() !== 'waffenlos')
        .map(w => w.name).join(', '),
      editArmor: (stats?.armor ?? [])
        .filter(a => a.name !== 'Keine')
        .map(a => a.name).join(', '),
      editSf: (stats?.sonderfertigkeiten ?? []).join(', '),
      editVorteile: (stats?.vorteile ?? []).join(', '),
      editNachteile: (stats?.nachteile ?? [])
        .filter(n => n.toLowerCase() !== 'keine').join(', '),
      editSprachen: (stats?.sprachen ?? []).join(', '),
      editSchriften: (stats?.schriften ?? []).join(', '),
    }
  }

  activateListeners(html) {
    super.activateListeners(html)
    html.find('button[name="create"]').on('click', () => this._onCreate(html))
    html.find('button[name="cancel"]').on('click', () => this.close())
  }

  async _onCreate(html) {
    const name = html.find('[name="actor-name"]').val().trim()
    if (!name) {
      ui.notifications.warn('Name ist ein Pflichtfeld.')
      html.find('[name="actor-name"]').addClass('error')
      return
    }

    const attrs = ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KO', 'KK']
    const editedAttributes = {}
    for (const attr of attrs) {
      const val = parseInt(html.find(`[name="attr-${attr}"]`).val())
      editedAttributes[attr] = isNaN(val) ? (this._data.stats?.attributes?.[attr] ?? 0) : val
    }

    const readList = name => html.find(`[name="${name}"]`).val().trim()
      .split(',').map(s => s.trim()).filter(Boolean)

    const editedWeapons = readList('edit-weapons').map(name => ({ name }))
    const editedArmor  = readList('edit-armor').map(name => ({ name }))
    const editedStats  = {
      ...this._data.stats,
      attributes: editedAttributes,
      weapons: editedWeapons,
      armor: editedArmor.length ? editedArmor : [{ name: 'Keine', RS: 0, BE: 0 }],
      sonderfertigkeiten: readList('edit-sf'),
      vorteile: readList('edit-vorteile'),
      nachteile: readList('edit-nachteile'),
      sprachen: readList('edit-sprachen'),
      schriften: readList('edit-schriften'),
    }

    const { resolveAll } = await import('./compendium-resolver.js')
    const editedResolution = await resolveAll(editedStats)

    const reviewState = {
      ...this._data,
      fluff: { ...this._data.fluff, name },
      stats: editedStats,
      resolution: editedResolution,
    }

    const actor = await buildActor(reviewState)
    this.close()
    actor.sheet.render(true)
  }
}
