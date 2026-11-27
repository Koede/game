/**
 * The playable layer of the world-exploration features (docs/api/exploration.md): waypoint stones, treasure maps and
 * fishing. The rules live in src/sim/waypoints.ts, src/world/treasure.ts and src/sim/fishing.ts; this class holds their
 * state, reads the world, answers Use and saves through `World.persist`. DOM-free; the app's `beforeUse` hook calls `use`.
 *
 *  - Waypoint stone: Use registers it and opens the waypoint screen (a picker of visited stones with distance and
 *    charcoal price); `travel` pays the fuel and moves the player. A stone that has been broken drops out of the network.
 *  - Treasure map: the stack's durability carries `serial * 8 + age` (set on the first read). Reading shows the clue and a
 *    warm/cold hint; once the player is within CHEST_LOAD_R of the spot a crate is buried there (once per serial).
 *  - Fishing: Use a rod on water to cast, Use again inside the bite window to land the catch.
 */
import type { GameBus } from '../core/context';
import { CRATE_SIZE, RUIN_GRID_CHUNKS } from '../core/constants';
import { hash32 } from '../core/math';
import { block as blockByKey, itemOrNull } from '../core/registry';
import { CHUNK_SIZE, makeVoxel, voxelId, type BlockEntity, type ItemStack, type IWorld, type Slot } from '../core/types';
import { FISHING_ROD } from '../content/fishing';
import { isFlowingWater } from '../world/water';
import { squareRuin, spawnRuin } from '../world/ruins';
import { STRUCTURE_GRID_CHUNKS, squareStructure } from '../world/structures';
import { compassWord, makeTreasureMap, treasureClue, treasureHint, type Landmark, type TreasureMap } from '../world/treasure';
import { seasonOf } from '../sim/seasons';
import { biteDelayS, rollCatch, waterKind, type CastContext, type WaterSpot } from '../sim/fishing';
import { WAYPOINT_FUEL_ITEM, WAYPOINT_USE_RADIUS, WaypointNetwork, type Destination, type Waypoint, type WaypointSave } from '../sim/waypoints';
import type { PlayerState } from './playerState';

/** Structure types that count as landmarks for treasure maps. */
export const LANDMARK_KEYS: ReadonlySet<string> = new Set(['standing_circle', 'frost_watchtower', 'buried_colossus']);
export const WAYPOINT_BLOCK = 'waypoint_stone';
export const MAP_ITEM = 'treasure_map';
/** Seconds the fish is on the hook before it gets away. */
export const BITE_WINDOW_S = 1.8;
/** A cast is lost when the player walks this far from it. */
export const CAST_LEASH = 8;
/** The chest is buried when the player comes this close (its chunk is loaded by then). */
export const CHEST_LOAD_R = 24;
const LANDMARK_NAMES = ['the Old Works', 'the Broken Hall', 'the Grey Foundry', 'the Sunken Yard', 'the Cold Forge', 'the Ash Court', 'the Quiet Mill'];
/** The name treasure maps (and the airship's chart) give the ruin whose middle is at (x, z). */
export const ruinName = (seed: number, x: number, z: number): string => LANDMARK_NAMES[hash32(seed, x, z, 77) % LANDMARK_NAMES.length];

export interface ExplorationHost {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly player: PlayerState;
  /** Game age (0 Ember .. 5 Star). */
  age(): number;
  isNight(): boolean;
  raining(): boolean;
  /** 1-based clock day, for the season of the year; omit and fish ignore the season. */
  day?(): number;
  biomeAt(x: number, z: number): 'woodland' | 'dunes' | 'frostfell' | 'scar' | 'marsh';
  now(): number;
  rng?: () => number;
}

/** What a Use aimed at (x,y,z) with (px,py,pz) in front of it, if any, needs to know. */
export interface UseAim { x: number; y: number; z: number; px: number; py: number; pz: number; block: { key: string; liquid: string | null } }

