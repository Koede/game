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
  COMPONENTS, add, bubblePoint, colourOf, drawIndex, layersOf, leakShare, nameOf, pour, share, stagesOf, take, total, trayTemps, vapourShares,
  viscosityOf, type Component, type Mix,
} from '../core/chem';
import { AMBIENT_TEMP_C } from '../core/constants';
import type { GameBus } from '../core/context';
import {
  ASPHALT_C, ASPHALT_COUNT, BOIL_J_PER_L, BOIL_LPS, CANISTER_L, CHEM, CHEM_CAPACITY_L, CHEM_KINDS, CHEM_STEP_HZ,
  CONDENSE_LPS, DONE_SUFFIX, ELIXIR_BATCH_L, ELIXIR_VIALS, ESSENCE_COUNT, ESSENCE_RUIN_C, ESSENCE_SET_C, FERMENT_LPS, FERMENT_MAX_C,
  FERMENT_MAX_ETHANOL, FERMENT_MAX_SUGARS, FERMENT_MIN_C, FLOW_LPS, GLASS_MAX_C, HEAD_C, HEAD_JACKET_C, JACKET_MULT,
  CHEM_CONTAINERS, RECEIVE_HOLD_S, SETTLE_S, STATEFUL, STILL_DEFAULT_C, STILL_SETPOINTS, TINCTURE_C, VACUUM_BP, burnerTemp, chemKindOf, drinkOfEssence, essenceDrink, fuelGrade,
  isBotanical, isFilterMedium, isRefluxRatio, stateLook, type ChemKind, type ChemState,
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
  /** Separatory funnel: seconds its layers have been settling (SETTLE_S lets the bottom one out). */
  settleS?: number;
  // Render hints (written every step, harmless in a save):
  /** Litres per second through it last step. */
  flow?: number;
  /** Column segment: colour of the cut condensing at its tray (0 when none). */
  band?: number;
  /** Flask: temperature of its liquid, C. */
  tempC?: number;
  /** Still base fuel, filter medium, vessel reagents. */
  slots?: { item: string; count: number }[];
  /** Solids a reaction handed out (asphalt blocks, essence, elixir vials). */
  out?: { item: string; count: number }[];
  /** Reflux head: return fraction, one of 0, 0.5, 0.75. */
  reflux?: number;
  /** Filter: the medium already paid for the liquid now in the bed. */
  filtered?: boolean;
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

function cleanSlots(v: unknown): { item: string; count: number }[] {
  if (!Array.isArray(v)) return [];
  const out: { item: string; count: number }[] = [];
  for (const s of v) {
    if (!s || typeof s !== 'object') continue;
    const item = (s as { item?: unknown }).item;
    const count = (s as { count?: unknown }).count;
    if (typeof item === 'string' && typeof count === 'number' && count > 0 && Number.isFinite(count)) out.push({ item, count: Math.floor(count) });
  }
  return out;
}

const slotCount = (e: ChemEntity, item: string): number => e.slots?.find((s) => s.item === item)?.count ?? 0;

function takeItem(e: ChemEntity, item: string, n: number): boolean {
  const s = e.slots?.find((x) => x.item === item);
  if (!s || s.count < n) return false;
  s.count -= n;
  e.slots = (e.slots ?? []).filter((x) => x.count > 0);
  return true;
}

function pushOut(e: ChemEntity, item: string, n: number): void {
  const have = e.out?.find((s) => s.item === item);
  if (have) have.count += n;
  else (e.out ??= []).push({ item, count: n });
}

/** Replaces the whole mix with the same litres of one component. */
function asComponent(m: Mix, c: Component): void {
  const t = total(m);
  for (const k of Object.keys(m) as Component[]) delete m[k];
  if (t > 0) m[c] = t;
}

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
  /** Seconds until each module's next bubble or trickle sound (not saved: sounds only). */
  private readonly cueLeft = new Map<string, number>();

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
    e.slots = cleanSlots(e.slots);
    e.out = cleanSlots(e.out);
    if (e.kind === CHEM.reflux) e.reflux = isRefluxRatio(finite(e.reflux, -1)) ? e.reflux : 0;
    e.ran = e.ran === true;
    e.filtered = e.filtered === true;
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
    const e: ChemEntity = {
      kind, x, y, z, mix: {}, state: 'idle',
      ...(kind === CHEM.base ? { setC: STILL_DEFAULT_C } : {}),
      ...(kind === CHEM.reflux ? { reflux: 0 } : {}),
    };
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

  /**
   * The temperature a still base holds its flask at. A hot furnace wins (clamped by the setpoint and the glass
   * limit). With no hot furnace, charcoal holds 250 C and a fuel-ethanol beaker 300 C.
   */
  baseTemp(base: ChemEntity | null): number | null {
    if (!base) return null;
    const f = this.host.furnaceUnder(base.x, base.y - 1, base.z);
    if (f && f.tempC > AMBIENT_TEMP_C + 1) return Math.min(finite(base.setC, STILL_DEFAULT_C), f.tempC, GLASS_MAX_C);
    const fuel = base.slots?.find((s) => burnerTemp(s.item) !== null && s.count > 0);
    const burner = fuel ? burnerTemp(fuel.item) : null;
    return burner === null ? null : Math.min(burner, GLASS_MAX_C);
  }

  /** Heat a vessel gets from the still base under it, or null. */
  private heatUnder(v: ChemEntity): number | null {
    const below = this.byKey.get(posKey(v.x, v.y - 1, v.z));
    return below?.kind === CHEM.base ? this.baseTemp(below) : null;
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
      else if (e?.kind === CHEM.filter) this.stepFilter(e);
      else if (e?.kind === CHEM.funnel) this.stepFunnel(e, dt);
    }
    this.flow(rig, dt, arrived);
    this.show(rig, arrived, was, dt);
  }

  private stepStill(rig: Rig, still: Still, dt: number, arrived: Set<string>): void {
    const flask = this.mod(still.flask);
    if (!flask) return;
    const base = still.base ? this.mod(still.base) : null;
    const ts = this.baseTemp(base);
    const bpScale = still.vacuum ? VACUUM_BP : 1;
    const refluxEnt = still.reflux ? this.mod(still.reflux) : null;
    const reflux = isRefluxRatio(finite(refluxEnt?.reflux, -1)) ? refluxEnt!.reflux! : 0;
    if (this.stepEssence(flask, still, ts)) return;
    const tb = bubblePoint(flask.mix, bpScale);
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
    if (!vapourShares(flask.mix, stagesOf(height, reflux), y, bpScale)) return;
    // Returned vapour stays in the flask: only (1 - r) leaves for the condensers.
    const want = BOIL_LPS * Math.min(1, (ts - tb) / 2) * dt * (1 - reflux);
    const leak = leakShare(height);
    // Litres each target would take per litre of vapour.
    const per = new Array<number>(targets.length).fill(0);
    const route = (c: Component): [number, number, number] => {
      let i = drawIndex((COMPONENTS[c].bp ?? 0) * bpScale, drawTrays);
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

  /** Four drinks on a vacuum still at 60..80 C become an essence. Hotter than 80 C ruins them. */
  private stepEssence(flask: ChemEntity, still: Still, ts: number | null): boolean {
    const slot = flask.slots?.find((s) => essenceDrink(s.item) && s.count >= ESSENCE_COUNT);
    if (!slot || !still.vacuum || ts === null) return false;
    const row = essenceDrink(slot.item)!;
    flask.tempC = ts;
    if (ts > ESSENCE_RUIN_C) {
      takeItem(flask, slot.item, ESSENCE_COUNT);
      flask.ran = true;
      flask.state = 'blocked';
      return true;
    }
    if (ts < ESSENCE_SET_C) return false;
    takeItem(flask, slot.item, ESSENCE_COUNT);
    pushOut(flask, row.essence, 1);
    flask.ran = true;
    flask.state = 'done';
    return true;
  }

  private stepFilter(bed: ChemEntity): void {
    const litres = total(bed.mix);
    if (litres <= 1e-6) {
      bed.state = 'idle';
      bed.filtered = false;
      bed.flow = 0;
      return;
    }
    const medium = bed.slots?.find((s) => isFilterMedium(s.item) && s.count > 0);
    if (!medium) {
      bed.state = 'blocked';
      return;
    }
    if (!bed.filtered) {
      if (medium.item === 'clay') {
        const lube = take(bed.mix, 'lube_base', Infinity);
        if (lube > 0) add(bed.mix, 'lubricant', lube);
      } else if (medium.item === 'charcoal') {
        const cloudy = take(bed.mix, 'tincture', Infinity);
        if (cloudy > 0) add(bed.mix, 'clear_tincture', cloudy);
      }
      takeItem(bed, medium.item, 1);
      bed.filtered = true;
    }
    const left = bed.slots?.find((s) => isFilterMedium(s.item) && s.count > 0);
    bed.state = left ? 'working' : 'blocked';
    bed.ran = true;
  }

  /** A separatory funnel: liquids that do not mix settle into layers (chem.ts `layersOf`); once settled the tap lets the bottom one out. */
  private stepFunnel(f: ChemEntity, dt: number): void {
    const layers = layersOf(f.mix);
    if (layers.length === 0) {
      f.state = 'idle';
      f.settleS = 0;
      f.ran = false;
      return;
    }
    if (layers.length === 1) {
      f.state = f.ran ? 'done' : 'idle';
      f.settleS = 0;
      return;
    }
    f.settleS = Math.min(SETTLE_S, finite(f.settleS, 0) + dt);
    f.state = 'working';
    f.ran = true;
  }

  /** Lets the bottom layer of a settled funnel run into `to`, and nothing of the layers above it. */
  private drainFunnel(f: ChemEntity, to: ChemEntity, toKey: string, dt: number, arrived: Set<string>): void {
    const layers = layersOf(f.mix);
    if (layers.length < 2 || finite(f.settleS, 0) < SETTLE_S) return;
    const bottom = layers[0];
    const l = Math.min(bottom.litres, (FLOW_LPS / Math.sqrt(viscosityOf(bottom.mix))) * dt, roomOf(to));
    if (l <= 1e-9) return;
    let moved = 0;
    for (const k in bottom.mix) {
      const c = k as Component;
      const got = take(f.mix, c, l * ((bottom.mix[c] ?? 0) / bottom.litres));
      add(to.mix, c, got);
      moved += got;
    }
    if (moved > 0) {
      arrived.add(toKey);
      f.flow = (f.flow ?? 0) + moved / dt;
    }
  }

  private stepVessel(v: ChemEntity, sealed: boolean, dt: number): void {
    if (this.stepAsphalt(v) || this.stepElixir(v) || this.stepTincture(v)) return;
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

  /** Bitumen (one canister) + gravel + sand in a vessel at 150 C or hotter → 8 asphalt. */
  private stepAsphalt(v: ChemEntity): boolean {
    if ((v.mix.bitumen ?? 0) < CANISTER_L || slotCount(v, 'gravel') < 1 || slotCount(v, 'sand') < 1) return false;
    const heat = this.heatUnder(v);
    if (heat === null || heat < ASPHALT_C) return false;
    take(v.mix, 'bitumen', CANISTER_L);
    takeItem(v, 'gravel', 1);
    takeItem(v, 'sand', 1);
    pushOut(v, 'asphalt', ASPHALT_COUNT);
    v.ran = true;
    v.state = 'done';
    return true;
  }

  /** Essence + clear tincture + syrup, 4 vials per 1000 L. */
  private stepElixir(v: ChemEntity): boolean {
    const essence = v.slots?.find((s) => drinkOfEssence(s.item) && s.count > 0);
    if (!essence || (v.mix.clear_tincture ?? 0) <= 0 || (v.mix.sugars ?? 0) <= 0 || total(v.mix) < ELIXIR_BATCH_L) return false;
    const row = drinkOfEssence(essence.item)!;
    pour(v.mix, {}, ELIXIR_BATCH_L);
    takeItem(v, essence.item, 1);
    pushOut(v, row.elixir, ELIXIR_VIALS);
    v.ran = true;
    v.state = 'done';
    return true;
  }

  /** Spirit plus a herb, glowcap or berries in a vessel at 50 C or hotter → tincture. */
  private stepTincture(v: ChemEntity): boolean {
    const bot = v.slots?.find((s) => isBotanical(s.item) && s.count > 0);
    if (!bot || total(v.mix) <= 0) return false;
    const named = nameOf(v.mix);
    if (named !== 'spirit' && named !== 'fuel_ethanol') return false;
    const heat = this.heatUnder(v);
    if (heat === null || heat < TINCTURE_C) return false;
    asComponent(v.mix, 'tincture');
    takeItem(v, bot.item, 1);
    v.ran = true;
    v.state = 'done';
    return true;
  }

  private flow(rig: Rig, dt: number, arrived: Set<string>): void {
    for (const edge of rig.edges) {
      const a = this.mod(edge.from);
      const b = this.mod(edge.to);
      if (!a || !b) continue;
      const send = (from: ChemEntity, to: ChemEntity, litres: number, toKey: string): void => {
        if (from.kind === CHEM.vessel && from.state !== 'done') return;
        if (from.kind === CHEM.funnel) {
          this.drainFunnel(from, to, toKey, dt, arrived);
          return;
        }
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
  /**
   * The sounds of a running rig, now and then: a boiling flask bubbles, and a tube or condenser with liquid running through
   * it trickles. Each module counts down on its own, staggered by its position so a rig does not pop or trickle in step.
   */
  private cue(key: string, e: ChemEntity, dt: number): void {
    const boiling = e.kind === CHEM.flask && e.state === 'working';
    const running = (e.kind === CHEM.tube || e.kind === CHEM.condenser) && finite(e.flow, 0) > 0;
    if (!boiling && !running) {
      this.cueLeft.delete(key);
      return;
    }
    const left = this.cueLeft.get(key);
    const stagger = (((e.x * 73 + e.y * 151 + e.z * 37) % 97) + 97) % 97 / 97;
    if (left === undefined) {
      this.cueLeft.set(key, stagger * (boiling ? 1.6 : 0.5));
      return;
    }
    if (left - dt > 0) {
      this.cueLeft.set(key, left - dt);
      return;
    }
    this.bus.emit('sfx', { name: boiling ? 'distill_bubble' : 'distill_trickle', x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 });
    this.cueLeft.set(key, boiling ? 1.2 + 1.2 * stagger : 0.5 + 0.4 * stagger);
  }

  private show(rig: Rig, arrived: Set<string>, was: Map<string, ChemState>, dt: number): void {
    const flaskOf = new Map<string, ChemEntity | null>();
    for (const still of rig.stills) {
      const flask = this.mod(still.flask);
      for (const k of [still.base, still.head, still.reflux, ...still.segments, ...still.draws.map((d) => d.condenser)]) if (k) flaskOf.set(k, flask);
    }
    const anyWorking = rig.stills.some((s) => this.mod(s.flask)?.state === 'working') || [...rig.modules.keys()].some((k) => this.mod(k)?.state === 'working' && this.mod(k)?.kind === CHEM.vessel);
    for (const key of rig.modules.keys()) {
      const e = this.mod(key);
      if (!e) continue;
      const quiet = finite(e.recvS, 99) >= 0.5;
      const got = arrived.has(key);
      e.recvS = got ? 0 : Math.min(99, finite(e.recvS, 99) + dt);
      if (got && quiet && (e.kind === CHEM.receiver || e.kind === CHEM.condenser)) {
        this.bus.emit('sfx', { name: 'distill_drip', x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 });
      }
      this.cue(key, e, dt);
      const before = was.get(key) ?? e.state;
      switch (e.kind) {
        case CHEM.flask:
        case CHEM.vessel:
        case CHEM.filter:
        case CHEM.funnel:
          break;
        case CHEM.receiver: {
          const t = total(e.mix);
          e.state = t <= 1e-6 ? 'idle' : e.recvS! < RECEIVE_HOLD_S ? 'working' : roomOf(e) < 1 || !anyWorking ? 'done' : 'idle';
          break;
        }
        case CHEM.base:
          e.state = flaskOf.get(key)?.state === 'working' || this.burnerLit(e) ? 'working' : 'idle';
          break;
        case CHEM.condenser:
          e.state = e.recvS! < 0.5 || total(e.mix) > 1 ? 'working' : 'idle';
          break;
        case CHEM.segment:
        case CHEM.reflux:
          e.state = flaskOf.get(key)?.state === 'working' ? 'working' : 'idle';
          break;
        case CHEM.tube:
        case CHEM.jacket:
          e.state = total(e.mix) > 1 ? 'working' : 'idle';
          break;
        case CHEM.vacuum:
        case CHEM.airlock:
        case CHEM.port:
          e.state = 'idle';
          break;
        default: {
          const _exhaustive: never = e.kind;
          return _exhaustive;
        }
      }
      if (e.kind === CHEM.flask && e.state === 'done' && before === 'working') this.spendBurner(rig, key);
      if (before !== e.state) this.announce(e, before);
      this.look(e);
    }
  }

  /** Ground burner: the fuel item is used up when the flask's run finishes. A hot furnace is not touched. */
  private burnerLit(base: ChemEntity): boolean {
    if (base.kind !== CHEM.base || this.furnaceHot(base)) return false;
    return base.slots?.some((s) => burnerTemp(s.item) !== null && s.count > 0) ?? false;
  }

  private furnaceHot(base: ChemEntity): boolean {
    const f = this.host.furnaceUnder(base.x, base.y - 1, base.z);
    return !!f && f.tempC > AMBIENT_TEMP_C + 1;
  }

  private spendBurner(rig: Rig, flaskKey: string): void {
    const still = rig.stills.find((s) => s.flask === flaskKey);
    const base = still?.base ? this.mod(still.base) : null;
    if (!base || this.furnaceHot(base)) return;
    // Charcoal is used up. A fuel-ethanol beaker comes back empty, the same way a fuel grade hands its canister back.
    const kept: { item: string; count: number }[] = [];
    for (const s of base.slots ?? []) {
      if (burnerTemp(s.item) === null || s.count <= 0) {
        if (s.count > 0) kept.push(s);
        continue;
      }
      const empty = fuelGrade(s.item)?.empty ?? CHEM_CONTAINERS[s.item]?.empty ?? null;
      if (!empty) continue;
      const have = kept.find((k) => k.item === empty);
      if (have) have.count += s.count;
      else kept.push({ item: empty, count: s.count });
    }
    base.slots = kept;
  }

  private announce(e: ChemEntity, before: ChemState): void {
    const at = { x: e.x + 0.5, y: e.y + 0.5, z: e.z + 0.5 };
    this.bus.emit('distill:step', { x: e.x, y: e.y, z: e.z, state: e.state, module: e.kind });
    if (e.state === 'working' && before !== 'working' && e.kind === CHEM.flask) {
      this.bus.emit('sfx', { name: 'distill_bubble', ...at });
    }
    if (e.state === 'done' && before !== 'done' && (e.kind === CHEM.flask || e.kind === CHEM.vessel)) {
      this.bus.emit('sfx', { name: 'distill_chime', ...at });
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

