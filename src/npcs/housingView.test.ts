import { describe, expect, it } from 'vitest';
import type { RoomCheck } from './housing';
import { CAMP, assignRoom, evictBroken, nextInLine, roomViews, type RoomInput } from './housingView';
import type { Newcomer } from './moveIn';

const ok = (cells = 25): RoomCheck => ({ ok: true, reasons: [], cells });
const bad = (...reasons: string[]): RoomCheck => ({ ok: false, reasons, cells: 10 });

const rooms: RoomInput[] = [
  { id: 'a', check: ok() },
  { id: 'b', check: ok() },
  { id: 'c', check: bad('needs a light') },
];

describe('roomViews', () => {
  it('shows free, taken and invalid rooms with reasons', () => {
    const views = roomViews(rooms, { rosa: 'a' });
    expect(views).toEqual([
      { id: 'a', state: 'taken', occupant: 'rosa', reasons: [], cells: 25 },
      { id: 'b', state: 'free', occupant: null, reasons: [], cells: 25 },
      { id: 'c', state: 'invalid', occupant: null, reasons: ['needs a light'], cells: 10 },
    ]);
  });

  it('keeps the resident shown in a room that became invalid', () => {
    const views = roomViews([{ id: 'a', check: bad('not enclosed') }], { gruk: 'a' });
    expect(views[0]).toMatchObject({ state: 'invalid', occupant: 'gruk', reasons: ['not enclosed'] });
  });
});

describe('nextInLine', () => {
  const line: Newcomer[] = [
    { id: 'rosa', triggerMet: false, reputationOk: true, eligible: false },
    { id: 'gruk', triggerMet: true, reputationOk: true, eligible: true },
  ];

  it('says free room when there is none', () => {
    expect(nextInLine(line, false)).toEqual({ id: 'rosa', waitingFor: 'free room' });
  });

  it('says reputation before trigger', () => {
    const low: Newcomer[] = [{ id: 'mara', triggerMet: false, reputationOk: false, eligible: false }];
    expect(nextInLine(low, true)).toEqual({ id: 'mara', waitingFor: 'reputation' });
  });

  it('says trigger when reputation is fine', () => {
    expect(nextInLine(line, true)).toEqual({ id: 'rosa', waitingFor: 'trigger' });
  });

  it('gives null waitingFor when they can come', () => {
    expect(nextInLine([line[1]], true)).toEqual({ id: 'gruk', waitingFor: null });
  });

  it('is null for an empty line', () => {
    expect(nextInLine([], true)).toBeNull();
  });
});

describe('assignRoom', () => {
  it('assigns a free valid room', () => {
    const r = assignRoom({}, 'rosa', 'b', rooms);
    expect(r).toEqual({ ok: true, occupancy: { rosa: 'b' } });
  });

  it('refuses an invalid room', () => {
    expect(assignRoom({}, 'rosa', 'c', rooms)).toEqual({ ok: false, reason: 'room is invalid' });
  });

  it('refuses a room taken by someone else', () => {
    expect(assignRoom({ gruk: 'a' }, 'rosa', 'a', rooms)).toEqual({ ok: false, reason: 'room is taken' });
  });

  it('refuses a room that does not exist', () => {
    expect(assignRoom({}, 'rosa', 'zz', rooms)).toEqual({ ok: false, reason: 'no such room' });
  });

  it('lets a person keep their own room and move to camp', () => {
    expect(assignRoom({ rosa: 'a' }, 'rosa', 'a', rooms)).toEqual({ ok: true, occupancy: { rosa: 'a' } });
    expect(assignRoom({ rosa: 'a' }, 'rosa', CAMP, rooms)).toEqual({ ok: true, occupancy: { rosa: CAMP } });
  });
});

describe('evictBroken', () => {
  it('moves a resident of a broken room to the first free valid room', () => {
    const broken: RoomInput[] = [{ id: 'a', check: bad('not enclosed') }, { id: 'b', check: ok() }];
    const r = evictBroken({ rosa: 'a' }, broken);
    expect(r.occupancy).toEqual({ rosa: 'b' });
    expect(r.moved).toEqual([{ personId: 'rosa', from: 'a', to: 'b' }]);
  });

  it('sends them to camp when no free valid room is left', () => {
    const r = evictBroken({ rosa: 'a', gruk: 'b' }, [{ id: 'a', check: bad('not enclosed') }, { id: 'b', check: ok() }]);
    expect(r.occupancy).toEqual({ rosa: CAMP, gruk: 'b' });
    expect(r.moved).toEqual([{ personId: 'rosa', from: 'a', to: CAMP }]);
  });

  it('moves a resident whose room no longer exists', () => {
    const r = evictBroken({ mara: 'gone' }, [{ id: 'b', check: ok() }]);
    expect(r.occupancy).toEqual({ mara: 'b' });
  });

  it('leaves residents in valid rooms and camp alone', () => {
    const occ = { rosa: 'a', gruk: CAMP };
    const r = evictBroken(occ, [{ id: 'a', check: ok() }]);
    expect(r.occupancy).toEqual(occ);
    expect(r.moved).toEqual([]);
  });
});
