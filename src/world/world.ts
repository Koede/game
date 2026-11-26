/**
 * The voxel world: implements IWorld for the rest of the game, owns chunk streaming (streamer.ts), the
 * player's edits (remembered forever, edits.ts) and the block entities (entities.ts), and saves/loads all
 * of it. Voxel data lives on the main thread; generation and meshing run on the worker pool.
 */
import type { GameBus } from '../core/context';
import { mulberry32 } from '../core/math';
import { BLOCKS, blockId } from '../core/registry';
import {
  AIR, CHUNK_SIZE, WORLD_HEIGHT, makeVoxel, voxelId, voxelIndex,
  type BiomeKey, type BlockDef, type BlockEntity, type ChangeSource, type IWorld, type Voxel,
} from '../core/types';
import { chunkCoord, chunkKey, localCoord, type Chunk } from './chunk';
import { EditLog, type EditsSnapshot } from './edits';
import { EntityStore } from './entities';
import { WaterFlow, checkWaterSnapshot, type WaterSnapshot } from './flow';
import { LeafDecay, checkLeafSnapshot, rollLeafDrops, type LeafSnapshot } from './leafDecay';
import { CRATE_VOXEL, ruinCrateEntity, structureCrateEntity } from './ruinCrates';
import { structureCrateCells } from './structures';
import { ruinCrateCells } from './ruins';
import { ChunkStreamer, type StreamHost, type StreamStats } from './streamer';
import { CANOPY, OAK_BROAD, type TreeSite } from './flora';
import {
  STUMP_DAYS, Saplings, daysSince, isTree, logId, plantedTree, saplingId, saplingSpecies, stumpSpecies, stumpSprouts, type Planting,
} from './saplings';
import { growChunk, createGrowthScratch, TreeAges, type GrowthScratch } from './treeGrowth';
import { WorkerPool, type PoolMode } from './workerPool';
import { terrainFor } from './terrain';
import { biomeAt, findSpawn } from './worldgen';

export interface WorldOptions {
  /** Runs generation and meshing. Default: a main-thread pool (pass `new WorkerPool(workerSource)` in the game). */
  pool?: WorkerPool;
}

export const WORLD_SNAPSHOT_VERSION = 1;

/** Everything a save needs to rebuild the world: terrain comes back from the seed, the rest is stored. */
export interface WorldSnapshot {
  version: number;
  seed: number;
  edits: EditsSnapshot;
  entities: BlockEntity[];
  /** Water still on its way (spec 18.2); absent in saves from before flowing water (nothing pending). */
  water?: WaterSnapshot;
  /** Leaves still waiting to decay; absent in saves from before leaf decay. */
  leaves?: LeafSnapshot;
  /** Data other modules keep with the world (World.persist): vehicles. Absent in older saves. */
  extras?: Record<string, unknown>;
}

/** Numbers for a debug overlay. */
export interface WorldStats extends StreamStats {
  /** Chunk columns holding voxel data. */
  loaded: number;
  /** Chunks kept loaded by block entities. */
  pinned: number;
  entities: number;
  edits: number;
  editedChunks: number;
  /** Jobs queued or running in the pool. */
  queued: number;
  mode: PoolMode;
  workers: number;
}

const BELOW_WORLD: Voxel = makeVoxel(blockId('corestone'));
/** Day-change tree growth per frame: always this many chunks (so it finishes even with no budget left)... */
const GROW_MIN_PER_FRAME = 2;
/** ...and up to this many while under GROW_BUDGET_SHARE of the frame budget. */
const GROW_MAX_PER_FRAME = 8;
const GROW_BUDGET_SHARE = 0.25;

