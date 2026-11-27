/**
 * The nightly move-in roll (docs/plans/just-you-and-orrin.md). Pure: the caller keeps the state, passes a seeded rng and
 * applies the arrivals. Each night, every free room gets one roll, in order, until one person moves in; a room never
 * takes anyone on the night it was finished.
 */

export const MOVE_IN_BASE = 0.04;
export const MOVE_IN_GROWTH = 0.02;
export const MOVE_IN_CAP = 0.3;

/**
 * Chance that a person moves into a room tonight. `emptyNights` counts the nights the room has already stood empty before
 * tonight's roll: 0 is the room's first night (always 0), 1 is the next night (base), and each night after adds the growth,
 * capped.
 */
export function moveInChance(emptyNights: number): number {
  if (emptyNights <= 0) return 0;
  return Math.min(MOVE_IN_CAP, MOVE_IN_BASE + MOVE_IN_GROWTH * (emptyNights - 1));
}

// ---------------------------------------------------------------------------------------------
// Who comes, in what order, and on what trigger
// ---------------------------------------------------------------------------------------------

export type Trigger = 'hearth' | 'first_bronze' | 'first_magic' | 'three_residents' | 'alchemy';

/** What the town has done so far, as the triggers see it. */
export interface TownFacts {
  /** The common room has a hearth. */
  hearth: boolean;
  /** The player made their first bronze. */
  firstBronze: boolean;
  /** The player first met magic (an aspect vial or a shrine). */
  firstMagic: boolean;
  /** Residents in the town (not counting Orrin). */
  residents: number;
  /** The player reached alchemy and the distillery. */
  alchemy: boolean;
}

export const RESIDENTS_FOR_BRAM = 3;

export function triggerMet(trigger: Trigger, facts: TownFacts): boolean {
  switch (trigger) {
    case 'hearth':
      return facts.hearth;
    case 'first_bronze':
      return facts.firstBronze;
    case 'first_magic':
      return facts.firstMagic;
    case 'three_residents':
      return facts.residents >= RESIDENTS_FOR_BRAM;
    case 'alchemy':
      return facts.alchemy;
  }
}

export interface ArrivalSpec {
  id: string;
  name: string;
  trigger: Trigger;
}

/** The line, first to last. Gruk is the builder and lives at the camp from the start, so he is not in it; Orrin takes the second place. */
export const ARRIVALS: readonly ArrivalSpec[] = [
  { id: 'rosa', name: 'Rosa', trigger: 'hearth' },
  { id: 'orrin', name: 'Orrin', trigger: 'first_bronze' },
  { id: 'mara', name: 'Mara', trigger: 'first_magic' },
  { id: 'bram', name: 'Old Bram', trigger: 'three_residents' },
  { id: 'veyra', name: 'Veyra', trigger: 'alchemy' },
];

/** One person in the line. `eligible` is triggerMet and reputationOk together. */
export interface Newcomer {
  id: string;
  triggerMet: boolean;
  reputationOk: boolean;
  eligible: boolean;
}

/**
 * The line with each person's flags. `thresholds` gives the reputation each person needs (missing means 0).
 * Callers drop the people who have already arrived.
 */
export function newcomerLine(facts: TownFacts, reputation: number, thresholds: Readonly<Record<string, number>> = {}): Newcomer[] {
  return ARRIVALS.map((a) => {
    const triggerOk = triggerMet(a.trigger, facts);
    const reputationOk = reputation >= (thresholds[a.id] ?? 0);
    return { id: a.id, triggerMet: triggerOk, reputationOk, eligible: triggerOk && reputationOk };
  });
}

// ---------------------------------------------------------------------------------------------
// The roll
// ---------------------------------------------------------------------------------------------

export interface FreeRoom {
  id: string;
  /** Nights the room has stood empty before tonight's roll. A room finished today has 0. */
  emptyNights: number;
}

export interface MoveInState {
  /** Ids of people who have already moved in, in order. */
  arrived: readonly string[];
}

export interface Arrival {
  personId: string;
  roomId: string;
}

export interface NightResult {
  arrival: Arrival | null;
  /** The rooms still free after the night, each with one more empty night (the arrived room is gone). */
  rooms: FreeRoom[];
  state: MoveInState;
}

function ageRooms(rooms: readonly FreeRoom[], filled: string | null): FreeRoom[] {
  return rooms.filter((r) => r.id !== filled).map((r) => ({ id: r.id, emptyNights: r.emptyNights + 1 }));
}

/**
 * One night. The first eligible person not yet arrived is the one in line; the free rooms are rolled in order, one roll
 * each, and the first success takes them. At most one arrival.
 */
/** Word of a festival the player took part in travels: the night after it, each room's move-in chance is this many times higher. */
export const FESTIVAL_DRAW = 3;
/** ... but never above this. */
export const FESTIVAL_DRAW_CAP = 0.6;

export function rollNight(state: MoveInState, rooms: readonly FreeRoom[], people: readonly Newcomer[], rng: () => number, draw = 1): NightResult {
  const next = people.find((p) => p.eligible && !state.arrived.includes(p.id));
  if (!next) return { arrival: null, rooms: ageRooms(rooms, null), state };
  for (const room of rooms) {
    const chance = draw > 1 ? Math.min(FESTIVAL_DRAW_CAP, moveInChance(room.emptyNights) * draw) : moveInChance(room.emptyNights);
    if (rng() < chance) {
      return {
        arrival: { personId: next.id, roomId: room.id },
        rooms: ageRooms(rooms, room.id),
        state: { arrived: [...state.arrived, next.id] },
      };
    }
  }
  return { arrival: null, rooms: ageRooms(rooms, null), state };
}

export interface DatedArrival extends Arrival {
  /** 1-based night within the rollNights call. */
  night: number;
}

/** Rolls `n` nights one by one (time away counts each night that passed). */
export function rollNights(
  n: number,
  state: MoveInState,
  rooms: readonly FreeRoom[],
  people: readonly Newcomer[],
  rng: () => number,
): { arrivals: DatedArrival[]; rooms: FreeRoom[]; state: MoveInState } {
  const arrivals: DatedArrival[] = [];
  let cur = state;
  let free: FreeRoom[] = [...rooms];
  for (let night = 1; night <= n; night++) {
    const r = rollNight(cur, free, people, rng);
    if (r.arrival) arrivals.push({ ...r.arrival, night });
    cur = r.state;
    free = r.rooms;
  }
  return { arrivals, rooms: free, state: cur };
}
