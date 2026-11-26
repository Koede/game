import { describe, expect, it } from 'vitest';
import { createBus, type Difficulty } from '../core/context';
import type { WeatherState } from '../core/types';
import { DISASTER_TUNING } from '../content/disasters';
import {
  Disasters, cableExposed, flueOf, fuelSmoke, furnaceBelowChimney, isDisastersSnapshot, rodCovers, valveNear,
  type BoilerProbe, type FlueProbe,
} from './disasters';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';

const STORM = { kind: 'storm', intensity: 0.9 } as WeatherState;
const CLEAR = { kind: 'clear', intensity: 0 } as WeatherState;

function rig(difficulty: Difficulty = 'normal') {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-20, 5, -20, 20, 5, 20, 'grass');
  const player = new PlayerState(bus, { x: 15.5, y: 6, z: 15.5 });
  const toasts: string[] = [];
  const warns: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  bus.on('disaster:warn', (e) => warns.push(`${e.kind}:${e.level}`));
  const st = { difficulty, weather: CLEAR, rand: 0, valve: false };
  const furnaces: FlueProbe[] = [];
  const boilers: BoilerProbe[] = [];
  const cables: Array<[number, number, number]> = [];
  const bursts: number[] = [];
  const vented: number[] = [];
  const d = new Disasters({
    world, bus, player,
    difficulty: () => st.difficulty,
    weather: () => st.weather,
    rng: () => st.rand,
    furnaces: () => furnaces,
    boilers: () => boilers,
    cables: (fn) => cables.forEach(([x, y, z]) => fn(x, y, z)),
    valveNear: () => st.valve,
    burst: (x, y, z, r) => { bursts.push(r); world.setVoxel(x, y, z, 0); },
  });
  const boiler = (over: Partial<BoilerProbe> = {}): BoilerProbe => {
    const b: BoilerProbe = { x: 0, y: 6, z: 0, loaded: true, fill: 1, tempC: 500, vent: (l) => { vented.push(l); return l; }, ...over };
    boilers.push(b);
    return b;
  };
  const furnace = (over: Partial<FlueProbe> = {}): FlueProbe & { out: number } => {
    const f = { x: 0, y: 6, z: 5, lit: true, tempC: 500, burnItem: 'oak_log', loaded: true, out: 0, extinguish() { this.out++; this.lit = false; }, ...over };
    furnaces.push(f);
    return f;
  };
  const run = (seconds: number, dt = 0.5): void => { for (let t = 0; t < seconds; t += dt) d.tick(dt); };
  return { bus, world, player, toasts, warns, st, d, boiler, furnace, cables, bursts, vented, run, furnaces, boilers };
}

