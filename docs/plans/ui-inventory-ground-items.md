# UI, inventory and ground-item quality of life

Pairs with improvements-to-existing.md. Items marked **done** shipped; the rest are ideas ordered by value for a phone-first game.

## Ground items (blocks and drops lying in the world)

**Done: no more jitter.** The physics runs at 20 Hz and used to be drawn raw at the frame rate, so falling, thrown and flying drops stepped.
`src/render/groundItems.ts` now draws each item at an eased pose (`easeToward`, frame-rate independent): its position follows the physics,
and its bob height and size ease too, so landing, taking off and merging no longer snap. Tests in `src/render/groundEase.test.ts`.

Ideas:
1. **Calm resting pose.** An item that has rested for a second settles: the spin slows to a stop at a tidy angle, the bob fades, and a block
   item lies flat on its face like a placed block, so a pile reads as a pile, not a swarm. Items spin and bob again when you come near.
2. **Real stacks.** A stack of 2 to 16 draws as 2 or 3 copies already; make them sit in a tidy fan on the ground and merge into one fat copy
   when the count grows, with a small count badge that appears when you look at it (not floating numbers on every pile).
3. **Name on look.** Aiming at a drop shows its name, count and rarity colour (and "Veinseeker pick" for enchanted ones), the same way the
   crosshair names blocks.
4. **Pickup that feels good.** A short arc into the pack with a soft pitch-rising tick per item, and a combined "+12 stone" toast instead of
   twelve toasts when many arrive together.
5. **Loot rules.** A small filter in settings: "pick up everything", "ignore junk" (rubble, dirt, seeds) and "never pick up favourites'
   kind". A magnet toggle that pulls drops only when you hold the shovel or when you ask.
6. **Despawn grace.** Items about to despawn (the last 20 seconds) blink slowly so you can save them, and never despawn inside a tavern or a
   claimed build.
7. **Cheaper drawing.** Cull and merge drops that are far away into one distant sprite, and skip lighting probes for settled items beyond 20
   blocks (the renderer already eases light so it never pops).

## Inventory

1. **Search and filter** in the bag: a search box (name, category, "usable now at this station") and a filter strip. Sort, favourites and
   move-all already exist.
2. **Done: drag to split and distribute.** Press the held stack and drag over empty or matching slots to spread it evenly; released
   elsewhere it stays put. The moves pass also shipped: drop one (right-click or long-press), Shift / two-finger bulk moves between
   the hotbar and pockets, one-step Undo, per-slot locks with a badge, "Order: newest" sorting, Gather matching, and Belt Pouch
   pockets. Details in docs/api/inventory.md ("Moves"). Not done here: a second finger splitting in half.
3. **Quick-stack to nearby containers** (a button): puts items that already live in a crate within 6 blocks into it.
4. **Hotbar swap sets**: two rows you flip between with one tap (build/mine), kept per world.
5. **Held-item preview** in the corner while you choose a slot (the name and its durability bar, enchant lines).
6. **Better tooltips**: one compact card (name in rarity colour, tier, durability ring, enchants with icons, what it makes/uses), sized for
   thumbs, dismissed by tapping elsewhere.
7. **Recent items strip**: the last four things you picked up or crafted, one tap to hold them.
8. **Overflow rule**: when the pack is full, offer to drop the least valuable stack or send it to the nearest crate, instead of leaving
   drops behind with a warning.

## UI

1. **Simple HUD preset** for new players and a full one for veterans; per-element toggles in settings.
2. **Crosshair info line**: a second line for contents and state (a jar's essentia, a crate's count, a furnace's temperature).
3. **Food preview** on the hunger bar when a food is held.
4. **One-handed layout** polish: the radial quick menu (see touch-and-settings.md) and thumb-reach audit of every panel.
5. **Toast tidy-up**: merge repeats, cap to three, fade faster during combat, and a history drawer.
6. **Contextual hints that retire**: each first-time hint shows once, then lives in a "What's new / tips" page.
7. **Accessibility**: a larger text option, colour-safe rarity (shape badges beside colours), and reduce-motion that also calms the ground
   items (no spin or bob).

## Suggested order

1. Calm resting pose and name-on-look (small, visible every minute).
2. Pickup toasts merged, and the loot rules filter.
3. Bag search and drag to split.
4. Tooltip card and held-item preview.
5. Quick-stack and hotbar swap sets.
