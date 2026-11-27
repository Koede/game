# Truly modular tools

## Status (built)

Built as the plan intends, with one difference in how a build is stored: every head x handle x binding combination is a real generated
item (`iron_pine_resin_pickaxe`), not an `ItemStack.parts` field, so stacks, saves, wear, enchants and mining need no new bookkeeping.
`src/content/toolParts.ts` has the materials, formulas, generated items and assembly list; `src/game/toolParts.ts` the swap rule;
`src/game/toolBuilder.ts` the builder and rework rules; `src/ui/screens/workbench/toolBuilderPanel.ts` the screen.

- Kinds: pickaxe, axe, shovel, hoe, maul. Heads: flint, bronze, iron, steel (hoes: no steel; mauls: no flint). Handles: oak, pine. Bindings: cord, resin.
- The default build (any head, oak handle = two sticks, cord) is the legacy tool, number for number (parity test); legacy keys stay valid.
- Tool Builder (workbench screen): pick tool, head, handle, binding; stats with deltas against the tool in hand; trait lines; Build.
- Rework (same panel): replace one part of a tool in the pack with one from the pack; the old part comes back; enchants, quality and share of wear kept.
  The anvil keeps its repair-by-use; part swapping lives at the workbench, where the parts are.
- Traits: each part has a trait line; resin spares a use of wear 15% of the time (`sparesWear`, one wear path in PlayerState.wearHeldTool).
- Composed icons (and so the held model, which draws the icon): head metal on the build's handle wood, resin bead at the joint. Mauls borrow their metal's icon.
- Not done: weapons beyond mauls (no swords or spears exist yet), extras slot, wire binding, glass shard.

## Goal

Every tool and weapon is built from parts, and the parts decide what it is good at. No more "bronze pickaxe" as a fixed item: a pickaxe is a
head, a handle and a binding, each made of a material with its own stats and traits. Swap a worn head, fit a rare part, and every build is a
design. This is the Tinkers' Construct idea, shaped for a phone-first, craft-and-magic game.

## What is fun

- **Designing.** Choosing a bronze head for toughness or a flint head for cheap speed, on an oak or a bone handle, is a decision with a
  visible result.
- **Repair by swapping.** A broken head is a cheap fix, not a lost tool. You keep your favourite handle.
- **Discovery.** A rare part (a golem core, a wolf fang, a glass shard) adds a trait you did not plan for.
- **Seeing it.** The held tool shows its real parts and colours; you can tell a bronze-on-oak pick from an iron-on-bone one at a glance.

## What exists (checked in the code)

- Tools are fixed items per material: `toolSet()` in `src/content/items.ts` makes `<material>_pickaxe`, `_axe`, `_shovel` from one
  `ToolSpec` (`kind`, `tier`, `speed`, `durability`, `universal?`, `fell?`), plus hoes, the maul, the hammer, weapons (`weapon`), the
  chainsaw (fuel tank), the fishing rod and shears.
- `ItemStack` carries `durability` and `quality` (1 Fine, 2 Masterwork). `src/game/toolQuality.ts` repairs worn tools at an anvil using a
  material (`REPAIR_MATERIALS`). `docs/api/tool-quality.md`.
- Inventory `sanitize`, `cloneStack`, `canMerge`, and the single wear path decide durability.
- Tool uses are one table, `src/player/toolUses.ts` (held kind by target block), and `docs/SYNERGY_TOOLS.md`.
- Held items have models in `src/render/handwork/handModels.ts`; icons come from `src/render/textures/iconsTools.ts`.
So the system is "somewhat modular" by material tiers and a quality multiplier. The parts, traits, assembly and per-stack data are new.

## Design

### Parts and materials

A tool is a `ToolBuild` stored on the stack: `parts: { head: string; handle: string; binding?: string; extra?: string }` (material keys), plus
the usual `durability`. The tool's kind (pickaxe, axe, shovel, hoe, hammer, maul, sword, spear, ...) comes from the **head kind**, a part
item such as `pickaxe_head`, made of a material.

Materials are data (`src/content/materials.ts`, new):

| Field | Meaning |
| --- | --- |
| `tier` | Mining tier it can reach as a head (flint 1, bronze 2, iron 3, steel 4...) |
| `speed` | Mining speed factor as a head |
| `durability` | Durability factor (head) or reach/handle comfort |
| `damage` | Weapon factor |
| `weight` | Slows swing (handles) and affects fatigue/hit cooldown |
| `traits` | Up to two, one per role (see below) |
| `colour`, `tint` | For models and icons |
| `age` | Where it first appears |

The stat formulas are small and visible in the tooltip: `speed = head.speed * handle.comfort`, `durability = head.durability * binding.hold`,
`reach` from the handle, `cooldown` from weights. Existing tool numbers are reproduced exactly by a "default build" per old item, so
balance is preserved on day one.

### Traits (the fun)

Each material has traits by role. A few examples:

| Role | Trait | Effect |
| --- | --- | --- |
| Head | Brittle Flint | Fast, cheap, wears 30% faster |
| Head | Bronze Temper | Tough; the tool never drops below tier-2 mining even when worn |
| Head | Iron Weight | Extra damage against armoured foes; slower swing |
| Handle | Oak Grip | Standard comfort |
| Handle | Bone Light | Faster swing; lower durability |
| Handle | Reed Spring | Longer reach |
| Binding | Cord | Plain |
| Binding | Resin | Holds longer; a small chance to repair 1 durability on use |
| Binding | Wire | Conducts: works with powered machines (a hand tool that charges a cell) |
| Extra | Glass Shard | A rare, optional trait: reveals ore through thin walls when held |

