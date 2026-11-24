import { describe, expect, it } from 'vitest';
import { itemOrNull } from '../core/registry';
import { Inventory, makeStack } from './inventory';
import { MoveHistory, distributeStack, gatherMatching, sectionMove } from './inventoryMoves';
import { sortRange, toggleFavourite, toggleLock } from './inventoryTools';
import { moveStack } from './transfer';

const items = (inv: Inventory) => inv.slots.map((s) => (s ? `${s.item}:${s.count}` : '-'));

describe('distributeStack', () => {
  it('splits a stack evenly over empty slots, the origin keeps nothing it did not spread', () => {
    const inv = new Inventory(6);
    inv.set(0, makeStack('stone', 10));
    const moved = distributeStack(inv, 0, [1, 2, 3].map((slot) => ({ inventory: inv, slot })));
    expect(moved).toBe(10);
    expect(items(inv)).toEqual(['-', 'stone:4', 'stone:3', 'stone:3', '-', '-']);
  });

  it('tops up matching stacks and passes on the share a full one cannot take', () => {
    const inv = new Inventory(4);
    inv.set(0, makeStack('stone', 12));
    inv.set(1, makeStack('stone', 97));
    distributeStack(inv, 0, [1, 2, 3].map((slot) => ({ inventory: inv, slot })));
    expect(inv.get(1)?.count).toBe(99);
    expect((inv.get(2)?.count ?? 0) + (inv.get(3)?.count ?? 0)).toBe(12 - 2);
    expect(inv.count('stone')).toBe(12 + 97);
  });

  it('never puts an item where it does not merge or is refused, and skips locked slots', () => {
    const inv = new Inventory(4);
    inv.set(0, makeStack('stone', 6));
    inv.set(1, makeStack('plank', 2));
    inv.set(2, makeStack('stone', 1));
    inv.locked.add(3);
    expect(distributeStack(inv, 0, [1, 3].map((slot) => ({ inventory: inv, slot })))).toBe(0);
    expect(distributeStack(inv, 0, [{ inventory: inv, slot: 2 }])).toBe(6);
    expect(inv.get(2)?.count).toBe(7);
    expect(inv.get(0)).toBeNull();
  });

  it('leaves a tool that cannot split one per slot', () => {
    const inv = new Inventory(3);
    inv.set(0, makeStack('flint_pickaxe', 1, 40));
    expect(distributeStack(inv, 0, [1, 2].map((slot) => ({ inventory: inv, slot })))).toBe(1);
    expect(inv.get(1)).toEqual({ item: 'flint_pickaxe', count: 1, durability: 40 });
    expect(inv.get(2)).toBeNull();
  });
});

describe('gatherMatching', () => {
  it('pulls every mergeable stack in the range into the target up to the stack limit', () => {
    const inv = new Inventory(6);
    inv.set(0, makeStack('stone', 90));
    inv.set(2, makeStack('stone', 20));
    inv.set(3, makeStack('plank', 5));
    inv.set(4, makeStack('stone', 4));
    expect(gatherMatching(inv, 0, 0, 6)).toBe(9);
    expect(items(inv)).toEqual(['stone:99', '-', 'stone:11', 'plank:5', 'stone:4', '-']);
  });

  it('never merges worn tools, enchanted stacks or locked or favourite slots', () => {
    const inv = new Inventory(5);
    inv.set(0, makeStack('stone', 5));
    inv.set(1, makeStack('stone', 5, undefined, undefined, { veinseeker: 1 }));
    inv.set(2, makeStack('stone', 5));
    inv.set(3, makeStack('stone', 5));
    inv.locked.add(2);
    toggleFavourite(inv, 3);
    expect(gatherMatching(inv, 0, 0, 5)).toBe(0);
    inv.set(0, makeStack('flint_pickaxe', 1, 40));
    inv.set(2, makeStack('flint_pickaxe', 1, 20));
    expect(gatherMatching(inv, 0, 0, 5)).toBe(0);
  });
});

