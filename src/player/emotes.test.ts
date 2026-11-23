import { describe, expect, it } from 'vitest';
import { Emotes, EMOTES, EMOTE_LENGTH_S } from './emotes';

describe('Emotes', () => {
  it('cycles through every emote and then stops', () => {
    const e = new Emotes();
    expect(EMOTES.map(() => e.cycle())).toEqual([...EMOTES]);
    expect(e.cycle()).toBeNull();
    expect(e.active).toBe(false);
  });

  it('timed emotes end by themselves, with an ease-out', () => {
    const e = new Emotes();
    e.play('cheer');
    e.update(EMOTE_LENGTH_S.cheer! - 0.1, false);
    expect(e.active).toBe(true);
    expect(e.view().dpitch).toBeGreaterThan(0);
    e.update(0.2, false);
    expect(e.active).toBe(false);
    expect(e.view().dpitch).toBeGreaterThan(0);
    e.update(0.5, false);
    expect(e.view()).toEqual({ dy: 0, dyaw: 0, dpitch: 0 });
  });

  it('sit lowers the eye and holds until the player moves', () => {
    const e = new Emotes();
    e.play('sit');
    e.update(5, false);
    expect(e.sitting).toBe(true);
    expect(e.view().dy).toBeCloseTo(-0.9, 5);
    e.update(0.1, true);
    expect(e.sitting).toBe(false);
  });

  it('dances on the jukebox beat when it plays', () => {
    const on = new Emotes(() => true);
    const off = new Emotes(() => false);
    on.play('dance');
    off.play('dance');
    on.update(0.7, false);
    off.update(0.7, false);
    expect(on.view().dyaw).not.toBeCloseTo(off.view().dyaw, 3);
  });
});

import { CMD_EMOTE, keyCommand } from './input/keys';

describe('emote key', () => {
  it('G is the emote command', () => {
    expect(keyCommand('KeyG')).toBe(CMD_EMOTE);
  });
});
