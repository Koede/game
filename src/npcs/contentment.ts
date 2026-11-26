/**
 * Contentment (docs/plans/just-you-and-orrin.md, "Borrowed from Terraria's town NPCs", items 4 and 5): each person likes or dislikes
 * some neighbours and some surroundings. The score is a pure function of those facts, bounded to [-1, 1], and only nudges things:
 * shop prices, tips, how often favours are pinned, and how warm their lines are. Contentment never blocks anything.
 *
 * Harm (item 5): a person knocked down is away until the next morning. Their room is kept (the state records the room id; nothing
 * here touches the world). Pure: every function returns new state rather than mutating it.
 */

export const PEOPLE = ['orrin', 'rosa', 'gruk', 'mara', 'bram', 'veyra'] as const;
export type PersonId = (typeof PEOPLE)[number];

export const TAGS = ['hearth', 'trees', 'water', 'fumes', 'forge', 'crowded', 'quiet'] as const;
export type Tag = (typeof TAGS)[number];

/** A like or dislike is either a neighbour (a person id) or a surrounding (a tag). */
export type Subject = PersonId | Tag;

export interface Taste {
  likes: readonly Subject[];
  dislikes: readonly Subject[];
  /** Bonus for having a few folk close by (never a crowd). Zero for most people. */
  company?: number;
}

/**
 * Likes and dislikes. `fumes` is what Veyra's still gives off, so Gruk's dislike of "Veyra's fumes" is the fumes tag.
 * Bram's hermit lines (he complains Gruk snores through the wall) give him the dislike of Gruk.
 */
export const TASTES: Readonly<Record<PersonId, Taste>> = {
  orrin: { likes: ['forge', 'gruk'], dislikes: ['fumes'], company: 0.3 },
  rosa: { likes: ['hearth', 'gruk'], dislikes: ['quiet'] },
  gruk: { likes: ['forge', 'rosa'], dislikes: ['fumes'] },
  mara: { likes: ['trees', 'quiet'], dislikes: ['forge'] },
  bram: { likes: ['quiet', 'trees'], dislikes: ['crowded', 'gruk'] },
  veyra: { likes: ['water', 'quiet'], dislikes: ['forge'] },
};

export const NAMES: Readonly<Record<PersonId, string>> = {
  orrin: 'Orrin',
  rosa: 'Rosa',
  gruk: 'Gruk',
  mara: 'Mara',
  bram: 'Old Bram',
  veyra: 'Veyra',
};

const TAG_TEXT: Readonly<Record<Tag, string>> = {
  hearth: 'the hearth',
  trees: 'the trees',
  water: 'the water',
  fumes: 'the fumes',
  forge: 'the forge',
  crowded: 'the crowding',
  quiet: 'the quiet',
};

/** Residents close by above this count make a place crowded. */
export const CROWD_LIMIT = 3;

const NEIGHBOUR_WEIGHT = 0.35;
const TAG_WEIGHT = 0.3;
const CROWD_STEP = 0.25;
const CROWD_CAP = 0.75;
const WARMTH_CAP = 0.3;

export interface Facts {
  /** Ids of people within the radius (the person themself is not in this list). */
  neighbours: readonly PersonId[];
  /** Surrounding tags that apply to this person's spot. */
  tags: ReadonlySet<Tag>;
  /** Residents within the radius, not counting the person. */
  residentsNearby: number;
  /** Degrees C the person's room is warmer (+) or colder (-) than outside; absent or NaN counts as 0 (src/npcs/warmth.ts warmthDelta, when it exists). */
  warmth?: number;
}

export interface Contentment {
  /** In [-1, 1]. */
  score: number;
  /** Short lines for the UI, e.g. 'likes living near Gruk'. */
  reasons: string[];
}

const isPerson = (s: Subject): s is PersonId => (PEOPLE as readonly string[]).includes(s);

const clampScore = (s: number): number => (Number.isFinite(s) ? Math.max(-1, Math.min(1, s)) : 0);

