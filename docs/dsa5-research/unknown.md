# Unresolved / Needs DevTools Verification
Date: 2026-04-05

These field paths and behaviors are assumed in the spec but not yet confirmed against a live Foundry v13 + DSA5 instance.

## Actor Type for NPCs
- Assumed: some NPC/creature type distinct from `"character"`
- Verify: `game.system.documentTypes.Actor`

## INI Field Path
- Assumed: split into `base` + `dice` (e.g. `system.status.ini.base` + `system.status.ini.dice`)
- Verify: inspect a created NPC

## AW (Ausweichen) Field Path
- Not found in optolith module (only used for player characters with dodge skill)
- Verify: inspect NPC actor

## Schip (Schicksalspunkte) Field Path
- Not found in optolith module
- Verify: inspect NPC actor — likely `system.status.fatePoints` or similar

## NPC-specific fields vs character fields
- optolith module only creates `"character"` type actors
- NPC actors may use different field paths for attributes/status
- Verify by creating a test NPC manually and inspecting `.system`

## Skills/Combat Skills on NPCs
- For player characters, skills are pre-added by the species item and then updated
- For NPCs, it's unclear if skills are pre-populated or must be created fresh
- Verify: create blank NPC and inspect `.items`

## Kompendium Pack IDs for Ulisses Premium Modules
- Pack IDs depend on installed modules — not derivable from source analysis
- Verify: `game.packs.map(p => p.collection)` in live instance

## Equipment Pack Detection
- Assumed: `item.type === "equipment"` + name contains "paket" OR `item.system.pack === true`
- Verify: inspect a known Ausrüstungspaket item from Ulisses compendiums
