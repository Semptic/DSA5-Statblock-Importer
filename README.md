# DSA5 Statblock Importer

A [Foundry VTT](https://foundryvtt.com/) module that imports DSA5 NPC statblocks from PDF text into fully configured actors — attributes, combat skills, talents, special abilities, advantages, disadvantages, weapons, armor, and biography all in one step.

**Requires:** Foundry VTT v13+ · DSA5 system · German-language DSA5 compendiums

---

## Features

- Paste raw statblock text copied from DSA5 adventure PDFs
- Parses all NPC data: attributes, derived values, weapons, armor, combat techniques, talents, special abilities, advantages, disadvantages, languages, and scripts
- Fuzzy-matches items against installed DSA5 compendiums (exact → Levenshtein approximate → missing)
- Review and edit everything before creating the actor
- Override any compendium match by dragging the correct item into the review dialog
- Drag Spezies, Kultur, and Profession items from the compendium (or type a free-text profession name)
- Builds rich GM notes from the fluff and gossip sections of the statblock
- Equipment packs are flagged in chat for manual assignment

---

## Installation

Install via the Foundry module manager using the manifest URL:

```
https://raw.githubusercontent.com/Semptic/DSA5-Statblock-Importer/main/module.json
```

Or download the repository and place it in your `Data/modules/dsa5-statblock-importer/` directory.

---

## Usage

1. Open the **Actors** sidebar in Foundry.
2. Click the **Statblock importieren** button at the top.
3. Paste the statblock text into the three sections:
   - **Stats** — the attribute/combat block
   - **Fluff** — background, motivation, appearance
   - **Gerüchte** — gossip entries (optional)
4. Click **Analysieren**. The module parses the text and resolves compendium items.
5. In the review dialog:
   - Edit attributes or comma-separated lists directly
   - Drag compendium items onto any row to override a match
   - Drag or type Spezies, Kultur, and Profession in the Herkunft section
   - Click **Neu analysieren** to re-resolve after edits
6. Click **Erstellen** to create the actor and open its sheet.

---

## Statblock Format

The importer expects the standard DSA5 statblock layout as found in official Pegasus Press adventures (copy-pasted from PDF). Example:

```
Jaruslaw von Kirschhausen
MU 13 KL 10 IN 11 CH 12 FF 11 GE 13 KO 15 KK 15
LeP 42 AsP – KaP – INI 14+1W6 AW 6 SK 1 ZK 2 GS 8
Schips: 3
RS/BE: 4/1 (Schuppenrüstung)
Langschwert: AT 14 PA 9 TP 1W6+4 RW kurz
Kampftechniken: Schwerter 14 (15/9), Lanzen 12 (13/-)
Vorteile: Adel, Hohe Lebenskraft I
Nachteile: Persönlichkeitsschwäche (Eitelkeit)
SF: Wuchtschlag, Finte, Berittener Kampf
Talente: Reiten 12, Etikette 10
```

---

## Development

### Prerequisites

- [Nix](https://nixos.org/) with flakes enabled (provides Node.js 22 + pnpm)
- Docker (for e2e tests against a local Foundry instance)

### Commands

```bash
# Install dependencies
nix develop --command pnpm install

# Build
nix develop --command pnpm build

# Unit tests (pure parser logic, no Foundry needed)
nix develop --command pnpm test

# Unit tests with coverage (100% threshold on src/parser/**)
nix develop --command pnpm test:coverage

# E2e tests (requires Foundry running via docker-compose)
docker-compose up -d
nix develop --command pnpm test:e2e
```

### Project Structure

```
src/
  main.js               # Entry point, injects sidebar button
  import-dialog.js      # Initial paste dialog
  review-dialog.js      # Review/edit before actor creation
  actor-builder.js      # Builds Foundry NPC actor from parsed data
  compendium-resolver.js # Fuzzy-matches names to DSA5 compendiums
  parser/
    cleaner.js          # PDF text normalization
    stats-parser.js     # Attribute, weapon, talent, SF parsing
    fluff-parser.js     # Background/motivation text parsing
    gossip-parser.js    # Gerüchte section parsing
templates/              # Handlebars templates
languages/              # i18n (de.json, en.json)
tests/                  # Vitest unit tests + Playwright e2e tests
  fixtures/             # Raw statblock text fixtures
  fixtures/expected/    # Expected JSON outputs
```

### Adding Tests

Unit tests live in `tests/` and cover `src/parser/**` at 100% branch coverage. Add a test case whenever parser logic changes. E2e tests use Playwright against a local Foundry Docker instance and cover the full import dialog → review dialog → actor creation flow.

---

## License

[MIT](LICENSE)