export interface MapMark { kind: 'waypoint' | 'treasure'; x: number; z: number; label: string }
export interface WaypointView { stone: Waypoint; charcoal: number; destinations: Array<Destination & { compass: string }> }

export interface ExplorationSave { waypoints: WaypointSave; serial: number; chests: number[] }

type Fishing =
  | { phase: 'idle' }
  | { phase: 'waiting'; untilS: number; x: number; y: number; z: number; kind: NonNullable<ReturnType<typeof waterKind>> }
  | { phase: 'bite'; untilS: number; x: number; y: number; z: number; kind: NonNullable<ReturnType<typeof waterKind>> };

export class Exploration {
  readonly waypoints = new WaypointNetwork();
  private serial = 0;
  private chests = new Set<number>();
  private fishing: Fishing = { phase: 'idle' };
  private acc = 0;
  /** Set by the app: moves the player (the controller teleports and resets the fall). */
  teleport: ((x: number, y: number, z: number) => void) | null = null;

  constructor(private readonly host: ExplorationHost) {
    host.bus.on('block:placed', (e) => {
      const def = blockByKey(WAYPOINT_BLOCK);
      if (voxelId(e.voxel) === def.id) this.register(e.x, e.y, e.z);
    });
  }

  // ---- persistence ----------------------------------------------------------------------------

  toJSON(): ExplorationSave { return { waypoints: this.waypoints.toSave(), serial: this.serial, chests: [...this.chests] }; }

  load(raw: unknown): void {
    const s = raw as Partial<ExplorationSave> | null;
    if (!s || typeof s !== 'object') return;
    const net = WaypointNetwork.fromSave(s.waypoints);
    for (const w of this.waypoints.all()) this.waypoints.remove(w.x, w.y, w.z);
    for (const w of net.all()) this.waypoints.place(w.x, w.y, w.z, w.name);
    this.serial = Number(s.serial) || 0;
    this.chests = new Set(Array.isArray(s.chests) ? s.chests.map(Number) : []);
  }

  // ---- Use --------------------------------------------------------------------------------------

  use(aim: UseAim | null, held: ItemStack | null): 'worked' | 'refused' | null {
    if (held?.item === FISHING_ROD) {
      const r = this.useRod(aim);
      if (r !== null) return r;
    }
    if (aim && aim.block.key === WAYPOINT_BLOCK && !(held && itemOrNull(held.item)?.block)) return this.useStone(aim);
    if (held?.item === MAP_ITEM) return this.readMap(held);
    return null;
  }

  private toast(text: string, kind: 'info' | 'good' | 'warn' = 'info'): void { this.host.bus.emit('toast', { text, kind }); }

  // ---- waypoints ----------------------------------------------------------------------------------

  private register(x: number, y: number, z: number): Waypoint | null {
    return this.waypoints.at(x, y, z) ?? this.waypoints.place(x, y, z);
  }

  /** Forget stones that were broken (only judged where the chunk is loaded). */
  private prune(): void {
    for (const w of this.waypoints.all()) {
      if (this.host.world.isLoaded(w.x, w.z) && this.host.world.getBlock(w.x, w.y, w.z).key !== WAYPOINT_BLOCK) this.waypoints.remove(w.x, w.y, w.z);
    }
  }

  private useStone(aim: UseAim): 'worked' | 'refused' {
    this.prune();
    const stone = this.register(aim.x, aim.y, aim.z);
    if (!stone) { this.toast('Too many waypoint stones in this world: break one first.', 'warn'); return 'refused'; }
    this.waypoints.visit(stone.id);
    const dests = this.waypoints.destinations(stone);
    if (dests.length === 0) {
      this.toast(`${stone.name} is remembered. Place a second stone elsewhere and visit it to travel between them.`);
      return 'worked';
    }
    this.host.bus.emit('ui:open', { screen: { type: 'waypoints', stone: stone.id } });
    return 'worked';
  }

