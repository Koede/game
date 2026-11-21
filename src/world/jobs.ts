/**
 * The two kinds of background work of the world - generating a chunk's voxels and meshing a chunk - as
 * plain messages and one function that runs them. The chunk worker and the main-thread fallback of the
 * worker pool both call `runJob`, so the results are identical wherever a job ran.
 */
import type { ChunkMeshData } from '../core/types';
import { borderHashes, computeLight, LIGHT_VOLUME } from './lighting';
import { meshBuffers, meshChunk } from './mesher';
import { generateChunk } from './worldgen';

export interface GenerateJob {
  type: 'generate';
  seed: number;
  cx: number;
  cz: number;
}

export interface MeshJob {
  type: 'mesh';
  cx: number;
  cz: number;
  /** The chunk's 3x3 neighbourhood (see ChunkNeighborhood); copied, never transferred, when sent to a worker. */
  chunks: (Uint16Array | null)[];
}

export type Job = GenerateJob | MeshJob;

export interface GenerateResult {
  type: 'generate';
  cx: number;
  cz: number;
  voxels: Uint16Array;
  /** Milliseconds the job took where it ran. */
  ms: number;
}

export interface MeshResult {
  type: 'mesh';
  mesh: ChunkMeshData;
  /** Light hashes of the chunk's four sides (lighting.borderHashes). */
  borders: Uint32Array;
  /** Milliseconds the job took where it ran (lighting included). */
  ms: number;
}

export type JobResult = GenerateResult | MeshResult;

/** Light colour of the chunk being meshed (filled by computeLight, read by meshChunk before the next job). */
const hue = new Uint8Array(LIGHT_VOLUME);
export type ResultOf<J extends Job> = J extends GenerateJob ? GenerateResult : MeshResult;

export function runJob<J extends Job>(job: J): ResultOf<J>;
export function runJob(job: Job): JobResult {
  const start = performance.now();
  if (job.type === 'generate') {
    const voxels = generateChunk(job.seed, job.cx, job.cz);
    return { type: 'generate', cx: job.cx, cz: job.cz, voxels, ms: performance.now() - start };
  }
  const light = computeLight(job.chunks, hue);
  const mesh = meshChunk({ cx: job.cx, cz: job.cz, chunks: job.chunks, light, hue });
  return { type: 'mesh', mesh, borders: borderHashes(light), ms: performance.now() - start };
}

/** Buffers of a result that can be handed to another thread without copying. */
export function resultTransferables(result: JobResult): ArrayBuffer[] {
  if (result.type === 'generate') return [result.voxels.buffer as ArrayBuffer];
  return [...meshBuffers(result.mesh), result.borders.buffer as ArrayBuffer];
}

// ---- messages between the pool and a worker ----

export interface JobRequest {
  id: number;
  job: Job;
}

/** What a worker posts: `ready` once at start-up, then one reply per request. */
export type WorkerReply = { ready: true } | { id: number; result: JobResult } | { id: number; error: string };
