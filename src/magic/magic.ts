/**
 * Essentia & Research at runtime (docs/api/magic.md). One object per world, owned by Game: the player's research, the
 * rod's vis, crucibles, jars, pedestals and altars, the infusion in progress, clay servants, how much the land and the wellsprings
 * have been drawn, and the warding buff. Everything in-world goes through `use(target)`, called by the player's Use before
 * any placing or screen; the notebook and rune desk screens talk to it through NotebookApi / DeskApi.
 *
 * - Notebook: Use on a block = scan it; Use at the sky = open the notebook. A carried Scrying Lens gives 1.5x lore.
 * - Rods (RODS): each Use draws `draw` units - from a wellspring within NODE_REACH (research 'wellsprings', twice as
 *   fast) or else from the richest drawable aspect of the blocks around (primals always, compounds after
 *   'compound_draw', a late aspect only with that aspect's flag). What it draws is VIS (src/magic/vis.ts): one pool per
 *   primal, each up to the best carried rod's capacity; a compound splits into its primals.
 * - Crucible (src/magic/crucible.ts): water over a burning furnace or lava. Items Used on it dissolve into essentia; an
 *   empty vial bottles VIAL_UNITS of the richest aspect; a catalyst with its ALCHEMY essentia present turns into the output.
 * - Jars (essentia_jar, void_jar): a filled vial pours in, an empty vial fills back. Tubes join jars to consumers.
 * - Rune desk: Use opens the 'rune_desk' screen; arcane recipes pay ingredients and VIS from the rod (their aspect cost
 *   broken into primals). Infusion: items on the altar and on pedestals within ALTAR_REACH; Use the altar with a rod; it
 *   draws essentia from jars. Pedestals without a twin mirrored across the altar make it unstable: mishaps spill essentia
 *   or throw an item off (`instabilityAt`).
 * - Foci (FOCI): spend primal vis. A clay servant fed one Spring walks up to SERVANT_RANGE blocks and does one task.
 * - Furnace: a Vial of Cinder adds CINDER_BURN_S of fire (research 'warm_hearth'); with 'hearth_siphon' a Cinder jar
 *   touching (or tubed to) a burning furnace tops it up. Still: a Vial of Clarity on a flask takes water out ('still_trace').
 */
import type { GameBus } from '../core/context';
import { blockOrNull, blockId, itemOrNull } from '../core/registry';
import { FACE_DIRS, FACING_TO_FACE, type Facing, makeVoxel, voxelActive, voxelFacing, withActive, type BlockDef, type Face, type IWorld } from '../core/types';
import { FOCI, JAR_UNITS, ROD_TIERS, VIAL_UNITS, VOID_JAR_UNITS, vialKey, type RodTier } from '../content/itemsMagic';
import { ALCHEMY, ARCANE_RECIPES, INFUSIONS, alchemyFor, type ArcaneRecipe, type InfusionRecipe } from '../content/recipesMagic';
import type { PlayerState } from '../game/playerState';
import { ASPECT_LIST, LATE, PRIMALS, aspectInfo, aspectsText, isAspect, type Aspect, type Aspects } from './aspects';
import type { BoardSpec } from './board';
import { bottle, canPay, crucibleTotal, dissolve, freshCrucible, take as takeEssence, type CrucibleState } from './crucible';
import { RESEARCH } from './entries';
import { JAR_BLOCKS, jarsFor, shortfall, TUBE } from './essentiaNet';
import { aspectsOf } from './fingerprint';
import { craftGateReason } from './gates';
import { compass, NODE_HEIGHT, NODE_POOL, NODE_REACH, NODE_REGEN_S, nodesNear, type NodeSite } from './nodes';
import {
  beginResearch, beginShortfall, combineAspects, entryStatus, freshResearch, hasFlag, hintFor, placeToken, removeToken,
  sanitizeResearch, scanObject,
  type EntryStatus, type PlaceResult, type ResearchState,
} from './research';
import { emptyVis, isPrimal, primalsOf, visShort, visText, type Primal, type Vis } from './vis';

export const NOTEBOOK = 'field_notebook';
export const EMPTY_VIAL = 'glass_vial';
export const JAR_BLOCK = 'essentia_jar';
export const LENS = 'vein_lens';
export const SCRIBING_TOOLS = 'scribing_tools';
export const RESEARCH_TABLE = 'research_table';
export const CRUCIBLE = 'crucible';
export const ARCANE_BENCH = 'arcane_workbench';
export const SANITY_SOAP = 'sanity_soap';
/** Warp (docs/api/magic.md): unseen strain from strong magic. Soap lifts SOAP_WARP of it. */
export const SOAP_WARP = 3;
/** Seconds between two rolls for a warp effect. */
export const WARP_ROLL_S = 45;
export const WARP_WHISPERS = [
  'You hear your own name, very softly, from behind you',
  'The shadows at the edge of sight lean closer for a moment',
  'Something taps twice inside the wall, and stops',
  'For a heartbeat every sound in the world is a little late',
];
/** Water items a crucible takes, and what each leaves in the hand. */
export const WATER_FOR_CRUCIBLE: Record<string, string> = { water_vial: 'glass_vial', water_beaker: 'glass_beaker', water_pail: 'pail' };
/** Infusion mishap chance per second for each point of instability. */
export const MISHAP_PER_S = 0.02;
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
/** Seconds of work one unit of Spring buys a clay servant, and how far (Chebyshev) it may walk from where it was placed. */
export const SERVANT_FEED_S = 30;
export const SERVANT_RANGE = 8;

