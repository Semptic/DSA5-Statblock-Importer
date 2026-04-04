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
├── module.json                # Foundry manifest
├── package.json               # pnpm + vite
├── pnpm-lock.yaml
├── vite.config.js
├── src/
│   ├── main.js                # entry point, hook registration
│   ├── import-dialog.js       # three-tab import dialog
│   ├── summary-dialog.js      # post-import result dialog
│   ├── compendium-resolver.js # name → compendium item lookup
│   ├── actor-builder.js       # constructs and creates DSA5 actor
│   └── parser/
│       ├── cleaner.js         # PDF artifact normalization
│       ├── stats-parser.js    # parses stats section
│       ├── fluff-parser.js    # parses fluff section
│       └── gossip-parser.js   # parses gossip section
├── templates/
│   ├── import-dialog.hbs
│   └── summary-dialog.hbs
├── styles/
│   └── module.css
├── languages/
│   └── de.json
└── tests/
    ├── fixtures/              # raw PDF paste samples as .txt files
    │   └── jaruslaw.txt
    ├── cleaner.test.js
    ├── stats-parser.test.js
    ├── fluff-parser.test.js
    └── gossip-parser.test.js
```

### Tech Stack

- **Foundry VTT** v11/v12, DSA5 system + Ulisses premium compendiums
- **ES Modules** via `esmodules` in module.json
- **Vite** for bundling
- **pnpm** as package manager
- **Vitest** for unit tests (parser logic runs outside Foundry)
- **Nix flake + direnv** for reproducible dev environment

---

## User Flow

1. GM clicks toolbar button → `ImportDialog` opens
2. Dialog has three text areas: **Stats**, **Fluff**, **Gossip**
3. GM pastes each section from the PDF and clicks Import
4. Each section is cleaned then parsed
5. Parsed data is resolved against DSA5 compendiums
6. Actor is created with resolved items attached
7. `SummaryDialog` opens showing:
   - Successfully imported fields
   - Fuzzy/approximate matches (with original and matched name)
   - Missing/unresolved items
   - Equipment packs to drag from chat
8. Button in summary dialog opens the newly created actor

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

---

## Data Models

### Stats Parser Output

```js
{
  name: String,
  attributes: { MU, KL, IN, CH, FF, GE, KO, KK },          // all Numbers
  derived:    { LeP, Asp, KaP, INI, AW, SK, ZK, GS, Schip }, // Numbers; INI stored as "12+1W6"
  weapons: [
    { name: String, AT: Number|null, PA: Number|null, FK: Number|null }
  ],
  armor: [String],                                            // names only for compendium lookup
  sozialstatus: String,
  sonderfertigkeiten: [String],
  sprachen: [String],
  schriften: [String],
  vorteile: [String],
  nachteile: [String],
  kampftechniken: [{ name: String, value: Number, atPa: [Number] }],
  talente: {
    Körper:      [{ name: String, value: Number, spezialisierung: String|null }],
    Gesellschaft:[{ name: String, value: Number }],
    Natur:       [{ name: String, value: Number }],
    Wissen:      [{ name: String, value: Number }],
    Handwerk:    [{ name: String, value: Number }]
  },
  kampfverhalten: String,  // prose → GM notes
  flucht: String           // prose → GM notes
}
```

### Fluff Parser Output

```js
{
  npcCategory: String,  // "Turm" | "Springer" | "Bauer" | "Läufer"
  titel: String,        // e.g. "Schitze"
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

Searches DSA5 system + Ulisses premium compendiums by name for:
- Weapons → added as items to actor
- Armor → added as items to actor
- Sonderfertigkeiten, Vorteile, Nachteile → added as items
- Kampftechniken, Talente → matched to existing system entries

**Item categories:**
- **Resolved:** exact name match → added to actor
- **Equipment packs:** matched as a pack (not individual items) → offered as chat drag
- **Unresolved:** no match found → flagged in summary dialog

AT/PA values from weapon entries are used as hints to infer Kampftechnik values when not separately listed.

---

## Actor Construction (`actor-builder.js`)

1. Create NPC actor with name from fluff (or stats if fluff empty)
2. Set attributes and derived values from stats
3. Set Kampftechnik and Talent values
4. Attach resolved compendium items (weapons, armor, abilities, etc.)
5. Write GM notes (biography field) containing:
   - NPC category icon name + label
   - All fluff fields (labeled prose)
   - Kampfverhalten + Flucht
   - Gossip entries (labeled, inline markers preserved)
6. Store `npcCategory` as actor flag for potential filtering

---

## Summary Dialog

Shows after actor creation:

- **Imported:** list of successfully resolved fields and items
- **Approximate matches:** "Matched 'Finte I' to 'Finte I' (fuzzy)"
- **Missing:** items not found in any compendium
- **Packs:** equipment packs available as chat drag
- **Open Actor** button

---

## Testing

- **Vitest** for all parser and cleaner unit tests
- Test fixtures are raw `.txt` files extracted from real PDFs
- Tests cover: ligature normalization, multi-line reassembly, weapon detection, talent block parsing, gossip inline markers, NPC category mapping
- Additional fixture files will be added from GM-provided PDFs before implementation

---

## Out of Scope

- Parsing player character sheets
- Importing from structured file formats (JSON, XML)
- LLM-assisted parsing
- Automatic token image assignment
