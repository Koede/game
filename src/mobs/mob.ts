/** Creating an animal record, rolling its drops, and the damage rule for hitting one (spec 12.5). */
import { MOB_CALL_MAX_S, MOB_CALL_MIN_S } from '../core/constants';
import { itemOrNull } from '../core/registry';
import type { CreatureSpec, Drop, ItemAmount } from '../core/types';
import type { Mob } from './types';

export function createMob(id: number, spec: CreatureSpec, x: number, y: number, z: number, yaw: number, baby: boolean, rng: () => number): Mob {
  return {
    id,
    spec,
    x,
    y,
    z,
    px: x,
    py: y,
    pz: z,
    pyaw: yaw,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    health: spec.health,
    baby,
    ageS: 0,
    state: 'idle',
    stateS: 0.5 + rng() * 2,
    tx: x,
    tz: z,
    hasTarget: false,
    eagerS: 0,
    cooldownS: 0,
    partner: 0,
    breedS: 0,
    fleeS: 0,
    fleeX: x,
    fleeZ: z,
    fleeFromPlayer: false,
    hurtS: 0,
    hitCooldownS: 0,
    callS: MOB_CALL_MIN_S + rng() * (MOB_CALL_MAX_S - MOB_CALL_MIN_S),
    deadS: 0,
    pendingDrops: null,
    deathCause: 'world',
    contactS: 0,
    onGround: false,
    inLiquid: false,
    blocked: false,
    lookYaw: NaN,
    speed: 0,
    walk: 0,
    pwalk: 0,
    head: 0,
    phead: 0,
    stuckS: 0,
  };
}

/** Rolls a creature's drop list: each entry's chance, then a count in its range. Empty counts are left out. */
export function rollDrops(drops: readonly Drop[], rng: () => number): ItemAmount[] {
  const out: ItemAmount[] = [];
  for (const d of drops) {
    if (d.chance !== undefined && rng() >= d.chance) continue;
    const count = typeof d.count === 'number' ? d.count : d.count[0] + Math.floor(rng() * (d.count[1] - d.count[0] + 1));
    if (count > 0) out.push({ item: d.item, count });
  }
  return out;
}

/**
 * Damage of one hit with the item in hand (spec 12.5): 1 by hand or with anything that is not a tool, an axe
 * tier + 2, a pickaxe or shovel tier + 1, a hoe 1. Tools lose 1 durability per hit (the caller wears them).
 */
export function hitDamage(heldItem: string | null): number {
  const tool = heldItem ? itemOrNull(heldItem)?.tool : undefined;
  if (!tool) return 1;
  if (tool.kind === 'axe') return tool.tier + 2;
  if (tool.kind === 'pickaxe' || tool.kind === 'shovel') return tool.tier + 1;
  return 1;
}
