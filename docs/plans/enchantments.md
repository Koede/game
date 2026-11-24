# Enchantments

## Goal

Enchantments that change what you do, not a number on a tool. A few bold ones, found by experiment at the Infusion Altar, with loot
as the lucky shortcut. Optional like all magic.

## What is fun

- A new verb the moment you enchant something (a pickaxe that breaks a whole vein).
- Working out what an item wants: it hums near the right essentia and the altar teaches by trying.
- Few choices that each mean something, instead of six percentage bonuses.

## What exists

`ItemStack` has `durability` and `quality`; `src/game/inventory.ts` clones, merges and sanitises stacks. The Infusion Altar and `INFUSIONS`
recipes live in `src/magic/magic.ts` and `src/content/recipesMagic.ts` (instability, mishaps, warp). Aspect icons are in
`src/ui/kit/aspectIcon.ts`.

## Design

**Item data.** `ItemStack.enchants?: Record<string, number>`, optional and sanitised on load (unknown keys dropped, levels clamped).
Enchanted stacks never merge. Effects read one helper, `enchantLevel(stack, key)`.

**The set** (max level III, each tied to an aspect for its cost):

| Key | What you do differently |
| --- | --- |
| Veinseeker | Breaking an ore breaks the connected vein (size by level) |
| Ember | Smelts what it breaks and sets targets alight |
| Magnet | Drops fly to you from a few blocks away |
| Featherfall | No fall damage; level II also lets you glide a short way |
| Lightstep | Leaves a soft trail of light that fades behind you |
| Bounty | A chance of one extra drop, shown with a small glint |

Numbers stay small and capped; the fun is the verb.

**Discovery at the altar.** Put an item on the altar with no recipe chosen: it hums if essentia nearby matches something it can take (the
aspect icon glows on the pedestal). The player learns each enchant's aspects by testing, then a short research entry records it. Cost
scales with level; instability rises with existing enchants; a mishap damages the item to 1 durability or adds warp, never deletes it.

**Loot.** Rare and legendary entries may carry fixed enchants (see loot-and-containers.md).

**UI.** Tooltip line in the aspect's colour with its icon; a subtle shimmer on enchanted icons (off under reduced motion); the altar shows
the preview and the instability bar.

## Phases

1. Core: data, helper, sanitise, merge rules, save tests.
2. Two enchants end to end (Magnet and Veinseeker): effect, tooltip, shimmer, loot roll.
3. Altar discovery, research entries and costs.
4. The remaining four.

## Tests

Sanitise and merge; every effect through its helper without the world; vein size caps; altar hum rules; e2e: infuse a pickaxe and break a
vein.

## Risks

Veinseeker and Bounty can flatten mining progression: cap vein size by level and keep tier gates. Magnet must not scoop drops through
walls. Avoid stat-stacking: one enchant per slot of its kind.

## Borrowed from other RPGs

See rpg-inspirations.md. For this plan: learn an effect by breaking an enchanted find (Skyrim), element infusion that changes damage type
and look (Dark Souls), elemental reactions between two enchants (Genshin), a charge that the effect drains and a jar refills (Elder
Scrolls), temporary fusion of a part onto a weapon (Zelda), boon-style shrine offers where you pick one of three (Hades), and socket-like
essentia slots later (Path of Exile).

## Shipped (phases 1-2, no altar yet)

- Data: `ItemStack.enchants?: Record<string, number>`; registry and helpers in `src/core/enchant.ts` (`enchantLevel`, `addEnchant`, `enchantStack(stack, key, level)`,
  `sanitizeEnchants`, `enchantLines`). `src/game/inventory.ts` carries it through `makeStack`/`cloneStack`/`sanitize`/`add`/`removeAt`, transfers, storage sort, ground
  items and spills; enchanted stacks never merge; old saves load unchanged; unknown keys dropped, levels clamped.
- Loot hook: `makeEnchantedStack(item, { veinseeker: 1 })` (src/game/inventory.ts) gives a full-durability stack, or call `enchantStack` on one you hold.
- Effects live in `src/game/enchantEffects.ts`, called from the break code (`src/player/interaction.ts`) and the mob-death drop (`src/app/state.ts`):
  Veinseeker (3/6/10 extra ore blocks, same kind, tier-gated, 1 durability each, never wears the tool out) and Magnet (3/5/7 blocks, line of sight via
  `clearLine` in groundItems; drops carry `magnet`).
- UI: coloured "Veinseeker II" lines with the aspect icon in item tooltips and the hotbar name flash; CSS shimmer on enchanted slots (off under reduce motion).
- Debug: `__hw.give(item, 1, { veinseeker: 2 })`.
- Still to do: altar discovery (phase 3), the other four enchants (phase 4).

## Shipped (phases 3-4)

- Altar discovery (`src/magic/magic.ts`): a heart item with no recipe and no pedestals hums when the jars within reach hold an aspect
  an enchant it can take wants (first in registry order; one aspect per enchant, so the hum names one). The altar text says
  "hums toward Vein", the heart's aspect icon gets a pulsing orb (`displays()` `glow`, `src/render/magic/magicRenderer.ts`).
  A rod Use starts the write: the essentia is drawn over ENCHANT_INFUSE_S = 12 s through the same `take` as recipes. The toast
  does not name the enchant; the first success writes its notebook note.
- Costs and instability: `enchantCost(key, level)` = perLevel x level; `enchantInstability` = levels already on the item + (level - 1),
  so a first enchant on a bare tool is steady. A mishap (`MISHAP_PER_S` per point, as for recipes) drops a durable tool to durability
  1 half the time, else adds 2 warp. The item is never deleted; the write carries on.
- The altar keeps the heart's durability and enchants while it sits there (`altarKit`, saved as `altarKit`). Taking a tool back
  off an altar used to reset it to full durability; now it does not.
- Research: one note per enchant (`enchant_<key>`, `src/magic/entries.ts`, `learnEnchant` in `src/magic/research.ts`), needs
  `infusion`, no board, never opened by a scan. The notebook shows "Not written yet" until the altar writes it, then names the aspect.
- Phase 4 enchants (`src/core/enchant.ts`, effects in `src/game/enchantEffects.ts`, all through `enchantLevel`):
  Ember (I; smelts what it breaks where a furnace recipe exists: ore to ingot, log to charcoal), Featherfall (I: no fall damage,
  `src/player/physics.ts`; II: holding Jump slows the fall to 3 m/s for 1.5 s per airtime), Lightstep (I-III: a Floating Light trail
  on open cells for 2.5 / 4 / 6 s, at most 12 cells, `LightTrail`), Bounty (I-III: 10 / 20 / 30% for one extra drop, a pickup chime).
  Ember is I only: the plan's "a creature it hits catches fire" needs a burn state for creatures and hostiles, which does not exist yet.
- Tests: `src/magic/enchantAltar.test.ts` (hum, silent altar, write, costs, mishaps, save), `src/game/enchantPhase4.test.ts` (registry,
  Ember, Bounty, Featherfall, Lightstep, all without the world).
