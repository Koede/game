import { describe, expect, it } from 'vitest';
import { BRAKE_TORQUE, FUSE_GRACE_S, LoadGraph, coastSeconds, criticalRpm, diagnose, fresh, networkMomentum, rideThrough, shaftRuns, stepDrive, stepFuse, stepHeat, throughTorque, whipFactor, worstWhip, type DriveInput, type Engine } from './drive';
import { chain, cvtRatio, differentialMean, planetary, planetaryReduction, power, stage } from './gearMath';
import { DRUM_STEPS, advanceDrum, drumFromJSON, drumFromRows, drumToJSON, encoderPulses, follower, makeDrum, outputs, setPeg, stepEscapement, springTorque, windSpring, unwindSpring } from './drum';
import { LogicNet } from './logic';
import { pantograph, lever, rackTravel, scissorAngle, scissorHeight, sliderPhase, sliderPos, sliderRate, sliderStroke, stepAxis, strokeLoad } from './linkage';
import { Circuit, HYDRAULIC, PNEUMATIC, TANK } from './hydraulics';

const crank: Engine = { rated: 8, curve: 'flat' };
const run = (input: DriveInput, seconds: number, w = 1, dt = 0.05): number => {
  const s = fresh(w);
  for (let t = 0; t < seconds; t += dt) stepDrive(s, input, dt);
  return s.w;
};

describe('drive dynamics', () => {
  it('with default momentum a network snaps to its steady speed (legacy behaviour)', () => {
    expect(run({ engines: [crank], load: 4, momentum: 0.1 }, 0.1, 0)).toBe(1);
    expect(run({ engines: [crank], load: 12, momentum: 0.1 }, 0.1, 1)).toBe(0);
  });

  it('a flywheel coasts after the engine stops, for about M / load seconds', () => {
    const M = networkMomentum([{ kind: 'flywheel', ratio: 1 }]);
    const t = coastSeconds(M, 4);
    expect(t).toBeGreaterThan(8);
    const s = fresh(1);
    let n = 0;
    while (s.w > 0.05 && n < 4000) {
      stepDrive(s, { engines: [], load: 4, momentum: M }, 0.05);
      n++;
    }
    expect(n * 0.05).toBeGreaterThan(t * 0.9);
    expect(n * 0.05).toBeLessThan(t * 1.1);
  });

  it('a pulsed load stalls a bare crank line but a flywheel rides through', () => {
    const peaks = (momentum: number): number => {
      const s = fresh(1);
      let low = 1;
      for (let i = 0; i < 400; i++) {
        const pulse = i % 20 < 4 ? 2 : 0; // 0.2 s strokes at 3x every second
        stepDrive(s, { engines: [crank], load: 4, pulse, momentum }, 0.05);
        low = Math.min(low, s.w);
      }
      return low;
    };
    expect(peaks(0.1)).toBeLessThan(0.2);
    expect(peaks(40)).toBeGreaterThan(0.85);
  });

  it('a steam engine lugs down instead of stalling a load a crank could not start', () => {
    const steam: Engine = { rated: 10, curve: 'steam' };
    const w = run({ engines: [steam], load: 12, momentum: 1 }, 5, 1);
    expect(w).toBeGreaterThan(0.2);
    expect(w).toBeLessThan(1);
    expect(run({ engines: [{ rated: 10, curve: 'flat' }], load: 12, momentum: 1 }, 5, 1)).toBeLessThan(0.05);
  });

  it('a brake stops a flywheel and costs more load than a lit line', () => {
    const M = 40;
    const free = run({ engines: [], load: 1, momentum: M }, 3, 1);
    const braked = run({ engines: [], load: 1, momentum: M, brake: 1 }, 3, 1);
    expect(braked).toBeLessThan(free);
    expect(BRAKE_TORQUE).toBeGreaterThan(8);
    expect(coastSeconds(M, 1, 0, 1)).toBeLessThan(coastSeconds(M, 1));
  });

  it('is stable for any dt (implicit step), including large ones with tiny momentum', () => {
    const s = fresh(1);
    for (let i = 0; i < 50; i++) stepDrive(s, { engines: [{ rated: 10, curve: 'steam' }], load: 12, momentum: 0.05 }, 1);
    expect(s.w).toBeGreaterThanOrEqual(0);
    expect(s.w).toBeLessThanOrEqual(1);
  });

  it('rideThrough grows with momentum', () => {
    expect(rideThrough(40, 8, 4, 0.2)).toBeGreaterThan(rideThrough(0.1, 8, 4, 0.2));
  });
});

