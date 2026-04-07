# E2E Tests Design

**Date:** 2026-04-06
**Topic:** Playwright end-to-end tests for the DSA5 Statblock Importer module

## Goal

Automated e2e tests that exercise the full import flow — Import dialog → Review dialog → Actor creation — against a live Docker Foundry instance, and verify the resulting Foundry actor matches expected output exactly.

## Scope

- All 7 existing fixtures (`jaruslaw`, `nfk1-bruutsch`, `nfk1-jaani`, `nfk1-zelda`, `nfk2-miesko`, `synthetic-stats-only`, `synthetic-geweihter`)
- 3 edge cases: empty input, stats-only partial input, approximate match visible in review dialog
- Local-only (Docker Foundry on `localhost:30000`); not run in CI

---

## Infrastructure

### Dependencies

Add to `devDependencies`:
```
@playwright/test
```

Add to `package.json` scripts:
```json
"test:e2e": "playwright test"
```

### Playwright config (`playwright.config.js`)

- Connect to existing Chrome via `chromium.connectOverCDP('http://localhost:9222')` — Docker already exposes the debug port
- `baseURL: 'http://localhost:30000'`
- Action timeout: 30 000 ms (Foundry + compendium resolution is slow)
- Test timeout: 120 000 ms per test
- `workers: 1` — tests must run sequentially; concurrent Foundry mutations cause failures
- No video/screenshot by default; enable on failure

### Prerequisites

Docker Foundry instance must be running (`docker-compose up -d`) and the world must be loaded in German language (`game.world.data.lang === 'de'`). These are the same preconditions as manual testing today.

---

## File Structure

```
playwright.config.js
tests/e2e/
  import.spec.js          # parameterized over all 7 fixtures
  edge-cases.spec.js      # empty input, stats-only, approximate match
tests/fixtures/
  expected-e2e/           # expected Foundry actor shape (one JSON per fixture)
    jaruslaw.json
    nfk1-bruutsch.json
    nfk1-jaani.json
    nfk1-zelda.json
    nfk2-miesko.json
    synthetic-stats-only.json
    synthetic-geweihter.json
```

---

## Expected E2E JSON Format

Each `tests/fixtures/expected-e2e/<name>.json` describes the expected Foundry actor shape. It mirrors the `actor.toObject()` data model so assertions are direct comparisons — no translation layer.

```json
{
  "name": "Jääni Grauroth",
  "system": {
    "characteristics": {
      "mu": { "advances": 5 },
      "kl": { "advances": 3 },
      "in": { "advances": 6 },
      "ch": { "advances": 4 },
      "ff": { "advances": 3 },
      "ge": { "advances": 5 },
      "ko": { "advances": 4 },
      "kk": { "advances": 4 }
    },
    "status": {
      "wounds":       { "initial": 7 },
      "astralenergy": { "initial": 0 },
      "karmaenergy":  { "initial": 0 },
      "speed":        { "initial": 8 },
      "soulpower":    { "initial": 1 },
      "toughness":    { "initial": 2 },
      "fatePoints":   { "current": 3 }
    }
  },
  "items": [
    { "name": "Langschwert",      "type": "meleeweapon" },
    { "name": "Schuppenrüstung",  "type": "armor" },
    { "name": "Ortskenntnis",     "type": "specialability" },
    { "name": "Klettern",         "type": "skill",       "system": { "talentValue": { "value": 5 } } },
    { "name": "Schwerter",        "type": "combatskill", "system": { "talentValue": { "value": 12 } } }
  ]
}
```

### Bootstrapping expected-e2e fixtures

