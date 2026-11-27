import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { priceOf } from './economy';
import { BAY_CRATE, bayCrateSpot, lockNote, unlockedAt, UNLOCK_REP } from './buildBoard';
import {
  BOARD_REWARDS,
  rewardsAt,
  BOARD_SLOTS,
  BuildBoard,
  CHUNK_MAX,
  CHUNK_MIN,
  RARE_CHANCE,
  REP_PER_BUILDING,
  REPUTATION_STEPS,
  bayBoardSpot,
  bountyCoin,
  describeBounty,
  reputationStep,
  share,
  type Bounty,
} from './buildBoard';
import { TownBuilder, type TownHost, type TownItem } from './townBuilder';
import { footprintOf, townTemplate, TOWN_STAGES } from './townTemplates';

const SEED = 11;
const FRAME = TOWN_STAGES.indexOf('frame');
const WALLS = TOWN_STAGES.indexOf('walls');
const FINISH = TOWN_STAGES.indexOf('finish');

/** Refreshes a fresh board for one building stage and need list. */
function boardFor(missing: TownItem[], stage = FRAME, seed = SEED, template = 'cottage'): BuildBoard {
  const b = new BuildBoard();
  b.refresh({ template, stage }, missing, seed);
  return b;
}

/** Hands a bounty in whole, the way the manager does (the bay takes it; here only the board is checked). */
function fill(b: BuildBoard, id: string): Bounty {
  const bounty = b.bounties.find((x) => x.id === id)!;
  b.deliver(id, bounty.left);
  return bounty;
}

/** A flat world: grass at y = 10, dirt under it, air above; placed blocks are recorded. */
class Flat implements TownHost {
  readonly over = new Map<string, string>();
  readonly placed: { x: number; y: number; z: number; block: string }[] = [];
  day(): number {
    return 1;
  }
  timeOfDay(): number {
    return 0.4;
  }
  townSurface(): { y: number; key: string } {
    return { y: 10, key: 'grass' };
  }
  townBlock(x: number, y: number, z: number): string {
    const o = this.over.get(`${x},${y},${z}`);
    if (o !== undefined) return o;
    return y < 10 ? 'dirt' : y === 10 ? 'grass' : 'air';
  }
  townEdited(): boolean {
    return false;
  }
  townPlace(x: number, y: number, z: number, block: string): boolean {
    this.over.set(`${x},${y},${z}`, block);
    this.placed.push({ x, y, z, block });
    return true;
  }
}

