/**
 * Essentia & Research at runtime (docs/api/magic.md). One object per world: the player's research, the essentia jars and
 * how much the land around has been drawn. Everything in-world goes through `use(target)`, called by the player's Use
 * before any placing or screen; the notebook screen reads and writes `research` through `NotebookApi`.
 *
 * - Field notebook: Use on a block = scan it (lore + aspects); Use at the sky = open the notebook.
 * - Gathering rod: each Use (it repeats while held) draws 1 unit of the richest aspect of the blocks within GATHER_RADIUS;
 *   every VIAL_UNITS units turn one empty glass vial in the pack into a filled vial. The land recovers DRAW_RECOVER_S per unit.
 * - Vials and jars: a filled vial on a jar pours in; an empty vial on a jar fills back.
 * - Cinder for the hearth (research 'warm_hearth'): a Vial of Cinder on a burning furnace adds CINDER_BURN_S of fire.
 */
import type { GameBus } from '../core/context';
import { blockOrNull, itemOrNull } from '../core/registry';
import type { BlockDef, IWorld } from '../core/types';
import { JAR_UNITS, VIAL_UNITS, vialKey } from '../content/itemsMagic';
import type { PlayerState } from '../game/playerState';
import { ASPECT_LIST, aspectInfo, aspectsText, isAspect, type Aspect } from './aspects';
import { aspectsOf } from './fingerprint';
import { craftGateReason } from './gates';
import { RESEARCH } from './entries';
import {
  entryStatus, freshResearch, hasFlag, hintFor, placeToken, removeToken, sanitizeResearch, scanObject,
  type EntryStatus, type PlaceResult, type ResearchState,
} from './research';

export const NOTEBOOK = 'field_notebook';
export const ROD = 'vis_rod';
export const EMPTY_VIAL = 'glass_vial';
export const JAR_BLOCK = 'essentia_jar';
/** Cube radius the rod reads the land in. */
export const GATHER_RADIUS = 3;
/** Seconds the land needs to recover one drawn unit (per chunk and aspect). */
export const DRAW_RECOVER_S = 30;
/** Units an aspect can give in one chunk before it is drained: its share of the nearby fingerprints, at most this. */
export const DRAW_CAP = 24;
/** Seconds between two rod draws (the Use repeat already paces it; this guards fast taps). */
export const ROD_INTERVAL_S = 0.2;
/** Fire seconds one Vial of Cinder adds to a burning furnace. */
export const CINDER_BURN_S = 90;

const vialAspect = (item: string | undefined): Aspect | null => {
  if (!item?.startsWith('vial_')) return null;
  const a = item.slice(5);
  return isAspect(a) ? a : null;
};

/** What the Use landed on; null = the sky. */
export interface MagicTarget { x: number; y: number; z: number; block: BlockDef }

export type MagicOutcome = 'worked' | 'refused' | 'screen';

/** What the notebook screen needs (the UI never imports this file's values). */
export interface NotebookApi {
  research(): ResearchState;
  entries(): { key: string; title: string; text: string; status: EntryStatus; board: import('./board').BoardSpec | null }[];
  place(entry: string, cell: number, aspect: Aspect): PlaceResult;
  remove(entry: string, cell: number): boolean;
  hint(entry: string): { cell: number; aspect: Aspect } | null;
  /** Scans an item the player carries (by key). */
  scanItem(key: string): string;
}

export interface MagicHooks {
  /** Adds seconds of fire to the furnace at x, y, z if it is burning; false when it is not a burning furnace. */
  stokeFurnace?(x: number, y: number, z: number, seconds: number): boolean;
}

interface Jar { aspect: Aspect | null; n: number }
interface Draw { n: number; t: number }

export interface MagicSnapshot {
  v: 1;
  research: ResearchState;
  jars: [number, number, number, string, number][];
  draws: Record<string, Record<string, [number, number]>>;
}

export class Magic {
  research: ResearchState = freshResearch();
  private readonly jars = new Map<string, Jar>();
  private readonly draws = new Map<string, Map<Aspect, Draw>>();
  private rod: { aspect: Aspect | null; n: number } = { aspect: null, n: 0 };
  private clock = 0;
  private lastDraw = -1;
  private readonly off: () => void;

  constructor(private readonly world: IWorld, private readonly bus: GameBus, private readonly player: PlayerState, private readonly hooks: MagicHooks = {}) {
    // A jar that is broken spills its essentia (gone); a new one starts empty.
    this.off = bus.on('block:changed', (e) => {
      const k = `${e.x},${e.y},${e.z}`;
      if (this.jars.has(k) && world.getBlock(e.x, e.y, e.z).key !== JAR_BLOCK) this.jars.delete(k);
    });
  }

  dispose(): void {
    this.off();
  }

  tick(dt: number): void {
    this.clock += dt;
  }

  /** Why the player cannot craft this recipe yet, or null. */
  craftGate(recipeId: string): string | null {
    return craftGateReason(this.research, recipeId);
  }

