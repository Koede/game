import { describe, expect, it } from 'vitest';
import { CoachState, LOOK_DONE_RAD, SPRINT_TIP_WALK } from './coach';

describe('coach marks', () => {
  it('shows look, then mine, then the goal tip once a goal is done; each goes for good', () => {
    const c = new CoachState();
    expect(c.current()).toBe('look');
    expect(c.addLook(LOOK_DONE_RAD / 2)).toBe(false);
    expect(c.addLook(LOOK_DONE_RAD / 2)).toBe(true);
    expect(c.current()).toBe('mine');
    expect(c.blockBroken()).toBe(true);
    expect(c.blockBroken()).toBe(false);
    expect(c.current()).toBeNull();
    c.objectiveCompleted();
    expect(c.current()).toBe('goal');
    expect(c.goalOpened()).toBe(true);
    expect(c.current()).toBeNull();
  });

  it('starts from what this device has already seen', () => {
    expect(new CoachState(['look', 'mine']).current()).toBeNull();
    expect(new CoachState(['look']).current()).toBe('mine');
  });

  it('shows the sprint tip after a long walk without sprinting, and never again once sprinted', () => {
    const c = new CoachState(['look', 'mine']);
    c.addWalk(SPRINT_TIP_WALK - 1);
    expect(c.current()).toBeNull();
    c.addWalk(1);
    expect(c.current()).toBe('sprint');
    expect(c.sprinted()).toBe(true);
    expect(c.current()).toBeNull();
    expect(c.sprinted()).toBe(false);
  });
});
