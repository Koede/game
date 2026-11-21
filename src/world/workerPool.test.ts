import { afterEach, describe, expect, it, vi } from 'vitest';
import { runJob, type JobRequest, type WorkerReply } from './jobs';
import { WorkerPool, type WorkerLike } from './workerPool';

const SEED = 1234;
const tick = (ms = 0): Promise<void> => new Promise((done) => setTimeout(done, ms));

/** Runs jobs like the real worker, a macrotask later. `ready: false` simulates a worker that never starts. */
class FakeWorker implements WorkerLike {
  static all: FakeWorker[] = [];
  onmessage: ((event: { data: WorkerReply }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  received: JobRequest[] = [];
  terminated = false;

  constructor(readonly url: string, ready = true) {
    FakeWorker.all.push(this);
    if (ready) setTimeout(() => this.reply({ ready: true }), 0);
  }

  postMessage(message: JobRequest): void {
    const request = structuredClone(message);
    this.received.push(request);
    setTimeout(() => {
      try {
        this.reply({ id: request.id, result: runJob(request.job) });
      } catch (err) {
        this.reply({ id: request.id, error: String(err) });
      }
    }, 1);
  }

  terminate(): void {
    this.terminated = true;
  }

  private reply(data: WorkerReply): void {
    if (!this.terminated) this.onmessage?.({ data });
  }
}

afterEach(() => {
  FakeWorker.all = [];
  vi.restoreAllMocks();
});

describe('WorkerPool on the main thread', () => {
  it('falls back when there is no worker source and runs jobs only inside pump', async () => {
    const pool = new WorkerPool('');
    expect(pool.mode).toBe('main');
    expect(pool.fallback).toBe('no worker source');
    const promise = pool.run({ type: 'generate', seed: SEED, cx: 0, cz: 0 });
    pool.pump(0);
    expect(pool.pending).toBe(1);
    pool.pump(1);
    expect(pool.pending).toBe(0);
    const result = await promise;
    expect(result?.voxels).toEqual(runJob({ type: 'generate', seed: SEED, cx: 0, cz: 0 }).voxels);
  });

  it('skips jobs that are no longer wanted and rejects jobs that throw', async () => {
    const pool = new WorkerPool('');
    const skipped = pool.run({ type: 'generate', seed: SEED, cx: 0, cz: 0 }, () => false);
    const broken = pool.run({ type: 'mesh', cx: 0, cz: 0, chunks: [] });
    pool.pump(100);
    expect(await skipped).toBeNull();
    await expect(broken).rejects.toThrow(/centre chunk is missing/);
  });

  it('falls back when creating a worker throws', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pool = new WorkerPool('self.onmessage = null;', {
      createWorker: () => {
        throw new Error('blocked by the sandbox');
      },
    });
    expect(pool.mode).toBe('main');
    expect(pool.fallback).toMatch(/blocked by the sandbox/);
  });
});

describe('WorkerPool with workers', () => {
  it('spreads jobs over its workers and returns the same results as the main thread', async () => {
    const pool = new WorkerPool('worker source', { workers: 3, createWorker: (url) => new FakeWorker(url) });
    expect(pool.mode).toBe('workers');
    expect(pool.workerCount).toBe(3);
    expect(pool.capacity).toBe(6);
    const jobs = Array.from({ length: 6 }, (_, i) => pool.run({ type: 'generate', seed: SEED, cx: i, cz: -i }));
    expect(FakeWorker.all.map((w) => w.received.length)).toEqual([2, 2, 2]);
    expect(FakeWorker.all[0].url).toMatch(/^blob:/);
    const results = await Promise.all(jobs);
    results.forEach((r, i) => expect(r?.voxels).toEqual(runJob({ type: 'generate', seed: SEED, cx: i, cz: -i }).voxels));
    expect(pool.pending).toBe(0);
    pool.dispose();
    expect(FakeWorker.all.every((w) => w.terminated)).toBe(true);
  });

  it('asks whether a queued job is still wanted before sending it', async () => {
    const pool = new WorkerPool('worker source', { workers: 1, createWorker: (url) => new FakeWorker(url) });
    let wanted = true;
    const first = [0, 1].map((cx) => pool.run({ type: 'generate', seed: SEED, cx, cz: 0 }));
    const later = pool.run({ type: 'generate', seed: SEED, cx: 2, cz: 0 }, () => wanted);
    wanted = false;
    await Promise.all(first);
    expect(await later).toBeNull();
    expect(FakeWorker.all[0].received.length).toBe(2);
  });

  it('falls back to the main thread when a worker fails, re-running its unfinished jobs', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pool = new WorkerPool('worker source', { workers: 2, createWorker: (url) => new FakeWorker(url) });
    const job = pool.run({ type: 'generate', seed: SEED, cx: 5, cz: 5 });
    FakeWorker.all[0].onerror?.({ message: 'script error' });
    expect(pool.mode).toBe('main');
    expect(pool.fallback).toMatch(/script error/);
    expect(FakeWorker.all.every((w) => w.terminated)).toBe(true);
    expect(pool.pending).toBe(1);
    pool.pump(100);
    expect((await job)?.voxels).toEqual(runJob({ type: 'generate', seed: SEED, cx: 5, cz: 5 }).voxels);
  });

  it('gives up on workers that never report ready', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pool = new WorkerPool('worker source', { workers: 2, readyTimeoutMs: 20, createWorker: (url) => new FakeWorker(url, false) });
    expect(pool.mode).toBe('workers');
    await tick(40);
    expect(pool.mode).toBe('main');
    expect(pool.fallback).toMatch(/did not start/);
  });
});
