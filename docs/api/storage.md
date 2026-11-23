# Storage network

`src/game/storage.ts` (pure rules), `Simulation.storageNetwork / crateLabel / setCrateLabel`, the crate screen's "Storage network" drawer.

- A crate's `label` (`MachineEntity.label`, saved with the entity; absent = unlabelled) is a category (`CATEGORY_LABELS`: tools, food,
  materials, fuel, blocks, machines, misc) or one item key.
- `chestsFor` ranks chests for an item: exact-item label, category label, an unlabelled chest already holding it, any unlabelled one.
  A chest labelled for something else never takes it. `sortInto`, `sortPack(inv, chests, from)` (keeps durability and quality) move items.
- The network of a crate is every crate within `NETWORK_RADIUS` (12) of it. The crate screen has a label picker, a "Sort my pack into
  chests" button (skips the hotbar) and a contents list (`contents`: item totals and which labelled chests hold them).
- Not done: automatic sorting of what machines output (they still push to touching crates as before).
