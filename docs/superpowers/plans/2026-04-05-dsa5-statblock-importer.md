# DSA5 Statblock Importer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers-extended-cc:subagent-driven-development (if subagents available) or superpowers-extended-cc:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Foundry VTT module that lets a GM paste a DSA5 NPC statblock from a PDF into a three-section dialog, parses it, and creates a fully configured DSA5 actor after a review/edit step.

**Architecture:** A Vite-bundled ES module with a pure-JS parser layer (testable with Vitest, no Foundry dependency) and a Foundry integration layer (compendium resolver, actor builder, dialogs). The parser layer is built first using TDD with real PDF paste fixtures. The integration layer is verified against a Foundry v13 instance running in Docker.

**Tech Stack:** Foundry VTT v13, DSA5 system, Vite, pnpm, Vitest, Nix flake, direnv, Docker (felddy/foundryvtt:13), chrome-devtools-mcp for live API verification.

---

## File Map

```
/                            ← repo root
├── flake.nix                ← nix dev env (node + pnpm)
├── flake.lock
├── .envrc                   ← direnv → use flake
├── docker-compose.yml       ← Foundry v13 dev instance
├── module.json              ← Foundry manifest
├── package.json             ← pnpm scripts + deps
├── pnpm-lock.yaml
├── vite.config.js           ← bundles src/ → dist/main.js
├── src/
│   ├── main.js              ← hook registration (renderActorDirectory)
│   ├── import-dialog.js     ← ImportDialog class (3 text areas)
│   ├── review-dialog.js     ← ReviewDialog class (editable preview + create)
│   ├── compendium-resolver.js ← game.dsa5.itemLibrary wrapper
│   ├── actor-builder.js     ← creates DSA5 actor from ReviewDialog state
│   └── parser/
│       ├── cleaner.js       ← PDF artifact normalization (pure JS)
│       ├── stats-parser.js  ← parses stats section (pure JS)
│       ├── fluff-parser.js  ← parses fluff section (pure JS)
│       └── gossip-parser.js ← parses gossip section (pure JS)
├── templates/
│   ├── import-dialog.hbs
│   └── review-dialog.hbs
├── styles/
│   └── module.css
├── languages/
│   └── de.json              ← UI labels only
└── tests/
    ├── fixtures/
    │   └── jaruslaw.txt     ← full paste from design session
    ├── cleaner.test.js
    ├── stats-parser.test.js
    ├── fluff-parser.test.js
    └── gossip-parser.test.js
```

---

## Task 1: Dev Environment

**Files:**
- Create: `flake.nix`
- Create: `flake.lock` (generated)
- Create: `.envrc`
- Create: `package.json`
- Create: `vite.config.js`

- [ ] **Step 1: Write `flake.nix`**

```nix
{
  description = "DSA5 Statblock Importer dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [ nodejs_22 nodePackages.pnpm ];
        };
      });
}
```

- [ ] **Step 2: Write `.envrc`**

```
use flake
```

- [ ] **Step 3: Run `direnv allow` to activate the environment**

```bash
direnv allow
node --version   # expect v22.x
pnpm --version   # expect 9.x or similar
```

- [ ] **Step 4: Write `package.json`**

```json
{
  "name": "dsa5-statblock-importer",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

- [ ] **Step 5: Write `vite.config.js`**

```js
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main.js',
      formats: ['es'],
      fileName: 'main',
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
```

- [ ] **Step 6: Install dependencies**

```bash
pnpm install
```

Expected: `node_modules/` created, `pnpm-lock.yaml` written.

- [ ] **Step 7: Verify build works with empty entry**

Create `src/main.js` with just `// placeholder`, then:

```bash
pnpm build
```

Expected: `dist/main.js` created without errors.

- [ ] **Step 8: Commit**

```bash
git add flake.nix .envrc package.json pnpm-lock.yaml vite.config.js src/main.js
git commit -m "feat: add dev environment (nix flake, pnpm, vite)"
```

---

## Task 2: Module Scaffold

**Files:**
- Create: `module.json`
- Create: `templates/import-dialog.hbs` (stub)
- Create: `templates/review-dialog.hbs` (stub)
- Create: `styles/module.css` (empty)
- Create: `languages/de.json` (stub)

- [ ] **Step 1: Write `module.json`**

```json
{
  "id": "dsa5-statblock-importer",
  "title": "DSA5 Statblock Importer",
  "description": "Import DSA5 NPC statblocks from PDF into Foundry VTT actors.",
  "version": "0.1.0",
  "compatibility": {
    "minimum": "13",
    "verified": "13"
  },
  "esmodules": ["dist/main.js"],
  "styles": ["styles/module.css"],
  "languages": [
    { "lang": "de", "name": "Deutsch", "path": "languages/de.json" }
  ]
}
```

- [ ] **Step 2: Write stub templates**

`templates/import-dialog.hbs`:
```html
<form class="dsa5-importer-form">
  <div class="form-group">
    <label>{{localize "DSA5SI.import.stats"}}</label>
    <textarea name="stats" rows="10"></textarea>
  </div>
  <div class="form-group">
    <label>{{localize "DSA5SI.import.fluff"}}</label>
    <textarea name="fluff" rows="10"></textarea>
  </div>
  <div class="form-group">
    <label>{{localize "DSA5SI.import.gossip"}}</label>
    <textarea name="gossip" rows="6"></textarea>
  </div>
</form>
```

`templates/review-dialog.hbs`:
```html
<form class="dsa5-review-form">
  <p>{{localize "DSA5SI.review.placeholder"}}</p>
</form>
```

- [ ] **Step 3: Write stub `languages/de.json`**

```json
{
  "DSA5SI.button.import": "Statblock importieren",
  "DSA5SI.import.stats": "Werte",
  "DSA5SI.import.fluff": "Beschreibung",
  "DSA5SI.import.gossip": "Gerüchte",
  "DSA5SI.import.analyse": "Analysieren",
  "DSA5SI.review.placeholder": "Vorschau wird geladen...",
  "DSA5SI.review.create": "Charakter erstellen",
  "DSA5SI.review.cancel": "Abbrechen"
}
```

- [ ] **Step 4: Write minimal `src/main.js` with sidebar button**

```js
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
```

- [ ] **Step 5: Build and verify no errors**

```bash
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add module.json templates/ styles/ languages/ src/main.js
git commit -m "feat: add module scaffold and sidebar button stub"
```

---

## Task 3: Docker + Foundry Dev Instance

**Files:**
- Create: `docker-compose.yml`
- Create: `foundry-data/.gitkeep`

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  foundry:
    image: felddy/foundryvtt:13
    container_name: foundry-dsa5-dev
    ports:
      - "30000:30000"
    volumes:
      - ./foundry-data:/data
      - ./dist:/data/Data/modules/dsa5-statblock-importer/dist
      - ./module.json:/data/Data/modules/dsa5-statblock-importer/module.json
      - ./templates:/data/Data/modules/dsa5-statblock-importer/templates
      - ./styles:/data/Data/modules/dsa5-statblock-importer/styles
      - ./languages:/data/Data/modules/dsa5-statblock-importer/languages
    environment:
      - FOUNDRY_USERNAME=${FOUNDRY_USERNAME}
      - FOUNDRY_PASSWORD=${FOUNDRY_PASSWORD}
      - FOUNDRY_ADMIN_KEY=${FOUNDRY_ADMIN_KEY}
    restart: unless-stopped
