/**
 * Safe zones (spec 19.2-19.4): the warm zone of every furnace at or above FURNACE_HOT_C (its block's warmth radius)
 * and the radius of every powered ward beacon. Automatons never step into one and none spawn inside one.
 *
 * The list is cached: the simulation marks it stale only when something that decides it changes - a furnace crossing
 * the hot threshold (its active bit), a beacon gaining or losing power, a furnace changing tier, a furnace or beacon
 * placed, removed or reloaded - and it is rebuilt on the next query. A query is a short loop over a handful of zones.
 */
import { FURNACE_HOT_C, WARD_BEACON_RADIUS } from '../core/constants';
import { block, furnaceTier, machine } from '../core/registry';
import { isFurnace, type FurnaceEntity, type SimNode } from './entities';

export type SafeZoneKind = 'furnace' | 'beacon';

/** A sphere automatons keep out of: centred on the middle of the block, `radius` in blocks (inclusive, Euclidean). */
export interface SafeZone {
  readonly kind: SafeZoneKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

/** What the mob manager asks of the simulation (structural: any object with these members will do). */
export interface SafeZoneQuery {
  /** True when the point (world coordinates, e.g. a mob's feet or a spawn spot's centre) lies inside any safe zone. */
  isSafe(x: number, y: number, z: number): boolean;
  /** The first zone containing the point, or null - for steering away from its centre. */
  safeZoneAt(x: number, y: number, z: number): SafeZone | null;
  /** Every zone. The array is replaced, never mutated, when the zones change; treat it as read-only. */
  safeZones(): readonly SafeZone[];
  /** Grows by one each time the zones change, so callers can cache what they derive from them. */
  readonly safeZonesVersion: number;
}

const BEACON_RADIUS = machine('ward_beacon').params?.radius ?? WARD_BEACON_RADIUS;
const LIGHTHOUSE_RADIUS = machine('lighthouse_lamp').params?.radius ?? WARD_BEACON_RADIUS;

/** The warm-zone radius of a furnace of this tier: its block's warmth radius while active. */
export const furnaceWarmRadius = (tier: number): number => block(furnaceTier(tier).block).warmthActive;

/** Whether a furnace counts as a safe zone now. */
export const furnaceIsHot = (e: FurnaceEntity): boolean => e.tempC >= FURNACE_HOT_C;

/** Whether a node's state decides a zone (a furnace, a ward beacon). */
export const guardsZone = (node: SimNode): boolean => isFurnace(node.e) || node.e.kind === 'ward_beacon' || node.e.kind === 'lighthouse_lamp';

export class SafeZones {
  private zones: readonly SafeZone[] = [];
  private stale = true;
  version = 0;
  /** Rebuilds so far: a diagnostic for tests. */
  rebuilds = 0;

  constructor(private readonly nodes: () => readonly SimNode[]) {}

  /** Something that decides the zones changed: rebuild on the next query. */
  invalidate(): void {
    this.stale = true;
  }

  list(): readonly SafeZone[] {
    if (this.stale) this.rebuild();
    return this.zones;
  }

  at(x: number, y: number, z: number): SafeZone | null {
    const zones = this.list();
    for (let i = 0; i < zones.length; i++) {
      const s = zones[i];
      const dx = x - s.x;
      const dy = y - s.y;
      const dz = z - s.z;
      if (dx * dx + dy * dy + dz * dz <= s.radius * s.radius) return s;
    }
    return null;
  }

  private rebuild(): void {
    this.stale = false;
    this.rebuilds++;
    const next: SafeZone[] = [];
    for (const n of this.nodes()) {
      const e = n.e;
      if (isFurnace(e)) {
        if (furnaceIsHot(e)) next.push({ kind: 'furnace', x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5, radius: furnaceWarmRadius(e.tier) });
      } else if (e.kind === 'ward_beacon' && n.active) {
        next.push({ kind: 'beacon', x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5, radius: BEACON_RADIUS });
      } else if (e.kind === 'lighthouse_lamp' && n.active) {
        // A lit lighthouse lamp (docs/api/optics.md) wards like a beacon; its sphere reaches down the tower to the ground.
        next.push({ kind: 'beacon', x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5, radius: LIGHTHOUSE_RADIUS });
      }
    }
    if (!sameZones(this.zones, next)) {
      this.zones = next;
      this.version++;
    }
  }
}

function sameZones(a: readonly SafeZone[], b: readonly SafeZone[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const p = a[i];
    const q = b[i];
    if (p.kind !== q.kind || p.x !== q.x || p.y !== q.y || p.z !== q.z || p.radius !== q.radius) return false;
  }
  return true;
}
