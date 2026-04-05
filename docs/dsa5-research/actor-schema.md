# DSA5 Actor Schema
Source: dsa5-optolith module analysis (https://github.com/Plushtoast/dsa5-optolith)
Date: 2026-04-05
Status: Derived from reference module — verify NPC-specific fields via DevTools

## Actor Types
- `"character"` — player characters (confirmed from optolith module)
- NPC/creature type unknown — verify via `game.system.documentTypes.Actor`

## Actor Creation
```js
const actor = await game.dsa5.entities.Actordsa5.create({ name, type, system })
```

## Attributes (system.characteristics)
```
system.characteristics.mu.advances — Number — Mut
system.characteristics.kl.advances — Number — Klugheit
system.characteristics.in.advances — Number — Intuition
system.characteristics.ch.advances — Number — Charisma
system.characteristics.ff.advances — Number — Fingerfertigkeit
system.characteristics.ge.advances — Number — Gewandtheit
system.characteristics.ko.advances — Number — Konstitution
system.characteristics.kk.advances — Number — Körperkraft
```
Note: `advances` = points above base 8.

## Status / Derived Values (system.status)
```
system.status.wounds.advances       — Number — LeP advances
system.status.wounds.initial        — Number — from species base values
system.status.wounds.value          — Number — set to max after creation
system.status.astralenergy.advances — Number — AsP advances (0 if no magic)
system.status.karmaenergy.advances  — Number — KaP advances (0 if no karma)
system.status.soulpower.initial     — Number — SK, from species base values
system.status.toughness.initial     — Number — ZK, from species base values
system.status.speed.initial         — Number — GS, from species base values
```
⚠ INI and AW field paths not confirmed — verify via DevTools.
⚠ Schip field path not confirmed — verify via DevTools.

## Details (system.details)
```
system.details.age.value              — String
system.details.species.value          — String — species name
system.details.gender.value           — String
system.details.culture.value          — String — culture name
system.details.career.value           — String — profession name
system.details.socialstate.value      — String — Sozialstatus
system.details.biography.value        — String — HTML, used for GM notes / import errors
system.details.home.value             — String
system.details.family.value           — String
system.details.haircolor.value        — String
system.details.eyecolor.value         — String
system.details.distinguishingmark.value — String
system.details.height.value           — String
system.details.weight.value           — String
system.details.experience.total       — Number — AP total
```

## Embedded Document Operations
```js
// Update existing items (skills, combat skills already on actor from species defaults)
await actor.updateEmbeddedDocuments("Item", [{ _id, system: { talentValue: { value } } }])

// Create new items from compendium objects
await actor.createEmbeddedDocuments("Item", [itemObj, ...])

// Update actor fields after creation
await actor.update({ system: { ... } })
```