describe('boiler overpressure', () => {
  it('builds under a full steam room and heat, telegraphs, then bursts (normal: the boiler alone, a mild blast)', () => {
    const r = rig('normal');
    r.boiler();
    r.run(DISASTER_TUNING.normal.boiler.riseS * 0.5);
    expect(r.warns).toContain('boiler:watch');
    expect(r.bursts).toEqual([]);
    r.run(DISASTER_TUNING.normal.boiler.riseS * 0.4);
    expect(r.warns).toContain('boiler:warning');
    expect(r.toasts.some((t) => /IN THE RED/.test(t))).toBe(true);
    r.run(DISASTER_TUNING.normal.boiler.riseS * 0.2);
    expect(r.bursts).toEqual([0]);
    expect(r.warns.at(-1)).toBe('boiler:struck');
  });

  it('hard is faster and blasts', () => {
    const r = rig('hard');
    r.boiler({ fill: 0.85 });
    r.run(DISASTER_TUNING.hard.boiler.riseS + 2);
    expect(r.bursts).toEqual([DISASTER_TUNING.hard.boiler.blastRadius]);
  });

  it('is prevented by a safety valve: it vents and the pressure holds below the red', () => {
    const r = rig('hard');
    r.st.valve = true;
    r.boiler();
    r.run(300);
    expect(r.bursts).toEqual([]);
    expect(r.vented.length).toBeGreaterThan(0);
    expect(r.warns).toContain('boiler:averted');
    expect(r.d.pressureAt(0, 6, 0)).toBeLessThanOrEqual(DISASTER_TUNING.hard.boiler.ventAt + 1e-9);
  });

  it('is prevented by using the steam, or by letting the fire die', () => {
    for (const calm of [{ fill: 0.3 }, { tempC: 100 }]) {
      const r = rig('hard');
      const b = r.boiler();
      r.run(DISASTER_TUNING.hard.boiler.riseS * 0.9);
      expect(r.d.pressureAt(0, 6, 0)).toBeGreaterThan(0.5);
      Object.assign(b, calm);
      r.run(DISASTER_TUNING.hard.boiler.fallS + 1);
      expect(r.d.pressureAt(0, 6, 0)).toBe(0);
      r.run(600);
      expect(r.bursts).toEqual([]);
    }
  });

  it('peaceful has no disasters at all', () => {
    const r = rig('peaceful');
    r.boiler();
    r.run(600);
    expect(r.bursts).toEqual([]);
    expect(r.warns).toEqual([]);
  });

  it('finds a valve block by key within reach', () => {
    const r = rig();
    expect(valveNear(r.world, 0, 6, 0)).toBe(false);
  });
});

describe('steam-loop boilers: the steam loop bursts them, the disasters add the scald', () => {
  it('a boiler that vanishes while at its rating scalds a player close by; one taken down calmly does not', () => {
    for (const [fill, close] of [[1.02, true], [0.4, true], [1.02, false]] as const) {
      const bus = createBus();
      const world = new FakeWorld(bus);
      const player = new PlayerState(bus, { x: 0.5, y: 6, z: 0.5 });
      const toasts: string[] = [];
      bus.on('toast', (e) => toasts.push(e.text));
      let list = [{ x: close ? 1 : 40, y: 6, z: 1, fill }];
      const d = new Disasters({
        world, bus, player, difficulty: () => 'normal', weather: () => CLEAR, rng: () => 0,
        furnaces: () => [], boilers: () => [], cables: () => {}, burst: () => {}, steamBoilers: () => list,
      });
      d.tick(0.5);
      list = [];
      const hp = player.health;
      d.tick(0.5);
      const scalded = fill >= 1 && close;
      expect(player.health < hp).toBe(scalded);
      expect(toasts.some((t) => /scalded/.test(t))).toBe(scalded);
      expect(d.alerts()).toEqual([]); // no pressure tracking of its own: the steam loop owns the warning
    }
  });
});