export class World implements IWorld {
  readonly pool: WorkerPool;
  /** Flowing water (spec 18.2): the game ticks it at 20 Hz with `water.tick()`; it saves with the world. */
  readonly water: WaterFlow;
  /** Leaf decay: the game ticks it at 20 Hz with `leaves.tick()`; it saves with the world. */
  readonly leaves: LeafDecay;
  private readonly chunks = new Map<number, Chunk>();
  private readonly savers = new Map<string, () => unknown>();
  private loadedExtras: Record<string, unknown> = {};
  private readonly failed: string[] = [];
  private readonly edits = new EditLog();
  private readonly entityStore = new EntityStore();
  private currentSeed: number;
  private streamer: ChunkStreamer;
  private readonly host: StreamHost;
  private readonly ownsPool: boolean;
  private readonly offChunkLoaded: () => void;
  /** Planting day of every tree seen standing (saved under 'treeAges'); growth is worked out from it. */
  private readonly trees = new TreeAges();
  /** Saplings the player planted and stumps waiting to sprout (saved under 'saplings'); growth draws their trees. */
  readonly saplings = new Saplings();
  private readonly growScratch: GrowthScratch = createGrowthScratch();
  /** Voxels the current growth of each loaded chunk wrote (see growChunk); dropped when the chunk unloads. */
  private readonly growthRecords = new Map<number, number[]>();
  private readonly offChunkUnloaded: () => void;
  /** Clock day (1-based) of the world; the tree growth follows it. Default: day 1 forever. */
  private dayOf: () => number = () => 1;
  /** The day the loaded chunks were last grown to. */
  private grownDay = 1;
  /**
   * Chunks still to grow to the new day, nearest the player last (popped first). A day change queues every loaded
   * chunk here and `update` grows a few per frame, so the day change costs no single long frame.
   */
  private growQueue: { cx: number; cz: number }[] = [];

  constructor(seed: number, readonly bus: GameBus, options: WorldOptions = {}) {
    this.currentSeed = seed >>> 0;
    const leafRng = mulberry32(this.currentSeed ^ 0x1eaf);
    this.ownsPool = !options.pool;
    this.pool = options.pool ?? new WorkerPool('');
    const world = this;
    this.host = {
      get seed() {
        return world.currentSeed;
      },
      bus,
      pool: this.pool,
      chunks: this.chunks,
      edits: this.edits,
      entities: this.entityStore,
    };
    this.streamer = new ChunkStreamer(this.host);
    this.water = new WaterFlow({
      chunk: (cx, cz) => this.chunks.get(chunkKey(cx, cz))?.voxels ?? null,
      setVoxel: (x, y, z, voxel, source) => this.setVoxel(x, y, z, voxel, source),
    });
    this.leaves = new LeafDecay({
      getVoxel: (x, y, z) => this.getVoxel(x, y, z),
      isLoaded: (x, z) => this.isLoaded(x, z),
      setVoxel: (x, y, z, voxel, source) => this.setVoxel(x, y, z, voxel, source),
      decayed: (x, y, z, voxel) => this.bus.emit('leaves:decayed', { x, y, z, voxel, drops: rollLeafDrops(voxel, leafRng) }),
    }, leafRng);
    this.offChunkLoaded = bus.on('chunk:loaded', ({ cx, cz }) => {
      this.placeRuinCrates(cx, cz);
      this.water.chunkLoaded(cx, cz);
      this.growChunkAt(cx, cz);
    });
    this.offChunkUnloaded = bus.on('chunk:unloaded', ({ cx, cz }) => this.growthRecords.delete(chunkKey(cx, cz)));
    this.persist('treeAges', () => this.trees.toJSON());
    this.persist('saplings', () => this.saplings.toJSON());
  }

  /** Tells the world what clock day it is (trees grow a day at a time). The game calls this once it has its clock. */
  setDayProvider(day: () => number): void {
    this.dayOf = day;
    this.grownDay = day();
  }

  /** Restores a world from a snapshot (see load). */
  static fromJSON(snapshot: WorldSnapshot, bus: GameBus, options: WorldOptions = {}): World {
    const world = new World(snapshot.seed, bus, options);
    world.load(snapshot);
    return world;
  }

  get seed(): number {
    return this.currentSeed;
  }

  // ---- IWorld ------------------------------------------------------------------------------------

  getVoxel(x: number, y: number, z: number): Voxel {
    if (y < 0) return BELOW_WORLD;
    if (y >= WORLD_HEIGHT) return AIR;
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    const chunk = this.chunks.get(chunkKey(chunkCoord(bx), chunkCoord(bz)));
    return chunk ? chunk.voxels[voxelIndex(localCoord(bx), Math.floor(y), localCoord(bz))] : AIR;
  }

  getBlock(x: number, y: number, z: number): BlockDef {
    return BLOCKS[voxelId(this.getVoxel(x, y, z))] ?? BLOCKS[0];
  }

