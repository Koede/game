/**
 * Pure data for the housing view (docs/plans/just-you-and-orrin.md): each room as free, taken or invalid, the next person
 * in line and what they wait for, and the rules for assigning and evicting residents. No rendering here.
 */
import type { RoomCheck } from './housing';
import type { Newcomer } from './moveIn';

export const CAMP = 'camp';

/** Person id to room id, or CAMP. A person missing from the map is at camp too. */
export type Occupancy = Readonly<Record<string, string>>;

export interface RoomInput {
  id: string;
  check: RoomCheck;
}

export interface RoomView {
  id: string;
  state: 'free' | 'taken' | 'invalid';
  /** The resident, when there is one (also shown for an invalid room that is still lived in). */
  occupant: string | null;
  reasons: string[];
  cells: number;
}

const occupantOf = (occupancy: Occupancy, roomId: string): string | null => {
  for (const [person, room] of Object.entries(occupancy)) if (room === roomId) return person;
  return null;
};

/** Each room as the view shows it. An invalid room says why, whoever lives there. */
export function roomViews(rooms: readonly RoomInput[], occupancy: Occupancy): RoomView[] {
  return rooms.map(({ id, check }) => {
    const occupant = occupantOf(occupancy, id);
    if (!check.ok) return { id, state: 'invalid', occupant, reasons: [...check.reasons], cells: check.cells };
    return { id, state: occupant ? 'taken' : 'free', occupant, reasons: [], cells: check.cells };
  });
}

export type WaitingFor = 'free room' | 'reputation' | 'trigger';

export interface NextInLine {
  id: string;
  /** null when nothing holds them back: they can come on the next roll. */
  waitingFor: WaitingFor | null;
}

/**
 * The first person in the (not yet arrived) line and what holds them back. Order of blockers: no free room first, then
 * reputation, then the trigger.
 */
export function nextInLine(line: readonly Newcomer[], hasFreeRoom: boolean): NextInLine | null {
  const first = line[0];
  if (!first) return null;
  if (!hasFreeRoom) return { id: first.id, waitingFor: 'free room' };
  if (!first.reputationOk) return { id: first.id, waitingFor: 'reputation' };
  if (!first.triggerMet) return { id: first.id, waitingFor: 'trigger' };
  return { id: first.id, waitingFor: null };
}

export type AssignResult =
  | { ok: true; occupancy: Occupancy }
  | { ok: false; reason: 'no such room' | 'room is invalid' | 'room is taken' };

/**
 * Moves a person into a room. Moving to CAMP always works. Refuses rooms that do not exist, fail the check, or are lived in
 * by someone else. Moving into the room they already have is a no-op.
 */
export function assignRoom(occupancy: Occupancy, personId: string, roomId: string, rooms: readonly RoomInput[]): AssignResult {
  if (roomId === CAMP) return { ok: true, occupancy: { ...occupancy, [personId]: CAMP } };
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, reason: 'no such room' };
  if (!room.check.ok) return { ok: false, reason: 'room is invalid' };
  const who = occupantOf(occupancy, roomId);
  if (who !== null && who !== personId) return { ok: false, reason: 'room is taken' };
  return { ok: true, occupancy: { ...occupancy, [personId]: roomId } };
}

export interface Eviction {
  personId: string;
  from: string;
  /** A free valid room, or CAMP when none is free. */
  to: string;
}

/**
 * Residents whose room is no longer valid (or no longer exists) move to the first free valid room, or to camp. Residents
 * whose room is still fine do not move. Rooms already taken by a resident are not free.
 */
export function evictBroken(occupancy: Occupancy, rooms: readonly RoomInput[]): { occupancy: Occupancy; moved: Eviction[] } {
  let occ: Record<string, string> = { ...occupancy };
  const moved: Eviction[] = [];
  const valid = new Map(rooms.map((r) => [r.id, r.check.ok] as const));
  const broken = Object.entries(occupancy).filter(([, room]) => room !== CAMP && valid.get(room) !== true);
  for (const [personId, from] of broken) {
    const free = rooms.find((r) => r.check.ok && occupantOf(occ, r.id) === null);
    const to = free ? free.id : CAMP;
    occ = { ...occ, [personId]: to };
    moved.push({ personId, from, to });
  }
  return { occupancy: occ, moved };
}
