# DSA5 Actor Schema
Source: dsa5-optolith module analysis + live DSA5 system v7.5.0 source code inspection
Date: 2026-04-05
Status: VERIFIED against DSA5 system v7.5.0 source code (system.json + data model files)

## Actor Types
All three types confirmed from `game.system.documentTypes.Actor` (system.json):
- `"character"` — player characters
- `"npc"` — NPCs (uses CharacteristicsTemplate + DetailsTemplate + StatusTemplate + MagicTemplate)
- `"creature"` — monsters/creatures (uses CharacteristicsTemplate + StatusTemplate + MagicTemplate, NO DetailsTemplate)

Key difference: `creature` type lacks `system.details.*` fields (species, gender, career, etc.).
`npc` type has full `details` template, same as `character`.

## Actor Creation
```js
// game.dsa5.entities.Actordsa5 is registered as CONFIG.Actor.documentClass
const actor = await Actor.create({ name, type, system })
// or equivalently:
const actor = await game.dsa5.entities.Actordsa5.create({ name, type, system })
```

Note: `_preCreate` hook only adds default token settings for `character` type. No items are pre-populated
for any actor type on creation — skills/combat skills must be created via `createEmbeddedDocuments`.

## Attributes (system.characteristics) — all actor types
```
system.characteristics.mu.advances — Number — Mut (base 8 + advances = value)
system.characteristics.kl.advances — Number — Klugheit
system.characteristics.in.advances — Number — Intuition
system.characteristics.ch.advances — Number — Charisma
system.characteristics.ff.advances — Number — Fingerfertigkeit
system.characteristics.ge.advances — Number — Gewandtheit
system.characteristics.ko.advances — Number — Konstitution
system.characteristics.kk.advances — Number — Körperkraft
```
Note: `advances` = points above the `initial` value. `initial` defaults to 8.
Derived `value` = `initial + advances + modifier + gearmodifier` (calculated in `prepareDerivedData`).

For creature-type actors with fixed attribute values, set `system.characteristics.XX.initial` directly
and leave `advances = 0`.

## Status / Derived Values (system.status)
All fields confirmed from `StatusTemplate.defineSchema()`:

### Wounds (LeP)
```
system.status.wounds.initial   — Number — base LeP value
system.status.wounds.advances  — Number — AP-bought advances (0 for NPCs/creatures)
system.status.wounds.modifier  — Number — situational modifier
system.status.wounds.value     — Number (DSANumberField) — current tracked value
system.status.wounds.max       — Number — computed max (do not set directly)
```
For character/npc: `wounds.current = wounds.initial + ko.value * 2` (computed)
For creature: `wounds.current = wounds.initial` (set directly)

### Initiative (INI) — CONFIRMED
```
system.status.initiative.current    — Number — base INI value (set this for creatures)
system.status.initiative.modifier   — Number — modifier
system.status.initiative.die        — String — dice string, default "1d6", choices: DSA5.initDies
system.status.initiative.diemodifier — String
```
For character/npc: `initiative.value = round((mu + ge) / 2) + modifier` (computed from characteristics)
For creature: `initiative.value = initiative.current + modifier` (set `current` directly)

### Dodge / AW (Ausweichen) — CONFIRMED
```
system.status.dodge.value    — Number — computed from ge/2 (do not set directly for char/npc)
system.status.dodge.modifier — Number — modifier (set this to adjust)
system.status.dodge.max      — Number — computed: dodge.value + dodge.modifier + higherDefense/2
```
Formula: `dodge.value = round(ge.value / 2) + dodge.gearmodifier`

### Fate Points / Schip (Schicksalspunkte) — CONFIRMED
```
system.status.fatePoints.value    — Number — stored fate points (default 3)
system.status.fatePoints.current  — Number — base fate points (default 3)
system.status.fatePoints.modifier — Number — modifier
system.status.fatePoints.max      — Number — computed: current + modifier + gearmodifier
```
To set Schip for imported NPCs: `system.status.fatePoints.current = N`

### Soul Power / SK (Seelenkraft)
```
system.status.soulpower.initial  — Number — species base value
system.status.soulpower.value    — Number — computed: initial + round((mu+kl+in)/6)
system.status.soulpower.modifier — Number
```

### Toughness / ZK (Zähigkeit)
```
system.status.toughness.initial  — Number — species base value
system.status.toughness.value    — Number — computed: initial + round((ko+ko+kk)/6)
system.status.toughness.modifier — Number
```

### Speed / GS (Geschwindigkeit)
```
system.status.speed.initial  — Number — base land speed
system.status.speed.water    — Number — water speed (0 = uses formula)
system.status.speed.air      — Number — air speed (0 = none)
system.status.speed.modifier — Number
```

### Astral Energy (AsP) and Karma Energy (KaP)
```
system.status.astralenergy.initial  — Number — base value
system.status.astralenergy.advances — Number — AP-bought advances
system.status.karmaenergy.initial   — Number — base value
system.status.karmaenergy.advances  — Number — AP-bought advances
```

## Creature-specific fields (system.*) — creature type only
```
system.description.value     — HTML — creature description
system.behaviour.value       — HTML — behaviour description (note: NOT "behavior")
system.flight.value          — HTML — flight rules
system.specialRules.value    — HTML — special rules
system.creatureClass.value   — String — creature class
system.conjuringDifficulty.value — Number — summoning difficulty
system.actionCount.value     — Number — actions per round (default 1)
system.count.value           — String — swarm count (default "1")
```

## Details (system.details) — character and npc types only
```
system.details.age.value              — String
system.details.species.value          — String — species name
system.details.gender.value           — String
system.details.culture.value          — String — culture name
system.details.career.value           — String — profession name
system.details.socialstate.value      — Number — 0-5 (not String!)
system.details.biography.value        — HTML — biography
system.details.notes.value            — HTML — GM/player notes
system.details.notes.gmdescription    — HTML — GM notes
system.details.notes.ownerdescription — HTML — owner-visible notes
system.details.Home.value             — String (capital H)
system.details.family.value           — String
system.details.haircolor.value        — String
system.details.eyecolor.value         — String
system.details.distinguishingmark.value — String
system.details.height.value           — String
system.details.weight.value           — String
system.details.experience.total       — Number — AP total
system.details.experience.spent       — Number — AP spent
```
Note: field is `system.details.Home.value` (capital H), not `home`.

## Embedded Document Operations
```js
// NPCs/creatures have NO pre-populated skills — must create fresh
await actor.createEmbeddedDocuments("Item", [skillObj, combatSkillObj, ...])

// Update existing items by _id
await actor.updateEmbeddedDocuments("Item", [{ _id, system: { talentValue: { value: N } } }])

// Update actor fields after creation
await actor.update({ system: { ... } })
```
