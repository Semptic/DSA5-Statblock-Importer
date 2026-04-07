import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { test, expect } from './foundry-fixture.js'
import { splitFixtureSections, assertActor, openImportDialog } from './helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, '../fixtures')

test('empty input shows error notification, no actor created', async ({ page }) => {
  const actorCountBefore = await page.evaluate(() => game.actors.size)

  await openImportDialog(page)

  // Click Analyse with all textareas empty
  await page.locator('button[name="analyse"]').click()

  // Foundry renders error notifications in #notifications
  await page.locator('#notifications .notification.error').waitFor()

  // Import dialog should still be open
  await expect(page.locator('#dsa5-statblock-importer')).toBeVisible()

  // No new actor created
  const actorCountAfter = await page.evaluate(() => game.actors.size)
  expect(actorCountAfter).toBe(actorCountBefore)
})

test('stats-only import creates actor with correct attributes', async ({ page }) => {
  const expected = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'expected-e2e', 'synthetic-stats-only.json'), 'utf8')
  )
  if (!expected.name) throw new Error('Missing name in expected-e2e/synthetic-stats-only.json')

  // Delete pre-existing actor
  await page.evaluate(name => game.actors.getName(name)?.delete(), expected.name)

  await openImportDialog(page)

  // Fill only stats textarea
  const fixtureText = fs.readFileSync(path.join(fixturesDir, 'synthetic-stats-only.txt'), 'utf8')
  const [stats] = splitFixtureSections(fixtureText)
  if (!stats) throw new Error('synthetic-stats-only.txt has no stats section')
  await page.locator('textarea[name="stats"]').fill(stats)
  // fluff and gossip intentionally left empty

  await page.locator('button[name="analyse"]').click()
  await page.locator('#dsa5-statblock-review').waitFor()
  await page.locator('button[name="create"]').click()
  await page.locator('#dsa5-statblock-review').waitFor({ state: 'hidden' })

  await page.waitForFunction(name => !!game.actors.getName(name), expected.name, { timeout: 30_000 })
  const actor = await page.evaluate(name => game.actors.getName(name)?.toObject(), expected.name)
  expect(actor, `Actor "${expected.name}" not found`).toBeTruthy()
  assertActor(actor, expected, expect)
})

test('nfk1-jaani shows approximate matches in review dialog before creation', async ({ page }) => {
  const expected = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'expected-e2e', 'nfk1-jaani.json'), 'utf8')
  )
  if (!expected.name) throw new Error('Missing name in expected-e2e/nfk1-jaani.json')

  // Delete pre-existing actor
  await page.evaluate(name => game.actors.getName(name)?.delete(), expected.name)

  // Open dialog and fill all sections
  await openImportDialog(page)

  const fixtureText = fs.readFileSync(path.join(fixturesDir, 'nfk1-jaani.txt'), 'utf8')
  const [stats, fluff, gossip] = splitFixtureSections(fixtureText)
  await page.locator('textarea[name="stats"]').fill(stats ?? '')
  await page.locator('textarea[name="fluff"]').fill(fluff ?? '')
  await page.locator('textarea[name="gossip"]').fill(gossip ?? '')

  await page.locator('button[name="analyse"]').click()
  await page.locator('#dsa5-statblock-review').waitFor()

  // Assert approximate match fieldset is visible BEFORE creating
  // fieldset.approximate is rendered by review-dialog.hbs when approximate.length > 0
  await expect(page.locator('#dsa5-statblock-review fieldset.approximate')).toBeVisible()

  // Create and assert actor
  await page.locator('button[name="create"]').click()
  await page.locator('#dsa5-statblock-review').waitFor({ state: 'hidden' })

  await page.waitForFunction(name => !!game.actors.getName(name), expected.name, { timeout: 30_000 })
  const actor = await page.evaluate(name => game.actors.getName(name)?.toObject(), expected.name)
  expect(actor, `Actor "${expected.name}" not found`).toBeTruthy()
  assertActor(actor, expected, expect)
})
