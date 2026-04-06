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

    const reviewState = {
      ...this._data,
      fluff: { ...this._data.fluff, name },
      stats: { ...this._data.stats, attributes: editedAttributes },
    }

    const actor = await buildActor(reviewState)
    this.close()
    actor.sheet.render(true)
  }
}
