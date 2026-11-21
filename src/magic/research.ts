/**
 * Per-player research state (docs/OVERHAUL_PLAN.md B.6): what was scanned, which aspects are known, spendable lore per
 * aspect, and each entry's board. Pure functions over plain JSON so it saves as is.
 */
import { ASPECT_LIST, isAspect, type Aspect, type Aspects } from './aspects';
import { boardHint, boardSolved, cellFree, type BoardTokens } from './board';
import { RESEARCH, researchEntry, type ResearchEntry } from './entries';

/** Lore gained per aspect from one first scan, at most. */
export const SCAN_LORE_CAP = 4;
/** Aspects every player knows from the start (what a stick and a stone teach). */
export const STARTING_ASPECTS: readonly Aspect[] = ['loam', 'spring', 'craft'];

export interface EntryState { done: boolean; tokens: BoardTokens }

export interface ResearchState {
  v: 1;
  scanned: string[];
  known: Aspect[];
  lore: Aspects;
  entries: Record<string, EntryState>;
}

export const freshResearch = (): ResearchState => ({ v: 1, scanned: [], known: [...STARTING_ASPECTS], lore: {}, entries: {} });

export interface ScanResult {
  first: boolean;
  gained: Aspects;
  learned: Aspect[];
  /** Entries finished by this scan (the opening note). */
  finished: string[];
}

/** `mult` scales the lore of a first scan (the Scrying Lens). */
export function scanObject(s: ResearchState, key: string, fingerprint: Aspects, mult = 1): ScanResult {
  if (s.scanned.includes(key)) return { first: false, gained: {}, learned: [], finished: [] };
  s.scanned.push(key);
  const gained: Aspects = {};
  const learned: Aspect[] = [];
  for (const a of ASPECT_LIST) {
    const n = fingerprint[a] ?? 0;
    if (n <= 0) continue;
    const g = Math.round(Math.min(SCAN_LORE_CAP, n) * mult);
    gained[a] = g;
    s.lore[a] = (s.lore[a] ?? 0) + g;
    if (!s.known.includes(a)) { s.known.push(a); learned.push(a); }
  }
  const finished: string[] = [];
  for (const e of RESEARCH) {
    if (e.board === null && isOpen(s, e) && !isDone(s, e.key)) { entryState(s, e.key).done = true; finished.push(e.key); }
  }
  return { first: true, gained, learned, finished };
}

export const isDone = (s: ResearchState, key: string): boolean => s.entries[key]?.done === true;
export const isOpen = (s: ResearchState, e: ResearchEntry): boolean => e.requires.every((r) => isDone(s, r));

function entryState(s: ResearchState, key: string): EntryState {
  return (s.entries[key] ??= { done: false, tokens: {} });
}

export type EntryStatus = 'locked' | 'open' | 'done';
export const entryStatus = (s: ResearchState, e: ResearchEntry): EntryStatus => (isDone(s, e.key) ? 'done' : isOpen(s, e) ? 'open' : 'locked');

export interface PlaceResult { ok: boolean; reason?: string; solved?: boolean }

/** Places (or replaces) a token: spends 1 lore of the aspect (a replaced token's lore comes back). */
export function placeToken(s: ResearchState, key: string, cell: number, aspect: Aspect): PlaceResult {
  const e = researchEntry(key);
  if (!e || !e.board) return { ok: false, reason: 'Nothing to place on' };
  if (!isOpen(s, e)) return { ok: false, reason: 'Finish the earlier research first' };
  if (isDone(s, key)) return { ok: false, reason: 'Already done' };
  if (!cellFree(e.board, cell)) return { ok: false, reason: 'That spot is fixed' };
  if (!s.known.includes(aspect)) return { ok: false, reason: 'You do not know that aspect yet' };
  if ((s.lore[aspect] ?? 0) < 1) return { ok: false, reason: `No ${aspect} lore left: scan new things` };
  const st = entryState(s, key);
  const old = st.tokens[cell];
  if (old) s.lore[old] = (s.lore[old] ?? 0) + 1;
  s.lore[aspect] = (s.lore[aspect] ?? 0) - 1;
  st.tokens[cell] = aspect;
  if (boardSolved(e.board, st.tokens)) {
    st.done = true;
    return { ok: true, solved: true };
  }
  return { ok: true, solved: false };
}

/** Takes a token back and refunds its lore. */
export function removeToken(s: ResearchState, key: string, cell: number): boolean {
  const st = s.entries[key];
  const a = st?.tokens[cell];
  if (!st || !a || st.done) return false;
  delete st.tokens[cell];
  s.lore[a] = (s.lore[a] ?? 0) + 1;
  return true;
}

export function hintFor(s: ResearchState, key: string): { cell: number; aspect: Aspect } | null {
  const e = researchEntry(key);
  if (!e?.board) return null;
  return boardHint(e.board, s.entries[key]?.tokens ?? {}, s.known);
}

/** Everything unlocked so far (recipe ids and flags). */
export function unlockedRecipes(s: ResearchState): Set<string> {
  const out = new Set<string>();
  for (const e of RESEARCH) if (isDone(s, e.key)) for (const r of e.unlocks.recipes ?? []) out.add(r);
  return out;
}
export const hasFlag = (s: ResearchState, flag: string): boolean =>
  RESEARCH.some((e) => isDone(s, e.key) && (e.unlocks.flags ?? []).includes(flag));

/** Repairs anything loaded: unknown aspects and entries are dropped, numbers clamped. */
export function sanitizeResearch(raw: unknown): ResearchState {
  const s = freshResearch();
  if (!raw || typeof raw !== 'object') return s;
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r.scanned)) s.scanned = r.scanned.filter((k): k is string => typeof k === 'string').slice(0, 5000);
  if (Array.isArray(r.known)) for (const a of r.known) if (typeof a === 'string' && isAspect(a) && !s.known.includes(a)) s.known.push(a);
  if (r.lore && typeof r.lore === 'object')
    for (const [a, n] of Object.entries(r.lore as Record<string, unknown>))
      if (isAspect(a) && typeof n === 'number' && n > 0) s.lore[a] = Math.min(9999, Math.floor(n));
  if (r.entries && typeof r.entries === 'object')
    for (const [k, v] of Object.entries(r.entries as Record<string, unknown>)) {
      if (!researchEntry(k) || !v || typeof v !== 'object') continue;
      const ev = v as Record<string, unknown>;
      const tokens: BoardTokens = {};
      if (ev.tokens && typeof ev.tokens === 'object')
        for (const [c, a] of Object.entries(ev.tokens as Record<string, unknown>))
          if (typeof a === 'string' && isAspect(a) && Number.isInteger(Number(c))) tokens[Number(c)] = a;
      s.entries[k] = { done: ev.done === true, tokens };
    }
  return s;
}
