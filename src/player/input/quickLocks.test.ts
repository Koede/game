import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../core/context';
import { InputCore } from './core';

const frame = (core: InputCore, blocked = false) => core.frame(1 / 60, 0, blocked);

describe('quick menu toggles on the input core', () => {
  it('the sneak toggle holds sneak on until it is switched off, with no key held', () => {
    const core = new InputCore(defaultSettings(true));
    expect(frame(core).sneak).toBe(false);
    core.setSneakLock(true);
    expect(core.sneakLocked).toBe(true);
    expect(frame(core).sneak).toBe(true);
    expect(frame(core).sneak).toBe(true);
    core.setSneakLock(false);
    expect(frame(core).sneak).toBe(false);
  });

  it('the sprint lock holds sprint on until it is switched off', () => {
    const core = new InputCore(defaultSettings(true));
    core.setSprintLock(true);
    expect(frame(core).sprint).toBe(true);
    core.setSprintLock(false);
    expect(frame(core).sprint).toBe(false);
  });

  it('sneaking and sprinting do not go together: sneak clears the sprint lock and the sprint lock is refused while sneaking', () => {
    const core = new InputCore(defaultSettings(true));
    core.setSprintLock(true);
    core.setSneakLock(true);
    expect(core.sprintLocked).toBe(false);
    core.setSprintLock(true);
    expect(core.sprintLocked).toBe(false);
    expect(frame(core).sprint).toBe(false);
    core.setSneakLock(false);
    core.setSprintLock(true);
    expect(core.sprintLocked).toBe(true);
  });

  it('the locks survive a screen opening and a release of everything', () => {
    const core = new InputCore(defaultSettings(true));
    core.setSprintLock(true);
    expect(frame(core, true).sprint).toBe(false);
    core.releaseAll();
    expect(core.sprintLocked).toBe(true);
    expect(frame(core).sprint).toBe(true);
  });
});

describe('quick menu emote pick', () => {
  it('an emote pick is one frame only', () => {
    const core = new InputCore(defaultSettings(true));
    core.requestEmoteSet('dance');
    expect(frame(core).emoteSet).toBe('dance');
    expect(frame(core).emoteSet).toBeNull();
  });

  it("'stop' is passed through the same way", () => {
    const core = new InputCore(defaultSettings(true));
    core.requestEmoteSet('stop');
    expect(frame(core).emoteSet).toBe('stop');
  });

  it('a pick made while a screen is open is ignored, and a pick left pending is dropped when the screen opens', () => {
    const core = new InputCore(defaultSettings(true));
    frame(core, true);
    core.requestEmoteSet('wave');
    expect(frame(core).emoteSet).toBeNull();
    core.requestEmoteSet('wave');
    frame(core, true);
    expect(frame(core).emoteSet).toBeNull();
  });
});
