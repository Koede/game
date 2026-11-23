import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { HAPTIC, HAPTIC_GAP_MS, attachHaptics } from './haptics';

function rig(enabled = true) {
  const bus = createBus();
  const calls: Array<number | number[]> = [];
  let t = 1000;
  const state = { enabled };
  attachHaptics(bus, () => state.enabled, (p) => (calls.push(p), true), () => t);
  return { bus, calls, state, advance: (ms: number) => (t += ms) };
}

describe('haptics', () => {
  it('buzzes for digging, breaking, placing, crafting and being hurt', () => {
    const { bus, calls, advance } = rig();
    bus.emit('sfx', { name: 'dig_stone' });
    advance(100);
    bus.emit('sfx', { name: 'craft' });
    advance(100);
    bus.emit('player:damage', { amount: 3, cause: 'fall', health: 10 });
    expect(calls).toEqual([HAPTIC.dig, HAPTIC.craft, HAPTIC.hurt(3)]);
  });

  it('limits the rate of ordinary buzzes but never swallows damage', () => {
    const { bus, calls, advance } = rig();
    bus.emit('sfx', { name: 'dig_stone' });
    advance(HAPTIC_GAP_MS - 20);
    bus.emit('sfx', { name: 'dig_stone' });
    expect(calls).toHaveLength(1);
    bus.emit('player:damage', { amount: 1, cause: 'fall', health: 10 });
    expect(calls).toHaveLength(2);
  });

  it('does nothing when the setting is off, or when there is no vibrate', () => {
    const { bus, calls, state } = rig(false);
    bus.emit('block:broken', { x: 0, y: 0, z: 0, voxel: 1 });
    expect(calls).toHaveLength(0);
    state.enabled = true;
    bus.emit('block:broken', { x: 0, y: 0, z: 0, voxel: 1 });
    expect(calls).toHaveLength(1);
    const off = attachHaptics(createBus(), () => true, null);
    expect(() => off()).not.toThrow();
  });
});