describe('chimney fires', () => {
  const sootS = (flue: 'blocked' | 'open' | 'chimney', fuel = 'oak_log', temp = 500): number => {
    const r = rig('normal');
    const f = r.furnace({ burnItem: fuel, tempC: temp });
    if (flue === 'blocked') r.world.put(f.x, f.y + 2, f.z, 'plank');
    if (flue === 'chimney') { r.world.put(f.x, f.y + 1, f.z, 'brick_chimney'); r.world.put(f.x, f.y + 2, f.z, 'brick_chimney'); }
    r.run(100);
    return r.d.sootAt(f.x, f.y, f.z);
  };

  it('classifies the flue: a stack, an open column, a ceiling in the way', () => {
    const r = rig();
    expect(flueOf(r.world, 0, 6, 5)).toBe('open');
    r.world.put(0, 8, 5, 'plank');
    expect(flueOf(r.world, 0, 6, 5)).toBe('blocked');
    r.world.put(0, 8, 5, 'plank', false);
    r.world.setVoxel(0, 8, 5, 0);
    r.world.put(0, 7, 5, 'brick_chimney');
    expect(flueOf(r.world, 0, 6, 5)).toBe('chimney');
  });

  it('a proper flue and clean fuel keep the soot down; a blocked flue and smoky wood fill it', () => {
    const blocked = sootS('blocked');
    const open = sootS('open');
    const stack = sootS('chimney');
    expect(blocked).toBeGreaterThan(open);
    expect(open).toBeGreaterThan(stack);
    expect(sootS('blocked', 'coal')).toBeLessThan(blocked / 3);
    expect(fuelSmoke('stick')).toBeGreaterThan(fuelSmoke('coal'));
  });

  it('burning hot burns the soot off instead', () => {
    const r = rig('normal');
    const f = r.furnace({ tempC: 500 });
    r.world.put(f.x, f.y + 2, f.z, 'plank');
    r.run(200);
    const before = r.d.sootAt(f.x, f.y, f.z);
    expect(before).toBeGreaterThan(0.2);
    f.tempC = DISASTER_TUNING.normal.chimney.burnOffC + 50;
    r.run(60);
    expect(r.d.sootAt(f.x, f.y, f.z)).toBeLessThan(before);
  });

  it('telegraphs, then the flue catches: the furnace goes out (normal: nothing burns)', () => {
    const r = rig('normal');
    const f = r.furnace({ burnItem: 'stick' });
    r.world.put(f.x, f.y + 2, f.z, 'plank');
    r.world.put(f.x + 1, f.y, f.z, 'plank');
    r.run(2000);
    expect(r.warns).toEqual(expect.arrayContaining(['chimney:watch', 'chimney:warning', 'chimney:struck']));
    expect(f.out).toBe(1);
    expect(r.world.getBlock(f.x + 1, f.y, f.z).key).toBe('plank');
  });

  it('hard: the fire eats woodwork and burns a player standing close', () => {
    const r = rig('hard');
    const f = r.furnace({ burnItem: 'stick', x: 15, z: 15 });
    r.world.put(f.x, f.y + 2, f.z, 'plank');
    r.world.put(f.x + 1, f.y, f.z, 'plank');
    const hp = r.player.health;
    r.run(2000);
    expect(r.world.getBlock(f.x + 1, f.y, f.z).key).toBe('air');
    expect(r.player.health).toBeLessThan(hp);
  });

  it('is prevented by sweeping the stack with a stick', () => {
    const r = rig('normal');
    const f = r.furnace();
    r.world.put(f.x, f.y, f.z, 'furnace_clay');
    r.world.put(f.x, f.y + 1, f.z, 'brick_chimney');
    r.world.put(f.x, f.y + 2, f.z, 'brick_chimney');
    r.world.put(f.x, f.y + 3, f.z, 'plank');
    r.run(250);
    expect(r.d.sootAt(f.x, f.y, f.z)).toBeGreaterThan(0.45);
    expect(furnaceBelowChimney(r.world, f.x, f.y + 2, f.z)).toEqual({ x: f.x, y: f.y, z: f.z });
    expect(r.d.sweep(f.x, f.y + 2, f.z)).toBe(true);
    expect(r.d.sootAt(f.x, f.y, f.z)).toBe(0);
    expect(r.d.sweep(f.x + 3, f.y + 2, f.z)).toBe(false);
  });
});