Traits are small, specific and readable: no hidden percentages beyond what the tooltip shows. Enchantments (see enchantments.md) sit on top as
the second layer, and legendary weapons are **unique parts** (a "Blade of Emberfang") fitted to a handle.

### Assembly

- **Part Builder** (a workbench station you can already reach: extend the workbench or add a "Tool Bench" block): choose a head kind, a
  material for it, then handle and binding. Preview the stats and the held model; confirm to craft the **parts** first, then assemble.
  Parts are real items (`pickaxe_head` with `material` on the stack), so you can stockpile, trade, loot and repair with them.
- **Swap at an anvil.** Use a worn tool on an anvil: choose to repair (material, as today) or to replace the head, handle or binding with
  one in your pack. Replacing returns the old part at reduced durability.
- **Part wear.** The head wears (as durability today); the handle and binding wear much slower and break last. A broken head leaves a
  handle and binding behind, so you do not lose everything.
- **Tool kinds that need extras.** Chainsaw and shears stay purpose-built machines for now; their parts (blade, tank) can become modular in a
  later phase.

### Data model and saves

- `ItemStack.parts?: { head: string; handle: string; binding?: string; extra?: string }`, optional and sanitised: unknown materials fall
  back to a default; a tool with no `parts` is a **legacy tool** and is migrated on load to the default build for its old key (for example
  `bronze_pickaxe` becomes parts `bronze / oak / cord`). Legacy keys stay valid items and craftable recipes for one version as
  "preassembled" aliases so existing worlds, recipes and the progression solver keep working.
- A resolver `toolStats(stack)` computes `ToolSpec`-compatible stats (kind, tier, speed, durability) from parts. Everything that reads
  `item.tool` today (mining speed, tier gates, wear, repair, felling) switches to `toolStats(stack)`, with a fallback to `item.tool` for
  non-modular tools. One function change, many callers.
- Parts are items; `canMerge` is false for assembled tools and true for identical parts.

### Interaction with other plans

- **Loot.** Rare parts and unique parts drop as ordinary loot entries (rarity colours apply to parts). Named weapons are unique parts.
- **Enchantments.** Enchants attach to the assembled tool, not the parts; replacing the head keeps enchants (and a unique part may refuse).
- **Magic.** Charms and focuses are separate; a part can carry an aspect that makes an enchant cheaper at the altar.
- **Progression.** Materials gate tiers exactly as tool sets do now; the content test "solver can reach each tier" counts parts and
  materials. No tier is skipped by a rare part: rare parts add traits, not tier.

### UI

- **Tool Builder screen** (phone first): left, the part slots with the chosen material icons; right, a live stats table with deltas against
  the tool you hold; below, the materials you can use, sorted by what you own. One tap picks a material, one tap crafts.
- **Tooltips.** Show the build ("Bronze head, oak handle, cord binding"), each trait in the colour of its role, and the three numbers that
  matter (mining speed, durability, reach or damage).
- **Held model and icon.** Composed from three layers (head, handle, binding) tinted by material colour, in `handModels.ts` and
  `iconsTools.ts`, so builds look different without new art per tool.
- **Repair prompt.** At an anvil, the screen shows the worn part highlighted and the replacement options.

## Phases

1. **Data only, no player-visible change.** `materials.ts`, the part item model, `toolStats(stack)`, legacy migration of every existing tool to a
   default build, and parity tests proving each old tool's numbers are unchanged. All consumers read through `toolStats`.
2. **Parts as items.** Part items per head kind and material, recipes at the workbench, the Part Builder screen, assembly, tooltips.
3. **Swapping and wear by part.** Anvil swap, part-specific wear, a broken head leaving handle and binding.
4. **Traits and visuals.** Trait effects, the composed held model and icon, tint per material.
5. **Weapons and hoes on the system.** Swords, spears, hammers and mauls get their head kinds; legendary weapons as unique parts.
6. **Extras.** Rare extra part slot, wire binding for powered tools, glass shard trait, then chainsaw blade and tank.

Each phase ends with `tsc`, the full test run, the golden update where content changed, and an e2e run on desktop and phone.

## Tests

- Parity: every legacy tool key resolves to exactly its old `ToolSpec` through its default build.
- Formula tests for each stat, trait effect tests through `toolStats` (no world needed), and a mining test where a bronze-head tool cannot
  mine a tier-3 block however fine its handle.
- Assembly and swap conserve items; wear splits correctly; sanitize drops unknown materials; old saves load.
- Content tests: every material has an age and a tier no higher than one ahead of where it is found; the solver reaches each tier.
- Visual tests: icon and held model differ per material pair; stress a bag of 50 different builds for frame cost.

## Risks and answers

- **Balance regression.** Phase 1 locks parity before anything changes; trait numbers are small and capped.
- **Too many choices on a phone.** Default build suggested by "use best owned"; one-tap rebuild; the builder remembers your last choice.
- **Content explosion.** Materials are data, parts are generated from head kinds times materials, icons and models are composed by tint:
  no per-combination art.
- **Save and recipe compatibility.** Legacy keys remain as aliases for one version; migration is tested with real old saves.
- **Progression solver and golden churn.** Parts and materials are new obtainable items; the golden update is reviewed once per phase.
- **Scope.** Do pickaxes, axes and shovels first (they cover mining and the ladder), then everything else; each kind is its own
  small step.

## Open questions

1. Do you want a **Tool Bench** block of its own, or extend the workbench?
2. Should hoes and shears stay fixed items (farming feel) or be modular from phase 2?
3. How far should weapons go: modular heads on handles, or only unique parts fitted to a plain blade?
4. Should a part break forever, or can any part be repaired at the anvil with its material (my default: head and binding repair, handle
   only replaces)?
