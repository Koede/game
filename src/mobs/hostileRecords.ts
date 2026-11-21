/** Creating an automaton record, and its save format (part of MobsSnapshot, plain JSON). */
import { HOSTILE_HOVER_MAX, HOSTILE_HOVER_MIN, HOSTILE_SPAWN_INTERVAL_S } from '../core/constants';
import { creatureOrNull } from '../core/registry';
import type { CreatureSpec } from '../core/types';
import type { HostileRole, HostilesSnapshot, HostileState, SavedHostile } from './hostileTypes';
import { createMob } from './mob';
import type { Mob } from './types';

/** A fresh automaton: awake and roaming, unaware of the player, ready to attack. */
export function createHostile(
  id: number, spec: CreatureSpec, x: number, y: number, z: number, yaw: number, role: HostileRole, ruin: string,
  home: { x: number; y: number; z: number }, rng: () => number,
): Mob {
  const m = createMob(id, spec, x, y, z, yaw, false, rng);
  const h: HostileState = {
    role, mode: 'roam', homeX: home.x, homeY: home.y, homeZ: home.z, ruin, aware: false, unseenS: 0,
    lastX: x, lastY: y, lastZ: z, senseS: (id % 5) * 0.05, sees: false, skyOpen: false,
    periodS: spec.hostile?.cooldownS ?? 0, windS: 0, windSfx: false, dashX: 0, dashZ: 0, dashLeft: 0, dashHit: false,
    blockedS: 0, roamS: 0, stunS: 0, windDownS: 0, glow: 1, pglow: 1, provokedS: 0,
    hover: HOSTILE_HOVER_MIN + rng() * (HOSTILE_HOVER_MAX - HOSTILE_HOVER_MIN), stepAcc: 0,
  };
  m.hostile = h;
  m.lookYaw = yaw;
  return m;
}

const round = (v: number): number => Math.round(v * 1000) / 1000;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const ROLES: readonly HostileRole[] = ['natural', 'guard', 'turret'];

/** Snapshot of the automatons (corpses are left out: their drops were handed out at once). */
export function saveHostiles(mobs: readonly Mob[], guarded: ReadonlySet<string>, spawnS: number): HostilesSnapshot {
  const saved: SavedHostile[] = [];
  for (const m of mobs) {
    const h = m.hostile;
    if (!h || m.state === 'dying') continue;
    saved.push({
      id: m.id, species: m.spec.key, x: round(m.x), y: round(m.y), z: round(m.z), yaw: round(m.yaw), health: m.health,
      role: h.role, home: [round(h.homeX), round(h.homeY), round(h.homeZ)], ruin: h.ruin, dormant: h.mode === 'dormant',
      hover: round(h.hover),
    });
  }
  return { guarded: [...guarded], spawnS: round(spawnS), mobs: saved };
}

/**
 * Automatons from a snapshot (absent: none). Throws on a malformed one; skips records of unknown types or with
 * broken numbers, and ids already taken (`taken`).
 */
export function restoreHostiles(s: HostilesSnapshot | undefined, taken: ReadonlySet<number>, rng: () => number): { mobs: Mob[]; guarded: string[]; spawnS: number } {
  if (s === undefined) return { mobs: [], guarded: [], spawnS: HOSTILE_SPAWN_INTERVAL_S };
  if (!s || typeof s !== 'object' || !Array.isArray(s.mobs) || !Array.isArray(s.guarded)) throw new Error('mobs: malformed hostiles');
  const mobs: Mob[] = [];
  const seen = new Set<number>();
  for (const r of s.mobs) {
    const spec = creatureOrNull(r?.species);
    if (!spec?.hostile || !finite(r.id) || seen.has(r.id) || taken.has(r.id)) continue;
    if (![r.x, r.y, r.z, r.yaw, r.health].every(finite) || !Array.isArray(r.home) || !r.home.every(finite)) continue;
    seen.add(r.id);
    const role = ROLES.includes(r.role) ? r.role : 'natural';
    const home = { x: r.home[0], y: r.home[1], z: r.home[2] };
    const m = createHostile(r.id, spec, r.x, r.y, r.z, r.yaw, role, typeof r.ruin === 'string' ? r.ruin : '', home, rng);
    m.health = Math.min(spec.health, Math.max(0.5, r.health));
    const h = m.hostile!;
    if (r.dormant === true) {
      h.mode = 'dormant';
      h.glow = h.pglow = 0;
    }
    if (finite(r.hover)) h.hover = Math.min(HOSTILE_HOVER_MAX, Math.max(HOSTILE_HOVER_MIN, r.hover));
    mobs.push(m);
  }
  const guarded = s.guarded.filter((k): k is string => typeof k === 'string');
  return { mobs, guarded, spawnS: finite(s.spawnS) ? Math.max(0, s.spawnS) : HOSTILE_SPAWN_INTERVAL_S };
}
