import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { DAILY_POOL } from './dailyGoals';
import { PlayerState } from './playerState';

describe('act:done', () => {
  it('counts fished, harvested and traded acts for the daily goals', () => {
    const bus = createBus();
    const player = new PlayerState(bus);
    bus.emit('act:done', { kind: 'fished' });
    bus.emit('act:done', { kind: 'fished' });
    bus.emit('act:done', { kind: 'harvested' });
    bus.emit('act:done', { kind: 'traded' });
    expect(player.stats.acts).toMatchObject({ fished: 2, harvested: 1, traded: 1 });
  });

  it('the pool has goals for the newer systems and pays more than dye', () => {
    const metrics = new Set(DAILY_POOL.map((g) => g.metric));
    for (const m of ['fished', 'harvested', 'traded'] as const) expect(metrics.has(m), m).toBe(true);
    expect(DAILY_POOL.some((g) => g.reward.kind === 'item' && !g.reward.item.endsWith('_dye'))).toBe(true);
  });
});