```

Note: `FOUNDRY_USERNAME`, `FOUNDRY_PASSWORD`, `FOUNDRY_ADMIN_KEY` must be set in a `.env` file (not committed).

- [ ] **Step 2: Add `.env.example` and `.gitignore` entries**

`.env.example`:
```
FOUNDRY_USERNAME=your-foundry-username
FOUNDRY_PASSWORD=your-foundry-password
FOUNDRY_ADMIN_KEY=your-admin-key
```

Add to `.gitignore`:
```
.env
foundry-data/
dist/
node_modules/
```

- [ ] **Step 3: Start Foundry and verify it loads**

```bash
docker compose up -d
# Open http://localhost:30000 in Chrome
# Complete setup wizard, install dsa5 system + Ulisses modules, create a world
```

Verify DSA5 and Ulisses modules are active before Task 4:
```js
// Run in Foundry console after world loads
game.modules.get('dsa5')?.active        // expect: true
game.modules.get('dsa5-core')?.active   // expect: true (or whichever Ulisses pack IDs apply)
game.packs.size                         // expect: > 20 if premium packs are loaded
```

- [ ] **Step 4: Build and verify module appears in Foundry**

```bash
pnpm build
# Reload Foundry in Chrome → Actors tab should show "Statblock importieren" button
```

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example .gitignore foundry-data/.gitkeep
git commit -m "feat: add Docker Foundry dev instance with module bind-mount"
```

---

## Task 4: API Verification via chrome-devtools-mcp

**Files:**
- Update: `docs/dsa5-research/actor-schema.md`
- Update: `docs/dsa5-research/item-types.md`
- Update: `docs/dsa5-research/api-patterns.md`
- Create: `docs/dsa5-research/compendium-packs.md`
- Update: `docs/dsa5-research/unknown.md`

Prerequisites: Task 3 complete, Foundry running with DSA5 system + modules, world open in Chrome.

Use `chrome-devtools-mcp` (the `chrome-devtools` skill) to run each snippet below in the Foundry console and record results in the research docs.

- [ ] **Step 1: List all actor types**

```js
game.system.documentTypes.Actor
```

Update `actor-schema.md` with the NPC/creature type name.

- [ ] **Step 2: Inspect NPC actor system fields**

Create a test NPC manually in Foundry (Actors tab → Create Actor), then:

```js
const npc = game.actors.find(a => a.type !== 'character')
JSON.stringify(npc.system, null, 2)
```

Update `actor-schema.md` with confirmed attribute, derived value, and details field paths.

- [ ] **Step 3: List all compendium packs**

```js
game.packs.map(p => ({ id: p.collection, type: p.documentClass?.documentName, size: p.index.size }))
```

Write results to new `docs/dsa5-research/compendium-packs.md`.

- [ ] **Step 4: Verify DSA5 item library API**

```js
await game.dsa5.itemLibrary.buildEquipmentIndex()
const result = await game.dsa5.itemLibrary.findCompendiumItem('Langschwert', 'meleeweapon')
console.log(result)
```

Update `api-patterns.md` with confirmed method signature.

- [ ] **Step 5: Inspect a skill and combat skill item**

```js
const skill = game.items.find(i => i.type === 'skill')
  ?? (await game.packs.find(p => p.collection.includes('skill'))?.getDocuments())?.[0]
JSON.stringify(skill?.system, null, 2)
```

Update `item-types.md` with confirmed `system.talentValue.value` path.

- [ ] **Step 6: Check Schip, INI, AW fields on NPC actor**

```js
const npc = game.actors.find(a => a.type !== 'character')
// Look for: fatePoints, ini, dodge
Object.keys(npc.system.status ?? {})
Object.keys(npc.system.base ?? {})
```

Update `actor-schema.md` and clear resolved entries from `unknown.md`.

- [ ] **Step 7: Verify actor creation API**

```js
// Check if DSA5-specific creator exists and what it does
typeof game.dsa5?.entities?.Actordsa5?.create
// Also check standard Foundry v13 API
typeof Actor.create
// If game.dsa5.entities.Actordsa5.create is undefined, use Actor.create() instead
// Record verified method in docs/dsa5-research/api-patterns.md
```

Update `api-patterns.md` with the confirmed actor creation method. If `game.dsa5.entities.Actordsa5` is unavailable or identical to `Actor.create`, note this — Task 14 must use whichever is confirmed here.

- [ ] **Step 8: Commit verified research docs**

```bash
git add docs/dsa5-research/
git commit -m "docs: update research docs with live API verification results"
```

---

## Task 5: Test Fixture + Vitest Setup

**Files:**
- Create: `tests/fixtures/jaruslaw.txt`
- Create: `vitest.config.js`

- [ ] **Step 1: Write `tests/fixtures/jaruslaw.txt`**

⚠️ **GATE: Do not proceed to Task 7–12 until this file contains the real PDF paste content.** Tests in those tasks assert specific values (`LeP: 42`, `AT: 14`, etc.) derived from the actual statblock.

Paste the full Jaruslaw statblock from the design session exactly as copied from PDF. Each section is prefixed with a label line:

```
stats:
Jaruslaw von
Kirschhausen-Krabbwitzkoje
MU 13 KL 10 IN 11 CH 12
FF 11 GE 13 KO 15 KK 15
LeP 42 Asp – KaP – INI 12+1W6
AW 7 SK 0 ZK 3 GS 7
Schip 1
Waffenlos: AT 11 PA 7 TP 1W6 RW kurz
Langschwert: AT 14 PA 8 TP 1W6+4 RW mittel
[... continue with full stats section from design session ...]

fluff:
3 Schitze Jaruslaw von Kirschhausen-Krabbwitzkoje
Kurzcharakteristik: kompetenter Ritter, Mitte 20, groß
[... continue with full fluff section ...]

gossip:
Gerüchte über Jaruslaw
»Der darf im Sommer nicht gegen Haffax mitkämpfen [...]«
[... continue with full gossip section ...]
```

After writing, verify test expected values match the real fixture before writing tests in Tasks 7–12.

- [ ] **Step 2: Write `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
```

- [ ] **Step 3: Write a smoke test to verify fixture loads**

`tests/fixtures.test.js`:
```js
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

describe('fixtures', () => {
  it('jaruslaw.txt is readable', () => {
    const text = readFileSync('tests/fixtures/jaruslaw.txt', 'utf8')
    expect(text).toContain('Jaruslaw')
    expect(text).toContain('MU 13')
    expect(text).toContain('Gerüchte')
  })
})
```

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: 1 passing test.

- [ ] **Step 5: Commit**

```bash
git add tests/ vitest.config.js
git commit -m "test: add Vitest setup and Jaruslaw fixture"
```

---

## Task 6: `cleaner.js`

**Files:**
- Create: `src/parser/cleaner.js`
- Create: `tests/cleaner.test.js`

- [ ] **Step 1: Write failing tests**

