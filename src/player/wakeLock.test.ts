import { describe, expect, it } from 'vitest';
import { WakeLockKeeper } from './wakeLock';

function fakeApi(refuse = false) {
  const log = { requests: 0, releases: 0 };
  const api = {
    request: async () => {
      log.requests++;
      if (refuse) throw new Error('NotAllowedError');
      return { release: async () => void log.releases++, addEventListener: () => {} };
    },
  };
  return { api, log };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the screen wake lock', () => {
  it('asks once while wanted, and lets go when not', async () => {
    const { api, log } = fakeApi();
    const k = new WakeLockKeeper(() => api);
    k.update(true);
    k.update(true);
    await flush();
    expect(log.requests).toBe(1);
    expect(k.held).toBe(true);
    k.update(false);
    expect(log.releases).toBe(1);
    expect(k.held).toBe(false);
  });

  it('takes the lock again after a pause', async () => {
    const { api, log } = fakeApi();
    const k = new WakeLockKeeper(() => api);
    k.update(true);
    await flush();
    k.update(false);
    k.update(true);
    await flush();
    expect(log.requests).toBe(2);
  });

  it('ignores a refusal and a missing API', async () => {
    const k = new WakeLockKeeper(() => fakeApi(true).api);
    k.update(true);
    await flush();
    expect(k.held).toBe(false);
    expect(() => new WakeLockKeeper(() => undefined).update(true)).not.toThrow();
  });

  it('releases a lock that arrives after dispose', async () => {
    const { api, log } = fakeApi();
    const k = new WakeLockKeeper(() => api);
    k.update(true);
    k.dispose();
    await flush();
    expect(log.releases).toBe(1);
  });
});
