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
import { blockOrNull, itemOrNull, machine, recipesAt } from '../core/registry';
import { Facing, makeVoxel, voxelActive, voxelFacing, withActive, type IWorld, type RecipeDef } from '../core/types';
import { windAt } from '../sim/machines';
import { MECH_TWINS } from '../content/itemsWorkshop';
import { NON_KINETIC, PART_DEFS } from '../content/itemsWorkshopParts';
import type { GroundItems } from '../game/groundItems';
import { Contraptions, CONTRAPTION_KINDS } from './contraption';
import { SIGNAL_KINDS, Signals } from './signals';
import { isLogistic, Logistics, POWERED, type ActResult, type MachineActAction } from './logistics';
import { BASE_STRESS, DIAL_RATIOS, GEARSHIFT_PROGRAMS, GOVERNOR_NOTCHES, PULLEY_SIZES, cardProgram, clampCardSeconds, freshCard, readCard, snapDirection, snapRatio, solveNetwork, type CardStep, type KPart, type Source } from './kinetics';

export const CRANK_RPM = 16;
/** Seconds a crank keeps turning after one Use (holding Use repeats it). */
export const CRANK_S = 2.5;
/** Stress units one turning crank carries. */
export const CRANK_CAPACITY = 8;
/** Stress units per part (cranks and shafts cost nothing). */
export const STRESS: Record<string, number> = BASE_STRESS;
/** Generators that also turn a shaft they touch: rpm, and stress units per watt they make. */
export const GENERATOR_SHAFT: Record<string, { rpm: number; suPerW: number }> = {
  water_wheel: { rpm: 12, suPerW: 1 / 50 }, wind_turbine: { rpm: 16, suPerW: 1 / 50 }, steam_engine: { rpm: 24, suPerW: 1 / 50 },
};
/** Clockwork motor: rpm, capacity, seconds per wind and the most it holds. */
export const CLOCKWORK = { rpm: 24, capacity: 48, windS: 30, maxS: 120 };
/** Stress capacity factor of an oiled network: Heavy Residue (the distillery's lube base) and pine resin. */
export const LUBE = { residue: { factor: 1.25, s: 600 }, pine_resin: { factor: 1.1, s: 300 } } as const;
/** Furthest a chain / belt link reaches along a line, blocks. */
export const LINK_RANGE: Record<string, number> = { chain_sprocket: 16, belt_pulley: 9 };
/** Settings that Use cycles: how many states each part has. */
const CYCLES: Record<string, number> = { ratio_dial: DIAL_RATIOS.length, governor: GOVERNOR_NOTCHES.length, sequence_gearshift: GEARSHIFT_PROGRAMS.length, belt_pulley: PULLEY_SIZES.length, clutch: 2 };
/** Seconds per recipe stroke at 16 rpm. */
export const STROKE_S = 0.5;
/** Blocks per second a belt moves items at 16 rpm. */
export const BELT_SPEED = 1;
/** Most items a machine holds waiting to be worked. */
export const MACHINE_BUFFER = 16;
/** Most parts in one network (keeps a runaway search cheap). */
export const MAX_NET = 512;

const KINETIC = new Set(['hand_crank', 'drive_shaft', 'conveyor_belt', ...MECH_TWINS.map((t) => t.block), ...PART_DEFS.filter((d) => !NON_KINETIC.has(d.key)).map((d) => d.key), ...Object.keys(GENERATOR_SHAFT), ...POWERED, 'shear_pin', 'flywheel', 'differential', 'treadwheel']);
const TWIN = new Map(MECH_TWINS.map((t) => [t.block, t]));

export const isKinetic = (key: string): boolean => KINETIC.has(key);

const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** Facing -> unit vector of the side the block faces (North = -Z). */
export const FACE_VEC: Record<number, [number, number]> = { [Facing.North]: [0, -1], [Facing.East]: [1, 0], [Facing.South]: [0, 1], [Facing.West]: [-1, 0] };

interface Part {
  x: number; y: number; z: number; kind: string;
  /** setting (ratio index, clutch engaged, program, notch) */
  s: number;
  /** Punched card in a sequenced gearshift. Absent on old saves and on every other part. */
  card?: CardStep[];
}
interface MachineState { buffer: Record<string, number>; progress: number; recipe: string | null }
export interface NetInfo { rpm: number; stress: number; capacity: number; overstressed: boolean; parts: number; jammed?: boolean }

export interface WorkshopSnapshot {
  v: 1;
  parts: ([number, number, number, string] | [number, number, number, string, number])[];
  /** Clockwork wind left (s) and lubricant left (s) per part key. */
  wound?: Record<string, number>;
  logi?: unknown;
  sig?: unknown;
  pist?: unknown;
  lube?: Record<string, number>;
  machines: [number, number, number, Record<string, number>, number, string | null][];
  /** Punched programs keyed by cell. Absent on old saves, which keep the three presets. */
  cards?: Record<string, [number, number, number][]>;
  /** Skiff cell the player boarded. Absent when nobody is aboard. */
  ride?: [number, number, number];
}

/** Seconds of clockwork a tick spends. */
const DT_WIND = 0.05;

