# DSA5 Statblock Importer — Design Spec

**Date:** 2026-04-04
**Status:** Approved

---

## Overview

A Foundry VTT module that lets a GM paste a DSA5 NPC statblock (copied from a PDF) into a three-section dialog and import it as a fully configured actor. The module targets Foundry v11/v12 with the official DSA5 system and all Ulisses premium compendium modules installed.

---

## Architecture

### Module Structure

```
dsa5-statblock-importer/
├── flake.nix                  # nix dev environment (node, pnpm)
├── flake.lock
├── .envrc                     # direnv → use flake
├── module.json                # Foundry manifest (id: dsa5-statblock-importer)
├── package.json               # pnpm + vite
├── pnpm-lock.yaml
├── vite.config.js
├── src/
│   ├── main.js                # entry point, hook registration
│   ├── import-dialog.js       # three-tab import dialog
│   ├── review-dialog.js       # pre-creation review & edit dialog
│   ├── compendium-resolver.js # name → compendium item lookup
│   ├── actor-builder.js       # constructs and creates DSA5 actor
│   └── parser/
│       ├── cleaner.js         # PDF artifact normalization
│       ├── stats-parser.js    # parses stats section
│       ├── fluff-parser.js    # parses fluff section
│       └── gossip-parser.js   # parses gossip section
├── templates/
│   ├── import-dialog.hbs
│   └── review-dialog.hbs
├── styles/
│   └── module.css
├── languages/
│   └── de.json                # UI labels only (not compendium item names)
└── tests/
    ├── fixtures/              # raw PDF paste samples as .txt files
    │   └── jaruslaw.txt
    ├── cleaner.test.js
    ├── stats-parser.test.js
    ├── fluff-parser.test.js
    └── gossip-parser.test.js
```

### Module Manifest (`module.json`)

Required fields:
```json
{
  "id": "dsa5-statblock-importer",
  "title": "DSA5 Statblock Importer",
  "description": "Import DSA5 NPC statblocks from PDF into Foundry VTT actors.",
  "version": "0.1.0",
  "compatibility": { "minimum": "13", "verified": "13" },
  "esmodules": ["dist/main.js"],
  "styles": ["styles/module.css"],
  "languages": [{ "lang": "de", "name": "Deutsch", "path": "languages/de.json" }]
}
```

### Tech Stack

- **Foundry VTT** v13, DSA5 system + Ulisses premium compendiums
- **ES Modules** via `esmodules` in module.json
- **Vite** for bundling (output: `dist/`)
- **pnpm** as package manager
- **Vitest** for unit tests (parser logic runs outside Foundry)
- **Nix flake + direnv** for reproducible dev environment

### Entry Point (`main.js`)

Registers a button in the **Actors sidebar tab** via the `renderActorDirectory` hook. Requires GM permission. On click, opens `ImportDialog`. No async work happens in the hook itself.

---

## User Flow

1. GM clicks **"Statblock importieren"** button in the Actors sidebar tab → `ImportDialog` opens
2. Dialog has three text areas: **Stats**, **Fluff**, **Gossip** — any section may be left empty
3. GM pastes available sections from the PDF and clicks **"Analysieren"**
4. Each non-empty section is cleaned then parsed
5. Parsed data is resolved against DSA5 compendiums
6. `ReviewDialog` opens **before** the actor is created, showing:
   - All parsed fields with their resolved values (editable)
   - Approximate matches with original → matched name (editable)
   - Fields that could not be parsed, shown as empty inputs for manual entry
   - Unparseable raw text shown alongside so the GM can copy values manually
   - Race, culture, and profession selectors (dropdown or drag from DSA compendium) — these are rarely in the statblock but required for a complete actor
   - Missing/unresolved items flagged inline
   - Equipment packs listed for later drag
7. GM reviews, edits, and clicks **"Charakter erstellen"** → actor is created
8. Actor opens automatically after creation

### Error Handling

- If all three sections are blank, show an error and do not proceed
- If the stats section yields no name, parsing continues normally — the name field in the ReviewDialog is left empty and marked as required, blocking actor creation until the GM fills it in
- If the stats section is malformed (no attributes parsed), show a warning and display the raw text for manual entry in the ReviewDialog
- Partial parses are allowed: unresolved fields appear as empty inputs in the ReviewDialog
- Compendium lookup failures are non-fatal: the item is flagged inline in the ReviewDialog

---

## Input Cleaning (`cleaner.js`)

Runs on all three sections before parsing:

- **Ligatures:** `ﬁ→fi`, `ﬂ→fl`, `ﬀ→ff`, etc.
- **Dashes:** `–`, `—`, `‐` → `-`
- **Quotes:** `»«` preserved; `„"` normalized
- **Soft hyphens** (`\u00AD`): removed (PDF line-break artifacts)
- **Whitespace:** multiple spaces/tabs → single space; paragraph breaks preserved
- **Stray page numbers:** lone numeric lines removed

