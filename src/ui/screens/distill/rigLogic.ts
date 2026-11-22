/**
 * DOM-free rig screen (docs/DISTILLERY_PLAN.md §15.1): the problem list a tap highlights, what the
 * standing glassware can do, and the ghost cells of a process card's rig string.
 *
 * A card's rig is one layer per '/' , top layer first; each layer is a row along +x. The preview is
 * stood on the block the wrench hit, on the copy of that block the rest of the world already agrees
 * with. Cells that match (a `_done` twin counts) are left out. Air is `missing`; anything else is `wrong`.
 */
import { RIG_LEGEND, PROCESS_CARDS, type ProcessCard } from '../../../content/recipesDistill';
import { chemKindOf } from '../../../core/distill';
import { WORLD_HEIGHT } from '../../../core/types';
import type { Rig, RigProblem } from '../../../sim/distillScan';

/** Overlay key. One preview; showing it again replaces it. Cleared when the screen closes. */
export const DISTILL_GHOST_KEY = 'distill';

/** Seconds a tapped problem block pulses (`highlight:block`). */
export const DISTILL_HIGHLIGHT_S = 6;

export interface GhostCell {
  x: number;
  y: number;
  z: number;
  block: string;
  state: 'missing' | 'wrong';
}

export interface ProblemGroup {
  text: string;
  /** Blocks a tap cycles through, in the order the scan named them. */
  at: Array<{ x: number; y: number; z: number }>;
}

export interface CardChoice {
  id: string;
  title: string;
  detail: string;
  rig: string;
}

/** The payload the process picker emits on `ghost:show`. */
export function ghostPayload(cells: readonly GhostCell[]): { key: typeof DISTILL_GHOST_KEY; cells: GhostCell[] } {
  return { key: DISTILL_GHOST_KEY, cells: cells.slice() };
}

/** The payload the screen emits on `ghost:clear` when it closes. */
export function ghostClear(): { key: typeof DISTILL_GHOST_KEY } {
  return { key: DISTILL_GHOST_KEY };
}

/** The payload a problem tap emits on `highlight:block`. */
export function highlightPayload(at: { x: number; y: number; z: number }): { x: number; y: number; z: number; seconds: number } {
  return { x: at.x, y: at.y, z: at.z, seconds: DISTILL_HIGHLIGHT_S };
}

const TITLES: Readonly<Record<string, string>> = {
  distil_syrup: 'Pine syrup',
  ferment_wash: 'Ferment wash',
  distil_low_wines: 'Low wines',
  distil_spirit: 'Spirit',
  refine_crude: 'Refine crude',
  rectify_spirit: 'Fuel ethanol',
  refine_crude_short: 'Short crude column',
};

export function cardTitle(card: Pick<ProcessCard, 'id'>): string {
  return TITLES[card.id] ?? card.id.replace(/_/g, ' ');
}

/** Process cards whose rig uses this block (a `_done` twin counts as its plain kind). */
export function cardChoices(blockKey: string): CardChoice[] {
  const kind = chemKindOf(blockKey);
  if (!kind) return [];
  const letters = new Set(Object.entries(RIG_LEGEND).filter(([, block]) => block === kind).map(([ch]) => ch));
  const out: CardChoice[] = [];
  for (const card of PROCESS_CARDS) {
    if (![...card.rig].some((ch) => letters.has(ch))) continue;
    out.push({
      id: card.id,
      title: cardTitle(card),
      detail: card.station === 'reaction_vessel' ? 'Sealed vessel' : `${card.minTempC} °C on the still base`,
      rig: card.rig,
    });
  }
  return out;
}

/** Problems in scan order. Identical sentences fold into one row; taps walk that row's blocks. */
export function problemGroups(problems: readonly Pick<RigProblem, 'text' | 'cells'>[]): ProblemGroup[] {
  const out: ProblemGroup[] = [];
  for (const problem of problems) {
    const at: ProblemGroup['at'] = [];
    for (const key of problem.cells) {
      const cell = parseCell(key);
      if (cell) at.push(cell);
    }
    const group = out.find((g) => g.text === problem.text);
    if (group) group.at.push(...at);
    else out.push({ text: problem.text, at });
  }
  return out;
}