  setVoxel(x: number, y: number, z: number, voxel: Voxel, source: ChangeSource = 'player'): boolean {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    const bz = Math.floor(z);
    if (by < 0 || by >= WORLD_HEIGHT) return false;
    const cx = chunkCoord(bx);
    const cz = chunkCoord(bz);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;
    const lx = localCoord(bx);
    const lz = localCoord(bz);
    const index = voxelIndex(lx, by, lz);
    const from = chunk.voxels[index];
    if (from === voxel) return true;
    chunk.voxels[index] = voxel;
    this.edits.record(cx, cz, index, voxel);
    this.streamer.onEdit(chunk, lx, lz, from, voxel, source);
    this.bus.emit('block:changed', { x: bx, y: by, z: bz, from, to: voxel, source });
    this.water.changed(bx, by, bz, from, voxel, source);
    this.leaves.changed(bx, by, bz, from, voxel, source);
    if (source !== 'load') this.trackSaplings(bx, by, bz, voxel);
    return true;
  }

  isLoaded(x: number, z: number): boolean {
    return this.chunks.has(chunkKey(chunkCoord(Math.floor(x)), chunkCoord(Math.floor(z))));
  }

  surfaceY(x: number, z: number): number {
    const bx = Math.floor(x);
    const bz = Math.floor(z);
    const chunk = this.chunks.get(chunkKey(chunkCoord(bx), chunkCoord(bz)));
    return chunk ? chunk.surfaceY(localCoord(bx), localCoord(bz)) : -1;
  }

  getEntity(x: number, y: number, z: number): BlockEntity | undefined {
    return this.entityStore.get(x, y, z);
  }

  setEntity(entity: BlockEntity): void {
    if (this.entityStore.set(entity)) this.streamer.pinsChanged();
  }

  removeEntity(x: number, y: number, z: number): BlockEntity | undefined {
    const { entity, changed } = this.entityStore.remove(x, y, z);
    if (changed) this.streamer.pinsChanged();
    return entity;
  }

  entities(): Iterable<BlockEntity> {
    return this.entityStore.values();
  }

  // ---- streaming ---------------------------------------------------------------------------------

  /**
   * Call once per frame, after the player's controls have run. Re-meshes chunks the player edited (on
   * this thread, so the change shows this frame), hides and unloads far chunks, starts generate/mesh
   * jobs nearest first, and in main-thread mode runs jobs for what is left of `budgetMs`.
   */
  update(playerX: number, playerZ: number, renderDistance: number, budgetMs: number): void {
    const start = performance.now();
    const day = this.dayOf();
    if (day !== this.grownDay) {
      this.grownDay = day;
      this.queueGrowth(playerX, playerZ);
    }
    this.pumpGrowth(start, budgetMs);
    this.streamer.update(playerX, playerZ, renderDistance, budgetMs - (performance.now() - start));
  }

  /** Chunks still waiting to grow to the current day (0 once a day change has been worked through). */
  pendingGrowth(): number {
    return this.growQueue.length;
  }

  /** Grows every queued chunk now (a loading screen, a test): the same voxels the per-frame pump arrives at. */
  finishGrowth(): void {
    while (this.growQueue.length > 0) {
      const next = this.growQueue.pop()!;
      this.growChunkAt(next.cx, next.cz);
    }
  }

  /**
   * Queues every loaded chunk to grow to the new day, nearest the player first. Growing a chunk grows it to the
   * current day whenever it runs, and a chunk loaded meanwhile grows on load, so a later day change simply
   * replaces the queue. Each chunk writes only its own voxels, so the order does not change the result.
   */
  private queueGrowth(playerX: number, playerZ: number): void {
    const px = chunkCoord(Math.floor(playerX));
    const pz = chunkCoord(Math.floor(playerZ));
    const dist = (c: { cx: number; cz: number }): number => (c.cx - px) ** 2 + (c.cz - pz) ** 2;
    this.growQueue = [...this.chunks.values()].map((c) => ({ cx: c.cx, cz: c.cz })).sort((a, b) => dist(b) - dist(a));
  }

  /** Grows queued chunks: at least GROW_MIN_PER_FRAME, then more while under a share of the frame budget. */
  private pumpGrowth(start: number, budgetMs: number): void {
    let done = 0;
    while (this.growQueue.length > 0 && done < GROW_MAX_PER_FRAME) {
      if (done >= GROW_MIN_PER_FRAME && performance.now() - start >= budgetMs * GROW_BUDGET_SHARE) break;
      const next = this.growQueue.pop()!;
      this.growChunkAt(next.cx, next.cz);
      done++;
    }
  }

  /** Generates, on this thread and right now, every missing chunk within `radiusChunks` of (x, z). */
  ensureLoadedAround(x: number, z: number, radiusChunks: number): void {
    this.streamer.ensureLoaded(chunkCoord(Math.floor(x)), chunkCoord(Math.floor(z)), Math.max(0, Math.floor(radiusChunks)));
  }