`tests/cleaner.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { clean } from '../src/parser/cleaner.js'

describe('clean', () => {
  it('replaces fi ligature', () => {
    expect(clean('Sonderfertigkeiten')).toBe('Sonderfertigkeiten')
    // ﬁ → fi
    expect(clean('Spezi\uFB01sierung')).toBe('Speziﬁsierung'.replace('\uFB01', 'fi'))
  })

  it('normalizes en-dash and em-dash to hyphen', () => {
    expect(clean('AT\u201311')).toBe('AT-11')
    expect(clean('RW\u2014mittel')).toBe('RW-mittel')
  })

  it('removes soft hyphens', () => {
    expect(clean('Sonder\u00ADfertigkeiten')).toBe('Sonderfertigkeiten')
  })

  it('collapses multiple spaces to one', () => {
    expect(clean('MU  13   KL  10')).toBe('MU 13 KL 10')
  })

  it('removes lone numeric lines (stray page numbers)', () => {
    expect(clean('line one\n42\nline two')).toBe('line one\nline two')
  })

  it('preserves guillemets', () => {
    expect(clean('»Hallo«')).toBe('»Hallo«')
  })

  it('preserves paragraph breaks', () => {
    expect(clean('para one\n\npara two')).toBe('para one\n\npara two')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/cleaner.test.js
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/parser/cleaner.js`**

```js
const LIGATURES = {
  '\uFB00': 'ff',
  '\uFB01': 'fi',
  '\uFB02': 'fl',
  '\uFB03': 'ffi',
  '\uFB04': 'ffl',
  '\uFB05': 'st',
  '\uFB06': 'st',
}

export function clean(text) {
  let result = text

  // Ligatures
  for (const [lig, rep] of Object.entries(LIGATURES)) {
    result = result.replaceAll(lig, rep)
  }

  // Soft hyphens
  result = result.replaceAll('\u00AD', '')

  // Dashes → hyphen (but not inside »...« quotes — preserved as-is)
  result = result.replace(/[\u2013\u2014\u2010]/g, '-')

  // Collapse multiple spaces/tabs to single space (within lines)
  result = result.replace(/[^\S\n]+/g, ' ')

  // Remove lone numeric lines (stray page numbers)
  result = result.replace(/^\s*\d+\s*$/gm, '')

  // Collapse multiple consecutive blank lines to one
  result = result.replace(/\n{3,}/g, '\n\n')

  return result.trim()
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test tests/cleaner.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser/cleaner.js tests/cleaner.test.js
git commit -m "feat: implement cleaner with PDF artifact normalization"
```

---

## Task 7: `stats-parser.js` — Header & Attributes

**Files:**
- Create: `src/parser/stats-parser.js` (initial)
- Create: `tests/stats-parser.test.js` (initial)

- [ ] **Step 1: Write helper to extract raw stat sections from fixture**

Add a test helper in `tests/stats-parser.test.js`:
```js
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { parseStats } from '../src/parser/stats-parser.js'
import { clean } from '../src/parser/cleaner.js'

function loadSection(fixture, section) {
  const text = readFileSync(`tests/fixtures/${fixture}`, 'utf8')
  const match = text.match(new RegExp(`${section}:\\n([\\s\\S]+?)(?=\\n\\w+:|$)`))
  return match ? match[1].trim() : ''
}

const rawStats = loadSection('jaruslaw.txt', 'stats')
const stats = parseStats(clean(rawStats))
```

- [ ] **Step 2: Write failing tests for name and attributes**

```js
describe('parseStats - name', () => {
  it('extracts the NPC name from the first line(s)', () => {
    expect(stats.name).toBe('Jaruslaw von Kirschhausen-Krabbwitzkoje')
  })
})

describe('parseStats - attributes', () => {
  it('extracts all 8 base attributes', () => {
    expect(stats.attributes).toEqual({
      MU: 13, KL: 10, IN: 11, CH: 12,
      FF: 11, GE: 13, KO: 15, KK: 15,
    })
  })
})
```

- [ ] **Step 3: Run to verify they fail**

```bash
pnpm test tests/stats-parser.test.js
```

- [ ] **Step 4: Implement name and attribute parsing in `src/parser/stats-parser.js`**

```js
const ATTR_KEYS = ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KO', 'KK']
const STAT_ANCHORS = [
  'RS/BE', 'Sozialstatus', 'Sonderfertigkeiten', 'Sprachen', 'Schriften',
  'Vorteile', 'Nachteile', 'Kampftechniken', 'Talente', 'Kampfverhalten', 'Flucht',
]

export function parseStats(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Extract attributes line (contains MU KL IN CH or FF GE KO KK)
  const attrLinePattern = /\b(MU|KL|IN|CH|FF|GE|KO|KK)\s+\d+/
  const attrLines = lines.filter(l => attrLinePattern.test(l))

  const attributes = {}
  for (const line of attrLines) {
    const matches = [...line.matchAll(/\b(MU|KL|IN|CH|FF|GE|KO|KK)\s+(\d+)/g)]
    for (const [, key, val] of matches) {
      attributes[key] = parseInt(val)
    }
  }

  // Name: everything before the first attribute line
  const firstAttrIdx = lines.findIndex(l => attrLinePattern.test(l))
  const nameLines = lines.slice(0, firstAttrIdx)
  const name = nameLines.join(' ').trim() || null

  return { name, attributes }
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test tests/stats-parser.test.js
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/parser/stats-parser.js tests/stats-parser.test.js
git commit -m "feat: parse NPC name and attributes from stats section"
```

---

## Task 8: `stats-parser.js` — Derived Values

- [ ] **Step 1: Write failing tests for derived values**

Add to `tests/stats-parser.test.js`:
```js
describe('parseStats - derived', () => {
  it('extracts LeP', () => expect(stats.derived.LeP).toBe(42))
  it('extracts INI as base + dice', () => {
    expect(stats.derived.INI).toEqual({ base: 12, dice: '1W6' })
  })
  it('sets Asp to null when "–"', () => expect(stats.derived.Asp).toBeNull())
  it('sets KaP to null when "–"', () => expect(stats.derived.KaP).toBeNull())
  it('extracts AW', () => expect(stats.derived.AW).toBe(7))
  it('extracts SK', () => expect(stats.derived.SK).toBe(0))
  it('extracts ZK', () => expect(stats.derived.ZK).toBe(3))
  it('extracts GS', () => expect(stats.derived.GS).toBe(7))
  it('extracts Schip', () => expect(stats.derived.Schip).toBe(1))
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm test tests/stats-parser.test.js
```

- [ ] **Step 3: Implement derived value parsing**

Add to `parseStats` in `stats-parser.js`:
```js
// Derived values line: "LeP 42 Asp – KaP – INI 12+1W6"
function parseDerived(lines) {
  const derived = {}
  const joined = lines.join(' ')

  const nums = { LeP: null, Asp: null, KaP: null, AW: null, SK: null, ZK: null, GS: null, Schip: null }
  for (const key of ['LeP', 'AW', 'SK', 'ZK', 'GS', 'Schip']) {
    const m = joined.match(new RegExp(`\\b${key}\\s+(-?\\d+)`))
    nums[key] = m ? parseInt(m[1]) : null
  }

  // Nullable fields
  for (const key of ['Asp', 'KaP']) {
    const m = joined.match(new RegExp(`\\b${key}\\s+([\\d–-]+)`))
    nums[key] = m ? (m[1] === '–' || m[1] === '-' ? null : parseInt(m[1])) : null
  }

  // INI: "12+1W6"
  const iniM = joined.match(/\bINI\s+(\d+)\+(\d+W\d+)/)
  nums.INI = iniM ? { base: parseInt(iniM[1]), dice: iniM[2] } : null

  return nums
}
```

Wire into `parseStats` return value.

- [ ] **Step 4: Run tests**

```bash
pnpm test tests/stats-parser.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser/stats-parser.js tests/stats-parser.test.js
git commit -m "feat: parse derived values including INI split and nullable Asp/KaP"
```

