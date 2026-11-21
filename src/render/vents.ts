/**
 * Steam vents (spec 14): every steam_vent block near the camera breathes steam from its top - a thin wisp all the
 * time and a fuller gush every few seconds - and hisses (sfx 'steam_hiss', positioned at the vent) now and then
 * while the player is close. Vents are world blocks, not block entities, so each chunk around the camera is
 * scanned once (its voxel array when the world offers one) and rescanned only when a vent block changes in it.
 * No per-frame allocation once the vents near the camera are known.
 */
import type { GameBus } from '../core/context';
import { blockId, blockOf } from '../core/registry';
import { CHUNK_SIZE, VOXEL_ID_MASK, WORLD_HEIGHT, voxelIndex, type IWorld } from '../core/types';
import { ParticleLook, type ParticleSpec, type Particles } from './particles';
import { shapePuff } from './puffs';

/** Steam is drawn for vents within this many blocks of the camera (horizontally); hisses are heard within HISS_RANGE. */
export const VENT_RANGE = 40;
export const HISS_RANGE = 16;
/** Seconds between two hisses of one vent (uniform), and the shortest gap between any two hisses. */
export const HISS_MIN_S = 4;
export const HISS_MAX_S = 9;
export const HISS_GAP_S = 1.5;
/** Wisp puffs per second, and the gush: puffs per burst, every GUSH_MIN_S..GUSH_MAX_S. */
const WISP_RATE = 1.4;
const GUSH_PUFFS = 7;
const GUSH_MIN_S = 2.5;
const GUSH_MAX_S = 6;
/** Chunks (Chebyshev radius around the camera's chunk) whose vents are known; at most SCANS_PER_FRAME new ones per frame. */
const CHUNK_RADIUS = 3;
const SCANS_PER_FRAME = 1;
const NEAR_INTERVAL_S = 0.5;

interface Vent {
  x: number;
  y: number;
  z: number;
  wisp: number;
  gushIn: number;
  hissIn: number;
}

interface ChunkSource {
  chunkVoxels?(cx: number, cz: number): Uint16Array | null;
}

const rnd = Math.random;
const between = (a: number, b: number): number => a + rnd() * (b - a);
const chunkKey = (cx: number, cz: number): number => (cx + 32768) * 65536 + (cz + 32768);

export class SteamVents {
  /** Vent positions per scanned chunk (flat x, y, z triples). */
  private readonly chunks = new Map<number, number[]>();
  /** Vents near the camera, refreshed twice a second into the spare list and swapped (objects reused by place). */
  private near: Vent[] = [];
  private spare: Vent[] = [];
  private readonly byPos = new Map<number, Vent>();
  private readonly spec: ParticleSpec = {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size: 0.1, sizeEnd: 0.1,
    r: 1, g: 1, b: 1, r2: 1, g2: 1, b2: 1, alpha: 1, gravity: 0, drag: 0, look: ParticleLook.Puff, fog: 1,
  };
  private readonly ventId = blockId('steam_vent');
  private readonly offs: (() => void)[];
  private nearTimer = 0;
  private sinceHiss = HISS_GAP_S;
  /** 0 at night .. 1 by day (steam reads white by day, grey at night). */
  day = 1;

  constructor(
    private readonly bus: GameBus,
    private readonly world: IWorld,
    private readonly particles: Particles,
  ) {
    this.offs = [
      bus.on('block:changed', (e) => {
        if (((e.from ^ this.ventId) & VOXEL_ID_MASK) !== 0 && ((e.to ^ this.ventId) & VOXEL_ID_MASK) !== 0) return;
        this.chunks.delete(chunkKey(Math.floor(e.x / CHUNK_SIZE), Math.floor(e.z / CHUNK_SIZE)));
        this.nearTimer = 0;
      }),
      bus.on('chunk:unloaded', ({ cx, cz }) => this.chunks.delete(chunkKey(cx, cz))),
    ];
  }

  /** Vents near the camera after the last refresh (tests, stats). */
  get count(): number {
    return this.near.length;
  }

