/** Town polish (docs/plans/renormalize-2026-11-25.md, R1): the bay crate pays like the board, Gruk talks about the build, the
 * board guides "What next?", the camp bedrolls, hiring pauses the build, festival rest only where a festival can run, the
 * finished town, and the town events. */
import { describe, expect, it } from 'vitest';
import { Inventory } from '../game/inventory';
import { nudgeFor } from '../game/nextStep';
import { PlayerState } from '../game/playerState';
import { createBus } from '../core/context';
import { CAMP_BEDS } from './camp';
import { SEASON_DAYS } from './festival';
import { lifeRig } from './life.rig';
import { SLEEP_SAFE_R, sleepBlocked } from './rooms';
import { buildLine, missingWords, ORC_BUILD } from './scripts/orc';
import { TownBuilder, workDay, DAY_BUDGET, type TownHost, type TownSnapshot } from './townBuilder';

const GROUND = 40;

/** A life rig whose host can also build: flat grass at y = 40, a stock crate, and events recorded. */
function townRig(opts: { tod?: number; day?: number; held?: { item: string; count: number } | null } = {}) {
  const rig = lifeRig({ tod: opts.tod ?? 0.9, day: opts.day ?? 3, held: opts.held ?? null });
  const over = new Map<string, string>();
  const crate = new Inventory(27);
  const events: { type: string; e: unknown }[] = [];
  rig.bus.on('town:built', (e) => events.push({ type: 'built', e }));
  rig.bus.on('town:bounty', (e) => events.push({ type: 'bounty', e }));
  const h = rig.host;
  h.townSurface = () => ({ y: GROUND, key: 'grass' });
  h.townBlock = (x, y, z) => over.get(`${x},${y},${z}`) ?? (y < GROUND ? 'dirt' : y === GROUND ? 'grass' : 'air');
  h.townEdited = () => false;
  h.townPlace = (x, y, z, block) => (over.set(`${x},${y},${z}`, block), true);
  h.townCrate = () => crate;
  return { ...rig, over, crate, events };
}

/** One tick of the manager (plans the town at once, starts the storage bay and places the board). */
function tick(r: ReturnType<typeof townRig>, dt = 0.1): void {
  r.npcs.tick(dt);
}

describe('the storage bay crate pays like the board', () => {
  it('a deposit that matches an open bounty pays coin, standing and trust; anything else is plain stock', () => {
    const r = townRig();
    tick(r);
    tick(r); // the crate's first look sets what it held
    const before = r.npcs.townDebug();
    expect(before.board.placed).toBe(true);
    expect(before.board.bounties.length).toBeGreaterThan(0);
    const b = before.board.bounties[0];
    const rep0 = before.rep;
    const trust0 = r.npcs.trustOf('gruk');
    r.crate.add(b.item, b.left);
    r.crate.add('glass', 5);
    tick(r);
    const after = r.npcs.townDebug();
    expect(r.npcs.coins).toBe(b.coin);
    expect(after.rep).toBeGreaterThan(rep0);
    expect(r.npcs.trustOf('gruk')).toBeGreaterThan(trust0);
    expect(after.stock.glass).toBe(5);
    expect(r.toasts.some((t) => t.includes('into the storage bay crate'))).toBe(true);
    expect(r.events).toContainEqual({ type: 'bounty', e: { item: b.item, filled: 1 } });
  });

  it('items taken out of the crate and put back pay nothing', () => {
    const r = townRig();
    tick(r);
    tick(r);
    const b = r.npcs.townDebug().board.bounties[0];
    r.crate.add(b.item, b.left);
    tick(r);
    const paid = r.npcs.coins;
    expect(paid).toBeGreaterThan(0);
    r.crate.remove(b.item, b.left);
    tick(r);
    r.crate.add(b.item, b.left);
    tick(r);
    expect(r.npcs.coins).toBe(paid);
  });
});