---

## Task 9: `stats-parser.js` — Weapons & Armor

- [ ] **Step 1: Write failing tests**

```js
describe('parseStats - weapons', () => {
  it('extracts melee weapons with AT/PA', () => {
    const ls = stats.weapons.find(w => w.name === 'Langschwert')
    expect(ls).toBeDefined()
    expect(ls.AT).toBe(14)
    expect(ls.PA).toBe(8)
    expect(ls.FK).toBeNull()
  })
  it('extracts ranged weapons with FK', () => {
    const lb = stats.weapons.find(w => w.name === 'Langbogen')
    expect(lb).toBeDefined()
    expect(lb.FK).toBe(13)
    expect(lb.AT).toBeNull()
  })
  it('handles multi-line weapon entries', () => {
    expect(stats.weapons.find(w => w.name === 'Langschwert und Holzschild')).toBeDefined()
  })
})

describe('parseStats - armor', () => {
  it('extracts armor name, RS and BE', () => {
    expect(stats.armor).toContainEqual({ name: 'Schuppenrüstung', RS: 5, BE: 1 })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm test tests/stats-parser.test.js
```

- [ ] **Step 3: Implement weapon and armor parsing using block-boundary reassembly**

The key logic: collect all lines between attribute lines and the first anchor keyword. Merge continuation lines (lines lacking a weapon name keyword that follow a weapon line):

```js
function parseWeapons(block) {
  // Each weapon entry matches: "Name: AT N PA N TP ...RW ..."
  // or "Name: FK N LZ N TP ...RW ..."
  // Multi-line entries: a line with no leading weapon keyword is continuation
  const weaponPattern = /^(.+?):\s+(?:AT\s+(\d+)\s+PA\s+(\d+)|FK\s+(\d+))/
  const weapons = []
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)

  let current = null
  for (const line of lines) {
    const m = line.match(weaponPattern)
    if (m) {
      if (current) weapons.push(current)
      current = {
        name: m[1].trim(),
        AT: m[2] ? parseInt(m[2]) : null,
        PA: m[3] ? parseInt(m[3]) : null,
        FK: m[4] ? parseInt(m[4]) : null,
      }
    } else if (current) {
      // continuation line — merge, don't create new weapon
    }
  }
  if (current) weapons.push(current)
  return weapons
}

function parseArmor(rsLine) {
  // "RS/BE 5 / 1 (Schuppenrüstung)"
  const m = rsLine.match(/RS\/BE\s+(\d+)\s*\/\s*(\d+)\s*\(([^)]+)\)/)
  if (!m) return []
  return [{ name: m[3].trim(), RS: parseInt(m[1]), BE: parseInt(m[2]) }]
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test tests/stats-parser.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser/stats-parser.js tests/stats-parser.test.js
git commit -m "feat: parse weapons (melee/ranged/multi-line) and armor"
```

---

## Task 10: `stats-parser.js` — Skills, Combat Techniques, Prose

- [ ] **Step 1: Write failing tests**

```js
describe('parseStats - kampftechniken', () => {
  it('extracts base value and AT bonus', () => {
    const bogen = stats.kampftechniken.find(k => k.name === 'Bogen')
    expect(bogen).toEqual({ name: 'Bogen', value: 12, atBonus: 13, paBonus: null })
  })
  it('extracts AT and PA bonus', () => {
    const schwerter = stats.kampftechniken.find(k => k.name === 'Schwerter')
    expect(schwerter).toEqual({ name: 'Schwerter', value: 14, atBonus: 15, paBonus: 9 })
  })
})

describe('parseStats - talente', () => {
  it('extracts Körper talents', () => {
    const koerper = stats.talente.Körper
    expect(koerper.find(t => t.name === 'Kraftakt')).toEqual({ name: 'Kraftakt', value: 10, spezialisierung: null })
  })
  it('extracts talent with specialization', () => {
    const reiten = stats.talente.Körper.find(t => t.name === 'Reiten')
    expect(reiten.spezialisierung).toBe('Kampfmanöver')
  })
  it('unknown categories go to Sonstige', () => {
    expect(stats.talente.Sonstige).toBeDefined()
  })
})

describe('parseStats - comma lists', () => {
  it('extracts Sonderfertigkeiten', () => {
    expect(stats.sonderfertigkeiten).toContain('Belastungsgewöhnung I')
    expect(stats.sonderfertigkeiten).toContain('Finte I')
  })
  it('extracts Vorteile', () => {
    expect(stats.vorteile).toContain('Adel II')
  })
  it('extracts Nachteile', () => {
    expect(stats.nachteile).toContain('Niedrige Seelenkraft I')
  })
})

describe('parseStats - prose', () => {
  it('extracts Kampfverhalten as string', () => {
    expect(stats.kampfverhalten).toMatch(/Jaruslaw versucht/)
  })
  it('extracts Flucht as string', () => {
    expect(stats.flucht).toMatch(/Aufzugeben/)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm test tests/stats-parser.test.js
```

- [ ] **Step 3: Implement block-boundary extraction, Kampftechnik, Talente, comma lists**

Core block extractor using anchor keywords:
```js
function extractBlocks(text) {
  const anchorRe = /^(RS\/BE|Sozialstatus|Sonderfertigkeiten|Sprachen|Schriften|Vorteile|Nachteile|Kampftechniken|Talente|Kampfverhalten|Flucht):/m
  // Split on anchors, return { anchor: content } map
}
```

Kampftechnik pattern: `Bogen 12 (13)` or `Schwerter 14 (15/9)`:
```js
/(\w[\w\s]+?)\s+(\d+)\s*(?:\((\d+)(?:\/(\d+))?\))?/g
```

Talent subsection pattern — look for `Körper:`, `Gesellschaft:`, etc. headers within the Talente block, bucket unknowns to `Sonstige`.

Talent entry with optional specialization: `Reiten (Kampfmanöver) 10 (12)` — name is `Reiten`, spezialisierung is `Kampfmanöver`, value is `10`.

- [ ] **Step 4: Run tests**

```bash
pnpm test tests/stats-parser.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser/stats-parser.js tests/stats-parser.test.js
git commit -m "feat: parse combat techniques, talents, comma lists, prose blocks"
```

---

## Task 11: `fluff-parser.js`

**Files:**
- Create: `src/parser/fluff-parser.js`
- Create: `tests/fluff-parser.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { parseFluff } from '../src/parser/fluff-parser.js'
import { clean } from '../src/parser/cleaner.js'

function loadSection(fixture, section) {
  const text = readFileSync(`tests/fixtures/${fixture}`, 'utf8')
  const match = text.match(new RegExp(`${section}:\\n([\\s\\S]+?)(?=\\n\\w+:|$)`))
  return match ? match[1].trim() : ''
}

const fluff = parseFluff(clean(loadSection('jaruslaw.txt', 'fluff')))

describe('parseFluff', () => {
  it('extracts npcCategory from leading digit', () => {
    expect(fluff.npcCategory).toBe('Turm')
  })
  it('extracts titel', () => {
    expect(fluff.titel).toBe('Schitze')
  })
  it('extracts name', () => {
    expect(fluff.name).toBe('Jaruslaw von Kirschhausen-Krabbwitzkoje')
  })
  it('extracts motivation', () => {
    expect(fluff.motivation).toMatch(/Namen unter/)
  })
  it('extracts feindbilder as array', () => {
    expect(fluff.feindbilder).toContain('Goblins')
  })
  it('extracts zitate', () => {
    expect(fluff.zitate[0]).toMatch(/UNVERSCHÄMTHEIT/)
  })
  it('returns null npcCategory for unknown digit', () => {
    const result = parseFluff('9 Titel Name\nKurzcharakteristik: test')
    expect(result.npcCategory).toBeNull()
  })
  it('handles header with no title (digit + name only)', () => {
    // Some NPCs: "3 Jaruslaw von Kirschhausen" with no rank/title word
    // In this case titel should be null and name should be the full remainder
    const result = parseFluff('3 Jaruslaw von Kirschhausen\nKurzcharakteristik: test')
    expect(result.name).toContain('Jaruslaw')
    // titel may be null or the first word — document the actual behavior here
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm test tests/fluff-parser.test.js
```

