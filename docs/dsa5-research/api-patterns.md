# DSA5 API Patterns
Source: dsa5-optolith module analysis
Date: 2026-04-05

## Compendium Item Lookup

```js
// Must call once before item lookups
await game.dsa5.itemLibrary.buildEquipmentIndex()

// Look up item by name and type — returns array, filter by type
const results = await game.dsa5.itemLibrary.findCompendiumItem(germanName, itemType)
const item = results?.find(x => x.type === itemType)
if (item) {
  const obj = item.toObject()  // clone before modifying
  // modify obj.system fields as needed
}
```

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
// 1. Create actor shell
const actor = await game.dsa5.entities.Actordsa5.create({ name, type, system })

// 2. Update existing embedded items (skills/combat skills added by species)
await actor.updateEmbeddedDocuments("Item", updates)  // updates = [{ _id, system: {...} }]

// 3. Create new embedded items from compendium
await actor.createEmbeddedDocuments("Item", creations)  // creations = [itemObj, ...]

// 4. Final actor update (status values, biography/GM notes)
await actor.update({ system: { ... } })
```

## Folder Utility

```js
// Get or create a folder for imported actors
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

// DSA5 system metadata
CONFIG.DSA5

// All compendium packs with types
game.packs.map(p => ({ id: p.collection, type: p.documentClass.documentName }))

// Inspect a specific actor's system data
game.actors.getName("Test NPC").system

// Inspect all items on an actor
game.actors.getName("Test NPC").items.map(i => ({ name: i.name, type: i.type, system: i.system }))
```

## Notes
- All compendium name lookups use **German** names
- `getProperty(obj, "system.max.value")` is the Foundry utility for safe nested access
- Skills and combat skills are pre-created on the actor by the species item — use `updateEmbeddedDocuments` to set their values, not `createEmbeddedDocuments`