describe('sectionMove', () => {
  it('sends the whole stack from the backpack to the hotbar and back', () => {
    const inv = new Inventory(36);
    const sections = [{ start: 0, end: 9 }, { start: 9, end: 36 }];
    inv.set(20, makeStack('stone', 30));
    expect(sectionMove(inv, 20, sections)).toBe(30);
    expect(inv.get(0)).toEqual({ item: 'stone', count: 30 });
    expect(inv.get(20)).toBeNull();
    expect(sectionMove(inv, 0, sections)).toBe(30);
    expect(inv.get(0)).toBeNull();
    expect(inv.count('stone')).toBe(30);
  });

  it('carries what does not fit in one section on into the next', () => {
    const inv = new Inventory(5);
    const sections = [{ start: 0, end: 2 }, { start: 2, end: 3 }, { start: 3, end: 4 }, { start: 4, end: 5 }];
    inv.set(0, makeStack('stone', 50));
    inv.set(2, makeStack('stone', 99));
    inv.set(3, makeStack('stone', 99));
    inv.set(4, makeStack('stone', 99));
    expect(sectionMove(inv, 2, sections)).toBe(99);
    expect(items(inv)).toEqual(['stone:99', 'stone:50', '-', 'stone:99', 'stone:99']);
  });
});

describe('MoveHistory', () => {
  it('undoes the last move once, and only a move that changed something', () => {
    const bag = new Inventory(4);
    const other = new Inventory(4);
    bag.set(0, makeStack('stone', 5));
    const history = new MoveHistory();
    history.record([bag, other], () => moveStack(bag, 0, other, 1));
    expect(items(other)).toEqual(['-', 'stone:5', '-', '-']);
    expect(history.undo()).toBe(true);
    expect(items(bag)).toEqual(['stone:5', '-', '-', '-']);
    expect(items(other)).toEqual(['-', '-', '-', '-']);
    expect(history.undo()).toBe(false);
    history.record([bag], () => 0);
    expect(history.canUndo).toBe(false);
  });

  it('does nothing when the bag changed since the move (a pickup is not undone over)', () => {
    const bag = new Inventory(4);
    bag.set(0, makeStack('stone', 5));
    const history = new MoveHistory();
    history.record([bag], () => moveStack(bag, 0, bag, 1));
    bag.add('plank', 3);
    expect(history.canUndo).toBe(false);
    expect(history.undo()).toBe(false);
    expect(items(bag)).toEqual(['plank:3', 'stone:5', '-', '-']);
  });

  it('restores pickup ticks along with the stacks', () => {
    const bag = new Inventory(3);
    bag.add('stone', 2);
    const tick = bag.tickOf(0);
    const history = new MoveHistory();
    history.record([bag], () => moveStack(bag, 0, bag, 1));
    expect(bag.tickOf(1)).toBe(tick);
    history.undo();
    expect(bag.tickOf(0)).toBe(tick);
    expect(bag.tickOf(1)).toBe(0);
  });

  it('clears with clear()', () => {
    const bag = new Inventory(2);
    bag.set(0, makeStack('stone', 2));
    const history = new MoveHistory();
    history.record([bag], () => moveStack(bag, 0, bag, 1));
    history.clear();
    expect(history.undo()).toBe(false);
  });
});

describe('locks', () => {
  it('a locked slot takes nothing in and sort leaves it where it is', () => {
    const inv = new Inventory(5);
    inv.set(0, makeStack('stone', 3));
    inv.set(2, makeStack('stone', 4));
    expect(toggleLock(inv, 2)).toBe(true);
    expect(inv.accepts('stone', 2)).toBe(false);
    inv.add('stone', 50);
    expect(inv.get(2)?.count).toBe(4);
    sortRange(inv, 0);
    expect(inv.get(2)).toEqual({ item: 'stone', count: 4 });
    expect(toggleLock(inv, 2)).toBe(false);
    expect(inv.accepts('stone', 2)).toBe(true);
  });
});

describe('sortRange modes', () => {
  it('kind order puts the better tier of a kind first', () => {
    const inv = new Inventory(4);
    inv.set(2, makeStack('flint_pickaxe', 1, 10));
    inv.set(3, makeStack('bronze_pickaxe', 1, 10));
    sortRange(inv, 0, 4, 'kind');
    const tierOf = (k: string) => itemOrNull(k)!.tool!.tier;
    expect(tierOf('bronze_pickaxe')).not.toBe(tierOf('flint_pickaxe'));
    const best = tierOf('bronze_pickaxe') > tierOf('flint_pickaxe') ? 'bronze_pickaxe' : 'flint_pickaxe';
    expect(inv.get(0)?.item).toBe(best);
  });

  it('recent order puts the newest pickup first and carries the tick through the sort', () => {
    const inv = new Inventory(4);
    inv.add('stone', 1);
    inv.add('plank', 1);
    inv.add('flint', 1);
    const newest = inv.tickOf(2);
    sortRange(inv, 0, 4, 'recent');
    expect(inv.get(0)?.item).toBe('flint');
    expect(inv.tickOf(0)).toBe(newest);
    expect(inv.tickOf(3)).toBe(0);
  });
});
