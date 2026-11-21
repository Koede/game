/**
 * The Bronze workshop at runtime (docs/api/workshop.md, docs/OVERHAUL_PLAN.md A.2-A.5). Kinetic parts (hand cranks,
 * drive shafts, conveyor belts, mechanical twins of the hand stations) join on every side into networks. A network turns
 * while any crank in it was cranked in the last CRANK_S seconds (rpm CRANK_RPM) and its stress fits: every turning crank
 * gives CRANK_CAPACITY stress units, every part costs STRESS[kind]; over capacity the network is overstressed and stops.
 *
 * Belts move loose ground items lying on them away from the side they were laid from; at a belt's end a machine takes
 * them in. Machines also take items dropped on their top (or put in by Use). A machine works its station's stroke
 * recipes in strokes x STROKE_S seconds at 16 rpm, and puts the output out of its front as ground items.
 *
 * When the planned shaft core (STEAM_PLAN mechGraph/mech) lands, cranks become one source among many: `extraRpm` lets
 * it feed speed into these networks without changing anything else here.
 */
import type { GameBus } from '../core/context';
import { blockOrNull, itemOrNull, recipesAt } from '../core/registry';
import { Facing, makeVoxel, voxelActive, voxelFacing, withActive, type IWorld, type RecipeDef } from '../core/types';
import { MECH_TWINS } from '../content/itemsWorkshop';
import type { GroundItems } from '../game/groundItems';

export const CRANK_RPM = 16;
/** Seconds a crank keeps turning after one Use (holding Use repeats it). */
export const CRANK_S = 2.5;
/** Stress units one turning crank carries. */
export const CRANK_CAPACITY = 8;
/** Stress units per part (cranks and shafts cost nothing). */
export const STRESS: Record<string, number> = { conveyor_belt: 0.25, mech_saw: 4, mech_millstone: 4, mech_mortar: 4, mech_loom: 2 };
/** Seconds per recipe stroke at 16 rpm. */
export const STROKE_S = 0.5;
/** Blocks per second a belt moves items at 16 rpm. */
export const BELT_SPEED = 1;
/** Most items a machine holds waiting to be worked. */
export const MACHINE_BUFFER = 16;
/** Most parts in one network (keeps a runaway search cheap). */
export const MAX_NET = 512;

const KINETIC = new Set(['hand_crank', 'drive_shaft', 'conveyor_belt', ...MECH_TWINS.map((t) => t.block)]);
const TWIN = new Map(MECH_TWINS.map((t) => [t.block, t]));

export const isKinetic = (key: string): boolean => KINETIC.has(key);

const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** Facing -> unit vector of the side the block faces (North = -Z). */
export const FACE_VEC: Record<number, [number, number]> = { [Facing.North]: [0, -1], [Facing.East]: [1, 0], [Facing.South]: [0, 1], [Facing.West]: [-1, 0] };

interface Part { x: number; y: number; z: number; kind: string }
interface MachineState { buffer: Record<string, number>; progress: number; recipe: string | null }
export interface NetInfo { rpm: number; stress: number; capacity: number; overstressed: boolean; parts: number }

export interface WorkshopSnapshot {
  v: 1;
  parts: [number, number, number, string][];
  machines: [number, number, number, Record<string, number>, number, string | null][];
}

