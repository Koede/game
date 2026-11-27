/** The clocks of one simulated animal: interpolation history, flash, ageing, eagerness, cooldown, healing, flight. */
import { MOB_GROW_UP_S } from '../core/constants';
import type { IWorld } from '../core/types';
import { bodyHeight, halfWidth } from './brain';
import { HEAL_EVERY_S, WINTER_YIELD_RATE } from './constants';
import { embedded } from './physics';
import type { Mob } from './types';

/**
 * Advances an animal's timers by dt. A corpse only counts its time since death and slides to a stop; the
 * return value is false for it (no behaviour to run). A player-hurt animal keeps fleeing from where the player
 * is now. Babies past MOB_GROW_UP_S are left for the caller to grow up (growUp).
 */
export function advanceTimers(m: Mob, dt: number, player: { x: number; z: number }, winter = false): boolean {
  m.px = m.x;
  m.py = m.y;
  m.pz = m.z;
  m.pyaw = m.yaw;
  m.pwalk = m.walk;
  m.phead = m.head;
  if (m.hurtS > 0) m.hurtS = Math.max(0, m.hurtS - dt);
  if (m.hitCooldownS > 0) m.hitCooldownS -= dt;
  if (m.state === 'dying') {
    m.deadS += dt;
    m.vx *= 0.8;
    m.vz *= 0.8;
    return false;
  }
  m.ageS += dt;
  if (m.eagerS > 0) m.eagerS = Math.max(0, m.eagerS - dt);
  if (m.cooldownS > 0) m.cooldownS = Math.max(0, m.cooldownS - dt);
  if (m.milkS > 0) m.milkS = Math.max(0, m.milkS - dt);
  // Winter slows wool and laying to half pace.
  const slow = winter ? WINTER_YIELD_RATE : 1;
  if (m.woolS > 0) m.woolS = Math.max(0, m.woolS - dt * slow);
  if (m.eggS > 0) m.eggS = Math.max(0, m.eggS - dt * slow);
  // Slow natural healing (healS starts negative after a hurt), so the odd scrape does not add up to a death.
  if (m.health < m.spec.health) {
    m.healS += dt;
    if (m.healS >= HEAL_EVERY_S) {
      m.health = Math.min(m.spec.health, m.health + 1);
      m.healS = 0;
    }
  } else m.healS = 0;
  if (m.fleeS > 0) {
    m.fleeS = Math.max(0, m.fleeS - dt);
    if (m.fleeFromPlayer) {
      m.fleeX = player.x;
      m.fleeZ = player.z;
    }
  }
  return true;
}

/** A baby comes of age: its body doubles, so lift it out of anything it now overlaps. */
export function growUp(world: IWorld, m: Mob): void {
  if (!m.baby || m.ageS < MOB_GROW_UP_S) return;
  m.baby = false;
  const hw = halfWidth(m);
  const h = bodyHeight(m);
  for (let i = 0; i < 4 && embedded(world, m, hw, h); i++) m.y += 0.5;
}