The `expected-e2e/*.json` files must be created once before tests can run. They cannot be derived mechanically from the existing `expected/*.json` files (which are in the parser's intermediate format, not the Foundry actor format).

**One-time procedure per fixture:**

1. Ensure Docker Foundry is running and the world is in German.
2. Import the fixture manually using the module's Import dialog.
3. In the Foundry browser console, run:
   ```js
   copy(JSON.stringify(game.actors.getName('Actor Name').toObject(), null, 2))
   ```
4. Paste the output, extract only the fields covered by the assertion strategy (name, system.characteristics, system.status, items), and save as `tests/fixtures/expected-e2e/<name>.json`.

The `items` array should include all resolved items (weapons, armor, specialabilities, advantages, disadvantages, skills, combat skills). For skills and combat skills, include `system.talentValue.value`. For other items, name + type is sufficient.

### Assertion strategy

- **`system.*` fields**: partial deep-equal — only assert the keys present in the expected JSON
- **`items`**: for each item in the expected array, assert a matching item (by `name` + `type`) exists in the actor's embedded items, then assert any nested fields (e.g. `system.talentValue.value`)
- **Order**: item order is not asserted

---

## Test: `import.spec.js`

```js
const FIXTURES = [
  'jaruslaw', 'nfk1-bruutsch', 'nfk1-jaani',
  'nfk1-zelda', 'nfk2-miesko', 'synthetic-stats-only', 'synthetic-geweihter'
]

for (const fixtureName of FIXTURES) {
  test(`imports ${fixtureName}`, async ({ page }) => {
    // 1. Load expected output
    const expected = JSON.parse(fs.readFileSync(`tests/fixtures/expected-e2e/${fixtureName}.json`))

    // 2. Delete actor if it already exists (idempotent reruns)
    await page.evaluate(name => {
      const existing = game.actors.getName(name)
      return existing?.delete()
    }, expected.name)

    // 3. Open import dialog (click "Import Statblock" button in actor directory)
    await page.locator('.directory-header .action-buttons button:has-text("Import")').click()
    await page.locator('#dsa5-statblock-importer').waitFor()

    // 4. Fill textareas from fixture file
    const fixture = fs.readFileSync(`tests/fixtures/${fixtureName}.txt`, 'utf8')
    const [stats, fluff, gossip] = splitFixtureSections(fixture)
    await page.locator('textarea[name="stats"]').fill(stats ?? '')
    await page.locator('textarea[name="fluff"]').fill(fluff ?? '')
    await page.locator('textarea[name="gossip"]').fill(gossip ?? '')

    // 5. Click Analyse, wait for review dialog
    await page.locator('button[name="analyse"]').click()
    await page.locator('#dsa5-statblock-review').waitFor()

    // 6. Click Create, wait for review dialog to close
    await page.locator('button[name="create"]').click()
    await page.locator('#dsa5-statblock-review').waitFor({ state: 'hidden' })

    // 7. Fetch actor from Foundry
    const actor = await page.evaluate(name => game.actors.getName(name)?.toObject(), expected.name)
    expect(actor).toBeTruthy()

    // 8. Assert
    assertActor(actor, expected)
  })
}
```

`splitFixtureSections(text)` splits on the labelled section headers `stats:`, `fluff:`, and `gossip:` (each at the start of a line). The content for each section runs from the line after its header until the next header. Sections absent from the file return `undefined`. Example: `synthetic-stats-only.txt` has only `stats:` — `fluff` and `gossip` will be `undefined`.

`assertActor(actual, expected)` is a shared helper that implements the partial deep-equal + item matching strategy.

---

## Test: `edge-cases.spec.js`

### Case 1: Empty input

Open import dialog, click Analyse without filling any textarea. Assert that a Foundry error notification appears in `#notifications`. Assert no actor named anything was created (actor count unchanged).

### Case 2: Stats-only input

Fill only the stats textarea using `synthetic-stats-only.txt`, leave fluff and gossip empty. Assert actor is created with correct attributes. Verifies that partial imports (no fluff/gossip) work correctly.

### Case 3: Approximate match shown in review dialog

Use `nfk1-jaani.txt` — confirmed during manual testing to produce approximate matches (SF entries with specializations such as "Ortskenntnis (Festum)" resolve approximately to base "Ortskenntnis"). After clicking Analyse, before clicking Create, assert the review dialog contains `fieldset.approximate` (rendered by `review-dialog.hbs` when `approximate.length > 0`). Then click Create and assert the actor is created.

---

## State Management

- **Delete before**: each test deletes the target actor by name before running (if it exists)
- **No cleanup after**: actor remains in Foundry after the test — useful for manual inspection
- **Navigation**: `beforeAll` navigates to the Actors tab once. Tests don't navigate between themselves.
- **Test isolation**: `workers: 1` in Playwright config enforces sequential execution — concurrent Foundry mutations cause spurious failures

---

## What This Catches

Regressions in:
- Button injection (Foundry v13 HTMLElement vs jQuery)
- Import dialog textarea wiring
- Review dialog name display
- `buildActor()` attribute advances calculation
- LeP `wounds.initial` delta formula (`parsedLeP - (KO + KK)`)
- Compendium resolution (items present, skill values correct)
- Optional section handling (fluff/gossip absent)
- Validation (empty input rejected)
- Approximate match UI rendering