describe('Gruk talks about the build', () => {
  it('names the building, the stage and what is missing, or that the bay has it, or the lock, or the finished town', () => {
    const first = (lines: readonly string[]): string => lines[0];
    const work = buildLine({ building: 'Cottage', stage: 'frame', missing: [{ item: 'oak_log', count: 24 }, { item: 'plank', count: 10 }], lock: null, finished: false }, first)!;
    expect(work).toContain('Cottage');
    expect(work).toContain('frame');
    expect(work).toContain('24 oak log and 10 plank');
    expect(buildLine({ building: 'Cottage', stage: 'roof', missing: [], lock: null, finished: false }, first)).toBe(ORC_BUILD.stocked[0].replace('{building}', 'Cottage').replace('{stage}', 'roof'));
    expect(buildLine({ building: null, stage: null, missing: [], lock: 'Gruk will not start the Cottage until 20.', finished: false }, first)).toContain('until 20');
    expect(buildLine({ building: null, stage: null, missing: [], lock: null, finished: true }, first)).toContain('finished');
    expect(buildLine({ building: null, stage: null, missing: [], lock: null, finished: false }, first)).toBeNull();
    expect(missingWords([{ item: 'a', count: 1 }, { item: 'b', count: 2 }, { item: 'c', count: 3 }, { item: 'd', count: 4 }])).toBe('1 a, 2 b and 3 c');
  });

  it('in the game, a talk with Gruk names the storage bay and its stage', () => {
    const r = townRig();
    tick(r);
    for (let i = 0; i < 4; i++) r.npcs.speak(r.by('gruk'));
    const lines = r.says.filter((s) => s.id === 'gruk').map((s) => s.text);
    expect(lines.some((l) => l.includes('Storage Bay') && l.includes('clearing'))).toBe(true);
  });
});

describe('"What next?" points at the board', () => {
  const guide = { bounties: [{ item: 'oak_log', left: 12, text: '12 oak log for the Cottage, frame (30 coin)' }], at: { x: 5, y: 41, z: 9 } };

  it('the manager gives the open bounties and the board front once the board is up', () => {
    const r = townRig();
    expect(r.npcs.boardGuide()).toBeNull();
    tick(r);
    const g = r.npcs.boardGuide()!;
    expect(g.bounties.length).toBeGreaterThan(0);
    expect(g.at).toEqual(r.npcs.townDebug().front);
  });

  it('points at the board when the pack holds a bounty item, or when no goal is left; a located goal keeps the arrow', () => {
    const p = new PlayerState(createBus());
    expect(nudgeFor(p, null, guide)).toMatchObject({ target: { kind: 'pos', x: 5, y: 41, z: 9 } });
    expect(nudgeFor(p, null, guide)!.text).toContain('12 oak log');
    expect(nudgeFor(p, null, null)).toBeNull();
    const located = { id: 'x', title: 'Break stone', text: '', condition: { type: 'break', block: 'stone' } } as never;
    expect(nudgeFor(p, located, guide)!.target).toMatchObject({ kind: 'blocks' });
    p.give('oak_log', 1);
    expect(nudgeFor(p, located, guide)!.target).toMatchObject({ kind: 'pos' });
  });
});

describe('the camp bedrolls sleep to dawn', () => {
  function campRig(tod: number) {
    const r = lifeRig({ tod });
    r.npcs.load({ v: 1, at: [100, 40, 100], greeted: true, gifted: [], spoken: {}, present: ['gruk'], camp: true });
    return r;
  }
  const bed = CAMP_BEDS[0];
  const at = (b: readonly number[]): [number, number, number] => [100 + b[0], 40 + b[1], 100 + b[2]];

  it('at night a bedroll sleeps the player to dawn', () => {
    const r = campRig(0.9);
    expect(r.npcs.useBed(...at(bed))).not.toBeNull();
    expect(r.state.slept).toBe(1);
  });

  it('not by day, and not with a hostile near (the paid room rules)', () => {
    const day = campRig(0.4);
    expect(day.npcs.useBed(...at(bed))).toContain('evening or at night');
    expect(day.state.slept).toBe(0);
    const night = campRig(0.9);
    night.state.hostiles.push({ id: 1, x: 100 + 5, y: 41, z: 100 });
    expect(night.npcs.useBed(...at(bed))).toContain('enemies');
    expect(night.state.slept).toBe(0);
    expect(sleepBlocked('night', { x: 0, z: 0 }, [{ x: SLEEP_SAFE_R + 1, z: 0 }])).toBeNull();
  });

  it('only the camp bedrolls: another cell, or a world with no camp, is not a camp bed', () => {
    const r = campRig(0.9);
    expect(r.npcs.useBed(0, 0, 0)).toBeNull();
    const tavern = lifeRig({ tod: 0.9 });
    expect(tavern.npcs.useBed(...at(bed))).toBeNull();
  });

  it('the paid room now refuses with a hostile near, too', () => {
    const { npcs, state, by } = lifeRig({ coins: 30, tod: 0.8 });
    state.hostiles.push({ id: 1, x: 102, y: 41, z: 100 });
    npcs.speak(by('rosa'));
    npcs.speak(by('rosa'));
    npcs.speak(by('rosa'));
    expect(state.slept).toBe(0);
  });
});