  // ---- Use ------------------------------------------------------------------------------------------

  use(target: MagicTarget | null): MagicOutcome | null {
    const held = this.player.heldStack()?.item;
    if (held === NOTEBOOK) {
      if (!target) {
        this.bus.emit('ui:open', { screen: { type: 'notebook' } });
        return 'screen';
      }
      this.scanBlock(target.block.key);
      return 'worked';
    }
    if (held === ROD) return this.gather();
    if (target?.block.key === JAR_BLOCK && (held === EMPTY_VIAL || vialAspect(held))) return this.useJar(target, held as string);
    const va = vialAspect(held);
    if (va === 'cinder' && target && this.hooks.stokeFurnace && blockOrNull(target.block.key)?.machine === 'furnace') return this.stoke(target);
    return null;
  }

  private toast(text: string, item?: string): void {
    this.bus.emit('toast', item ? { text, kind: 'info', item } : { text, kind: 'info' });
  }

  scanBlock(key: string): string {
    const name = blockOrNull(key)?.name ?? itemOrNull(key)?.name ?? key;
    const fp = aspectsOf(key);
    const r = scanObject(this.research, key, fp);
    let text: string;
    if (!r.first) text = `${name}: ${aspectsText(fp)} (already in your notes)`;
    else {
      text = `Noted ${name}: ${aspectsText(fp)}`;
      if (r.learned.length) text += `. New aspect: ${r.learned.map((a) => aspectInfo(a).name).join(', ')}`;
      this.bus.emit('sfx', { name: 'pickup', pitch: 1.6, volume: 0.6 });
    }
    for (const f of r.finished) {
      const e = RESEARCH.find((x) => x.key === f);
      if (e) this.bus.emit('toast', { text: `Research done: ${e.title}`, kind: 'good' });
    }
    this.toast(text, NOTEBOOK);
    return text;
  }

  /** Units of `aspect` left to draw in the chunk around x, z (recovering over time). */
  drawn(x: number, z: number, aspect: Aspect): number {
    const d = this.draws.get(chunkKey(x, z))?.get(aspect);
    if (!d) return 0;
    return Math.max(0, d.n - (this.clock - d.t) / DRAW_RECOVER_S);
  }

  /** The aspects of the land around a point: summed fingerprints of every non-air block within GATHER_RADIUS. */
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

  /** The aspect the rod would draw here and how much is left of it (null = nothing). */
  richest(px: number, py: number, pz: number): { aspect: Aspect; left: number } | null {
    const land = this.landAspects(px, py, pz);
    let best: { aspect: Aspect; left: number } | null = null;
    for (const [a, n] of land) {
      const cap = Math.min(DRAW_CAP, Math.floor(n / 8));
      const left = cap - this.drawn(px, pz, a);
      if (left >= 1 && (!best || left > best.left)) best = { aspect: a, left };
    }
    return best;
  }

  private gather(): MagicOutcome {
    if (this.clock - this.lastDraw < ROD_INTERVAL_S && this.lastDraw >= 0) return 'worked';
    const p = this.player;
    if (!p.inventory.has(EMPTY_VIAL)) {
      this.advise('Carry an empty glass vial: the rod fills it');
      return 'refused';
    }
    const px = Math.floor(p.position.x);
    const py = Math.floor(p.position.y + 0.5);
    const pz = Math.floor(p.position.z);
    // Keep drawing the aspect already started while the land still gives it.
    let aspect = this.rod.aspect;
    if (!aspect || this.richest(px, py, pz) === null || this.leftOf(px, py, pz, aspect) < 1) {
      const r = this.richest(px, py, pz);
      if (!r) {
        this.advise('The land here is drained. Move on, or wait for it to recover');
        return 'refused';
      }
      if (r.aspect !== aspect) this.rod = { aspect: r.aspect, n: 0 };
      aspect = r.aspect;
    }
    this.lastDraw = this.clock;
    this.markDrawn(px, pz, aspect);
    this.rod.n++;
    this.bus.emit('sfx', { name: 'pickup', pitch: 0.7 + this.rod.n * 0.12, volume: 0.35 });
    if (this.rod.n >= VIAL_UNITS) {
      p.inventory.remove(EMPTY_VIAL, 1);
      p.give(vialKey(aspect), 1);
      this.rod.n = 0;
      this.toast(`Filled a Vial of ${aspectInfo(aspect).name}`, vialKey(aspect));
    }
    return 'worked';
  }

  private leftOf(px: number, py: number, pz: number, a: Aspect): number {
    const n = this.landAspects(px, py, pz).get(a) ?? 0;
    return Math.min(DRAW_CAP, Math.floor(n / 8)) - this.drawn(px, pz, a);
  }

  private markDrawn(x: number, z: number, a: Aspect): void {
    const k = chunkKey(x, z);
    let m = this.draws.get(k);
    if (!m) this.draws.set(k, (m = new Map()));
    m.set(a, { n: this.drawn(x, z, a) + 1, t: this.clock });
  }