  /** What the waypoint screen shows for stone `id`: the stone, where each visited stone lies and what the trip costs. */
  waypointView(id: number): WaypointView | null {
    this.prune();
    const stone = this.waypoints.all().find((w) => w.id === id);
    if (!stone) return null;
    return {
      stone,
      charcoal: this.host.player.inventory.count(WAYPOINT_FUEL_ITEM),
      destinations: this.waypoints.destinations(stone).map((d) => ({ ...d, compass: compassWord(stone.x, stone.z, d.stone.x, d.stone.z) })),
    };
  }

  /** Travel from stone `fromId` to stone `toId`, paying charcoal. Returns an error line, or null when the player stepped through. */
  travel(fromId: number, toId: number): string | null {
    const view = this.waypointView(fromId);
    const d = view?.destinations.find((x) => x.stone.id === toId);
    if (!view || !d) return 'That stone is gone.';
    if (!this.teleport) return 'The stones are quiet here.';
    const p = this.host.player.position;
    if (Math.hypot(p.x - view.stone.x, p.z - view.stone.z) > WAYPOINT_USE_RADIUS + 2) return 'Step back to the stone to travel.';
    if (view.charcoal < d.fuel) return `The trip to ${d.stone.name} needs ${d.fuel} charcoal.`;
    this.host.player.inventory.remove(WAYPOINT_FUEL_ITEM, d.fuel);
    const to = this.waypoints.landing(d.stone);
    const from = this.host.player.position;
    this.host.bus.emit('sfx', { name: 'ignition', x: from.x, y: from.y, z: from.z, pitch: 1.4 });
    this.teleport(to.x, to.y, to.z);
    this.host.bus.emit('sfx', { name: 'upgrade', x: to.x, y: to.y, z: to.z });
    this.toast(`You step through to ${d.stone.name}.`, 'good');
    return null;
  }

  renameStone(id: number, name: string): boolean { return this.waypoints.rename(id, name); }

  /** Marks for the journal map: every waypoint stone, and the landmark circled on each treasure map in the pack (never the chest). */
  mapMarks(): MapMark[] {
    const out: MapMark[] = this.waypoints.all().map((w) => ({ kind: 'waypoint', x: w.x, z: w.z, label: w.name }));
    for (const slot of this.host.player.inventory.toJSON()) {
      if (!slot || slot.item !== MAP_ITEM || !slot.durability) continue;
      const m = this.mapOf(slot);
      if (m) out.push({ kind: 'treasure', x: m.landmark.x, z: m.landmark.z, label: m.landmark.name });
    }
    return out;
  }

  // ---- treasure maps ------------------------------------------------------------------------------

  /** Ruins near (px, pz): the spawn ruin and the grid squares around the player's. */
  landmarksNear(px: number, pz: number): Landmark[] {
    const seed = this.host.world.seed;
    const out: Landmark[] = [];
    const add = (r: ReturnType<typeof spawnRuin>): void => {
      if (!r) return;
      const x = r.x0 + (r.w >> 1);
      const z = r.z0 + (r.d >> 1);
      out.push({ id: `${x},${z}`, name: ruinName(seed, x, z), x, z });
    };
    add(spawnRuin(seed));
    const SQ = RUIN_GRID_CHUNKS * CHUNK_SIZE;
    for (let sx = Math.floor(px / SQ) - 3; sx <= Math.floor(px / SQ) + 3; sx++) {
      for (let sz = Math.floor(pz / SQ) - 3; sz <= Math.floor(pz / SQ) + 3; sz++) add(squareRuin(seed, sx, sz));
    }
    // The hand-placed landmarks (docs/api/landmarks.md) are the best things to circle on a map.
    const SS = STRUCTURE_GRID_CHUNKS * CHUNK_SIZE;
    for (let sx = Math.floor(px / SS) - 3; sx <= Math.floor(px / SS) + 3; sx++) {
      for (let sz = Math.floor(pz / SS) - 3; sz <= Math.floor(pz / SS) + 3; sz++) {
        const st = squareStructure(seed, sx, sz);
        if (st && LANDMARK_KEYS.has(st.def.key)) out.push({ id: st.def.key + ':' + st.x0 + ',' + st.z0, name: 'the ' + st.def.name, x: st.x0 + (st.def.w >> 1), z: st.z0 + (st.def.d >> 1) });
      }
    }
    return out;
  }