export interface SpinView { key: string; kind: string; x: number; y: number; z: number; rpm: number }
export interface SwingView { kind: string; x: number; y: number; z: number; phase: number; rpm: number; facing: Facing; src: [number, number, number] | null; tgt: [number, number, number] | null }
export interface LinkView { kind: string; x1: number; y: number; z1: number; x2: number; z2: number; rpm: number }
export interface WorkshopView { spin: SpinView[]; swings: SwingView[]; links: LinkView[] }
/** Parts that show a turning cog on top while they run. */
const SPIN_KINDS = new Set(['flywheel', 'differential', 'treadwheel', 'hand_crank', 'reverse_box', 'ratio_dial', 'split_box', 'worm_gear', 'chain_sprocket', 'belt_pulley', 'governor', 'sequence_gearshift', 'clutch', 'clockwork_motor', 'drive_shaft']);

/** Seconds a recipe takes at 16 rpm: strokes x STROKE_S, or half the drying / soaking time of a timed recipe. */
const needS = (r: RecipeDef): number => ((r.strokes ?? 0) > 0 ? (r.strokes as number) * STROKE_S : (r.timeS ?? 2) * 0.5);

export const FLYWHEEL_COAST_S = 4;
export const FLYWHEEL_CAPACITY = 12;

const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;

/** The workshop the open screen edits. The game builds one; tests that construct another take its place until dispose. */
let liveRef: Workshop | null = null;
export function liveWorkshop(): Workshop | null {
  return liveRef;
}

export class Workshop {
  private readonly parts = new Map<string, Part>();
  private readonly cranks = new Map<string, number>();
  private readonly wound = new Map<string, number>();
  private readonly lube = new Map<string, number>();
  private readonly lubeFactor = new Map<string, number>();
  private clock = 0;
  /** Watts a generator block makes right now (the sim's machine view); null = generators do not turn shafts. */
  generatorWatts: ((x: number, y: number, z: number) => number) | null = null;
  private readonly machines = new Map<string, MachineState>();
  /** rpm of every turning part this tick, and the network facts per part. */
  private readonly speed = new Map<string, number>();
  private readonly netOf = new Map<string, NetInfo>();
  private readonly seizedWarned = new Set<string>();
  /** More speed sources (the shaft core later): rpm a part gets from outside, or 0. */
  extraRpm: ((x: number, y: number, z: number) => number) | null = null;
  private readonly off: () => void;
  /** Richer "use this item on that block" for deployers (hoes, hand stations): set by Game; null/undefined falls back to placing and breaking. */
  /** True while a player or tame animal stands on the cell above (treadwheel); set by Game. */
  standingOn: ((x: number, y: number, z: number) => boolean) | null = null;
  /** Tractors the vehicle manager knows: one that is driven and has fuel turns a shaft it touches (power take-off). */
  tractors: (() => { x: number; y: number; z: number; occupied: boolean; fuel: number }[]) | null = null;
  /** Fluid blocks of the pipe network for spouts and drains (bucket use); set by Game. */
  fluidBlock: { is(x: number, y: number, z: number): boolean; use(x: number, y: number, z: number, item: string): string | null } | null = null;
  private readonly coast = new Map<string, { s: number; rpm: number }>();
  private readonly pto = new Set<string>();
  private dt = 0.05;
  actHook: ((a: MachineActAction) => ActResult | null | undefined) | null = null;
  readonly logi: Logistics;
  readonly signals: Signals;
  readonly contra: Contraptions;
  private holding = false;
  /** Time of day text for the clockface; set by Game. */
  clockText: (() => string) | null = null;
  /** World time for the wind vane. S10 assigns `() => clock.worldTimeS`. Until then the vane uses time since this workshop loaded. */
  timeS: (() => number) | null = null;
  /** Puts a returned punched card in the pack. S10 assigns `(item, n) => player.inventory.add(item, n)`. Until then the card drops. */
  giveItem: ((item: string, count: number) => void) | null = null;
  /** Skiff cell while the player is boarded, otherwise null. S10 moves the player; this does not. */
  readonly onRide: () => { x: number; y: number; z: number } | null = () => this.boardedCell();
  private boarded: string | null = null;
  /** Gearshift whose punched card the workshop screen is editing. */
  private editing: string | null = null;

  constructor(private readonly world: IWorld, private readonly bus: GameBus, private readonly ground: GroundItems, private readonly rng: () => number = Math.random) {
    this.signals = new Signals({ world, ground, bus, standingOn: () => this.standingOn });
    this.logi = new Logistics({
      world, ground, bus, rng,
      gate: (x, y, z) => this.signals.gate(x, y, z),
      rpmAt: (x, y, z) => Math.abs(this.speed.get(k3(x, y, z)) ?? 0),
      twinAccept: (x, y, z, item, n, commit) => this.twinAccept(x, y, z, item, n, commit),
      act: () => this.actHook,
      fluidBlock: () => this.fluidBlock,
    });
    this.contra = new Contraptions({
      world, ground, bus,
      signedRpm: (x, y, z) => this.speed.get(k3(x, y, z)) ?? 0,
      gate: (x, y, z) => this.signals.gate(x, y, z),
      movable: (x, y, z) => this.isMovable(world.getBlock(x, y, z).key),
      relocate: (map) => this.relocate(map),
      hold: (fn) => {
        this.holding = true;
        try {
          fn();
        } finally {
          this.holding = false;
        }
      },
    });
    this.off = bus.on('block:changed', (e) => this.noteBlock(e.x, e.y, e.z));
    liveRef = this;
  }

  dispose(): void {
    this.off();
    if (liveRef === this) liveRef = null;
  }

