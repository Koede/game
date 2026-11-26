# Legendary weapons

Plan: `docs/plans/legendary-weapons.md`. Data: `src/content/legendary.ts`. Verbs: `src/game/legendary.ts`. Icons: `src/render/textures/iconsLegendary.ts`.

## Rules (held by tests in `src/content/legendary.test.ts`)

One name, one story, one verb (`LegendaryEffect`), one utility, one look. Found, never crafted or sold. Stats stay near a normal weapon of the age
(damage 5 to 7, age 1). The verb is read from the item **key** (`legendaryEffectOf`), never from a stack, so nothing done to a stack can add, swap or lose
it. Fixed enchants (`LegendarySpec.enchants`) come with a found stack; the altar refuses legendaries (`canAltarEnchant`, src/core/enchant.ts), while loot
and fixed finds still write them (`enchantStack`).

## The four that exist

| Item | Source | Verb | Utility |
| --- | --- | --- | --- |
| `orrins_spare_pick` | tavern vault (placed) | Veinseeker I: breaks the connected vein | hums near ore behind a wall (`oreHum`, checked twice a second, sfx `infuse` scaled by distance) |
| `emberfang` (sword) | boss | each hit marks the target; the 3rd mark within 6 s bursts: 4 damage to it and everything within 2.5 blocks | held it warms like a torch (`HELD_WARM_ITEMS`), melts snow at a touch (`toolUses.ts`) |
| `gale_reed` (spear) | ruin | Use lunges forward (12 blocks/s, 2.5 s cooldown); the next hit within 0.7 s does +2 and shoves the target back | fixed Featherfall II |
| `lanternblade` (sword) | ruin | a hit in the dark (light below 6) does +2, stuns 0.8 s and shoves | fixed Lightstep II (a trail of light) |

`ToolKind` gained `sword` and `spear`: no block names them, so they count as bare hands for mining, like the maul.

## Wiring

- `PlayerCombat.legendary` (`LegendaryState`): marks (bounded to 16 creatures, 6 s life), lunge cooldown and window. Ticked by `coolStrike(dt)`, cleared by `reset()`. Not saved.
- Hit path: `AnimalHands.strike` asks `beforeHit(item, dark)` for extra damage and stun, passes them to the hit, then `afterHit` for the Emberfang's marks. The burst and the shove
  go through optional `AnimalTargets.hurtExtra / shove / near` (MobManager implements them; `hurtExtra` has no hit cooldown, so a burst never waits on one).
- The controller owns Use-lunge, the dark test (`PlayerControllerOptions.sunlight`, from the game clock; block light below 6 and no daylight overhead) and the hum.
- Visuals: the bus event `legendary:proc { effect, x, y, z }`; `Emitters` turns it into at most 14 sparks (orange for Emberfang, pale for the others).

## Placement API (for the ruin and boss systems)

- `legendaryForSource(source, seed, index)` where `source` is `'ruin' | 'boss' | 'tavern_vault'` and `index` counts the places of that kind in the world:
  deterministic by seed, never the same weapon twice in a world, `null` once the source's weapons are used up.
- `legendaryTableId(item)` is a loot table (`legendary_<item>`, in `NAMED_TABLES`) holding exactly that weapon; put it in a crate or a boss cache and `rollLoot` gives the stack with
  its durability and fixed enchants (`NAMED_FINDS` is derived from `LEGENDARIES`).
- The tavern vault keeps its own table; Orrin's Spare Pick is unchanged.

## Not built yet

The notebook page and silhouette (the `hint` lines are written), the essentia upgrade at the altar, a swing-trail ribbon, the held glow, the other four of the first eight
(Quiet Hammer, Tidebrand, Rootsong, Starcleaver), and the boss and ruin containers themselves (other threads). Orrin's pick hum has no HUD, only sound.