- [ ] **Step 3: Implement `src/parser/fluff-parser.js`**

```js
const CATEGORY_MAP = { '1': 'Bauer', '2': 'Springer', '3': 'Turm', '4': 'Läufer' }

const FLUFF_ANCHORS = [
  'Kurzcharakteristik', 'Motivation', 'Agenda', 'Funktion', 'Hintergrund',
  'Feindbilder', 'Darstellung', 'Schicksal', 'Besonderheiten',
]

export function parseFluff(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // First line: [digit] [titel?] name
  // Problem: titel and name can't be reliably separated by position alone since
  // some NPCs have no title. Strategy: treat everything after the digit as the name.
  // If a DSA5 rank/title word is present it will be in the name string — strip it if
  // a known title list is available, otherwise leave it for the user to correct in ReviewDialog.
  const firstLine = lines[0] ?? ''
  const digitMatch = firstLine.match(/^(\d)\s+(.+)$/)
  const digit = digitMatch?.[1] ?? null
  const npcCategory = digit ? (CATEGORY_MAP[digit] ?? null) : null
  const remainder = digitMatch?.[2] ?? firstLine
  // Heuristic: if first word of remainder looks like a title (capitalized, single word),
  // treat it as titel and the rest as name. This will be wrong for some NPCs — the
  // ReviewDialog allows correction.
  const remainderParts = remainder.match(/^(\S+)\s+(.+)$/)
  const titel = remainderParts ? remainderParts[1] : null
  const name = remainderParts ? remainderParts[2] : remainder

  // Extract blocks by anchors
  const blocks = extractFluffBlocks(lines.slice(1))

  // Feindbilder: comma-separated
  const feindbilder = blocks.Feindbilder
    ? blocks.Feindbilder.split(',').map(s => s.trim()).filter(Boolean)
    : []

  // Zitate: lines starting with »
  const zitate = lines.filter(l => l.startsWith('»'))

  return {
    npcCategory, titel, name,
    kurzcharakteristik: blocks.Kurzcharakteristik ?? '',
    motivation: blocks.Motivation ?? '',
    agenda: blocks.Agenda ?? '',
    funktion: blocks.Funktion ?? '',
    hintergrund: blocks.Hintergrund ?? '',
    feindbilder,
    darstellung: blocks.Darstellung ?? '',
    schicksal: blocks.Schicksal ?? '',
    besonderheiten: blocks.Besonderheiten ?? '',
    zitate,
  }
}

function extractFluffBlocks(lines) {
  // Same block-boundary strategy as stats-parser
  const anchorRe = new RegExp(`^(${FLUFF_ANCHORS.join('|')}):`)
  const blocks = {}
  let current = null
  for (const line of lines) {
    const m = line.match(anchorRe)
    if (m) {
      current = m[1]
      blocks[current] = line.replace(anchorRe, '').trim()
    } else if (current) {
      blocks[current] += ' ' + line
    }
  }
  return blocks
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test tests/fluff-parser.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser/fluff-parser.js tests/fluff-parser.test.js
git commit -m "feat: implement fluff parser with NPC category, anchors, zitate"
```

---

## Task 12: `gossip-parser.js`

**Files:**
- Create: `src/parser/gossip-parser.js`
- Create: `tests/gossip-parser.test.js`

- [ ] **Step 1: Write failing tests**

```js
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { parseGossip } from '../src/parser/gossip-parser.js'
import { clean } from '../src/parser/cleaner.js'

function loadSection(fixture, section) {
  const text = readFileSync(`tests/fixtures/${fixture}`, 'utf8')
  const match = text.match(new RegExp(`${section}:\\n([\\s\\S]+?)(?=\\n\\w+:|$)`))
  return match ? match[1].trim() : ''
}

const gossip = parseGossip(clean(loadSection('jaruslaw.txt', 'gossip')))

describe('parseGossip', () => {
  it('extracts subject from header line', () => {
    expect(gossip.subject).toBe('Jaruslaw')
  })
  it('returns multiple entries', () => {
    expect(gossip.entries.length).toBeGreaterThan(3)
  })
  it('preserves inline truth markers', () => {
    const withMarker = gossip.entries.find(e => e.text.includes('(+)'))
    expect(withMarker).toBeDefined()
  })
  it('handles inline markers mid-text', () => {
    // "...hat Jucho nur im Amt gelassen, weil er so gut aussieht. (–) Die hat nämlich..."
    const multiMarker = gossip.entries.find(e => e.text.includes('(–)') && e.text.includes('(+)'))
    expect(multiMarker).toBeDefined()
  })
  it('each entry text starts with »', () => {
    for (const entry of gossip.entries) {
      expect(entry.text.startsWith('»')).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm test tests/gossip-parser.test.js
```

- [ ] **Step 3: Implement `src/parser/gossip-parser.js`**

```js
export function parseGossip(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Header: "Gerüchte über Name"
  const headerMatch = lines[0]?.match(/^Gerüchte über (.+)/)
  const subject = headerMatch?.[1]?.trim() ?? ''

  // Entries: delimited by lines starting with »
  const entries = []
  let current = null
  for (const line of lines.slice(1)) {
    if (line.startsWith('»')) {
      if (current !== null) entries.push({ text: current.trim() })
      current = line
    } else if (current !== null) {
      current += ' ' + line
    }
  }
  if (current !== null) entries.push({ text: current.trim() })

  return { subject, entries }
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test tests/gossip-parser.test.js
```

Expected: all pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/parser/gossip-parser.js tests/gossip-parser.test.js
git commit -m "feat: implement gossip parser with entry delimiting and inline markers"
```

---

## Task 13: `compendium-resolver.js`

**Files:**
- Create: `src/compendium-resolver.js`

Note: This module runs inside Foundry — no Vitest unit tests. Test manually via the Docker instance.

- [ ] **Step 1: Read `docs/dsa5-research/item-types.md` and `docs/dsa5-research/api-patterns.md`**

Verify item type strings (`meleeweapon`, `rangeweapon`, `armor`, `specialability`, `advantage`, `disadvantage`, `language`, `script`, `combatskill`, `skill`) match what Task 4 Step 5 confirmed. Update the type strings in the implementation below if they differ.

- [ ] **Step 2: Implement `src/compendium-resolver.js`**

```js
/**
 * Resolves parsed item names against DSA5 compendiums.
 * Requires: game.dsa5.itemLibrary (Foundry runtime)
 */

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function normalize(name) {
  return name.trim().toLowerCase().replace(/\s+[IVX]+$/, '')
}