  /** Blocks a piston or bearing may carry: frames and every workshop part, never generators (sim machines) or the actuators. */
  private isMovable(kind: string): boolean {
    if (CONTRAPTION_KINDS.includes(kind as 'piston') || kind in GENERATOR_SHAFT) return false;
    return kind === 'contraption_frame' || KINETIC.has(kind) || isLogistic(kind) || SIGNAL_KINDS.has(kind);
  }

  /** Re-keys every per-block state of the moved blocks (contraptions): from -> to. */
  relocate(map: ReadonlyMap<string, [number, number, number]>): void {
    const re = <T>(m: Map<string, T>, fix?: (v: T, to: [number, number, number]) => void): void => {
      const moved: [string, T][] = [];
      for (const [from, to] of map) {
        const v = m.get(from);
        if (v === undefined) continue;
        m.delete(from);
        fix?.(v, to);
        moved.push([k3(...to), v]);
      }
      for (const [k, v] of moved) m.set(k, v);
    };
    re(this.parts, (p, t) => { [p.x, p.y, p.z] = t; });
    re(this.machines);
    re(this.cranks);
    re(this.wound);
    re(this.lube);
    re(this.lubeFactor);
    re(this.coast);
    if (this.boarded && map.has(this.boarded)) this.boarded = k3(...(map.get(this.boarded) as [number, number, number]));
    if (this.editing && map.has(this.editing)) this.editing = k3(...(map.get(this.editing) as [number, number, number]));
    this.logi.relocate(map);
    this.signals.relocate(map);
    this.contra.relocate(map);
  }

