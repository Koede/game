/**
 * Drawbridges (docs/api/lifts.md). A `drawbridge` block is a workshop part: it joins shaft networks and, while its network
 * turns, runs a line of `bridge_deck` slabs out across the gap (away from where you stood to place it, the side its back
 * faces), one plank every `stepSeconds(rpm)`, up to `DECK_MAX` blocks or until something solid is in the way. Wound the other
 * way it lifts them back in, last first, and puts back what was there (water stays water). Without power it holds.
 *
 * Which way: Use on it flips out / in (the setting is saved). A signal cell touching it decides instead: lit = out.
 * Pure of the DOM; owned by the Workshop, which hands in its rpm and signal gate.
 */
import type { GameBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { Facing, makeVoxel, voxelFacing, voxelId, type IWorld, type Voxel } from '../core/types';

export const DRAWBRIDGE = 'drawbridge';
export const DECK = 'bridge_deck';
/** Longest deck a drawbridge runs out. */
export const DECK_MAX = 16;
/** Seconds per plank at 16 rpm; faster shafts lay faster. */
export const DECK_STEP_S = 0.35;

const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;
/** The way a drawbridge lays its deck: opposite its front (its front faces the player who placed it). */
const OUT: Record<number, [number, number]> = { [Facing.North]: [0, 1], [Facing.East]: [-1, 0], [Facing.South]: [0, -1], [Facing.West]: [1, 0] };

export const stepSeconds = (rpm: number): number => Math.max(0.1, Math.min(1.2, (DECK_STEP_S * 16) / Math.max(1, Math.abs(rpm))));

interface Bridge {
  x: number;
  y: number;
  z: number;
  /** Planks laid so far, and what each replaced (restored when it is lifted). */
  under: Voxel[];
  /** Out (true) or in, when no signal decides. */
  out: boolean;
  timer: number;
  /** Last move: 1 laying, -1 lifting, 0 still (for the goggles and the face). */
  moving: number;
}

export interface DrawbridgeSnapshot {
  v: 1;
  bridges: { x: number; y: number; z: number; under: number[]; out: boolean }[];
}

export interface DrawbridgeHost {
  world: IWorld;
  bus: GameBus;
  /** Signed rpm of the part at the cell (0 still). */
  rpmAt: (x: number, y: number, z: number) => number;
  /** True when a signal cell touches the cell. */
  signalled: (x: number, y: number, z: number) => boolean;
  /** True when a powered signal cell touches the cell. */
  lit: (x: number, y: number, z: number) => boolean;
}

export class Drawbridges {
  private readonly bridges = new Map<string, Bridge>();

  constructor(private readonly host: DrawbridgeHost) {}

  /** Called by the workshop for every block change. */
  noteBlock(x: number, y: number, z: number, kind: string): void {
    const key = k3(x, y, z);
    if (kind === DRAWBRIDGE) {
      if (!this.bridges.has(key)) this.bridges.set(key, { x, y, z, under: [], out: true, timer: 0, moving: 0 });
    } else this.bridges.delete(key);
  }

  /** Use on a drawbridge: flips out / in. Null = not a drawbridge. */
  use(x: number, y: number, z: number): 'worked' | null {
    const b = this.find(x, y, z);
    if (!b) return null;
    if (this.host.signalled(x, y, z)) {
      this.host.bus.emit('toast', { text: 'A signal decides this drawbridge: lit lowers the deck, unlit lifts it', kind: 'info' });
      return 'worked';
    }
    b.out = !b.out;
    this.host.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: b.out ? 1.2 : 0.8, volume: 0.5 });
    const turning = this.host.rpmAt(x, y, z) !== 0;
    const what = b.out ? 'Set to lower the deck across' : 'Set to lift the deck in';
    this.host.bus.emit('toast', { text: turning ? what : `${what} - it moves while its shaft turns`, kind: 'info' });
    return 'worked';
  }

  /** The drawbridge at the cell (the voxel must still be one). */
  private find(x: number, y: number, z: number): Bridge | null {
    if (this.host.world.getBlock(x, y, z).key !== DRAWBRIDGE) return null;
    const key = k3(x, y, z);
    let b = this.bridges.get(key);
    if (!b) this.bridges.set(key, (b = { x, y, z, under: [], out: true, timer: 0, moving: 0 }));
    return b;
  }

  tick(dt: number): void {
    const { world } = this.host;
    for (const [key, b] of this.bridges) {
      if (!world.isLoaded(b.x, b.z)) continue;
      const v = world.getVoxel(b.x, b.y, b.z);
      if (BLOCKS[voxelId(v)]?.key !== DRAWBRIDGE) {
        this.bridges.delete(key);
        continue;
      }
      const rpm = this.host.rpmAt(b.x, b.y, b.z);
      const wantOut = this.host.signalled(b.x, b.y, b.z) ? this.host.lit(b.x, b.y, b.z) : b.out;
      b.moving = 0;
      if (rpm === 0) {
        b.timer = 0;
        continue;
      }
      b.timer += dt;
      const step = stepSeconds(rpm);
      while (b.timer >= step) {
        b.timer -= step;
        const moved = wantOut ? this.lay(b, voxelFacing(v)) : this.lift(b, voxelFacing(v));
        if (!moved) {
          b.timer = 0;
          break;
        }
        b.moving = wantOut ? 1 : -1;
      }
    }
  }

  /** Lays the next plank. False when the deck is full length or the next cell is taken. */
  private lay(b: Bridge, facing: Facing): boolean {
    if (b.under.length >= DECK_MAX) return false;
    const [dx, dz] = OUT[facing] ?? [0, 1];
    const n = b.under.length + 1;
    const x = b.x + dx * n;
    const z = b.z + dz * n;
    const { world, bus } = this.host;
    if (!world.isLoaded(x, z)) return false;
    const was = world.getVoxel(x, b.y, z);
    const def = BLOCKS[voxelId(was)];
    if (!def || !(def.key === 'air' || def.replaceable || def.shape === 'liquid')) return false;
    if (!world.setVoxel(x, b.y, z, makeVoxel(blockId(DECK), facing), 'sim')) return false;
    b.under.push(was);
    bus.emit('sfx', { name: 'step_wood', x: x + 0.5, y: b.y + 0.5, z: z + 0.5, pitch: 0.8 + (n % 4) * 0.08, volume: 0.6 });
    return true;
  }

  /** Lifts the last plank and puts back what was under it. False when the deck is all in. */
  private lift(b: Bridge, facing: Facing): boolean {
    if (b.under.length === 0) return false;
    const [dx, dz] = OUT[facing] ?? [0, 1];
    const n = b.under.length;
    const x = b.x + dx * n;
    const z = b.z + dz * n;
    const { world, bus } = this.host;
    if (!world.isLoaded(x, z)) return false;
    const was = b.under.pop() as Voxel;
    // Only our own plank is lifted: one somebody broke or built over stays as it is.
    if (world.getBlock(x, b.y, z).key === DECK) {
      world.setVoxel(x, b.y, z, was, 'sim');
      bus.emit('sfx', { name: 'step_wood', x: x + 0.5, y: b.y + 0.5, z: z + 0.5, pitch: 0.7, volume: 0.5 });
    }
    return true;
  }

  /** Goggles / crosshair text. */
  describe(x: number, y: number, z: number): string | null {
    const b = this.bridges.get(k3(x, y, z));
    if (!b) return null;
    const signalled = this.host.signalled(x, y, z);
    const out = signalled ? this.host.lit(x, y, z) : b.out;
    const doing = b.moving > 0 ? 'lowering' : b.moving < 0 ? 'lifting' : this.host.rpmAt(x, y, z) === 0 ? 'still' : out ? 'down' : 'up';
    return `deck ${b.under.length}/${DECK_MAX}, ${doing}${signalled ? ' (signal)' : `, set to ${out ? 'lower' : 'lift'}`}`;
  }

  /** Planks out for the drawbridge at the cell (tests, debug), or -1. */
  length(x: number, y: number, z: number): number {
    return this.bridges.get(k3(x, y, z))?.under.length ?? -1;
  }

  /** Keeps per-block state with a structure a piston or bearing moved. */
  relocate(map: ReadonlyMap<string, [number, number, number]>): void {
    const moved: Bridge[] = [];
    for (const [from, to] of map) {
      const b = this.bridges.get(from);
      if (!b) continue;
      this.bridges.delete(from);
      [b.x, b.y, b.z] = to;
      b.under = []; // the deck stays where it was laid
      moved.push(b);
    }
    for (const b of moved) this.bridges.set(k3(b.x, b.y, b.z), b);
  }

  toJSON(): DrawbridgeSnapshot {
    return { v: 1, bridges: [...this.bridges.values()].map((b) => ({ x: b.x, y: b.y, z: b.z, under: [...b.under], out: b.out })) };
  }

  load(raw: unknown): void {
    this.bridges.clear();
    const o = raw && typeof raw === 'object' ? (raw as Partial<DrawbridgeSnapshot>) : null;
    if (!o || !Array.isArray(o.bridges)) return;
    for (const s of o.bridges) {
      if (!s || ![s.x, s.y, s.z].every((n) => Number.isInteger(n))) continue;
      const under = Array.isArray(s.under) ? s.under.filter((n) => Number.isInteger(n) && n >= 0).slice(0, DECK_MAX) : [];
      this.bridges.set(k3(s.x, s.y, s.z), { x: s.x, y: s.y, z: s.z, under, out: s.out !== false, timer: 0, moving: 0 });
    }
  }
}
