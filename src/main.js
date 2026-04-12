import { ImportDialog } from './import-dialog.js'
import { warmIndex } from './compendium-resolver.js'

Hooks.once('ready', () => warmIndex())

Hooks.on('renderActorDirectory', (app, html) => {
  if (!game.user.isGM) return
  // Foundry v13 passes HTMLElement; use native DOM
  const root = html instanceof HTMLElement ? html : html[0]
  const actionButtons = root?.querySelector('.directory-header .action-buttons')
  if (!actionButtons) return
  if (actionButtons.querySelector('.dsa5si-import-btn')) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dsa5si-import-btn'
  button.innerHTML = `<i class="fas fa-file-import"></i> ${game.i18n.localize('DSA5SI.button.import')}`
  actionButtons.append(button)
  button.addEventListener('click', () => new ImportDialog().render(true))
})
