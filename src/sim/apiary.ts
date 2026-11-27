/**
 * Beehives (src/content/areas/bees.ts). A hive is a block with an entity of kind 'beehive', never a machine node: Use
 * and the crosshair line reach it through the simulation's brewUse / brewView, like the boiler's gauge glass.
 *
 * - An empty hive with forage (flowers, crops, berry bushes) within `reach` is settled by a wild swarm after `settleS`
 *   seconds of flying weather.
 * - The bees fly by day, in the dry, outside winter. While they fly a settled hive fills honeycomb: one comb per
 *   `combS` seconds with `fullForage` forage blocks around it, slower with fewer, up to `maxCombs`.
 * - Crops in reach of a settled hive are pollinated while the bees fly (CropField.hiveChanged; the boost is a growth
 *   multiplier in cropRules.growthRate).
 * - Use lifts out one comb. Without a Bee Smoker in hand the bees sting first.
 * The entity is plain JSON in the world (`settled`, `settleS`, `nectarS`, `combs`), repaired on load.
 */
import type { GameBus } from '../core/context';
import { BLOCKS, machine } from '../core/registry';
import type { BlockDef, BlockEntity, IWorld } from '../core/types';
import { voxelId } from '../core/types';
import { STAGE_OF } from './cropRules';
import { posKey } from './entities';

export const HIVE_MACHINE = 'beehive';
export const BEE_SMOKER = 'bee_smoker';
export const HONEYCOMB = 'honeycomb';

const SPEC = machine(HIVE_MACHINE);
function param(name: string): number {
  const v = SPEC.params?.[name];
  if (v === undefined) throw new Error(`MachineSpec '${HIVE_MACHINE}' lacks params.${name}`);
  return v;
}
export const HIVE_REACH = param('reach');
export const POLLEN_BOOST = param('boost');
export const SETTLE_S = param('settleS');
export const COMB_S = param('combS');
export const FULL_FORAGE = param('fullForage');
export const MAX_COMBS = param('maxCombs');
/** Forage is looked for this far up and down. */
export const HIVE_DY = 2;
/** Seconds between forage counts of one hive. */
const SCAN_S = 4;
/** Damage of a sting (health is 20). */
export const STING_DAMAGE = 2;

/** Wild flowers and flowering wild plants (crop stages and berry bushes are added from cropRules). */
const FLOWERS = ['ember_poppy', 'skybell', 'frost_lily', 'wild_potato', 'wild_carrot'];
/** Whether bees forage a block, by block id: wild flowers, crops past the seedling and berry bushes. */
export const IS_FORAGE: boolean[] = BLOCKS.map((b) => {
  if (FLOWERS.includes(b.key)) return true;
  const st = STAGE_OF[b.id];
  return st !== undefined && (st.wild || st.stage >= 1);
});

export interface HiveEntity extends BlockEntity {
  kind: 'beehive';
  /** A swarm lives in it. */
  settled: boolean;
  /** Seconds of flying weather beside forage so far (until settled). */
  settleS: number;
  /** Seconds of full foraging into the next comb. */
  nectarS: number;
  /** Combs ready to lift out (0..MAX_COMBS). */
  combs: number;
}

interface Hive {
  e: HiveEntity;
  forage: number;
  scanT: number;
}

/** Why the bees stay in, or null when they fly. */
export type BeesIn = string | null;

/** What the hives need from the simulation: hurting the player, and telling the crops where the bees are. */
export interface ApiaryHost {
  sting(amount: number): void;
  hiveChanged(x: number, y: number, z: number, settled: boolean): void;
}

