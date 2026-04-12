import { clean } from './parser/cleaner.js'
import { parseStats } from './parser/stats-parser.js'
import { parseFluff } from './parser/fluff-parser.js'
import { parseGossip } from './parser/gossip-parser.js'
import { resolveAll } from './compendium-resolver.js'

export class ImportDialog extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'dsa5-statblock-importer',
      title: game.i18n.localize('DSA5SI.button.import'),
      template: 'modules/dsa5-statblock-importer/templates/import-dialog.hbs',
      width: 600,
      height: 'auto',
    })
  }

  activateListeners(html) {
    super.activateListeners(html)
    html.find('button[name="analyse"]').on('click', () => this._onAnalyse(html))
  }

  async _onAnalyse(html) {
    if (this._analysing) return
    this._analysing = true
    try {
      const rawStats = html.find('[name="stats"]').val()
      const rawFluff = html.find('[name="fluff"]').val()
      const rawGossip = html.find('[name="gossip"]').val()

      if (!rawStats && !rawFluff && !rawGossip) {
        ui.notifications.error(game.i18n.localize('DSA5SI.error.noInput'))
        return
      }

      const stats = rawStats ? parseStats(clean(rawStats)) : null
      const fluff = rawFluff ? parseFluff(clean(rawFluff)) : null
      const gossip = rawGossip ? parseGossip(clean(rawGossip)) : null

      const resolution = stats ? await resolveAll(stats) : { resolved: [], approximate: [], packs: [], missing: [] }

      try {
        const { ReviewDialog } = await import('./review-dialog.js')
        new ReviewDialog({ stats, fluff, gossip, resolution }).render(true)
        this.close()
      } catch (err) {
        console.error(err)
        ui.notifications.error(game.i18n.localize('DSA5SI.error.importFailed'))
      }
    } finally {
      this._analysing = false
    }
  }
}