describe('whip', () => {
  it('long runs whip near their critical speed and a support splits the run', () => {
    const cells: [number, number, number][] = Array.from({ length: 10 }, (_, i) => [i, 0, 0]);
    const runs = shaftRuns(cells);
    expect(runs).toHaveLength(1);
    expect(runs[0].length).toBe(10);
    expect(whipFactor(10, criticalRpm(10))).toBeLessThan(1);
    expect(whipFactor(10, 48)).toBe(1);
    expect(worstWhip(runs, criticalRpm(10))).toBeLessThan(1);
    const split = shaftRuns(cells.filter((c) => c[0] !== 5), new Set(['5,0,0']));
    expect(Math.max(...split.map((r) => r.length))).toBeLessThan(10);
    expect(whipFactor(2, 80)).toBe(1);
  });
});

describe('fuse, heat, torque through', () => {
  it('adds the downstream load to every ancestor', () => {
    const t = throughTorque(['a', 'b', 'c', 'd'], new Map([['a', null], ['b', 'a'], ['c', 'b'], ['d', 'a']]), new Map([['a', 0], ['b', 1], ['c', 4], ['d', 2]]));
    expect(t.get('a')).toBe(7);
    expect(t.get('b')).toBe(5);
    expect(t.get('c')).toBe(4);
  });

  it('a fuse snaps after its grace time over rating, not before, and not under it', () => {
    const f = { over: 0 };
    expect(stepFuse(f, 6, 5, 10)).toBe(false);
    let t = 0;
    while (!stepFuse(f, 6, 12, 0.05) && t < 5) t += 0.05;
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThan(FUSE_GRACE_S + 0.2);
    expect(stepFuse({ over: 0 }, 0, 99, 5)).toBe(false);
  });

  it('heat rises under slip and cools', () => {
    let h = 0;
    for (let i = 0; i < 20; i++) h = stepHeat(h, 30, 0.1);
    expect(h).toBeGreaterThan(30);
    const hot = h;
    for (let i = 0; i < 200; i++) h = stepHeat(h, 0, 0.1);
    expect(h).toBeLessThan(hot / 4);
  });
});

describe('diagnose and graph', () => {
  const base = { rated: 8, load: 4, pulse: 0, momentum: 0.1, w: 1, whip: false, hasFlywheel: false, brake: 0, hasFuse: false };
  it('names the fix for each failure', () => {
    expect(diagnose(base)[0].code).toBe('ok');
    expect(diagnose({ ...base, rated: 0 })[0].code).toBe('idle');
    expect(diagnose({ ...base, load: 12, w: 0 })[0].code).toBe('stall');
    const rip = diagnose({ ...base, pulse: 2 })[0];
    expect(rip.code).toBe('ripple');
    expect(rip.fix).toMatch(/flywheel/i);
    expect(diagnose({ ...base, whip: true }).some((f) => f.code === 'whip')).toBe(true);
  });

  it('ring buffer keeps the newest samples oldest-first', () => {
    const g = new LoadGraph(4);
    for (let i = 1; i <= 6; i++) g.push(i, 10, 1);
    expect(g.series().load).toEqual([3, 4, 5, 6]);
    expect(g.peakRatio()).toBeCloseTo(0.6);
  });
});

describe('gear math', () => {
  it('gearing trades speed for torque and loses a little power', () => {
    const out = stage({ rpm: 16, torque: 8 }, 2);
    expect(out.rpm).toBe(32);
    expect(out.torque).toBeLessThan(4);
    expect(power(out)).toBeLessThan(power({ rpm: 16, torque: 8 }));
    const back = chain({ rpm: 16, torque: 8 }, [{ ratio: 3 }, { ratio: 1 / 3 }]);
    expect(back.rpm).toBeCloseTo(16);
  });

  it('planetary set obeys its law and holds', () => {
    const p = planetary(2, { sun: 30, carrier: 10 });
    expect(p.ring).toBeCloseTo(0);
    expect(planetary(2, { sun: 30, carrier: 5 }).ring).toBeCloseTo(-7.5);
    expect(planetary(3, { sun: 16 }, 'ring').carrier).toBeCloseTo(16 * planetaryReduction(3));
    expect(() => planetary(2, { sun: 1 })).toThrow();
    expect(differentialMean(10, -4)).toBe(3);
  });

  it('cvt spans 0.4 to 2.5', () => {
    expect(cvtRatio(0)).toBeCloseTo(0.4);
    expect(cvtRatio(15)).toBeCloseTo(2.5);
    expect(cvtRatio(7)).toBeGreaterThan(cvtRatio(6));
  });
});

