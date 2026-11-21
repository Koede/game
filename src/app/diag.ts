/**
 * Opt-in diagnostics: a ring buffer of timestamped events that tests and humans can read back later.
 *
 * Off by default (one boolean check per call; payloads are built lazily so they cost nothing when off).
 * Turn it on with any of:  ?diag=1 in the page URL,  window.__HW_DIAG__ = true  before the game script runs
 * (Playwright: page.addInitScript),  or  localStorage.hwDiag = '1'.
 *
 * Read it back with  window.__hwDiag.entries  /  .dump()  /  .tail(n)  /  .byTag('save')  /  .clear().
 * The e2e harness (scripts/lib/diag.mjs, HW_DIAG=1) drains this buffer into test-results/diag/*.jsonl.
 *
 * Conventions: tags are 'area.event' (app.start, save.write, state.restore, frame.sample ...). `data` is plain
 * JSON-safe values only. Add a diag() call wherever a future reader would otherwise have to guess what happened.
 */

export interface DiagEntry {
  /** Milliseconds since the page's time origin (performance.now()). */
  t: number;
  /** Running index; gaps mean the ring dropped older entries. */
  n: number;
  tag: string;
  data?: Record<string, unknown>;
}

export interface DiagApi {
  readonly entries: DiagEntry[];
  dump(): string;
  tail(count?: number): DiagEntry[];
  byTag(prefix: string): DiagEntry[];
  clear(): void;
}

const MAX_ENTRIES = 4000;

let enabled = false;
let counter = 0;
const ring: DiagEntry[] = [];

declare global {
  interface Window {
    __HW_DIAG__?: boolean;
    __hwDiag?: DiagApi;
  }
}

function readFlag(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    if (window.__HW_DIAG__ === true) return true;
    if (/[?&]diag=1\b/.test(window.location?.search ?? '')) return true;
  } catch {
    /* a sandboxed frame may refuse location access */
  }
  try {
    return window.localStorage?.getItem('hwDiag') === '1';
  } catch {
    return false;
  }
}

/** Reads the flags and installs window.__hwDiag. Call once at startup; safe to call again. */
export function initDiag(): boolean {
  enabled = readFlag();
  if (enabled && typeof window !== 'undefined') {
    window.__hwDiag = {
      entries: ring,
      dump: () => ring.map((e) => JSON.stringify(e)).join('\n'),
      tail: (count = 50) => ring.slice(-count),
      byTag: (prefix) => ring.filter((e) => e.tag.startsWith(prefix)),
      clear: () => {
        ring.length = 0;
      },
    };
    diag('diag.on', () => ({ ua: navigator.userAgent, search: window.location?.search ?? '', screen: `${window.innerWidth}x${window.innerHeight}@${window.devicePixelRatio}` }));
  }
  return enabled;
}

export const diagOn = (): boolean => enabled;

/** Records one event. `data` may be a function so the work of describing the state is skipped when diagnostics are off. */
export function diag(tag: string, data?: Record<string, unknown> | (() => Record<string, unknown>)): void {
  if (!enabled) return;
  let payload: Record<string, unknown> | undefined;
  try {
    payload = typeof data === 'function' ? data() : data;
  } catch (err) {
    payload = { diagError: String(err) };
  }
  ring.push({ t: Math.round(performance.now() * 10) / 10, n: counter++, tag, ...(payload ? { data: payload } : {}) });
  if (ring.length > MAX_ENTRIES) ring.splice(0, ring.length - MAX_ENTRIES);
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** The bits of a player that matter when something moves or fails to: position, velocity, ground contact. */
export function playerBrief(p: { position: { x: number; y: number; z: number }; velocity?: { x: number; y: number; z: number }; onGround?: boolean; dead?: boolean; health?: number }): Record<string, unknown> {
  return {
    x: r3(p.position.x),
    y: r3(p.position.y),
    z: r3(p.position.z),
    ...(p.velocity ? { vx: r3(p.velocity.x), vy: r3(p.velocity.y), vz: r3(p.velocity.z) } : {}),
    onGround: p.onGround,
    dead: p.dead,
    health: p.health,
  };
}
