/**
 * Chunk streaming for World: which chunks to generate, mesh, hide and unload around the player, nearest
 * first, through the worker pool. Player edits re-mesh their chunk synchronously on the next update();
 * lighting changes ripple to neighbours asynchronously, and only to those whose last mesh saw different
 * light along the shared border (lighting.borderHashes).
 */
import type { GameBus } from '../core/context';
import { CHUNK_SIZE, voxelId, type ChangeSource, type Voxel } from '../core/types';
import { Chunk, SIDE_DX, SIDE_DZ, SIDE_OPPOSITE, chunkCoord, chunkKey, keyChunkX, keyChunkZ } from './chunk';
import type { EditLog } from './edits';
import type { EntityStore } from './entities';
import { runJob, type MeshResult } from './jobs';
import type { WorkerPool } from './workerPool';
import { inData, inView, planFor, shown, type ViewPlan } from './view';
import { generateChunk } from './worldgen';

/** Voxel data stays loaded up to this many chunks (Chebyshev) past the view distance. */
export const UNLOAD_MARGIN = 3;
export const MAX_RENDER_DISTANCE = 32;

/** What the streamer needs from its World. */
export interface StreamHost {
  readonly seed: number;
  readonly bus: GameBus;
  readonly pool: WorkerPool;
  readonly chunks: Map<number, Chunk>;
  readonly edits: EditLog;
  readonly entities: EntityStore;
}

export interface StreamStats {
  /** Chunks drawn (a mesh was handed to the renderer and not hidden since). */
  meshed: number;
  generating: number;
  meshing: number;
  /** Chunks waiting for an urgent (edit or lighting) re-mesh. */
  urgent: number;
  /** Average milliseconds of the last generate / mesh jobs where they ran. */
  generateMs: number;
  meshMs: number;
}

const average = (prev: number, next: number): number => (prev === 0 ? next : prev * 0.9 + next * 0.1);

export class ChunkStreamer {
  private cx = 0;
  private cz = 0;
  /** Render distance of the current plan; -1 until the first update. */
  private r = -1;
  private plan: ViewPlan = { offsets: new Int16Array(0), view: new Uint8Array(0) };
  private readonly generating = new Set<number>();
  /** Chunks whose generation threw: not retried this session, so a bug cannot spin forever. */
  private readonly failed = new Set<number>();
  private readonly urgent = new Set<number>();
  private readonly syncNow = new Set<number>();
  /** Nothing to schedule until something changes. */
  private idle = false;
  private retireNeeded = true;
  private meshJobs = 0;
  private meshedCount = 0;
  private generateMs = 0;
  private meshMs = 0;
  private alive = true;

  constructor(private readonly host: StreamHost) {}

  update(playerX: number, playerZ: number, renderDistance: number, budgetMs: number): void {
    const start = performance.now();
    const r = Math.max(1, Math.min(MAX_RENDER_DISTANCE, Math.round(renderDistance)));
    const cx = chunkCoord(Math.floor(playerX));
    const cz = chunkCoord(Math.floor(playerZ));
    if (r !== this.r) {
      this.r = r;
      this.plan = planFor(r);
      this.retireNeeded = true;
    }
    if (cx !== this.cx || cz !== this.cz) {
      this.cx = cx;
      this.cz = cz;
      this.retireNeeded = true;
    }
    if (this.retireNeeded) {
      this.retireNeeded = false;
      this.idle = false;
      this.retire();
    }
    this.flushSync();
    if (!this.idle) this.schedule();
    this.host.pool.pump(budgetMs - (performance.now() - start));
  }