  /** True once every chunk in view within `radiusChunks` of (x, z) has been meshed (for a loading screen). */
  isReadyAround(x: number, z: number, radiusChunks: number): boolean {
    return this.streamer.isReady(chunkCoord(Math.floor(x)), chunkCoord(Math.floor(z)), Math.max(0, Math.floor(radiusChunks)));
  }

  /** The live voxel array of a loaded chunk (index with voxelIndex), or null. Read it; change voxels with setVoxel. */
  chunkVoxels(cx: number, cz: number): Uint16Array | null {
    return this.chunks.get(chunkKey(cx, cz))?.voxels ?? null;
  }

  /** Where a new player starts: feet block of a dry woodland spot (stand at x + 0.5, z + 0.5). */
  spawnPoint(): { x: number; y: number; z: number } {
    return findSpawn(this.currentSeed);
  }

  biomeAt(x: number, z: number): BiomeKey {
    return biomeAt(this.currentSeed, x, z);
  }

  stats(): WorldStats {
    return {
      ...this.streamer.stats(),
      loaded: this.chunks.size,
      pinned: this.entityStore.pinnedChunks,
      entities: this.entityStore.size,
      edits: this.edits.count,
      editedChunks: this.edits.chunkCount,
      queued: this.pool.pending,
      mode: this.pool.mode,
      workers: this.pool.workerCount,
    };
  }

  /**
   * Lets a module save its own data with the world: `save()` is called by every `toJSON` and its result stored under
   * `key` (JSON-safe). What a loaded save held under `key` is `extra(key)`. Returns the unregister function.
   */
  persist(key: string, save: () => unknown): () => void {
    this.savers.set(key, save);
    return () => {
      if (this.savers.get(key) === save) this.savers.delete(key);
    };
  }