  private noteBlock(x: number, y: number, z: number): void {
    if (this.holding) return;
    const key = k3(x, y, z);
    const kind = this.world.getBlock(x, y, z).key;
    this.logi.noteBlock(x, y, z, kind);
    this.contra.noteBlock(x, y, z, kind);
    this.signals.noteBlock(x, y, z, kind);
    if (KINETIC.has(kind)) {
      const was = this.parts.get(key);
      if (!was || was.kind !== kind) {
        this.parts.set(key, { x, y, z, kind, s: kind === 'clutch' ? 1 : 0 });
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
    this.wound.delete(key);
    this.lube.delete(key);
    this.lubeFactor.delete(key);
  }

  // ---- Use ------------------------------------------------------------------------------------------

  /** Use on a part: crank a crank; put the held item into a machine. Null = not ours. */
  use(x: number, y: number, z: number, held: { item: string; count: number } | null, takeHeld: (n: number) => void): 'worked' | 'refused' | null {
    const key = k3(x, y, z);
    if (this.world.getBlock(x, y, z).key === 'skiff' && held === null) return this.toggleBoard(key);
    if (!this.logi.cells.has(key) && this.world.getBlock(x, y, z).key !== 'air') this.noteBlock(x, y, z);
    const shopped = this.logi.use(x, y, z, held, takeHeld);
    if (shopped !== null) return shopped;
    if (!(held && blockOrNull(held.item)) && this.signals.use(x, y, z)) return 'worked';
    const part = this.parts.get(key) ?? (KINETIC.has(this.world.getBlock(x, y, z).key) ? (this.noteBlock(x, y, z), this.parts.get(key)) : undefined);
    if (!part) return null;
    if (part.kind === 'hand_crank') {
      if (held && blockOrNull(held.item)) return null; // a held block is placed against it as usual
      const first = !this.cranks.has(key) || (this.cranks.get(key) ?? 0) <= 0;
      this.cranks.set(key, CRANK_S);
      if (first) this.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 0.6, volume: 0.5 });
      return 'worked';
    }
    if (part.kind === 'clockwork_motor' && !(held && blockOrNull(held.item))) {
      this.wound.set(key, Math.min(CLOCKWORK.maxS, (this.wound.get(key) ?? 0) + CLOCKWORK.windS));
      this.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 1.4, volume: 0.5 });
      this.bus.emit('toast', { text: `Wound: ${Math.round(this.wound.get(key) ?? 0)} s of turning`, kind: 'info' });
      return 'worked';
    }
    if (held && (held.item === 'residue_canister' || held.item === 'pine_resin') && part.kind !== 'hand_crank' && !blockOrNull(held.item)) {
      const lube = held.item === 'residue_canister' ? LUBE.residue : LUBE.pine_resin;
      for (const k of this.netMembers(key)) {
        this.lube.set(k, lube.s);
        this.lubeFactor.set(k, lube.factor);
      }
      takeHeld(1);
      this.bus.emit('toast', { text: `Oiled: this network carries ${Math.round((lube.factor - 1) * 100)}% more for ${Math.round(lube.s / 60)} min`, kind: 'info' });
      return 'worked';
    }
    if (part.kind === 'sequence_gearshift' && !(held && blockOrNull(held.item))) {
      if (held?.item === 'punched_card') {
        if (part.card) this.returnItem('punched_card', 1, x, y, z);
        part.card = freshCard();
        takeHeld(1);
        this.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 1.3, volume: 0.45 });
        this.bus.emit('toast', { text: 'Punched card in: eight steps, each 1 s forward at x1', kind: 'info' });
        return 'worked';
      }
      if (!held && part.card) {
        this.editing = key;
        this.bus.emit('ui:open', { screen: { type: 'workshop' } });
        return 'worked';
      }
      if (part.card) return null;
    }
    if (CYCLES[part.kind] && !(held && blockOrNull(held.item))) {
      part.s = (part.s + 1) % CYCLES[part.kind];
      this.bus.emit('sfx', { name: 'dig_wood', x: x + 0.5, y: y + 0.5, z: z + 0.5, pitch: 1.1 + part.s * 0.1, volume: 0.4 });
      this.bus.emit('toast', { text: this.setting(part) ?? '', kind: 'info' });
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
    this.clock += dt;
    this.dt = dt;
    this.findPto();
    this.signals.tick(this.clock);
    for (const [k, s] of this.lube) {
      if (s - dt <= 0) {
        this.lube.delete(k);
        this.lubeFactor.delete(k);
      } else this.lube.set(k, s - dt);
    }
    for (const [k, s] of this.cranks) {
      if (s - dt <= 0) this.cranks.delete(k);
      else this.cranks.set(k, s - dt);
    }
    this.solve();
    this.showActive();
    this.moveBelts(dt);
    this.work(dt);
    this.logi.tick(dt);
    this.contra.tick(dt);
  }

  /** Keys of the part and everything it touches or is linked to (clutches and all). */
  private netMembers(start: string): string[] {
    const seen = new Set([start]);
    const queue = [start];
    for (let i = 0; i < queue.length && queue.length < MAX_NET; i++) {
      for (const n of this.neighbours(queue[i])) {
        if (!seen.has(n)) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    return queue;
  }

  /** The six touching parts plus the chain / belt partners a sprocket or pulley reaches along a line. */
  private neighbours(key: string): string[] {
    const p = this.parts.get(key);
    if (!p) return [];
    const out: string[] = [];
    for (const [dx, dy, dz] of DIRS) {
      const n = k3(p.x + dx, p.y + dy, p.z + dz);
      if (this.parts.has(n)) out.push(n);
    }
    const range = LINK_RANGE[p.kind];
    if (range) {
      for (const [dx, dy, dz] of DIRS) {
        if (dy !== 0) continue;
        for (let d = 2; d <= range; d++) {
          const n = k3(p.x + dx * d, p.y, p.z + dz * d);
          const q = this.parts.get(n);
          if (q && q.kind === p.kind) {
            out.push(n);
            break;
          }
        }
      }
    }
    return out;
  }

  private sourceFor(key: string, p: Part): Source | null {
    if (p.kind === 'hand_crank') return this.cranks.has(key) ? { rpm: CRANK_RPM, capacity: CRANK_CAPACITY } : null;
    if (p.kind === 'clockwork_motor') return (this.wound.get(key) ?? 0) > 0 ? { rpm: CLOCKWORK.rpm, capacity: CLOCKWORK.capacity } : null;
    const g = GENERATOR_SHAFT[p.kind];
    if (g) {
      const w = this.generatorWatts?.(p.x, p.y, p.z) ?? 0;
      return w > 0 ? { rpm: g.rpm, capacity: w * g.suPerW } : null;
    }
    if (p.kind === 'treadwheel') return this.standingOn?.(p.x, p.y + 1, p.z) ? { rpm: 12, capacity: 24 } : null;
    if (this.pto.has(key)) return { rpm: 24, capacity: 30 };
    const extra = this.extraRpm?.(p.x, p.y, p.z) ?? 0;
    return extra > 0 ? { rpm: extra, capacity: CRANK_CAPACITY } : null;
  }

  /** Each driven, fuelled tractor turns the nearest drive shaft it touches. */
  private findPto(): void {
    this.pto.clear();
    for (const t of this.tractors?.() ?? []) {
      if (!t.occupied || t.fuel <= 0) continue;
      let best: string | null = null;
      let bd = 2.6;
      for (const [key, p] of this.parts) {
        if (p.kind !== 'drive_shaft') continue;
        const d = Math.hypot(p.x + 0.5 - t.x, p.z + 0.5 - t.z);
        if (d < bd && Math.abs(p.y - t.y) < 2) {
          bd = d;
          best = key;
        }
      }
      if (best) this.pto.add(best);
    }
  }

  private solve(): void {
    this.speed.clear();
    this.netOf.clear();
    const seen = new Set<string>();
    for (const [start, part] of this.parts) {
      if (seen.has(start)) continue;
      const members = this.netMembers(start);
      for (const m of members) seen.add(m);
      const sources = new Map<string, Source>();
      let lube = 1;
      for (const key of members) {
        const p = this.parts.get(key) as Part;
        const src = this.sourceFor(key, p);
        if (src) sources.set(key, src);
        lube = Math.max(lube, this.lubeFactor.get(key) ?? 1);
        if (p.kind === 'clockwork_motor' && src) this.wound.set(key, Math.max(0, (this.wound.get(key) ?? 0) - DT_WIND));
      }
      const run = (): ReturnType<typeof solveNetwork> => solveNetwork({
        members, sources, t: this.clock, capacityFactor: lube,
        part: (k): KPart => {
          const p = this.parts.get(k) as Part;
          const s = p.kind === 'clutch' && this.signals.flips(p.x, p.y, p.z) ? (p.s ? 0 : 1) : p.s;
          const card = p.kind === 'sequence_gearshift' && p.card ? cardProgram(p.card) : undefined;
          return card ? { kind: p.kind, s, card } : { kind: p.kind, s };
        },
        neighbours: (k) => this.neighbours(k),
      });
      let solved = run();
      // Flywheels: charged while their line turns, then they carry it on for a few seconds.
      let coasting = false;
      for (const key of members) {
        if ((this.parts.get(key) as Part).kind !== 'flywheel') continue;
        const r = solved.rpm.get(key);
        if (r !== undefined && r !== 0) this.coast.set(key, { s: FLYWHEEL_COAST_S, rpm: r });
        else {
          const c = this.coast.get(key);
          if (c && c.s > 0) {
            c.s -= this.dt;
            sources.set(key, { rpm: c.rpm, capacity: FLYWHEEL_CAPACITY * (c.s / FLYWHEEL_COAST_S) });
            coasting = true;
          }
        }
      }
      if (coasting) solved = run();
      // A shear pin gives way before the line seizes.
      if (sources.size > 0 && !solved.jam && solved.stress > solved.capacity) {
        const pin = members.find((k) => (this.parts.get(k) as Part).kind === 'shear_pin');
        if (pin) {
          const pp = this.parts.get(pin) as Part;
          this.world.setVoxel(pp.x, pp.y, pp.z, 0, 'sim');
          this.ground.spawn('scrap_metal', 1, pp.x + 0.5, pp.y + 0.5, pp.z + 0.5);
          this.bus.emit('sfx', { name: 'tool_break', x: pp.x + 0.5, y: pp.y + 0.5, z: pp.z + 0.5 });
          this.bus.emit('toast', { text: 'A shear pin snapped: the load was too much', kind: 'warn' });
        }
      }
      const maxRpm = [...solved.rpm.values()].reduce((m, r) => Math.max(m, Math.abs(r)), 0);
      const overstressed = sources.size > 0 && !solved.jam && solved.stress > solved.capacity;
      const info: NetInfo = { rpm: overstressed || solved.jam ? 0 : maxRpm, stress: solved.stress, capacity: solved.capacity, overstressed, parts: members.length, jammed: solved.jam };
      for (const key of members) {
        this.netOf.set(key, info);
        const r = solved.rpm.get(key);
        if (!overstressed && r !== undefined && r !== 0) this.speed.set(key, r);
      }
      if ((overstressed || solved.jam) && !this.seizedWarned.has(start)) {
        this.seizedWarned.add(start);
        this.bus.emit('toast', { text: solved.jam ? 'The gears fight each other: two sources or routes turn one part differently' : `Too much load: ${fmt(solved.stress)} on ${fmt(solved.capacity)} stress units. Add a source or take a machine off`, kind: 'warn' });
        this.bus.emit('sfx', { name: 'error', x: part.x + 0.5, y: part.y + 0.5, z: part.z + 0.5 });
        this.signals.ringNear(part.x, part.y, part.z);
      } else if (!overstressed && !solved.jam) this.seizedWarned.delete(start);
    }
  }

  /** One-line reading of a part's setting, for the toast and the goggles. */
  private setting(p: Part): string | null {
    switch (p.kind) {
      case 'ratio_dial': return `Ratio dial: speed x${DIAL_RATIOS[p.s]}`;
      case 'governor': return `Governor: at most ${GOVERNOR_NOTCHES[p.s]} rpm`;
      case 'sequence_gearshift': return p.card ? 'Punched card: 8 steps' : `Gearshift program ${p.s + 1} of ${GEARSHIFT_PROGRAMS.length}`;
      case 'belt_pulley': return `Pulley size ${PULLEY_SIZES[p.s]}`;
      case 'clutch': return p.s ? 'Clutch engaged' : 'Clutch released';
      default: return null;
    }
  }

  /** Mirrors "turning" in each part's ACTIVE bit (only on change: the mesher redraws a chunk per change). */
  private showActive(): void {
    for (const s of this.signals.states()) {
      const v = this.world.getVoxel(s.x, s.y, s.z);
      if (voxelActive(v) !== s.on) this.world.setVoxel(s.x, s.y, s.z, withActive(v, s.on), 'sim');
    }
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
      if (rpm === 0) continue;
      const [fx, fz] = FACE_VEC[voxelFacing(this.world.getVoxel(bx, by, bz))];
      const dir = rpm > 0 ? -1 : 1;
      const dx = fx * dir;
      const dz = fz * dir;
      const step = (BELT_SPEED * Math.abs(rpm)) / 16 * dt;
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
        const taken = this.logi.accept(ahead.x, ahead.y, ahead.z, e.item, e.count, false);
        if (taken > 0 && front.key !== 'conveyor_belt') {
          this.logi.accept(ahead.x, ahead.y, ahead.z, e.item, taken);
          e.count -= taken;
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
    return recipesAt(twin.station).find((r) => r.inputs[0]?.item === item && ((r.strokes ?? 0) > 0 || (kind === 'mech_rack' && (r.timeS ?? 0) > 0))) ?? null;
  }

  private twinAccept(x: number, y: number, z: number, item: string, n: number, commit: boolean): number {
    const key = k3(x, y, z);
    const p = this.parts.get(key);
    if (!p || !TWIN.has(p.kind) || !this.recipeFor(p.kind, item)) return 0;
    const take = Math.min(n, this.space(key));
    if (take > 0 && commit) this.intake(key, item, take);
    return Math.max(0, take);
  }

  // ---- The machine interface for other systems (docs/api/workshop.md) --------------------------------

  /** Hands items to the machine, depot, basin, funnel or crate at a cell; returns how many it took. */
  offer(x: number, y: number, z: number, item: string, count: number): number {
    return this.logi.accept(x, y, z, item, count);
  }

  /** Pulls a stack out of a depot, basin, funnel or crate. */
  take(x: number, y: number, z: number, filter: string | null = null, max = 64): { item: string; count: number } | null {
    return this.logi.take(x, y, z, filter, max);
  }

  /** Turns a hand crank as if a player held Use for `seconds`. */
  crank(x: number, y: number, z: number, seconds = CRANK_S): boolean {
    const key = k3(x, y, z);
    const p = this.parts.get(key);
    if (!p || p.kind !== 'hand_crank') return false;
    this.cranks.set(key, Math.max(this.cranks.get(key) ?? 0, seconds));
    return true;
  }

  /** Sets a signal cell on or off from outside (a construct pulling a lever). */
  signal(x: number, y: number, z: number, on: boolean): void {
    this.signals.setExternal(x, y, z, on);
  }

  /** Uses an item on a block the way a deployer does (place, break, hoe, strike a station). */
  act(a: MachineActAction): ActResult {
    return this.logi.act(a);
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
      const rpm = Math.abs(this.speed.get(key) ?? 0);
      if (rpm <= 0) continue;
      this.takeFromTop(key, p);
      const r = m.recipe ? recipesAt(TWIN.get(p.kind)!.station).find((x) => x.id === m.recipe) ?? null : this.nextRecipe(p.kind, m);
      if (!r) {
        m.recipe = null;
        m.progress = 0;
        continue;
      }
      m.recipe = r.id;
      const need = needS(r);
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
    const taken = this.logi.accept(p.x + fx, p.y, p.z + fz, item, count);
    if (taken >= count) return;
    if (taken > 0) count -= taken;
    this.ground.spawn(item, count, p.x + 0.5 + fx * 0.75, p.y + 0.3, p.z + 0.5 + fz * 0.75, { scatter: false, vx: fx * 1.2, vy: 1, vz: fz * 1.2, delayS: 1 });
  }

  // ---- Drawing (src/render/workshop) -----------------------------------------------------------------

  /** What the renderer animates near (px, pz): turning gear parts, swinging / pushing machines and chain or belt links. */
  view(px: number, pz: number, radius = 40): WorkshopView {
    const out: WorkshopView = { spin: [], swings: [], links: [] };
    const r2 = radius * radius;
    for (const [key, p] of this.parts) {
      const dx = p.x + 0.5 - px;
      const dz = p.z + 0.5 - pz;
      if (dx * dx + dz * dz > r2) continue;
      const rpm = this.speed.get(key) ?? 0;
      if (SPIN_KINDS.has(p.kind)) out.spin.push({ key, kind: p.kind, x: p.x, y: p.y, z: p.z, rpm });
      const range = LINK_RANGE[p.kind];
      if (range) {
        for (const [ddx, , ddz] of [[1, 0, 0], [0, 0, 1]]) {
          for (let d = 2; d <= range; d++) {
            const q = this.parts.get(k3(p.x + ddx * d, p.y, p.z + ddz * d));
            if (q && q.kind === p.kind) {
              out.links.push({ kind: p.kind, x1: p.x, y: p.y, z1: p.z, x2: q.x, z2: q.z, rpm });
              break;
            }
          }
        }
      }
    }
    for (const c of this.logi.cells.values()) {
      const dx = c.x + 0.5 - px;
      const dz = c.z + 0.5 - pz;
      if (dx * dx + dz * dz > r2 || !POWERED.has(c.kind)) continue;
      const rpm = this.speed.get(k3(c.x, c.y, c.z)) ?? 0;
      const sw: SwingView = { kind: c.kind, x: c.x, y: c.y, z: c.z, phase: c.phase, rpm, facing: voxelFacing(this.world.getVoxel(c.x, c.y, c.z)), src: null, tgt: null };
      if (c.kind === 'mech_arm' && c.src) {
        sw.src = c.src.split(',').map(Number) as [number, number, number];
        const t = c.targets[c.rr % Math.max(1, c.targets.length)];
        sw.tgt = t ? (t.split(',').map(Number) as [number, number, number]) : null;
      }
      out.swings.push(sw);
    }
    return out;
  }

  // ---- Views ------------------------------------------------------------------------------------------

  netAt(x: number, y: number, z: number): NetInfo | null {
    return this.netOf.get(k3(x, y, z)) ?? null;
  }

  /** One line for the goggles / the crosshair: "Millstone - 16 rpm, load 4.25/8 su, flour 40%". */
  describe(x: number, y: number, z: number): string | null {
    const key = k3(x, y, z);
    const p = this.parts.get(key);
    const extra = this.logi.describe(x, y, z);
    if (!p) {
      const block = this.world.getBlock(x, y, z).key;
      if (block === 'wind_vane') return this.windLine();
      if (extra) return block === 'skiff' && this.rideHere(x, y, z) ? `${extra}, boarded` : extra;
      const mv = this.contra.describe(x, y, z);
      if (mv) return block === 'skiff' && this.rideHere(x, y, z) ? `${mv}, boarded` : mv;
      if (block === 'clockface') return `Clockface - ${this.clockText?.() ?? 'no sun to read'}`;
      return this.signals.describe(x, y, z);
    }
    const name = blockOrNull(p.kind)?.name ?? p.kind;
    const net = this.netOf.get(key);
    const parts: string[] = [];
    if (!net || (net.rpm === 0 && !net.overstressed)) parts.push('still');
    else if (net.overstressed) parts.push(`overstressed ${fmt(net.stress)}/${fmt(net.capacity)} su`);
    else {
      const r = this.speed.get(key) ?? 0;
      parts.push(r === 0 ? 'idle' : `${r < 0 ? 'left' : 'right'} ${Math.round(Math.abs(r) * 10) / 10} rpm, load ${fmt(net.stress)}/${fmt(net.capacity)} su${(this.lubeFactor.get(key) ?? 1) > 1 ? ', oiled' : ''}`);
    }
    if (net?.jammed) parts[0] = 'jammed: the gears fight each other';
    const set = this.setting(p);
    if (set) parts.push(set);
    const mv = p.kind === 'piston' ? this.contra.describe(x, y, z) : null;
    if (mv) parts.push(`extended ${mv.split('extended ')[1]}`);
    if (p.kind === 'clockwork_motor') parts.push(`${Math.round(this.wound.get(key) ?? 0)} s wound`);
    const m = this.machines.get(key);
    if (m) {
      const held = Object.entries(m.buffer).map(([i, n]) => `${n} ${itemOrNull(i)?.name ?? i}`);
      if (m.recipe) {
        const r = recipesAt(TWIN.get(p.kind)!.station).find((x) => x.id === m.recipe);
        const need = r ? needS(r) : 1;
        parts.push(`${itemOrNull(r?.output.item ?? '')?.name ?? ''} ${Math.round((m.progress / need) * 100)}%`);
      }
      if (held.length) parts.push(`holds ${held.join(', ')}`);
    }
    return `${name} - ${parts.join(', ')}${extra && this.logi.cells.get(key) ? ` | ${extra.split(' - ').slice(1).join(' - ')}` : ''}`;
  }

  // ---- Save -------------------------------------------------------------------------------------------

  toJSON(): WorkshopSnapshot {
    const parts: WorkshopSnapshot['parts'] = [];
    for (const p of this.parts.values()) parts.push(p.s !== (p.kind === 'clutch' ? 1 : 0) ? [p.x, p.y, p.z, p.kind, p.s] : [p.x, p.y, p.z, p.kind]);
    const machines: WorkshopSnapshot['machines'] = [];
    for (const [key, m] of this.machines) {
      const [x, y, z] = key.split(',').map(Number);
      if (Object.keys(m.buffer).length || m.progress > 0) machines.push([x, y, z, { ...m.buffer }, m.progress, m.recipe]);
    }
    const out: WorkshopSnapshot = { v: 1, parts, machines };
    const cards: NonNullable<WorkshopSnapshot['cards']> = {};
    for (const p of this.parts.values()) {
      if (p.kind !== 'sequence_gearshift' || !p.card) continue;
      cards[k3(p.x, p.y, p.z)] = p.card.map((s) => [s.ratio, s.direction, s.seconds]);
    }
    if (Object.keys(cards).length) out.cards = cards;
    const ride = this.boardedCell();
    if (ride) out.ride = [ride.x, ride.y, ride.z];
    if (this.wound.size) out.wound = Object.fromEntries(this.wound);
    out.logi = this.logi.toJSON();
    out.sig = this.signals.toJSON();
    out.pist = this.contra.toJSON();
    return out;
  }

  /** Restores parts (checked against the world) and machine buffers; damaged entries are skipped. */
  load(raw: unknown): void {
    this.parts.clear();
    this.machines.clear();
    this.wound.clear();
    this.boarded = null;
    this.editing = null;
    this.logi.load((raw as { logi?: unknown } | null)?.logi);
    this.signals.load((raw as { sig?: unknown } | null)?.sig);
    if (!raw || typeof raw !== 'object') return;
    const s = raw as Partial<WorkshopSnapshot>;
    for (const row of Array.isArray(s.parts) ? s.parts : []) {
      if (!Array.isArray(row) || (row.length !== 4 && row.length !== 5)) continue;
      const [x, y, z, kind, setting] = row;
      if (![x, y, z].every(Number.isInteger) || typeof kind !== 'string' || !KINETIC.has(kind)) continue;
      const cap = CYCLES[kind] ?? 1;
      this.parts.set(k3(x, y, z), { x, y, z, kind, s: typeof setting === 'number' && setting >= 0 && setting < cap ? Math.floor(setting) : kind === 'clutch' ? 1 : 0 });
      if (TWIN.has(kind)) this.machines.set(k3(x, y, z), { buffer: {}, progress: 0, recipe: null });
    }
    const cards = (s as { cards?: unknown }).cards;
    if (cards && typeof cards === 'object') {
      for (const [key, row] of Object.entries(cards)) {
        const p = this.parts.get(key);
        const card = p?.kind === 'sequence_gearshift' ? readCard(row) : null;
        if (p && card) p.card = card;
      }
    }
    const ride = (s as { ride?: unknown }).ride;
    if (Array.isArray(ride) && ride.length === 3 && ride.every((n) => Number.isInteger(n))) this.boarded = k3(ride[0], ride[1], ride[2]);
    for (const [k, v] of Object.entries(s.wound ?? {})) if (this.parts.has(k) && typeof v === 'number' && v > 0) this.wound.set(k, Math.min(CLOCKWORK.maxS, v));
    for (const row of Array.isArray(s.machines) ? s.machines : []) {
      if (!Array.isArray(row) || row.length !== 6) continue;
      const [x, y, z, buffer, progress, recipe] = row;
      const m = this.machines.get(k3(x, y, z));
      if (!m || !buffer || typeof buffer !== 'object') continue;
      for (const [i, n] of Object.entries(buffer)) if (itemOrNull(i) && typeof n === 'number' && n > 0) m.buffer[i] = Math.min(MACHINE_BUFFER, Math.floor(n));
      m.progress = typeof progress === 'number' && progress > 0 ? progress : 0;
      m.recipe = typeof recipe === 'string' ? recipe : null;
    }
    // Actuators are found again from the blocks they stand on.
    for (const p of this.parts.values()) if (CONTRAPTION_KINDS.includes(p.kind as 'piston')) this.contra.noteBlock(p.x, p.y, p.z, p.kind);
    for (const c of this.logi.cells.values()) if (CONTRAPTION_KINDS.includes(c.kind as 'piston')) this.contra.noteBlock(c.x, c.y, c.z, c.kind);
    this.contra.load((raw as { pist?: unknown }).pist);
  }

  /** Re-checks every saved part against the world once chunks are in (a part whose block is gone is dropped). */
  verify(): void {
    this.logi.verify();
    this.signals.verify();
    for (const [key, p] of [...this.parts]) {
      if (!this.world.isLoaded(p.x, p.z)) continue;
      if (this.world.getBlock(p.x, p.y, p.z).key !== p.kind) {
        this.parts.delete(key);
        this.machines.delete(key);
        if (this.editing === key) this.editing = null;
      }
    }
    void this.boardedCell();
  }

  // ---- Punched card and skiff boarding ----------------------------------------------------------------

  /** Cell of the boarded skiff, or null when the player is on foot (or the skiff is gone). */
  private boardedCell(): { x: number; y: number; z: number } | null {
    if (!this.boarded) return null;
    const [x, y, z] = this.boarded.split(',').map(Number);
    if (this.world.isLoaded(x, z) && this.world.getBlock(x, y, z).key !== 'skiff') {
      this.boarded = null;
      return null;
    }
    return { x, y, z };
  }

  private rideHere(x: number, y: number, z: number): boolean {
    const cell = this.onRide();
    return cell !== null && cell.x === x && cell.y === y && cell.z === z;
  }

  /** Empty-handed Use on a skiff boards it; Use again steps off. A held item still loads the cart. */
  private toggleBoard(key: string): 'worked' {
    this.boarded = this.boarded === key ? null : key;
    const [x, y, z] = key.split(',').map(Number);
    this.bus.emit('toast', { text: this.boarded ? 'You board the skiff' : 'You step off the skiff', kind: 'info' });
    this.bus.emit('sfx', { name: 'step', x: x + 0.5, y: y + 0.5, z: z + 0.5, volume: 0.4 });
    return 'worked';
  }

  private returnItem(item: string, n: number, x: number, y: number, z: number): void {
    if (this.giveItem) {
      this.giveItem(item, n);
      return;
    }
    this.ground.spawn(item, n, x + 0.5, y + 1.1, z + 0.5, { scatter: false, delayS: 0.1 });
  }

  private windLine(): string {
    const params = machine('wind_turbine').params ?? {};
    const w = windAt(this.timeS?.() ?? this.clock, params.windMin ?? 0.25, params.windMax ?? 1);
    const text = Number.isInteger(w) ? String(w) : w.toFixed(2);
    return `Wind vane - wind ${text}`;
  }

  /** Gearshift the workshop screen is editing, or null when the guide should show. */
  editingAt(): { x: number; y: number; z: number } | null {
    if (!this.editing) return null;
    const p = this.parts.get(this.editing);
    if (!p || p.kind !== 'sequence_gearshift' || !p.card) return null;
    return { x: p.x, y: p.y, z: p.z };
  }

  /** A copy of the card being edited. */
  cardSteps(): CardStep[] | null {
    const p = this.edited();
    return p?.card?.map((s) => ({ ratio: s.ratio, direction: s.direction, seconds: s.seconds })) ?? null;
  }

  /** Cycles one step's ratio through DIAL_RATIOS. */
  cycleRatio(index: number): void {
    const step = this.edited()?.card?.[index];
    if (!step) return;
    const at = (DIAL_RATIOS as readonly number[]).indexOf(snapRatio(step.ratio));
    step.ratio = DIAL_RATIOS[(at + 1) % DIAL_RATIOS.length];
  }

  /** Cycles one step's direction forward, off, reverse. */
  cycleDirection(index: number): void {
    const step = this.edited()?.card?.[index];
    if (!step) return;
    const order = [1, 0, -1] as const;
    const at = order.indexOf(snapDirection(step.direction));
    step.direction = order[(at + 1) % order.length];
  }

  /** Steps one row's seconds by `delta`, staying inside 1–30. */
  stepSeconds(index: number, delta: number): void {
    const step = this.edited()?.card?.[index];
    if (!step) return;
    step.seconds = clampCardSeconds(step.seconds + delta);
  }

  /** Takes the card out of the gearshift being edited and returns it to the pack. */
  takeCard(): boolean {
    const p = this.edited();
    if (!p?.card) return false;
    p.card = undefined;
    this.returnItem('punched_card', 1, p.x, p.y, p.z);
    this.editing = null;
    return true;
  }

  clearEditing(): void {
    this.editing = null;
  }

  private edited(): Part | null {
    if (!this.editing) return null;
    const p = this.parts.get(this.editing);
    if (!p || p.kind !== 'sequence_gearshift' || !p.card) return null;
    return p;
  }
}

const fmt = (n: number): string => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''));

/** For tests: a voxel of a workshop block facing a way. */
export const partVoxel = (id: number, facing: Facing): number => makeVoxel(id, facing);
