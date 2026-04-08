import { buildActor } from './actor-builder.js'
import { resolveAll } from './compendium-resolver.js'
import { parseCommaList } from './parser/stats-parser.js'

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
    html.find('button[name="reanalyse"]').on('click', () => this._onReanalyse(html))
    html.find('button[name="create"]').on('click', () => this._onCreate(html))
    html.find('button[name="cancel"]').on('click', () => this.close())
  }

  // Read current form values into { name, editedStats }.
  _readFormState(html) {
    const readList = fieldName => parseCommaList(html.find(`[name="${fieldName}"]`).val().trim())

    const attrs = ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KO', 'KK']
    const editedAttributes = {}
    for (const attr of attrs) {
      const val = parseInt(html.find(`[name="attr-${attr}"]`).val())
      editedAttributes[attr] = isNaN(val) ? (this._data.stats?.attributes?.[attr] ?? 0) : val
    }

    const armorList = readList('edit-armor')
    return {
      name: html.find('[name="actor-name"]').val().trim(),
      editedStats: {
        ...this._data.stats,
        attributes: editedAttributes,
        weapons: readList('edit-weapons').map(n => ({ name: n })),
        armor: armorList.length ? armorList.map(n => ({ name: n })) : [{ name: 'Keine', RS: 0, BE: 0 }],
        sonderfertigkeiten: readList('edit-sf'),
        vorteile: readList('edit-vorteile'),
        nachteile: readList('edit-nachteile'),
        sprachen: readList('edit-sprachen'),
        schriften: readList('edit-schriften'),
      },
    }
  }

  // Re-resolve items from current form values and re-render the dialog so the
  // user can see updated resolved/approximate/missing results before creating.
  async _onReanalyse(html) {
    const { name, editedStats } = this._readFormState(html)
    const resolution = await resolveAll(editedStats)
    this._data = {
      ...this._data,
      fluff: { ...this._data.fluff, name },
      stats: editedStats,
      resolution,
    }
    this.render(true)
  }

  async _onCreate(html) {
    const { name, editedStats } = this._readFormState(html)
    html.find('[name="actor-name"]').removeClass('error')
    if (!name) {
      ui.notifications.warn('Name ist ein Pflichtfeld.')
      html.find('[name="actor-name"]').addClass('error')
      return
    }

    const resolution = await resolveAll(editedStats)
    const actor = await buildActor({
      ...this._data,
      fluff: { ...this._data.fluff, name },
      stats: editedStats,
      resolution,
    })
    this.close()
    actor.sheet.render(true)
  }
}
