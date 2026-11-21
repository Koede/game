// Opt-in e2e diagnostics (HW_DIAG=1). Everything the test run saw, as one JSONL file you can read afterwards:
//   test-results/diag/<run>.jsonl          one JSON object per line: { ts, kind, ... }
//   test-results/diag/<run>-fail-N.png     a screenshot at every failed step
//
// kinds:
//   run.start      node/env facts (gpu on/off, platform)          page.env      WebGL renderer, viewport, memory
//   page.console   EVERY console message, not just errors         page.error    uncaught page errors
//   page.http      every response with status >= 400, with URL    page.reqfail  requests that failed outright
//   page.crash     the tab crashed                                page.nav      main-frame navigations
//   game           entries drained from the game's own ring buffer (window.__hwDiag, src/app/diag.ts)
//   state          periodic summary of window.__hw.state()
//   step.start / step.ok / step.fail    reporter steps, with timings, the error and a state snapshot on failure
//
// Read it with:  node scripts/lib/diag.mjs summary [file]   (latest file by default)
// Off by default: with HW_DIAG unset every function here is a cheap no-op.
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root } from './bundle.mjs';

export const diagEnabled = process.env.HW_DIAG === '1';

const dir = process.env.HW_DIAG_DIR ? resolve(process.env.HW_DIAG_DIR) : join(root, 'test-results', 'diag');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.argv[1] ? process.argv[1].split(/[\\/]/).pop().replace(/\.mjs$/, '') : 'node'}-${process.pid}`;
export const diagFile = join(dir, `${runId}.jsonl`);
let ready = false;
let failShots = 0;
/** The most recently attached page: what a failing step snapshots. */
let current = null;

function ensure() {
  if (ready) return;
  mkdirSync(dir, { recursive: true });
  ready = true;
  hlog('run.start', {
    script: process.argv[1],
    node: process.version,
    platform: process.platform,
    gpu: process.env.HW_GPU === '1',
    file: diagFile,
  });
}

/** Appends one record. No-op unless HW_DIAG=1. */
export function hlog(kind, data = {}) {
  if (!diagEnabled) return;
  if (!ready && kind !== 'run.start') ensure();
  if (!ready) {
    ready = true;
    mkdirSync(dir, { recursive: true });
  }
  try {
    appendFileSync(diagFile, `${JSON.stringify({ ts: Date.now(), kind, ...data })}\n`);
  } catch {
    /* diagnostics must never break a test run */
  }
}

/** Pulls new entries out of the game's ring buffer (window.__hwDiag) into the log. */
async function drain(rec) {
  try {
    const entries = await rec.page.evaluate((since) => (window.__hwDiag ? window.__hwDiag.entries.filter((e) => e.n > since) : []), rec.lastN);
    for (const e of entries) {
      rec.lastN = Math.max(rec.lastN, e.n);
      hlog('game', { label: rec.label, ...e });
    }
  } catch {
    /* page closed or navigating */
  }
}

async function stateSummary(page) {
  return page.evaluate(() => {
    const hw = window.__hw;
    if (!hw) return { hw: false };
    const s = hw.state();
    return { phase: s.phase, ready: s.ready, frames: s.frames, ticks: s.ticks, player: s.player, lastSave: s.lastSave, hasSave: s.hasSave, persistent: s.persistent };
  });
}

/** Starts logging a page: call right after it is created, before navigation. Returns detach(). */
export function attachPage(page, label) {
  if (!diagEnabled) return async () => {};
  const rec = { page, label, lastN: -1 };
  current = rec;
  page.on('console', (m) => {
    const loc = m.location?.();
    hlog('page.console', { label, type: m.type(), text: m.text().slice(0, 2000), ...(loc?.url ? { at: `${loc.url}:${loc.lineNumber}` } : {}) });
  });
  page.on('pageerror', (e) => hlog('page.error', { label, message: e.message, stack: e.stack }));
  page.on('requestfailed', (r) => hlog('page.reqfail', { label, url: r.url(), method: r.method(), failure: r.failure()?.errorText }));
  page.on('response', (r) => {
    if (r.status() >= 400) hlog('page.http', { label, status: r.status(), url: r.url(), method: r.request().method() });
  });
  page.on('crash', () => hlog('page.crash', { label }));
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) hlog('page.nav', { label, url: f.url() });
  });
  const timer = setInterval(async () => {
    await drain(rec);
    try {
      hlog('state', { label, ...(await stateSummary(page)) });
    } catch {
      /* page closed */
    }
  }, 2000);
  return async () => {
    clearInterval(timer);
    await drain(rec);
    if (current === rec) current = null;
  };
}

/** Facts about the page's environment (which GPU WebGL really got, viewport, memory). Call after navigation. */
export async function logEnv(page, label) {
  if (!diagEnabled) return;
  try {
    const env = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: gl ? (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'webgl2 (no debug info)') : 'no webgl2',
        maxTextureLayers: gl ? gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) : null,
        viewport: `${innerWidth}x${innerHeight}@${devicePixelRatio}`,
        ua: navigator.userAgent,
        cores: navigator.hardwareConcurrency,
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
        diagFlag: !!window.__hwDiag,
      };
    });
    hlog('page.env', { label, ...env });
  } catch (e) {
    hlog('page.env', { label, error: String(e) });
  }
}

/** For a failing step: state, the last game entries, and a screenshot. */
export async function snapshotFailure(stepName) {
  if (!diagEnabled || !current) return;
  const { page, label } = current;
  await drain(current);
  try {
    hlog('step.snapshot', { label, step: stepName, state: await stateSummary(page) });
  } catch (e) {
    hlog('step.snapshot', { label, step: stepName, error: String(e) });
  }
  try {
    ensure();
    const file = join(dir, `${runId}-fail-${++failShots}.png`);
    await page.screenshot({ path: file });
    hlog('step.screenshot', { label, step: stepName, file });
  } catch {
    /* page may already be gone */
  }
}

// ---- reading it back ---------------------------------------------------------------------------------------------

function summarise(file) {
  const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const count = {};
  for (const r of rows) count[r.kind] = (count[r.kind] ?? 0) + 1;
  const out = [`file: ${file}`, `records: ${rows.length}`, `by kind: ${JSON.stringify(count)}`];
  const t0 = rows[0]?.ts ?? 0;
  const at = (r) => `+${((r.ts - t0) / 1000).toFixed(1)}s`;
  for (const r of rows.filter((r) => r.kind === 'page.env')) out.push(`env      ${r.label}: ${r.renderer} | ${r.viewport}`);
  for (const r of rows.filter((r) => r.kind === 'page.http')) out.push(`http     ${at(r)} ${r.status} ${r.method} ${r.url}`);
  for (const r of rows.filter((r) => r.kind === 'page.reqfail')) out.push(`reqfail  ${at(r)} ${r.url} ${r.failure}`);
  for (const r of rows.filter((r) => r.kind === 'page.error')) out.push(`pageerr  ${at(r)} ${r.message}`);
  for (const r of rows.filter((r) => r.kind === 'page.console' && (r.type === 'error' || r.type === 'warning'))) out.push(`console.${r.type} ${at(r)} ${r.text.slice(0, 200)}`);
  for (const r of rows.filter((r) => r.kind.startsWith('step.') && r.kind !== 'step.start')) out.push(`${r.kind.padEnd(13)} ${at(r)} ${r.step ?? r.name}${r.ms !== undefined ? ` (${r.ms} ms)` : ''}${r.message ? ` :: ${r.message}` : ''}`);
  return out.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd !== 'summary') {
    console.log('usage: node scripts/lib/diag.mjs summary [file.jsonl]');
    process.exit(1);
  }
  let file = arg;
  if (!file) {
    if (!existsSync(dir)) {
      console.log(`no diagnostics yet in ${dir} (run with HW_DIAG=1)`);
      process.exit(0);
    }
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => join(dir, f));
    files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    file = files[0];
  }
  console.log(file ? summarise(file) : 'no .jsonl files found');
}
