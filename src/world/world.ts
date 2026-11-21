/**
 * The voxel world: implements IWorld for the rest of the game, owns chunk streaming (streamer.ts), the
 * player's edits (remembered forever, edits.ts) and the block entities (entities.ts), and saves/loads all
 * of it. Voxel data lives on the main thread; generation and meshing run on the worker pool.
 */
import type { GameBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import {
  AIR, CHUNK_SIZE, WORLD_HEIGHT, makeVoxel, voxelId, voxelIndex,
  type BiomeKey, type BlockDef, type BlockEntity, type ChangeSource, type IWorld, type Voxel,
} from '../core/types';
import { chunkCoord, chunkKey, localCoord, type Chunk } from './chunk';
import { EditLog, type EditsSnapshot } from './edits';
import { EntityStore } from './entities';
import { CRATE_VOXEL, ruinCrateEntity } from './ruinCrates';
import { ruinCrateCells } from './ruins';
import { ChunkStreamer, type StreamHost, type StreamStats } from './streamer';
import { WorkerPool, type PoolMode } from './workerPool';
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
  private readonly chunks = new Map<number, Chunk>();
  private readonly edits = new EditLog();
  private readonly entityStore = new EntityStore();
  private currentSeed: number;
  private streamer: ChunkStreamer;
  private readonly host: StreamHost;
  private readonly ownsPool: boolean;
  private readonly offChunkLoaded: () => void;

  constructor(seed: number, readonly bus: GameBus, options: WorldOptions = {}) {
    this.currentSeed = seed >>> 0;
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
    this.offChunkLoaded = bus.on('chunk:loaded', ({ cx, cz }) => this.placeRuinCrates(cx, cz));
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

  // ---- persistence -------------------------------------------------------------------------------

  toJSON(): WorldSnapshot {
    return {
      version: WORLD_SNAPSHOT_VERSION,
      seed: this.currentSeed,
      edits: this.edits.toJSON(),
      entities: JSON.parse(JSON.stringify([...this.entityStore.values()])) as BlockEntity[],
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
    // Parses (and throws) before anything changes.
    this.edits.load(snapshot.edits ?? {});
    this.streamer.unloadAll();
    this.streamer.dispose();
    this.currentSeed = snapshot.seed >>> 0;
    this.entityStore.clear();
    for (const e of snapshot.entities) this.entityStore.set(JSON.parse(JSON.stringify(e)) as BlockEntity);
    this.streamer = new ChunkStreamer(this.host);
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
  }

  /** Stops streaming; disposes the pool if the world created it. */
  dispose(): void {
    this.offChunkLoaded();
    this.streamer.dispose();
    if (this.ownsPool) this.pool.dispose();
  }
}
