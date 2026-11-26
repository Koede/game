import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { item } from '../core/registry';
import { eat } from './hunger';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  player.food = 5;
  const buffs: Array<GameEvents['buff:gained']> = [];
  bus.on('buff:gained', (e) => buffs.push(e));
  return { player, buffs };
}

describe('fish dishes', () => {
  it('winter broth gives Well-Warmed, never shortens a longer one, and may be eaten full', () => {
    const { player, buffs } = rig();
    player.give('winter_broth', 2);
    const r = eat(player, 0);
    expect(r.ok && r.buff).toBe('well_warmed');
    expect(player.wellWarmed).toBe(true);
    expect(player.buffs.wellWarmedS).toBe(item('winter_broth').food?.buffS);
    expect(buffs).toEqual([{ buff: 'well_warmed', durationS: item('winter_broth').food?.buffS }]);
    player.buffs.wellWarmedS = 900;
    player.eatCooldownS = 0;
    player.food = 20;
    expect(eat(player, 0).ok).toBe(true);
    expect(player.buffs.wellWarmedS).toBe(900);
  });

  it('fish chowder gives Well-Fed', () => {
    const { player } = rig();
    player.give('fish_chowder', 1);
    const r = eat(player, 0);
    expect(r.ok && r.buff).toBe('well_fed');
    expect(player.buffs.wellFedS).toBe(item('fish_chowder').food?.buffS);
  });
});
