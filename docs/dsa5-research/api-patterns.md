# DSA5 API Patterns
Source: dsa5-optolith module analysis + DSA5 system v7.5.0 source code inspection
Date: 2026-04-05

## Compendium Item Lookup

```js
// buildEquipmentIndex() calls buildItemIndex() internally
// findCompendiumItem() also calls buildItemIndex() — explicit pre-call is optional but harmless
await game.dsa5.itemLibrary.buildEquipmentIndex()

// Look up item by name and type — returns array of full Item documents
// filterCompendium=true (default) means only items from compendium packs, not world items
const results = await game.dsa5.itemLibrary.findCompendiumItem(germanName, itemType)
// results sorted: non-core packs first, then dsa5-core packs
const item = results?.find(x => x.type === itemType)
if (item) {
  const obj = item.toObject()  // clone before modifying
  // modify obj.system fields as needed
}
```

Signature: `findCompendiumItem(search, category, filterCompendium = true)`
- `search` — German name string (exact match via index)
- `category` — item type string (e.g. "meleeweapon", "skill")
- Returns `Promise<Item[]>` — full document objects via `fromUuid()`

## Fallback Lookup Patterns

```js
// Weapons can exist as meleeweapon or rangeweapon
let find = await game.dsa5.itemLibrary.findCompendiumItem(name, "meleeweapon")
if (!find?.find(x => x.type === "meleeweapon")) {
  find = await game.dsa5.itemLibrary.findCompendiumItem(name, "rangeweapon")
}

// Spells can also be rituals
let find = await game.dsa5.itemLibrary.findCompendiumItem(name, "spell")
if (!find?.find(x => x.type === "spell")) {
  find = await game.dsa5.itemLibrary.findCompendiumItem(name, "ritual")
}
```

## Actor Creation Pattern

```js
// game.dsa5.entities.Actordsa5 IS the registered Actor document class (CONFIG.Actor.documentClass)
// Actor.create() and game.dsa5.entities.Actordsa5.create() are equivalent

// 1. Create actor shell
//    IMPORTANT: No items are pre-populated for any actor type (creature, npc, character)
const actor = await Actor.create({ name, type, system })

// 2. Create ALL embedded items from compendium (skills, combat skills, weapons, traits, etc.)
//    NPCs and creatures have NO default skills — everything must be created fresh
await actor.createEmbeddedDocuments("Item", [skillObj, combatSkillObj, weaponObj, ...])

// 3. Final actor update (status values, biography/GM notes)
await actor.update({ system: { ... } })
```

## Folder Utility

```js
// Get or create a folder for imported actors
// Signature: getFolderForType(documentType, parent=null, folderName=null, sort=0, color='', sorting=undefined)
const folder = await game.dsa5.apps.DSA5_Utility.getFolderForType("Actor", null, "FolderName")
```

## Sidebar Button (Actor Directory)

```js
// Add button to Actor Directory header — same pattern used by dsa5-optolith
Hooks.on("renderActorDirectory", (app, html, data) => {
  if (!game.user.isGM) return
  const button = $(`<button>...</button>`)
  html.find(".directory-header .action-buttons").append(button)
  button.on("click", () => { /* open dialog */ })
})
```

## Inspecting Live Data

```js
// All actor types available
game.system.documentTypes.Actor
// => { character: {...}, creature: {...}, npc: {...} }

// DSA5 system metadata
CONFIG.DSA5

// All compendium packs with types
game.packs.map(p => ({ id: p.collection, type: p.documentClass.documentName }))

// Inspect a specific actor's system data
game.actors.getName("Test NPC").system

// Inspect all items on an actor
game.actors.getName("Test NPC").items.map(i => ({ name: i.name, type: i.type, system: i.system }))
```

## game.dsa5 Object Keys (confirmed from source)
```
game.dsa5.apps          — DSA5_Utility, DSA5Dialog, DSA5StatusEffects, etc.
game.dsa5.entities      — { Actordsa5, Itemdsa5, ItemFactory }
game.dsa5.concerns      — { Actor, Item }
game.dsa5.sheets        — actor/item sheet classes
game.dsa5.wizards       — { CareerWizard, CultureWizard, SpeciesWizard }
game.dsa5.dialogs       — dialog classes
game.dsa5.macro         — MacroDSA5
game.dsa5.dataModels    — { Item, Actor, Combat, Combatant, RegionBehavior, JournalEntryPage }
game.dsa5.config        — DSA5 config object (= CONFIG.DSA5)
game.dsa5.itemLibrary   — DSA5ItemLibrary instance (set in i18nInit hook)
game.dsa5.TestSuite     — test suite
game.dsa5.memory        — RollMemory instance
```

## Notes
- All compendium name lookups use **German** names
- `getProperty(obj, "system.max.value")` is the Foundry utility for safe nested access
- Skills and combat skills are NOT pre-created on any actor type — always use `createEmbeddedDocuments`
- Compendium packs sorted by `findCompendiumItem`: non-core (Ulisses modules) first, dsa5-core last