const finite = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export class Apiary {
  private readonly hives = new Map<string, Hive>();
  /** Why the bees stayed in on the last tick (null: flying). */
  private beesIn: BeesIn = 'not looked yet';

  constructor(readonly world: IWorld, readonly bus: GameBus, readonly host: ApiaryHost) {}

  static handles(def: BlockDef): boolean {
    return def.machine === HIVE_MACHINE;
  }

  get count(): number {
    return this.hives.size;
  }

  /** Whether the bees are flying now. */
  get flying(): boolean {
    return this.beesIn === null;
  }

  clear(): void {
    for (const h of this.hives.values()) if (h.e.settled) this.host.hiveChanged(h.e.x, h.e.y, h.e.z, false);
    this.hives.clear();
  }

  /** Follows a hive entity stored in the world (after loading): fields are repaired. */
  track(stored: BlockEntity): void {
    const e = stored as HiveEntity;
    e.settled = e.settled === true;
    e.settleS = Math.max(0, finite(e.settleS, 0));
    e.nectarS = Math.min(COMB_S, Math.max(0, finite(e.nectarS, 0)));
    e.combs = Math.min(MAX_COMBS, Math.max(0, Math.floor(finite(e.combs, 0))));
    const key = posKey(e.x, e.y, e.z);
    const was = this.hives.get(key);
    if (was?.e.settled) this.host.hiveChanged(e.x, e.y, e.z, false);
    this.hives.set(key, { e, forage: -1, scanT: 0 });
    if (e.settled) this.host.hiveChanged(e.x, e.y, e.z, true);
  }

  /** A beehive block now stands at x,y,z: adopt the stored entity or start an empty hive. */
  place(x: number, y: number, z: number): void {
    if (this.hives.has(posKey(x, y, z))) return;
    const stored = this.world.getEntity(x, y, z);
    if (stored && stored.kind === HIVE_MACHINE) this.track(stored);
    else {
      const e: HiveEntity = { kind: 'beehive', x, y, z, settled: false, settleS: 0, nectarS: 0, combs: 0 };
      this.world.setEntity(e);
      this.track(e);
    }
  }

  /** The hive at x,y,z is gone: the swarm leaves with it. */
  remove(x: number, y: number, z: number): void {
    const key = posKey(x, y, z);
    const h = this.hives.get(key);
    if (!h) return;
    this.hives.delete(key);
    if (h.e.settled) this.host.hiveChanged(x, y, z, false);
    if (this.world.getEntity(x, y, z) === h.e) this.world.removeEntity(x, y, z);
  }

  /** Advances every loaded hive. `beesIn` says why the bees stay in this tick (null: they fly). */
  tick(dt: number, beesIn: BeesIn): void {
    this.beesIn = beesIn;
    if (this.hives.size === 0) return;
    for (const h of this.hives.values()) {
      const e = h.e;
      if (!this.world.isLoaded(e.x, e.z)) continue;
      h.scanT -= dt;
      if (h.forage < 0 || h.scanT <= 0) {
        h.forage = this.countForage(e.x, e.y, e.z);
        h.scanT = SCAN_S;
      }
      if (beesIn !== null || h.forage === 0) continue;
      if (!e.settled) {
        e.settleS += dt;
        if (e.settleS >= SETTLE_S) {
          e.settled = true;
          this.host.hiveChanged(e.x, e.y, e.z, true);
          this.bus.emit('toast', { text: 'A swarm of wild bees has moved into your beehive', kind: 'good', item: 'beehive' });
          this.bus.emit('sfx', { name: 'place', x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5, pitch: 1.6, volume: 0.4 });
        }
        continue;
      }
      if (e.combs >= MAX_COMBS) continue;
      e.nectarS += dt * Math.min(1, h.forage / FULL_FORAGE);
      if (e.nectarS >= COMB_S) {
        e.nectarS -= COMB_S;
        e.combs++;
        if (e.combs >= MAX_COMBS) e.nectarS = 0;
      }
    }
  }

  /** Settled hives whose bees are out now, for the bee particles (positions of the hive blocks). */
  buzzing(): Array<{ x: number; y: number; z: number; forage: number }> {
    const out: Array<{ x: number; y: number; z: number; forage: number }> = [];
    if (this.beesIn !== null) return out;
    for (const h of this.hives.values()) if (h.e.settled && h.forage > 0) out.push({ x: h.e.x, y: h.e.y, z: h.e.z, forage: h.forage });
    return out;
  }

  /** The hive entity at x,y,z (tests and diagnostics). */
  entityAt(x: number, y: number, z: number): HiveEntity | null {
    return this.hives.get(posKey(x, y, z))?.e ?? null;
  }

  /** The crosshair line of the hive at x,y,z, or null when there is none. */
  text(x: number, y: number, z: number): string | null {
    const h = this.hives.get(posKey(x, y, z));
    if (!h) return null;
    const e = h.e;
    if (h.forage < 0) h.forage = this.countForage(x, y, z);
    if (!e.settled) {
      if (h.forage === 0) return `Beehive - empty: needs flowers within ${HIVE_REACH}`;
      if (this.beesIn !== null) return 'Beehive - empty, a swarm comes by day';
      return 'Beehive - empty, wild bees scouting it';
    }
    const ready = e.combs === 0 ? '' : `, ${e.combs} ready`;
    if (e.combs >= MAX_COMBS) return `Beehive - full: ${e.combs} combs, Use to take`;
    if (this.beesIn !== null) return `Beehive - ${this.beesIn}${ready}`;
    if (h.forage === 0) return `Beehive - no flowers near${ready}`;
    return `Beehive - busy on ${h.forage} flowers, comb ${Math.floor((e.nectarS / COMB_S) * 100)}%${ready}`;
  }

  /** Use on a hive: lift one comb out (null: not a hive). */
  use(x: number, y: number, z: number, held: string | null): { ok: true; consume: boolean; give?: string; toast?: string } | { ok: false; reason: string } | null {
    const h = this.hives.get(posKey(x, y, z));
    if (!h || this.world.getBlock(x, y, z).machine !== HIVE_MACHINE) return null;
    const e = h.e;
    if (!e.settled) return { ok: false, reason: this.text(x, y, z) ?? 'Beehive' };
    if (e.combs <= 0) return { ok: false, reason: this.text(x, y, z) ?? 'Beehive' };
    e.combs--;
    const left = e.combs === 0 ? '' : ` (${e.combs} left)`;
    if (held !== BEE_SMOKER) {
      this.host.sting(STING_DAMAGE);
      return { ok: true, consume: false, give: HONEYCOMB, toast: `Ouch, stung! Honeycomb taken${left}. A Bee Smoker calms them` };
    }
    return { ok: true, consume: false, give: HONEYCOMB, toast: `The smoke calms the bees: honeycomb taken${left}` };
  }

  private countForage(x: number, y: number, z: number): number {
    let n = 0;
    for (let dy = -HIVE_DY; dy <= HIVE_DY; dy++) {
      for (let dz = -HIVE_REACH; dz <= HIVE_REACH; dz++) {
        for (let dx = -HIVE_REACH; dx <= HIVE_REACH; dx++) {
          if (IS_FORAGE[voxelId(this.world.getVoxel(x + dx, y + dy, z + dz))]) n++;
        }
      }
    }
    return n;
  }
}