---

## Parsing Strategy

### Block-Boundary Reassembly

Rather than detecting line continuation patterns, the parser uses **keyword anchors** to define block boundaries. All content between two anchors belongs to the first anchor, regardless of line wrapping. This makes the parser robust to varying PDF copy behavior.

Known stat section anchors (maintained in one place in `stats-parser.js`):
```
RS/BE, Sozialstatus, Sonderfertigkeiten, Sprachen, Schriften,
Vorteile, Nachteile, Kampftechniken, Talente, Kampfverhalten, Flucht
```

Weapons have no colon anchor — detected by presence of `AT`, `PA`, or `FK` pattern. Lines are merged upward until the previous weapon-like line or a known anchor.

Unrecognized lines between anchors are appended to the previous block (safe fallback).

### Fluff Section Anchors

Known fluff section anchors (maintained in one place in `fluff-parser.js`):
```
Kurzcharakteristik, Motivation, Agenda, Funktion, Hintergrund,
Feindbilder, Darstellung, Schicksal, Besonderheiten
```

The first line of the fluff section contains the NPC category digit, optional title, and name (e.g. `3 Schitze Jaruslaw von Kirschhausen-Krabbwitzkoje`). Quotes (lines starting with `»`) at the end of the section are collected as `zitate`.

### Gossip Section Delimiters

Gossip entries are delimited by lines starting with `»` (opening guillemet). Each entry runs until the next `»` line or end of section. The header line (`Gerüchte über ...`) is parsed to extract the `subject`. Inline truth markers `(+)`, `(-)`, `(möglich)` are preserved as-is within entry text.

---

## Data Models

### Stats Parser Output

```js
{
  name: String,
  attributes: { MU, KL, IN, CH, FF, GE, KO, KK },  // all Numbers
  derived: {
    LeP: Number,
    Asp: Number|null,   // null if "–"
    KaP: Number|null,   // null if "–"
    INI: { base: Number, dice: String },  // e.g. { base: 12, dice: "1W6" }
    AW: Number,
    SK: Number,
    ZK: Number,
    GS: Number,
    Schip: Number
  },
  weapons: [
    { name: String, AT: Number|null, PA: Number|null, FK: Number|null }
    // AT/PA/FK retained as hints for Kampftechnik inference when not separately listed
  ],
  armor: [
    { name: String, RS: Number, BE: Number }
    // RS/BE parsed from the RS/BE line and stored for reference;
    // the compendium item is the authoritative source for actor stats,
    // but values are retained in case the item cannot be resolved
  ],
  sozialstatus: String,
  sonderfertigkeiten: [String],
  sprachen: [String],
  schriften: [String],
  vorteile: [String],
  nachteile: [String],
  kampftechniken: [
    {
      name: String,
      value: Number,        // base Kampftechnikwert (e.g. 12 from "Bogen 12 (13)")
      atBonus: Number|null, // parenthetical AT value (e.g. 13), null if absent
      paBonus: Number|null  // parenthetical PA value (e.g. 9), null if absent
    }
  ],
  talente: {
    Körper:       [{ name: String, value: Number, spezialisierung: String|null }],
    Gesellschaft: [{ name: String, value: Number, spezialisierung: String|null }],
    Natur:        [{ name: String, value: Number, spezialisierung: String|null }],
    Wissen:       [{ name: String, value: Number, spezialisierung: String|null }],
    Handwerk:     [{ name: String, value: Number, spezialisierung: String|null }],
    Sonstige:     [{ name: String, value: Number, spezialisierung: String|null }]
    // Sonstige: fallback bucket for unrecognized talent categories
  },
  kampfverhalten: String,  // prose → GM notes
  flucht: String           // prose → GM notes
}
```

**Notes:**
- `spezialisierung` can appear on any talent category, not just Körper
- Unrecognized talent category headers fall into `Sonstige`
- `Kampftechnik.atBonus`/`paBonus`: the parenthetical values in `Bogen 12 (13)` and `Schwerter 14 (15/9)` represent AT and optional PA bonuses

### Fluff Parser Output

```js
{
  npcCategory: "Turm" | "Springer" | "Bauer" | "Läufer" | null,
  // null if digit is absent or outside 1–4; logged as warning, import continues
  titel: String | null,
  name: String,
  kurzcharakteristik: String,
  motivation: String,
  agenda: String,
  funktion: String,
  hintergrund: String,
  feindbilder: [String],
  darstellung: String,
  schicksal: String,
  besonderheiten: String,
  zitate: [String]
}
```