  /** The map a stack stands for (assigning its serial on the first read), or null with no landmark to point at. */
  mapOf(stack: ItemStack): TreasureMap | null {
    if (stack.durability === undefined || stack.durability <= 0) {
      stack.durability = ++this.serial * 8 + Math.min(5, Math.max(0, this.host.age()));
      this.host.player.inventory.notifyChanged();
    }
    const serial = Math.floor(stack.durability / 8);
    const age = stack.durability % 8;
    // The search region is fixed by the serial (not by where the map is read), so a map always points at the same place.
    const a = hash32(this.host.world.seed, serial, 0x7ea5) / 4294967296 * Math.PI * 2;
    const r = 120 + (hash32(this.host.world.seed, serial, 0x7ea6) % 500);
    const marks = this.landmarksNear(Math.cos(a) * r, Math.sin(a) * r);
    return makeTreasureMap(this.host.world.seed, serial, age, marks);
  }

  private readMap(held: ItemStack): 'worked' | 'refused' {
    const m = this.mapOf(held);
    if (!m) { this.toast('The map is blank: there are no old ruins within reach to circle.', 'warn'); return 'refused'; }
    const p = this.host.player.position;
    this.toast(`${treasureClue(m)} ${treasureHint(m, p.x, p.z)}`);
    return 'worked';
  }

  /** Buries the chest of every map in the pack once the player is close. */
  private checkMaps(): void {
    const { player, world } = this.host;
    const p = player.position;
    for (const slot of player.inventory.toJSON()) {
      if (!slot || slot.item !== MAP_ITEM || !slot.durability) continue;
      const serial = Math.floor(slot.durability / 8);
      if (this.chests.has(serial)) continue;
      const m = this.mapOf(slot);
      if (!m || Math.hypot(p.x - m.x, p.z - m.z) > CHEST_LOAD_R || !world.isLoaded(m.x, m.z)) continue;
      const sy = world.surfaceY(m.x, m.z);
      if (sy < 1) continue;
      const y = world.getBlock(m.x, sy, m.z).liquid === null ? sy : sy + 1;
      this.chests.add(serial);
      world.setVoxel(m.x, y, m.z, makeVoxel(blockByKey('crate').id), 'load');
      world.setEntity(treasureCrate(m, y));
      this.host.bus.emit('sfx', { name: 'objective', x: m.x, y, z: m.z });
      this.toast('The ground nearby feels disturbed...', 'good');
    }
  }

  // ---- fishing -----------------------------------------------------------------------------------------

