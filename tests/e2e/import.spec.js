import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from './foundry-fixture.js'
import { splitFixtureSections, assertActor, openImportDialog } from './helpers.js'

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

    await openImportDialog(page)

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

    // Wait until the actor exists AND its embedded items have been written back to
    // the in-memory collection. Actor.create() resolves before createEmbeddedDocuments
    // propagates, so polling on items.size avoids a race condition.
    await page.waitForFunction(name => {
      const a = game.actors.getName(name)
      return a && a.items.size > 0
    }, expected.name, { timeout: 30_000 })

    // Serialize items explicitly from actor.items; toObject().items may still be
    // empty if the embedded-document sync hasn't round-tripped yet.
    const actor = await page.evaluate(name => {
      const a = game.actors.getName(name)
      if (!a) return null
      const obj = a.toObject()
      obj.items = [...a.items.values()].map(i => i.toObject())
      return obj
    }, expected.name)
    expect(actor, `Actor "${expected.name}" not found in Foundry`).toBeTruthy()
    assertActor(actor, expected, expect)
  })
}
