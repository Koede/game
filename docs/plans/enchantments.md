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
