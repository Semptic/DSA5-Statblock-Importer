import { buildActor } from './actor-builder.js'
import { resolveAll } from './compendium-resolver.js'
import { parseCommaList } from './parser/stats-parser.js'

export class ReviewDialog extends Application {
  constructor(data, options = {}) {
    super(options)
    this._data = data  // { stats, fluff, gossip, resolution }
    // keyed by allItems index → override item dragged from compendium
    this._overrides = {}
    // keyed by field name ('spezies', 'kultur', 'profession') → dropped item
    this._herkunft = {}
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

  // Flat list of all compendium resolution entries (exact + approx + missing),
  // in that order, each with a stable idx for override tracking.
  _buildAllItems(resolution) {
    const items = []
    for (const r of resolution.resolved) {
      items.push({ idx: items.length, originalName: r.originalName, type: r.type, status: 'exact', matchedName: r.item.name, item: r.item })
    }
    for (const r of resolution.approximate) {
      items.push({ idx: items.length, originalName: r.originalName, type: r.type, status: 'approximate', matchedName: r.matchedName, item: r.item })
    }
    for (const m of resolution.missing) {
      items.push({ idx: items.length, originalName: m.name, type: m.type, status: 'missing', matchedName: null, item: null })
    }
    return items
  }

  getData() {
    const { stats, fluff, gossip, resolution } = this._data
    const allItems = this._buildAllItems(resolution)
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
      allItems,
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

    // Drop zones: item resolution rows + Herkunft fields
    html[0].querySelectorAll('.item-drop-zone').forEach(el => {
      el.addEventListener('dragover', e => { e.preventDefault(); el.classList.add('drag-over') })
      el.addEventListener('dragleave', () => el.classList.remove('drag-over'))
      el.addEventListener('drop', e => this._onDropItem(e, el))
    })
  }

  async _onDropItem(event, el) {
    event.preventDefault()
    el.classList.remove('drag-over')

    let data
    try { data = JSON.parse(event.dataTransfer.getData('text/plain')) } catch { return }
    if (data.type !== 'Item' || !data.uuid) return

    const item = await fromUuid(data.uuid)
    if (!item) return

    const field = el.dataset.field
    if (field) {
      // Herkunft drop zone (Spezies, Kultur, Profession)
      this._herkunft[field] = item
      el.innerHTML = `<span class="drop-zone__found">${item.name}</span>`
      el.closest('.compendium-row')?.classList.remove('compendium-row--empty')
      el.closest('.compendium-row')?.classList.add('compendium-row--override')
    } else {
      // Resolution row override
      const idx = parseInt(el.dataset.idx)
      if (isNaN(idx)) return
      this._overrides[idx] = item
      el.innerHTML = `<span class="drop-zone__found">${item.name}</span>`
      const row = el.closest('.compendium-row')
      if (row) {
        row.classList.remove('compendium-row--exact', 'compendium-row--approximate', 'compendium-row--missing')
        row.classList.add('compendium-row--override')
      }
    }
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

  // Re-resolve items from current form values and re-render.
  async _onReanalyse(html) {
    const { name, editedStats } = this._readFormState(html)
    const resolution = await resolveAll(editedStats)
    this._overrides = {}  // resolution changed — old indices are invalid
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

    // Use the stored resolution (set by last re-analyse or initial load).
    // Apply any per-row overrides the user dragged in.
    const resolution = this._data.resolution
    const allItems = this._buildAllItems(resolution)
    const effectiveItems = allItems
      .map((row, i) => this._overrides[i] ?? row.item)
      .filter(Boolean)

    const professionText = html.find('[name="profession-text"]').val().trim()
    const actor = await buildActor({
      ...this._data,
      fluff: { ...this._data.fluff, name },
      stats: editedStats,
      resolution: { ...resolution, items: effectiveItems },
      herkunft: this._herkunft,
      professionText,
    })
    this.close()
    actor.sheet.render(true)
  }
}
