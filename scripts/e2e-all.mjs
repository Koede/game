// Runs every scripts/e2e-*.mjs (and e2e.mjs) against ONE build, continues after a failure, prints a table, exit 1 if any failed.
//   node scripts/e2e-all.mjs                       build once to .cache/dist-e2e, run all, one at a time
//   node scripts/e2e-all.mjs --no-build            reuse the build
//   node scripts/e2e-all.mjs --only=workshop,magic substring filter on the script name
//   node scripts/e2e-all.mjs --jobs=2              two Chromium at a time at most (default 1)
//   node scripts/e2e-all.mjs --out=<dir>           build dir (also --dist=)
// Takes the heavy lock (scripts/lib/lock.mjs) unless HW_LOCK_HELD=1. Writes test-results/e2e-all.json.
import { spawn } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { withHeavyLock } from './lib/lock.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const only = (arg('only') ?? '').split(',').filter(Boolean);
const jobs = Math.max(1, Number(arg('jobs') ?? 1));
const dist = e2eDist(root, argv);

const scripts = readdirSync(join(root, 'scripts')).filter((f) => /^e2e(-[a-z0-9-]+)?\.mjs$/.test(f) && f !== 'e2e-all.mjs')
  .filter((f) => only.length === 0 || only.some((o) => f.includes(o))).sort();

const run = (file) => new Promise((done) => {
  const t0 = Date.now();
  const p = spawn(process.execPath, [join(root, 'scripts', file), '--no-build', `--dist=${dist}`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  p.on('close', (code) => done({ script: file, ok: code === 0, seconds: Math.round((Date.now() - t0) / 1000), tail: out.trim().split('\n').slice(-12).join('\n') }));
});

await withHeavyLock(async () => {
  await ensureBuilt(argv, dist);
  const results = [];
  const queue = [...scripts];
  await Promise.all(Array.from({ length: jobs }, async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const r = await run(f);
      console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${f} ${r.seconds}s`);
      if (!r.ok) console.log(r.tail.replace(/^/gm, '      '));
      results.push(r);
    }
  }));
  mkdirSync(join(root, 'test-results'), { recursive: true });
  writeFileSync(join(root, 'test-results/e2e-all.json'), JSON.stringify(results.map(({ tail, ...r }) => r), null, 2));
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\n${failed.length}/${results.length} e2e scripts failed: ${failed.map((r) => r.script).join(', ')}` : `\nall ${results.length} e2e scripts passed`);
  process.exitCode = failed.length ? 1 : 0;
}, { label: 'e2e-all', cwd: root });
