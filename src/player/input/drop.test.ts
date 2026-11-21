import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/context';
import { DROP_HOLD_S, InputCore } from './core';
import { CMD_DROP, isGameKey, keyCommand } from './keys';

const DT = 1 / 60;
const make = (): InputCore => new InputCore({ ...DEFAULT_SETTINGS });

describe('drop key (Q)', () => {
  it('is a game key with its own command', () => {
    expect(isGameKey('KeyQ')).toBe(true);
    expect(keyCommand('KeyQ')).toBe(CMD_DROP);
  });

  it('a tap is one drop, for exactly one frame', () => {
    const core = make();
    expect(core.keyDown('KeyQ')).toBe(true);
    const i = core.frame(DT, 0, false);
    expect(i.drop).toBe(true);
    expect(i.dropAll).toBe(false);
    core.keyUp('KeyQ');
    expect(core.frame(DT, 16, false).drop).toBe(false);
  });

  it('Shift+Q drops the stack', () => {
    const core = make();
    core.keyDown('ShiftLeft');
    core.keyDown('KeyQ');
    const i = core.frame(DT, 0, false);
    expect(i.drop && i.dropAll).toBe(true);
  });

  it('holding Q drops the rest of the stack once after the hold time', () => {
    const core = make();
    core.keyDown('KeyQ');
    expect(core.frame(DT, 0, false).drop).toBe(true);
    let all = 0;
    for (let t = DT; t < DROP_HOLD_S + 0.5; t += DT) {
      core.keyDown('KeyQ', true); // key repeat
      const i = core.frame(DT, t * 1000, false);
      if (i.dropAll) all++;
      if (t < DROP_HOLD_S - 2 * DT) expect(i.drop).toBe(false);
    }
    expect(all).toBe(1);
  });

  it('is ignored while a screen is open', () => {
    const core = make();
    core.frame(DT, 0, true);
    expect(core.keyDown('KeyQ')).toBe(false);
    expect(core.frame(DT, 16, false).drop).toBe(false);
  });
});
