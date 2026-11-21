/**
 * Essentia & Research at runtime (docs/api/magic.md). One object per world, owned by Game: the player's research, the
 * rod's charge, jars, pedestals and altars, the infusion in progress, clay servants, how much the land and the wellsprings
 * have been drawn, and the warding buff. Everything in-world goes through `use(target)`, called by the player's Use before
 * any placing or screen; the notebook and rune desk screens talk to it through NotebookApi / DeskApi.
 *
 * - Notebook: Use on a block = scan it; Use at the sky = open the notebook. A carried Scrying Lens gives 1.5x lore.
 * - Rods (RODS): each Use draws `draw` units - from a wellspring within NODE_REACH (research 'wellsprings', twice as
 *   fast) or else from the richest aspect of the blocks around (primal only until 'compound_draw'). With an empty vial
 *   carried the units fill vials (VIAL_UNITS each); without one they charge the rod, up to its capacity, for foci.
 * - Jars (essentia_jar, void_jar): a filled vial pours in, an empty vial fills back. Tubes join jars to consumers.
 * - Rune desk: Use opens the 'rune_desk' screen; arcane recipes pay ingredients and essentia (jars in DESK_REACH or tubed,
 *   then carried vials). Infusion: items on the altar and on pedestals within ALTAR_REACH; Use the altar with a rod.
 * - Foci (FOCI): spend rod charge. Clay servants crank hand cranks they touch while fed Spring.
 * - Furnace: a Vial of Cinder adds CINDER_BURN_S of fire (research 'warm_hearth'); with 'hearth_siphon' a Cinder jar
 *   touching (or tubed to) a burning furnace tops it up. Still: a Vial of Clarity on a flask takes water out ('still_trace').
 */
import type { GameBus } from '../core/context';
import { blockOrNull, blockId, itemOrNull } from '../core/registry';
import { FACE_DIRS, makeVoxel, voxelActive, withActive, type BlockDef, type Face, type IWorld } from '../core/types';
import { FOCI, JAR_UNITS, RODS, VIAL_UNITS, VOID_JAR_UNITS, vialKey, type RodTier } from '../content/itemsMagic';
import { ARCANE_RECIPES, INFUSIONS, type ArcaneRecipe, type InfusionRecipe } from '../content/recipesMagic';
import type { PlayerState } from '../game/playerState';
import { ASPECT_LIST, PRIMALS, aspectInfo, aspectsText, isAspect, type Aspect, type Aspects } from './aspects';
import type { BoardSpec } from './board';
import { RESEARCH } from './entries';
import { JAR_BLOCKS, jarsFor, shortfall, TUBE } from './essentiaNet';
import { aspectsOf } from './fingerprint';
import { craftGateReason } from './gates';
import { compass, NODE_HEIGHT, NODE_POOL, NODE_REACH, NODE_REGEN_S, nodesNear, type NodeSite } from './nodes';
import {
  entryStatus, freshResearch, hasFlag, hintFor, placeToken, removeToken, sanitizeResearch, scanObject,
  type EntryStatus, type PlaceResult, type ResearchState,
} from './research';

export const NOTEBOOK = 'field_notebook';
export const EMPTY_VIAL = 'glass_vial';
export const JAR_BLOCK = 'essentia_jar';
export const LENS = 'vein_lens';
/** Cube radius the rod reads the land in. */
export const GATHER_RADIUS = 3;
/** Seconds the land needs to recover one drawn unit (per chunk and aspect). */
export const DRAW_RECOVER_S = 30;
/** Units an aspect can give in one chunk before it is drained: its share of the nearby fingerprints, at most this. */
export const DRAW_CAP = 24;
/** Seconds between two rod draws (the Use repeat already paces it; this guards fast taps). */
export const ROD_INTERVAL_S = 0.2;
/** Fire seconds one Vial of Cinder adds to a burning furnace; the siphon adds a quarter of it per unit. */
export const CINDER_BURN_S = 90;
/** The siphon tops a fire up when it has less than this left. */
export const SIPHON_BELOW_S = 15;
/** Litres of water a Vial of Clarity takes out of a flask. */
export const CLARITY_L = 250;
/** Reach of the rune desk and the altar for jars (blocks), and of the altar for pedestals. */
export const DESK_REACH = 3;
export const ALTAR_REACH = 3;
/** Seconds between two units an infusion draws. */
export const INFUSE_STEP_S = 0.4;
/** Seconds of crank one unit of Spring buys a clay servant. */
export const SERVANT_FEED_S = 30;
/** Lore one studied vial gives. */
export const STUDY_LORE = 3;
/** Lens multiplier for scan lore. */
export const LENS_LORE = 1.5;
export const WARD_S = 30;
export const WARD_SCALE = 0.5;
export const BLINK_RANGE = 8;

const vialAspect = (item: string | null | undefined): Aspect | null => {
  if (!item?.startsWith('vial_')) return null;
  const a = item.slice(5);
  return isAspect(a) ? a : null;
};
const k3 = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const parse3 = (k: string): [number, number, number] => k.split(',').map(Number) as [number, number, number];
const DIRS: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** What the Use landed on; null = the sky. */
export interface MagicTarget { x: number; y: number; z: number; block: BlockDef; face?: Face }
export type MagicOutcome = 'worked' | 'refused' | 'screen';

export interface MagicGoal { id: string; title: string; done: boolean }

/** What the notebook screen needs (the UI never imports this file's values). */
export interface NotebookApi {
  research(): ResearchState;
  entries(): { key: string; title: string; text: string; status: EntryStatus; board: BoardSpec | null; age: string }[];
  place(entry: string, cell: number, aspect: Aspect): PlaceResult;
  remove(entry: string, cell: number): boolean;
  hint(entry: string): { cell: number; aspect: Aspect } | null;
  /** Scans an item the player carries (by key). */
  scanItem(key: string): string;
  /** Studies one carried vial (research 'distilled_lore'); returns what happened. */
  study(vial: string): string;
  canStudy(): boolean;
  goals(): MagicGoal[];
  charge(): { charge: number; capacity: number };
}

export interface DeskRow {
  id: string;
  output: string;
  count: number;
  inputs: { item: string; count: number; have: number }[];
  cost: { aspect: Aspect; n: number; have: number }[];
  /** null = can be made now; else why not. */
  problem: string | null;
}
export interface DeskApi {
  rows(): DeskRow[];
  make(id: string): string;
}

