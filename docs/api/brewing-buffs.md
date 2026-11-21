# Brewing - buffs, drinking, physics (src/game, src/player/physics)

For the HUD and the interaction engineers. Design: `docs/BREWING_PLAN.md` 5, 8, 11.1. Data: `docs/api/brewing-content.md`.

## Buffs (`src/game/buffs.ts`, exported from `src/game`)

`player.buffs` is now a `Buffs` (type alias `PlayerBuffs`). Well-Warmed and Well-Fed keep their plain fields
(`wellWarmedS`, `wellFedS`; `player.wellWarmed` / `wellFed` unchanged). The six drinks live in one slot per family
(tea: spring, hearthkept, mending; coffee: swift, vigor, lasting): at most one of each runs; a new one replaces it.

```ts
class Buffs {
  wellWarmedS: number; wellFedS: number;
  timeLeftS(buff: DrinkBuff): number;  has(buff: DrinkBuff): boolean;  drinkOf(family): DrinkBuff | null;
  grant(buff: DrinkBuff, seconds): { replaced: DrinkBuff | null; refreshed: boolean };  // same buff: refresh, never shorten
  active(): { buff: BuffName; timeLeftS: number }[];   // for HUD chips (allocates: call on HUD refresh, not per frame)
  // multipliers, each applied at the ONE place its base rule lives:
  jumpMult (Spring, physics)  speedMult (Swift, physics)  miningMult (Vigor, mining.ts)
  warmthDrainMult (Hearthkept, Survival.tickWarmth)  regenMult (Mending, Hunger.regenInterval)  foodDrainMult (Lasting, hunger drainFactor)
  tick(dt); clear(); toJSON(): BuffsSnapshot; load(s)
}
springFallAllowance(jumpMult): number   // (mult^2 - 1) x normal jump height; added to SAFE_FALL
```
`Hunger.tick` counts Well-Fed and the drinks down (Survival ticks Well-Warmed as before). Respawn clears all buffs.
HUD: show `player.buffs.active()`, name/effect words from `DRINK_BUFFS[buff]` (`src/core/brewing.ts`).
Save: `PlayerSnapshot.buffs = { wellWarmedS, wellFedS?, drinks?: Partial<Record<DrinkBuff, seconds>> }`; old saves load with no drinks.
`PlayerSnapshot.stats.drunk?: Record<itemKey, count>` (optional) counts cups drunk.

## Drinking (`src/game/drink.ts`)

```ts
drink(player, slot = player.selectedSlot): DrinkResult
// { ok: true, item, buff, replaced: BuffName | null } | { ok: false, reason: 'dead'|'not_drink'|'cooldown', message: null }
drinkRefusal(player, itemKey): DrinkRefusal | null;   drinkOf(itemKey): DrinkSpec | null
```
Success: consumes one drink and puts `clay_cup` in the SAME slot, grants the buff (`DrinkSpec.buffS`), adds `spec.warmth`
(Hearthkept +10) and `spec.hunger` when set, starts `player.drinkCooldownS = DRINK_COOLDOWN_S` (counted down by Hunger.tick),
emits `player:drank`, `buff:gained`, sfx `sip`, a toast ("Spring replaces Mending" on replacement, else "Spring: <effect>"),
and the flag `six_cups` the first time the sixth distinct drink is drunk. Refusals change nothing and emit nothing
(`message` is always null: they are quiet, like a bite cooldown). Same shape as `eat()`.

## Mining (Vigor)
`miningTime(block, held, wellWarmed, speedMult = 1)` in `src/game/mining.ts`; `src/player/interaction.ts` already passes
`player.buffs.miningMult` as the 4th argument.

## Physics
`PlayerPhysics.step`: walk, sprint and swim speed x `buffs.speedMult`; jump velocity x `buffs.jumpMult`; the landing's
`fallDamage(distance, allowance)` gets the Spring allowance (kept for that fall even if the buff ends mid-air).
Sprinting while Hungry stays refused. `fallDamage(distance, allowance = 0)` in `src/game/survival.ts`.

## Pail cooling (`src/game/drink.ts`)
`coolStack(stack, dt)`: pure; for an item with `ItemSpec.cools` counts `stack.durability` (seconds left; fresh = `afterS`)
down and returns the stack, or the replacement stack (`cools.to`) when it cooled, null for items that do not cool.
`coolCarried(player, dt)` does it for the whole inventory (Survival.tick calls it; toast "The Boiling Bucket cooled ...";
the inventory is notified about once a second so a heat bar redraws). Whoever gives a boiling pail sets
`durability = BOILING_KEEPS_S` (or omits it: a missing durability counts as full).