// Index is built once lazily — calling buildEquipmentIndex() on every resolveItem call is wasteful
let _indexBuilt = false
async function ensureIndex() {
  if (_indexBuilt) return
  await game.dsa5.itemLibrary.buildEquipmentIndex()
  _indexBuilt = true
}

export async function resolveItem(name, preferredType, fallbackTypes = []) {
  await ensureIndex()

  for (const type of [preferredType, ...fallbackTypes]) {
    const results = await game.dsa5.itemLibrary.findCompendiumItem(name, type)
    const exact = results?.find(i => i.type === type && i.name.toLowerCase() === name.toLowerCase())
    if (exact) return { item: exact, matchType: 'exact' }
  }

  // Approximate: pass raw name to findCompendiumItem (not normalized),
  // then compare normalized forms to avoid ambiguous result sets
  for (const type of [preferredType, ...fallbackTypes]) {
    const results = await game.dsa5.itemLibrary.findCompendiumItem(name, type)
    const approx = results?.find(i => i.type === type && levenshtein(normalize(i.name), normalize(name)) <= 2)
    if (approx) return { item: approx, matchType: 'approximate', originalName: name, matchedName: approx.name }
  }

  return null
}

export function isEquipmentPack(item) {
  return item.type === 'equipment' &&
    (item.name.toLowerCase().includes('paket') || item.system?.pack === true)
}

export async function resolveAll(parsed) {
  const results = { resolved: [], approximate: [], packs: [], missing: [] }

  const resolve = async (name, type, fallbacks = []) => {
    const r = await resolveItem(name, type, fallbacks)
    if (!r) { results.missing.push({ name, type }); return null }
    if (isEquipmentPack(r.item)) { results.packs.push(r); return null }
    if (r.matchType === 'approximate') results.approximate.push(r)
    else results.resolved.push(r)
    return r.item
  }

  const weaponItems = await Promise.all(
    parsed.weapons.map(w => resolve(w.name, 'meleeweapon', ['rangeweapon']))
  )
  const armorItems = await Promise.all(
    parsed.armor.map(a => resolve(a.name, 'armor'))
  )
  const sfItems = await Promise.all(
    parsed.sonderfertigkeiten.map(s => resolve(s, 'specialability'))
  )
  const vorteilItems = await Promise.all(
    parsed.vorteile.map(v => resolve(v, 'advantage'))
  )
  const nachteilItems = await Promise.all(
    parsed.nachteile.map(n => resolve(n, 'disadvantage'))
  )
  const sprachenItems = await Promise.all(
    parsed.sprachen.map(s => resolve(s, 'language'))
  )
  const schriftenItems = await Promise.all(
    parsed.schriften.map(s => resolve(s, 'script'))
  )

  return {
    ...results,
    items: [...weaponItems, ...armorItems, ...sfItems, ...vorteilItems, ...nachteilItems, ...sprachenItems, ...schriftenItems].filter(Boolean),
  }
}
```

- [ ] **Step 2: Manual test in Foundry console**

With Foundry running, open the browser console and paste:
```js
const { resolveItem } = await import('/modules/dsa5-statblock-importer/dist/main.js')
const result = await resolveItem('Langschwert', 'meleeweapon')
console.log(result)
```

Expected: an object with `item` and `matchType: 'exact'`.

- [ ] **Step 3: Test approximate matching with a typo**

```js
const result = await resolveItem('Langschwert', 'meleeweapon')  // exact
const approx = await resolveItem('Langschwrt', 'meleeweapon')   // typo, should fuzzy match
console.log(approx?.matchType)  // 'approximate'
```

- [ ] **Step 4: Commit**

```bash
git add src/compendium-resolver.js
git commit -m "feat: implement compendium resolver with exact and fuzzy matching"
```

---

## Task 14: `actor-builder.js`

**Files:**
- Create: `src/actor-builder.js`

Note: Runs inside Foundry — test manually via Docker instance.

- [ ] **Step 1: Read `docs/dsa5-research/actor-schema.md` and `docs/dsa5-research/api-patterns.md`**

Before writing any code, read the verified field paths from Task 4. The skeleton below uses **placeholder paths** — every `// TODO: verify` comment MUST be replaced with the confirmed path from the research docs before this task is complete. Do not copy-paste the skeleton and ship it with TODOs intact.

- [ ] **Step 2: Implement `src/actor-builder.js`**

```js
import { resolveAll } from './compendium-resolver.js'

function buildGmNotes(fluff, gossip, stats) {
  const lines = []
  if (fluff.npcCategory) lines.push(`<h2>[${fluff.npcCategory}] ${fluff.titel ?? ''} ${fluff.name ?? ''}</h2>`)
  if (fluff.kurzcharakteristik) lines.push(`<p><strong>Kurzcharakteristik:</strong> ${fluff.kurzcharakteristik}</p>`)
  if (fluff.motivation) lines.push(`<p><strong>Motivation:</strong> ${fluff.motivation}</p>`)
  if (fluff.agenda) lines.push(`<p><strong>Agenda:</strong> ${fluff.agenda}</p>`)
  if (fluff.funktion) lines.push(`<p><strong>Funktion:</strong> ${fluff.funktion}</p>`)
  if (fluff.hintergrund) lines.push(`<p><strong>Hintergrund:</strong> ${fluff.hintergrund}</p>`)
  if (fluff.feindbilder?.length) lines.push(`<p><strong>Feindbilder:</strong> ${fluff.feindbilder.join(', ')}</p>`)
  if (fluff.darstellung) lines.push(`<p><strong>Darstellung:</strong> ${fluff.darstellung}</p>`)
  if (fluff.schicksal) lines.push(`<p><strong>Schicksal:</strong> ${fluff.schicksal}</p>`)
  if (fluff.besonderheiten) lines.push(`<p><strong>Besonderheiten:</strong> ${fluff.besonderheiten}</p>`)
  if (fluff.zitate?.length) lines.push(`<p><strong>Zitate:</strong><br>${fluff.zitate.join('<br>')}</p>`)
  if (stats?.sozialstatus) lines.push(`<p><strong>Sozialstatus:</strong> ${stats.sozialstatus}</p>`)
  if (stats?.kampfverhalten) lines.push(`<p><strong>Kampfverhalten:</strong> ${stats.kampfverhalten}</p>`)
  if (stats?.flucht) lines.push(`<p><strong>Flucht:</strong> ${stats.flucht}</p>`)
  if (gossip?.entries?.length) {
    lines.push('<h3>Gerüchte</h3>')
    for (const entry of gossip.entries) {
      lines.push(`<p>${entry.text}</p>`)
    }
  }
  return lines.join('\n')
}

export async function buildActor(reviewState) {
  // reviewState is the final state from ReviewDialog after user edits
  const { stats, fluff, gossip, spezies, kultur, profession, resolution } = reviewState

  const name = [fluff?.titel, fluff?.name ?? stats?.name].filter(Boolean).join(' ')

  const actorData = {
    name,
    type: 'TODO_verify_npc_type',  // TODO: replace with verified type from docs/dsa5-research/actor-schema.md
    system: {
      // TODO: replace ALL paths below with verified paths from docs/dsa5-research/actor-schema.md
      // The paths below are structural placeholders — they WILL be wrong until verified
      'TODO_attributes_path': {
        // e.g. characteristics.mu.advances or base.attributes.mu.value — verify first
        mu: { advances: stats?.attributes?.MU ?? 0 },
        kl: { advances: stats?.attributes?.KL ?? 0 },
        in: { advances: stats?.attributes?.IN ?? 0 },
        ch: { advances: stats?.attributes?.CH ?? 0 },
        ff: { advances: stats?.attributes?.FF ?? 0 },
        ge: { advances: stats?.attributes?.GE ?? 0 },
        ko: { advances: stats?.attributes?.KO ?? 0 },
        kk: { advances: stats?.attributes?.KK ?? 0 },
      },
      // TODO: add verified derived value paths (LeP, AW, SK, ZK, GS, Schip, INI)
      details: {
        // TODO: verify biography and socialstate field paths
        biography: { value: buildGmNotes(fluff ?? {}, gossip ?? {}, stats) },
        socialstate: { value: stats?.sozialstatus ?? '' },
      },
    },
    flags: {
      'dsa5-statblock-importer': {
        npcCategory: fluff?.npcCategory ?? null,
      },
    },
  }

  // TODO: use confirmed creation method from docs/dsa5-research/api-patterns.md
  // Use Actor.create() (standard Foundry v13 API) unless research confirms game.dsa5.entities.Actordsa5.create() differs
  const actor = await Actor.create(actorData)

  // Add resolved items
  if (resolution?.items?.length) {
    await actor.createEmbeddedDocuments('Item', resolution.items.map(i => i.toObject()))
  }

  // Set talent and combat technique values on existing embedded items
  const itemUpdates = []
  for (const kt of stats?.kampftechniken ?? []) {
    const existing = actor.items.find(i => i.name === kt.name && i.type === 'combatskill')
    if (existing) itemUpdates.push({ _id: existing.id, system: { talentValue: { value: kt.value } } })
  }
  for (const [, talents] of Object.entries(stats?.talente ?? {})) {
    for (const t of talents) {
      const existing = actor.items.find(i => i.name === t.name && i.type === 'skill')
      if (existing) itemUpdates.push({ _id: existing.id, system: { talentValue: { value: t.value } } })
    }
  }
  if (itemUpdates.length) await actor.updateEmbeddedDocuments('Item', itemUpdates)

  return actor
}
```

