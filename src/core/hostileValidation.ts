/**
 * Content checks for the Emberbound automatons (spec 19) and the gear that fights them (weapons, armour).
 * validateContent in the registry calls these with its lookups passed in, so this file needs no import of the
 * registry (and tests can feed it broken specs directly).
 */
import { ALL_BIOMES } from './types';
import { EMBER_BOLT_GRAVITY } from './constants';
import type { CreatureAnim, CreatureSpec, ItemDef, SpawnPlace } from './types';

const PLACES: ReadonlySet<SpawnPlace> = new Set<SpawnPlace>(['cave', 'deep', 'surface', 'scar', 'scar_night', 'peak', 'wood_night', 'dunes_night', 'frost_night', 'marsh_night']);
const BIOMES: ReadonlySet<string> = new Set(ALL_BIOMES);
const LEGS: readonly CreatureAnim[] = ['legFL', 'legFR', 'legBL', 'legBR', 'legML', 'legMR'];
const positive = (n: number | undefined): boolean => n !== undefined && n > 0;

/** Problems with the box model of an automaton: shape rules every renderer relies on, and legs that fit how it moves. */
function modelProblems(c: CreatureSpec, at: string): string[] {
  const problems: string[] = [];
  const hostile = c.hostile;
  const names = new Set<string>();
  const pivots = new Map<CreatureAnim, string>();
  let top = 0;
  for (const p of c.model) {
    if (names.has(p.name)) problems.push(`${at}: duplicate model part "${p.name}"`);
    names.add(p.name);
    if (p.from.some((v, i) => !(p.to[i] > v))) problems.push(`${at}: part ${p.name} has an empty or inverted box`);
    if (!Number.isInteger(p.color) || p.color < 0 || p.color > 0xffffff) problems.push(`${at}: part ${p.name} colour is not 0xRRGGBB`);
    top = Math.max(top, p.to[1]);
    if (p.anim === 'none') continue;
    if (!p.pivot) {
      problems.push(`${at}: animated part ${p.name} has no pivot`);
      continue;
    }
    const pivot = p.pivot.join(',');
    const shared = pivots.get(p.anim);
    if (shared !== undefined && shared !== pivot) problems.push(`${at}: parts animated as ${p.anim} disagree on the pivot`);
    pivots.set(p.anim, pivot);
  }
  const legs = LEGS.filter((l) => pivots.has(l));
  if (hostile?.flying || hostile?.stationary) {
    if (legs.length > 0) problems.push(`${at}: a ${hostile.flying ? 'flying' : 'stationary'} automaton has no walking legs (${legs.join(', ')})`);
  } else {
    if (!pivots.has('legFL') || !pivots.has('legFR')) problems.push(`${at}: a walker needs legFL and legFR parts`);
    if (pivots.has('legBL') !== pivots.has('legBR')) problems.push(`${at}: back legs come in pairs (legBL and legBR)`);
    if (pivots.has('legML') !== pivots.has('legMR')) problems.push(`${at}: middle legs come in pairs (legML and legMR)`);
    if (pivots.has('legML') && !pivots.has('legBL')) problems.push(`${at}: middle legs need back legs`);
  }
  if (!pivots.has('head')) problems.push(`${at}: model has no head part (it aims with it)`);
  if (!c.model.some((p) => p.emissive)) problems.push(`${at}: model has no emissive ember part`);
  if (!c.model.some((p) => p.from[1] <= 0)) problems.push(`${at}: model does not reach y = 0 (its feet, or the bottom of a hovering body)`);
  const h16 = c.size.h * 16;
  if (top < h16 * 0.75 || top > h16 * 1.2) problems.push(`${at}: model is ${top}/16 tall but its box is ${h16.toFixed(1)}/16`);
  return problems;
}

