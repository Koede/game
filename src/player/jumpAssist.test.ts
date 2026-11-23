import { describe, expect, it } from 'vitest';
import { COYOTE_S, JUMP_BUFFER_S, JumpAssist } from './jumpAssist';

describe('JumpAssist', () => {
  it('jumps while held and standing', () => {
    const a = new JumpAssist();
    expect(a.update(0.016, true, true, true)).toBe(true);
  });

  it('coyote: a press just after leaving the ground still jumps, a late one does not', () => {
    const a = new JumpAssist();
    a.update(0.016, false, true, true);
    a.update(0.05, false, false, true);
    expect(a.update(0.05, true, false, true)).toBe(true);
    const b = new JumpAssist();
    b.update(0.016, false, true, true);
    b.update(COYOTE_S + 0.05, false, false, true);
    expect(b.update(0.016, true, false, true)).toBe(false);
  });

  it('cannot double jump from the coyote window', () => {
    const a = new JumpAssist();
    a.update(0.016, false, true, true);
    expect(a.update(0.02, true, false, true)).toBe(true);
    a.update(0.02, false, false, true);
    expect(a.update(0.02, true, false, true)).toBe(false);
  });

  it('buffer: a press shortly before landing fires on touchdown, an early one is forgotten', () => {
    const a = new JumpAssist();
    expect(a.update(0.016, true, false, true)).toBe(false);
    a.update(0.016, false, false, true);
    expect(a.update(0.016, false, true, true)).toBe(true);
    const b = new JumpAssist();
    b.update(0.016, true, false, true);
    b.update(JUMP_BUFFER_S + 0.05, false, false, true);
    expect(b.update(0.016, false, true, true)).toBe(false);
  });

  it('off: only the classic rule', () => {
    const a = new JumpAssist();
    a.update(0.016, false, true, false);
    expect(a.update(0.03, true, false, false)).toBe(false);
    a.update(0.016, false, false, false);
    expect(a.update(0.016, false, true, false)).toBe(false);
  });
});
