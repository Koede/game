/**
 * The glass distillery in the simulation (docs/DISTILLERY_PLAN.md 5, 6, 9; API: docs/api/distillery.md).
 *
 * One entity per chemistry module, kind = its module kind (`boiling_flask`, `receiver`, ...), plain JSON in the world
 * and never a machine node. Rigs are derived from the blocks (distillScan.ts) whenever a chemistry block changes and
 * are never saved. Chemistry steps at CHEM_STEP_HZ:
 *   1. stills boil: the still base holds its flask at min(setting, furnace temperature); the flask boils while that is
 *      above the bubble point of what it holds, and each component condenses at the draw its boiling point reaches
 *      (chem.ts). Litres leave the flask only as litres a condenser took, so volume is conserved exactly;
 *   2. vessels react (fermenting under an airlock);
 *   3. liquid flows along the rig's edges, down and sideways (a vessel lets go only once its work is done);
 *   4. every module shows its state on its block (plan 2.1): `_done` twin and the active bit, a sound and a toast
 *      when a run completes.
 */
import {
  COMPONENTS, add, bubblePoint, colourOf, drawIndex, leakShare, nameOf, pour, share, stagesOf, take, total, trayTemps, vapourShares,
  viscosityOf, type Component, type Mix,
} from '../core/chem';
import { AMBIENT_TEMP_C } from '../core/constants';
import type { GameBus } from '../core/context';
import {
  BOIL_J_PER_L, BOIL_LPS, CHEM, CHEM_CAPACITY_L, CHEM_KINDS, CHEM_STEP_HZ, CONDENSE_LPS, DONE_SUFFIX, FERMENT_LPS, FERMENT_MAX_C,
  FERMENT_MAX_ETHANOL, FERMENT_MAX_SUGARS, FERMENT_MIN_C, FLOW_LPS, GLASS_MAX_C, HEAD_C, HEAD_JACKET_C, JACKET_MULT, RECEIVE_HOLD_S,
  STATEFUL, STILL_DEFAULT_C, STILL_SETPOINTS, chemKindOf, stateLook, type ChemKind, type ChemState,
} from '../core/distill';
import { blockId, blockOf, fluidOrNull } from '../core/registry';
import { voxelActive, voxelId, withActive, withId, type BlockDef, type BlockEntity, type IWorld } from '../core/types';
import { posKey, type FurnaceEntity } from './entities';
import { scanAll, type Rig, type Still } from './distillScan';

/** The saved entity of one module. */
export interface ChemEntity extends BlockEntity {
  kind: ChemKind;
  /** Litres per component it holds (modules without a buffer keep it empty). */
  mix: Mix;
  state: ChemState;
  /** Still base: the temperature it holds its flask at. */
  setC?: number;
  /** A flask has boiled (a vessel has reacted) since it was last empty: its next stop is "done", not "idle". */
  ran?: boolean;
  /** Seconds since liquid last arrived (receivers, condensers). */
  recvS?: number;
  // Render hints (written every step, harmless in a save):
  /** Litres per second through it last step. */
  flow?: number;
  /** Column segment: colour of the cut condensing at its tray (0 when none). */
  band?: number;
  /** Flask: temperature of its liquid, C. */
  tempC?: number;
}

export const isChemKind = (kind: string): boolean => chemKindOf(kind) === kind;

export interface DistillHost {
  /** The furnace a still base stands on (x, y, z is the base). */
  furnaceUnder(x: number, y: number, z: number): FurnaceEntity | null;
  flagOnce(flag: string): void;
}

const STEP_S = 1 / CHEM_STEP_HZ;
const EPS_C = 0.25;
const finite = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function cleanMix(v: unknown): Mix {
  const out: Mix = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, l] of Object.entries(v as Record<string, unknown>)) if (k in COMPONENTS && typeof l === 'number' && l > 0 && Number.isFinite(l)) add(out, k as Component, l);
  return out;
}

const capOf = (e: ChemEntity): number => CHEM_CAPACITY_L[e.kind];
const roomOf = (e: ChemEntity): number => Math.max(0, capOf(e) - total(e.mix));
const nameOfFluid = (key: string | null): string => (key ? (fluidOrNull(key)?.name ?? key) : 'nothing');

