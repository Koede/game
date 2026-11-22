// The machine-wide heavy-job lock (full vitest, perf project, full e2e): ONE directory, `<main checkout>/.gate-heavy`, taken with
// mkdir and released with rmdir - the same lock humans take by hand (`mkdir E:\Projects\game\.gate-heavy`). Worktrees find the
// main checkout through git, so every lane shares it. A holder that died (pid gone) or sat on it for 40 minutes is taken over.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function lockDir(cwd = process.cwd()) {
  if (process.env.HW_LOCK_DIR) return resolve(process.env.HW_LOCK_DIR);
  try {
    const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd, encoding: 'utf8' }).trim();
    return join(dirname(common), '.gate-heavy');
  } catch {
    return join(cwd, '.gate-heavy');
  }
}

const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

/** Runs `fn` while holding the lock; waits (printing the holder) up to `waitMs` (default 30 min). */
export async function withHeavyLock(fn, { waitMs = 30 * 60_000, label = 'job', cwd = process.cwd() } = {}) {
  if (process.env.HW_LOCK_HELD === '1') return fn(); // a parent (local-check, e2e-all) already holds it
  const dir = lockDir(cwd);
  const started = Date.now();
  let told = 0;
  for (;;) {
    try {
      mkdirSync(dir);
      writeFileSync(join(dir, 'owner.json'), JSON.stringify({ pid: process.pid, worktree: cwd, label, since: Date.now() }));
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let owner = null;
      try { owner = JSON.parse(readFileSync(join(dir, 'owner.json'), 'utf8')); } catch { /* a hand-made lock has no owner file */ }
      const age = owner ? Date.now() - owner.since : Date.now() - statSync(dir).mtimeMs;
      if ((owner && !alive(owner.pid)) || age > 40 * 60_000) { rmSync(dir, { recursive: true, force: true }); continue; }
      if (Date.now() - started > waitMs) throw new Error(`heavy lock still held after ${waitMs / 60000} min (${owner ? owner.label + ' in ' + owner.worktree : 'hand-made'})`);
      if (Date.now() - told > 30_000) { console.log(`waiting for the heavy lock (${owner ? owner.label + ' in ' + owner.worktree : 'held by hand'})...`); told = Date.now(); }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  const release = () => { try { if (existsSync(dir)) { rmSync(join(dir, 'owner.json'), { force: true }); rmdirSync(dir); } } catch { /* already gone */ } };
  process.once('exit', release);
  try {
    return await fn();
  } finally {
    release();
  }
}
