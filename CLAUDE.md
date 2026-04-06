# DSA5 Statblock Importer — Claude Guidelines

## Testing

**Always test when working on a feature:**

- Run `nix develop --command pnpm test` before starting and after finishing any change.
- Add **Vitest unit tests** for any new parser logic (in `tests/`), in the same commit as the code.
- Add or update **Playwright e2e tests** for any change that touches the Foundry UI flow (import dialog → review dialog → actor creation). E2e tests run locally against the Docker Foundry instance (`localhost:30000`), not in CI.
- Do not commit a feature without a test that would have caught a regression in it.

## Dev environment

- Build: `nix develop --command pnpm build`
- Unit tests: `nix develop --command pnpm test`
- E2e tests: `nix develop --command pnpm test:e2e` (requires Docker Foundry running)
- Start Foundry: `docker-compose up -d` from the project root
- Nix flake provides Node.js 22 + pnpm

## Module structure

- `src/` — source modules (bundled by Vite into `dist/`)
- `src/parser/` — pure JS parsers (no Foundry dependency, fully unit-testable)
- `templates/` — Handlebars templates served directly by Foundry
- `languages/` — i18n JSON files (de.json + en.json)
- `tests/` — Vitest unit tests + Playwright e2e tests
- `tests/fixtures/` — raw statblock text fixtures; `tests/fixtures/expected/` — expected JSON outputs

## Source files

### `src/main.js`
Module entry point. Listens to `renderActorDirectory` hook and injects "Import Statblock" button.

**Foundry v13 gotcha**: v13 passes native `HTMLElement` to hooks, not jQuery. Code detects this:
```js
const root = html instanceof HTMLElement ? html : html[0]
```
Then uses native DOM (`querySelector`, `append`, `addEventListener`). The Application class itself still uses jQuery internally.

### `src/import-dialog.js`
Initial import dialog (Foundry `Application` subclass). Three textarea inputs for stats/fluff/gossip sections. On "Analyse": calls `clean()` → `parseStats()` → `parseFluff()` → `parseGossip()` → `resolveAll()` → opens ReviewDialog.

### `src/review-dialog.js`
Review and edit parsed data before actor creation. Shows all 8 attributes as editable inputs. Shows compendium resolution summary: resolved (green), approximate matches (yellow), missing items (red), equipment packs (info). `getData()` builds full name from `[fluff.titel, fluff.name].filter(Boolean).join(' ')`.

### `src/actor-builder.js`
Builds Foundry NPC actor from reviewed state.

**LeP formula** (non-obvious): DSA5 system computes `LeP_base = KO + KK`. The `wounds.initial` field is **additive** on top of that base (total = base + initial). So we store only the delta:
```js
const systemLePBase = koVal + kkVal
const woundsInitial = parsedLeP !== null ? Math.max(0, parsedLeP - systemLePBase) : 0
```
Storing absolute LeP in `wounds.initial` would double-count KO+KK and produce absurdly high max HP.

Attributes are stored as "advances" (DSA5 base is 8): `adv = value - 8`.

Creates embedded Item documents for weapons/armor/abilities/skills. Builds rich HTML biography from fluff + gossip.

### `src/compendium-resolver.js`
Fuzzy-matches item names to DSA5 compendiums.

**Matching pipeline** for each item:
1. Exact case-insensitive match → `matchType: 'exact'`
2. Levenshtein distance ≤ 2 on normalized names → `matchType: 'approximate'`
3. Specialization-stripped match: "Ortskenntnis (Festum)" → "Ortskenntnis" → distance ≤ 2 → `matchType: 'approximate'`
4. None found → `missing`

**Roman numeral retry**: If search for "Gutaussehend I" returns nothing, retries with "Gutaussehend" (tier suffix stripped).

