import { describe, expect, it } from 'vitest';
import { lifeRig } from './life.rig';
import { ROOM_COST, ROOM_FRIEND_COST, roomCost, wakeNotes } from './rooms';

describe('rooms to rent', () => {
  it('sells a bed at dusk: pitch, then accept, sleep, notes from three regulars', () => {
    const { npcs, state, toasts, by } = lifeRig({ coins: 30, tod: 0.7 });
    npcs.speak(by('rosa')); // welcome gift
    npcs.speak(by('rosa')); // chatter + pitch (rooms are the only offer)
    expect(toasts.some((t) => t.includes('bed upstairs'))).toBe(true);
    toasts.length = 0;
    npcs.speak(by('rosa'));
    expect(state.slept).toBe(1);
    expect(npcs.coins).toBe(30 - ROOM_COST);
    const notes = toasts.filter((t) => /^(Mara|Gruk|Orrin|Bram):/.test(t));
    expect(notes).toHaveLength(3);
    expect(new Set(notes.map((n) => n.split(':')[0])).size).toBe(3);
  });

  it('refuses by day and when short of coin, and friends pay less', () => {
    const day = lifeRig({ coins: 50, tod: 0.3 });
    day.npcs.speak(day.by('rosa'));
    day.npcs.speak(day.by('rosa'));
    expect(day.toasts.some((t) => t.includes('bed upstairs'))).toBe(false);
    const poor = lifeRig({ coins: 3, tod: 0.8 });
    poor.npcs.speak(poor.by('rosa'));
    poor.npcs.speak(poor.by('rosa'));
    poor.npcs.speak(poor.by('rosa'));
    expect(poor.state.slept).toBe(0);
    expect(poor.toasts.some((t) => t.includes('you carry 3'))).toBe(true);
    expect(roomCost(0)).toBe(ROOM_COST);
    expect(roomCost(25)).toBe(ROOM_FRIEND_COST);
  });

  it('lets an unanswered pitch lapse', () => {
    const { npcs, state, by } = lifeRig({ coins: 30, tod: 0.8 });
    npcs.speak(by('rosa'));
    npcs.speak(by('rosa'));
    npcs.tick(11);
    npcs.tick(1);
    npcs.speak(by('rosa')); // fresh pitch, not a purchase
    expect(state.slept).toBe(0);
  });

  it('draws notes deterministically', () => {
    let i = 0;
    const r = (): number => ((i += 0.37) % 1);
    expect(wakeNotes(r)).toHaveLength(3);
  });
});
