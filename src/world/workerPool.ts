/**
 * Runs world jobs (generate, mesh) on 1-4 Web Workers started from the inlined worker source. When there
 * is no source, Worker creation throws, or the workers fail to start, the same jobs run on the main thread
 * instead, a few per frame inside the budget given to `pump`. Callers see one API either way.
 */
import { runJob, type Job, type JobRequest, type ResultOf, type WorkerReply } from './jobs';

/** The part of a Worker the pool uses (tests pass a fake). */
export interface WorkerLike {
  onmessage: ((event: { data: WorkerReply }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  postMessage(message: JobRequest): void;
  terminate(): void;
}

export interface WorkerPoolOptions {
  /** Number of workers, clamped to 1..4. Default: one less than the device's cores. */
  workers?: number;
  /** Starts a worker from a script URL. Default: `new Worker(url)`. */
  createWorker?: (url: string) => WorkerLike;
  /** Workers that have not said they are ready after this long are given up on. Default 6000 ms. */
  readyTimeoutMs?: number;
}

export type PoolMode = 'workers' | 'main';

/** Jobs kept in flight per worker; more would only make cancelling slower. */
const PER_WORKER = 2;
/** Jobs worth queueing ahead in main-thread mode (each pump runs as many as fit in its budget). */
const MAIN_CAPACITY = 4;

interface Task {
  job: Job;
  wanted: (() => boolean) | null;
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

interface WorkerSlot {
  worker: WorkerLike;
  ready: boolean;
  inflight: Map<number, Task>;
}

const defaultWorkerCount = (): number => {
  const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 2;
  return cores - 1;
};

export class WorkerPool {
  private slots: WorkerSlot[] = [];
  private readonly queue: Task[] = [];
  private nextId = 1;
  private url: string | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private fallbackReason: string | null = null;

  constructor(source: string, options: WorkerPoolOptions = {}) {
    const create = options.createWorker ?? (typeof Worker === 'undefined' ? null : (url: string): WorkerLike => new Worker(url) as unknown as WorkerLike);
    if (!source || !create) {
      this.fallbackReason = !source ? 'no worker source' : 'Web Workers are not available';
      return;
    }
    const count = Math.max(1, Math.min(4, Math.floor(options.workers ?? defaultWorkerCount())));
    try {
      this.url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
      for (let i = 0; i < count; i++) this.slots.push(this.startWorker(create(this.url)));
    } catch (err) {
      this.fallBack(`worker creation failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    this.readyTimer = setTimeout(() => this.onReadyTimeout(), options.readyTimeoutMs ?? 6000);
  }

  /** 'workers' while workers do the jobs, 'main' when they run on the main thread inside `pump`. */
  get mode(): PoolMode {
    return this.slots.length > 0 ? 'workers' : 'main';
  }

  get workerCount(): number {
    return this.slots.length;
  }

  /** Why the pool runs on the main thread, or null while workers are in use. */
  get fallback(): string | null {
    return this.slots.length > 0 ? null : this.fallbackReason;
  }

  /** Jobs queued or running. */
  get pending(): number {
    let n = this.queue.length;
    for (const s of this.slots) n += s.inflight.size;
    return n;
  }

  /** How many jobs are worth keeping submitted at once to keep every thread busy. */
  get capacity(): number {
    return this.slots.length > 0 ? this.slots.length * PER_WORKER : MAIN_CAPACITY;
  }

  /**
   * Runs a job. `wanted` is asked right before the job starts; when it returns false the job is skipped
   * and the promise resolves to null. Rejects when the job itself throws.
   */
  run<J extends Job>(job: J, wanted?: () => boolean): Promise<ResultOf<J> | null> {
    return new Promise<ResultOf<J> | null>((resolve, reject) => {
      if (this.disposed) {
        resolve(null);
        return;
      }
      this.queue.push({ job, wanted: wanted ?? null, resolve: resolve as (r: unknown) => void, reject });
      this.dispatch();
    });
  }

  /** Main-thread mode: runs queued jobs until `budgetMs` is used up (at least one when the budget is positive). */
  pump(budgetMs: number): void {
    if (this.slots.length > 0 || budgetMs <= 0) return;
    const end = performance.now() + budgetMs;
    while (this.queue.length > 0 && performance.now() < end) {
      const task = this.queue.shift() as Task;
      if (task.wanted && !task.wanted()) {
        task.resolve(null);
        continue;
      }
      try {
        task.resolve(runJob(task.job));
      } catch (err) {
        task.reject(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const task of this.queue.splice(0)) task.resolve(null);
    for (const slot of this.slots) {
      for (const task of slot.inflight.values()) task.resolve(null);
      slot.worker.terminate();
    }
    this.slots = [];
    this.release();
  }

  private startWorker(worker: WorkerLike): WorkerSlot {
    const slot: WorkerSlot = { worker, ready: false, inflight: new Map() };
    worker.onmessage = (event) => this.onReply(slot, event.data);
    worker.onerror = (event) => {
      const message = (event as { message?: string } | null)?.message;
      this.fallBack(`a worker failed${message ? `: ${message}` : ''}`);
    };
    return slot;
  }

  private onReply(slot: WorkerSlot, reply: WorkerReply): void {
    if ('ready' in reply) {
      slot.ready = true;
      if (this.slots.every((s) => s.ready)) this.release();
      return;
    }
    const task = slot.inflight.get(reply.id);
    if (!task) return;
    slot.inflight.delete(reply.id);
    if ('error' in reply) task.reject(new Error(reply.error));
    else task.resolve(reply.result);
    this.dispatch();
  }

  private dispatch(): void {
    while (this.queue.length > 0 && this.slots.length > 0) {
      let best: WorkerSlot | null = null;
      for (const s of this.slots) if (s.inflight.size < PER_WORKER && (!best || s.inflight.size < best.inflight.size)) best = s;
      if (!best) return;
      const task = this.queue.shift() as Task;
      if (task.wanted && !task.wanted()) {
        task.resolve(null);
        continue;
      }
      const id = this.nextId++;
      best.inflight.set(id, task);
      best.worker.postMessage({ id, job: task.job });
    }
  }

  private onReadyTimeout(): void {
    this.readyTimer = null;
    const slow = this.slots.filter((s) => !s.ready);
    if (slow.length === this.slots.length) {
      this.fallBack('workers did not start in time');
      return;
    }
    for (const s of slow) this.retire(s);
    this.slots = this.slots.filter((s) => s.ready);
    this.release();
    this.dispatch();
  }

  /** Stops a worker and puts its unfinished jobs back at the front of the queue. */
  private retire(slot: WorkerSlot): void {
    slot.worker.onmessage = null;
    slot.worker.onerror = null;
    slot.worker.terminate();
    this.queue.unshift(...slot.inflight.values());
    slot.inflight.clear();
  }

  private fallBack(reason: string): void {
    if (this.disposed) return;
    console.warn(`[world] chunk workers unavailable (${reason}); building chunks on the main thread`);
    this.fallbackReason = reason;
    for (const s of this.slots) this.retire(s);
    this.slots = [];
    this.release();
  }

  private release(): void {
    if (this.readyTimer !== null) clearTimeout(this.readyTimer);
    this.readyTimer = null;
    if (this.url !== null) URL.revokeObjectURL(this.url);
    this.url = null;
  }
}
