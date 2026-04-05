# DSA5 Item Types & Field Paths
Source: dsa5-optolith module analysis
Date: 2026-04-05

## Item Types

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

## Key Item Field Paths

```
system.talentValue.value  — Number — skill/combat skill value
system.step.value         — Number — tier for advantages/disadvantages/special abilities
system.quantity.value     — Number — item quantity/amount
system.max.value          — Number — max tier cap (advantages/abilities)
system.maxRank.value      — Number — alternative max tier cap
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