describe('build board: bounties', () => {
  it('asks only for items the building still needs', () => {
    const missing = [{ item: 'oak_log', count: 40 }, { item: 'plank', count: 12 }, { item: 'stone_brick', count: 3 }];
    for (let seed = 1; seed <= 40; seed++) {
      const b = boardFor(missing, FRAME, seed);
      for (const x of b.bounties) expect(missing.map((m) => m.item)).toContain(x.item);
    }
  });

  it('never asks for more of an item than is still needed', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const missing = [{ item: 'oak_log', count: 9 }, { item: 'plank', count: 30 }, { item: 'glass', count: 5 }];
      const b = boardFor(missing, FRAME, seed);
      for (const m of missing) {
        const asked = b.bounties.filter((x) => x.item === m.item).reduce((s, x) => s + x.left, 0);
        expect(asked).toBeLessThanOrEqual(m.count);
      }
    }
  });

  it('keeps three bounties up when there is enough need, and fewer when there is less', () => {
    expect(boardFor([{ item: 'oak_log', count: 60 }, { item: 'plank', count: 60 }, { item: 'glass', count: 60 }]).bounties).toHaveLength(BOARD_SLOTS);
    const small = boardFor([{ item: 'torch', count: 5 }]);
    expect(small.bounties).toHaveLength(1);
    expect(small.bounties[0].size).toBe(5);
    expect(boardFor([]).bounties).toHaveLength(0);
  });

  it('splits a big need into chunks of 8 to 32', () => {
    const sizes = new Set<number>();
    for (let seed = 1; seed <= 80; seed++) {
      for (const x of boardFor([{ item: 'stone_brick', count: 300 }], FRAME, seed).bounties) {
        expect(x.size).toBeGreaterThanOrEqual(CHUNK_MIN);
        expect(x.size).toBeLessThanOrEqual(CHUNK_MAX);
        sizes.add(x.size);
      }
    }
    expect(sizes.size).toBeGreaterThan(10);
  });

  it('redraws the filled bounty and keeps three up', () => {
    const b = boardFor([{ item: 'oak_log', count: 200 }, { item: 'plank', count: 200 }, { item: 'glass', count: 200 }]);
    const first = b.bounties[0];
    fill(b, first.id);
    b.refresh({ template: 'cottage', stage: FRAME }, [{ item: 'oak_log', count: 200 - first.size }, { item: 'plank', count: 200 }, { item: 'glass', count: 200 }], SEED);
    expect(b.bounties).toHaveLength(BOARD_SLOTS);
    expect(b.bounties.map((x) => x.id)).not.toContain(first.id);
  });

  it('redraws the whole board when the stage moves on', () => {
    const need = [{ item: 'oak_log', count: 100 }, { item: 'plank', count: 100 }];
    const b = boardFor(need, FRAME);
    const old = b.bounties.map((x) => x.id);
    b.refresh({ template: 'cottage', stage: WALLS }, need, SEED);
    expect(b.bounties.every((x) => x.stage === WALLS)).toBe(true);
    expect(b.bounties.map((x) => x.id).some((id) => old.includes(id))).toBe(false);
  });

  it('drops a bounty when the need falls below it (dug or delivered elsewhere)', () => {
    const b = boardFor([{ item: 'oak_log', count: 30 }]);
    const size = b.bounties[0].size;
    b.refresh({ template: 'cottage', stage: FRAME }, [{ item: 'oak_log', count: 3 }], SEED);
    expect(b.bounties.reduce((s, x) => s + x.left, 0)).toBeLessThanOrEqual(3);
    expect(size).toBeGreaterThan(3);
    b.refresh({ template: 'cottage', stage: FRAME }, [], SEED);
    expect(b.bounties).toHaveLength(0);
  });

  it('is deterministic for a seed', () => {
    const need = [{ item: 'oak_log', count: 50 }, { item: 'plank', count: 50 }];
    expect(boardFor(need, FRAME, 5).toJSON().bounties).toEqual(boardFor(need, FRAME, 5).toJSON().bounties);
  });
});

describe('build board: payouts and rewards', () => {
  it('pays coin scaled to the material value, reputation and trust within bounds', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const b = boardFor([{ item: 'oak_log', count: 300 }, { item: 'glass', count: 300 }, { item: 'stone_brick', count: 300 }], WALLS, seed);
      for (const x of b.bounties) {
        expect(x.coin).toBe(bountyCoin(x.item, x.size, x.stage));
        expect(x.coin).toBeGreaterThanOrEqual(Math.max(4, Math.round(priceOf(x.item) * x.size)));
        expect(x.coin).toBeLessThanOrEqual(Math.round(priceOf(x.item) * x.size * 1.5) + 1);
        expect(x.rep).toBeGreaterThanOrEqual(1);
        expect(x.trust).toBeGreaterThanOrEqual(2);
        expect(x.trust).toBeLessThanOrEqual(3);
      }
    }
  });

  it('splits a payment across parts so the totals are exact', () => {
    expect(share(10, 3, 0, 1) + share(10, 3, 1, 2) + share(10, 3, 2, 3)).toBe(10);
    const b = boardFor([{ item: 'oak_log', count: 20 }]);
    const x = b.bounties[0];
    let coin = 0;
    let rep = 0;
    let trust = 0;
    let taken = 0;
    while (b.bounties.length > 0) {
      const p = b.deliver(x.id, 3)!;
      coin += p.coin;
      rep += p.rep;
      trust += p.trust;
      taken += p.take;
      if (p.done) break;
    }
    expect(taken).toBe(x.size);
    expect(coin).toBe(x.coin);
    expect(rep).toBe(x.rep);
    expect(trust).toBe(x.trust);
    expect(b.done).toBe(1);
  });

  it('rolls rare rewards about 5% of the time, more on the finishing stage', () => {
    const rate = (stage: number): number => {
      let rare = 0;
      let all = 0;
      for (let seed = 1; seed <= 2000; seed++) {
        const b = boardFor([{ item: 'oak_log', count: 300 }, { item: 'plank', count: 300 }, { item: 'glass', count: 300 }], stage, seed);
        for (const x of b.bounties) {
          all++;
          if (x.reward) rare++;
        }
      }
      return rare / all;
    };
    expect(Math.abs(rate(WALLS) - RARE_CHANCE)).toBeLessThan(0.015);
    expect(rate(FINISH)).toBeGreaterThan(rate(WALLS) * 2);
  });

  it('rare rewards are real items', () => {
    expect(BOARD_REWARDS.length).toBeGreaterThan(0);
    for (const r of BOARD_REWARDS) expect(itemOrNull(r.item)).not.toBeNull();
  });

  it('town standing widens the rare reward pool with real items', () => {
    expect(rewardsAt(0)).toEqual(BOARD_REWARDS);
    expect(rewardsAt(30).length).toBeGreaterThan(rewardsAt(29).length);
    expect(rewardsAt(60).length).toBeGreaterThan(rewardsAt(59).length);
    for (const r of rewardsAt(60)) expect(itemOrNull(r.item)).not.toBeNull();
  });

  it('pays the reward only when the bounty is complete', () => {
    const b = new BuildBoard();
    b.bounties = [{ id: 'x1', item: 'oak_log', template: 'cottage', stage: FRAME, size: 8, left: 8, coin: 16, rep: 2, trust: 2, reward: { item: 'bell', count: 1 } }];
    expect(b.deliver('x1', 4)!.reward).toBeNull();
    expect(b.deliver('x1', 4)!.reward).toEqual({ item: 'bell', count: 1 });
    expect(b.bounties).toHaveLength(0);
  });
});