/** Problems with one automaton species (validateContent runs it on every entry of AUTOMATONS). */
export function validateAutomaton(c: CreatureSpec, knownItem: (key: string) => boolean): string[] {
  const at = `automaton ${c.key}`;
  const h = c.hostile;
  if (!h) return [`${at}: has no hostile spec`];
  const problems: string[] = [];
  if (c.biomes.length === 0) problems.push(`${at}: no biomes`);
  for (const b of c.biomes) if (!BIOMES.has(b)) problems.push(`${at}: unknown biome "${b}"`);
  if (!(c.health > 0) || !(c.size.w > 0) || !(c.size.h > 0)) problems.push(`${at}: health and size must be > 0`);
  if (h.stationary ? c.speed !== 0 : !(c.speed > 0)) problems.push(`${at}: speed must be 0 exactly when it is stationary`);
  if (h.stationary && h.flying) problems.push(`${at}: cannot both fly and stand still`);
  if (!(c.group[0] >= 1) || c.group[1] < c.group[0]) problems.push(`${at}: group must be [min >= 1, max >= min]`);
  if (c.likes.length > 0) problems.push(`${at}: automatons are never lured or bred (likes must be empty)`);
  if (c.drops.length === 0) problems.push(`${at}: drops nothing - salvage is the point of fighting it`);
  for (const d of c.drops) if (!knownItem(d.item)) problems.push(`${at}: drop "${d.item}" is not an item`);

  if (!(h.damage > 0) || !(h.windupS > 0) || !(h.range > 0)) problems.push(`${at}: damage, windupS and range must be > 0`);
  if (!(h.cooldownS > h.windupS)) problems.push(`${at}: cooldownS (the attack period) must exceed windupS`);
  if (!(h.senseRange >= h.range)) problems.push(`${at}: senseRange must reach at least as far as its attack`);
  if (h.shieldFront !== undefined && !(h.shieldFront > 0 && h.shieldFront < 1)) problems.push(`${at}: shieldFront must be in (0, 1)`);
  if (h.knockback !== undefined && !(h.knockback > 0)) problems.push(`${at}: knockback must be > 0`);
  const only = (field: string, present: boolean, attack: string): void => {
    if (present && h.attack !== attack) problems.push(`${at}: ${field} is only for '${attack}' attacks`);
  };
  only('burn', h.burn !== undefined, 'bolt');
  only('projectileSpeed', h.projectileSpeed !== undefined, 'bolt');
  only('wetMult', h.wetMult !== undefined, 'zap');
  only('dashSpeed', h.dashSpeed !== undefined, 'dash');
  if (h.attack === 'bolt') {
    if (!positive(h.projectileSpeed)) problems.push(`${at}: a bolt needs projectileSpeed > 0`);
    // The farthest a lobbed bolt flies on flat ground is v^2 / g: it must reach its own range.
    else if ((h.projectileSpeed ?? 0) ** 2 / EMBER_BOLT_GRAVITY < h.range) problems.push(`${at}: bolts at ${h.projectileSpeed} blocks/s cannot reach ${h.range} blocks`);
    if (h.burn && !(h.burn.seconds > 0 && h.burn.perS > 0)) problems.push(`${at}: burn needs seconds and perS > 0`);
  }
  if (h.attack === 'dash' && !((h.dashSpeed ?? 0) > c.speed)) problems.push(`${at}: a dash must be faster than walking`);
  if (h.wetMult !== undefined && !(h.wetMult >= 1)) problems.push(`${at}: wetMult must be >= 1`);

  const hab = h.habitat;
  const weights = Object.entries(hab.places) as Array<[string, number]>;
  for (const [place, w] of weights) {
    if (!PLACES.has(place as SpawnPlace)) problems.push(`${at}: unknown spawn place "${place}"`);
    if (!(w >= 0)) problems.push(`${at}: spawn weight of ${place} must be >= 0`);
  }
  if (!weights.some(([, w]) => w > 0) && hab.ruin === undefined) problems.push(`${at}: it spawns nowhere (no place weight and no ruin role)`);
  if (hab.maxLoaded !== undefined && !(Number.isInteger(hab.maxLoaded) && hab.maxLoaded >= 1)) problems.push(`${at}: maxLoaded must be a whole number >= 1`);
  if (h.stationary && weights.some(([, w]) => w > 0)) problems.push(`${at}: a stationary automaton is placed with ruins, never spawned in the open`);
  problems.push(...modelProblems(c, at));
  return problems;
}

/** Problems with weapons and armour on items (spec 19.4). */
export function validateGear(items: readonly ItemDef[]): string[] {
  const problems: string[] = [];
  for (const it of items) {
    const at = `item ${it.key}`;
    if (it.weapon) {
      if (!(it.weapon.damage > 0)) problems.push(`${at}: weapon damage must be > 0`);
      if (it.weapon.stunS !== undefined && !(it.weapon.stunS > 0)) problems.push(`${at}: weapon stunS must be > 0`);
      if (!it.tool) problems.push(`${at}: a weapon needs a ToolSpec for its durability`);
    }
    if (it.tool?.kind === 'maul' && !it.weapon) problems.push(`${at}: a maul needs a weapon spec`);
    if (it.tool?.kind === 'maul' && it.tool.speed !== 1) problems.push(`${at}: a maul never mines faster (speed 1)`);
    const a = it.armour;
    if (a) {
      if (!(a.reduction >= 0 && a.reduction < 1)) problems.push(`${at}: armour reduction must be in [0, 1)`);
      if (a.warmthDrainMult !== undefined && !(a.warmthDrainMult > 0 && a.warmthDrainMult <= 1)) problems.push(`${at}: warmthDrainMult must be in (0, 1]`);
      if (a.reduction === 0 && a.warmthDrainMult === undefined) problems.push(`${at}: armour that does nothing`);
      if (it.stack !== 1) problems.push(`${at}: worn gear stacks to 1`);
    }
  }
  return problems;
}
