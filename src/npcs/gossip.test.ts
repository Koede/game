import { describe, expect, it } from 'vitest';
import { NPCS } from './data';
import { phaseOfTime } from './dialogue';
import { BUBBLE_GAP_S, BUBBLE_S, EXCHANGES, GOSSIP_RANGE, GOSSIP_SLOTS, advance, bubbleOf, eligible, slotAt } from './gossip';
import { lifeRig } from './life.rig';
import { ROUTINES } from './routines';

describe('gossip data', () => {
  it('has unique exchanges between two real people, each with lines for both', () => {
    expect(new Set(EXCHANGES.map((e) => e.id)).size).toBe(EXCHANGES.length);
    const people = new Set(NPCS.filter((n) => n.kind === 'person').map((n) => n.id));
    for (const e of EXCHANGES) {
      expect(people.has(e.a) && people.has(e.b) && e.a !== e.b, e.id).toBe(true);
      expect(new Set(e.lines.map((l) => l[0]))).toEqual(new Set(['a', 'b']));
      for (const [, t] of e.lines) expect(t.length).toBeGreaterThan(10);
    }
  });

  it('can happen: some phase it suits puts the pair within earshot on their routines', () => {
    const rep = { morning: 0.1, day: 0.4, evening: 0.7, night: 0.9 } as const;
    for (const e of EXCHANGES) {
      const ok = (['morning', 'day', 'evening', 'night'] as const).some((ph) => {
        if (e.when.length && !e.when.includes(ph)) return false;
        const a = ROUTINES[e.a][ph];
        const b = ROUTINES[e.b][ph];
        return Math.hypot(a[0] - b[0], a[2] - b[2]) <= GOSSIP_RANGE && phaseOfTime(rep[ph]) === ph;
      });
      expect(ok, e.id).toBe(true);
    }
  });

  it('opens slots through the day and picks only suitable close pairs', () => {
    expect(GOSSIP_SLOTS.every((s, i) => i === 0 || s > GOSSIP_SLOTS[i - 1])).toBe(true);
    expect(slotAt(0.31)).toBe(1);
    expect(slotAt(0.45)).toBe(-1);
    const close = eligible(0.4, () => 1, new Set());
    expect(close.every((e) => e.when.includes('day'))).toBe(true);
    expect(eligible(0.4, () => 99, new Set())).toEqual([]);
    expect(eligible(0.4, () => 1, new Set(close.map((e) => e.id)))).toHaveLength(close.length);
  });

  it('runs a conversation line by line with a gap and ends', () => {
    let r = { ex: EXCHANGES[0], at: 0, left: BUBBLE_S } as ReturnType<typeof advance>;
    const spoke: string[] = [];
    for (let i = 0; i < 400 && r; i++) {
      const b = bubbleOf(r);
      if (b && spoke[spoke.length - 1] !== b.text) spoke.push(b.text);
      r = advance(r, 0.1);
    }
    expect(r).toBeNull();
    expect(spoke).toEqual(EXCHANGES[0].lines.map((l) => l[1]));
    expect(BUBBLE_GAP_S).toBeGreaterThan(0);
  });
});

describe('gossip in the tavern', () => {
  it('starts in a slot when the player is close, shows bubbles on the views, and happens once per slot', () => {
    const { npcs } = lifeRig({ tod: 0.31 });
    expect(npcs.overheard()).toBeNull();
    npcs.tick(0.1);
    const heard = npcs.overheard();
    expect(heard).not.toBeNull();
    expect(npcs.views().filter((v) => v.bubble).map((v) => v.id)).toEqual([heard!.id]);
    const texts = new Set<string>();
    for (let i = 0; i < 300; i++) {
      npcs.tick(0.1);
      const o = npcs.overheard();
      if (o) texts.add(o.text);
    }
    expect(texts.size).toBeGreaterThanOrEqual(3);
    expect(npcs.overheard()).toBeNull();
    for (let i = 0; i < 50; i++) npcs.tick(0.1); // same slot: no second conversation
    expect(npcs.overheard()).toBeNull();
  });

  it('stays quiet when the player is far away, and outside a slot', () => {
    const far = lifeRig({ tod: 0.31 });
    far.host.companion.player = () => ({ x: 400, y: 41, z: 400, dead: false });
    far.npcs.tick(0.1);
    expect(far.npcs.overheard()).toBeNull();
    const off = lifeRig({ tod: 0.45 });
    off.npcs.tick(0.1);
    expect(off.npcs.overheard()).toBeNull();
  });

  it('remembers what it said across a save', () => {
    const a = lifeRig({ tod: 0.31 });
    a.npcs.tick(0.1);
    const snap = JSON.parse(JSON.stringify(a.npcs.toJSON()));
    expect(snap.gossip.said).toHaveLength(1);
    const b = lifeRig({ tod: 0.31 });
    b.npcs.load(snap);
    b.npcs.tick(0.1);
    expect(b.npcs.overheard()).toBeNull(); // the slot already held today
  });
});