export class Distillery {
  private readonly byKey = new Map<string, ChemEntity>();
  private rigs: Rig[] = [];
  private rigOf = new Map<string, Rig>();
  private dirty = true;
  private acc = 0;
  /** Steps run (a diagnostic and a test hook). */
  steps = 0;

  constructor(readonly world: IWorld, readonly bus: GameBus, readonly host: DistillHost) {}

  get count(): number {
    return this.byKey.size;
  }

  get rigCount(): number {
    this.rescan();
    return this.rigs.length;
  }

  static handles(def: BlockDef): boolean {
    return def.machine !== null && isChemKind(def.machine);
  }

  entityAt(x: number, y: number, z: number): ChemEntity | undefined {
    return this.byKey.get(posKey(x, y, z));
  }

  clear(): void {
    this.byKey.clear();
    this.rigs = [];
    this.rigOf.clear();
    this.dirty = true;
  }

  /** Follows an entity stored in the world (after loading): every field is repaired. */
  track(stored: BlockEntity): void {
    const e = stored as ChemEntity;
    e.mix = cleanMix(e.mix);
    if (e.state !== 'idle' && e.state !== 'working' && e.state !== 'done' && e.state !== 'blocked') e.state = 'idle';
    if (e.kind === CHEM.base) e.setC = STILL_SETPOINTS.includes(finite(e.setC, -1)) ? e.setC : STILL_DEFAULT_C;
    e.ran = e.ran === true;
    e.recvS = Math.max(0, finite(e.recvS, 99));
    this.byKey.set(posKey(e.x, e.y, e.z), e);
    this.dirty = true;
  }

  /** A chemistry block now stands at x, y, z (placed, or one of our own state swaps): keep or create its entity. */
  place(x: number, y: number, z: number, def: BlockDef): void {
    const kind = def.machine as ChemKind;
    const key = posKey(x, y, z);
    const kept = this.byKey.get(key);
    if (kept && kept.kind === kind) return; // a state swap: same module, same rig
    if (kept) this.remove(x, y, z);
    const stored = this.world.getEntity(x, y, z);
    if (stored && stored.kind === kind) {
      this.track(stored);
      return;
    }
    const e: ChemEntity = { kind, x, y, z, mix: {}, state: 'idle', ...(kind === CHEM.base ? { setC: STILL_DEFAULT_C } : {}) };
    this.world.setEntity(e);
    this.byKey.set(key, e);
    this.dirty = true;
  }

  /** The module at x, y, z is gone (its contents are lost with the glass). */
  remove(x: number, y: number, z: number): void {
    const key = posKey(x, y, z);
    const e = this.byKey.get(key);
    if (!e) return;
    this.byKey.delete(key);
    if (this.world.getEntity(x, y, z) === e) this.world.removeEntity(x, y, z);
    this.dirty = true;
  }

  /** Some block next to a module changed (a furnace placed under a base, a pipe): rigs are found again. */
  touched(): void {
    this.dirty = true;
  }

  /** The rig a module belongs to. */
  rigAt(x: number, y: number, z: number): Rig | null {
    this.rescan();
    return this.rigOf.get(posKey(x, y, z)) ?? null;
  }

  private rescan(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.rigs = scanAll(this.world, [...this.byKey.values()].filter((e) => this.world.isLoaded(e.x, e.z)));
    this.rigOf.clear();
    for (const rig of this.rigs) for (const k of rig.modules.keys()) this.rigOf.set(k, rig);
  }

