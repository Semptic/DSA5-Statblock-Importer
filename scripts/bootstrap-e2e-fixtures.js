// scripts/bootstrap-e2e-fixtures.js
// One-time script to generate tests/fixtures/expected-e2e/*.json
// Run with: pnpm bootstrap:e2e  (requires Docker Foundry running)

import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { splitFixtureSections } from '../tests/e2e/helpers.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, '../tests/fixtures')
const outputDir = path.resolve(__dirname, '../tests/fixtures/expected-e2e')

const FIXTURES = [
  'jaruslaw',
  'nfk1-bruutsch',
  'nfk1-jaani',
  'nfk1-zelda',
  'nfk2-miesko',
  'synthetic-stats-only',
  'synthetic-geweihter',
]

function extractExpected(actor) {
  return {
    name: actor.name,
    system: {
      characteristics: Object.fromEntries(
        Object.entries(actor.system.characteristics).map(([k, v]) => [k, { advances: v.advances }])
      ),
      status: {
        wounds:       { initial: actor.system.status.wounds?.initial ?? null },
        astralenergy: { initial: actor.system.status.astralenergy?.initial ?? null },
        karmaenergy:  { initial: actor.system.status.karmaenergy?.initial ?? null },
        speed:        { initial: actor.system.status.speed?.initial ?? null },
        soulpower:    { initial: actor.system.status.soulpower?.initial ?? null },
        toughness:    { initial: actor.system.status.toughness?.initial ?? null },
        fatePoints:   { current: actor.system.status.fatePoints?.current ?? null },
      },
    },
    items: actor.items.map(item => {
      const entry = { name: item.name, type: item.type }
      if (item.type === 'skill' || item.type === 'combatskill') {
        entry.system = { talentValue: { value: item.system.talentValue.value } }
      }
      return entry
    }),
  }
}

/**
 * Ensures the Actors sidebar tab is rendered and visible.
 * Foundry v13 hides inactive tabs via CSS `.tab` class without `active`.
 * We must render the sidebar + actors app, call changeTab, and manually
 * add the `active` CSS class to #actors.
 */
async function activateActorsTab(page) {
  await page.evaluate(async () => {
    // Render the sidebar icon strip if not already rendered
    if (!ui.sidebar.rendered) await ui.sidebar.render({ force: true })
    // Render the actors directory content
    await ui.actors.render({ force: true })
    // Update JS tab state
    ui.sidebar.changeTab('actors', 'primary')
    // Foundry v13 doesn't always update CSS classes from changeTab,
    // so we manually activate the actors panel
    const actors = document.querySelector('#actors')
    if (actors && !actors.classList.contains('active')) {
      actors.classList.add('active')
    }
    // Deactivate any previously active tab panel
    for (const el of document.querySelectorAll('#sidebar-content .tab.active')) {
      if (el.id !== 'actors') el.classList.remove('active')
    }
  })
  // Wait for the actors panel to be visible
  await page.locator('#actors.active').waitFor()
}

async function main() {
  console.log('Connecting to Foundry via CDP...')
  const browser = await chromium.connectOverCDP('http://localhost:9222')
  const context = browser.contexts()[0]
  const pages = context.pages()
  const page = pages.find(p => p.url().includes('localhost:30000')) ?? pages[0]
  page.setDefaultTimeout(30_000)

  // Close stale dialogs and ensure Actors panel is visible
  await page.evaluate(async () => {
    for (const app of foundry.applications.instances.values()) app.close()
  })
  await activateActorsTab(page)

  fs.mkdirSync(outputDir, { recursive: true })

  for (const fixtureName of FIXTURES) {
    console.log(`\nImporting ${fixtureName}...`)
    const fixtureText = fs.readFileSync(path.join(fixturesDir, `${fixtureName}.txt`), 'utf8')
    const [stats, fluff, gossip] = splitFixtureSections(fixtureText)

    // Open import dialog by dispatching a click via JS (button may be off-viewport in sidebar)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#actors .action-buttons button'))
        .find(b => b.textContent.includes('importieren'))
      if (!btn) throw new Error('Statblock importieren button not found')
      btn.click()
    })
    await page.locator('#dsa5-statblock-importer').waitFor()

    // Fill textareas
    await page.locator('textarea[name="stats"]').fill(stats ?? '')
    await page.locator('textarea[name="fluff"]').fill(fluff ?? '')
    await page.locator('textarea[name="gossip"]').fill(gossip ?? '')

    // Analyse — opens review dialog
    await page.locator('button[name="analyse"]').click()
    await page.locator('#dsa5-statblock-review').waitFor()

    // Read actor name from review dialog (already set by actor-builder)
    const actorName = await page.locator('input[name="actor-name"]').inputValue()
    console.log(`  Actor name: "${actorName}"`)

    // Delete pre-existing actor with this name (idempotent)
    await page.evaluate(name => {
      const existing = game.actors.getName(name)
      return existing?.delete()
    }, actorName)

    // Create actor
    await page.locator('button[name="create"]').click()
    await page.locator('#dsa5-statblock-review').waitFor({ state: 'hidden' })

    // Wait for actor to appear in game.actors
    await page.waitForFunction(name => !!game.actors.getName(name), actorName, { timeout: 30_000 })

    // Capture actor shape
    const actor = await page.evaluate(name => game.actors.getName(name).toObject(), actorName)
    const expected = extractExpected(actor)

    const outPath = path.join(outputDir, `${fixtureName}.json`)
    fs.writeFileSync(outPath, JSON.stringify(expected, null, 2) + '\n')
    console.log(`  Saved ${outPath} (${expected.items.length} items)`)

    // Wait for the actors tab to be ready for the next import
    await page.waitForFunction(() => !!document.querySelector('.directory-header .action-buttons'), { timeout: 5_000 })
    await activateActorsTab(page)
  }

  await browser.close()
  console.log('\nDone! All expected-e2e fixtures generated.')
}

main().catch(err => { console.error(err); process.exit(1) })