/** The workshop calls a clay servant may make (Game.bindWorkshop). Structural: this file does not import the workshop. */
export interface ServantWorkshop {
  offer(x: number, y: number, z: number, item: string, count: number): number;
  act(action: { item: string; target: [number, number, number]; face: Facing; mode: 'auto' | 'use' | 'strike' | 'place' | 'mine' }): false | 'used' | 'consumed';
}
/** Lore one studied vial gives. */
export const STUDY_LORE = 3;
/** Seconds of held Use a scan takes, and the longest gap between Uses before the bar empties. */
export const SCAN_S = 1.2;
export const SCAN_GAP_S = 0.6;
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
  entries(): {
    key: string; title: string; text: string; status: EntryStatus; board: BoardSpec | null; age: string;
    requires: readonly string[]; cost: Aspects; short: Aspect[];
  }[];
  /** Starts an entry's research notes (pays its cost in lore). */
  begin(entry: string): PlaceResult;
  /** Combines one lore of each into their compound. */
  combine(a: Aspect, b: Aspect): PlaceResult & { made?: Aspect };
  /** Ink strokes left in carried scribing tools. */
  ink(): number;
  /** Writes an aspect (at a research table; spends one lore and one stroke of ink). */
  place(entry: string, cell: number, aspect: Aspect): PlaceResult;
  remove(entry: string, cell: number): boolean;
  hint(entry: string): { cell: number; aspect: Aspect } | null;
  /** Scans an item the player carries (by key). */
  scanItem(key: string): string;
  /** Studies one carried vial (research 'distilled_lore'); returns what happened. */
  study(vial: string): string;
  canStudy(): boolean;
  goals(): MagicGoal[];
  /** Rod vis per primal and the best carried rod's capacity per pool. */
  vis(): { vis: Vis; capacity: number };
  /** A vague sentence about your warp, or null when you carry none. */
  unease(): string | null;
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

/** One task a fed servant has chosen. `belt` names the loose item and its ground id. */
interface ServantJob {
  kind: 'crank' | 'deployer' | 'belt';
  x: number;
  y: number;
  z: number;
  item: string;
  groundId: number;
}

interface ServantFlood { dist: Map<string, number>; parent: Map<string, string> }

interface ServantState {
  fed: number;
  /** The block where the servant was placed. It never walks farther than SERVANT_RANGE from here. */
  hx: number;
  hy: number;
  hz: number;
  /** The feed's single task is finished. */
  done: boolean;
  job: ServantJob | null;
}

const freshServant = (x: number, y: number, z: number, fed = 0): ServantState => ({ fed, hx: x, hy: y, hz: z, done: false, job: null });

interface Jar { aspect: Aspect | null; n: number }
interface Draw { n: number; t: number }
interface Infusion { x: number; y: number; z: number; id: string; paid: Aspects; t: number; waitS: number; step: number }

export interface MagicSnapshot {
  v: 1;
  research: ResearchState;
  jars: [number, number, number, string, number][];
  draws: Record<string, Record<string, [number, number]>>;
  /** Legacy single rod charge (v1 saves); dropped on load. */
  charge?: number;
  vis?: Partial<Vis>;
  warp?: number;
  crucibles?: [number, number, number, number, Aspects][];
  pedestals?: [number, number, number, string][];
  altars?: [number, number, number, string][];
  infusion?: { x: number; y: number; z: number; id: string; paid: Aspects; t: number } | null;
  /** x,y,z,fed, and when the servant has walked or finished its task: home x,y,z and 1 if that task is done. */
  servants?: number[][];
  nodes?: Record<string, number>;
  stats?: { infusions: number; casts: number; studied: number; crafted: number };
  plugged?: Record<string, string>;
}

export class Magic {
  research: ResearchState = freshResearch();
  /** Rod vis, one pool per primal, each capped by the best rod carried. */
  vis: Vis = emptyVis();
  /** Warp: grows with strong infusions, mishaps and deep research; whispers and hunger at high levels. */
  warp = 0;
  private warpT = 0;
  /** Rolls for infusion mishaps (tests replace it). */
  rng: () => number = Math.random;
  wardS = 0;
  readonly stats = { infusions: 0, casts: 0, studied: 0, crafted: 0 };
  private readonly jars = new Map<string, Jar>();
  private readonly draws = new Map<string, Map<Aspect, Draw>>();
  private readonly nodeDraws = new Map<string, Draw>();
  private readonly pedestals = new Map<string, string>();
  private readonly altars = new Map<string, string>();
  private readonly crucibles = new Map<string, CrucibleState>();
  private readonly servants = new Map<string, ServantState>();
  /** wand item -> focus plugged into it. */
  private readonly plugged = new Map<string, string>();
  /** Set while a servant block is moved, so the block events do not reset its feed. */
  private relocating = false;
  private workshop: ServantWorkshop | null = null;
  private infusion: Infusion | null = null;
  private readonly cooldowns = new Map<string, number>();
  private clock = 0;
  private scanning: { key: string; p: number; seen: number } | null = null;
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

  /** Hands a clay servant `workshop.offer` / `workshop.act`. Game calls this once the workshop exists. */
  bindWorkshop(workshop: ServantWorkshop | null): void {
    this.workshop = workshop;
  }

  dispose(): void {
    this.off();
    this.player.damageScale = 1;
  }