  update(dt: number, camX: number, camY: number, camZ: number): void {
    this.scanAround(camX, camZ);
    this.nearTimer -= dt;
    if (this.nearTimer <= 0) {
      this.nearTimer = NEAR_INTERVAL_S;
      this.refreshNear(camX, camZ);
    }
    this.sinceHiss += dt;
    for (const v of this.near) {
      v.wisp += WISP_RATE * dt;
      while (v.wisp >= 1) {
        v.wisp -= 1;
        this.puff(v, 0.6);
      }
      v.gushIn -= dt;
      if (v.gushIn <= 0) {
        v.gushIn = between(GUSH_MIN_S, GUSH_MAX_S);
        for (let i = 0; i < GUSH_PUFFS; i++) this.puff(v, 1 + i * 0.12);
      }
      v.hissIn -= dt;
      if (v.hissIn <= 0) {
        v.hissIn = between(HISS_MIN_S, HISS_MAX_S);
        const d = Math.hypot(v.x + 0.5 - camX, v.y + 1 - camY, v.z + 0.5 - camZ);
        if (d <= HISS_RANGE && this.sinceHiss >= HISS_GAP_S) {
          this.sinceHiss = 0;
          this.bus.emit('sfx', { name: 'steam_hiss', x: v.x + 0.5, y: v.y + 1, z: v.z + 0.5, volume: 0.8 });
          for (let i = 0; i < GUSH_PUFFS; i++) this.puff(v, 1.2 + i * 0.1);
        }
      }
    }
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.chunks.clear();
    this.near.length = 0;
  }

  private puff(v: Vent, strength: number): void {
    const p = this.spec;
    shapePuff(p, 'steam', v.x + 0.5, v.y + 1.02, v.z + 0.5, this.day, 0);
    p.vy *= strength * 1.3;
    p.size *= 0.8 + strength * 0.4;
    p.sizeEnd *= 0.7 + strength * 0.5;
    p.life *= 0.8 + strength * 0.4;
    this.particles.spawn(p);
  }

  /** Scans the first not-yet-known loaded chunk around the camera (one per frame keeps it cheap). */
  private scanAround(camX: number, camZ: number): void {
    const ccx = Math.floor(camX / CHUNK_SIZE);
    const ccz = Math.floor(camZ / CHUNK_SIZE);
    let scans = 0;
    for (let r = 0; r <= CHUNK_RADIUS && scans < SCANS_PER_FRAME; r++) {
      for (let dz = -r; dz <= r && scans < SCANS_PER_FRAME; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = ccx + dx;
          const cz = ccz + dz;
          const key = chunkKey(cx, cz);
          if (this.chunks.has(key) || !this.world.isLoaded(cx * CHUNK_SIZE, cz * CHUNK_SIZE)) continue;
          this.chunks.set(key, this.scanChunk(cx, cz));
          this.nearTimer = 0;
          if (++scans >= SCANS_PER_FRAME) break;
        }
      }
    }
  }

  private scanChunk(cx: number, cz: number): number[] {
    const found: number[] = [];
    const id = this.ventId;
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;
    const voxels = (this.world as IWorld & ChunkSource).chunkVoxels?.(cx, cz) ?? null;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const v = voxels ? voxels[voxelIndex(x, y, z)] : this.world.getVoxel(x0 + x, y, z0 + z);
          if ((v & VOXEL_ID_MASK) === id) found.push(x0 + x, y, z0 + z);
        }
      }
    }
    return found;
  }

  /** Vents within VENT_RANGE whose top is open (steam needs somewhere to go). */
  private refreshNear(camX: number, camZ: number): void {
    const next = this.spare;
    next.length = 0;
    const seen = new Set<number>();
    for (const list of this.chunks.values()) {
      for (let i = 0; i < list.length; i += 3) {
        const x = list[i];
        const y = list[i + 1];
        const z = list[i + 2];
        const dx = x + 0.5 - camX;
        const dz = z + 0.5 - camZ;
        if (dx * dx + dz * dz > VENT_RANGE * VENT_RANGE) continue;
        if (blockOf(this.world.getVoxel(x, y + 1, z)).solid) continue;
        const key = (x + 32768) * 4294967296 + y * 65536 + (z + 32768);
        let v = this.byPos.get(key);
        if (!v) {
          v = { x, y, z, wisp: rnd(), gushIn: between(0.3, GUSH_MAX_S), hissIn: between(0.5, HISS_MAX_S) };
          this.byPos.set(key, v);
        }
        seen.add(key);
        next.push(v);
      }
    }
    for (const key of this.byPos.keys()) if (!seen.has(key)) this.byPos.delete(key);
    this.spare = this.near;
    this.near = next;
  }
}