export interface MagicHooks {
  /** Adds seconds of fire to the furnace at x, y, z if it is burning; false when it is not a burning furnace. */
  stokeFurnace?(x: number, y: number, z: number, seconds: number): boolean;
  /** Seconds of fire left in the burning furnace at x, y, z, or null. */
  furnaceFire?(x: number, y: number, z: number): number | null;
  /** Lights the furnace at x, y, z; null = lit, else the reason. */
  lightFurnace?(x: number, y: number, z: number): string | null;
  /** Takes up to `litres` of water out of the chemistry flask at x, y, z; returns litres taken (0 = not a flask / none). */
  purifyFlask?(x: number, y: number, z: number, litres: number): number;
  /** Turns the hand crank at x, y, z as a player's Use would. */
  crank?(x: number, y: number, z: number): boolean;
}

interface Jar { aspect: Aspect | null; n: number }
interface Draw { n: number; t: number }
interface Infusion { x: number; y: number; z: number; id: string; paid: Aspects; t: number; waitS: number; step: number }

export interface MagicSnapshot {
  v: 1;
  research: ResearchState;
  jars: [number, number, number, string, number][];
  draws: Record<string, Record<string, [number, number]>>;
  charge?: number;
  pedestals?: [number, number, number, string][];
  altars?: [number, number, number, string][];
  infusion?: { x: number; y: number; z: number; id: string; paid: Aspects; t: number } | null;
  servants?: [number, number, number, number][];
  nodes?: Record<string, number>;
  stats?: { infusions: number; casts: number; studied: number; crafted: number };
}

export class Magic {
  research: ResearchState = freshResearch();
  /** Rod charge for foci (one pool, capped by the best rod carried). */
  charge = 0;
  wardS = 0;
  readonly stats = { infusions: 0, casts: 0, studied: 0, crafted: 0 };
  private readonly jars = new Map<string, Jar>();
  private readonly draws = new Map<string, Map<Aspect, Draw>>();
  private readonly nodeDraws = new Map<string, Draw>();
  private readonly pedestals = new Map<string, string>();
  private readonly altars = new Map<string, string>();
  private readonly servants = new Map<string, number>();
  private infusion: Infusion | null = null;
  private rod: { aspect: Aspect | null; n: number } = { aspect: null, n: 0 };
  private readonly cooldowns = new Map<string, number>();
  private clock = 0;
  private lastDraw = -1;
  private slowT = 0;
  private readonly off: () => void;
  private readonly lastAdvice = new Map<string, number>();

  constructor(
    private readonly world: IWorld,
    private readonly bus: GameBus,
    private readonly player: PlayerState,
    private readonly hooks: MagicHooks = {},
    readonly seed = 0,
  ) {
    this.off = bus.on('block:changed', (e) => this.blockChanged(e.x, e.y, e.z));
  }

  dispose(): void {
    this.off();
    this.player.damageScale = 1;
  }

  private blockChanged(x: number, y: number, z: number): void {
    const k = k3(x, y, z);
    const key = this.world.getBlock(x, y, z).key;
    if (this.jars.has(k) && !JAR_BLOCKS.has(key)) this.jars.delete(k);
    if (this.pedestals.has(k) && key !== 'arcane_pedestal') this.dropAt(x, y, z, this.pedestals.get(k) as string, () => this.pedestals.delete(k));
    if (this.altars.has(k) && key !== 'infusion_altar') this.dropAt(x, y, z, this.altars.get(k) as string, () => this.altars.delete(k));
    if (this.infusion && k3(this.infusion.x, this.infusion.y, this.infusion.z) === k && key !== 'infusion_altar') this.infusion = null;
    if (key === 'clay_servant') {
      if (!this.servants.has(k)) this.servants.set(k, 0);
    } else this.servants.delete(k);
  }

  private dropAt(x: number, y: number, z: number, item: string, after: () => void): void {
    this.player.ground.spawn(item, 1, x + 0.5, y + 0.6, z + 0.5);
    after();
  }

  // ---- small helpers -----------------------------------------------------------------------------------------------

  private toast(text: string, item?: string, kind: 'info' | 'good' | 'warn' = 'info'): void {
    this.bus.emit('toast', item ? { text, kind, item } : { text, kind });
  }

  private advise(text: string): void {
    const t = this.lastAdvice.get(text);
    if (t !== undefined && this.clock - t < 4) return;
    this.lastAdvice.set(text, this.clock);
    this.toast(text);
  }

  private blockAt = (x: number, y: number, z: number): string => this.world.getBlock(x, y, z).key;

  /** The best rod carried, or null. */
  bestRod(): RodTier | null {
    let best: RodTier | null = null;
    for (const r of RODS) if (this.player.inventory.has(r.key)) best = r;
    return best;
  }

  private heldRod(): RodTier | null {
    const held = this.player.heldStack()?.item;
    return RODS.find((r) => r.key === held) ?? null;
  }

  /** Why the player cannot craft this recipe yet, or null. */
  craftGate(recipeId: string): string | null {
    return craftGateReason(this.research, recipeId);
  }