  private blockChanged(x: number, y: number, z: number): void {
    const k = k3(x, y, z);
    const key = this.world.getBlock(x, y, z).key;
    if (this.jars.has(k) && !JAR_BLOCKS.has(key)) this.jars.delete(k);
    if (this.crucibles.has(k) && key !== CRUCIBLE) this.crucibles.delete(k);
    if (this.pedestals.has(k) && key !== 'arcane_pedestal') this.dropAt(x, y, z, this.pedestals.get(k) as string, () => this.pedestals.delete(k));
    if (this.altars.has(k) && key !== 'infusion_altar') this.dropAt(x, y, z, this.altars.get(k) as string, () => this.altars.delete(k));
    if (this.infusion && k3(this.infusion.x, this.infusion.y, this.infusion.z) === k && key !== 'infusion_altar') this.infusion = null;
    if (this.relocating) return;
    if (key === 'clay_servant') {
      if (!this.servants.has(k)) this.servants.set(k, freshServant(x, y, z));
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
    for (const r of ROD_TIERS) {
      if (!this.player.inventory.has(r.key)) continue;
      if (!best || r.capacity > best.capacity || (r.capacity === best.capacity && (r.draw > best.draw || (r.draw === best.draw && (r.favour ? 1 : 0) > (best.favour ? 1 : 0))))) best = r;
    }
    return best;
  }

  private heldRod(): RodTier | null {
    const held = this.player.heldStack()?.item;
    return ROD_TIERS.find((r) => r.key === held) ?? null;
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
    for (const p of Object.keys(this.vis) as Primal[]) if (this.vis[p] > cap) this.vis[p] = cap;
    this.tickInfusion(dt);
    this.tickWarp(dt);
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
      return this.scanHold(target.block.key);
    }
    const key = target?.block.key;
    if (held === SANITY_SOAP) return this.useSoap();
    const rod = this.heldRod();
    if (rod) {
      if (target && key === 'infusion_altar') return this.startInfusion(target);
      if (target && key === ARCANE_BENCH) return this.plugFocus(rod);
      const plug = FOCI.find((f) => f.key === this.plugged.get(rod.key));
      if (plug && !this.cooldowns.has(plug.key) && !Object.keys(visShort(this.focusCost(plug.vis, rod), this.vis)).length) return this.cast(plug.key, plug.vis, plug.cooldownS, target);
      return this.gather(rod);
    }
    const focus = FOCI.find((f) => f.key === held);
    if (focus) return this.cast(focus.key, focus.vis, focus.cooldownS, target);
    if (!target) return null;
    if (key && JAR_BLOCKS.has(key) && (held === EMPTY_VIAL || vialAspect(held))) return this.useJar(target, held as string);
    if (key === 'arcane_pedestal') return this.usePedestal(target, held);
    if (key === 'infusion_altar') return this.useAltar(target, held);
    if (key === CRUCIBLE) return this.useCrucible(target, held);
    if (key === ARCANE_BENCH) {
      this.bus.emit('ui:open', { screen: { type: 'rune_desk', x: target.x, y: target.y, z: target.z, bench: true } });
      return 'screen';
    }
    if (key === RESEARCH_TABLE) {
      this.bus.emit('ui:open', { screen: { type: 'notebook', table: true } });
      return 'screen';
    }
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

  /**
   * Active scanning: Use held on a thing fills a bar (`SCAN_S`, a third quicker with the lens carried) and only then gives
   * its lore. Letting go for more than `SCAN_GAP_S` starts over; a thing already in the notes reads out at once.
   */
  private scanHold(key: string): MagicOutcome {
    if (this.research.scanned.includes(key)) {
      this.scanning = null;
      this.scanBlock(key);
      return 'worked';
    }
    let s = this.scanning;
    if (s && s.key === key && this.clock - s.seen <= SCAN_GAP_S) {
      s.p += this.clock - s.seen;
      s.seen = this.clock;
    } else s = this.scanning = { key, p: 0, seen: this.clock };
    const need = this.player.inventory.has(LENS) ? SCAN_S / LENS_LORE : SCAN_S;
    if (s.p < need) return 'worked';
    this.scanning = null;
    this.scanBlock(key);
    return 'worked';
  }

  /** "Scanning Copper Ore [####....] 50%" while a scan is filling, else null. */
  scanLabel(): string | null {
    const s = this.scanning;
    if (!s || this.clock - s.seen > SCAN_GAP_S) return null;
    const need = this.player.inventory.has(LENS) ? SCAN_S / LENS_LORE : SCAN_S;
    const f = Math.max(0, Math.min(1, s.p / need));
    const bars = Math.round(f * 8);
    const name = blockOrNull(s.key)?.name ?? s.key;
    return `Scanning ${name} [${'#'.repeat(bars)}${'.'.repeat(8 - bars)}] ${Math.round(f * 100)}%`;
  }

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
    if ((LATE as readonly string[]).includes(a)) return hasFlag(this.research, a);
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
      .map((n) => ({ ...n, y: this.groundY(n.x, n.z) + NODE_HEIGHT, left: this.nodeLeft(n.key) }));
  }

  /** The ground under a column: below leaves, logs, plants and anything not solid (trees do not lift a wellspring). */
  groundY(x: number, z: number): number {
    let y = this.world.surfaceY(x, z);
    for (let i = 0; i < 40 && y > 0; i++, y--) {
      const b = this.world.getBlock(x, y, z);
      if (b.solid && !/(leaves|log)$/.test(b.key)) break;
    }
    return y + 1;
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
    let text = land.length ? land.join(', ') : 'Land drained';
    const nodes = this.nodesAround(p.x, p.z, 3);
    if (nodes.length) {
      const n = nodes.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      const d = Math.round(Math.hypot(n.x + 0.5 - p.x, n.z + 0.5 - p.z));
      text += ` · ${aspectInfo(n.aspect).name} well ${d < 3 ? 'here' : `${d} ${compass(p.x, p.z, n.x + 0.5, n.z + 0.5)}`} (${Math.floor(n.left)})`;
    }
    return text;
  }

  /** Primal pools an aspect fills (itself, or a compound's parts). */
  private partsOf(a: Aspect): Primal[] {
    return Object.keys(primalsOf({ [a]: 1 })) as Primal[];
  }

  private gather(rod: RodTier): MagicOutcome {
    if (this.clock - this.lastDraw < ROD_INTERVAL_S && this.lastDraw >= 0) return 'worked';
    const p = this.player;
    const roomFor = (a: Aspect): boolean => this.partsOf(a).some((x) => this.vis[x] < rod.capacity);
    const node = this.nearNode();
    let aspect: Aspect;
    let units = rod.draw;
    const px = Math.floor(p.position.x);
    const pz = Math.floor(p.position.z);
    if (node && roomFor(node.aspect)) {
      aspect = node.aspect;
      units = Math.min(rod.draw * 2, Math.floor(node.left));
      this.takeNode(node.key, units);
    } else {
      const land = [...this.landAspects(px, Math.floor(p.position.y + 0.5), pz)]
        .filter(([a]) => this.drawable(a) && roomFor(a))
        .map(([a]) => [a, this.leftOf(a)] as [Aspect, number])
        .filter(([, n]) => n >= 1)
        .sort((x, y) => y[1] - x[1]);
      if (!land.length) {
        const full = (Object.keys(this.vis) as Primal[]).every((x) => this.vis[x] >= rod.capacity);
        this.advise(full ? `The rod is full (${rod.capacity} vis of each primal)` : 'The land here is drained of what the rod can still hold. Move on, or wait for it to recover');
        return 'refused';
      }
      aspect = land[0][0];
      units = Math.min(units, Math.floor(land[0][1]));
      for (let i = 0; i < units; i++) this.markDrawn(px, pz, aspect);
    }
    this.lastDraw = this.clock;
    if (units <= 0) return 'refused';
    for (const x of this.partsOf(aspect)) this.vis[x] = Math.min(rod.capacity, this.vis[x] + (rod.favour?.includes(x) ? Math.ceil(units * 1.5) : units));
    this.bus.emit('sfx', { name: 'rod_hum', pitch: 0.8 + Math.min(1, this.visTotal() / (rod.capacity * 6)) });
    return 'worked';
  }