export function contentment(person: PersonId, facts: Facts): Contentment {
  const taste = TASTES[person];
  const reasons: string[] = [];
  let raw = 0;

  const neighbours = new Set(facts.neighbours);
  const apply = (subject: Subject, sign: 1 | -1): void => {
    const hit = isPerson(subject) ? neighbours.has(subject) : facts.tags.has(subject);
    if (!hit) return;
    const weight = isPerson(subject) ? NEIGHBOUR_WEIGHT : TAG_WEIGHT;
    raw += sign * weight;
    const name = isPerson(subject) ? `living near ${NAMES[subject]}` : `${TAG_TEXT[subject]} nearby`;
    reasons.push(`${sign > 0 ? 'likes' : 'dislikes'} ${name}`);
  };

  for (const s of taste.likes) apply(s, 1);
  for (const s of taste.dislikes) apply(s, -1);

  if (facts.residentsNearby > CROWD_LIMIT) {
    raw -= Math.min(CROWD_CAP, CROWD_STEP * (facts.residentsNearby - CROWD_LIMIT));
    reasons.push(`crowded: ${facts.residentsNearby} residents nearby`);
  } else if (facts.residentsNearby >= 1 && (taste.company ?? 0) > 0) {
    raw += taste.company ?? 0;
    reasons.push('likes having folk close by');
  }

  const w = facts.warmth;
  if (typeof w === 'number' && Number.isFinite(w) && w !== 0) {
    // A warm room is a comfort (up to +0.3 at +15 C), a room colder than outside a grievance (down to -0.3).
    const bump = Math.max(-WARMTH_CAP, Math.min(WARMTH_CAP, w * 0.02));
    raw += bump;
    if (Math.abs(bump) >= 0.05) reasons.push(bump > 0 ? 'likes the warm room' : 'dislikes the cold room');
  }

  return { score: clampScore(Math.tanh(raw)), reasons };
}

/** Shop prices: content means cheaper. Within [0.85, 1.2]. */
export function priceFactor(score: number): number {
  const s = clampScore(score);
  return s >= 0 ? 1 - 0.15 * s : 1 - 0.2 * s;
}

/** Tips. Within [0.5, 1.5]. */
export function tipFactor(score: number): number {
  return 1 + 0.5 * clampScore(score);
}

/** How often they pin favours. Within [0.5, 1.5]. */
export function favourRate(score: number): number {
  return 1 + 0.5 * clampScore(score);
}

export type LineTone = 'warm' | 'neutral' | 'grumpy';

/** A grumpy flag (the day someone comes back after harm) forces a grumpy tone. */
export function lineTone(score: number, grumpy = false): LineTone {
  if (grumpy) return 'grumpy';
  const s = clampScore(score);
  if (s >= 0.25) return 'warm';
  if (s <= -0.25) return 'grumpy';
  return 'neutral';
}

export interface ContentmentState {
  /** Day each person was knocked down; absent when they are not away. */
  away: Partial<Record<PersonId, number>>;
  /** Room id each person lives in. Kept through a knock-down. */
  rooms: Partial<Record<PersonId, string>>;
}

export const freshContentment = (): ContentmentState => ({ away: {}, rooms: {} });

/** Marks the person away from `day` on. Returns new state. */
export function knockDown(state: ContentmentState, person: PersonId, day: number): ContentmentState {
  return { ...state, away: { ...state.away, [person]: day } };
}

/** The day whose morning they come back: the day after the knock-down. Null when they were not knocked down. */
export function returnsOn(state: ContentmentState, person: PersonId): number | null {
  const day = state.away[person];
  return day === undefined ? null : day + 1;
}

/** True on the knock-down day, false from the morning after. */
export function isAway(state: ContentmentState, person: PersonId, day: number): boolean {
  const knocked = state.away[person];
  return knocked !== undefined && day >= knocked && day < knocked + 1;
}

/** True only on the morning they come back: pass this to lineTone(score, grumpy). */
export function isGrumpy(state: ContentmentState, person: PersonId, day: number): boolean {
  const back = returnsOn(state, person);
  return back !== null && day === back;
}

/** Records the room a person lives in. Returns new state. */
export function assignRoom(state: ContentmentState, person: PersonId, roomId: string): ContentmentState {
  return { ...state, rooms: { ...state.rooms, [person]: roomId } };
}

/** The room a person lives in, still set while they are away. */
export function roomOf(state: ContentmentState, person: PersonId): string | null {
  return state.rooms[person] ?? null;
}