describe('drum, spring, escapement', () => {
  it('fires every peg edge in order and loops', () => {
    const d = drumFromRows(['x...x...x...x...', '..xx............']);
    const edges = advanceDrum(d, 16, 1); // 2 steps
    expect(edges.map((e) => `${e.track}:${e.step}:${e.on}`)).toEqual(['0:1:false', '1:2:true']);
    expect(outputs(d)[1]).toBe(true);
    const fast = advanceDrum(d, 160, 1); // 20 steps: nothing swallowed
    expect(fast.length).toBeGreaterThan(8);
    expect(d.pos).toBeLessThan(DRUM_STEPS);
  });

  it('runs backwards on negative rpm', () => {
    const d = drumFromRows(['x...............']);
    d.pos = 0.5;
    const e = advanceDrum(d, -16, 0.5);
    expect(e.some((x) => x.track === 0 && !x.on)).toBe(true);
    expect(d.pos).toBeGreaterThan(14);
  });

  it('follower rises before a peg and falls after', () => {
    const d = drumFromRows(['..x.............']);
    d.pos = 1.2;
    expect(follower(d, 0)).toBe(0);
    d.pos = 1.75;
    expect(follower(d, 0)).toBeGreaterThan(0.4);
    d.pos = 2.2;
    expect(follower(d, 0)).toBe(1);
  });

  it('saves and reads back; bad data gives an empty drum', () => {
    const d = drumFromRows(['xx']);
    setPeg(d, 3, 15, true);
    d.pos = 3.5;
    expect(drumFromJSON(JSON.parse(JSON.stringify(drumToJSON(d))))).toEqual(d);
    expect(drumFromJSON('junk')).toEqual(makeDrum());
    expect(drumFromJSON([[1, 'a'], NaN]).pegs[0]).toBe(1);
  });

  it('encoder counts slot crossings', () => {
    expect(encoderPulses(0, 0.25)).toBe(4);
    expect(encoderPulses(0.5, 0.49)).toBe(-1);
  });

  it('a spring weakens at the end; an escapement keeps time while wound', () => {
    const s = { wound: 120, max: 120 };
    expect(springTorque(s)).toBe(1);
    s.wound = 5;
    expect(springTorque(s)).toBeLessThan(1);
    expect(springTorque({ wound: 0, max: 1 })).toBe(0);
    const e = { acc: 0, period: 0.5 };
    const spring = { wound: 10, max: 120 };
    let ticks = 0;
    for (let i = 0; i < 20; i++) ticks += stepEscapement(e, spring, 0.5);
    expect(ticks).toBeGreaterThan(8);
    expect(windSpring(spring, 1000)).toBe(110);
    unwindSpring(spring, 1000);
    expect(stepEscapement(e, spring, 5)).toBe(0);
  });
});