const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export class Workshop {
  private readonly parts = new Map<string, Part>();
  private readonly cranks = new Map<string, number>();
  private readonly machines = new Map<string, MachineState>();
  /** rpm of every turning part this tick, and the network facts per part. */
  private readonly speed = new Map<string, number>();
  private readonly netOf = new Map<string, NetInfo>();
  private readonly seizedWarned = new Set<string>();
  /** More speed sources (the shaft core later): rpm a part gets from outside, or 0. */
  extraRpm: ((x: number, y: number, z: number) => number) | null = null;
  private readonly off: () => void;

  constructor(private readonly world: IWorld, private readonly bus: GameBus, private readonly ground: GroundItems, private readonly rng: () => number = Math.random) {
    this.off = bus.on('block:changed', (e) => this.noteBlock(e.x, e.y, e.z));
  }

  dispose(): void {
    this.off();
  }

  private noteBlock(x: number, y: number, z: number): void {
    const key = k3(x, y, z);
    const kind = this.world.getBlock(x, y, z).key;
    if (KINETIC.has(kind)) {
      const was = this.parts.get(key);
      if (!was || was.kind !== kind) {
        this.parts.set(key, { x, y, z, kind });
        if (TWIN.has(kind)) this.machines.set(key, { buffer: {}, progress: 0, recipe: null });
      }
      return;
    }
    if (!this.parts.has(key)) return;
    const m = this.machines.get(key);
    // A broken machine drops what it held.
    if (m) for (const [item, n] of Object.entries(m.buffer)) if (n > 0) this.ground.spawn(item, n, x + 0.5, y + 0.5, z + 0.5);
    this.parts.delete(key);
    this.machines.delete(key);
    this.cranks.delete(key);
  }

  // ---- Use ------------------------------------------------------------------------------------------

  /** Use on a part: crank a crank; put the held item into a machine. Null = not ours. */
  use(x: number, y: number, z: number, held: { item: string; count: number } | null, takeHeld: (n: number) => void): 'worked' | 'refused' | null {
    const key = k3(x, y, z);
    const part = this.parts.get(key) ?? (KINETIC.has(this.world.getBlock(x, y, z).key) ? (this.noteBlock(x, y, z), this.parts.get(key)) : undefined);
    if (!part) return null;
    if (part.kind === 'hand_crank') {
      if (held && blockOrNull(held.item)) return null; // a held block is placed against it as usual
      const first = !this.cranks.has(key) || (this.cranks.get(key) ?? 0) <= 0;
      this.cranks.set(key, CRANK_S);
      if (first) this.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 0.6, volume: 0.5 });
      return 'worked';
    }
    const twin = TWIN.get(part.kind);
    if (twin && held && this.recipeFor(part.kind, held.item)) {
      const n = Math.min(held.count, this.space(key));
      if (n <= 0) {
        this.bus.emit('toast', { text: `The ${twin.name} is full`, kind: 'info' });
        return 'refused';
      }
      this.intake(key, held.item, n);
      takeHeld(n);
      return 'worked';
    }
    return null;
  }

  // ---- Simulation -------------------------------------------------------------------------------------

  tick(dt: number): void {
    for (const [k, s] of this.cranks) {
      if (s - dt <= 0) this.cranks.delete(k);
      else this.cranks.set(k, s - dt);
    }
    this.solve();
    this.showActive();
    this.moveBelts(dt);
    this.work(dt);
  }

  private solve(): void {
    this.speed.clear();
    this.netOf.clear();
    const seen = new Set<string>();
    for (const [start, part] of this.parts) {
      if (seen.has(start)) continue;
      const members: string[] = [];
      const queue = [start];
      seen.add(start);
      while (queue.length && members.length < MAX_NET) {
        const key = queue.pop() as string;
        members.push(key);
        const p = this.parts.get(key) as Part;
        for (const [dx, dy, dz] of DIRS) {
          const n = k3(p.x + dx, p.y + dy, p.z + dz);
          if (!seen.has(n) && this.parts.has(n)) {
            seen.add(n);
            queue.push(n);
          }
        }
      }
      let rpm = 0;
      let capacity = 0;
      let stress = 0;
      for (const key of members) {
        const p = this.parts.get(key) as Part;
        stress += STRESS[p.kind] ?? 0;
        if (p.kind === 'hand_crank' && this.cranks.has(key)) {
          rpm = Math.max(rpm, CRANK_RPM);
          capacity += CRANK_CAPACITY;
        }
        const extra = this.extraRpm?.(p.x, p.y, p.z) ?? 0;
        if (extra > 0) {
          rpm = Math.max(rpm, extra);
          capacity += CRANK_CAPACITY;
        }
      }
      const overstressed = rpm > 0 && stress > capacity;
      const info: NetInfo = { rpm: overstressed ? 0 : rpm, stress, capacity, overstressed, parts: members.length };
      for (const key of members) {
        this.netOf.set(key, info);
        if (info.rpm > 0) this.speed.set(key, info.rpm);
      }
      if (overstressed && !this.seizedWarned.has(start)) {
        this.seizedWarned.add(start);
        const p = part;
        this.bus.emit('toast', { text: `Too much load: ${stress} on ${capacity} stress units. Add a crank or take a machine off`, kind: 'warn' });
        this.bus.emit('sfx', { name: 'error', x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
      } else if (!overstressed) this.seizedWarned.delete(start);
    }
  }

  /** Mirrors "turning" in each part's ACTIVE bit (only on change: the mesher redraws a chunk per change). */
  private showActive(): void {
    for (const [key, p] of this.parts) {
      const v = this.world.getVoxel(p.x, p.y, p.z);
      const on = this.speed.has(key);
      if (voxelActive(v) !== on) this.world.setVoxel(p.x, p.y, p.z, withActive(v, on), 'sim');
    }
  }

  private moveBelts(dt: number): void {
    if (this.speed.size === 0) return;
    for (const e of this.ground.items) {
      if (e.homing) continue;
      const bx = Math.floor(e.x);
      const by = Math.floor(e.y - 0.05);
      const bz = Math.floor(e.z);
      const key = k3(bx, by, bz);
      const part = this.parts.get(key);
      if (!part || part.kind !== 'conveyor_belt') continue;
      const rpm = this.speed.get(key) ?? 0;
      if (rpm <= 0) continue;
      const [fx, fz] = FACE_VEC[voxelFacing(this.world.getVoxel(bx, by, bz))];
      const dx = -fx;
      const dz = -fz;
      const step = (BELT_SPEED * rpm) / 16 * dt;
      // Keep items on the middle line of the belt.
      const cx = bx + 0.5;
      const cz = bz + 0.5;
      if (dx !== 0) e.z += Math.sign(cz - e.z) * Math.min(Math.abs(cz - e.z), 2 * dt);
      else e.x += Math.sign(cx - e.x) * Math.min(Math.abs(cx - e.x), 2 * dt);
      // At the end: a machine in front takes the item; anything else solid stops it.
      const ahead = { x: bx + dx, y: by, z: bz + dz };
      const along = dx !== 0 ? (e.x - cx) * dx : (e.z - cz) * dz;
      if (along + step > 0.3) {
        const front = this.world.getBlock(ahead.x, ahead.y, ahead.z);
        const twinKey = k3(ahead.x, ahead.y, ahead.z);
        if (TWIN.has(front.key) && this.recipeFor(front.key, e.item) && this.space(twinKey) >= e.count) {
          this.intake(twinKey, e.item, e.count);
          e.count = 0;
          continue;
        }
        if (front.solid && front.key !== 'conveyor_belt') continue;
      }
      e.x += dx * step;
      e.z += dz * step;
      e.vx = 0;
      e.vz = 0;
    }
    // Items taken in by machines leave the world.
    for (let i = this.ground.items.length - 1; i >= 0; i--) if (this.ground.items[i].count <= 0) this.ground.items.splice(i, 1);
  }

  private recipeFor(kind: string, item: string): RecipeDef | null {
    const twin = TWIN.get(kind);
    if (!twin) return null;
    return recipesAt(twin.station).find((r) => r.inputs[0]?.item === item && (r.strokes ?? 0) > 0) ?? null;
  }

  private space(key: string): number {
    const m = this.machines.get(key);
    if (!m) return 0;
    return MACHINE_BUFFER - Object.values(m.buffer).reduce((s, n) => s + n, 0);
  }

  private intake(key: string, item: string, n: number): void {
    const m = this.machines.get(key);
    if (!m) return;
    m.buffer[item] = (m.buffer[item] ?? 0) + n;
  }

  private work(dt: number): void {
    for (const [key, m] of this.machines) {
      const p = this.parts.get(key);
      if (!p) continue;
      const rpm = this.speed.get(key) ?? 0;
      if (rpm <= 0) continue;
      this.takeFromTop(key, p);
      const r = m.recipe ? recipesAt(TWIN.get(p.kind)!.station).find((x) => x.id === m.recipe) ?? null : this.nextRecipe(p.kind, m);
      if (!r) {
        m.recipe = null;
        m.progress = 0;
        continue;
      }
      m.recipe = r.id;
      const need = (r.strokes ?? 1) * STROKE_S;
      m.progress += (dt * rpm) / 16;
      if (m.progress < need) continue;
      m.progress = 0;
      m.recipe = null;
      const input = r.inputs[0];
      if ((m.buffer[input.item] ?? 0) < input.count) continue;
      m.buffer[input.item] -= input.count;
      if (m.buffer[input.item] <= 0) delete m.buffer[input.item];
      const out = r.toolOutput ?? r.output;
      let count = out.count;
      if (r.bonus && this.rng() < r.bonus.chance) count += r.bonus.count;
      this.emitFront(p, out.item, count);
      this.bus.emit('item:made', { item: out.item, count, station: p.kind, recipeId: r.id });
    }
  }

  private nextRecipe(kind: string, m: MachineState): RecipeDef | null {
    for (const [item, n] of Object.entries(m.buffer)) {
      const r = this.recipeFor(kind, item);
      if (r && n >= r.inputs[0].count) return r;
    }
    return null;
  }

  private takeFromTop(key: string, p: Part): void {
    for (const e of this.ground.items) {
      if (e.count <= 0 || e.homing) continue;
      // Lying on the machine's top face.
      if (Math.floor(e.x) !== p.x || Math.floor(e.z) !== p.z || e.y < p.y + 0.9 || e.y > p.y + 1.6) continue;
      if (!this.recipeFor(p.kind, e.item)) continue;
      const n = Math.min(e.count, this.space(key));
      if (n <= 0) continue;
      this.intake(key, e.item, n);
      e.count -= n;
    }
    for (let i = this.ground.items.length - 1; i >= 0; i--) if (this.ground.items[i].count <= 0) this.ground.items.splice(i, 1);
  }

  private emitFront(p: Part, item: string, count: number): void {
    const [fx, fz] = FACE_VEC[voxelFacing(this.world.getVoxel(p.x, p.y, p.z))];
    this.ground.spawn(item, count, p.x + 0.5 + fx * 0.75, p.y + 0.3, p.z + 0.5 + fz * 0.75, { scatter: false, vx: fx * 1.2, vy: 1, vz: fz * 1.2, delayS: 1 });
  }

  // ---- Views ------------------------------------------------------------------------------------------

  netAt(x: number, y: number, z: number): NetInfo | null {
    return this.netOf.get(k3(x, y, z)) ?? null;
  }

  /** One line for the goggles / the crosshair: "Millstone - 16 rpm, load 4.25/8 su, flour 40%". */
  describe(x: number, y: number, z: number): string | null {
    const key = k3(x, y, z);
    const p = this.parts.get(key);
    if (!p) return null;
    const name = blockOrNull(p.kind)?.name ?? p.kind;
    const net = this.netOf.get(key);
    const parts: string[] = [];
    if (!net || (net.rpm === 0 && !net.overstressed)) parts.push('still');
    else if (net.overstressed) parts.push(`overstressed ${fmt(net.stress)}/${fmt(net.capacity)} su`);
    else parts.push(`${net.rpm} rpm, load ${fmt(net.stress)}/${fmt(net.capacity)} su`);
    const m = this.machines.get(key);
    if (m) {
      const held = Object.entries(m.buffer).map(([i, n]) => `${n} ${itemOrNull(i)?.name ?? i}`);
      if (m.recipe) {
        const r = recipesAt(TWIN.get(p.kind)!.station).find((x) => x.id === m.recipe);
        const need = (r?.strokes ?? 1) * STROKE_S;
        parts.push(`${itemOrNull(r?.output.item ?? '')?.name ?? ''} ${Math.round((m.progress / need) * 100)}%`);
      }
      if (held.length) parts.push(`holds ${held.join(', ')}`);
    }
    return `${name} - ${parts.join(', ')}`;
  }

  // ---- Save -------------------------------------------------------------------------------------------

  toJSON(): WorkshopSnapshot {
    const parts: WorkshopSnapshot['parts'] = [];
    for (const p of this.parts.values()) parts.push([p.x, p.y, p.z, p.kind]);
    const machines: WorkshopSnapshot['machines'] = [];
    for (const [key, m] of this.machines) {
      const [x, y, z] = key.split(',').map(Number);
      if (Object.keys(m.buffer).length || m.progress > 0) machines.push([x, y, z, { ...m.buffer }, m.progress, m.recipe]);
    }
    return { v: 1, parts, machines };
  }

  /** Restores parts (checked against the world) and machine buffers; damaged entries are skipped. */
  load(raw: unknown): void {
    this.parts.clear();
    this.machines.clear();
    if (!raw || typeof raw !== 'object') return;
    const s = raw as Partial<WorkshopSnapshot>;
    for (const row of Array.isArray(s.parts) ? s.parts : []) {
      if (!Array.isArray(row) || row.length !== 4) continue;
      const [x, y, z, kind] = row;
      if (![x, y, z].every(Number.isInteger) || typeof kind !== 'string' || !KINETIC.has(kind)) continue;
      this.parts.set(k3(x, y, z), { x, y, z, kind });
      if (TWIN.has(kind)) this.machines.set(k3(x, y, z), { buffer: {}, progress: 0, recipe: null });
    }
    for (const row of Array.isArray(s.machines) ? s.machines : []) {
      if (!Array.isArray(row) || row.length !== 6) continue;
      const [x, y, z, buffer, progress, recipe] = row;
      const m = this.machines.get(k3(x, y, z));
      if (!m || !buffer || typeof buffer !== 'object') continue;
      for (const [i, n] of Object.entries(buffer)) if (itemOrNull(i) && typeof n === 'number' && n > 0) m.buffer[i] = Math.min(MACHINE_BUFFER, Math.floor(n));
      m.progress = typeof progress === 'number' && progress > 0 ? progress : 0;
      m.recipe = typeof recipe === 'string' ? recipe : null;
    }
  }

  /** Re-checks every saved part against the world once chunks are in (a part whose block is gone is dropped). */
  verify(): void {
    for (const [key, p] of [...this.parts]) {
      if (!this.world.isLoaded(p.x, p.z)) continue;
      if (this.world.getBlock(p.x, p.y, p.z).key !== p.kind) {
        this.parts.delete(key);
        this.machines.delete(key);
      }
    }
  }
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

/** For tests: a voxel of a workshop block facing a way. */
export const partVoxel = (id: number, facing: Facing): number => makeVoxel(id, facing);
