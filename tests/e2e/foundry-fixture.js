import { chromium, test as base } from '@playwright/test'

/**
 * Custom Playwright fixtures for Foundry VTT e2e tests.
 *
 * `connectedBrowser`: worker-scoped CDP connection to the Docker Foundry Chrome instance.
 * Reused across all tests in a worker — one connection per file.
 *
 * `page`: test-scoped. Returns the existing Foundry tab (not a new page).
 * Before each test: closes stale dialogs, navigates to the Actors sidebar tab.
 */
export const test = base.extend({
  connectedBrowser: [async (_fixtures, use) => {
    const browser = await chromium.connectOverCDP('http://localhost:9222')
    await use(browser)
    await browser.close()
  }, { scope: 'worker' }],

  page: async ({ connectedBrowser }, use) => {
    // Find the Foundry tab by URL — assumes only one Foundry tab is open
    const context = connectedBrowser.contexts()[0]
    const pages = context.pages()
    const page = pages.find(p => p.url().includes('localhost:30000')) ?? pages[0]
    if (!page) throw new Error('No Foundry tab found. Is Docker Foundry running on localhost:30000?')
    // Close any open Foundry Application windows left by a previous test.
    // Note: Foundry v13 uses foundry.applications.instances (a Map), not ui.windows.
    // Skip the sidebar itself — closing it would break changeTab below.
    await page.evaluate(async () => {
      for (const app of foundry.applications.instances.values()) {
        if (app.id === 'sidebar') continue
        try { await app.close() } catch { /* ignore close errors */ }
      }
    })
    // Navigate to the Actors sidebar tab using Foundry v13 API.
    // In v13 the sidebar nav and each directory tab are separate applications.
    // Both must be rendered: sidebar for the nav, ui.actors for the panel content.
    // Tab group is 'primary' in v13 (not 'sidebar').
    await page.evaluate(async () => {
      if (!ui.sidebar.rendered) await ui.sidebar.render(true)
      ui.sidebar.changeTab('actors', 'primary')
      if (ui.actors && !ui.actors.rendered) await ui.actors.render(true)
    })
    // Wait for actors directory header to be present (confirms tab is ready)
    await page.waitForFunction(() => !!document.querySelector('.directory-header .action-buttons'), { timeout: 10_000 })
    await use(page)
  },
})

export { expect } from '@playwright/test'
