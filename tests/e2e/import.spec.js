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

    // Delete pre-existing actor with this name (idempotent reruns)
    await page.evaluate(name => {
      const existing = game.actors.getName(name)
      return existing?.delete()
    }, expected.name)

    // Open import dialog — find the button containing 'importieren' text.
    // The button has no name/class/data-action, only text content.
    // Use JS click to avoid viewport-clipping issues with sidebar buttons.
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#actors .action-buttons button'))
        .find(b => b.textContent.includes('importieren') || b.textContent.includes('Statblock'))
      if (!btn) throw new Error('Import button not found')
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