  /** What the world snapshot this world was loaded from held under `key` (a copy), or undefined. */
  extra(key: string): unknown {
    const v = this.loadedExtras[key];
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  /**
   * Loads module data saved under `key` with `fn(raw)`, fail-soft: a throwing load is reported (`failedExtras`), the
   * module starts empty, and the unreadable data is kept under `<key>.bad` (written back with every save), so a
   * damaged module can never be silently overwritten by an empty one. Returns false when the load failed.
   */
  loadExtra(key: string, fn: (raw: unknown) => void): boolean {
    const raw = this.extra(key);
    if (raw === undefined) return true;
    try {
      fn(raw);
      return true;
    } catch (err) {
      console.error(`[save] ${key} could not be loaded; a copy was kept as ${key}.bad`, err);
      this.loadedExtras[`${key}.bad`] = raw;
      this.failed.push(key);
      return false;
    }
  }

  /** Module keys whose saved data could not be loaded (see loadExtra). */
  failedExtras(): readonly string[] {
    return this.failed;
  }

  // ---- persistence -------------------------------------------------------------------------------

  /**
   * The world as plain data. Entities are deep copies, unless `shared` is set: then they are the live entity objects,
   * for a caller that serialises the snapshot straight away (an autosave; copying first would serialise them twice).
   */
  toJSON(options?: { shared?: boolean }): WorldSnapshot {
    const live = [...this.entityStore.values()];
    const extras: Record<string, unknown> = { ...this.loadedExtras };
    for (const [key, save] of this.savers) extras[key] = save();
    return {
      version: WORLD_SNAPSHOT_VERSION,
      seed: this.currentSeed,
      edits: this.edits.toJSON(),
      entities: options?.shared === true ? live : (JSON.parse(JSON.stringify(live)) as BlockEntity[]),
      water: this.water.toJSON(),
      leaves: this.leaves.toJSON(),
      extras,
    };
  }

  /**
   * Replaces the whole world with a snapshot: every chunk is hidden and unloaded ('chunk:hidden',
   * 'chunk:unloaded'), then streaming starts over with the snapshot's seed, edits and entities.
   * Throws on a malformed snapshot without changing anything.
   */
  load(snapshot: WorldSnapshot): void {
    if (!snapshot || typeof snapshot.seed !== 'number' || !Array.isArray(snapshot.entities)) throw new Error('world: malformed snapshot');
    if (snapshot.version > WORLD_SNAPSHOT_VERSION) throw new Error(`world: snapshot version ${snapshot.version} is newer than this game`);
    for (const e of snapshot.entities) {
      if (!e || typeof e.kind !== 'string' || ![e.x, e.y, e.z].every(Number.isFinite)) throw new Error('world: malformed entity in snapshot');
    }
    // Parses (and throws) before anything changes. Damaged pending water only costs the water still on its way.
    let water = snapshot.water;
    try {
      checkWaterSnapshot(water);
    } catch (err) {
      console.warn('[world] pending water could not be restored; it rests where it is', err);
      water = undefined;
    }
    let leaves = snapshot.leaves;
    try {
      checkLeafSnapshot(leaves);
    } catch (err) {
      console.warn('[world] pending leaf decay could not be restored', err);
      leaves = undefined;
    }
    this.edits.load(snapshot.edits ?? {});
    this.streamer.unloadAll();
    this.streamer.dispose();
    this.currentSeed = snapshot.seed >>> 0;
    this.entityStore.clear();
    for (const e of snapshot.entities) this.entityStore.set(JSON.parse(JSON.stringify(e)) as BlockEntity);
    this.water.load(water);
    this.leaves.load(leaves);
    this.loadedExtras = snapshot.extras && typeof snapshot.extras === 'object' ? JSON.parse(JSON.stringify(snapshot.extras)) : {};
    // Older saves have no tree ages: their trees count as planted on the day they are first seen (age 0).
    this.trees.clear();
    this.growthRecords.clear();
    this.growQueue = [];
    this.loadExtra('treeAges', (raw) => this.trees.load(raw));
    this.saplings.clear();
    this.loadExtra('saplings', (raw) => this.saplings.load(raw));
    this.streamer = new ChunkStreamer(this.host);
    this.grownDay = this.dayOf();
  }

  /** Grows the trees reaching chunk (cx, cz) to the current day; the grown voxels are not edits and are not saved. */
  private growChunkAt(cx: number, cz: number): void {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return;
    const key = chunkKey(cx, cz);
    const record = this.growthRecords.get(key) ?? [];
    const day = this.dayOf();
    const planted = this.plantedTrees(cx, cz, day);
    growChunk(terrainFor(this.currentSeed), cx, cz, chunk.voxels, day, this.trees, {
      standing: (s, top) => this.treeStanding(s, top),
      blocked: (index) => this.edits.has(cx, cz, index),
      changed: (index, from, to) => this.streamer.onEdit(chunk, index & (CHUNK_SIZE - 1), (index >> 4) & (CHUNK_SIZE - 1), from, to, 'load'),
    }, this.growScratch, record, planted);
    if (record.length > 0) this.growthRecords.set(key, record);
    else this.growthRecords.delete(key);
  }

  /**
   * A sapling placed (or sprouted) is planted today; a felling stump starts its wait to sprout. A planting or stump
   * whose cell becomes anything else (broken, felled, built over) is forgotten.
   */
  private trackSaplings(x: number, y: number, z: number, voxel: Voxel): void {
    const p = this.saplings.plantingAt(x, y, z);
    if (p && voxelId(voxel) !== saplingId(p.species) && voxelId(voxel) !== logId(p.species)) this.saplings.unplant(x, y, z);
    const st = this.saplings.stumpAt(x, y, z);
    if (st && stumpSpecies(voxel) !== st.species) this.saplings.removeStump(x, y, z);
    const sapling = saplingSpecies(voxel);
    if (sapling >= 0 && !this.saplings.plantingAt(x, y, z)) this.saplings.plant(x, y, z, sapling, this.dayOf());
    const stump = stumpSpecies(voxel);
    if (stump >= 0 && !this.saplings.stumpAt(x, y, z)) this.saplings.addStump(x, y, z, stump, this.dayOf());
  }

  /**
   * The planted trees growth draws into chunk (cx, cz) on `day`. First the chunk's own cells move on: a stump whose
   * wait is over sprouts a sapling (if it is one that sprouts, and nothing sits on it) or is forgotten, a planting
   * whose cell no longer holds its sapling or log is forgotten, and a planting that has become a tree turns its
   * sapling into the root log (an edit, like any placed block).
   */
  private plantedTrees(cx: number, cz: number, day: number): TreeSite[] {
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;
    const x1 = x0 + CHUNK_SIZE - 1;
    const z1 = z0 + CHUNK_SIZE - 1;
    for (const st of this.saplings.stumpsIn(x0, z0, x1, z1)) {
      if (daysSince(st, day) < STUMP_DAYS) continue;
      this.saplings.removeStump(st.x, st.y, st.z);
      if (stumpSpecies(this.getVoxel(st.x, st.y, st.z)) !== st.species) continue;
      if (!stumpSprouts(this.currentSeed, st.x, st.y, st.z) || this.getVoxel(st.x, st.y + 1, st.z) !== AIR) continue;
      if (!BLOCKS[saplingId(st.species)].placeOn?.includes(this.getBlock(st.x, st.y - 1, st.z).key)) continue;
      this.setVoxel(st.x, st.y, st.z, makeVoxel(saplingId(st.species)), 'sim');
      // Planted on the day the wait ended, so a chunk loaded late shows the tree it would have grown by now.
      this.saplings.plant(st.x, st.y, st.z, st.species, st.day + STUMP_DAYS);
    }
    for (const p of this.saplings.plantsNear(x0, z0, x1, z1, 0)) {
      const id = voxelId(this.getVoxel(p.x, p.y, p.z));
      if (id !== saplingId(p.species) && id !== logId(p.species)) this.saplings.unplant(p.x, p.y, p.z);
      else if (isTree(p, day) && id === saplingId(p.species)) this.setVoxel(p.x, p.y, p.z, makeVoxel(logId(p.species)), 'sim');
    }
    const out: TreeSite[] = [];
    for (const p of this.saplings.plantsNear(x0, z0, x1, z1, CANOPY)) {
      const tree = plantedTree(p, day);
      if (tree && this.plantedStanding(p, tree)) out.push(tree);
    }
    return out;
  }

  /**
   * A planted tree stands while its root cell holds its sapling or log (when that chunk is loaded) and nothing above
   * the root up to the grown top was ever edited.
   */
  private plantedStanding(p: Planting, tree: TreeSite): boolean {
    if (this.isLoaded(p.x, p.z)) {
      const id = voxelId(this.getVoxel(p.x, p.y, p.z));
      if (id !== saplingId(p.species) && id !== logId(p.species)) return false;
    }
    const cx = chunkCoord(p.x);
    const cz = chunkCoord(p.z);
    for (let y = p.y + 1; y <= tree.base + tree.trunk; y++) {
      if (this.edits.has(cx, cz, voxelIndex(localCoord(p.x), y, localCoord(p.z)))) return false;
    }
    return true;
  }

  /** True when the voxel at (x, y, z) was ever changed (edits.ts): the town builder leaves such cells alone. */
  wasEdited(x: number, y: number, z: number): boolean {
    return this.edits.has(chunkCoord(x), chunkCoord(z), voxelIndex(localCoord(x), y, localCoord(z)));
  }

  /** A tree stands while no voxel from its ground up to `top` was ever edited (felled, chopped or decayed). */
  private treeStanding(s: TreeSite, top: number): boolean {
    const columns = s.kind === OAK_BROAD ? 4 : 1;
    for (let k = 0; k < columns; k++) {
      const x = s.x + (k & 1);
      const z = s.z + (k >> 1);
      const cx = chunkCoord(x);
      const cz = chunkCoord(z);
      for (let y = s.base + 1; y <= top; y++) {
        if (this.edits.has(cx, cz, voxelIndex(localCoord(x), y, localCoord(z)))) return false;
      }
    }
    return true;
  }

  /**
   * The Old Works crates of a freshly loaded chunk: placed through the entity API with their loot the first
   * time only. Once placed (or once anything else happened to that cell) the edit log remembers it.
   */
  private placeRuinCrates(cx: number, cz: number): void {
    for (const { x, y, z } of ruinCrateCells(this.currentSeed, cx, cz)) {
      if (this.edits.has(cx, cz, voxelIndex(localCoord(x), y, localCoord(z))) || this.entityStore.get(x, y, z)) continue;
      if (this.getVoxel(x, y, z) !== AIR) continue;
      this.setEntity(ruinCrateEntity(this.currentSeed, x, y, z, this.spawnPoint()));
      this.setVoxel(x, y, z, CRATE_VOXEL, 'load');
    }
    for (const { x, y, z, key } of structureCrateCells(this.currentSeed, cx, cz)) {
      if (this.edits.has(cx, cz, voxelIndex(localCoord(x), y, localCoord(z))) || this.entityStore.get(x, y, z)) continue;
      if (this.getVoxel(x, y, z) !== AIR) continue;
      this.setEntity(structureCrateEntity(this.currentSeed, x, y, z, key));
      this.setVoxel(x, y, z, CRATE_VOXEL, 'load');
    }
  }

  /** Stops streaming; disposes the pool if the world created it. */
  dispose(): void {
    this.offChunkLoaded();
    this.offChunkUnloaded();
    this.streamer.dispose();
    if (this.ownsPool) this.pool.dispose();
  }
}