- [ ] **Step 2: Manual test in Foundry**

Parse the Jaruslaw fixture, resolve items, then call `buildActor`. Verify the actor is created, has the correct attributes, and GM notes are populated.

- [ ] **Step 3: Commit**

```bash
git add src/actor-builder.js
git commit -m "feat: implement actor builder with attributes, items, and GM notes"
```

---

## Task 15: `import-dialog.js` + Template

**Files:**
- Update: `src/import-dialog.js`
- Update: `templates/import-dialog.hbs`

- [ ] **Step 1: Implement `src/import-dialog.js`**

```js
import { clean } from './parser/cleaner.js'
import { parseStats } from './parser/stats-parser.js'
import { parseFluff } from './parser/fluff-parser.js'
import { parseGossip } from './parser/gossip-parser.js'
import { resolveAll } from './compendium-resolver.js'

export class ImportDialog extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'dsa5-statblock-importer',
      title: game.i18n.localize('DSA5SI.button.import'),
      template: 'modules/dsa5-statblock-importer/templates/import-dialog.hbs',
      width: 600,
      height: 'auto',
    })
  }

  activateListeners(html) {
    super.activateListeners(html)
    html.find('button[name="analyse"]').on('click', () => this._onAnalyse(html))
  }

  async _onAnalyse(html) {
    const rawStats = html.find('[name="stats"]').val()
    const rawFluff = html.find('[name="fluff"]').val()
    const rawGossip = html.find('[name="gossip"]').val()

    if (!rawStats && !rawFluff && !rawGossip) {
      ui.notifications.error('Bitte mindestens einen Abschnitt einfügen.')
      return
    }

    const stats = rawStats ? parseStats(clean(rawStats)) : null
    const fluff = rawFluff ? parseFluff(clean(rawFluff)) : null
    const gossip = rawGossip ? parseGossip(clean(rawGossip)) : null

    const resolution = stats ? await resolveAll(stats) : { resolved: [], approximate: [], packs: [], missing: [], items: [] }

    const { ReviewDialog } = await import('./review-dialog.js')
    new ReviewDialog({ stats, fluff, gossip, resolution }).render(true)
    this.close()
  }
}
```

- [ ] **Step 2: Update `templates/import-dialog.hbs`**

```html
<form class="dsa5-importer-form" autocomplete="off">
  <div class="form-group stacked">
    <label>{{localize "DSA5SI.import.stats"}}</label>
    <textarea name="stats" rows="12" placeholder="Werte aus PDF einfügen..."></textarea>
  </div>
  <div class="form-group stacked">
    <label>{{localize "DSA5SI.import.fluff"}}</label>
    <textarea name="fluff" rows="10" placeholder="Beschreibung aus PDF einfügen..."></textarea>
  </div>
  <div class="form-group stacked">
    <label>{{localize "DSA5SI.import.gossip"}}</label>
    <textarea name="gossip" rows="6" placeholder="Gerüchte aus PDF einfügen..."></textarea>
  </div>
  <div class="form-footer">
    <button type="button" name="analyse">
      <i class="fas fa-search"></i>
      {{localize "DSA5SI.import.analyse"}}
    </button>
  </div>
</form>
```

- [ ] **Step 3: Update `src/main.js` to open `ImportDialog`**

```js
import { ImportDialog } from './import-dialog.js'

Hooks.on('renderActorDirectory', (app, html) => {
  if (!game.user.isGM) return
  const button = $(`<button type="button">
    <i class="fas fa-file-import"></i>
    ${game.i18n.localize('DSA5SI.button.import')}
  </button>`)
  html.find('.directory-header .action-buttons').append(button)
  button.on('click', () => new ImportDialog().render(true))
})
```

- [ ] **Step 4: Build and test in Foundry**

```bash
pnpm build
```

Click the sidebar button, paste the Jaruslaw fixture, click "Analysieren". Verify no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/import-dialog.js src/main.js templates/import-dialog.hbs
git commit -m "feat: implement ImportDialog with parsing and compendium resolution"
```

---

## Task 16: `review-dialog.js` + Template

**Files:**
- Create: `src/review-dialog.js`
- Update: `templates/review-dialog.hbs`

- [ ] **Step 1: Implement `src/review-dialog.js`**

```js
import { buildActor } from './actor-builder.js'

