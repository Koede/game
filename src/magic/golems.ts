/**
 * Golem bodies (docs/api/magic.md): the clay servant and the three bodies it is upgraded to on the infusion altar. Each is a
 * block; the table gives what a body can do. Markers tell a body which containers to pull from and deliver to.
 */
export interface GolemBody {
  key: string;
  name: string;
  /** Chebyshev blocks it may walk from where it was placed. */
  range: number;
  /** Seconds of work one unit of Spring buys. */
  feedS: number;
  /** Items it carries on a haul run (0: it cannot haul). */
  carry: number;
  /** Cells it walks each second. */
  steps: number;
  trait: 'plain' | 'swift' | 'steady' | 'tireless';
  traitText: string;
}

export const GOLEMS: readonly GolemBody[] = [
  { key: 'clay_servant', name: 'Clay Servant', range: 8, feedS: 30, carry: 0, steps: 1, trait: 'plain', traitText: 'does one task a feed' },
  { key: 'wood_golem', name: 'Wood Golem', range: 10, feedS: 45, carry: 4, steps: 2, trait: 'swift', traitText: 'swift, two steps a second, hauls 4' },
  { key: 'stone_golem', name: 'Stone Golem', range: 8, feedS: 90, carry: 8, steps: 1, trait: 'steady', traitText: 'steady, a feed lasts three times as long, hauls 8' },
  { key: 'iron_golem', name: 'Iron Golem', range: 14, feedS: 75, carry: 16, steps: 2, trait: 'tireless', traitText: 'tireless, wide range, swift, hauls 16' },
];

export const golemBody = (blockKey: string): GolemBody | null => GOLEMS.find((g) => g.key === blockKey) ?? null;

/** A marker touching a container: the golem takes from a Pull marker's container and delivers to a Drop marker's. */
export const MARKER_PULL = 'golem_pull_marker';
export const MARKER_DROP = 'golem_drop_marker';
/** Blocks a golem may pull from and deliver to (the workshop's `take` / `offer` reach them). */
export const HAUL_CONTAINERS: ReadonlySet<string> = new Set(['crate', 'item_vault', 'depot']);
