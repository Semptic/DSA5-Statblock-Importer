Hooks.on('renderActorDirectory', (app, html) => {
  if (!game.user.isGM) return
  const button = $(`<button type="button">
    <i class="fas fa-file-import"></i>
    ${game.i18n.localize('DSA5SI.button.import')}
  </button>`)
  html.find('.directory-header .action-buttons').append(button)
  button.on('click', () => {
    ui.notifications.info('DSA5 Statblock Importer: coming soon')
  })
})
