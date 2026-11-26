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
import { CRATE_VOXEL, ruinCrateEntity, structureCrateEntity, tableCrateEntity } from './ruinCrates';
import { structureCrateCells } from './structures';
import { caveBandAt, caveCampTable, findCaveCamp } from './caveRooms';
import { ruinCrateCells } from './ruins';
import { ChunkStreamer, type StreamHost, type StreamStats } from './streamer';
import { OAK_BROAD, type TreeSite } from './flora';
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
  private readonly growScratch: GrowthScratch = createGrowthScratch();
  /** Voxels the current growth of each loaded chunk wrote (see growChunk); dropped when the chunk unloads. */
  private readonly growthRecords = new Map<number, number[]>();
  private readonly offChunkUnloaded: () => void;
  /** Clock day (1-based) of the world; the tree growth follows it. Default: day 1 forever. */
  private dayOf: () => number = () => 1;
  /** The day the loaded chunks were last grown to. */
  private grownDay = 1;

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
    const day = this.dayOf();
    if (day !== this.grownDay) {
      this.grownDay = day;
      for (const chunk of this.chunks.values()) this.growChunkAt(chunk.cx, chunk.cz);
    }
    this.streamer.update(playerX, playerZ, renderDistance, budgetMs);
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
    this.loadExtra('treeAges', (raw) => this.trees.load(raw));
    this.streamer = new ChunkStreamer(this.host);
    this.grownDay = this.dayOf();
  }

  /** Grows the trees reaching chunk (cx, cz) to the current day; the grown voxels are not edits and are not saved. */
  private growChunkAt(cx: number, cz: number): void {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return;
    const key = chunkKey(cx, cz);
    const record = this.growthRecords.get(key) ?? [];
    growChunk(terrainFor(this.currentSeed), cx, cz, chunk.voxels, this.dayOf(), this.trees, {
      standing: (s, top) => this.treeStanding(s, top),
      blocked: (index) => this.edits.has(cx, cz, index),
      changed: (index, from, to) => this.streamer.onEdit(chunk, index & (CHUNK_SIZE - 1), (index >> 4) & (CHUNK_SIZE - 1), from, to, 'load'),
    }, this.growScratch, record);
    if (record.length > 0) this.growthRecords.set(key, record);
    else this.growthRecords.delete(key);
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
    // A cave camp's crate is a generated voxel with no entity yet (the first load gives it its loot, by the camp's depth band).
    const camp = findCaveCamp(this.currentSeed, cx, cz, (x, y, z) => voxelId(this.getVoxel(x, y, z)));
    if (camp && !this.edits.has(cx, cz, voxelIndex(localCoord(camp.x), camp.y, localCoord(camp.z))) && !this.entityStore.get(camp.x, camp.y, camp.z)) {
      this.setEntity(tableCrateEntity(this.currentSeed, camp.x, camp.y, camp.z, caveCampTable(caveBandAt(camp.y))));
      this.setVoxel(camp.x, camp.y, camp.z, CRATE_VOXEL, 'load');
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