describe('logic net', () => {
  it('gates, latch, counter and loops evaluate deterministically', () => {
    const n = new LogicNet();
    n.add({ id: 'a', kind: 'source', ins: [] });
    n.add({ id: 'b', kind: 'source', ins: [] });
    n.add({ id: 'and', kind: 'and', ins: ['a', 'b'] });
    n.add({ id: 'xor', kind: 'xor', ins: ['a', 'b'] });
    n.add({ id: 'not', kind: 'not', ins: ['a'] });
    n.add({ id: 'cmp', kind: 'cmp', ins: ['a', 'b'] });
    n.set('a', 9);
    n.tick();
    expect([n.level('and'), n.level('xor'), n.level('not'), n.level('cmp')]).toEqual([0, 15, 0, 15]);
    n.set('b', 12);
    n.tick();
    expect([n.level('and'), n.level('xor'), n.level('cmp')]).toEqual([9, 0, 0]);
  });

  it('latch holds until reset, counter fires on every Nth rising edge', () => {
    const n = new LogicNet();
    n.add({ id: 'set', kind: 'source', ins: [] });
    n.add({ id: 'rst', kind: 'source', ins: [] });
    n.add({ id: 'l', kind: 'latch', ins: ['set', 'rst'] });
    n.add({ id: 'c', kind: 'counter', ins: ['set', 'rst'], arg: 3 });
    const pulse = (on: number): void => {
      n.set('set', on);
      n.tick();
    };
    pulse(15);
    pulse(0);
    expect(n.level('l')).toBe(15);
    n.set('rst', 15);
    n.tick();
    expect(n.level('l')).toBe(0);
    n.set('rst', 0);
    // Reset cleared the counter: three rising edges fire it.
    const fired: number[] = [];
    for (let i = 0; i < 3; i++) {
      pulse(15);
      fired.push(n.level('c'));
      pulse(0);
    }
    expect(fired).toEqual([0, 0, 15]);
    expect(n.count('c')).toBe(0);
  });

  it('a feedback loop does not hang and acts as a one-tick delay (a toggle)', () => {
    const n = new LogicNet();
    n.add({ id: 't', kind: 'not', ins: ['t'] });
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      n.tick();
      seen.push(n.level('t'));
    }
    expect(seen).toEqual([15, 0, 15, 0]);
  });

  it('save keeps counter state and survives bad data', () => {
    const n = new LogicNet();
    n.add({ id: 'p', kind: 'source', ins: [] });
    n.add({ id: 'c', kind: 'counter', ins: ['p'], arg: 5 });
    n.set('p', 15);
    n.tick();
    const raw = JSON.parse(JSON.stringify(n.toJSON()));
    const m = new LogicNet();
    m.add({ id: 'p', kind: 'source', ins: [] });
    m.add({ id: 'c', kind: 'counter', ins: ['p'], arg: 5 });
    m.load(raw);
    expect(m.count('c')).toBe(1);
    m.load('nope');
    m.load([null, { id: 'zz' }, { id: 'c', held: 'x' }]);
    expect(m.count('c')).toBe(0);
  });

  it('200 cells tick fast', () => {
    const n = new LogicNet();
    n.add({ id: 's', kind: 'source', ins: [] });
    for (let i = 0; i < 199; i++) n.add({ id: `n${i}`, kind: i % 3 === 0 ? 'not' : 'or', ins: [i === 0 ? 's' : `n${i - 1}`, 's'] });
    n.set('s', 15);
    const t = performance.now();
    for (let i = 0; i < 100; i++) n.tick();
    expect(performance.now() - t).toBeLessThan(200);
  });
});

describe('linkage', () => {
  const g = { crank: 0.5, rod: 1.6 };
  it('stroke is twice the crank and the pose is consistent', () => {
    expect(sliderStroke(g)).toBeCloseTo(1, 5);
    expect(sliderPhase(g, 0)).toBeCloseTo(1);
    expect(sliderPhase(g, 0.5)).toBeCloseTo(0);
    expect(sliderRate(g, 0)).toBeCloseTo(0, 5);
    expect(Math.abs(sliderRate(g, Math.PI / 2))).toBeGreaterThan(0.4);
    expect(sliderPos(g, 1)).toBeGreaterThan(sliderPos(g, 2));
  });

  it('ram load is a pulse: zero out of the work zone, mean 1, peak above 1.5', () => {
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < 100; i++) {
      const v = strokeLoad(g, i / 100);
      sum += v;
      peak = Math.max(peak, v);
    }
    expect(sum / 100).toBeGreaterThan(0.8);
    expect(sum / 100).toBeLessThan(1.2);
    expect(peak).toBeGreaterThan(1.5);
    expect(strokeLoad(g, 0.75)).toBe(0);
  });

  it('rack, scissor, pantograph and lever conserve what they should', () => {
    expect(rackTravel(Math.PI * 2, 0.5)).toBeCloseTo(Math.PI);
    const a = scissorAngle(3, 1, 1.5) as number;
    expect(scissorHeight(3, 1, a)).toBeCloseTo(1.5);
    expect(scissorAngle(3, 1, 9)).toBeNull();
    expect(pantograph([0, 0], [1, 2], 2)).toEqual([2, 4]);
    const l = lever(1, 4, 2, 8);
    expect(l.travel * l.force).toBeCloseTo(16);
  });

  it('a gantry axis accelerates, cruises and stops exactly on the target without overshoot', () => {
    const a = { pos: 0, vel: 0 };
    let maxPos = 0;
    for (let i = 0; i < 600; i++) {
      stepAxis(a, 10, 0.02);
      maxPos = Math.max(maxPos, a.pos);
    }
    expect(a.pos).toBe(10);
    expect(a.vel).toBe(0);
    expect(maxPos).toBeLessThanOrEqual(10);
  });
});

