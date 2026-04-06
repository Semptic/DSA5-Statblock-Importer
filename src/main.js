import { ImportDialog } from './import-dialog.js'

Hooks.on('renderActorDirectory', (app, html) => {
  if (!game.user.isGM) return
  // Foundry v13 passes HTMLElement; use native DOM
  const root = html instanceof HTMLElement ? html : html[0]
  const actionButtons = root?.querySelector('.directory-header .action-buttons')
  if (!actionButtons) return
  const button = document.createElement('button')
  button.type = 'button'
  button.innerHTML = `<i class="fas fa-file-import"></i> ${game.i18n.localize('DSA5SI.button.import')}`
  actionButtons.append(button)
  button.addEventListener('click', () => new ImportDialog().render(true))
})
