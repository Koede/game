/**
 * Entry of the chunk worker. scripts/build.mjs bundles this file on its own and inlines the result into
 * the game as the default export of 'virtual:worker'; workerPool.ts starts it from a Blob URL.
 */
import { resultTransferables, runJob, type JobRequest, type WorkerReply } from './jobs';

interface WorkerScope {
  onmessage: ((event: MessageEvent<JobRequest>) => void) | null;
  postMessage(message: WorkerReply, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, job } = event.data;
  try {
    const result = runJob(job);
    scope.postMessage({ id, result }, resultTransferables(result));
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err) });
  }
};

scope.postMessage({ ready: true });
