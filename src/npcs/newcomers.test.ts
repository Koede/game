import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GameState } from '../app/state';
import { NpcManager, type NpcSnapshot } from './manager';
import { createBus } from '../core/context';
import { NPCS } from './data';

/** A new world whose lodge stands (the builder is stocked and run for days), then days run until someone moves in. */
let state: GameState;
let arrivalDay = 0;
const toasts: string[] = [];

beforeAll(() => {
  state = GameState.create(31, null);
  state.bus.on('toast', (t) => toasts.push(t.text));
  state.npcs.supplyLodge(4000);
  for (let n = 0; state.npcs.tavernLevel < 1 && n < 400000; n++) state.tick(1);
  const before = state.clock.day;
  for (let n = 0; !state.npcs.isPresent('rosa') && state.clock.day < before + 150; n++) state.tick(1);
  arrivalDay = state.clock.day - before;
}, 600000);

afterAll(() => state?.dispose());

describe('newcomers in a new world', () => {
  it('has the lodge, and the first newcomer (Rosa) moved into its bedroom after at least a night', () => {
    expect(state.npcs.tavernLevel).toBeGreaterThanOrEqual(1);
    expect(state.npcs.isPresent('rosa')).toBe(true);
    expect(arrivalDay).toBeGreaterThanOrEqual(1);
    expect(state.npcs.settlementDebug().occupancy.rosa).toMatch(/^lodge_[123]$/); // whichever free bedroom she rolled first
  });

  it('keeps the others waiting: Orrin needs bronze and a free room; nobody else came', () => {
    const d = state.npcs.settlementDebug();
    expect(d.present.sort()).toEqual(['gruk', 'rosa']);
    expect(d.line.find((n) => n.id === 'orrin')?.triggerMet).toBe(false);
  });

  it('announces the arrival and writes it in the journal', () => {
    expect(toasts.some((t) => t.includes('Rosa has moved into'))).toBe(true);
    expect(state.journal.has('town:arrived:rosa')).toBe(true);
  });

  it('reports the town on its page: who lives where, the room, who is next and why they wait', () => {
    const p = state.npcs.townPage();
    expect(p.active).toBe(true);
    expect(p.residents.map((r) => r.name)).toEqual(expect.arrayContaining(['Gruk', 'Rosa']));
    expect(p.residents.find((r) => r.id === 'rosa')?.home).toMatch(/bedroom$/);
    expect(p.rooms.find((r) => r.occupant === 'rosa')).toMatchObject({ state: 'taken' });
    expect(p.nextInLine?.id).toBe('orrin');
    expect(p.nextInLine?.text).toMatch(/bronze|free bedroom/);
    expect(p.standing.name).toBeTruthy();
    expect(p.goals.length).toBeGreaterThan(3);
    expect(p.goals.find((g) => g.id === 'first_newcomer')?.done).toBe(true);
  });

  it('shows the town chip and gives Rosa a contentment score within bounds', () => {
    expect(state.npcs.townChip()).not.toBeNull();
    const s = state.npcs.settlementDebug().scores.rosa;
    expect(s).toBeGreaterThanOrEqual(-1);
    expect(s).toBeLessThanOrEqual(1);
  });

  it('survives a save and load, and an old save without settlement data loads too', () => {
    const snap = JSON.parse(JSON.stringify(state.npcs.toJSON())) as NpcSnapshot;
    const a = new NpcManager(createBus());
    a.load(snap);
    expect(a.isPresent('rosa')).toBe(true);
    expect(a.settlementDebug().occupancy.rosa).toBe(state.npcs.settlementDebug().occupancy.rosa);
    const old: Partial<NpcSnapshot> = { ...snap };
    delete old.settle;
    delete old.goals;
    const b = new NpcManager(createBus());
    expect(() => b.load(old)).not.toThrow();
    expect(b.isPresent('rosa')).toBe(true);
  });

  it('moves Rosa by hand to a free room, and refuses Gruk and a missing room', () => {
    const now = state.npcs.settlementDebug().occupancy.rosa;
    const to = state.npcs.moveOptions('rosa').find((o) => o.id.startsWith('lodge_') && o.id !== now);
    expect(to).toBeTruthy();
    expect(state.npcs.moveResident('rosa', to!.id)).toEqual({ ok: true });
    expect(state.npcs.settlementDebug().occupancy.rosa).toBe(to!.id);
    expect(state.npcs.moveResident('gruk', to!.id).ok).toBe(false);
    expect(state.npcs.moveResident('rosa', 'lodge_9').ok).toBe(false);
    expect(state.npcs.townPage().residents.find((r) => r.id === 'rosa')?.moves.length).toBeGreaterThan(1);
  });

  it('knocks Rosa down in a blast: she is gone from view today and back in the morning', () => {
    const v = state.npcs.views().find((x) => x.id === 'rosa')!;
    state.bus.emit('explosion', { x: v.x, y: v.y, z: v.z, radius: 3 });
    expect(state.npcs.views().some((x) => x.id === 'rosa')).toBe(false);
    expect(state.npcs.speak({ ...(NPCS.find((n) => n.id === 'rosa')!) })).toBe('');
    const day = state.clock.day;
    for (let n = 0; state.clock.day === day && n < 3000; n++) state.tick(1);
    state.tick(1);
    expect(state.npcs.views().some((x) => x.id === 'rosa')).toBe(true);
  });

  it('a skipped stretch of nights is rolled one by one and never moves in more than the free rooms hold', () => {
    const came = state.npcs.skipNights(60);
    expect(came.length).toBeLessThanOrEqual(1); // one bedroom, one resident already: at most nobody
    expect(came).toEqual([]);
  });
});

describe('an old tavern world has no newcomers and no camp goals', () => {
  it('keeps all six people and rolls nobody', () => {
    const s = GameState.create(5, null);
    s.settleNpcs();
    for (let n = 0; n < 2000; n++) s.tick(1);
    expect(s.npcs.settlementDebug().line).toEqual([]);
    expect(s.npcs.settlementDebug().present.length).toBe(6);
    s.dispose();
  });
});
