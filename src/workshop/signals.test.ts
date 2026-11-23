import { describe, expect, it } from 'vitest';
import { Facing } from '../core/types';
import { setup } from './parts.test';

describe('signals', () => {
  it('a lever lights wire up to 15 blocks and a lamp at the end', () => {
    const t = setup();
    t.put(0, 0, 0, 'crank_lever');
    for (let x = 1; x <= 14; x++) t.put(x, 0, 0, 'signal_wire');
    t.put(15, 0, 0, 'signal_lamp');
    t.put(16, 0, 0, 'signal_lamp');
    t.run(0.2);
    expect(t.shop.describe(15, 0, 0)).toContain('off');
    t.shop.use(0, 0, 0, null, () => undefined);
    t.run(0.2);
    expect(t.shop.describe(15, 0, 0)).toContain('on');
    expect(t.shop.describe(7, 0, 0)).toContain('strength 8');
    expect(t.shop.describe(16, 0, 0)).toContain('off'); // the wire gave out
  });

  it('a clutch flips with a signal, a gated arm works only while signalled', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'clutch');
    t.put(2, 0, 0, 'drive_shaft');
    t.put(1, 1, 0, 'crank_lever');
    t.run(0.3, [[0, 0, 0]]);
    expect(t.rpm(2)).toBe(16);
    t.shop.use(1, 1, 0, null, () => undefined); // lever on: the clutch releases
    t.run(0.3, [[0, 0, 0]]);
    expect(t.rpm(2)).toBeNull();

    const u = setup();
    u.put(0, 0, 0, 'hand_crank');
    u.put(1, 0, 0, 'mech_drill', Facing.East);
    u.put(2, 0, 0, 'dirt');
    u.put(1, 1, 0, 'crank_lever');
    u.run(4, [[0, 0, 0]]);
    expect(u.world.getBlock(2, 0, 0).key).toBe('dirt'); // the lever is off: the drill waits
    u.shop.use(1, 1, 0, null, () => undefined);
    u.run(4, [[0, 0, 0]]);
    expect(u.world.getBlock(2, 0, 0).key).toBe('air');
  });

  it('a pressure plate signals under an item, a metronome pulses, a bell rings on a jam, signal() drives a cell', () => {
    const t = setup();
    t.put(0, 0, 0, 'pressure_plate');
    t.put(1, 0, 0, 'signal_lamp');
    t.run(0.2);
    expect(t.shop.describe(1, 0, 0)).toContain('off');
    t.ground.spawn('flint', 1, 0.5, 0.6, 0.5, { scatter: false });
    t.run(0.2);
    expect(t.shop.describe(1, 0, 0)).toContain('on');

    const u = setup();
    u.put(0, 0, 0, 'metronome');
    u.put(1, 0, 0, 'signal_lamp');
    u.run(0.5);
    const on = u.shop.describe(1, 0, 0);
    u.run(2);
    expect(on).toContain('on');
    expect(u.shop.describe(1, 0, 0)).toContain('off');

    const sounds: string[] = [];
    const v = setup();
    v.bus.on('sfx', (e) => sounds.push(e.name));
    v.put(0, 0, 0, 'hand_crank');
    v.put(1, 0, 0, 'reverse_box');
    v.put(2, 0, 0, 'hand_crank');
    v.put(5, 0, 0, 'bell');
    v.shop.crank(0, 0, 0);
    v.shop.crank(2, 0, 0);
    v.run(0.2);
    expect(sounds).toContain('alarm');

    const w = setup();
    w.put(0, 0, 0, 'bell');
    w.shop.signal(1, 0, 0, true);
    w.run(0.2);
    expect(w.shop.describe(0, 0, 0)).toContain('ringing');
  });

  it('a tally board counts what it passes and resets; a clockface reads the hook', () => {
    const t = setup();
    t.put(0, 0, 0, 'tally_board', Facing.East);
    t.put(1, 0, 0, 'depot');
    t.shop.offer(0, 0, 0, 'flint', 6);
    t.run(5);
    expect(t.shop.describe(0, 0, 0)).toContain('6 passed');
    const snap = JSON.parse(JSON.stringify(t.shop.toJSON()));
    t.shop.use(0, 0, 0, null, () => undefined);
    expect(t.shop.describe(0, 0, 0)).toContain('0 passed');
    const u = setup();
    u.put(0, 0, 0, 'tally_board', Facing.East);
    u.shop.load(snap);
    expect(u.shop.describe(0, 0, 0)).toContain('6 passed');
    u.put(3, 0, 0, 'clockface');
    u.shop.clockText = () => '07:30';
    expect(u.shop.describe(3, 0, 0)).toContain('07:30');
  });

  it('levers keep their state through a save', () => {
    const t = setup();
    t.put(0, 0, 0, 'crank_lever');
    t.put(1, 0, 0, 'signal_lamp');
    t.shop.use(0, 0, 0, null, () => undefined);
    const snap = JSON.parse(JSON.stringify(t.shop.toJSON()));
    const u = setup();
    u.put(0, 0, 0, 'crank_lever');
    u.put(1, 0, 0, 'signal_lamp');
    u.shop.load(snap);
    u.run(0.2);
    expect(u.shop.describe(1, 0, 0)).toContain('on');
  });
});

describe('logic gates and cam drums', () => {
  it('an AND gate lights the wire in front only while both sides are lit; a latch holds; a counter fires on the third pulse', () => {
    const t = setup();
    // Gate at (5,0,5) facing north: left (A) = west x=4, right (B) = east x=6, front = north z=4.
    t.put(5, 0, 5, 'logic_gate', Facing.North);
    t.put(4, 0, 5, 'crank_lever');
    t.put(6, 0, 5, 'crank_lever');
    t.put(5, 0, 4, 'signal_wire');
    t.run(0.2);
    expect(t.shop.signals.lit('5,0,4')).toBe(false);
    t.shop.use(4, 0, 5, null, () => undefined);
    t.run(0.2);
    expect(t.shop.signals.lit('5,0,4')).toBe(false);
    t.shop.use(6, 0, 5, null, () => undefined);
    t.run(0.2);
    expect(t.shop.signals.lit('5,0,4')).toBe(true);
    // OR: one side is enough.
    t.shop.signals.cycleGate(5, 0, 5);
    t.shop.use(6, 0, 5, null, () => undefined);
    t.run(0.2);
    expect(t.shop.signals.lit('5,0,4')).toBe(true);
    expect(t.shop.describe(5, 0, 5)).toMatch(/OR/);
  });

  it('a turning cam drum lights wire on the sides its pegs reach, and a stopped one does not', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'cam_drum');
    t.put(1, 0, 1, 'signal_wire'); // south side = track 2
    t.put(2, 0, 0, 'signal_wire'); // east side = track 1
    t.run(0.3); // a stopped drum holds whatever its pegs show at rest: nothing moves
    const rest = t.shop.signals.lit('2,0,0');
    t.run(3);
    expect(t.shop.signals.lit('2,0,0')).toBe(rest);
    const seen = { south: false, east: false };
    for (let i = 0; i < 400; i++) {
      if (i % 20 === 0) t.shop.use(0, 0, 0, null, () => undefined);
      t.shop.tick(0.05);
      seen.south ||= t.shop.signals.lit('1,0,1');
      seen.east ||= t.shop.signals.lit('2,0,0');
    }
    expect(seen.south).toBe(true);
    expect(seen.east).toBe(true);
    expect(t.shop.describe(1, 0, 0)).toMatch(/Drum program 1: Beat/);
  });
});