  visTotal(): number {
    return (Object.values(this.vis) as number[]).reduce((t, n) => t + n, 0);
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

  desk(x: number, y: number, z: number, bench = false): DeskApi {
    return {
      rows: () => ARCANE_RECIPES.filter((r) => (r.bench === true) === bench).map((r) => this.deskRow(r, x, y, z)),
      make: (id) => this.deskMake(id, x, y, z),
    };
  }

  private deskRow(r: ArcaneRecipe, _x: number, _y: number, _z: number): DeskRow {
    const inputs = r.inputs.map((i) => ({ item: i.item, count: i.count, have: this.player.inventory.count(i.item) }));
    const vis = primalsOf(r.cost);
    const cost = (Object.entries(vis) as [Primal, number][]).map(([aspect, n]) => ({ aspect: aspect as Aspect, n, have: Math.floor(this.vis[aspect]) }));
    let problem = this.craftGate(r.id);
    if (!problem && inputs.some((i) => i.have < i.count)) problem = 'Missing ingredients';
    if (!problem && !this.bestRod()) problem = 'Carry a gathering rod: arcane work is paid in its vis';
    const short = visShort(vis, this.vis);
    if (!problem && Object.keys(short).length) problem = `Not enough vis in your rod: ${visText(short)}`;
    return { id: r.id, output: r.output.item, count: r.output.count, inputs, cost, problem };
  }

  private deskMake(id: string, x: number, y: number, z: number): string {
    const r = ARCANE_RECIPES.find((a) => a.id === id);
    if (!r) return 'No such recipe';
    const row = this.deskRow(r, x, y, z);
    if (row.problem) return row.problem;
    for (const i of r.inputs) this.player.inventory.remove(i.item, i.count);
    for (const [a, n] of Object.entries(primalsOf(r.cost)) as [Primal, number][]) this.vis[a] -= n;
    this.player.give(r.output.item, r.output.count);
    this.stats.crafted++;
    this.bus.emit('item:made', { item: r.output.item, count: r.output.count, station: r.bench ? ARCANE_BENCH : 'rune_desk', recipeId: r.id });
    this.bus.emit('sfx', { name: 'infuse', x: x + 0.5, y: y + 1, z: z + 0.5 });
    const name = itemOrNull(r.output.item)?.name ?? r.output.item;
    this.toast(`Made ${name}`, r.output.item, 'good');
    return `Made ${name}`;
  }

  // ---- crucible -----------------------------------------------------------------------------------------------------

  crucibleAt(x: number, y: number, z: number): CrucibleState | null {
    if (this.world.getBlock(x, y, z).key !== CRUCIBLE) return null;
    return this.crucibles.get(k3(x, y, z)) ?? freshCrucible();
  }

  /** Whether something under the crucible boils it: a burning furnace or lava. */
  crucibleHot(x: number, y: number, z: number): boolean {
    const below = this.world.getBlock(x, y - 1, z).key;
    if (below === 'lava') return true;
    return (this.hooks.furnaceFire?.(x, y - 1, z) ?? 0) > 0;
  }

  crucibleText(x: number, y: number, z: number): string | null {
    const c = this.crucibleAt(x, y, z);
    if (!c) return null;
    if (!c.water) return 'Crucible - empty: pour in water';
    const hot = this.crucibleHot(x, y, z);
    const what = aspectsText(c.ess);
    return `Crucible - ${hot ? 'boiling' : 'cold: light a fire under it'}${what ? ` - ${what}` : ''} (${crucibleTotal(c)}/64)`;
  }

  private useCrucible(t: MagicTarget, held: string | null): MagicOutcome {
    const k = k3(t.x, t.y, t.z);
    const c = this.crucibles.get(k) ?? freshCrucible();
    const gate = this.craftGate(CRUCIBLE);
    if (gate) {
      this.advise(gate);
      return 'refused';
    }
    if (held && WATER_FOR_CRUCIBLE[held]) {
      if (c.water) {
        this.advise('The crucible is already full of water');
        return 'refused';
      }
      this.player.consumeHeld(1);
      this.player.give(WATER_FOR_CRUCIBLE[held], 1);
      c.water = true;
      this.crucibles.set(k, c);
      this.bus.emit('sfx', { name: 'essentia_pour', x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5 });
      return 'worked';
    }
    if (!held) {
      this.advise(this.crucibleText(t.x, t.y, t.z) ?? '');
      return 'refused';
    }
    if (!c.water) {
      this.advise('Pour water in first: Use a vial, beaker or bucket of water on it');
      return 'refused';
    }
    if (held === EMPTY_VIAL) {
      const a = bottle(c, VIAL_UNITS);
      if (!a) {
        this.advise(`No aspect in the crucible has ${VIAL_UNITS} units to bottle yet`);
        return 'refused';
      }
      this.player.consumeHeld(1);
      this.player.give(vialKey(a), 1);
      this.toast(`Bottled a Vial of ${aspectInfo(a).name}`, vialKey(a));
      return 'worked';
    }
    if (!this.crucibleHot(t.x, t.y, t.z)) {
      this.advise('The water is cold: the crucible needs a burning furnace or lava under it');
      return 'refused';
    }
    const recipe = alchemyFor(held).find((r) => !this.craftGate(r.id) && canPay(c, r.cost));
    if (recipe) {
      takeEssence(c, recipe.cost);
      this.player.consumeHeld(1);
      this.player.give(recipe.output.item, recipe.output.count);
      this.stats.crafted++;
      this.bus.emit('item:made', { item: recipe.output.item, count: recipe.output.count, station: 'crucible', recipeId: recipe.id });
      this.bus.emit('sfx', { name: 'infuse', x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5, pitch: 1.2 });
      this.toast(`The crucible gives ${recipe.output.count} ${itemOrNull(recipe.output.item)?.name ?? recipe.output.item}`, recipe.output.item, 'good');
      return 'worked';
    }
    const fp = aspectsOf(held);
    if (!Object.keys(fp).length) {
      this.advise('That has no nature to melt down');
      return 'refused';
    }
    this.player.consumeHeld(1);
    const spilled = dissolve(c, fp);
    this.crucibles.set(k, c);
    this.bus.emit('sfx', { name: 'essentia_pour', x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5, pitch: 0.7 });
    if (spilled > 0) this.toast(`The crucible overflows: ${spilled} essentia boils away as flux`, undefined, 'warn');
    return 'worked';
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

  /**
   * How unstable an infusion at this altar would be: 2 for every loaded pedestal without a loaded twin mirrored across the
   * altar, plus 1 for every pedestal past the second.
   */
  instabilityAt(x: number, y: number, z: number): number {
    const peds = this.pedestalsOf(x, y, z);
    const at = new Set(peds.map(([k]) => {
      const [px, , pz] = parse3(k);
      return `${px},${pz}`;
    }));
    let n = Math.max(0, peds.length - 2);
    for (const [k] of peds) {
      const [px, , pz] = parse3(k);
      if (!at.has(`${2 * x - px},${2 * z - pz}`)) n += 2;
    }
    return n;
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
    const inst = this.instabilityAt(t.x, t.y, t.z);
    this.toast(`Infusing: needs ${aspectsText(r.cost)}${inst ? `. Unstable (${inst}): set pedestals in mirrored pairs` : ''}`, undefined, inst ? 'warn' : 'info');
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
    const inst = this.instabilityAt(f.x, f.y, f.z);
    if (inst > 0 && this.rng() < inst * MISHAP_PER_S * dt) this.mishap(f);
    if (!this.infusion) return;
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
    this.addWarp(r.id === 'clay_servant' || r.id === 'void_jar' ? 2 : 1);
    this.bus.emit('sfx', { name: 'infuse', x: f.x + 0.5, y: f.y + 1, z: f.z + 0.5, pitch: 1.3 });
    this.bus.emit('item:made', { item: r.output.item, count: 1, station: 'infusion_altar', recipeId: r.id });
    this.toast(`Infused: ${itemOrNull(r.output.item)?.name ?? r.output.item} - take it from the altar`, r.output.item, 'good');
  }

  // ---- warp ----------------------------------------------------------------------------------------------------------

  addWarp(n: number): void {
    this.warp = Math.max(0, Math.min(40, this.warp + n));
  }

  /** How the notebook words your warp (it never shows the number). */
  uneaseText(): string | null {
    if (this.warp < 1) return null;
    if (this.warp < 4) return 'A faint unease follows you';
    if (this.warp < 8) return 'Something watches from the corner of your eye';
    if (this.warp < 14) return 'The air hums with attention, and you are not alone in it';
    return 'Your thoughts echo back changed';
  }

  private tickWarp(dt: number): void {
    if (this.warp < 2) return;
    this.warpT += dt;
    if (this.warpT < WARP_ROLL_S) return;
    this.warpT = 0;
    if (this.rng() >= Math.min(0.9, this.warp * 0.08)) return;
    this.bus.emit('sfx', { name: 'cast', pitch: 0.4 });
    if (this.warp >= 6 && this.rng() < 0.5) {
      this.player.food = Math.max(0, (this.player.food ?? 0) - 2);
      this.toast('A cold hollowness takes the warmth from your meal', undefined, 'warn');
      return;
    }
    this.toast(WARP_WHISPERS[Math.floor(this.rng() * WARP_WHISPERS.length) % WARP_WHISPERS.length], undefined, 'warn');
  }

  private useSoap(): MagicOutcome {
    if (this.warp <= 0) {
      this.advise('You feel perfectly clear already');
      return 'refused';
    }
    this.player.consumeHeld(1);
    this.addWarp(-SOAP_WARP);
    this.bus.emit('sfx', { name: 'essentia_pour' });
    this.toast(this.warp > 0 ? 'You scrub at your thoughts; some of the strain lifts' : 'You feel perfectly clear', undefined, 'good');
    return 'worked';
  }

  /** An unstable infusion lashes out: half the time essentia already drawn splashes away, else a pedestal item flies off. */
  private mishap(f: Infusion): void {
    this.addWarp(1);
    const paid = (Object.keys(f.paid) as Aspect[]).filter((a) => (f.paid[a] ?? 0) > 0);
    this.bus.emit('sfx', { name: 'cast', x: f.x + 0.5, y: f.y + 1, z: f.z + 0.5, pitch: 0.5 });
    if (paid.length && this.rng() < 0.5) {
      const a = paid[Math.floor(this.rng() * paid.length)];
      f.paid[a] = (f.paid[a] ?? 0) - 1;
      this.toast(`The infusion wavers: ${aspectInfo(a).name} splashes away`, undefined, 'warn');
      return;
    }
    const peds = this.pedestalsOf(f.x, f.y, f.z);
    if (!peds.length) return;
    const [k, item] = peds[Math.floor(this.rng() * peds.length)];
    const [px, py, pz] = parse3(k);
    this.dropAt(px, py, pz, item, () => this.pedestals.delete(k));
    this.toast(`The infusion lashes out: ${itemOrNull(item)?.name ?? item} is thrown off its pedestal`, undefined, 'warn');
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
      const inst = this.instabilityAt(x, y, z);
      return `Infusing ${Math.round(f.progress * 100)}%${left ? ` - needs ${left}` : ''}${inst ? ` - unstable ${inst}` : ''}`;
    }
    const on = this.altars.get(k);
    const r = this.matchInfusion(x, y, z);
    if (r) {
      const inst = this.instabilityAt(x, y, z);
      return `Infusion Altar - ready: ${itemOrNull(r.output.item)?.name} (Use with a rod)${inst ? ` - unstable ${inst}` : ' - stable'}`;
    }
    return `Infusion Altar - ${on ? itemOrNull(on)?.name : 'empty'}`;
  }

  // ---- foci ----------------------------------------------------------------------------------------------------------

  /** A cap's favoured primals cost a quarter less (at least 1) in foci. */
  focusCost(cost: Partial<Vis>, rod: RodTier | null): Partial<Vis> {
    if (!rod?.favour) return cost;
    const out: Partial<Vis> = {};
    for (const [p, n] of Object.entries(cost) as [Primal, number][]) out[p] = rod.favour.includes(p) ? Math.max(1, Math.floor(n * 0.75)) : n;
    return out;
  }

  /** Use a wand on an Arcane Workbench: plugs the first focus carried (not yet plugged elsewhere), or takes the plugged one back. */
  private plugFocus(rod: RodTier): MagicOutcome {
    const have = this.plugged.get(rod.key);
    if (have) {
      this.plugged.delete(rod.key);
      this.player.give(have, 1);
      this.toast(`${itemOrNull(have)?.name ?? have} comes out of the wand`);
      return 'worked';
    }
    const f = FOCI.find((x) => this.player.inventory.has(x.key));
    if (!f) {
      this.advise('Carry a focus to plug into the wand');
      return 'refused';
    }
    this.player.inventory.remove(f.key, 1);
    this.plugged.set(rod.key, f.key);
    this.toast(`${itemOrNull(f.key)?.name} is plugged into the wand: Use the wand to cast it, or to draw vis when it cannot`, f.key, 'good');
    return 'worked';
  }

  /** The focus plugged into a wand item, or null. */
  pluggedFocus(wand: string): string | null {
    return this.plugged.get(wand) ?? null;
  }

  private cast(focus: string, rawCost: Partial<Vis>, cooldownS: number, target: MagicTarget | null): MagicOutcome {
    if (this.cooldowns.has(focus)) return 'refused';
    if (!this.bestRod()) {
      this.advise('A focus needs a gathering rod in your pack');
      return 'refused';
    }
    const cost = this.focusCost(rawCost, this.heldRod() ?? this.bestRod());
    const short = visShort(cost, this.vis);
    if (Object.keys(short).length) {
      this.advise(`Not enough vis: needs ${visText(short)} more. Use the rod to draw from the land`);
      return 'refused';
    }
    let ok = false;
    if (focus === 'focus_kindle') ok = this.kindle(target);
    else if (focus === 'focus_light') ok = this.light(target);
    else if (focus === 'focus_ward') ok = this.ward();
    else if (focus === 'focus_blink') ok = this.blink();
    if (!ok) return 'refused';
    for (const [p, n] of Object.entries(cost) as [Primal, number][]) this.vis[p] -= n;
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
    for (const [k, s] of [...this.servants]) {
      const [x, y, z] = parse3(k);
      if (!this.world.isLoaded(x, z)) continue;
      if (this.world.getBlock(x, y, z).key !== 'clay_servant') {
        this.servants.delete(k);
        continue;
      }
      if (s.fed <= 0) {
        s.done = false;
        s.job = null;
        const job = this.chooseJob(s.hx, s.hy, s.hz, x, y, z);
        if (job && this.take(s.hx, s.hy, s.hz, 1, 'spring', 1, false) > 0) {
          s.fed = SERVANT_FEED_S;
          s.job = job;
        }
      }
      let cx = x;
      let cy = y;
      let cz = z;
      if (s.fed > 0) {
        // A save restores the feed without the chosen task: pick one, and do not pay Spring again.
        if (!s.done && !s.job) s.job = this.chooseJob(s.hx, s.hy, s.hz, x, y, z);
        if (!s.done && s.job) [cx, cy, cz] = this.advanceServant(s, x, y, z);
        s.fed = Math.max(0, s.fed - dt);
      }
      if (this.world.getBlock(cx, cy, cz).key === 'clay_servant') this.setActive(cx, cy, cz, s.fed > 0);
    }
  }

  /** Nearest hand crank in walk range, else a deployer, else a loose item on a belt. */
  private chooseJob(hx: number, hy: number, hz: number, x: number, y: number, z: number): ServantJob | null {
    const flood = this.flood(hx, hy, hz, x, y, z);
    const at: [number, number, number] = [x, y, z];
    const cranks: ServantJob[] = [];
    const deployers: ServantJob[] = [];
    const R = SERVANT_RANGE + 1;
    for (let dy = -R; dy <= R; dy++)
      for (let dz = -R; dz <= R; dz++)
        for (let dx = -R; dx <= R; dx++) {
          const cx = hx + dx;
          const cy = hy + dy;
          const cz = hz + dz;
          const key = this.blockAt(cx, cy, cz);
          if (key === 'hand_crank') cranks.push({ kind: 'crank', x: cx, y: cy, z: cz, item: '', groundId: -1 });
          else if (key === 'deployer') deployers.push({ kind: 'deployer', x: cx, y: cy, z: cz, item: '', groundId: -1 });
        }
    const belts: ServantJob[] = [];
    for (const e of this.player.ground.items) {
      if (e.homing || e.count <= 0) continue;
      const bx = Math.floor(e.x);
      const by = Math.floor(e.y - 0.05);
      const bz = Math.floor(e.z);
      if (this.blockAt(bx, by, bz) !== 'conveyor_belt') continue;
      if (this.cheb(hx, hy, hz, bx, by, bz) > R) continue;
      belts.push({ kind: 'belt', x: bx, y: by, z: bz, item: e.item, groundId: e.id });
    }
    return this.nearestJob(flood, at, cranks) ?? this.nearestJob(flood, at, deployers) ?? this.nearestJob(flood, at, belts);
  }

  private nearestJob(flood: ServantFlood, at: [number, number, number], jobs: readonly ServantJob[]): ServantJob | null {
    let best: ServantJob | null = null;
    let bestCheb = Infinity;
    let bestSteps = Infinity;
    for (const job of jobs) {
      const stand = this.standOf(flood, at[0], at[1], at[2], job.x, job.y, job.z);
      if (!stand) continue;
      const cheb = this.cheb(at[0], at[1], at[2], job.x, job.y, job.z);
      if (cheb < bestCheb || (cheb === bestCheb && stand.d < bestSteps)) {
        best = job;
        bestCheb = cheb;
        bestSteps = stand.d;
      }
    }
    return best;
  }

  /** Cells a servant can stand on: non-solid, at most SERVANT_RANGE steps, and never farther than that from home. */
  private flood(hx: number, hy: number, hz: number, x: number, y: number, z: number): ServantFlood {
    const dist = new Map<string, number>();
    const parent = new Map<string, string>();
    const start = k3(x, y, z);
    const q: [number, number, number][] = [[x, y, z]];
    dist.set(start, 0);
    for (let i = 0; i < q.length; i++) {
      const [cx, cy, cz] = q[i];
      const d = dist.get(k3(cx, cy, cz)) ?? 0;
      if (d >= SERVANT_RANGE) continue;
      for (const [dx, dy, dz] of DIRS) {
        const nx = cx + dx;
        const ny = cy + dy;
        const nz = cz + dz;
        const key = k3(nx, ny, nz);
        if (dist.has(key) || this.cheb(hx, hy, hz, nx, ny, nz) > SERVANT_RANGE) continue;
        if (this.world.getBlock(nx, ny, nz).solid) continue;
        dist.set(key, d + 1);
        parent.set(key, k3(cx, cy, cz));
        q.push([nx, ny, nz]);
      }
    }
    return { dist, parent };
  }

  /** The closest stand cell beside the target that the flood reached. */
  private standOf(flood: ServantFlood, x: number, y: number, z: number, tx: number, ty: number, tz: number): { key: string; d: number } | null {
    let best: { key: string; d: number } | null = null;
    const consider = (cx: number, cy: number, cz: number): void => {
      if (!this.beside(cx, cy, cz, tx, ty, tz)) return;
      const key = k3(cx, cy, cz);
      const d = flood.dist.get(key);
      if (d === undefined || (best && d >= best.d)) return;
      best = { key, d };
    };
    consider(x, y, z);
    for (const [dx, dy, dz] of DIRS) consider(tx + dx, ty + dy, tz + dz);
    return best;
  }

  private firstStep(parent: Map<string, string>, goal: string, start: string): string | null {
    let cur = goal;
    for (let guard = 0; cur !== start && guard < SERVANT_RANGE + 2; guard++) {
      const prev = parent.get(cur);
      if (!prev) return null;
      if (prev === start) return cur;
      cur = prev;
    }
    return null;
  }

  /** Walks one non-solid cell toward the job, then does it once the servant is beside the target. */
  private advanceServant(s: ServantState, x: number, y: number, z: number): [number, number, number] {
    const job = s.job;
    if (!job || s.done) return [x, y, z];
    const finish = (): void => {
      this.performServant(job);
      s.done = true;
    };
    if (this.beside(x, y, z, job.x, job.y, job.z)) {
      finish();
      return [x, y, z];
    }
    const flood = this.flood(s.hx, s.hy, s.hz, x, y, z);
    const stand = this.standOf(flood, x, y, z, job.x, job.y, job.z);
    if (!stand) return [x, y, z];
    if (stand.key === k3(x, y, z)) {
      finish();
      return [x, y, z];
    }
    const next = this.firstStep(flood.parent, stand.key, k3(x, y, z));
    if (!next) return [x, y, z];
    const [nx, ny, nz] = parse3(next);
    if (this.world.getBlock(nx, ny, nz).solid || this.cheb(s.hx, s.hy, s.hz, nx, ny, nz) > SERVANT_RANGE) return [x, y, z];
    this.moveServant(x, y, z, nx, ny, nz, s);
    if (this.beside(nx, ny, nz, job.x, job.y, job.z)) finish();
    return [nx, ny, nz];
  }

  private moveServant(x: number, y: number, z: number, nx: number, ny: number, nz: number, s: ServantState): void {
    this.relocating = true;
    try {
      const v = this.world.getVoxel(x, y, z);
      this.world.setVoxel(x, y, z, 0, 'sim');
      this.world.setVoxel(nx, ny, nz, v, 'sim');
    } finally {
      this.relocating = false;
    }
    this.servants.delete(k3(x, y, z));
    this.servants.set(k3(nx, ny, nz), s);
  }

  private performServant(job: ServantJob): void {
    switch (job.kind) {
      case 'crank':
        this.hooks.crank?.(job.x, job.y, job.z);
        return;
      case 'deployer': {
        const facing = voxelFacing(this.world.getVoxel(job.x, job.y, job.z));
        const [dx, dy, dz] = FACE_DIRS[FACING_TO_FACE[facing]];
        this.workshop?.act({ item: '', target: [job.x + dx, job.y + dy, job.z + dz], face: facing, mode: 'auto' });
        return;
      }
      case 'belt': {
        const pile = this.player.ground.items.find((e) => e.id === job.groundId && e.count > 0)
          ?? this.player.ground.items.find((e) => e.item === job.item && e.count > 0 && Math.floor(e.x) === job.x && Math.floor(e.z) === job.z);
        if (!pile || !this.workshop) return;
        const n = this.workshop.offer(job.x, job.y, job.z, pile.item, 1);
        if (n <= 0) return;
        pile.count -= n;
        if (pile.count <= 0) {
          const i = this.player.ground.items.indexOf(pile);
          if (i >= 0) this.player.ground.items.splice(i, 1);
        }
        return;
      }
      default: {
        const never: never = job.kind;
        return never;
      }
    }
  }

  private cheb(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
  }

  private beside(x: number, y: number, z: number, tx: number, ty: number, tz: number): boolean {
    return Math.abs(x - tx) + Math.abs(y - ty) + Math.abs(z - tz) === 1;
  }

  servantText(x: number, y: number, z: number): string | null {
    const s = this.servants.get(k3(x, y, z));
    if (!s) return null;
    return s.fed > 0 ? `Clay Servant - cranking, fed for ${Math.ceil(s.fed)} s` : 'Clay Servant - idle (needs a hand crank and a jar of Spring it touches or tubes to)';
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
      { id: 'servant', title: 'Set a clay servant to work', done: [...this.servants.values()].some((s) => s.fed > 0) },
      { id: 'all_research', title: `Finish every research (${researched}/${RESEARCH.filter((e) => e.board).length})`, done: RESEARCH.every((e) => done(e.key)) },
    ];
  }