  // ---- tick ----------------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.clock += dt;
    for (const [k, s] of this.cooldowns) if (s - dt <= 0) this.cooldowns.delete(k); else this.cooldowns.set(k, s - dt);
    if (this.wardS > 0) {
      this.wardS = Math.max(0, this.wardS - dt);
      this.player.damageScale = this.wardS > 0 ? WARD_SCALE : 1;
      if (this.wardS === 0) this.toast('The ward fades');
    }
    const cap = this.bestRod()?.capacity ?? 0;
    if (this.charge > cap) this.charge = cap;
    this.tickInfusion(dt);
    this.slowT += dt;
    if (this.slowT >= 1) {
      this.slowT -= 1;
      this.tickServants(1);
      this.tickSiphon();
    }
  }

  // ---- Use -----------------------------------------------------------------------------------------------------------

  use(target: MagicTarget | null): MagicOutcome | null {
    const held = this.player.heldStack()?.item ?? null;
    if (held === NOTEBOOK) {
      if (!target) {
        this.bus.emit('ui:open', { screen: { type: 'notebook' } });
        return 'screen';
      }
      this.scanBlock(target.block.key);
      return 'worked';
    }
    const key = target?.block.key;
    const rod = this.heldRod();
    if (rod) {
      if (target && key === 'infusion_altar') return this.startInfusion(target);
      return this.gather(rod);
    }
    const focus = FOCI.find((f) => f.key === held);
    if (focus) return this.cast(focus.key, focus.cost, focus.cooldownS, target);
    if (!target) return null;
    if (key && JAR_BLOCKS.has(key) && (held === EMPTY_VIAL || vialAspect(held))) return this.useJar(target, held as string);
    if (key === 'arcane_pedestal') return this.usePedestal(target, held);
    if (key === 'infusion_altar') return this.useAltar(target, held);
    if (key === 'rune_desk') {
      this.bus.emit('ui:open', { screen: { type: 'rune_desk', x: target.x, y: target.y, z: target.z } });
      return 'screen';
    }
    const va = vialAspect(held);
    if (va === 'cinder' && this.hooks.stokeFurnace && blockOrNull(key ?? '')?.machine === 'furnace') return this.stoke(target);
    if (va === 'clarity' && this.hooks.purifyFlask && hasFlag(this.research, 'still_clarity')) {
      const taken = this.hooks.purifyFlask(target.x, target.y, target.z, CLARITY_L);
      if (taken > 0) {
        this.player.consumeHeld(1);
        this.player.give(EMPTY_VIAL, 1);
        this.toast(`Clarity draws ${Math.round(taken)} L of water out of the flask`, undefined, 'good');
        this.bus.emit('sfx', { name: 'pour', x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5, pitch: 1.4 });
        return 'worked';
      }
    }
    return null;
  }

  // ---- scanning ------------------------------------------------------------------------------------------------------

  scanBlock(key: string): string {
    const name = blockOrNull(key)?.name ?? itemOrNull(key)?.name ?? key;
    const fp = aspectsOf(key);
    const mult = this.player.inventory.has(LENS) ? LENS_LORE : 1;
    const r = scanObject(this.research, key, fp, mult);
    let text: string;
    if (!r.first) text = `${name}: ${aspectsText(fp)} (already in your notes)`;
    else {
      text = `Noted ${name}: +${aspectsText(r.gained)} lore`;
      if (r.learned.length) text += `. New aspect: ${r.learned.map((a) => aspectInfo(a).name).join(', ')}`;
      this.bus.emit('sfx', { name: 'scan_chime' });
    }
    for (const f of r.finished) {
      const e = RESEARCH.find((x) => x.key === f);
      if (e) this.toast(`Research done: ${e.title}`, undefined, 'good');
    }
    this.toast(text, NOTEBOOK);
    return text;
  }

  /** "Copper Ore: Vein 3, Loam 1" for a held notebook with the lens carried, or null. */
  lensLabel(key: string): string | null {
    if (this.player.heldStack()?.item !== NOTEBOOK || !this.player.inventory.has(LENS)) return null;
    const name = blockOrNull(key)?.name ?? key;
    return `${name}: ${aspectsText(aspectsOf(key))}`;
  }

  // ---- the land, wellsprings and the rod -----------------------------------------------------------------------------

  drawn(x: number, z: number, aspect: Aspect): number {
    const d = this.draws.get(chunkKey(x, z))?.get(aspect);
    if (!d) return 0;
    return Math.max(0, d.n - (this.clock - d.t) / DRAW_RECOVER_S);
  }

  landAspects(cx: number, cy: number, cz: number): Map<Aspect, number> {
    const sum = new Map<Aspect, number>();
    const R = GATHER_RADIUS;
    for (let y = cy - R; y <= cy + R; y++)
      for (let z = cz - R; z <= cz + R; z++)
        for (let x = cx - R; x <= cx + R; x++) {
          const b = this.world.getBlock(x, y, z);
          if (b.key === 'air') continue;
          const fp = aspectsOf(b.key);
          for (const a of ASPECT_LIST) if (fp[a]) sum.set(a, (sum.get(a) ?? 0) + fp[a]!);
        }
    return sum;
  }

  private drawable(a: Aspect): boolean {
    return (PRIMALS as readonly string[]).includes(a) || hasFlag(this.research, 'compound_draw');
  }

  /** The aspect the rod would draw from the land here and how much is left of it (null = nothing). */
  richest(px: number, py: number, pz: number): { aspect: Aspect; left: number } | null {
    const land = this.landAspects(px, py, pz);
    let best: { aspect: Aspect; left: number } | null = null;
    for (const [a, n] of land) {
      if (!this.drawable(a)) continue;
      const left = Math.min(DRAW_CAP, Math.floor(n / 8)) - this.drawn(px, pz, a);
      if (left >= 1 && (!best || left > best.left)) best = { aspect: a, left };
    }
    return best;
  }

  /** Wellsprings near a point with their y and what is left in them. */
  nodesAround(x: number, z: number, radiusChunks = 2): (NodeSite & { y: number; left: number })[] {
    return nodesNear(this.seed, x, z, radiusChunks)
      .filter((n) => this.world.isLoaded(n.x, n.z))
      .map((n) => ({ ...n, y: this.world.surfaceY(n.x, n.z) + NODE_HEIGHT, left: this.nodeLeft(n.key) }));
  }

  nodeLeft(key: string): number {
    const d = this.nodeDraws.get(key);
    if (!d) return NODE_POOL;
    return Math.min(NODE_POOL, NODE_POOL - Math.max(0, d.n - (this.clock - d.t) / NODE_REGEN_S));
  }

  private takeNode(key: string, n: number): void {
    const used = NODE_POOL - this.nodeLeft(key) + n;
    this.nodeDraws.set(key, { n: used, t: this.clock });
  }

  private nearNode(): (NodeSite & { y: number; left: number }) | null {
    if (!hasFlag(this.research, 'node_tap')) return null;
    const p = this.player.position;
    let best: (NodeSite & { y: number; left: number }) | null = null;
    let bestD = Infinity;
    for (const n of this.nodesAround(p.x, p.z, 1)) {
      const d = Math.hypot(n.x + 0.5 - p.x, n.y - (p.y + 1), n.z + 0.5 - p.z);
      if (d <= NODE_REACH && n.left >= 1 && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  /** The held rod's reading of the land (research 'aura_reading'), for the crosshair; null otherwise. */
  rodReading(): string | null {
    if (!this.heldRod() || !hasFlag(this.research, 'aura_reading')) return null;
    const p = this.player.position;
    const px = Math.floor(p.x);
    const pz = Math.floor(p.z);
    const land = [...this.landAspects(px, Math.floor(p.y + 0.5), pz)]
      .filter(([a]) => this.drawable(a))
      .map(([a, n]) => [a, Math.max(0, Math.min(DRAW_CAP, Math.floor(n / 8)) - Math.floor(this.drawn(px, pz, a)))] as [Aspect, number])
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([a, n]) => `${aspectInfo(a).name} ${n}`);
    let text = `Land: ${land.length ? land.join(', ') : 'drained'}`;
    const nodes = this.nodesAround(p.x, p.z, 3);
    if (nodes.length) {
      const n = nodes.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      const d = Math.round(Math.hypot(n.x + 0.5 - p.x, n.z + 0.5 - p.z));
      text += ` - wellspring of ${aspectInfo(n.aspect).name} ${d < 3 ? 'here' : `${d} blocks ${compass(p.x, p.z, n.x + 0.5, n.z + 0.5)}`} (${Math.floor(n.left)})`;
    }
    return text;
  }

  private gather(rod: RodTier): MagicOutcome {
    if (this.clock - this.lastDraw < ROD_INTERVAL_S && this.lastDraw >= 0) return 'worked';
    const p = this.player;
    const toVial = p.inventory.has(EMPTY_VIAL);
    if (!toVial && this.charge >= rod.capacity) {
      this.advise(`The rod is full (${rod.capacity} charge). Carry an empty vial to bottle what it draws`);
      return 'refused';
    }
    const node = this.nearNode();
    let aspect: Aspect;
    let units = rod.draw;
    const px = Math.floor(p.position.x);
    const pz = Math.floor(p.position.z);
    if (node) {
      aspect = node.aspect;
      units = Math.min(rod.draw * 2, Math.floor(node.left));
      this.takeNode(node.key, units);
    } else {
      const r = this.richest(px, Math.floor(p.position.y + 0.5), pz);
      if (!r) {
        this.advise('The land here is drained. Move on, or wait for it to recover');
        return 'refused';
      }
      aspect = this.rod.aspect && toVial && this.leftOf(this.rod.aspect) >= 1 ? this.rod.aspect : r.aspect;
      units = Math.min(units, Math.floor(this.leftOf(aspect)));
      for (let i = 0; i < units; i++) this.markDrawn(px, pz, aspect);
    }
    this.lastDraw = this.clock;
    if (units <= 0) return 'refused';
    this.bus.emit('sfx', { name: 'rod_hum', pitch: 0.8 + this.rod.n * 0.1 });
    if (!toVial) {
      this.charge = Math.min(rod.capacity, this.charge + units);
      return 'worked';
    }
    if (this.rod.aspect !== aspect) this.rod = { aspect, n: 0 };
    this.rod.n += units;
    while (this.rod.n >= VIAL_UNITS && p.inventory.has(EMPTY_VIAL)) {
      p.inventory.remove(EMPTY_VIAL, 1);
      p.give(vialKey(aspect), 1);
      this.rod.n -= VIAL_UNITS;
      this.toast(`Filled a Vial of ${aspectInfo(aspect).name}`, vialKey(aspect));
    }
    return 'worked';
  }

  private leftOf(a: Aspect): number {
    const p = this.player.position;
    const px = Math.floor(p.x);
    const pz = Math.floor(p.z);
    const n = this.landAspects(px, Math.floor(p.y + 0.5), pz).get(a) ?? 0;
    return Math.min(DRAW_CAP, Math.floor(n / 8)) - this.drawn(px, pz, a);
  }

  private markDrawn(x: number, z: number, a: Aspect): void {
    const k = chunkKey(x, z);
    let m = this.draws.get(k);
    if (!m) this.draws.set(k, (m = new Map()));
    m.set(a, { n: this.drawn(x, z, a) + 1, t: this.clock });
  }

  // ---- jars ----------------------------------------------------------------------------------------------------------

  jarCapacity(x: number, y: number, z: number): number {
    return this.world.getBlock(x, y, z).key === 'void_jar' ? VOID_JAR_UNITS : JAR_UNITS;
  }

  jarAt(x: number, y: number, z: number): Jar | null {
    if (!JAR_BLOCKS.has(this.world.getBlock(x, y, z).key)) return null;
    return this.jars.get(k3(x, y, z)) ?? { aspect: null, n: 0 };
  }

  jarText(x: number, y: number, z: number): string | null {
    const j = this.jarAt(x, y, z);
    if (!j) return null;
    const name = blockOrNull(this.world.getBlock(x, y, z).key)?.name ?? 'Jar';
    return j.aspect && j.n > 0 ? `${name} - ${aspectInfo(j.aspect).name} ${j.n}/${this.jarCapacity(x, y, z)}` : `${name} - empty`;
  }

  /** Every jar with essentia, for the renderer: position, aspect, fill 0..1. */
  jarFills(): { x: number; y: number; z: number; aspect: Aspect; fill: number }[] {
    const out: { x: number; y: number; z: number; aspect: Aspect; fill: number }[] = [];
    for (const [k, j] of this.jars) {
      if (!j.aspect || j.n <= 0) continue;
      const [x, y, z] = parse3(k);
      out.push({ x, y, z, aspect: j.aspect, fill: j.n / this.jarCapacity(x, y, z) });
    }
    return out;
  }

  private setJar(x: number, y: number, z: number, aspect: Aspect | null, n: number): void {
    this.jars.set(k3(x, y, z), { aspect: n > 0 ? aspect : null, n: Math.max(0, n) });
  }

  private useJar(t: MagicTarget, held: string): MagicOutcome {
    const jar = this.jarAt(t.x, t.y, t.z) ?? { aspect: null, n: 0 };
    const cap = this.jarCapacity(t.x, t.y, t.z);
    const p = this.player;
    const va = vialAspect(held);
    if (va) {
      if (jar.aspect && jar.aspect !== va && jar.n > 0) {
        this.advise(`This jar holds ${aspectInfo(jar.aspect).name}; aspects do not mix`);
        return 'refused';
      }
      if (jar.n + VIAL_UNITS > cap) {
        this.advise('The jar is full');
        return 'refused';
      }
      p.consumeHeld(1);
      p.give(EMPTY_VIAL, 1);
      this.setJar(t.x, t.y, t.z, va, jar.n + VIAL_UNITS);
    } else {
      if (!jar.aspect || jar.n < VIAL_UNITS) {
        this.advise('The jar has too little essentia to fill a vial');
        return 'refused';
      }
      p.consumeHeld(1);
      p.give(vialKey(jar.aspect), 1);
      this.setJar(t.x, t.y, t.z, jar.aspect, jar.n - VIAL_UNITS);
    }
    this.bus.emit('sfx', { name: 'essentia_pour', x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 });
    this.toast(this.jarText(t.x, t.y, t.z) ?? '');
    return 'worked';
  }

  /** Essentia the jars in reach of x, y, z hold, per aspect. */
  private available(x: number, y: number, z: number, radius: number, withVials: boolean): Aspects {
    const have: Aspects = {};
    for (const [jx, jy, jz] of jarsFor(this.blockAt, x, y, z, radius)) {
      const j = this.jarAt(jx, jy, jz);
      if (j?.aspect && j.n > 0) have[j.aspect] = (have[j.aspect] ?? 0) + j.n;
    }
    if (withVials) for (const a of ASPECT_LIST) {
      const n = this.player.inventory.count(vialKey(a));
      if (n > 0) have[a] = (have[a] ?? 0) + n * VIAL_UNITS;
    }
    return have;
  }

  /** Takes `n` units of `aspect` from the jars in reach (then whole carried vials when allowed). Returns units taken. */
  private take(x: number, y: number, z: number, radius: number, aspect: Aspect, n: number, withVials: boolean): number {
    let need = n;
    for (const [jx, jy, jz] of jarsFor(this.blockAt, x, y, z, radius)) {
      if (need <= 0) break;
      const j = this.jarAt(jx, jy, jz);
      if (!j || j.aspect !== aspect || j.n <= 0) continue;
      const t = Math.min(need, j.n);
      this.setJar(jx, jy, jz, aspect, j.n - t);
      need -= t;
    }
    while (withVials && need > 0 && this.player.inventory.has(vialKey(aspect))) {
      this.player.inventory.remove(vialKey(aspect), 1);
      this.player.give(EMPTY_VIAL, 1);
      need -= VIAL_UNITS;
    }
    return n - Math.max(0, need);
  }

  // ---- furnace and siphon --------------------------------------------------------------------------------------------

  private stoke(t: MagicTarget): MagicOutcome {
    if (!hasFlag(this.research, 'hearth_cinder')) {
      this.advise('Research "Cinder for the Hearth" to feed essentia to a fire');
      return 'refused';
    }
    if (!this.hooks.stokeFurnace?.(t.x, t.y, t.z, CINDER_BURN_S)) {
      this.advise('Light the fire first: Cinder only feeds a burning furnace');
      return 'refused';
    }
    this.player.consumeHeld(1);
    this.player.give(EMPTY_VIAL, 1);
    this.toast(`The fire takes the Cinder: +${CINDER_BURN_S} s of burn`);
    return 'worked';
  }

  private tickSiphon(): void {
    if (!hasFlag(this.research, 'hearth_siphon') || !this.hooks.furnaceFire || !this.hooks.stokeFurnace) return;
    for (const [k, j] of this.jars) {
      if (j.aspect !== 'cinder' || j.n <= 0) continue;
      const [x, y, z] = parse3(k);
      for (const [fx, fy, fz] of this.consumersOf(x, y, z)) {
        const left = this.hooks.furnaceFire(fx, fy, fz);
        if (left === null || left >= SIPHON_BELOW_S) continue;
        if (this.hooks.stokeFurnace(fx, fy, fz, CINDER_BURN_S / VIAL_UNITS)) {
          this.setJar(x, y, z, 'cinder', j.n - 1);
          break;
        }
      }
    }
  }

  /** Cells next to a jar or next to any tube joined to it (where a furnace or a servant may stand). */
  private consumersOf(x: number, y: number, z: number): [number, number, number][] {
    const out: [number, number, number][] = DIRS.map(([dx, dy, dz]) => [x + dx, y + dy, z + dz]);
    const seen = new Set<string>();
    const queue = out.filter(([a, b, c]) => this.blockAt(a, b, c) === TUBE);
    for (const c of queue) seen.add(k3(...c));
    while (queue.length && seen.size < 256) {
      const [tx, ty, tz] = queue.pop() as [number, number, number];
      for (const [dx, dy, dz] of DIRS) {
        const c: [number, number, number] = [tx + dx, ty + dy, tz + dz];
        if (this.blockAt(...c) === TUBE) {
          if (!seen.has(k3(...c))) {
            seen.add(k3(...c));
            queue.push(c);
          }
        } else out.push(c);
      }
    }
    return out;
  }

  // ---- rune desk -----------------------------------------------------------------------------------------------------

  desk(x: number, y: number, z: number): DeskApi {
    return {
      rows: () => ARCANE_RECIPES.map((r) => this.deskRow(r, x, y, z)),
      make: (id) => this.deskMake(id, x, y, z),
    };
  }

  private deskRow(r: ArcaneRecipe, x: number, y: number, z: number): DeskRow {
    const have = this.available(x, y, z, DESK_REACH, true);
    const inputs = r.inputs.map((i) => ({ item: i.item, count: i.count, have: this.player.inventory.count(i.item) }));
    const cost = (Object.entries(r.cost) as [Aspect, number][]).map(([aspect, n]) => ({ aspect, n, have: have[aspect] ?? 0 }));
    let problem = this.craftGate(r.id);
    if (!problem && inputs.some((i) => i.have < i.count)) problem = 'Missing ingredients';
    if (!problem && Object.keys(shortfall(r.cost, have)).length) problem = `Not enough essentia: ${aspectsText(shortfall(r.cost, have))}`;
    return { id: r.id, output: r.output.item, count: r.output.count, inputs, cost, problem };
  }

  private deskMake(id: string, x: number, y: number, z: number): string {
    const r = ARCANE_RECIPES.find((a) => a.id === id);
    if (!r) return 'No such recipe';
    const row = this.deskRow(r, x, y, z);
    if (row.problem) return row.problem;
    for (const i of r.inputs) this.player.inventory.remove(i.item, i.count);
    for (const [a, n] of Object.entries(r.cost) as [Aspect, number][]) this.take(x, y, z, DESK_REACH, a, n, true);
    this.player.give(r.output.item, r.output.count);
    this.stats.crafted++;
    this.bus.emit('item:made', { item: r.output.item, count: r.output.count, station: 'rune_desk', recipeId: r.id });
    this.bus.emit('sfx', { name: 'infuse', x: x + 0.5, y: y + 1, z: z + 0.5 });
    const name = itemOrNull(r.output.item)?.name ?? r.output.item;
    this.toast(`Made ${name}`, r.output.item, 'good');
    return `Made ${name}`;
  }

  // ---- pedestals and the infusion altar ----------------------------------------------------------------------------

  private usePedestal(t: MagicTarget, held: string | null): MagicOutcome {
    const k = k3(t.x, t.y, t.z);
    const on = this.pedestals.get(k);
    if (on) {
      this.pedestals.delete(k);
      this.player.give(on, 1);
      return 'worked';
    }
    if (!held) return 'refused';
    this.player.consumeHeld(1);
    this.pedestals.set(k, held);
    return 'worked';
  }

  private useAltar(t: MagicTarget, held: string | null): MagicOutcome {
    const k = k3(t.x, t.y, t.z);
    const on = this.altars.get(k);
    if (this.infusion && k3(this.infusion.x, this.infusion.y, this.infusion.z) === k) {
      this.advise('The infusion is still drawing essentia');
      return 'refused';
    }
    if (on) {
      this.altars.delete(k);
      this.player.give(on, 1);
      return 'worked';
    }
    if (!held) {
      this.advise('Set the heart item on the altar, the rest on pedestals, then Use the altar with a rod');
      return 'refused';
    }
    this.player.consumeHeld(1);
    this.altars.set(k, held);
    return 'worked';
  }

  /** Pedestal cells (with what lies on them) an altar at x, y, z reaches. */
  pedestalsOf(x: number, y: number, z: number): [string, string][] {
    const out: [string, string][] = [];
    for (const [k, item] of this.pedestals) {
      const [px, py, pz] = parse3(k);
      if (Math.abs(py - y) <= 1 && Math.max(Math.abs(px - x), Math.abs(pz - z)) <= ALTAR_REACH && (px !== x || pz !== z)) out.push([k, item]);
    }
    return out;
  }

  /** The infusion the items on and around an altar make, or null. */
  matchInfusion(x: number, y: number, z: number): InfusionRecipe | null {
    const center = this.altars.get(k3(x, y, z));
    if (!center) return null;
    const around = this.pedestalsOf(x, y, z).map(([, i]) => i).sort();
    return INFUSIONS.find((r) => r.center === center && [...r.around].sort().join('|') === around.join('|')) ?? null;
  }

  private startInfusion(t: MagicTarget): MagicOutcome {
    if (this.infusion) {
      this.advise('An infusion is already drawing essentia');
      return 'refused';
    }
    const r = this.matchInfusion(t.x, t.y, t.z);
    if (!r) {
      this.advise(this.altars.has(k3(t.x, t.y, t.z)) ? 'Nothing comes of these items together' : 'Set the heart item on the altar first');
      return 'refused';
    }
    const gate = this.craftGate(r.id);
    if (gate) {
      this.advise(gate);
      return 'refused';
    }
    this.infusion = { x: t.x, y: t.y, z: t.z, id: r.id, paid: {}, t: 0, waitS: 0, step: 0 };
    this.setActive(t.x, t.y, t.z, true);
    this.toast(`Infusing: needs ${aspectsText(r.cost)}`);
    this.bus.emit('sfx', { name: 'infuse', x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5, pitch: 0.7 });
    return 'worked';
  }

  /** Progress 0..1 of the infusion at x, y, z, or null. */
  infusionAt(x: number, y: number, z: number): { id: string; progress: number; missing: Aspects } | null {
    const f = this.infusion;
    if (!f || f.x !== x || f.y !== y || f.z !== z) return null;
    const r = INFUSIONS.find((i) => i.id === f.id) as InfusionRecipe;
    const total = Object.values(r.cost).reduce((s, n) => s + (n ?? 0), 0);
    const paid = Object.values(f.paid).reduce((s, n) => s + (n ?? 0), 0);
    return { id: f.id, progress: Math.min(1, Math.min(paid / total, f.t / r.seconds)), missing: shortfall(r.cost, f.paid) };
  }

  private tickInfusion(dt: number): void {
    const f = this.infusion;
    if (!f) return;
    const r = INFUSIONS.find((i) => i.id === f.id);
    if (!r || this.matchInfusion(f.x, f.y, f.z)?.id !== f.id) {
      this.infusion = null;
      this.setActive(f.x, f.y, f.z, false);
      this.advise('The infusion broke off: an item was taken away');
      return;
    }
    f.t += dt;
    f.step += dt;
    const missing = shortfall(r.cost, f.paid);
    if (f.step >= INFUSE_STEP_S && Object.keys(missing).length) {
      f.step = 0;
      let got = false;
      for (const a of Object.keys(missing) as Aspect[]) {
        if (this.take(f.x, f.y, f.z, ALTAR_REACH + 1, a, 1, false) > 0) {
          f.paid[a] = (f.paid[a] ?? 0) + 1;
          got = true;
          break;
        }
      }
      f.waitS = got ? 0 : f.waitS + INFUSE_STEP_S;
      if (f.waitS >= 6 && f.waitS - INFUSE_STEP_S < 6) this.advise(`The altar needs ${aspectsText(missing)}: fill a jar near it`);
    }
    if (Object.keys(shortfall(r.cost, f.paid)).length || f.t < r.seconds) return;
    // Done: the heart becomes the result, the pedestals are emptied.
    for (const [k] of this.pedestalsOf(f.x, f.y, f.z)) this.pedestals.delete(k);
    this.altars.set(k3(f.x, f.y, f.z), r.output.item);
    this.infusion = null;
    this.setActive(f.x, f.y, f.z, false);
    this.stats.infusions++;
    this.bus.emit('sfx', { name: 'infuse', x: f.x + 0.5, y: f.y + 1, z: f.z + 0.5, pitch: 1.3 });
    this.bus.emit('item:made', { item: r.output.item, count: 1, station: 'infusion_altar', recipeId: r.id });
    this.toast(`Infused: ${itemOrNull(r.output.item)?.name ?? r.output.item} - take it from the altar`, r.output.item, 'good');
  }

  private setActive(x: number, y: number, z: number, on: boolean): void {
    const v = this.world.getVoxel(x, y, z);
    if (voxelActive(v) !== on) this.world.setVoxel(x, y, z, withActive(v, on), 'sim');
  }

  /** Items resting on pedestals and altars, for the renderer. */
  displays(): { item: string; x: number; y: number; z: number }[] {
    const out: { item: string; x: number; y: number; z: number }[] = [];
    for (const [k, item] of this.pedestals) {
      const [x, y, z] = parse3(k);
      out.push({ item, x: x + 0.5, y: y + 1.25, z: z + 0.5 });
    }
    for (const [k, item] of this.altars) {
      const [x, y, z] = parse3(k);
      out.push({ item, x: x + 0.5, y: y + 1.35, z: z + 0.5 });
    }
    return out;
  }

  altarText(x: number, y: number, z: number): string | null {
    const k = k3(x, y, z);
    const key = this.world.getBlock(x, y, z).key;
    if (key === 'arcane_pedestal') return `Arcane Pedestal - ${this.pedestals.has(k) ? itemOrNull(this.pedestals.get(k) as string)?.name : 'empty'}`;
    if (key !== 'infusion_altar') return null;
    const f = this.infusionAt(x, y, z);
    if (f) {
      const left = aspectsText(f.missing);
      return `Infusing ${Math.round(f.progress * 100)}%${left ? ` - needs ${left}` : ''}`;
    }
    const on = this.altars.get(k);
    const r = this.matchInfusion(x, y, z);
    if (r) return `Infusion Altar - ready: ${itemOrNull(r.output.item)?.name} (Use with a rod)`;
    return `Infusion Altar - ${on ? itemOrNull(on)?.name : 'empty'}`;
  }

  // ---- foci ----------------------------------------------------------------------------------------------------------

  private cast(focus: string, cost: number, cooldownS: number, target: MagicTarget | null): MagicOutcome {
    if (this.cooldowns.has(focus)) return 'refused';
    if (!this.bestRod()) {
      this.advise('A focus needs a gathering rod in your pack');
      return 'refused';
    }
    if (this.charge < cost) {
      this.advise(`Not enough charge (${Math.floor(this.charge)}/${cost}): Use the rod without an empty vial to charge it`);
      return 'refused';
    }
    let ok = false;
    if (focus === 'focus_kindle') ok = this.kindle(target);
    else if (focus === 'focus_light') ok = this.light(target);
    else if (focus === 'focus_ward') ok = this.ward();
    else if (focus === 'focus_blink') ok = this.blink();
    if (!ok) return 'refused';
    this.charge -= cost;
    this.cooldowns.set(focus, cooldownS);
    this.stats.casts++;
    this.bus.emit('sfx', { name: 'cast' });
    return 'worked';
  }

  private kindle(target: MagicTarget | null): boolean {
    if (!target || blockOrNull(target.block.key)?.machine !== 'furnace' || !this.hooks.lightFurnace) {
      this.advise('Aim the Kindling Focus at a furnace with fuel in it');
      return false;
    }
    const why = this.hooks.lightFurnace(target.x, target.y, target.z);
    if (why) {
      this.advise(why);
      return false;
    }
    this.toast('The furnace catches', undefined, 'good');
    return true;
  }

  private light(target: MagicTarget | null): boolean {
    if (!target || target.face === undefined) {
      this.advise('Aim the Light Focus at a block');
      return false;
    }
    const [dx, dy, dz] = FACE_DIRS[target.face];
    const x = target.x + dx;
    const y = target.y + dy;
    const z = target.z + dz;
    if (this.world.getBlock(x, y, z).key !== 'air') {
      this.advise('There is no room for a light there');
      return false;
    }
    return this.world.setVoxel(x, y, z, makeVoxel(blockId('magic_light')), 'player');
  }

  private ward(): boolean {
    this.wardS = WARD_S;
    this.player.damageScale = WARD_SCALE;
    this.toast(`Warded for ${WARD_S} s: blows are halved`, undefined, 'good');
    return true;
  }

  private blink(): boolean {
    const p = this.player;
    const dx = -Math.sin(p.yaw) * Math.cos(p.pitch);
    const dy = Math.sin(p.pitch);
    const dz = -Math.cos(p.yaw) * Math.cos(p.pitch);
    const free = (x: number, y: number, z: number): boolean =>
      !this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)).solid && !this.world.getBlock(Math.floor(x), Math.floor(y) + 1, Math.floor(z)).solid;
    let best: [number, number, number] | null = null;
    for (let d = 1; d <= BLINK_RANGE; d += 0.5) {
      const x = p.position.x + dx * d;
      const y = p.position.y + 0.1 + dy * d;
      const z = p.position.z + dz * d;
      if (!free(x, y, z)) break;
      best = [x, y, z];
    }
    if (!best || Math.hypot(best[0] - p.position.x, best[2] - p.position.z) < 1.5) {
      this.advise('No room to blink that way');
      return false;
    }
    p.position.x = best[0];
    p.position.y = best[1];
    p.position.z = best[2];
    p.velocity.x = p.velocity.y = p.velocity.z = 0;
    return true;
  }

  // ---- clay servants -------------------------------------------------------------------------------------------------

  private tickServants(dt: number): void {
    for (const [k, fed] of this.servants) {
      const [x, y, z] = parse3(k);
      if (!this.world.isLoaded(x, z)) continue;
      if (this.world.getBlock(x, y, z).key !== 'clay_servant') {
        this.servants.delete(k);
        continue;
      }
      const cranks = DIRS.map(([dx, dy, dz]) => [x + dx, y + dy, z + dz] as [number, number, number]).filter((c) => this.blockAt(...c) === 'hand_crank');
      let left = fed;
      if (cranks.length && left <= 0 && this.take(x, y, z, 1, 'spring', 1, false) > 0) left = SERVANT_FEED_S;
      const working = cranks.length > 0 && left > 0;
      if (working) {
        left -= dt;
        for (const c of cranks) this.hooks.crank?.(...c);
      }
      this.servants.set(k, Math.max(0, left));
      this.setActive(x, y, z, working);
    }
  }

  servantText(x: number, y: number, z: number): string | null {
    const fed = this.servants.get(k3(x, y, z));
    if (fed === undefined) return null;
    return fed > 0 ? `Clay Servant - cranking, fed for ${Math.ceil(fed)} s` : 'Clay Servant - idle (needs a hand crank and a jar of Spring it touches or tubes to)';
  }

  // ---- notebook -------------------------------------------------------------------------------------------------------

  goals(): MagicGoal[] {
    const done = (k: string): boolean => this.research.entries[k]?.done === true;
    const researched = RESEARCH.filter((e) => done(e.key) && e.board).length;
    const jarFull = [...this.jars.values()].some((j) => j.n > 0);
    return [
      { id: 'scan_ten', title: `Note ten things (${Math.min(10, this.research.scanned.length)}/10)`, done: this.research.scanned.length >= 10 },
      { id: 'first_research', title: 'Finish a research board', done: researched >= 1 },
      { id: 'fill_jar', title: 'Pour essentia into a jar', done: jarFull },
      { id: 'arcane_craft', title: 'Make something at the Rune Desk', done: this.stats.crafted > 0 },
      { id: 'infuse', title: 'Infuse something on the altar', done: this.stats.infusions > 0 },
      { id: 'cast', title: 'Cast a focus', done: this.stats.casts > 0 },
      { id: 'servant', title: 'Set a clay servant to work', done: [...this.servants.values()].some((f) => f > 0) },
      { id: 'all_research', title: `Finish every research (${researched}/${RESEARCH.filter((e) => e.board).length})`, done: RESEARCH.every((e) => done(e.key)) },
    ];
  }

  notebook(): NotebookApi {
    return {
      research: () => this.research,
      entries: () => RESEARCH.map((e) => ({ key: e.key, title: e.title, text: e.text, status: entryStatus(this.research, e), board: e.board, age: e.age })),
      place: (entry, cell, aspect) => {
        const r = placeToken(this.research, entry, cell, aspect);
        if (r.solved) {
          const e = RESEARCH.find((x) => x.key === entry);
          this.toast(`Research done: ${e?.title ?? entry}`, undefined, 'good');
          this.bus.emit('sfx', { name: 'research_solve' });
        }
        return r;
      },
      remove: (entry, cell) => removeToken(this.research, entry, cell),
      hint: (entry) => hintFor(this.research, entry),
      scanItem: (key) => this.scanBlock(key),
      canStudy: () => hasFlag(this.research, 'vial_study'),
      study: (vial) => {
        const a = vialAspect(vial);
        if (!a || !hasFlag(this.research, 'vial_study')) return 'Research "Distilled Lore" first';
        if (!this.player.inventory.has(vial)) return 'You carry none';
        this.player.inventory.remove(vial, 1);
        this.player.give(EMPTY_VIAL, 1);
        this.research.lore[a] = (this.research.lore[a] ?? 0) + STUDY_LORE;
        if (!this.research.known.includes(a)) this.research.known.push(a);
        this.stats.studied++;
        return `Studied a Vial of ${aspectInfo(a).name}: +${STUDY_LORE} lore`;
      },
      goals: () => this.goals(),
      charge: () => ({ charge: Math.floor(this.charge), capacity: this.bestRod()?.capacity ?? 0 }),
    };
  }

  // ---- save ----------------------------------------------------------------------------------------------------------

  toJSON(): MagicSnapshot {
    const jars: MagicSnapshot['jars'] = [];
    for (const [k, j] of this.jars) {
      if (!j.aspect || j.n <= 0) continue;
      jars.push([...parse3(k), j.aspect, j.n]);
    }
    const draws: MagicSnapshot['draws'] = {};
    for (const [k, m] of this.draws) {
      const row: Record<string, [number, number]> = {};
      for (const [a, d] of m) {
        const left = Math.max(0, d.n - (this.clock - d.t) / DRAW_RECOVER_S);
        if (left > 0.01) row[a] = [Math.round(left * 100) / 100, 0];
      }
      if (Object.keys(row).length) draws[k] = row;
    }
    const nodes: Record<string, number> = {};
    for (const [k] of this.nodeDraws) {
      const used = NODE_POOL - this.nodeLeft(k);
      if (used > 0.01) nodes[k] = Math.round(used * 100) / 100;
    }
    const f = this.infusion;
    return {
      v: 1, research: this.research, jars, draws,
      charge: this.charge,
      pedestals: [...this.pedestals].map(([k, i]) => [...parse3(k), i]),
      altars: [...this.altars].map(([k, i]) => [...parse3(k), i]),
      infusion: f ? { x: f.x, y: f.y, z: f.z, id: f.id, paid: { ...f.paid }, t: f.t } : null,
      servants: [...this.servants].map(([k, s]) => [...parse3(k), s]),
      nodes,
      stats: { ...this.stats },
    };
  }

  /** Restores a snapshot; anything damaged is dropped, never thrown. Timers restart at the load clock. */
  load(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const s = raw as Partial<MagicSnapshot>;
    const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
    const cell = (r: unknown[]): boolean => num(r[0]) && num(r[1]) && num(r[2]);
    this.research = sanitizeResearch(s.research);
    this.jars.clear();
    for (const j of Array.isArray(s.jars) ? s.jars : []) {
      if (!Array.isArray(j) || j.length !== 5 || !cell(j)) continue;
      const [x, y, z, a, n] = j;
      if (typeof a !== 'string' || !isAspect(a) || !num(n)) continue;
      this.jars.set(k3(x, y, z), { aspect: a, n: Math.max(0, Math.min(VOID_JAR_UNITS, Math.floor(n))) });
    }
    this.draws.clear();
    if (s.draws && typeof s.draws === 'object')
      for (const [k, row] of Object.entries(s.draws)) {
        const m = new Map<Aspect, Draw>();
        for (const [a, v] of Object.entries(row ?? {})) if (isAspect(a) && Array.isArray(v) && num(v[0])) m.set(a, { n: v[0], t: this.clock });
        if (m.size) this.draws.set(k, m);
      }
    this.charge = num(s.charge) ? Math.max(0, Math.min(64, s.charge)) : 0;
    const items = (rows: unknown, into: Map<string, string>): void => {
      into.clear();
      for (const r of Array.isArray(rows) ? rows : []) {
        if (Array.isArray(r) && r.length === 4 && cell(r) && typeof r[3] === 'string' && itemOrNull(r[3])) into.set(k3(r[0], r[1], r[2]), r[3]);
      }
    };
    items(s.pedestals, this.pedestals);
    items(s.altars, this.altars);
    this.servants.clear();
    for (const r of Array.isArray(s.servants) ? s.servants : []) {
      if (Array.isArray(r) && r.length === 4 && cell(r) && num(r[3])) this.servants.set(k3(r[0], r[1], r[2]), Math.max(0, r[3]));
    }
    this.nodeDraws.clear();
    if (s.nodes && typeof s.nodes === 'object') for (const [k, n] of Object.entries(s.nodes)) if (num(n)) this.nodeDraws.set(k, { n, t: this.clock });
    const f = s.infusion;
    this.infusion = f && num(f.x) && num(f.y) && num(f.z) && typeof f.id === 'string' && INFUSIONS.some((i) => i.id === f.id)
      ? { x: f.x, y: f.y, z: f.z, id: f.id, paid: sanitizeAspects(f.paid), t: num(f.t) ? f.t : 0, waitS: 0, step: 0 }
      : null;
    if (s.stats && typeof s.stats === 'object')
      for (const k of ['infusions', 'casts', 'studied', 'crafted'] as const) if (num(s.stats[k])) this.stats[k] = Math.max(0, Math.floor(s.stats[k]));
  }
}

function sanitizeAspects(raw: unknown): Aspects {
  const out: Aspects = {};
  if (raw && typeof raw === 'object') for (const [a, n] of Object.entries(raw)) if (isAspect(a) && typeof n === 'number' && n > 0) out[a] = Math.floor(n);
  return out;
}

export const chunkKey = (x: number, z: number): string => `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