NPC category digit mapping (PDF font artifact → icon name):
- `1` → Bauer
- `2` → Springer
- `3` → Turm
- `4` → Läufer

### Gossip Parser Output

```js
{
  subject: String,
  entries: [
    { text: String }  // inline (+)/(–)/(möglich) markers preserved as-is
  ]
}
```

---

## Compendium Resolution (`compendium-resolver.js`)

### Language

All compendium item names are in German. Name matching operates entirely on German strings. `languages/de.json` contains only UI labels.

### Search Scope & Order

Searches the following pack prefixes in order, stopping at first match:
1. `dsa5` system packs (base rules)
2. `dsa5-core` / Ulisses premium packs (prefix pattern: `ulisses-*` or as installed)
3. Any remaining world compendiums

The exact pack IDs depend on the installed Ulisses modules. The resolver iterates `game.packs` filtered by `type` and searches by German item name. If no packs matching tiers 1 or 2 are found, a warning is logged and resolution falls through to world compendiums. If no compendiums of the required item type exist at all, the item is treated as unresolved and flagged as missing in the summary dialog.

### Name Matching

- **Exact match:** direct string equality (case-insensitive, trimmed)
- **Approximate match:** normalized comparison — strip Roman numerals suffix, compare stem, then re-attach (handles `Belastungsgewöhnung I` vs `Belastungsgewöhnung II` as same base ability). Levenshtein distance ≤ 2 as secondary fallback for typos/ligature residue. Approximate matches are flagged in the summary dialog as `"Matched 'X' to 'Y' (ungefähr)"`.
- **Pack detection:** an item is treated as an equipment pack if its `type` is `equipment` and its name contains `paket` (case-insensitive), or if it has a `pack: true` flag in its system data. Packs are offered as a chat message with a drag link rather than added directly to the actor.

### Resolved Categories

| Parsed field | Compendium item type | Action |
|---|---|---|
| `weapons` | `weapon` | add to actor |
| `armor` | `armor` | add to actor |
| `sonderfertigkeiten` | `specialAbility` | add to actor |
| `vorteile` | `advantage` | add to actor |
| `nachteile` | `disadvantage` | add to actor |
| `kampftechniken` | combat technique entry | set value on actor |
| `talente` | skill entry | set value on actor |
| `sprachen` | language item | add to actor |
| `schriften` | script/writing item | add to actor |
| `sozialstatus` | — | written to GM notes (labeled) |

---

## Actor Construction (`actor-builder.js`)

### Name Resolution

Fluff `name` takes priority when present. Stats `name` is used as fallback. `titel` from fluff is prepended to the name (e.g. `Schitze Jaruslaw von Kirschhausen-Krabbwitzkoje`).

### Steps

1. Determine actor name (fluff name + titel, or stats name)
2. Create NPC actor (`type: "creature"` or the DSA5 NPC type)
3. Set `attributes` (MU, KL, IN, CH, FF, GE, KO, KK)
4. Set `derived` values: LeP, Asp, KaP, AW, SK, ZK, GS, Schip; INI split into `base` and `dice` fields as the DSA5 system expects
5. Set Kampftechnik values; if a Kampftechnik is absent from the parsed `kampftechniken` list, infer the base value as `weapon.AT - 6` (the DSA5 base AT formula) using the highest AT value across all weapons sharing that Kampftechnik. This is a best-effort hint — inferred values are flagged distinctly in the summary dialog as `"Kampftechnikwert geschätzt aus AT"` so the GM can verify them
6. Set Talent values
7. Attach resolved compendium items (weapons, armor, abilities, advantages, disadvantages)
8. Write GM notes (biography field) as formatted HTML containing:
   - NPC category icon name + label (e.g. `[Turm] Schitze`)
   - All fluff fields with German labels
   - `Kampfverhalten` and `Flucht` prose
   - Gossip entries under a `Gerüchte` heading, inline markers preserved
9. Store `npcCategory` as actor flag (`flags.dsa5-statblock-importer.npcCategory`) for potential filtering

---

## Review Dialog (`review-dialog.js`)

Opens **before** actor creation, after parsing and compendium resolution. Gives the GM a chance to review, correct, and complete the import before committing.

### Sections

**Parsed fields (editable):**
- All resolved attributes, derived values, items, and text fields shown with their parsed values
- Approximate compendium matches shown as `"X → Y (ungefähr)"` with an option to override
- Each field is editable inline before creation

**Unparseable content:**
- Any section of the statblock that could not be parsed is shown verbatim as raw text alongside the empty form fields, so the GM can read and enter values manually

