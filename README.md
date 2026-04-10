# DSA5 Statblock Importer

A [Foundry VTT](https://foundryvtt.com/) module that imports DSA5 NPC statblocks from PDF text into fully configured actors — attributes, combat skills, talents, special abilities, advantages, disadvantages, weapons, armor, and biography all in one step.

**Requires:** Foundry VTT v13+ · DSA5 system · German-language DSA5 compendiums

![Demo](docs/assets/example.gif)

---

## Features

- Paste raw statblock text copied from DSA5 adventure PDFs
- Parses all NPC data: attributes, derived values, weapons, armor, combat techniques, talents, special abilities, advantages, disadvantages, languages, and scripts
- Fuzzy-matches items against installed DSA5 compendiums (exact → Levenshtein approximate → missing)
- Review and edit everything before creating the actor
- Override any compendium match by dragging the correct item into the review dialog
- Drag Spezies, Kultur, and Profession items from the compendium (or type a free-text profession name)
- Builds rich GM notes from the fluff and gossip sections of the statblock

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
Swafrieda Eldridsdottir
MU 12 KL 11 IN 12 CH 11
FF 11 GE 12 KO 11 KK 10
LeP 27 AsP– KaP– INI 12+1W6
SK1 ZK 0 AW6 GS8
Waffenlos: AT 10 PA6 TP 1W6 RW kurz
Messer: AT 10 PA4 TP 1W6+1 RWkurz
Kurzbogen: FK 10 LZ1 TP 1W6+4 RW10/50/80
RS/BE 0/0
Sonderfertigkeiten: keine
Vorteile/Nachteile: Schlechte Eigenschaft (Rachsucht)
Talente: Einschüchtern 0, Körperbeherrschung
4, Kraftakt 2, Menschenkenntnis
2, Selbstbeherrschung 2, Sinnesschärfe
4, Überreden 4, Verbergen 3,
Willenskraft 4
Kampfverhalten: Im Kampf zeigt Swafrieda
ein tollkühnes Verhalten.
Flucht: Swafrieda flieht bei drei Stufen
Schmerz.
Schmerz +1 bei: 20 LeP, 14 LeP, 7 LeP, 5 oder weniger LeP
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

# Unit tests with coverage
nix develop --command pnpm test:coverage

# E2e tests (requires Foundry running via docker-compose)
docker-compose up -d
nix develop --command pnpm test:e2e
```

---

## License

[Apache 2.0](LICENSE)