describe('storms on exposed wiring', () => {
  const T = DISASTER_TUNING.normal.storm;

  it('covered wiring draws no strike and no warning', () => {
    const r = rig('normal');
    r.world.put(3, 6, 3, 'copper_cable');
    r.world.put(3, 12, 3, 'plank');
    r.cables.push([3, 6, 3]);
    r.st.weather = STORM;
    r.run(T.maxS * 3);
    expect(r.warns).toEqual([]);
    expect(r.world.getBlock(3, 6, 3).key).toBe('copper_cable');
  });

  it('warns first, then burns out an exposed cable (normal: one)', () => {
    const r = rig('normal');
    for (const x of [3, 4, 5]) { r.world.put(x, 6, 3, 'copper_cable'); r.cables.push([x, 6, 3]); }
    r.st.weather = STORM;
    r.run(T.minS + 1);
    expect(r.warns).toEqual(['storm:imminent']);
    expect(r.toasts.at(-1)).toMatch(/STATIC ON YOUR WIRING/);
    expect(r.world.getBlock(3, 6, 3).key === 'copper_cable' || r.world.getBlock(4, 6, 3).key === 'copper_cable').toBe(true);
    r.run(T.warnS + 1);
    expect(r.warns.at(-1)).toBe('storm:struck');
    const left = [3, 4, 5].filter((x) => r.world.getBlock(x, 6, 3).key === 'copper_cable').length;
    expect(left).toBe(2);
  });

  it('can be dodged inside the warning window by covering the wire', () => {
    const r = rig('normal');
    r.world.put(3, 6, 3, 'copper_cable');
    r.cables.push([3, 6, 3]);
    r.st.weather = STORM;
    r.run(T.minS + 1);
    r.world.put(3, 8, 3, 'plank');
    r.run(T.warnS + 1);
    expect(r.warns.at(-1)).toBe('storm:averted');
    expect(r.world.getBlock(3, 6, 3).key).toBe('copper_cable');
  });

  it('a lightning rod standing above the wire takes the strike', () => {
    const r = rig('hard');
    r.world.put(3, 6, 3, 'copper_cable');
    r.cables.push([3, 6, 3]);
    expect(cableExposed(r.world, 3, 6, 3)).toBe(true);
    expect(rodCovers(r.world, 3, 6, 3)).toBe(false);
    r.world.put(6, 6, 3, 'bronze_plate_block');
    expect(rodCovers(r.world, 3, 6, 3)).toBe(false); // too short, and not above the wire
    r.world.put(6, 7, 3, 'rivet_plate_block');
    r.world.put(6, 8, 3, 'bronze_plate_block');
    expect(rodCovers(r.world, 3, 6, 3)).toBe(true);
    r.world.put(30, 6, 3, 'bronze_plate_block'); // far away: irrelevant
    r.st.weather = STORM;
    r.run(DISASTER_TUNING.hard.storm.maxS + DISASTER_TUNING.hard.storm.warnS + 2);
    expect(r.warns).toContain('storm:averted');
    expect(r.warns).not.toContain('storm:struck');
    expect(r.world.getBlock(3, 6, 3).key).toBe('copper_cable');
  });

  it('hard: a strike burns out a run of cables and hurts a player standing at it', () => {
    const r = rig('hard');
    for (let x = 14; x < 20; x++) { r.world.put(x, 6, 15, 'copper_cable'); r.cables.push([x, 6, 15]); }
    r.st.weather = STORM;
    const hp = r.player.health;
    r.run(DISASTER_TUNING.hard.storm.maxS + DISASTER_TUNING.hard.storm.warnS + 2);
    const left = [14, 15, 16, 17, 18, 19].filter((x) => r.world.getBlock(x, 6, 15).key === 'copper_cable').length;
    expect(left).toBe(6 - DISASTER_TUNING.hard.storm.cablesBlown);
    expect(r.player.health).toBeLessThan(hp);
  });

  it('no storm, no strikes', () => {
    const r = rig('hard');
    r.world.put(3, 6, 3, 'copper_cable');
    r.cables.push([3, 6, 3]);
    r.run(1000);
    expect(r.warns).toEqual([]);
  });
});

describe('save', () => {
  it('round-trips pressure, soot and the timer; refuses junk', () => {
    const r = rig('normal');
    r.boiler();
    r.run(60);
    const snap = r.d.toJSON();
    expect(isDisastersSnapshot(snap)).toBe(true);
    const again = rig('normal');
    again.d.load(JSON.parse(JSON.stringify(snap)));
    expect(again.d.pressureAt(0, 6, 0)).toBeCloseTo(r.d.pressureAt(0, 6, 0), 2);
    for (const junk of [null, 3, {}, { v: 1 }, { v: 1, pressure: {}, soot: {} }, { v: 2, pressure: {}, soot: {}, strikeInS: 1 }]) expect(isDisastersSnapshot(junk)).toBe(false);
  });
});