describe('build board: reputation', () => {
  it('rises with each bounty and each finished building', () => {
    const b = boardFor([{ item: 'oak_log', count: 30 }]);
    const x = b.bounties[0];
    const p = b.deliver(x.id, x.size)!;
    expect(b.rep).toBe(p.rep);
    expect(b.rep).toBeGreaterThan(0);
    const before = b.rep;
    b.finished();
    expect(b.rep).toBe(before + REP_PER_BUILDING);
  });

  it('exports reputation steps as data', () => {
    expect(REPUTATION_STEPS.map((s) => s.at)).toEqual([...REPUTATION_STEPS.map((s) => s.at)].sort((a, c) => a - c));
    expect(reputationStep(0).name).toBe('strangers');
    expect(reputationStep(10).name).toBe('neighbours');
    expect(reputationStep(59).name).toBe('village');
    expect(reputationStep(60).name).toBe('town');
  });
});

describe('build board: delivery into the bay', () => {
  it('a delivered bounty moves the items into the bay, and the builder places them', () => {
    const world = new Flat();
    const town = new TownBuilder();
    const board = new BuildBoard();
    // Settle the plan and the first cells: the bay has nothing in stock yet, so Gruk waits on the frame.
    for (let i = 0; i < 40; i++) town.tick(2, world, SEED, [100, -40]);
    const need = town.missing();
    expect(need.length).toBeGreaterThan(0);
    const cur = town.currentTemplate!;
    board.refresh({ template: cur, stage: town.stage() }, need, SEED);
    const x = board.bounties[0];
    const pay = board.deliver(x.id, x.left)!;
    expect(town.deliver(x.item, pay.take)).toBe(pay.take);
    expect(town.stock()[x.item]).toBe(pay.take);
    for (let i = 0; i < 400; i++) town.tick(2, world, SEED, [100, -40]);
    const laid = world.placed.filter((p) => p.block === x.item).length;
    expect(laid).toBeGreaterThan(0);
    expect(town.stock()[x.item] ?? 0).toBeLessThanOrEqual(pay.take + 1);
  });

  it('a finished storage bay is reported, and a building finish raises reputation', () => {
    const world = new Flat();
    const town = new TownBuilder();
    const board = new BuildBoard();
    for (const item of ['dirt', 'stone_brick', 'oak_log', 'plank', 'crate', 'torch', 'glass', 'workbench', 'furnace_clay', 'gravel']) town.deliver(item, 2000);
    const done: string[] = [];
    for (let i = 0; i < 6000 && done.length === 0; i++) {
      town.tick(2, world, SEED, [100, -40]);
      for (const f of town.takeFinished()) {
        done.push(f.template);
        board.finished();
        if (f.template === 'storage_bay') expect(bayBoardSpot(f)).not.toBeNull();
      }
    }
    expect(done[0]).toBe('storage_bay');
    expect(board.rep).toBe(REP_PER_BUILDING);
  });

  it('places the board inside the bay on the floor row', () => {
    const t = townTemplate('storage_bay')!;
    for (const rot of [0, 1, 2, 3]) {
      const f = footprintOf(t, rot);
      const s = bayBoardSpot({ x: 100, z: 40, rot, base: 11 })!;
      expect(s.y).toBe(11);
      expect(s.x).toBeGreaterThanOrEqual(100);
      expect(s.x).toBeLessThan(100 + f.w);
      expect(s.z).toBeGreaterThanOrEqual(40);
      expect(s.z).toBeLessThan(40 + f.d);
    }
  });
});