**German compendium naming conventions** (the compendium stores items differently than statblocks):
- Languages: statblock "Muttersprache Goblinisch III" → search `"Sprache (Goblinisch)"` (strip prefix + Roman numeral, wrap in "Sprache ()")
- Scripts: statblock "Kusliker Zeichen" → search `"Schrift (Kusliker Zeichen)"`
- SF (Sonderfertigkeiten): "Ortskenntnis (Festum)" → base name "Ortskenntnis" for lookup (compendium doesn't include specialization)

**Special filters** (must not be looked up):
- `"Waffenlos"` (unarmed combat): Not a weapon item. Handled by Raufen combat skill.
- `"Keine"` (armor field): Means no armor. Skip.
- `"keine"` (disadvantages, lowercase): Means none. Skip.

**Equipment packs**: Items with `type === 'equipment'` and name containing "paket" or `system.pack === true` are collected separately (player drags from chat).

Compendium index built lazily on first call. World must be German (`game.world.data.lang === 'de'`) for compendium lookups to match — DSA5 compendiums are German-only.

## Parser files (`src/parser/`)

All parsers are **pure JS with zero Foundry dependency**. This is intentional — enables 100% unit test coverage without mocking. Never add Foundry API calls here.

### `cleaner.js`
Normalizes raw PDF text. Handles: ligature replacement (ﬀ→ff, ﬁ→fi, etc.), soft hyphens, en-dash/em-dash → hyphen, multi-space collapse, stray page number removal (lone numeric lines), paragraph normalization.

### `stats-parser.js` (key logic)

- **Name**: Lines before first attribute line. Strips leading category digit: `/^\d+\s*/`.
- **Attributes**: Scans all attribute-containing lines with `matchAll`, merges results. Attributes can span 2+ lines.
- **Derived stats**: `LeP`, `AW`, `SK`, `ZK`, `GS` as plain numbers. `Asp`/`KaP` nullable — both `–` (U+2013 en-dash) and `-` mean null. `Schip` handles trailing 's'. `INI` parsed as `{base, dice}` from "14+1W6".
- **Weapons**: Lines matching `/\b(?:AT|FK)\s+\d/`. Dash PA means null (not 0).
- **Armor**: `RS/BE: N/N (Name)` or `RS/BE: N/N`. No name → `{name: 'Keine'}`.
- **Kampftechniken**: Comma-separated "Name 12 (13/9)".
- **Talente**: Category headers (Körper/Gesellschaft/Natur/Wissen/Handwerk/Sonstige). Supports specialization: "Heilkunde (Wunden) 5". Unknown category → Sonstige (silently).
- **`parseCommaList()`**: Splits on commas **outside parentheses only** (depth counter). Critical for entries like "Vorurteil (Elfen, Zwerge), Angststörung". Never use naive `.split(',')` for these fields.

### `fluff-parser.js`
First line: `[digit] [titel] [name]` where digit 1–4 maps to NPC category (Bauer/Springer/Turm/Läufer). Extracts anchor blocks (Kurzcharakteristik, Motivation, Agenda, Funktion, Hintergrund, Feindbilder, Darstellung, Schicksal, Besonderheiten). Lines starting with `»` are Zitate (quotes).

### `gossip-parser.js`
Extracts subject from "Gerüchte über [Name]" header. Lines starting with `»` delimit entries; continuation lines are merged with the previous entry.

## Test files

- `tests/cleaner.test.js` — cleaner normalization
- `tests/stats-parser.test.js` — comprehensive parser coverage (250+ assertions)
- `tests/fluff-parser.test.js` — fluff parsing, all blocks
- `tests/gossip-parser.test.js` — gossip parsing
- `tests/fixtures.test.js` — smoke test with real fixture file

Vitest is configured with **100% coverage thresholds** on `src/parser/**`. Any branch left uncovered will fail CI.

## Non-obvious gotchas

1. **Foundry v13 hook argument**: v13 passes `HTMLElement`, not jQuery. Use native DOM in hook handlers.
2. **`wounds.initial` is additive**: Stores `parsedLeP - (KO + KK)`, not absolute LeP.
3. **Attributes to advances**: DSA5 system stores `value - 8` in `advances` field; raw stat values go nowhere.
4. **German world required**: Compendium lookups silently fail if world language is English.
5. **Sprache(X) / Schrift(X) naming**: Compendium wraps language/script names in these prefixes.
6. **Roman numeral tier stripping**: "Gutaussehend I" must be retried as "Gutaussehend" on empty result.
7. **SF specialization stripping**: "Ortskenntnis (Festum)" → lookup "Ortskenntnis". Distance calculated on stripped names.
8. **parseCommaList depth tracking**: Always use this, never naive `.split(',')` for SF/Vorteile/Nachteile/etc.
9. **Waffenlos / Keine filtering**: These are sentinel values, not real items to look up.
10. **En-dash vs hyphen in Asp/KaP**: Statblocks use `–` (U+2013), must handle alongside `-`.
11. **Compendium index no auto-refresh**: Built once; requires module reload if packs change.
12. **Talent typos → Sonstige**: Category mismatches silently dump talents into Sonstige.
13. **Multi-line attributes**: Parser uses `matchAll` on each line; attributes can appear on different lines.
14. **INI dice format**: Parsed as `{base, dice}` object, not a number. Actor builder uses `INI.base`.