/**
 * What the standing rig can do, in one sentence.
 * A still distils once it has a condenser. Cuts are the taller of its column and its outlets
 * (a pot still is 1 cut; a column of three segments is 3). A capped vessel ferments. A jacket
 * on a condenser cools it.
 */
export function capabilityText(rig: Pick<Rig, 'stills' | 'sealed' | 'jackets'>): string {
  const parts: string[] = [];
  let cuts = 0;
  let distil = false;
  for (const still of rig.stills) {
    const outlets = still.draws.length + (still.head ? 1 : 0);
    if (outlets <= 0) continue;
    distil = true;
    cuts = Math.max(cuts, Math.max(still.segments.length, outlets));
  }
  if (distil) {
    parts.push('distil');
    parts.push(cuts === 1 ? '1 cut' : `${cuts} cuts`);
  }
  if (rig.sealed.size > 0) parts.push('ferment');
  if (rig.jackets.size > 0) parts.push('cooled');
  if (parts.length === 0) return 'This rig can: nothing yet.';
  return `This rig can: ${parts.join(', ')}.`;
}

export interface BlockReader {
  getBlock(x: number, y: number, z: number): { key: string };
}

/**
 * Ghost cells for `rig` stood on the block at `at`.
 * Empty when that block is not a piece of this rig string.
 */
export function ghostCells(world: BlockReader, at: { x: number; y: number; z: number }, rig: string): GhostCell[] {
  const kind = chemKindOf(blockKeyAt(world, at.x, at.y, at.z));
  if (!kind) return [];
  const cells = relativeCells(rig);
  const anchors = cells.filter((cell) => cell.block === kind);
  if (anchors.length === 0) return [];
  let best = anchors[0];
  let bestScore = -1;
  for (const anchor of anchors) {
    const ox = at.x - anchor.dx;
    const oy = at.y - anchor.dy;
    let score = 0;
    for (const cell of cells) {
      if (sameKind(blockKeyAt(world, ox + cell.dx, oy + cell.dy, at.z), cell.block)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = anchor;
    }
  }
  const ox = at.x - best.dx;
  const oy = at.y - best.dy;
  const ghosts: GhostCell[] = [];
  for (const cell of cells) {
    const x = ox + cell.dx;
    const y = oy + cell.dy;
    const z = at.z;
    const key = blockKeyAt(world, x, y, z);
    if (sameKind(key, cell.block)) continue;
    ghosts.push({ x, y, z, block: cell.block, state: key === 'air' ? 'missing' : 'wrong' });
  }
  return ghosts;
}

/** "3 missing, 1 wrong", or a line when the card's rig already stands. */
export function ghostSummary(cells: readonly GhostCell[]): string {
  if (cells.length === 0) return 'Every block of this process is in place.';
  let missing = 0;
  let wrong = 0;
  for (const cell of cells) {
    switch (cell.state) {
      case 'missing':
        missing++;
        break;
      case 'wrong':
        wrong++;
        break;
      default: {
        const exhaustive: never = cell.state;
        return exhaustive;
      }
    }
  }
  const parts: string[] = [];
  if (missing > 0) parts.push(`${missing} missing`);
  if (wrong > 0) parts.push(`${wrong} wrong`);
  return parts.join(', ');
}

interface RelativeCell {
  dx: number;
  dy: number;
  block: string;
}

/** Bottom layer at dy 0, leftmost column at dx 0. Dots and unknown letters are air and drop out. */
function relativeCells(rig: string): RelativeCell[] {
  const layers = rig.split('/').reverse();
  const cells: RelativeCell[] = [];
  layers.forEach((row, dy) => {
    [...row].forEach((ch, dx) => {
      const block = RIG_LEGEND[ch];
      if (block) cells.push({ dx, dy, block });
    });
  });
  return cells;
}

function blockKeyAt(world: BlockReader, x: number, y: number, z: number): string {
  if (y < 0 || y >= WORLD_HEIGHT) return 'air';
  return world.getBlock(x, y, z).key;
}

/** The plain module kind: `boiling_flask_done` matches `boiling_flask`. */
function sameKind(worldKey: string, want: string): boolean {
  return chemKindOf(worldKey) === want;
}

function parseCell(key: string): { x: number; y: number; z: number } | null {
  const parts = key.split(',');
  if (parts.length !== 3) return null;
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const z = Number(parts[2]);
  if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)) return null;
  return { x, y, z };
}
