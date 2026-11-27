import { describe, expect, it } from 'vitest';
import { INVENTORY_SIZE, MAX_HEALTH } from '../core/constants';
import { createBus } from '../core/context';
import { block, blockId } from '../core/registry';
import { makeVoxel } from '../core/types';
import { makeStack } from './inventory';
import { PlayerState, type PlayerSnapshot } from './playerState';

describe('PlayerState', () => {
  it('starts healthy at the spawn with a 36-slot inventory', () => {
    const player = new PlayerState(createBus(), { x: 3.5, y: 40, z: -2.5 });
    expect(player.position).toEqual({ x: 3.5, y: 40, z: -2.5 });
    expect(player.inventory.size).toBe(INVENTORY_SIZE);
    expect(player.health).toBe(MAX_HEALTH);
    expect(player.heldStack()).toBeNull();
    expect(player.eyeY).toBeCloseTo(41.62);
  });

  it('looks north at yaw 0, west after turning left, up with positive pitch', () => {
    const player = new PlayerState(createBus());
    const dir = { x: 0, y: 0, z: 0 };
    player.viewDir(dir);
    expect(dir.x).toBeCloseTo(0);
    expect(dir.z).toBeCloseTo(-1);
    player.yaw = Math.PI / 2;
    player.viewDir(dir);
    expect(dir.x).toBeCloseTo(-1);
    expect(dir.z).toBeCloseTo(0);
    player.pitch = Math.PI / 2;
    expect(player.viewDir(dir).y).toBeCloseTo(1);
  });

  it('give announces what arrived and warns about what did not fit', () => {
    const bus = createBus();
    const player = new PlayerState(bus);
    const log: string[] = [];
    bus.on('item:gained', (e) => log.push(`gained ${e.count} ${e.item}`));
    bus.on('inventory:changed', () => log.push('changed'));
    bus.on('toast', (e) => log.push(`toast:${e.kind}:${e.item}`));
    expect(player.give('coal', 5)).toBe(0);
    expect(log).toEqual(['changed', 'gained 5 coal']);
    log.length = 0;
    for (let i = 1; i < INVENTORY_SIZE; i++) player.inventory.slots[i] = makeStack('rubble', 99);
    expect(player.give('coal', 100)).toBe(6);
    expect(log).toEqual(['changed', 'gained 94 coal', 'toast:warn:coal']);
    log.length = 0;
    expect(player.give('flint_pickaxe')).toBe(1);
    expect(log).toEqual(['toast:warn:flint_pickaxe']);
  });

  it('selects hotbar slots and uses up the held stack', () => {
    const bus = createBus();
    const player = new PlayerState(bus);
    const selected: number[] = [];
    bus.on('hotbar:selected', (e) => selected.push(e.slot));
    player.inventory.set(2, makeStack('torch', 2));
    player.selectSlot(2);
    player.selectSlot(2);
    player.selectSlot(40);
    player.selectSlot(-3);
    expect(selected).toEqual([2, 8, 0]);
    player.selectSlot(2);
    expect(player.heldStack()).toEqual({ item: 'torch', count: 2 });
    expect(player.consumeHeld()).toEqual({ item: 'torch', count: 1 });
    expect(player.consumeHeld(5)).toEqual({ item: 'torch', count: 1 });
    expect(player.consumeHeld()).toBeNull();
  });

  it('wears the held tool on matching blocks until it breaks', () => {
    const bus = createBus();
    const player = new PlayerState(bus);
    const log: string[] = [];
    bus.on('tool:broke', (e) => log.push(`broke ${e.item}`));
    bus.on('sfx', (e) => log.push(e.name));
    player.give('flint_pickaxe', 1, 2);
    expect(player.wearHeld(block('dirt'))).toBe(false);
    expect(player.heldStack()?.durability).toBe(2);
    expect(player.wearHeld(block('stone'))).toBe(false);
    expect(player.heldStack()?.durability).toBe(1);
    expect(player.wearHeld(block('stone'))).toBe(true);
    expect(player.heldStack()).toBeNull();
    expect(log).toEqual(['broke flint_pickaxe', 'tool_break']);
    expect(player.wearHeld(block('stone'))).toBe(false);
  });

  it('warns once when the held tool is down to a tenth of its wear, naming how to mend it', () => {
    const bus = createBus();
    const player = new PlayerState(bus);
    const toasts: string[] = [];
    bus.on('toast', (e) => toasts.push(e.text));
    player.give('iron_pickaxe', 1, 40); // max 384: a tenth is 38.4
    expect(player.wearHeldTool(1)).toBe(false); // 39 left, still above
    expect(toasts).toEqual([]);
    player.wearHeldTool(1); // 38 left: crossed
    expect(toasts).toHaveLength(1);
    expect(toasts[0]).toContain('nearly worn out');
    expect(toasts[0]).toContain('Iron Ingot');
    player.wearHeldTool(1);
    expect(toasts).toHaveLength(1);
  });

  it('records lifetime counters from bus events', () => {
    const bus = createBus();
    const player = new PlayerState(bus);
    const at = { x: 0, y: 0, z: 0 };
    bus.emit('block:broken', { ...at, voxel: makeVoxel(blockId('oak_log')) });
    bus.emit('block:broken', { ...at, voxel: makeVoxel(blockId('oak_log'), 2, true) });
    bus.emit('block:placed', { ...at, voxel: makeVoxel(blockId('workbench')) });
    bus.emit('item:made', { item: 'plank', count: 4, station: 'hand', recipeId: 'plank' });
    bus.emit('item:made', { item: 'plank', count: 4, station: 'hand', recipeId: 'plank_pine' });
    expect(player.stats).toEqual({ made: { plank: 8 }, drunk: {}, acts: {}, placed: { workbench: 1 }, broken: { oak_log: 2 }, deaths: 0 });
    player.dispose();
    bus.emit('item:made', { item: 'plank', count: 4, station: 'hand', recipeId: 'plank' });
    expect(player.stats.made.plank).toBe(8);
  });

  it('heals up to the maximum, hurts with a sound, and ignores nonsense', () => {
    const bus = createBus();
    const player = new PlayerState(bus);
    const sounds: string[] = [];
    bus.on('sfx', (e) => sounds.push(e.name));
    player.damage(0, 'fall');
    player.damage(-4, 'fall');
    expect(player.health).toBe(MAX_HEALTH);
    player.damage(5, 'cold');
    expect(player.sinceDamageS).toBe(0);
    player.heal(2);
    expect(player.health).toBe(17);
    player.heal(50);
    expect(player.health).toBe(MAX_HEALTH);
    expect(sounds).toEqual(['hurt']);
  });

  it('round-trips through JSON', () => {
    const bus = createBus();
    const player = new PlayerState(bus, { x: 1.5, y: 30, z: 2.5 });
    player.position.x = 9.25;
    player.velocity.y = -3;
    player.yaw = 1.2;
    player.pitch = -0.4;
    player.give('plank', 130);
    player.give('flint_pickaxe', 1, 21);
    player.selectSlot(3);
    player.setHome(4, 31, 5);
    player.damage(6, 'fall');
    player.warmth = 44;
    player.air = 7;
    player.buffs.wellWarmedS = 120;
    bus.emit('item:made', { item: 'plank', count: 4, station: 'hand', recipeId: 'plank' });
    const snapshot = JSON.parse(JSON.stringify(player)) as PlayerSnapshot;
    const copy = new PlayerState(createBus());
    copy.load(snapshot);
    expect(copy.toJSON()).toEqual(player.toJSON());
    expect(copy.home).toEqual({ x: 4, y: 31, z: 5 });
    expect(copy.inventory.get(2)).toEqual({ item: 'flint_pickaxe', count: 1, durability: 21 });
    expect(copy.wellWarmed).toBe(true);
    // The copy owns its data.
    copy.stats.made.plank = 99;
    copy.home!.x = 0;
    expect(player.stats.made.plank).toBe(4);
    expect(player.home!.x).toBe(4);
  });
});
