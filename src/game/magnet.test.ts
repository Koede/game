import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { createBus } from '../core/context';
import { sanitizeSettings } from '../save/document';
import { GameClock } from './clock';
import { FakeWorld } from './fakeWorld';
import { isMagnetMode, magnetCollector, type MagnetMode } from './magnet';
import { PlayerState } from './playerState';
import { Survival } from './survival';

function rig(mode: MagnetMode) {
  const bus = createBus();
  const world = new FakeWorld();
  world.fill(-12, 9, -12, 12, 9, 12, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  player.assist.magnet = mode;
  const survival = new Survival(world, player, new GameClock(bus, 0.3), () => 'woodland');
  player.ground.spawn('coal', 1, 3.5, 10, 0.5, { scatter: false, delayS: 0 }); // 3 blocks away
  player.ground.spawn('stick', 1, 0.5, 10, 5.5, { scatter: false, delayS: 0 }); // 5 blocks away
  player.ground.spawn('flint', 1, -9.5, 10, 0.5, { scatter: false, delayS: 0 }); // 10 blocks away
  for (let i = Math.round(4 / DT); i > 0; i--) survival.tick(DT);
  return player;
}

describe('item magnet', () => {
  it('off keeps the normal pickup: nothing flies in from afar', () => {
    const p = rig('off');
    expect(p.inventory.count('coal') + p.inventory.count('stick') + p.inventory.count('flint')).toBe(0);
  });

  it('small pulls items a few blocks away, large further, and neither reaches the far one', () => {
    const small = rig('small');
    expect([small.inventory.count('coal'), small.inventory.count('stick'), small.inventory.count('flint')]).toEqual([1, 0, 0]);
    const large = rig('large');
    expect([large.inventory.count('coal'), large.inventory.count('stick'), large.inventory.count('flint')]).toEqual([1, 1, 0]);
  });

  it('has a collector only when on, and settings load with off as the default', () => {
    expect(magnetCollector('off')).toBeNull();
    expect(magnetCollector('large')!.radius).toBeGreaterThan(magnetCollector('small')!.radius);
    expect(isMagnetMode('small')).toBe(true);
    expect(isMagnetMode('huge')).toBe(false);
    expect(sanitizeSettings({}).itemMagnet).toBe('off');
    expect(sanitizeSettings({ itemMagnet: 'large' }).itemMagnet).toBe('large');
    expect(sanitizeSettings({ itemMagnet: 'huge' }).itemMagnet).toBe('off');
  });
});
