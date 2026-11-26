# Legendary weapons

Plan: `docs/plans/legendary-weapons.md`. Data: `src/content/legendary.ts`. Verbs: `src/game/legendary.ts`. Icons: `src/render/textures/iconsLegendary.ts`.

## Rules (held by tests in `src/content/legendary.test.ts`)

One name, one story, one verb (`LegendaryEffect`), one utility, one look. Found, never crafted or sold. Stats stay near a normal weapon of the age
(damage 5 to 7, age 1). The verb is read from the item **key** (`legendaryEffectOf`), never from a stack, so nothing done to a stack can add, swap or lose
it. Fixed enchants (`LegendarySpec.enchants`) come with a found stack; the altar refuses legendaries (`canAltarEnchant`, src/core/enchant.ts), while loot
and fixed finds still write them (`enchantStack`).

## The eight that exist

| Item | Source | Verb | Utility |
| --- | --- | --- | --- |
| `orrins_spare_pick` | tavern vault (placed) | Veinseeker I: breaks the connected vein | hums near ore behind a wall (`oreHum`, checked twice a second, sfx `infuse` scaled by distance) |
| `emberfang` (sword) | boss | each hit marks the target; the 3rd mark within 6 s bursts: 4 damage to it and everything within 2.5 blocks | held it warms like a torch (`HELD_WARM_ITEMS`), melts snow at a touch (`toolUses.ts`) |
| `gale_reed` (spear) | ruin | Use lunges forward (12 blocks/s, 2.5 s cooldown); the next hit within 0.7 s does +2 and shoves the target back | fixed Featherfall II |
| `lanternblade` (sword) | ruin | a hit in the dark (light below 6) does +2, stuns 0.8 s and shoves | fixed Lightstep II (a trail of light) |

| `quiet_hammer` (maul) | ruin | the first blow after standing still 1 s does +3 and stuns 0.4 s | cracks stone brick like any maul, silently |
| `tidebrand` (trident) | ruin | each hit pulls the target toward you (5 blocks/s) | breath lasts nearly 3 times as long underwater (`TIDEBRAND_AIR_MULT`) |
| `rootsong` (staff) | ruin | each hit roots the target in place for 1.5 s (`MobManager.root`) | Use on bare dirt greens it over (`rootsong_greens_dirt`) |
| `starcleaver` (sword) | boss | hold Mine 1 s to charge; the charged blow throws an arc through up to 3 more creatures within 4 blocks in front | sweeps tall grass and dry shrub like a hoe |

`ToolKind` gained `sword`, `spear`, `trident` and `staff`: no block names them, so they count as bare hands for mining, like the maul.

## Wiring

- `PlayerCombat.legendary` (`LegendaryState`): marks (bounded to 16 creatures, 6 s life), lunge cooldown and window. Ticked by `coolStrike(dt)`, cleared by `reset()`. Not saved.
- Hit path: `AnimalHands.strike` asks `beforeHit(item, dark)` for extra damage and stun, passes them to the hit, then `afterHit` for the Emberfang's marks. The burst and the shove
  go through optional `AnimalTargets.hurtExtra / shove / near` (MobManager implements them; `hurtExtra` has no hit cooldown, so a burst never waits on one).
- The controller owns Use-lunge, the dark test (`PlayerControllerOptions.sunlight`, from the game clock; block light below 6 and no daylight overhead) and the hum.
- Visuals: the bus event `legendary:proc { effect, x, y, z }`; `Emitters` turns it into at most 14 sparks (orange for Emberfang, pale for the others).

## Attunement (the altar upgrade)

`attunement` (src/core/enchant.ts, max II, Rune essentia, 3 per level) is the one enchant a legendary takes at the altar, and the only one it does take
(`canAltarEnchant`); common weapons cannot take it. The altar keeps the enchants a legendary was found with. Each level deepens the verb by about a third at most:
Emberfang's burst +2 damage and +0.5 reach, Gale Reed's lunge +1.5 speed, +1 damage and +2 shove, Lanternblade +1 damage and +0.3 s stun, Quiet Hammer +1, Tidebrand +2 pull,
Rootsong +0.7 s, Starcleaver +1 damage and +1 reach. It is read in `AnimalHands.strike` (`enchantLevel(held, 'attunement')`).

## Notebook

`watchLegendaries` (src/game/legendaryNotes.ts, wired in `AppState`) writes a journal note (`legendary:<item>`: name, story, verb, utility) the first time a legendary is in the pack and
toasts it. `legendaryPages(found)` is the whole list for a notebook screen: a found weapon in full, an unfound one as `???` with its rumour. The journal screen lists the notes; a
dedicated silhouette page is not drawn yet.

## Look

- Swing trail: `legendary:swing` (the controller, about every 0.45 s while Mine is held with a legendary) becomes a thin arc of sparks in the weapon's colour
  (`TRAIL_COLOUR`, emitters.ts); 0 sparks under reduced motion, 4 on low graphics, 8 otherwise (`swingTrailSparks`).
- Held glow: `heldGlowOf(item)` is a floor under the held item's light in the renderer, so it reads across a dark room; no extra light source, no cost.

## Placement

Two layers:

1. `LegendaryClaims` (src/world/legendaryClaims.ts) is the live rule: the world keeps the set of weapons already placed (saved as extra `legendary`), so there is only one of each.
   `World` rolls every new **ruin crate** with it (5% each while a ruin weapon is left; its own hash, so the ordinary roll and old saves are unchanged).
   `legendaryClaimsOf(world)?.roll('boss', x, y, z)` is the boss's call (a boss always holds one while any boss weapon is left). `LegendaryClaims.stackOf(item)` is the finished stack.
2. `legendaryForSource(source, seed, index)` is the stateless version: the weapon the n-th place of a source holds in a seed. Kept for tools and tests.

### Boss hoard hook (PR #27, `src/mobs/hostiles.ts` `lairFalls`)

That branch does not have this code, so the hook lands once both are merged. After the `tableCrateEntity(this.host.seed, x, y, z, 'cave_boss')` line:

```ts
const crate = tableCrateEntity(this.host.seed, x, y, z, 'cave_boss');
const claims = legendaryClaimsOf(world);
const found = claims?.roll('boss', x, y, z) ?? null;
if (found) {
  const slots = crate.slots as Slot[];
  const at = slots.indexOf(null);
  if (at >= 0) slots[at] = LegendaryClaims.stackOf(found);
}
world.setEntity(crate);
```

(`legendaryClaimsOf` and `LegendaryClaims` come from `src/world/legendaryClaims.ts`; the toast could name the weapon.)

- `legendaryForSource(source, seed, index)` where `source` is `'ruin' | 'boss' | 'tavern_vault'` and `index` counts the places of that kind in the world:
  deterministic by seed, never the same weapon twice in a world, `null` once the source's weapons are used up.
- `legendaryTableId(item)` is a loot table (`legendary_<item>`, in `NAMED_TABLES`) holding exactly that weapon; put it in a crate or a boss cache and `rollLoot` gives the stack with
  its durability and fixed enchants (`NAMED_FINDS` is derived from `LEGENDARIES`).
- The tavern vault keeps its own table; Orrin's Spare Pick is unchanged.

## Not built yet

The boss hook above (waits for PR #27 to meet this branch), a notebook silhouette screen (the data and notes exist), a true ribbon mesh for the trail (it is sparks), and a HUD for
Orrin's pick hum (sound only). Tidebrand's easier movement underwater is only the breath.