  /** Ink strokes in every carried set of scribing tools. */
  private ink(): number {
    const inv = this.player.inventory;
    let n = 0;
    for (let i = 0; i < inv.size; i++) {
      const s = inv.get(i);
      if (s?.item === SCRIBING_TOOLS) n += s.durability ?? 0;
    }
    return n;
  }

  private spendInk(): void {
    const inv = this.player.inventory;
    for (let i = 0; i < inv.size; i++) {
      const s = inv.get(i);
      if (s?.item !== SCRIBING_TOOLS || !s.durability) continue;
      if (s.durability <= 1) {
        inv.set(i, null);
        this.toast('Your scribing tools ran dry');
      } else inv.set(i, { ...s, durability: s.durability - 1 });
      return;
    }
  }

  notebook(): NotebookApi {
    return {
      research: () => this.research,
      entries: () => RESEARCH.map((e) => ({
        key: e.key, title: e.title, text: e.text, status: entryStatus(this.research, e), board: e.board, age: e.age,
        requires: e.requires, cost: e.cost, short: beginShortfall(this.research, e),
      })),
      begin: (entry) => {
        const r = beginResearch(this.research, entry);
        if (r.ok) this.bus.emit('sfx', { name: 'scan_chime' });
        return r;
      },
      combine: (a, b) => combineAspects(this.research, a, b),
      ink: () => this.ink(),
      place: (entry, cell, aspect) => {
        if (this.ink() <= 0) return { ok: false, reason: 'Your scribing tools are dry: make new ones' };
        const r = placeToken(this.research, entry, cell, aspect);
        if (r.ok) this.spendInk();
        if (r.solved) {
          const e = RESEARCH.find((x) => x.key === entry);
          if (e?.age === 'forge') this.addWarp(1);
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
      vis: () => ({ vis: { ...this.vis }, capacity: this.bestRod()?.capacity ?? 0 }),
      unease: () => this.uneaseText(),
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
      vis: { ...this.vis },
      warp: this.warp,
      crucibles: [...this.crucibles].filter(([, c]) => c.water || crucibleTotal(c) > 0).map(([k, c]) => [...parse3(k), c.water ? 1 : 0, { ...c.ess }]),
      pedestals: [...this.pedestals].map(([k, i]) => [...parse3(k), i]),
      altars: [...this.altars].map(([k, i]) => [...parse3(k), i]),
      infusion: f ? { x: f.x, y: f.y, z: f.z, id: f.id, paid: { ...f.paid }, t: f.t } : null,
      servants: [...this.servants].map(([k, s]) => {
        const [x, y, z] = parse3(k);
        const row = [x, y, z, s.fed];
        if (s.hx !== x || s.hy !== y || s.hz !== z || s.done) row.push(s.hx, s.hy, s.hz, s.done ? 1 : 0);
        return row;
      }),
      nodes,
      stats: { ...this.stats },
      plugged: Object.fromEntries(this.plugged),
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
    this.warp = num(s.warp) ? Math.max(0, Math.min(40, s.warp)) : 0;
    this.vis = emptyVis();
    if (s.vis && typeof s.vis === 'object') {
      for (const [p, n] of Object.entries(s.vis)) if (isAspect(p) && isPrimal(p) && num(n)) this.vis[p] = Math.max(0, Math.min(64, n));
    }
    this.crucibles.clear();
    for (const r of Array.isArray(s.crucibles) ? s.crucibles : []) {
      if (!Array.isArray(r) || r.length !== 5 || !cell(r) || !r[4] || typeof r[4] !== 'object') continue;
      const ess: Aspects = {};
      for (const [a, n] of Object.entries(r[4] as Record<string, unknown>)) if (isAspect(a) && num(n) && n > 0) ess[a] = Math.min(64, Math.floor(n));
      this.crucibles.set(k3(r[0], r[1], r[2]), { water: r[3] === 1, ess });
    }
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
      if (!Array.isArray(r) || (r.length !== 4 && r.length !== 8) || !cell(r) || !num(r[3])) continue;
      const home = r.length === 8 && num(r[4]) && num(r[5]) && num(r[6]);
      const st = freshServant(home ? r[4] : r[0], home ? r[5] : r[1], home ? r[6] : r[2], Math.max(0, r[3]));
      st.done = home && r[7] === 1;
      this.servants.set(k3(r[0], r[1], r[2]), st);
    }
    this.nodeDraws.clear();
    if (s.nodes && typeof s.nodes === 'object') for (const [k, n] of Object.entries(s.nodes)) if (num(n)) this.nodeDraws.set(k, { n, t: this.clock });
    const f = s.infusion;
    this.infusion = f && num(f.x) && num(f.y) && num(f.z) && typeof f.id === 'string' && INFUSIONS.some((i) => i.id === f.id)
      ? { x: f.x, y: f.y, z: f.z, id: f.id, paid: sanitizeAspects(f.paid), t: num(f.t) ? f.t : 0, waitS: 0, step: 0 }
      : null;
    this.plugged.clear();
    if (s.plugged && typeof s.plugged === 'object')
      for (const [w, f] of Object.entries(s.plugged)) if (ROD_TIERS.some((r) => r.key === w) && FOCI.some((x) => x.key === f)) this.plugged.set(w, f);
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