  private lastAdvice = new Map<string, number>();
  private advise(text: string): void {
    const t = this.lastAdvice.get(text);
    if (t !== undefined && this.clock - t < 4) return;
    this.lastAdvice.set(text, this.clock);
    this.toast(text);
  }

  // ---- Jars -----------------------------------------------------------------------------------------

  jarAt(x: number, y: number, z: number): Jar | null {
    if (this.world.getBlock(x, y, z).key !== JAR_BLOCK) return null;
    return this.jars.get(`${x},${y},${z}`) ?? { aspect: null, n: 0 };
  }

  jarText(x: number, y: number, z: number): string | null {
    const j = this.jarAt(x, y, z);
    if (!j) return null;
    return j.aspect && j.n > 0 ? `Essentia Jar - ${aspectInfo(j.aspect).name} ${j.n}/${JAR_UNITS}` : 'Essentia Jar - empty';
  }

  private useJar(t: MagicTarget, held: string): MagicOutcome {
    const k = `${t.x},${t.y},${t.z}`;
    const jar = this.jars.get(k) ?? { aspect: null, n: 0 };
    const p = this.player;
    const va = vialAspect(held);
    if (va) {
      if (jar.aspect && jar.aspect !== va && jar.n > 0) {
        this.advise(`This jar holds ${aspectInfo(jar.aspect).name}; aspects do not mix`);
        return 'refused';
      }
      if (jar.n + VIAL_UNITS > JAR_UNITS) {
        this.advise('The jar is full');
        return 'refused';
      }
      p.consumeHeld(1);
      p.give(EMPTY_VIAL, 1);
      this.jars.set(k, { aspect: va, n: jar.n + VIAL_UNITS });
    } else {
      if (!jar.aspect || jar.n < VIAL_UNITS) {
        this.advise('The jar has too little essentia to fill a vial');
        return 'refused';
      }
      p.consumeHeld(1);
      p.give(vialKey(jar.aspect), 1);
      const n = jar.n - VIAL_UNITS;
      this.jars.set(k, { aspect: n > 0 ? jar.aspect : null, n });
    }
    this.bus.emit('sfx', { name: 'pour', x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 });
    this.toast(this.jarText(t.x, t.y, t.z) ?? '');
    return 'worked';
  }

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

  // ---- Notebook ---------------------------------------------------------------------------------------

  notebook(): NotebookApi {
    return {
      research: () => this.research,
      entries: () => RESEARCH.map((e) => ({ key: e.key, title: e.title, text: e.text, status: entryStatus(this.research, e), board: e.board })),
      place: (entry, cell, aspect) => {
        const r = placeToken(this.research, entry, cell, aspect);
        if (r.solved) {
          const e = RESEARCH.find((x) => x.key === entry);
          this.bus.emit('toast', { text: `Research done: ${e?.title ?? entry}`, kind: 'good' });
          this.bus.emit('sfx', { name: 'craft' });
        }
        return r;
      },
      remove: (entry, cell) => removeToken(this.research, entry, cell),
      hint: (entry) => hintFor(this.research, entry),
      scanItem: (key) => this.scanBlock(key),
    };
  }

  // ---- Save -------------------------------------------------------------------------------------------

  toJSON(): MagicSnapshot {
    const jars: MagicSnapshot['jars'] = [];
    for (const [k, j] of this.jars) {
      if (!j.aspect || j.n <= 0) continue;
      const [x, y, z] = k.split(',').map(Number);
      jars.push([x, y, z, j.aspect, j.n]);
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
    return { v: 1, research: this.research, jars, draws };
  }

  /** Restores a snapshot; anything damaged is dropped, never thrown. Draw times restart at the load clock. */
  load(raw: unknown): void {
    if (!raw || typeof raw !== 'object') return;
    const s = raw as Partial<MagicSnapshot>;
    this.research = sanitizeResearch(s.research);
    this.jars.clear();
    if (Array.isArray(s.jars))
      for (const j of s.jars) {
        if (!Array.isArray(j) || j.length !== 5) continue;
        const [x, y, z, a, n] = j;
        if (![x, y, z, n].every((v) => typeof v === 'number' && Number.isFinite(v)) || typeof a !== 'string' || !isAspect(a)) continue;
        this.jars.set(`${x},${y},${z}`, { aspect: a, n: Math.max(0, Math.min(JAR_UNITS, Math.floor(n))) });
      }
    this.draws.clear();
    if (s.draws && typeof s.draws === 'object')
      for (const [k, row] of Object.entries(s.draws)) {
        const m = new Map<Aspect, Draw>();
        for (const [a, v] of Object.entries(row ?? {})) if (isAspect(a) && Array.isArray(v) && typeof v[0] === 'number') m.set(a, { n: v[0], t: this.clock });
        if (m.size) this.draws.set(k, m);
      }
  }
}

export const chunkKey = (x: number, z: number): string => `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