  // ---- ticking --------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    if (this.byKey.size === 0) return;
    this.acc += dt;
    while (this.acc >= STEP_S) {
      this.acc -= STEP_S;
      this.step(STEP_S);
    }
  }

  /** One chemistry step of every rig. */
  step(dt: number): void {
    this.rescan();
    this.steps++;
    for (const rig of this.rigs) this.stepRig(rig, dt);
  }

  private mod(key: string): ChemEntity | null {
    return this.byKey.get(key) ?? null;
  }

  /** The temperature a still base holds its flask at right now, or null when it has no hot furnace under it. */
  baseTemp(base: ChemEntity | null): number | null {
    if (!base) return null;
    const f = this.host.furnaceUnder(base.x, base.y - 1, base.z);
    if (!f || f.tempC <= AMBIENT_TEMP_C + 1) return null;
    return Math.min(finite(base.setC, STILL_DEFAULT_C), f.tempC, GLASS_MAX_C);
  }

  private stepRig(rig: Rig, dt: number): void {
    const arrived = new Set<string>();
    const was = new Map<string, ChemState>();
    for (const k of rig.modules.keys()) {
      const e = this.mod(k);
      if (!e) continue;
      e.flow = 0;
      was.set(k, e.state);
    }
    for (const still of rig.stills) this.stepStill(rig, still, dt, arrived);
    for (const k of rig.modules.keys()) {
      const e = this.mod(k);
      if (e?.kind === CHEM.vessel) this.stepVessel(e, rig.sealed.has(k), dt);
    }
    this.flow(rig, dt, arrived);
    this.show(rig, arrived, was, dt);
  }

  private stepStill(rig: Rig, still: Still, dt: number, arrived: Set<string>): void {
    const flask = this.mod(still.flask);
    if (!flask) return;
    const base = still.base ? this.mod(still.base) : null;
    const ts = this.baseTemp(base);
    const tb = bubblePoint(flask.mix);
    flask.tempC = ts === null ? AMBIENT_TEMP_C : tb === null ? ts : Math.min(ts, tb);
    for (const s of still.segments) {
      const seg = this.mod(s);
      if (seg) seg.band = 0;
    }
    if (ts === null || tb === null || total(flask.mix) <= 0) {
      flask.state = total(flask.mix) <= 0 ? 'idle' : flask.ran ? (ts === null ? 'blocked' : 'done') : ts === null && still.base === null ? 'blocked' : 'idle';
      if (total(flask.mix) <= 0) flask.ran = false;
      return;
    }
    if (tb >= ts - EPS_C) {
      flask.state = flask.ran ? 'done' : 'idle';
      return;
    }
    // Where each cut goes: side draws bottom to top, then the head.
    const height = still.segments.length;
    const jacketed = (key: string | null): boolean => !!key && (rig.jackets.get(key) ?? []).some((j) => total(this.mod(j)?.mix ?? {}) > 1);
    const headC = jacketed(still.head) ? HEAD_JACKET_C : HEAD_C;
    const trays = trayTemps(ts, headC, Math.max(1, height));
    const draws = [...still.draws].sort((a, b) => a.h - b.h);
    const drawTrays = draws.map((d) => trays[d.h - 1]);
    const targets: Array<ChemEntity | null> = [...draws.map((d) => this.mod(d.condenser)), still.head ? this.mod(still.head) : null];
    const keys = [...draws.map((d) => d.condenser), still.head];
    // Without a head the lightest cuts go to the top draw.
    const last = targets[targets.length - 1] ? targets.length - 1 : targets.length - 2;
    if (last < 0) {
      flask.state = 'blocked';
      return;
    }
    const y: Mix = {};
    if (!vapourShares(flask.mix, stagesOf(height), y)) return;
    const want = BOIL_LPS * Math.min(1, (ts - tb) / 2) * dt;
    const leak = leakShare(height);
    // Litres each target would take per litre of vapour.
    const per = new Array<number>(targets.length).fill(0);
    const route = (c: Component): [number, number, number] => {
      let i = drawIndex(COMPONENTS[c].bp ?? 0, drawTrays);
      if (i > last) i = last;
      const up = i < last && leak > 0 ? i + 1 : -1;
      return [i, up, up >= 0 ? leak : 0];
    };
    for (const k in y) {
      const [i, up, l] = route(k as Component);
      per[i] += y[k as Component]! * (1 - l);
      if (up >= 0) per[up] += y[k as Component]! * l;
    }
    let scale = want;
    for (let i = 0; i < targets.length; i++) {
      if (per[i] <= 0) continue;
      const t = targets[i];
      if (!t) return;
      const rate = CONDENSE_LPS * (jacketed(keys[i]) ? JACKET_MULT : 1) * dt;
      scale = Math.min(scale, Math.min(rate, roomOf(t)) / per[i]);
    }
    if (!(scale > 1e-9)) {
      flask.state = 'blocked';
      return;
    }
    let moved = 0;
    for (const k in y) {
      const c = k as Component;
      const got = take(flask.mix, c, scale * y[c]!);
      if (got <= 0) continue;
      const [i, up, l] = route(c);
      add(targets[i]!.mix, c, got * (1 - l));
      if (up >= 0) add(targets[up]!.mix, c, got * l);
      moved += got;
    }
    for (let i = 0; i < targets.length; i++) if (per[i] > 0 && keys[i]) arrived.add(keys[i]!);
    // The column glows with the cut at each tray: the colour of what condenses there.
    for (let h = 1; h <= height; h++) {
      const seg = this.mod(still.segments[h - 1]);
      if (!seg) continue;
      let best: Component | null = null;
      for (const k in flask.mix) {
        const bp = COMPONENTS[k as Component].bp;
        if (bp !== null && bp >= trays[h - 1] && bp < ts + 40 && (!best || (flask.mix[k as Component] ?? 0) > (flask.mix[best] ?? 0))) best = k as Component;
      }
      seg.band = best ? COMPONENTS[best].colour : 0;
      seg.flow = moved / dt;
    }
    flask.flow = moved / dt;
    flask.ran = true;
    flask.state = 'working';
    const f = this.host.furnaceUnder(base!.x, base!.y - 1, base!.z);
    if (f) f.extractW += (moved / dt) * BOIL_J_PER_L;
  }

  private stepVessel(v: ChemEntity, sealed: boolean, dt: number): void {
    const t = total(v.mix);
    if (t <= 0) {
      v.state = 'idle';
      v.ran = false;
      return;
    }
    const sugars = v.mix.sugars ?? 0;
    const tempC = AMBIENT_TEMP_C;
    const can = sealed && sugars > 1e-3 && share(v.mix, 'sugars', t) <= FERMENT_MAX_SUGARS && share(v.mix, 'ethanol', t) < FERMENT_MAX_ETHANOL
      && tempC >= FERMENT_MIN_C && tempC <= FERMENT_MAX_C;
    if (!can) {
      if (v.ran) v.state = 'done';
      else v.state = sealed && sugars > 1e-3 && share(v.mix, 'sugars', t) > FERMENT_MAX_SUGARS ? 'blocked' : 'idle';
      return;
    }
    const s = take(v.mix, 'sugars', FERMENT_LPS * dt);
    add(v.mix, 'ethanol', s * 0.6);
    add(v.mix, 'water', s * 0.3);
    add(v.mix, 'fusel', s * 0.09);
    add(v.mix, 'methanol', s * 0.01);
    v.flow = s / dt;
    v.ran = true;
    v.state = 'working';
  }

  private flow(rig: Rig, dt: number, arrived: Set<string>): void {
    for (const edge of rig.edges) {
      const a = this.mod(edge.from);
      const b = this.mod(edge.to);
      if (!a || !b) continue;
      const send = (from: ChemEntity, to: ChemEntity, litres: number, toKey: string): void => {
        if (from.kind === CHEM.vessel && from.state !== 'done') return;
        const l = Math.min(litres, (FLOW_LPS / Math.sqrt(viscosityOf(from.mix))) * dt, roomOf(to));
        const moved = l > 1e-9 ? pour(from.mix, to.mix, l) : 0;
        if (moved > 0) {
          arrived.add(toKey);
          from.flow = (from.flow ?? 0) + moved / dt;
        }
      };
      if (!edge.shared) {
        send(a, b, total(a.mix), edge.to);
        continue;
      }
      // Shared levels: the fuller one (by fraction of its capacity) pours towards the emptier.
      const fa = total(a.mix) / capOf(a);
      const fb = total(b.mix) / capOf(b);
      const ca = capOf(a);
      const cb = capOf(b);
      const even = Math.abs(fa - fb) * ((ca * cb) / (ca + cb));
      if (fa > fb + 1e-6) send(a, b, even, edge.to);
      else if (fb > fa + 1e-6) send(b, a, even, edge.from);
    }
  }

  /** Sets every module's state on its block, and tells the player when a run completes. */
  private show(rig: Rig, arrived: Set<string>, was: Map<string, ChemState>, dt: number): void {
    const flaskOf = new Map<string, ChemEntity | null>();
    for (const still of rig.stills) {
      const flask = this.mod(still.flask);
      for (const k of [still.base, still.head, ...still.segments, ...still.draws.map((d) => d.condenser)]) if (k) flaskOf.set(k, flask);
    }
    const anyWorking = rig.stills.some((s) => this.mod(s.flask)?.state === 'working') || [...rig.modules.keys()].some((k) => this.mod(k)?.state === 'working' && this.mod(k)?.kind === CHEM.vessel);
    for (const key of rig.modules.keys()) {
      const e = this.mod(key);
      if (!e) continue;
      e.recvS = arrived.has(key) ? 0 : Math.min(99, finite(e.recvS, 99) + dt);
      const before = was.get(key) ?? e.state;
      switch (e.kind) {
        case CHEM.flask:
        case CHEM.vessel:
          break;
        case CHEM.receiver: {
          const t = total(e.mix);
          e.state = t <= 1e-6 ? 'idle' : e.recvS! < RECEIVE_HOLD_S ? 'working' : roomOf(e) < 1 || !anyWorking ? 'done' : 'idle';
          break;
        }
        case CHEM.base:
          e.state = flaskOf.get(key)?.state === 'working' ? 'working' : 'idle';
          break;
        case CHEM.condenser:
          e.state = e.recvS! < 0.5 || total(e.mix) > 1 ? 'working' : 'idle';
          break;
        case CHEM.segment:
          e.state = flaskOf.get(key)?.state === 'working' ? 'working' : 'idle';
          break;
        case CHEM.tube:
        case CHEM.jacket:
          e.state = total(e.mix) > 1 ? 'working' : 'idle';
          break;
        default:
          e.state = 'idle';
      }
      if (before !== e.state) this.announce(e, before);
      this.look(e);
    }
  }

  private announce(e: ChemEntity, before: ChemState): void {
    const at = { x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 };
    if (e.state === 'done' && before === 'working' && (e.kind === CHEM.flask || e.kind === CHEM.vessel)) {
      this.bus.emit('sfx', { name: 'machine_done', ...at, pitch: 1.4 });
      const what = e.kind === CHEM.flask ? 'Distilling run finished' : `Fermenting done: ${nameOfFluid(nameOf(e.mix))}`;
      this.bus.emit('toast', { text: what, kind: 'good' });
      this.host.flagOnce(e.kind === CHEM.flask ? 'distilled' : 'fermented');
    } else if (e.state === 'blocked' && before !== 'blocked') {
      this.bus.emit('sfx', { name: 'pipe_clunk', ...at });
    }
  }

  /** The block (plain or `_done` twin) and active bit that show the module's state. */
  private look(e: ChemEntity): void {
    if (!this.world.isLoaded(e.x, e.z)) return;
    const v = this.world.getVoxel(e.x, e.y, e.z);
    const def = blockOf(v);
    if (chemKindOf(def.key) !== e.kind) return;
    const { done, active } = stateLook(e.state);
    const key = STATEFUL.includes(e.kind) && done ? `${e.kind}${DONE_SUFFIX}` : e.kind;
    const lit = STATEFUL.includes(e.kind) ? active : e.state === 'working';
    let next = key === def.key ? v : withId(v, blockId(key));
    next = withActive(next, lit);
    if (next !== v) this.world.setVoxel(e.x, e.y, e.z, next, 'sim');
  }

  // ---- for views, actions and tests ----------------------------------------------------------------------------

  /** Every module entity (render, diagnostics). */
  all(): IterableIterator<ChemEntity> {
    return this.byKey.values();
  }

  /** Total litres in every module (the conservation check of the tests). */
  litres(): number {
    let t = 0;
    for (const e of this.byKey.values()) t += total(e.mix);
    return t;
  }

  /** Whether the voxel at x, y, z shows `state` (tests). */
  shows(x: number, y: number, z: number): { key: string; active: boolean } {
    const v = this.world.getVoxel(x, y, z);
    return { key: blockOf(v).key, active: voxelActive(v) };
  }

  /** Colour of what a module holds (render, UI). */
  colourAt(e: ChemEntity): number {
    return colourOf(e.mix);
  }
}

