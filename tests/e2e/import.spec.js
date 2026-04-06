import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from './foundry-fixture.js'
import { splitFixtureSections, assertActor } from './helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, '../fixtures')

const FIXTURES = [
  'jaruslaw',
  'nfk1-bruutsch',
  'nfk1-jaani',
  'nfk1-zelda',
  'nfk2-miesko',
  'synthetic-stats-only',
  'synthetic-geweihter',
]

for (const fixtureName of FIXTURES) {
  test(`imports ${fixtureName}`, async ({ page }) => {
    const expected = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'expected-e2e', `${fixtureName}.json`), 'utf8')
    )
    if (!expected.name) throw new Error(`Missing 'name' in expected-e2e/${fixtureName}.json`)

    // Delete pre-existing actor with this name (idempotent reruns)
    await page.evaluate(name => {
      const existing = game.actors.getName(name)
      return existing?.delete()
    }, expected.name)

    // Import button has no CSS selector or name attribute — find by German button text.
    // Note: must use JS click (not Playwright locator) because the sidebar
    // may be partially outside the Playwright viewport.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#actors .action-buttons button'))
        .find(b => b.textContent.includes('importieren'))
      if (!btn) throw new Error('Import button ("Statblock importieren") not found in actors directory')
      btn.click()
    })
    await page.locator('#dsa5-statblock-importer').waitFor()

    // Fill textareas from fixture file
    const fixtureText = fs.readFileSync(path.join(fixturesDir, `${fixtureName}.txt`), 'utf8')
    const [stats, fluff, gossip] = splitFixtureSections(fixtureText)
    await page.locator('textarea[name="stats"]').fill(stats ?? '')
    await page.locator('textarea[name="fluff"]').fill(fluff ?? '')
    await page.locator('textarea[name="gossip"]').fill(gossip ?? '')

    // Analyse
    await page.locator('button[name="analyse"]').click()
    await page.locator('#dsa5-statblock-review').waitFor()

    // Create actor
    await page.locator('button[name="create"]').click()
    await page.locator('#dsa5-statblock-review').waitFor({ state: 'hidden' })

    // Wait for actor to appear in game.actors, then fetch
    await page.waitForFunction(name => !!game.actors.getName(name), expected.name, { timeout: 30_000 })
    const actor = await page.evaluate(name => game.actors.getName(name)?.toObject(), expected.name)
    expect(actor, `Actor "${expected.name}" not found in Foundry`).toBeTruthy()
    assertActor(actor, expected, expect)
  })
}
