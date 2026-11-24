import { describe, expect, it } from 'vitest';
import { createBus, defaultSettings } from '../core/context';
import { DT } from '../core/constants';
import { sanitizeSettings } from '../save/document';
import { GameClock } from './clock';
import { FakeWorld } from './fakeWorld';
import { isJunk, isLootFilter, takesItem } from './lootFilter';
import { PlayerState } from './playerState';
import { Survival } from './survival';

function rig(filter: 'all' | 'junk') {
  const bus = createBus();
  const world = new FakeWorld();
  world.fill(-6, 9, -6, 6, 9, 6, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  player.assist.lootFilter = filter;
  const survival = new Survival(world, player, new GameClock(bus, 0.3), () => 'woodland');
  player.ground.spawn('rubble', 3, 0.9, 10, 0.5, { scatter: false, delayS: 0 });
  player.ground.spawn('flint', 1, 0.7, 10, 0.5, { scatter: false, delayS: 0 });
  for (let i = Math.round(2 / DT); i > 0; i--) survival.tick(DT);
  return player;
}

describe('loot filter', () => {
  it('ignores the junk kinds only when asked, and keeps everything else', () => {
    for (const item of ['rubble', 'dirt', 'sand', 'gravel', 'wheat_seeds']) expect(isJunk(item)).toBe(true);
    for (const item of ['stone', 'oak_log', 'flint']) expect(isJunk(item)).toBe(false);
    expect(takesItem('all', 'rubble')).toBe(true);
    expect(takesItem('junk', 'rubble')).toBe(false);
    expect(takesItem('junk', 'flint')).toBe(true);
    expect(isLootFilter('junk')).toBe(true);
    expect(isLootFilter('some')).toBe(false);
  });

  it('leaves junk lying on the ground under the junk filter, and picks up everything under the default', () => {
    const junk = rig('junk');
    expect([junk.inventory.count('rubble'), junk.inventory.count('flint')]).toEqual([0, 1]);
    expect(junk.ground.count('rubble')).toBe(3);
    const all = rig('all');
    expect([all.inventory.count('rubble'), all.inventory.count('flint')]).toEqual([3, 1]);
  });

  it('round-trips through the settings save: the default is all, junk survives, and garbage falls back', () => {
    expect(defaultSettings(false).lootFilter).toBe('all');
    expect(sanitizeSettings({}).lootFilter).toBe('all');
    const saved = JSON.parse(JSON.stringify({ ...defaultSettings(false), lootFilter: 'junk' }));
    expect(sanitizeSettings(saved).lootFilter).toBe('junk');
    expect(sanitizeSettings(JSON.parse(JSON.stringify(sanitizeSettings(saved)))).lootFilter).toBe('junk');
    expect(sanitizeSettings({ lootFilter: 'everything' }).lootFilter).toBe('all');
  });
});