/** A flat world for the builder alone. */
function flatHost(over: Partial<TownHost> = {}): TownHost & { tod: number; dayNo: number } {
  const blocks = new Map<string, string>();
  const h = {
    tod: 0.4,
    dayNo: 1,
    day(): number {
      return h.dayNo;
    },
    timeOfDay(): number {
      return h.tod;
    },
    townSurface: () => ({ y: 10, key: 'grass' }),
    townBlock: (x: number, y: number, z: number) => blocks.get(`${x},${y},${z}`) ?? (y < 10 ? 'dirt' : y === 10 ? 'grass' : 'air'),
    townEdited: () => false,
    townPlace: (x: number, y: number, z: number, b: string) => (blocks.set(`${x},${y},${z}`, b), true),
    ...over,
  };
  return h;
}

function stocked(): TownBuilder {
  const b = new TownBuilder();
  for (const item of ['dirt', 'stone_brick', 'oak_log', 'plank', 'glass', 'torch', 'crate', 'workbench', 'furnace_clay']) b.deliver(item, 1000);
  return b;
}

describe('hiring Gruk pauses the build', () => {
  it('while away nothing is laid and the time away is not credited back at the end of the day', () => {
    const away = { on: true };
    const h = flatHost({ away: () => away.on });
    const b = stocked();
    for (let i = 0; i < 2000; i++) b.tick(1, h, 7, [0, 0]);
    expect(b.progress().cell).toBe(0);
    h.tod = 0.99;
    h.dayNo = 2;
    away.on = false;
    b.tick(0, h, 7, [0, 0]);
    // The day ended: what the hire took is gone, only the part of the day left unworked is credited.
    expect(b.progress().cell + (b.toJSON()!.owed)).toBeLessThan(DAY_BUDGET);
  });

  it('in the game: a hired Gruk lays nothing by day', () => {
    const r = townRig({ tod: 0.4 });
    r.npcs.companion.hire(100, 41, 100);
    for (let i = 0; i < 200; i++) tick(r, 1);
    expect(r.npcs.townDebug().progress.cell).toBe(0);
    r.npcs.companion.hiredS = 0;
    for (let i = 0; i < 200; i++) tick(r, 1);
    expect(r.npcs.townDebug().progress.cell).toBeGreaterThan(0);
  });
});

describe('festival rest only where a festival can run', () => {
  it('a festival day is a working day when no festival can run', () => {
    expect(workDay(SEASON_DAYS)).toBe(false);
    expect(workDay(SEASON_DAYS, false)).toBe(true);
    const h = flatHost({ festivals: () => false });
    h.dayNo = SEASON_DAYS;
    const b = stocked();
    for (let i = 0; i < 2000; i++) b.tick(1, h, 7, [0, 0]);
    expect(b.progress().cell).toBeGreaterThan(0);
  });

  it('the camp cannot hold a festival, a settled tavern with three people can', () => {
    const r = lifeRig();
    r.npcs.load({ v: 1, at: [100, 40, 100], greeted: true, gifted: [], spoken: {}, present: ['gruk'], camp: true });
    expect(r.npcs.festivalCanRun()).toBe(false);
    expect(lifeRig().npcs.festivalCanRun()).toBe(true);
  });
});

describe('the finished town', () => {
  const done: TownSnapshot = {
    v: 1,
    plan: { site: [100, 100], buildings: [{ template: 'storage_bay', x: 96, z: 96, rot: 0 }] },
    building: 1,
    base: null,
    ground: [],
    stage: -1,
    cell: 0,
    laid: 0,
    lastDay: 3,
    owed: 0,
    accrued: 0,
    blocked: 0,
    bay: {},
    board: { v: 1, seq: 4, rep: 30, done: 5, stageKey: '', bounties: [], spot: { x: 100, y: 40, z: 100, facing: 0 }, bay: null, placed: true },
  };

  it('after the last planned building the board and Gruk say the town is finished', () => {
    const r = lifeRig({ tod: 0.4 });
    r.npcs.load({ v: 1, at: [100, 40, 100], greeted: true, gifted: ['gruk'], spoken: {}, town: done });
    r.npcs.useFixture('board');
    expect(r.toasts.some((t) => t.includes('The town is finished'))).toBe(true);
    for (let i = 0; i < 3; i++) r.npcs.speak(r.by('gruk'));
    expect(r.says.some((s) => s.id === 'gruk' && /town is (finished|done)/.test(s.text))).toBe(true);
  });
});

describe('town events', () => {
  it('emits town:built with a running count when Gruk finishes a building, so 1 is the first', () => {
    const r = townRig();
    tick(r);
    r.npcs.supplyLodge(500);
    for (const item of ['dirt', 'stone_brick', 'oak_log', 'plank', 'glass', 'torch', 'crate', 'workbench', 'furnace_clay']) r.crate.add(item, 64);
    for (let d = 0; d < 40 && !r.events.some((e) => e.type === 'built'); d++) {
      r.state.day++;
      tick(r);
    }
    expect(r.events.find((e) => e.type === 'built')).toEqual({ type: 'built', e: { template: 'storage_bay', built: 1 } });
  });
});
