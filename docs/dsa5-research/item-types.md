# DSA5 Item Types & Field Paths
Source: dsa5-optolith module analysis + DSA5 system v7.5.0 source code inspection
Date: 2026-04-05

## Item Types

All types confirmed from `game.system.documentTypes.Item` (system.json v7.5.0):

| Foundry type | DSA5 category | Notes |
|---|---|---|
| `meleeweapon` | Nahkampfwaffe | equipment group gr=1 |
| `rangeweapon` | Fernkampfwaffe | equipment group gr=2 |
| `ammunition` | Munition | equipment group gr=3 |
| `armor` | Rüstung | equipment group gr=4 |
| `consumable` | Verbrauchsgut | equipment group gr=20 |
| `poison` | Gift | equipment group gr=21 |
| `plant` | Pflanze | equipment group gr=22 |
| `equipment` | Ausrüstung | all other equipment groups |
| `skill` | Talent | regular talents |
| `combatskill` | Kampftechnik | combat techniques |
| `trait` | Tierische Attacke / creature attack | creature attack/ability items |
| `spell` | Zauber | spells |
| `ritual` | Ritual | rituals (fallback for spell lookups) |
| `liturgy` | Liturgie | liturgies |
| `ceremony` | Zeremonie | ceremonies (fallback for liturgy lookups) |
| `advantage` | Vorteil | advantages |
| `disadvantage` | Nachteil | disadvantages |
| `specialability` | Sonderfertigkeit | special abilities |
| `magictrick` | Zaubertrick | cantrips |
| `blessing` | Segen | blessings |
| `spellextension` | Zaubermodifikation | spell enhancements (SA_414) |
| `money` | Geld | currency items |
| `species` | Spezies | used for base values only |
| `career` | Profession | profession definition |
| `culture` | Kultur | culture definition |
| `aggregatedTest` | Sammelprobe | group skill check |
| `disease` | Krankheit | diseases |
| `application` | Anwendung | skill applications |
| `effectwrapper` | Effektgruppe | grouped effects |
| `magicalsign` | Magisches Zeichen | magical signs |
| `demonmark` | Dämonenmahl | demon marks |
| `patron` | Patron | patron spirits |
| `information` | Information | informational items |
| `essence` | Essenz | essences |
| `imprint` | Prägung | imprints |
| `book` | Buch | books |
| `trap` | Falle | traps |

## Key Item Field Paths

### Skill (confirmed from data/item/skill.js)
```
system.talentValue.value    — Number — skill value (FW, default 0)
system.group.value          — String — skill group ("body", "social", "knowledge", "crafts", "nature")
system.characteristic1.value — String — first attribute abbreviation ("mu", "kl", etc.)
system.characteristic2.value — String — second attribute abbreviation
system.characteristic3.value — String — third attribute abbreviation
system.burden.value         — String — encumbrance ("yes", "no", "maybe")
```

### Combat Skill (confirmed from data/item/combatskill.js)
```
system.talentValue.value  — Number — base value (FW, default 6)
system.attack.value       — Number — computed attack value
system.parry.value        — Number — computed parry value
system.guidevalue.value   — String — guide characteristic ("ff", "ge", etc.)
system.weapontype.value   — Number — 0=melee, 1=ranged
```

### Trait (creature attack/ability — confirmed from data/item/trait.js)
```
system.traitType.value    — String — "meleeAttack", "rangeAttack", "armor", "general", etc.
system.at.value           — String — attack value (may be string like "12")
system.pa                 — Number — parry value (note: NOT nested in .value)
system.reach.value        — String — reach category
system.damage.value       — String — damage formula (e.g. "1d6+4")
system.reloadTime.value   — String — reload time
system.effect.value       — String — effect description (used for gear modifiers)
system.step.value         — Number — tier/step value
```

### General Fields
```
system.step.value         — Number — tier for advantages/disadvantages/special abilities
system.quantity.value     — Number — item quantity/amount
system.max.value          — Number — max tier cap (advantages/abilities)
system.maxRank.value      — Number — alternative max tier cap
system.description.value  — HTML — item description
system.gmdescription.value — HTML — GM-only description
```

## Parameterized Ability Names
Some abilities have dynamic content in parentheses, e.g. `"Begabung (Klettern)"`.
- Template in compendium: `"Begabung ()"`
- To set: `obj.name = obj.name.split(" (")[0] + " (" + skillName + ")"`

## Equipment Group → Item Type Mapping
```js
const type = {
  1: "meleeweapon",
  2: "rangeweapon",
  3: "ammunition",
  4: "armor",
  20: "consumable",
  21: "poison",
  22: "plant"
}[item.gr] || "equipment"
```
