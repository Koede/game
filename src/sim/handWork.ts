/**
 * Hand stations (docs/api/handwork.md): the stations whose work is the player's own strokes (chopping block, quern,
 * anvil, mortar, clay table, loom) and the timed ones (drying rack, tanning trough). Their entities are plain saved
 * objects like a crate's, but never machine nodes: they take no power and only the player's strokes, or the clock,
 * move them. Only stations with work running are visited each tick.
 */
import type { GameBus } from '../core/context';
import { HAND_STROKE_FOOD, HOT_WORK_WINDOW_S, STROKE_HOT_MULT, STROKE_TOOL_MULT } from '../core/constants';
import { WORLD_HEIGHT, voxelId, type BlockDef, type IWorld, type Slot } from '../core/types';
import { blockOf } from '../core/registry';
import type { PlayerState } from '../game/playerState';
import { posKey } from './entities';
import type { HandEntity, HandRecipe, HandRules, HandStationDef, HandView, StrokeResult } from './handTypes';
import { HOT_WINDOW_RADIUS } from './handTypes';
import { buildView } from './handViews';

export interface HandDeps {
  world: IWorld;
  bus: GameBus;
  player: PlayerState;
  rules: HandRules;
  random: () => number;
  /** Fires a first-time flag. */
  flag(flag: string): void;
  /** What a removed station held: into the pack, the rest spilled (nothing when blocks are exploding). */
  release(x: number, y: number, z: number, held: readonly Slot[]): void;
}

/** Runtime companion of a station entity (never saved). */
export interface HandNode {
  readonly e: HandEntity;
  readonly key: string;
  readonly def: HandStationDef;
  /** Cached open sky above and rain reaching it (timed stations that need sky). */
  sky: boolean;
  rain: boolean;
  skyDirty: boolean;
  /** Index in the active list, -1 while idle. */
  slot: number;
}

