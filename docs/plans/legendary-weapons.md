# Legendary weapons

## Goal

A handful of named weapons, each with a legendary effect, a utility outside combat and a look nobody could mistake. Found, not crafted. Each one
changes how you fight and how you move through the world, and each has a story you can read in its tooltip.

## What is fun

- Finding one: a beam of gold on the ground, a name, a line of story.
- A signature move you learn by using it, not by reading numbers.
- The utility: the weapon is also a tool (light, traversal, a way to open something), so it is not only for fighting.
- Visuals that make a fight look like a moment: trails, hit flashes, a glow you can see across a room.

## What exists

`ItemSpec.weapon` (`WeaponSpec`) and the hit cooldown in `src/core/types.ts`; combat in `src/mobs/attacks.ts` and the player hit path; the
maul as the one weapon with its own numbers; `quality` on tools; the particle emitters (`src/render/emitters`) and the animated liquid and
glass look. The loot plan (loot-and-containers.md) places named finds; the enchantment plan (enchantments.md) supplies the verbs.

## Design

**Rules for every legendary**

1. One name, one story line, one fixed enchant set that cannot be swapped.
2. One legendary effect (a verb), one utility, one visual signature.
3. Only one of each per world, placed once in a specific container (vault, deep ruin, boss cache) so finding it is an event.
4. Stats stay near a good normal weapon of its age; the power is the effect, not a bigger number.

**First eight** (ages are where they sit, never beyond one ahead):

| Name | Kind | Legendary effect | Utility | Visual |
| --- | --- | --- | --- | --- |
| Orrin's Spare Pick (tavern vault) | pickaxe | Breaks the connected ore vein | Detects ore behind a wall when held (a soft hum) | Brass sparks, a faint compass glint |
| Emberfang | sword | Each hit leaves a burning mark; three marks make a burst | Lights torches and furnaces by touch | Ember trail on every swing, orange hit flash |
| Gale Reed | spear | A lunge that carries you forward and knocks back what you hit | A short glide when thrown at the ground | Wind ribbons and leaf swirls |
| The Quiet Hammer | maul | The next hit after standing still is silent and heavy | Breaks locked or rusted crates without noise | Dull grey shimmer, no trail |
| Tidebrand | trident | Pulls enemies a step toward you | Lets you breathe and move easily underwater briefly | Water ripple trail, droplets |
| Lanternblade | short sword | Light bursts when it hits in the dark; undead recoil | A steady light that never goes out | Warm lantern glow on the blade |
| Rootsong | staff | Roots enemies in place for a moment | Grows a small plant or bridge where it strikes soil | Green vines, falling petals |
| Starcleaver | greatsword | Charged swing releases a shock arc | Cuts through vines, webs and thin walls | Bright arc, a short star-streak trail |

Names, stories and the exact verbs are placeholders; the shape is fixed: effect, utility, look.

**Power curve.** A legendary is the best option for its age while you use its verb; outside that, it is about as good as a normal weapon.
That keeps the rest of the game's tools useful and avoids a single best build.

**Collecting.** Each one gets a page in the notebook (name, story, what it does) once found; unfound ones show a silhouette and a hint
about where such things are told of (a rumour from the trader or the tavern).

**Upgrading.** A legendary can be fed essentia at the altar to deepen its effect twice (a level of its legendary effect), never to change it.

## Visuals (budget first)

- Swing trail: a shared ribbon renderer with per-weapon colour, width and fade; off under reduced motion, thinner on low graphics.
- Hit flash and sparks through the existing particle emitters, capped per frame.
- A held glow: a small point light from the weapon (cheap, one light per held legendary).
- A ground beam and name colour from the rarity system.
- No new textures beyond one icon and one held-item look per weapon; reuse the shimmer overlay from the enchantment plan.

## Phases

1. Data: `legendary` flag, fixed enchants and effect key on the item spec; one weapon end to end (Orrin's Spare Pick: effect, utility,
   look, tavern vault placement).
2. The shared swing-trail and hit-flash visuals.
3. Three more weapons covering different verbs (Emberfang, Gale Reed, Lanternblade).
4. The rest, the notebook page and the upgrade at the altar.

## Tests

Effect helpers testable without the world (vein size, mark counting, root duration); one-per-world placement deterministic by seed; the
weapon cannot be duplicated by crafting or the trader; save round trip; visuals under a per-frame budget in a stress scene; e2e: find, wield
and use one.

## Risks

- Balance: a legendary that trivialises a mob or an age. Keep stats near normal and cap effect strength; playtest each verb.
- Visual cost on a phone: trails and lights are budgeted and scale with the graphics setting.
- Too many to track: eight is the target; add more only after players use these.
- Duplicate verbs: each weapon must change play differently; reject a weapon whose verb is only "more damage".
