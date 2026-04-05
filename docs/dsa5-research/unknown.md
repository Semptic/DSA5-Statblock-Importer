# Unresolved / Needs Further Investigation
Date: 2026-04-05 (updated after DSA5 v7.5.0 source code inspection)

Most previously unknown fields have been resolved. See actor-schema.md, api-patterns.md, and compendium-packs.md.

## Remaining Unknowns

### Equipment Pack Detection
- The importer spec mentions Ausrüstungspakete (equipment bundles)
- Assumed: `item.type === "equipment"` + name contains "paket" OR `item.system.pack === true`
- Need to verify: inspect a known Ausrüstungspaket item from Ulisses compendiums
- Could check `dsa5-core.coreequipment` or `dsa5-compendium.compendiumequipment` for items named "*paket*"

## Resolved Items (kept for reference)

### Actor Type for NPCs — RESOLVED
- `"npc"` and `"creature"` are both valid types (from system.json documentTypes.Actor)
- `"npc"` has full DetailsTemplate; `"creature"` does not
- For statblock imports, use `"creature"` type for monster entries

### INI Field Path — RESOLVED
- `system.status.initiative.current` — base value (set directly for creatures)
- `system.status.initiative.modifier` — modifier
- Character/NPC: computed as `round((mu + ge) / 2) + modifier`
- Creature: `initiative.current + modifier` (creature overrides `baseInitiative()`)
- No separate "base + dice" split — `system.status.initiative.die` is dice string (default "1d6")

### AW (Ausweichen) Field Path — RESOLVED
- `system.status.dodge.modifier` — set this to adjust dodge for NPCs/creatures
- `system.status.dodge.value` is computed: `round(ge.value / 2) + gearmodifier`
- `system.status.dodge.max` is computed: `dodge.value + dodge.modifier + higherDefense/2`

### Schip (Schicksalspunkte) Field Path — RESOLVED
- `system.status.fatePoints.current` — base fate points (set to desired value)
- `system.status.fatePoints.value` — default 3 (DSANumberField, tracked value)
- `system.status.fatePoints.modifier` — modifier

### NPC-specific vs character fields — RESOLVED
- `npc` type: identical to `character` — uses same templates (Characteristics + Details + Status + Magic)
- `creature` type: no DetailsTemplate, has extra fields (description, behaviour, flight, specialRules, etc.)
- Both `npc` and `creature` share the same StatusTemplate and CharacteristicsTemplate

### Skills/Combat Skills on NPCs/Creatures — RESOLVED
- NO pre-populated items for any actor type
- `_preCreate` hook only adds token settings for `character` type
- All skills, combat skills, traits must be created via `createEmbeddedDocuments`

### Compendium Pack IDs — RESOLVED
- See compendium-packs.md for full list