const colKey = (x: number, z: number): number => x * 4194304 + z;
const clampCount = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export class HandWork {
  private readonly byKey = new Map<string, HandNode>();
  private readonly columns = new Map<number, HandNode[]>();
  private readonly active: HandNode[] = [];
  /** The weather of the last tick, for views. */
  private sunUp = true;
  private wetAt: ((x: number, y: number, z: number) => boolean) | null = null;

  constructor(private readonly d: HandDeps) {}

  get count(): number {
    return this.byKey.size;
  }

  get activeCount(): number {
    return this.active.length;
  }

  clear(): void {
    this.byKey.clear();
    this.columns.clear();
    this.active.length = 0;
  }

  /** Starts following a station entity stored in the world (after loading), repairing damaged fields. */
  track(stored: HandEntity, def: HandStationDef): HandNode {
    const e = stored;
    if (!Array.isArray(e.slots)) e.slots = [];
    while (e.slots.length < 2) e.slots.push(null);
    for (let i = 0; i < 2; i++) {
      const s = e.slots[i];
      if (s && (typeof s.item !== 'string' || clampCount(s.count) === 0)) e.slots[i] = null;
    }
    if (typeof e.progress !== 'number' || !Number.isFinite(e.progress) || e.progress < 0) e.progress = 0;
    if (typeof e.hotS !== 'number' || !Number.isFinite(e.hotS) || e.hotS < 0) e.hotS = 0;
    if (e.recipe !== null && typeof e.recipe !== 'string') e.recipe = null;
    const node: HandNode = { e, key: posKey(e.x, e.y, e.z), def, sky: false, rain: false, skyDirty: true, slot: -1 };
    this.byKey.set(node.key, node);
    if (def.timed && def.needsSky) {
      const ck = colKey(e.x, e.z);
      const col = this.columns.get(ck);
      if (col) col.push(node);
      else this.columns.set(ck, [node]);
    }
    this.sync(node);
    return node;
  }

  /**
   * A block changed. Returns true when `to` is a hand station (the caller then makes no machine of it). Creates the
   * entity of a new station, releases the contents of one that went, and marks racks under a changed column dirty.
   */
  blockChanged(x: number, y: number, z: number, from: BlockDef, to: BlockDef): boolean {
    const toDef = this.d.rules.station(to.key);
    const key = posKey(x, y, z);
    const node = this.byKey.get(key);
    if (node && node.def.key !== toDef?.key) this.remove(node);
    if (this.columns.size > 0 && (from.opaque !== to.opaque || from.solid !== to.solid || (from.liquid !== null) !== (to.liquid !== null))) {
      const col = this.columns.get(colKey(x, z));
      if (col) for (const n of col) if (n.e.y < y) n.skyDirty = true;
    }
    if (!toDef) return false;
    if (this.byKey.has(key)) return true;
    const stored = this.d.world.getEntity(x, y, z) as HandEntity | undefined;
    if (stored && stored.kind === 'hand') this.track(stored, toDef);
    else {
      const e: HandEntity = { kind: 'hand', x, y, z, slots: [null, null], progress: 0, recipe: null, hotS: 0, made: null };
      this.d.world.setEntity(e);
      this.track(e, toDef);
    }
    return true;
  }

  private remove(node: HandNode): void {
    const { e } = node;
    this.deactivate(node);
    this.byKey.delete(node.key);
    const col = this.columns.get(colKey(e.x, e.z));
    if (col) {
      col.splice(col.indexOf(node), 1);
      if (col.length === 0) this.columns.delete(colKey(e.x, e.z));
    }
    if (this.d.world.getEntity(e.x, e.y, e.z) === e) this.d.world.removeEntity(e.x, e.y, e.z);
    this.d.release(e.x, e.y, e.z, e.slots);
  }

  // ---- the player's actions -------------------------------------------------------------------------------------

  /** One Use on the station at x,y,z with `heldKey` in hand ('' or null: empty hand). */
  stroke(x: number, y: number, z: number, heldKey: string | null): StrokeResult {
    const node = this.byKey.get(posKey(x, y, z));
    if (!node) return { ok: false, reason: 'There is no work station here' };
    const { e, def } = node;
    const { rules } = this.d;
    const held = heldKey ? heldKey : null;
    const out = e.slots[1];
    if (out) {
      if (held) return { ok: false, reason: `Take the ${rules.itemName(out.item)} first` };
      return this.take(node);
    }
    const input = e.slots[0];
    if (held && this.accepts(def, held)) return this.insert(node, held);
    if (held && !input) return { ok: false, reason: `${def.name} cannot work ${rules.itemName(held)}` };
    if (!input) return { ok: false, reason: 'Nothing to work' };
    if (held && held === input.item) return { ok: false, reason: `${def.name} is full` };
    if (held && !def.timed && !(def.tool && rules.toolKind(held) === def.tool)) {
      return { ok: false, reason: `Busy with ${rules.itemName(input.item)}` };
    }
    if (def.timed) return { ok: false, reason: `${def.name} works by itself - wait` };
    const r = this.recipeFor(def, input);
    if (!r) return { ok: false, reason: 'Nothing to work' };
    if (input.count < r.inputs[0].count) return { ok: false, reason: `Needs ${r.inputs[0].count} ${rules.itemName(r.inputs[0].item)}` };
    return this.work(node, r, held);
  }

  /** Empty hand: puts the loaded input back into the pack. */
  handReturn(x: number, y: number, z: number): StrokeResult {
    const node = this.byKey.get(posKey(x, y, z));
    if (!node) return { ok: false, reason: 'There is no work station here' };
    const { e } = node;
    if (e.slots[1]) return { ok: false, reason: `Take the ${this.d.rules.itemName(e.slots[1].item)} first` };
    const input = e.slots[0];
    if (!input) return { ok: false, reason: 'Nothing loaded' };
    if (this.d.player.inventory.space(input.item) < input.count) return { ok: false, reason: 'Your pack is full' };
    this.d.player.give(input.item, input.count);
    e.slots[0] = null;
    this.sync(node);
    return { ok: true, did: 'return' };
  }

  /** Opens the 20 s hot-work window on every hot-capable station near x,y,z (a crucible's molten output was taken). */
  openHotWindow(x: number, y: number, z: number): void {
    const r2 = HOT_WINDOW_RADIUS * HOT_WINDOW_RADIUS;
    for (const n of this.byKey.values()) {
      if (n.def.hot && (n.e.x - x) ** 2 + (n.e.y - y) ** 2 + (n.e.z - z) ** 2 <= r2) {
        n.e.hotS = HOT_WORK_WINDOW_S;
        this.sync(n);
      }
    }
  }

  private accepts(def: HandStationDef, item: string): boolean {
    return this.d.rules.recipes(def.key).some((r) => r.inputs[0].item === item);
  }

  private recipeFor(def: HandStationDef, input: Slot): HandRecipe | null {
    if (!input) return null;
    for (const r of this.d.rules.recipes(def.key)) if (r.inputs[0].item === input.item) return r;
    return null;
  }

  private insert(node: HandNode, held: string): StrokeResult {
    const { e, def } = node;
    const input = e.slots[0];
    if (input && input.item !== held) return { ok: false, reason: `Busy with ${this.d.rules.itemName(input.item)}` };
    const cap = def.timed ? def.batch : this.d.rules.stackLimit(held);
    const room = cap - (input?.count ?? 0);
    if (room <= 0) return { ok: false, reason: `${def.name} is full` };
    const have = this.d.player.heldStack();
    if (!have || have.item !== held) return { ok: false, reason: 'You are not holding that' };
    const took = this.d.player.consumeHeld(Math.min(room, have.count));
    if (!took) return { ok: false, reason: 'You are not holding that' };
    if (input) input.count += took.count;
    else e.slots[0] = { item: took.item, count: took.count };
    this.sync(node);
    return { ok: true, did: 'insert' };
  }

  private take(node: HandNode): StrokeResult {
    const { e, def } = node;
    const out = e.slots[1] as NonNullable<Slot>;
    if (this.d.player.inventory.space(out.item) < out.count) return { ok: false, reason: 'Your pack is full' };
    this.d.player.give(out.item, out.count, out.durability);
    e.slots[1] = null;
    const made = e.made ?? null;
    e.made = null;
    this.d.bus.emit('hand:taken', { x: e.x, y: e.y, z: e.z, station: def.key, item: out.item, count: out.count });
    if (made) this.d.bus.emit('item:made', { item: out.item, count: out.count, station: def.key, recipeId: made });
    this.sync(node);
    return { ok: true, did: 'take' };
  }

  private work(node: HandNode, r: HandRecipe, held: string | null): StrokeResult {
    const { e, def } = node;
    const withTool = held !== null && def.tool !== null && this.d.rules.toolKind(held) === def.tool;
    const hot = def.hot && e.hotS > 0;
    const gain = withTool ? STROKE_TOOL_MULT : hot ? STROKE_HOT_MULT : 1;
    e.recipe = r.id;
    e.progress = Math.min(r.strokes, e.progress + gain);
    this.d.player.spendFood(HAND_STROKE_FOOD);
    const { x, y, z } = e;
    if (def.sound) this.d.bus.emit('sfx', { name: def.sound, x, y, z, pitch: def.pitch * (0.94 + this.d.random() * 0.12) });
    this.d.bus.emit('hand:stroke', { x, y, z, station: def.key, progress: e.progress, needed: r.strokes, double: gain > 1 });
    if (e.progress < r.strokes) {
      this.sync(node);
      return { ok: true, did: 'stroke' };
    }
    this.finish(node, r, withTool && r.toolOutput !== null ? r.toolOutput : r.output, 1);
    return { ok: true, did: 'done', done: true };
  }

  /** Consumes `batches` of the recipe's input and puts the output in the station. */
  private finish(node: HandNode, r: HandRecipe, out: { item: string; count: number }, batches: number): void {
    const { e, def } = node;
    const input = e.slots[0] as NonNullable<Slot>;
    input.count -= r.inputs[0].count * batches;
    if (input.count <= 0) e.slots[0] = null;
    let count = out.count * batches;
    if (r.bonus && this.d.random() < r.bonus.chance) {
      if (r.bonus.item === out.item) count += r.bonus.count;
      else this.d.player.give(r.bonus.item, r.bonus.count);
    }
    e.slots[1] = { item: out.item, count };
    e.made = r.id;
    e.progress = 0;
    e.recipe = null;
    this.d.bus.emit('hand:done', { x: e.x, y: e.y, z: e.z, station: def.key, output: out.item, count });
    this.d.flag(`hand_${def.key}`);
    this.sync(node);
  }

  // ---- time ---------------------------------------------------------------------------------------------------

  /** Advances the stations with a clock running: timed work, and hot-work windows closing. */
  tick(dt: number, sunUp: boolean, wetAt: ((x: number, y: number, z: number) => boolean) | null): void {
    this.sunUp = sunUp;
    this.wetAt = wetAt;
    const { active } = this;
    for (let i = active.length - 1; i >= 0; i--) {
      const n = active[i];
      const e = n.e;
      if (e.hotS > 0) e.hotS = Math.max(0, e.hotS - dt);
      if (n.def.timed && e.slots[0] && !e.slots[1] && this.runTimed(n, dt)) continue;
      if (e.hotS <= 0 && !(n.def.timed && e.slots[0] && !e.slots[1])) this.deactivate(n);
    }
  }

  /** Why a timed station is not running right now, or null while it runs. */
  waitReason(node: HandNode): string | null {
    const def = node.def;
    if (!def.needsSky) return null;
    this.refreshSky(node);
    if (node.rain && this.wetAt?.(node.e.x, node.e.y, node.e.z)) return def.rainResets ? 'Rain - drying starts over' : 'Raining';
    if (!node.sky) return 'Needs open sky';
    return this.sunUp ? null : 'Needs daylight';
  }

  private runTimed(n: HandNode, dt: number): boolean {
    const e = n.e;
    const r = this.recipeFor(n.def, e.slots[0]);
    if (!r || e.slots[0]!.count < r.inputs[0].count) return false;
    e.recipe = r.id;
    const wait = this.waitReason(n);
    if (wait !== null) {
      if (n.def.rainResets && n.rain && this.wetAt?.(e.x, e.y, e.z)) e.progress = 0;
      return true;
    }
    e.progress += dt;
    if (e.progress >= r.timeS) {
      const batches = Math.floor(e.slots[0]!.count / r.inputs[0].count);
      this.finish(n, r, r.output, batches);
    }
    return true;
  }

  private refreshSky(n: HandNode): void {
    if (!n.skyDirty) return;
    n.skyDirty = false;
    n.sky = true;
    n.rain = true;
    const { world } = this.d;
    for (let y = n.e.y + 1; y < WORLD_HEIGHT && (n.sky || n.rain); y++) {
      const b = blockOf(world.getVoxel(n.e.x, y, n.e.z));
      if (b.opaque) n.sky = false;
      if (b.solid || b.liquid !== null) n.rain = false;
    }
  }

  // ---- views ----------------------------------------------------------------------------------------------------

  view(x: number, y: number, z: number): HandView | null {
    const n = this.byKey.get(posKey(x, y, z));
    return n ? buildView(n, this.d.rules, this.recipeFor(n.def, n.e.slots[0]), this.waitReason(n)) : null;
  }

  // ---- internals ------------------------------------------------------------------------------------------------

  /** Puts the station on the active list when a clock runs on it (timed work or a hot window), else takes it off. */
  private sync(n: HandNode): void {
    const running = n.e.hotS > 0 || (n.def.timed && n.e.slots[0] !== null && n.e.slots[1] === null);
    if (running) this.activate(n);
    else this.deactivate(n);
  }

  private activate(n: HandNode): void {
    if (n.slot >= 0) return;
    n.slot = this.active.length;
    this.active.push(n);
  }

  private deactivate(n: HandNode): void {
    if (n.slot < 0) return;
    const last = this.active.pop() as HandNode;
    if (last !== n) {
      this.active[n.slot] = last;
      last.slot = n.slot;
    }
    n.slot = -1;
  }
}