**Missing fields (manual entry):**
- Race (`Spezies`), culture (`Kultur`), and profession (`Profession`) selectors — typically absent from statblocks but needed for a complete DSA5 actor. Populated via dropdown from the DSA5 compendium or drag-and-drop from the compendium browser.
- Any other unresolved fields shown as empty inputs

**Equipment packs:**
- Listed with instructions to drag from chat after actor creation (not creatable during review)

### Actions

- **"Charakter erstellen"** — creates the actor from the current state of the review form
- **"Abbrechen"** — closes without creating anything

---

## Testing

- **Vitest** for all parser and cleaner unit tests
- Test fixtures are raw `.txt` files extracted from real PDFs (to be provided by GM)
- Tests cover: ligature normalization, multi-line reassembly, weapon detection, RS/BE parsing, INI split, talent block parsing (all categories including Sonstige), gossip entry delimiting, inline markers, NPC category mapping, missing/null category handling
- Additional fixture files added from GM-provided PDFs before implementation

---

## API Assumption Verification

Several parts of the spec make assumptions about the DSA5 system's internal API that must be validated against a real running Foundry instance before implementation. The only reliable way to do this is to run Foundry locally with the DSA5 system and Chrome DevTools.

### Setup

Run Foundry v13 via Docker (no local install required):

```sh
docker run -d \
  --name foundry-dsa5-dev \
  -p 30000:30000 \
  -v "$(pwd)/foundry-data:/data" \
  felddy/foundryvtt:13
```

Then:
1. Open `http://localhost:30000` in Chrome and complete initial setup
2. Install the `dsa5` system and all Ulisses premium modules via the Foundry UI
3. Create a world using the DSA5 system
4. Bind-mount (or copy) this module's `dist/` output into `foundry-data/Data/modules/dsa5-statblock-importer` and enable it in the world
5. Open the world in Chrome and use DevTools console to inspect live objects

### Assumptions to Verify

Each assumption below should be verified in the DevTools console before writing the code that depends on it.

| Assumption | How to verify |
|---|---|
| NPC actor type name (`"creature"` or similar) | `game.system.documentTypes.Actor` |
| Attribute field paths (e.g. `system.base.attributes.mu.value`) | Inspect a hand-created NPC actor: `game.actors.getName("test").system` |
| INI field structure (base + dice) | Same actor inspection |
| Derived value field paths (LeP, AW, SK, etc.) | Same actor inspection |
| Schip field path | Same actor inspection |
| Kampftechnik item type and value field | Create a Kampftechnik item, inspect `item.system` |
| Talent item type and value field | Same for a talent item |
| Compendium pack IDs for DSA5 + Ulisses modules | `game.packs.map(p => p.collection)` |
| Item types used for weapons, armor, abilities, advantages, disadvantages, languages | `game.packs.get("dsa5.baseweapons").documentClass.schema` or spot-check an item |
| Equipment pack detection (`pack: true` flag or `paket` in name) | Inspect a known pack item from the Ulisses compendiums |
| How to set Kampftechnik values on an actor programmatically | Check existing DSA5 module source or test with `actor.update(...)` |

### Verification Workflow During Implementation

The `chrome-devtools-mcp` plugin is available, meaning Claude can drive Chrome DevTools programmatically rather than requiring manual console inspection.

Workflow:
1. Start the Foundry Docker container and open the world in Chrome
2. Use `chrome-devtools-mcp` to execute console snippets against the live Foundry page
3. Capture the results and update this spec with the verified field paths
4. Use `CONFIG.DSA5` to inspect system-registered metadata (item types, attribute keys, etc.)
5. If a field path differs from the spec, update the spec before writing code — don't silently adapt in code
6. Verified paths should be noted in code comments so future contributors don't need to re-discover them

This means API verification can be scripted as an explicit implementation step rather than a manual prerequisite.

---

## DSA5 System Research Docs

As part of the API verification step, findings are written to machine-readable reference documents in `docs/dsa5-research/`. These are updated whenever a verified field path differs from the spec, and serve as the authoritative source of truth for implementation.

### Structure

```
docs/dsa5-research/
├── actor-schema.md        # verified field paths for NPC actor system data
├── item-types.md          # item type names and system field paths per category
├── compendium-packs.md    # list of all available pack IDs and their content types
├── api-patterns.md        # how to programmatically create/update actors and items
└── unknown.md             # things tried but not yet resolved
```

Each file follows this format so it can be read by Claude in future sessions without re-running DevTools:

```markdown
## <field group>
Verified: <date>
Source: <DevTools snippet used>

<field name>: <path> — <type> — <notes>
```

The research docs are committed to git alongside code so that any future implementation session can load them as context rather than re-discovering field paths from scratch.

---

## Out of Scope

- Parsing player character sheets
- Importing from structured file formats (JSON, XML)
- LLM-assisted parsing
- Automatic token image assignment