  private measure(px: number, py: number, pz: number): WaterSpot | null {
    const { world } = this.host;
    if (world.getBlock(px, py, pz).liquid !== 'water') return null;
    let top = py;
    while (world.getBlock(px, top + 1, pz).liquid === 'water') top++;
    let depth = 0;
    while (world.getBlock(px, top - depth, pz).liquid === 'water') depth++;
    // Horizontal pool size on the surface layer, flood fill capped at 30.
    const seen = new Set<string>([`${px},${pz}`]);
    const queue: Array<[number, number]> = [[px, pz]];
    while (queue.length && seen.size < 30) {
      const [x, z] = queue.shift()!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const k = `${x + dx},${z + dz}`;
        if (!seen.has(k) && world.getBlock(x + dx, top, z + dz).liquid === 'water') { seen.add(k); queue.push([x + dx, z + dz]); }
      }
    }
    return {
      biome: this.host.biomeAt(px, pz), depth, area: seen.size, flowing: isFlowingWater(world.getVoxel(px, top, pz)),
      underground: world.surfaceY(px, pz) > top + 2,
    };
  }

  private ctx(): CastContext {
    return { night: this.host.isNight(), raining: this.host.raining(), ...(this.host.day ? { season: seasonOf(this.host.day()) } : {}) };
  }
  private rng = (): number => (this.host.rng ?? Math.random)();

  private useRod(aim: UseAim | null): 'worked' | 'refused' | null {
    const f = this.fishing;
    if (f.phase === 'bite') return this.land(f);
    if (f.phase === 'waiting') {
      this.fishing = { phase: 'idle' };
      this.toast('You reel in. Nothing yet.');
      return 'worked';
    }
    if (!aim) return null;
    const spot = this.measure(aim.px, aim.py, aim.pz) ?? (aim.block.liquid === 'water' ? this.measure(aim.x, aim.y, aim.z) : null);
    if (!spot) return null;
    const kind = waterKind(spot);
    if (!kind) { this.toast('The water is too shallow to fish.', 'warn'); return 'refused'; }
    this.fishing = { phase: 'waiting', untilS: this.host.now() + biteDelayS(this.ctx(), this.rng), x: aim.px, y: aim.py, z: aim.pz, kind };
    this.toast(`You cast into the ${kind === 'cave' ? 'cave pool' : kind}.`);
    return 'worked';
  }

  private land(f: Extract<Fishing, { phase: 'bite' }>): 'worked' {
    this.fishing = { phase: 'idle' };
    const got = rollCatch(f.kind, this.ctx(), this.rng);
    this.wearRod();
    if (got.item === null) { this.toast('It slips the hook.'); return 'worked'; }
    const left = this.host.player.give(got.item, 1);
    const name = itemOrNull(got.item)?.name ?? got.item;
    this.toast(left > 0 ? `You land a ${name} but your pack is full.` : `You land a ${name}.`, 'good');
    return 'worked';
  }

  private wearRod(): void {
    const held = this.host.player.heldStack();
    if (!held || held.item !== FISHING_ROD) return;
    held.durability = (held.durability ?? 1) - 1;
    if (held.durability <= 0) { this.host.player.consumeHeld(1); this.toast('Your fishing rod snaps.', 'warn'); }
    else this.host.player.inventory.notifyChanged();
  }

  // ---- tick ----------------------------------------------------------------------------------------------

  tick(dt: number): void {
    const f = this.fishing;
    if (f.phase !== 'idle') {
      const p = this.host.player.position;
      if (this.host.player.heldStack()?.item !== FISHING_ROD || Math.hypot(p.x - f.x, p.z - f.z) > CAST_LEASH) {
        this.fishing = { phase: 'idle' };
      } else if (f.phase === 'waiting' && this.host.now() >= f.untilS) {
        this.fishing = { phase: 'bite', untilS: this.host.now() + BITE_WINDOW_S, x: f.x, y: f.y, z: f.z, kind: f.kind };
        this.toast('Something bites! Use the rod now.', 'good');
      } else if (f.phase === 'bite' && this.host.now() >= f.untilS) {
        this.fishing = { phase: 'idle' };
        this.toast('It got away.');
      }
    }
    this.acc += dt;
    if (this.acc >= 1.5) { this.acc = 0; this.checkMaps(); }
  }

  /** For tests and the HUD. */
  get fishingPhase(): Fishing['phase'] { return this.fishing.phase; }
}

/** The buried crate: the map's loot in a crate entity shaped like the simulation's own. */
export function treasureCrate(m: TreasureMap, y: number): BlockEntity {
  const slots: Slot[] = m.loot.map((l) => ({ item: l.item, count: l.count }));
  while (slots.length < CRATE_SIZE) slots.push(null);
  return {
    kind: 'crate', x: m.x, y, z: m.z, on: true, slots, progress: 0, recipe: null, fuelJ: 0, storedJ: 0, coreC: 20, hotS: 0,
    warned: false, alarmS: 0, depthY: y, halted: '', availW: 0, outW: 0, demandW: 0, f: 0,
  };
}