describe('hydraulics', () => {
  it('a pump charges an accumulator, a valve fires a cylinder, a relief caps pressure', () => {
    const c = new Circuit();
    c.add({ kind: 'pump', id: 'p', to: 'a', disp: 0.4, rpm: 60 })
      .add({ kind: 'relief', id: 'r', at: 'a', setting: 30 })
      .add({ kind: 'accumulator', id: 'acc', at: 'a', size: 4, precharge: 5 })
      .add({ kind: 'valve', id: 'v', from: 'a', to: 'b', open: false })
      .add({ kind: 'cylinder', id: 'cyl', at: 'b', area: 0.5, stroke: 3, load: 4, springReturn: true });
    let load = 0;
    for (let i = 0; i < 400; i++) load = Math.max(load, c.step(0.05).pumpLoad);
    expect(c.pressure('a')).toBeGreaterThan(10);
    expect(c.pressure('a')).toBeLessThanOrEqual(36);
    expect(load).toBeGreaterThan(0);
    expect(c.position('cyl')).toBe(0);
    c.setValve('v', true);
    for (let i = 0; i < 200; i++) c.step(0.05);
    expect(c.position('cyl')).toBeGreaterThan(1);
    c.setValve('v', false);
    c.setLoad('cyl', 40);
    c.setPump('p', 0);
    for (let i = 0; i < 600; i++) c.step(0.05);
    expect(c.position('cyl')).toBeLessThan(3);
  });

  it('a bigger cylinder is slower but pushes harder (the ratio lesson)', () => {
    const t = (area: number, load: number): number => {
      const c = new Circuit();
      c.add({ kind: 'pump', id: 'p', to: 'a', disp: 0.4, rpm: 60 }).add({ kind: 'relief', id: 'r', at: 'a', setting: 30 })
        .add({ kind: 'valve', id: 'v', from: 'a', to: 'b', open: true }).add({ kind: 'cylinder', id: 'cyl', at: 'b', area, stroke: 2, load, springReturn: false });
      for (let i = 0; i < 4000; i++) {
        c.step(0.05);
        if (c.position('cyl') >= 2) return i;
      }
      return Infinity;
    };
    expect(t(0.5, 4)).toBeLessThan(t(2, 4));
    expect(t(2, 40)).toBeLessThan(Infinity); // 40 / 2 = 20 bar: the big one can lift what the small one cannot (40 / 0.5 = 80 bar)
    expect(t(0.5, 40)).toBe(Infinity);
  });

  it('pneumatic circuits are softer than hydraulic ones', () => {
    const fill = (m: typeof PNEUMATIC): number => {
      const c = new Circuit(m);
      c.add({ kind: 'pump', id: 'p', to: 'a', disp: 0.4, rpm: 60 });
      for (let i = 0; i < 20; i++) c.step(0.05);
      return c.pressure('a');
    };
    expect(fill(PNEUMATIC)).toBeLessThan(fill(HYDRAULIC));
    expect(TANK).toBe('tank');
  });
});

describe('performance (200 parts)', () => {
  it('a 200-part network steps fast', () => {
    const parts = Array.from({ length: 200 }, (_, i) => ({ kind: i % 20 === 0 ? 'flywheel' : 'drive_shaft', ratio: 1 }));
    const M = networkMomentum(parts);
    const s = fresh(1);
    const t = performance.now();
    for (let i = 0; i < 2000; i++) stepDrive(s, { engines: [crank], load: 6, pulse: i % 20 < 4 ? 1 : 0, momentum: M }, 0.05);
    expect(performance.now() - t).toBeLessThan(150);
  });
});