describe('build board: save', () => {
  it('round-trips the bounties, reputation and spot', () => {
    const b = boardFor([{ item: 'oak_log', count: 60 }, { item: 'plank', count: 60 }]);
    b.deliver(b.bounties[0].id, 2);
    b.finished();
    b.spot = { x: 1, y: 2, z: 3, facing: 2 };
    b.placed = true;
    const saved = JSON.parse(JSON.stringify(b.toJSON()));
    const c = new BuildBoard();
    c.load(saved);
    expect(c.toJSON()).toEqual(b.toJSON());
    expect(c.rep).toBe(b.rep);
  });

  it('an old save with no board starts an empty one, and bad entries are dropped', () => {
    const c = new BuildBoard();
    c.load(undefined);
    expect(c.bounties).toHaveLength(0);
    expect(c.rep).toBe(0);
    c.load({ v: 1, rep: 4, bounties: [{ id: 'q', item: 'oak_log', template: 'cottage', stage: 1, size: 999, left: 5 }, null, 'nope'] });
    expect(c.rep).toBe(4);
    expect(c.bounties).toHaveLength(0);
  });

  it('describes a bounty for the player', () => {
    const b = boardFor([{ item: 'oak_log', count: 12 }]);
    expect(describeBounty(b.bounties[0])).toContain('oak log');
  });
});

describe('build board: unlocks, the bay and its crate', () => {
  it('gates templates by town standing: the storage bay, well, plaza and lamp post early, the workshop and cottage later', () => {
    expect(unlockedAt('storage_bay', 0)).toBe(true);
    expect(unlockedAt('well_plaza', 0)).toBe(true);
    expect(unlockedAt('lamp_post', 0)).toBe(true);
    expect(unlockedAt('workshop', UNLOCK_REP.workshop - 1)).toBe(false);
    expect(unlockedAt('workshop', UNLOCK_REP.workshop)).toBe(true);
    expect(UNLOCK_REP.cottage).toBeGreaterThan(UNLOCK_REP.workshop);
    expect(unlockedAt('cottage', UNLOCK_REP.cottage - 1)).toBe(false);
    expect(unlockedAt('cottage', UNLOCK_REP.cottage)).toBe(true);
  });

  it('says what standing a locked building needs, and nothing once it is unlocked', () => {
    const note = lockNote('cottage', 5)!;
    expect(note).toContain('Cottage');
    expect(note).toContain(String(UNLOCK_REP.cottage));
    expect(note).toContain('5');
    expect(lockNote('cottage', UNLOCK_REP.cottage)).toBeNull();
  });

  it('places the stock crate inside the bay on the floor row, apart from the board', () => {
    for (const rot of [0, 1, 2, 3]) {
      const f = { x: 100, z: 40, rot, base: 11 };
      const c = bayCrateSpot(f)!;
      expect(c.y).toBe(11 + BAY_CRATE.y);
      expect(c.x).toBeGreaterThanOrEqual(100);
      expect(c.z).toBeGreaterThanOrEqual(40);
      const s = bayBoardSpot(f)!;
      expect(c.x === s.x && c.z === s.z).toBe(false);
    }
  });

  it('keeps the bay place through a save, and the board and crate follow it', () => {
    const b = new BuildBoard();
    b.setBay({ x: 100, z: 40, rot: 1, base: 11 });
    const json = JSON.parse(JSON.stringify(b.toJSON()));
    const b2 = new BuildBoard();
    b2.load(json);
    expect(b2.bay).toEqual({ x: 100, z: 40, rot: 1, base: 11 });
    expect(b2.spot).toEqual(b.spot);
    expect(b2.crate()).toEqual(b.crate());
    const old = new BuildBoard();
    old.load({ v: 1, seq: 0, rep: 0, done: 0, stageKey: '', bounties: [], spot: null, placed: false });
    expect(old.bay).toBeNull();
    expect(old.crate()).toBeNull();
  });
});
