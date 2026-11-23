/**
 * Per-player research state, Thaumcraft style (docs/api/magic.md): what was scanned, which aspects are known, spendable
 * lore per aspect, and each research's notes. A research opens when what it requires is done; starting its notes costs
 * one lore of each anchor aspect; at a research table every aspect written onto the notes costs one lore (and ink, see
 * magic.ts) and erasing gives nothing back; two aspects combine into their compound. Pure functions over plain JSON.
 */
import { ASPECT_LIST, ASPECTS, aspectInfo, isAspect, type Aspect, type Aspects } from './aspects';
import { boardHint, boardSolved, cellFree, type BoardTokens } from './board';
import { RESEARCH, researchEntry, type ResearchEntry } from './entries';

/** Lore gained per aspect from one first scan, at most. */
export const SCAN_LORE_CAP = 4;
/** Aspects every player knows from the start (what a stick and a stone teach). */
export const STARTING_ASPECTS: readonly Aspect[] = ['loam', 'spring', 'craft'];

/** begun: the notes exist (their cost is paid); done: the board was solved and the research learned. */
export interface EntryState { done: boolean; begun?: boolean; tokens: BoardTokens }

export interface ResearchState {
  v: 2;
  scanned: string[];
  known: Aspect[];
  lore: Aspects;
  entries: Record<string, EntryState>;
  /**
   * Flags granted besides a finished entry. Late aspects (`spark`, `soul`, `void`) are drawn only when their name is
   * here or on a finished entry. Omitted when empty; not a research entry of its own.
   */
  flags?: string[];
}

export const freshResearch = (): ResearchState => ({ v: 2, scanned: [], known: [...STARTING_ASPECTS], lore: {}, entries: {} });

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

/** locked: an earlier research is missing; open: can be started; begun: the notes exist; done: learned. */
export type EntryStatus = 'locked' | 'open' | 'begun' | 'done';
export const entryStatus = (s: ResearchState, e: ResearchEntry): EntryStatus =>
  isDone(s, e.key) ? 'done' : !isOpen(s, e) ? 'locked' : s.entries[e.key]?.begun ? 'begun' : 'open';

/** What starting the notes still needs: aspects you lack the lore (or the knowledge) for. */
export function beginShortfall(s: ResearchState, e: ResearchEntry): Aspect[] {
  return (Object.keys(e.cost) as Aspect[]).filter((a) => !s.known.includes(a) || (s.lore[a] ?? 0) < (e.cost[a] ?? 0));
}

/** Starts a research's notes: pays one lore of each anchor aspect. */
export function beginResearch(s: ResearchState, key: string): PlaceResult {
  const e = researchEntry(key);
  if (!e || !e.board) return { ok: false, reason: 'Nothing to research' };
  if (isDone(s, key)) return { ok: false, reason: 'Already learned' };
  if (!isOpen(s, e)) return { ok: false, reason: 'Finish the earlier research first' };
  if (s.entries[key]?.begun) return { ok: true };
  const short = beginShortfall(s, e);
  if (short.length) return { ok: false, reason: `You need lore of ${short.map((a) => aspectInfo(a).name).join(', ')}: scan more things` };
  for (const [a, n] of Object.entries(e.cost) as [Aspect, number][]) s.lore[a] = (s.lore[a] ?? 0) - n;
  entryState(s, key).begun = true;
  return { ok: true };
}

/** The compound two aspects make, or null. */
export function compoundOf(a: Aspect, b: Aspect): Aspect | null {
  return ASPECTS.find((x) => x.parts && ((x.parts[0] === a && x.parts[1] === b) || (x.parts[0] === b && x.parts[1] === a)))?.key ?? null;
}

/** Combines one lore each of two aspects into one of their compound (learning it if new). */
export function combineAspects(s: ResearchState, a: Aspect, b: Aspect): PlaceResult & { made?: Aspect } {
  const c = compoundOf(a, b);
  if (!c) return { ok: false, reason: `${aspectInfo(a).name} and ${aspectInfo(b).name} make nothing together` };
  if ((s.lore[a] ?? 0) < 1 || (s.lore[b] ?? 0) < 1) return { ok: false, reason: 'You need one lore of each' };
  s.lore[a] = (s.lore[a] ?? 0) - 1;
  s.lore[b] = (s.lore[b] ?? 0) - 1;
  s.lore[c] = (s.lore[c] ?? 0) + 1;
  if (!s.known.includes(c)) s.known.push(c);
  return { ok: true, made: c };
}

export interface PlaceResult { ok: boolean; reason?: string; solved?: boolean }

/** Writes (or overwrites) an aspect on the notes: spends 1 lore of it. An overwritten aspect is lost, as with erasing. */
export function placeToken(s: ResearchState, key: string, cell: number, aspect: Aspect): PlaceResult {
  const e = researchEntry(key);
  if (!e || !e.board) return { ok: false, reason: 'Nothing to place on' };
  if (!isOpen(s, e)) return { ok: false, reason: 'Finish the earlier research first' };
  if (isDone(s, key)) return { ok: false, reason: 'Already done' };
  if (!s.entries[key]?.begun) return { ok: false, reason: 'Start the research notes first' };
  if (!cellFree(e.board, cell)) return { ok: false, reason: 'That spot is fixed' };
  if (!s.known.includes(aspect)) return { ok: false, reason: 'You do not know that aspect yet' };
  if ((s.lore[aspect] ?? 0) < 1) return { ok: false, reason: `No ${aspect} lore left: scan new things` };
  const st = entryState(s, key);
  s.lore[aspect] = (s.lore[aspect] ?? 0) - 1;
  st.tokens[cell] = aspect;
  if (boardSolved(e.board, st.tokens)) {
    st.done = true;
    return { ok: true, solved: true };
  }
  return { ok: true, solved: false };
}

/** Erases an aspect from the notes. Its lore is spent: nothing comes back. */
export function removeToken(s: ResearchState, key: string, cell: number): boolean {
  const st = s.entries[key];
  const a = st?.tokens[cell];
  if (!st || !a || st.done) return false;
  delete st.tokens[cell];
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
  (s.flags?.includes(flag) ?? false) || RESEARCH.some((e) => isDone(s, e.key) && (e.unlocks.flags ?? []).includes(flag));

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
      const v1 = r.v !== 2;
      const done = ev.done === true;
      // A v1 save's half-written boards were on the old 5 x 5 grid: their cells mean nothing on the hexagon.
      s.entries[k] = { done, tokens: v1 && !done ? {} : tokens };
      if (!v1 && ev.begun === true && !done) s.entries[k].begun = true;
    }
  if (Array.isArray(r.flags)) {
    const flags = r.flags.filter((f): f is string => typeof f === 'string').slice(0, 32);
    if (flags.length) s.flags = [...new Set(flags)];
  }
  return s;
}