export class ReviewDialog extends Application {
  constructor(data, options = {}) {
    super(options)
    this._data = data  // { stats, fluff, gossip, resolution }
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'dsa5-statblock-review',
      title: 'Import prüfen',
      template: 'modules/dsa5-statblock-importer/templates/review-dialog.hbs',
      width: 720,
      height: 800,
      resizable: true,
    })
  }

  getData() {
    const { stats, fluff, gossip, resolution } = this._data
    return {
      name: fluff?.name ?? stats?.name ?? '',
      nameRequired: !(fluff?.name ?? stats?.name),
      npcCategory: fluff?.npcCategory,
      titel: fluff?.titel,
      attributes: stats?.attributes ?? {},
      derived: stats?.derived ?? {},
      weapons: stats?.weapons ?? [],
      armor: stats?.armor ?? [],
      kampftechniken: stats?.kampftechniken ?? [],
      talente: stats?.talente ?? {},
      sonderfertigkeiten: stats?.sonderfertigkeiten ?? [],
      vorteile: stats?.vorteile ?? [],
      nachteile: stats?.nachteile ?? [],
      sprachen: stats?.sprachen ?? [],
      schriften: stats?.schriften ?? [],
      sozialstatus: stats?.sozialstatus ?? '',
      fluff: fluff ?? {},
      gossip: gossip ?? {},
      resolved: resolution.resolved,
      approximate: resolution.approximate,
      missing: resolution.missing,
      packs: resolution.packs,
    }
  }

  activateListeners(html) {
    super.activateListeners(html)
    html.find('button[name="create"]').on('click', () => this._onCreate(html))
    html.find('button[name="cancel"]').on('click', () => this.close())
  }

  async _onCreate(html) {
    const name = html.find('[name="actor-name"]').val().trim()
    if (!name) {
      ui.notifications.warn('Name ist ein Pflichtfeld.')
      html.find('[name="actor-name"]').addClass('error')
      return
    }

    // Read back all editable attribute inputs — user may have changed them in the review form
    const attrs = ['MU', 'KL', 'IN', 'CH', 'FF', 'GE', 'KO', 'KK']
    const editedAttributes = {}
    for (const attr of attrs) {
      const val = parseInt(html.find(`[name="attr-${attr}"]`).val())
      editedAttributes[attr] = isNaN(val) ? (this._data.stats?.attributes?.[attr] ?? 0) : val
    }

    const reviewState = {
      ...this._data,
      fluff: { ...this._data.fluff, name },
      stats: { ...this._data.stats, attributes: editedAttributes },
    }

    const actor = await buildActor(reviewState)
    this.close()
    actor.sheet.render(true)
  }
}
```

- [ ] **Step 2: Update `templates/review-dialog.hbs`**

Key sections to render:
```html
<form class="dsa5-review-form" autocomplete="off">

  <!-- Name (required) -->
  <div class="form-group {{#unless name}}required{{/unless}}">
    <label>Name *</label>
    <input type="text" name="actor-name" value="{{name}}"
      placeholder="Name eingeben..." class="{{#unless name}}error{{/unless}}">
  </div>

  {{#if npcCategory}}
  <div class="form-group">
    <label>Kategorie</label>
    <span>[{{npcCategory}}] {{titel}}</span>
  </div>
  {{/if}}

  <!-- Attributes -->
  <fieldset><legend>Attribute</legend>
    {{#each attributes}}
    <div class="attr-group">
      <label>{{@key}}</label>
      <input type="number" name="attr-{{@key}}" value="{{this}}">
    </div>
    {{/each}}
  </fieldset>

  <!-- Approximate matches -->
  {{#if approximate.length}}
  <fieldset class="approximate"><legend>Ungefähre Treffer</legend>
    {{#each approximate}}
    <p>«{{originalName}}» → <strong>{{matchedName}}</strong> (ungefähr)</p>
    {{/each}}
  </fieldset>
  {{/if}}

  <!-- Missing items -->
  {{#if missing.length}}
  <fieldset class="missing"><legend>Nicht gefunden</legend>
    {{#each missing}}
    <p class="error">{{name}} ({{type}})</p>
    {{/each}}
  </fieldset>
  {{/if}}

  <!-- Equipment packs -->
  {{#if packs.length}}
  <fieldset class="packs"><legend>Ausrüstungspakete</legend>
    {{#each packs}}
    <p>{{item.name}} — nach Erstellung aus dem Chat ziehen</p>
    {{/each}}
  </fieldset>
  {{/if}}

  <!-- Spezies / Kultur / Profession -->
  <fieldset><legend>Herkunft (optional)</legend>
    <div class="form-group">
      <label>Spezies</label>
      <input type="text" name="spezies" placeholder="Aus Kompendium ziehen...">
    </div>
    <div class="form-group">
      <label>Kultur</label>
      <input type="text" name="kultur" placeholder="Aus Kompendium ziehen...">
    </div>
    <div class="form-group">
      <label>Profession</label>
      <input type="text" name="profession" placeholder="Aus Kompendium ziehen...">
    </div>
  </fieldset>

  <div class="form-footer">
    <button type="button" name="cancel">{{localize "DSA5SI.review.cancel"}}</button>
    <button type="button" name="create" class="default">
      <i class="fas fa-user-plus"></i>
      {{localize "DSA5SI.review.create"}}
    </button>
  </div>
</form>
```

- [ ] **Step 3: Build and do an end-to-end test with Jaruslaw fixture**

```bash
pnpm build
```

1. Click "Statblock importieren" in Actors sidebar
2. Paste all three sections of the Jaruslaw fixture
3. Click "Analysieren"
4. Verify ReviewDialog shows correct name, attributes, approximate/missing items
5. Click "Charakter erstellen"
6. Verify actor opens with correct data and GM notes

- [ ] **Step 4: Commit**

```bash
git add src/review-dialog.js templates/review-dialog.hbs
git commit -m "feat: implement ReviewDialog with editable preview and actor creation"
```

---

## Task 17: Styles

**Files:**
- Update: `styles/module.css`

- [ ] **Step 1: Add minimal styles**

```css
/* DSA5 Statblock Importer */

.dsa5-importer-form textarea {
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
}

.dsa5-review-form .required input,
.dsa5-review-form input.error {
  border-color: var(--color-level-error);
}

.dsa5-review-form fieldset {
  margin-bottom: 0.75rem;
  border: 1px solid var(--color-border-light-tertiary);
  border-radius: 4px;
  padding: 0.5rem;
}

.dsa5-review-form fieldset.missing p {
  color: var(--color-level-error);
}

.dsa5-review-form fieldset.approximate p {
  color: var(--color-level-warning);
}

.dsa5-review-form .attr-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 8px;
}

.dsa5-review-form .attr-group input {
  width: 48px;
  text-align: center;
}

.dsa5-review-form .form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 1rem;
}
```

- [ ] **Step 2: Build and verify styles apply**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add styles/module.css
git commit -m "feat: add module styles for import and review dialogs"
```

---

## Task 18: Final Integration Test & Cleanup

- [ ] **Step 1: Run full Vitest suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: End-to-end test with multiple fixture files** (if additional PDFs have been provided)

Test each fixture: parse → review → create actor. Verify no console errors.

- [ ] **Step 3: Test edge cases**

- Paste only Stats section (blank Fluff and Gossip) → actor created with minimal data
- Paste only Fluff section → name populated, attributes empty
- Leave name blank → ReviewDialog blocks creation with error highlight
- Paste statblock with unresolvable item name → shows in "Nicht gefunden" section

- [ ] **Step 4: Update `docs/dsa5-research/unknown.md`** with anything still unresolved

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete DSA5 Statblock Importer v0.1.0"
```

---

## Dependency Order

```
Task 1 (dev env)
  └── Task 2 (module scaffold)
        └── Task 3 (Docker)
              └── Task 4 (API verification)
Task 5 (vitest + fixture)
  └── Task 6 (cleaner)
        └── Task 7 (stats: name + attributes)
              └── Task 8 (stats: derived)
                    └── Task 9 (stats: weapons + armor)
                          └── Task 10 (stats: skills + prose)
        └── Task 11 (fluff parser)
        └── Task 12 (gossip parser)
Task 4 + Task 10 + Task 11 + Task 12
  └── Task 13 (compendium resolver)
        └── Task 14 (actor builder)
              └── Task 15 (import dialog)
                    └── Task 16 (review dialog)
                          └── Task 17 (styles)
                                └── Task 18 (integration test)
```