  /** A voxel of a loaded chunk changed: mark what must be re-meshed. */
  onEdit(chunk: Chunk, lx: number, lz: number, from: Voxel, to: Voxel, source: ChangeSource): void {
    const sync = source === 'player';
    this.touch(chunk, sync);
    if (voxelId(from) !== voxelId(to)) {
      // Faces, ambient occlusion and cable arms of the neighbours along a border depend on this cell.
      const ex = lx === CHUNK_SIZE - 1 ? 1 : lx === 0 ? -1 : 0;
      const ez = lz === CHUNK_SIZE - 1 ? 1 : lz === 0 ? -1 : 0;
      if (ex !== 0) this.touchAt(chunk.cx + ex, chunk.cz, sync);
      if (ez !== 0) this.touchAt(chunk.cx, chunk.cz + ez, sync);
      if (ex !== 0 && ez !== 0) this.touchAt(chunk.cx + ex, chunk.cz + ez, false);
    }
    if (!this.wantsMesh(chunk)) {
      // An undrawn chunk has no border light to compare after its re-mesh: refresh the drawn neighbours.
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const n = this.host.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz));
          if (n && n !== chunk && n.meshed) this.markDirty(n, true);
        }
      }
    }
  }

  /** Entities were added or removed: pinned chunks may now need loading or may be unloaded. */
  pinsChanged(): void {
    this.retireNeeded = true;
    this.idle = false;
  }

  /** Generates every missing chunk within `radius` chunks (Chebyshev) of chunk (cx, cz) right now. */
  ensureLoaded(cx0: number, cz0: number, radius: number): void {
    for (let cz = cz0 - radius; cz <= cz0 + radius; cz++) {
      for (let cx = cx0 - radius; cx <= cx0 + radius; cx++) {
        if (!this.host.chunks.has(chunkKey(cx, cz))) this.add(cx, cz, generateChunk(this.host.seed, cx, cz));
      }
    }
  }

  /** True once every chunk in view within `radius` chunks of chunk (cx, cz) has been drawn. */
  isReady(cx0: number, cz0: number, radius: number): boolean {
    if (this.r < 0) return false;
    for (let cz = cz0 - radius; cz <= cz0 + radius; cz++) {
      for (let cx = cx0 - radius; cx <= cx0 + radius; cx++) {
        if (!inView(cx - this.cx, cz - this.cz, this.r)) continue;
        if (!this.host.chunks.get(chunkKey(cx, cz))?.meshed) return false;
      }
    }
    return true;
  }

  stats(): StreamStats {
    return {
      meshed: this.meshedCount,
      generating: this.generating.size,
      meshing: this.meshJobs,
      urgent: this.urgent.size,
      generateMs: this.generateMs,
      meshMs: this.meshMs,
    };
  }

  /** Stops reacting to job results (the World loaded a save and started a new streamer). */
  dispose(): void {
    this.alive = false;
  }

  /** Hides every drawn chunk and forgets all voxel data. */
  unloadAll(): void {
    for (const chunk of this.host.chunks.values()) this.unload(chunk);
  }

  // ---------------------------------------------------------------------------------------------

  private wantsMesh(chunk: Chunk): boolean {
    return chunk.meshed || (this.r > 0 && inView(chunk.cx - this.cx, chunk.cz - this.cz, this.r));
  }

  private touch(chunk: Chunk, sync: boolean): void {
    this.markDirty(chunk, !sync);
    if (sync) this.syncNow.add(chunk.key);
  }

  private touchAt(cx: number, cz: number, sync: boolean): void {
    const chunk = this.host.chunks.get(chunkKey(cx, cz));
    if (chunk) this.touch(chunk, sync);
  }

  private markDirty(chunk: Chunk, urgent: boolean): void {
    chunk.dirty = true;
    if (urgent) this.urgent.add(chunk.key);
    this.idle = false;
  }

  private retire(): void {
    const r = this.r;
    for (const chunk of this.host.chunks.values()) {
      const dx = chunk.cx - this.cx;
      const dz = chunk.cz - this.cz;
      if (Math.max(Math.abs(dx), Math.abs(dz)) > r + UNLOAD_MARGIN && !this.host.entities.isPinned(chunk.key)) this.unload(chunk);
      else if (chunk.meshed && !shown(dx, dz, r)) this.hide(chunk);
    }
  }

  private hide(chunk: Chunk): void {
    chunk.meshed = false;
    chunk.dirty = true;
    this.meshedCount--;
    this.host.bus.emit('chunk:hidden', { cx: chunk.cx, cz: chunk.cz });
  }

  private unload(chunk: Chunk): void {
    if (chunk.meshed) this.hide(chunk);
    this.host.chunks.delete(chunk.key);
    this.urgent.delete(chunk.key);
    this.syncNow.delete(chunk.key);
    this.host.bus.emit('chunk:unloaded', { cx: chunk.cx, cz: chunk.cz });
  }

  private add(cx: number, cz: number, voxels: Uint16Array): void {
    const chunk = new Chunk(cx, cz, voxels);
    this.host.edits.apply(cx, cz, voxels);
    this.host.chunks.set(chunk.key, chunk);
    this.idle = false;
    this.host.bus.emit('chunk:loaded', { cx, cz });
  }

  private neighboursLoaded(chunk: Chunk): boolean {
    const chunks = this.host.chunks;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) if ((dx !== 0 || dz !== 0) && !chunks.has(chunkKey(chunk.cx + dx, chunk.cz + dz))) return false;
    }
    return true;
  }

  private neighbourhood(chunk: Chunk): (Uint16Array | null)[] {
    const out: (Uint16Array | null)[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) out.push(this.host.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz))?.voxels ?? null);
    }
    return out;
  }

  /** Player edits: re-mesh on this thread now so the change is on screen this frame. */
  private flushSync(): void {
    for (const key of this.syncNow) {
      const chunk = this.host.chunks.get(key);
      if (!chunk || !chunk.dirty) continue;
      if (this.wantsMesh(chunk) && this.neighboursLoaded(chunk)) {
        chunk.dirty = false;
        chunk.epoch++;
        const result = runJob({ type: 'mesh', cx: chunk.cx, cz: chunk.cz, chunks: this.neighbourhood(chunk) });
        this.meshMs = average(this.meshMs, result.ms);
        this.publish(chunk, result);
      } else {
        this.urgent.add(key);
      }
    }
    this.syncNow.clear();
  }

  private schedule(): void {
    const pool = this.host.pool;
    const chunks = this.host.chunks;
    let room = pool.capacity - pool.pending;
    if (room <= 0) return;
    for (const key of this.urgent) {
      const chunk = chunks.get(key);
      if (chunk?.meshing) continue;
      this.urgent.delete(key);
      if (!chunk || !chunk.dirty || !this.wantsMesh(chunk) || !this.neighboursLoaded(chunk)) continue;
      this.startMesh(chunk);
      if (--room <= 0) return;
    }
    const { offsets, view } = this.plan;
    for (let i = 0; i < view.length; i++) {
      const cx = this.cx + offsets[i * 2];
      const cz = this.cz + offsets[i * 2 + 1];
      const key = chunkKey(cx, cz);
      const chunk = chunks.get(key);
      if (!chunk) {
        if (this.generating.has(key) || this.failed.has(key)) continue;
        this.startGenerate(cx, cz, key);
      } else if (view[i] === 1 && chunk.dirty && !chunk.meshing && this.neighboursLoaded(chunk)) {
        this.startMesh(chunk);
      } else {
        continue;
      }
      if (--room <= 0) return;
    }
    for (const key of this.host.entities.pinnedKeys()) {
      if (chunks.has(key) || this.generating.has(key) || this.failed.has(key)) continue;
      this.startGenerate(keyChunkX(key), keyChunkZ(key), key);
      if (--room <= 0) return;
    }
    this.idle = true;
  }

  private keepsData(cx: number, cz: number, key: number, margin: number): boolean {
    const dx = cx - this.cx;
    const dz = cz - this.cz;
    const near = margin > 0 ? Math.max(Math.abs(dx), Math.abs(dz)) <= this.r + margin : inData(dx, dz, this.r);
    return near || this.host.entities.isPinned(key);
  }

  private startGenerate(cx: number, cz: number, key: number): void {
    this.generating.add(key);
    const job = { type: 'generate', seed: this.host.seed, cx, cz } as const;
    this.host.pool.run(job, () => this.alive && this.keepsData(cx, cz, key, 0)).then(
      (result) => {
        if (!this.alive) return;
        this.generating.delete(key);
        this.idle = false;
        if (!result) return;
        this.generateMs = average(this.generateMs, result.ms);
        if (!this.host.chunks.has(key) && this.keepsData(cx, cz, key, UNLOAD_MARGIN)) this.add(cx, cz, result.voxels);
        this.refill();
      },
      (err: Error) => {
        if (!this.alive) return;
        this.generating.delete(key);
        this.failed.add(key);
        console.error(`[world] generating chunk ${cx},${cz} failed`, err);
      },
    );
  }

  private startMesh(chunk: Chunk): void {
    chunk.dirty = false;
    chunk.meshing = true;
    const epoch = ++chunk.epoch;
    this.meshJobs++;
    const job = { type: 'mesh', cx: chunk.cx, cz: chunk.cz, chunks: this.neighbourhood(chunk) } as const;
    const current = (): boolean => this.alive && this.host.chunks.get(chunk.key) === chunk;
    this.host.pool.run(job, () => current() && this.wantsMesh(chunk)).then(
      (result) => {
        this.meshJobs--;
        chunk.meshing = false;
        if (!current()) return;
        this.idle = false;
        if (!result) {
          chunk.dirty = true;
          return;
        }
        this.meshMs = average(this.meshMs, result.ms);
        // A newer mesh (a synchronous one after an edit) already replaced this one.
        if (chunk.epoch === epoch) {
          if (!this.wantsMesh(chunk)) chunk.dirty = true;
          else this.publish(chunk, result);
        }
        this.refill();
      },
      (err: Error) => {
        this.meshJobs--;
        chunk.meshing = false;
        console.error(`[world] meshing chunk ${chunk.cx},${chunk.cz} failed`, err);
      },
    );
  }

  /** Hands the pool more work as soon as a job finishes, so workers do not wait for the next frame. */
  private refill(): void {
    if (!this.idle && this.r > 0) this.schedule();
  }

  private publish(chunk: Chunk, result: MeshResult): void {
    if (!chunk.meshed) this.meshedCount++;
    chunk.meshed = true;
    this.host.bus.emit('chunk:meshed', { mesh: result.mesh });
    chunk.borders = result.borders;
    for (let side = 0; side < 4; side++) {
      const n = this.host.chunks.get(chunkKey(chunk.cx + SIDE_DX[side], chunk.cz + SIDE_DZ[side]));
      // A neighbour whose last mesh saw other light along this border is out of date.
      if (n?.borders && n.borders[SIDE_OPPOSITE[side]] !== result.borders[side]) this.markDirty(n, true);
    }
  }
}
