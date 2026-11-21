import { describe, expect, it } from 'vitest';
import { DT, MAX_AIR_S, MAX_HEALTH, MAX_WARMTH, WARMTH_DRAIN_WET, WELL_WARMED_DURATION_S } from '../core/constants';
import { createBus, type GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import type { BiomeKey } from '../core/types';
import { GameClock } from './clock';
import { FakeWorld } from './fakeWorld';
import { PlayerState } from './playerState';
import { Survival, fallDamage, findStandingSpot, type SurvivalSnapshot } from './survival';
import { createWeatherState } from './weather';

const NIGHT = 0.8;

interface Rig {
  bus: GameBus;
  world: FakeWorld;
  player: PlayerState;
  clock: GameClock;
  survival: Survival;
  env: { biome: BiomeKey };
  damage: Array<GameEvents['player:damage']>;
  run(seconds: number): void;
}

function rig(timeOfDay = 0.3): Rig {
  const bus = createBus();
  const world = new FakeWorld();
  world.fill(-8, 9, -8, 8, 9, 8, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const clock = new GameClock(bus, timeOfDay);
  const env = { biome: 'woodland' as BiomeKey };
  const survival = new Survival(world, player, clock, () => env.biome);
  const damage: Array<GameEvents['player:damage']> = [];
  bus.on('player:damage', (e) => damage.push(e));
  const run = (seconds: number): void => {
    for (let i = Math.round(seconds / DT); i > 0; i--) survival.tick(DT);
  };
  return { bus, world, player, clock, survival, env, damage, run };
}

function furnace(world: FakeWorld, x: number, y: number, z: number, tempC: number): void {
  world.put(x, y, z, 'furnace_clay', tempC >= 200);
  world.setEntity({ kind: 'furnace', x, y, z, tier: 1, tempC, lit: tempC > 20, draft: 0, ignited: false });
}

describe('Survival: warmth', () => {
  it('regains slowly on a mild day', () => {
    const r = rig();
    r.player.warmth = 50;
    r.run(10);
    expect(r.player.warmth).toBeCloseTo(55, 5);
    expect(r.survival.trend).toBe('warming');
    expect(r.survival.inHeat).toBe(false);
    r.player.warmth = MAX_WARMTH;
    r.run(1);
    expect(r.survival.trend).toBe('steady');
  });

  it('drains at night, half as fast with a padded coat or while Well-Warmed', () => {
    const plain = rig(NIGHT);
    plain.run(10);
    expect(plain.player.warmth).toBeCloseTo(97, 5);
    expect(plain.survival.trend).toBe('cooling');
    expect(plain.survival.warmthRate).toBeCloseTo(-0.3);

    const coat = rig(NIGHT);
    coat.player.give('padded_coat');
    coat.run(10);
    expect(coat.player.warmth).toBeCloseTo(98.5, 5);

    // Spec 19.4: the plated coat and the steel cuirass are built on a padded coat and keep its warmth.
    const plated = rig(NIGHT);
    plated.player.give('plated_coat');
    plated.run(10);
    expect(plated.player.warmth).toBeCloseTo(98.5, 5);

    const buffed = rig(NIGHT);
    buffed.player.buffs.wellWarmedS = 300;
    buffed.run(10);
    expect(buffed.player.warmth).toBeCloseTo(98.5, 5);
    buffed.player.give('padded_coat');
    buffed.run(10);
    // The coat is noticed at the next half-second scan, hence the looser precision.
    expect(buffed.player.warmth).toBeCloseTo(97.75, 1);
  });

  it('drains more in frostfell and in water', () => {
    const frostNight = rig(NIGHT);
    frostNight.env.biome = 'frostfell';
    frostNight.run(10);
    expect(frostNight.player.warmth).toBeCloseTo(91, 5);

    const frostDay = rig();
    frostDay.env.biome = 'frostfell';
    frostDay.run(10);
    expect(frostDay.player.warmth).toBeCloseTo(98, 5);

    const swim = rig();
    swim.player.inWater = true;
    swim.run(10);
    expect(swim.player.warmth).toBeCloseTo(96, 5);
    swim.clock.setTimeOfDay(NIGHT);
    swim.run(10);
    expect(swim.player.warmth).toBeCloseTo(89, 5);
  });

  it('is restored inside the radius of a hot furnace, and only there', () => {
    const r = rig(NIGHT);
    furnace(r.world, 3, 10, 0, 300);
    r.player.warmth = 50;
    r.run(5);
    expect(r.player.warmth).toBeCloseTo(70, 5);
    expect(r.survival.inHeat).toBe(true);
    expect(r.survival.trend).toBe('warming');
    // 300 C is hot but below the buff temperature.
    r.run(10);
    expect(r.player.wellWarmed).toBe(false);
    expect(r.survival.warmUpProgress).toBe(0);
    r.player.position.x = 12.5;
    r.run(1);
    expect(r.survival.inHeat).toBe(false);
    expect(r.survival.trend).toBe('cooling');

    const cold = rig(NIGHT);
    furnace(cold.world, 3, 10, 0, 50);
    cold.run(1);
    expect(cold.survival.inHeat).toBe(false);
  });

  it('counts torches and lava as heat without block entities', () => {
    const torch = rig(NIGHT);
    torch.world.put(1, 10, 0, 'torch');
    torch.run(1);
    expect(torch.survival.inHeat).toBe(true);
    torch.player.position.x = 4.5;
    torch.run(1);
    expect(torch.survival.inHeat).toBe(false);

    const lava = rig(NIGHT);
    lava.world.put(3, 10, 0, 'lava');
    lava.player.warmth = 10;
    lava.run(2);
    expect(lava.survival.inHeat).toBe(true);
    expect(lava.player.warmth).toBeCloseTo(18, 5);
    expect(lava.player.health).toBe(MAX_HEALTH);
  });

  it('deals 1 cold damage every 3 s at zero warmth', () => {
    const r = rig(NIGHT);
    r.player.warmth = 0;
    r.run(2.8);
    expect(r.player.health).toBe(20);
    r.run(6.4);
    expect(r.player.health).toBe(17);
    expect(r.damage.map((d) => d.cause)).toEqual(['cold', 'cold', 'cold']);
    expect(r.damage[2]).toEqual({ amount: 1, cause: 'cold', health: 17 });
  });
});

describe('Survival: Well-Warmed', () => {
  it('is earned after 8 s near a furnace at 400 C or more, once, and kept topped up', () => {
    const r = rig(NIGHT);
    furnace(r.world, 3, 10, 0, 450);
    const gained: number[] = [];
    const flags: string[] = [];
    r.bus.on('buff:gained', (e) => gained.push(e.durationS));
    r.bus.on('flag', (e) => flags.push(e.flag));
    r.run(7.8);
    expect(r.player.wellWarmed).toBe(false);
    expect(r.survival.warmUpProgress).toBeGreaterThan(0.9);
    r.run(0.4);
    expect(r.player.wellWarmed).toBe(true);
    expect(gained).toEqual([WELL_WARMED_DURATION_S]);
    expect(flags).toEqual(['well_warmed']);
    r.run(20);
    expect(gained).toHaveLength(1);
    expect(r.survival.buffTimeLeftS).toBe(WELL_WARMED_DURATION_S);
    r.player.position.x = 30.5;
    r.run(10);
    expect(r.survival.buffTimeLeftS).toBeCloseTo(WELL_WARMED_DURATION_S - 10, 5);
    expect(r.survival.warmUpProgress).toBe(0);
    r.run(WELL_WARMED_DURATION_S);
    expect(r.player.wellWarmed).toBe(false);
    expect(r.survival.buffTimeLeftS).toBe(0);
  });

  it('needs the 8 s in one go', () => {
    const r = rig();
    furnace(r.world, 3, 10, 0, 900);
    r.run(5);
    r.player.position.x = 30.5;
    r.run(1);
    r.player.position.x = 0.5;
    r.run(5);
    expect(r.player.wellWarmed).toBe(false);
    r.run(3.2);
    expect(r.player.wellWarmed).toBe(true);
  });
});

describe('Survival: hazards', () => {
  it('drowns after 15 s under water and breath returns at the surface', () => {
    const r = rig();
    r.player.inWater = r.player.headInWater = true;
    r.run(14);
    expect(r.player.air).toBeCloseTo(1, 5);
    expect(r.player.health).toBe(20);
    r.run(1.2);
    expect(r.player.air).toBe(0);
    expect(r.player.health).toBe(20);
    r.run(3);
    expect(r.player.health).toBe(17);
    expect(r.damage.every((d) => d.cause === 'drown' && d.amount === 1)).toBe(true);
    r.player.headInWater = false;
    r.run(1.5);
    expect(r.player.air).toBeCloseTo(MAX_AIR_S / 2, 5);
    r.run(2);
    expect(r.player.air).toBe(MAX_AIR_S);
    expect(r.player.health).toBe(17);
  });

  it('burns 4 health per second in lava', () => {
    const r = rig();
    r.world.put(0, 10, 0, 'lava');
    r.run(1);
    expect(r.player.health).toBe(16);
    expect(r.damage).toHaveLength(4);
    expect(r.damage[0]).toEqual({ amount: 1, cause: 'lava', health: 19 });
    // Lava next to the player, not touching the body, does not burn.
    const beside = rig();
    beside.world.put(1, 10, 0, 'lava');
    beside.run(2);
    expect(beside.player.health).toBe(20);
    beside.player.position.x = 0.8;
    beside.run(0.5);
    expect(beside.player.health).toBe(18);
  });

  it('takes radiation damage above a dose of 1, with linear falloff over 4 blocks', () => {
    const r = rig();
    r.world.put(0, 9, 0, 'pitchblende');
    r.run(0.05);
    // Block centre (0.5, 9.5, 0.5) to body centre (0.5, 10.9, 0.5): 1.4 blocks.
    expect(r.survival.radiationDose).toBeCloseTo(2 * (1 - 1.4 / 4), 5);
    r.run(6.2);
    expect(r.player.health).toBe(17);
    expect(r.damage.map((d) => d.cause)).toEqual(['radiation', 'radiation', 'radiation']);

    const two = rig();
    two.world.put(0, 9, 0, 'pitchblende');
    two.world.put(1, 9, 0, 'pitchblende');
    two.run(0.05);
    expect(two.survival.radiationDose).toBeCloseTo(1.3 + 2 * (1 - Math.hypot(1, 1.4) / 4), 5);

    const far = rig();
    far.world.put(4, 10, 0, 'corium');
    far.player.position.x = 1;
    far.run(4.2);
    // 8 x (1 - 3.52 / 4) = 0.95: just inside the safe dose.
    expect(far.survival.radiationDose).toBeGreaterThan(0.9);
    expect(far.survival.radiationDose).toBeLessThan(1);
    expect(far.player.health).toBe(20);
    far.player.position.x = 1.5;
    far.run(2.6);
    expect(far.player.health).toBe(19);
  });

  it('is shielded by the suit', () => {
    const r = rig();
    r.world.put(0, 9, 0, 'pitchblende');
    r.player.give('shield_suit');
    r.run(10);
    expect(r.survival.radiationDose).toBeCloseTo(0.13, 5);
    expect(r.player.health).toBe(20);
  });

  it('adds radiation reported by the simulation and consumes it', () => {
    const r = rig();
    for (let i = 0; i < 44; i++) {
      r.player.extraRadiation += 4;
      r.survival.tick(DT);
      expect(r.player.extraRadiation).toBe(0);
    }
    expect(r.survival.radiationDose).toBe(4);
    expect(r.player.health).toBe(19);
    r.run(0.05);
    expect(r.survival.radiationDose).toBe(0);
  });

  it('applies fall damage beyond 3.5 blocks, not in water', () => {
    expect(fallDamage(3.5)).toBe(0);
    expect(fallDamage(4.4)).toBe(0);
    expect(fallDamage(4.5)).toBe(1);
    expect(fallDamage(10)).toBe(6);
    const r = rig();
    expect(r.survival.applyFall(2)).toBe(0);
    expect(r.survival.applyFall(10)).toBe(6);
    expect(r.damage).toEqual([{ amount: 6, cause: 'fall', health: 14 }]);
    r.player.inWater = true;
    expect(r.survival.applyFall(30)).toBe(0);
    expect(r.player.health).toBe(14);
  });
});

describe('Survival: regeneration, death and respawn', () => {
  it('regenerates 1 health per 4 s when warm and unhurt for 8 s', () => {
    const r = rig();
    r.player.health = 10;
    r.run(4.2);
    expect(r.player.health).toBe(11);
    r.run(4);
    expect(r.player.health).toBe(12);
    r.player.damage(2, 'fall');
    r.run(7.8);
    expect(r.player.health).toBe(10);
    r.run(4.5);
    expect(r.player.health).toBe(11);

    const chilly = rig(NIGHT);
    chilly.player.health = 10;
    chilly.player.warmth = 40;
    chilly.run(20);
    expect(chilly.player.health).toBe(10);

    const full = rig();
    full.run(20);
    expect(full.player.health).toBe(MAX_HEALTH);
  });

  it('respawns beside a hot home furnace at full health, keeping the inventory', () => {
    const r = rig(NIGHT);
    furnace(r.world, 3, 10, 0, 600);
    r.player.setHome(3, 10, 0);
    r.player.give('plank', 30);
    r.player.give('flint_pickaxe', 1, 17);
    r.player.position.x = 40.5;
    r.player.warmth = 5;
    const events: string[] = [];
    r.bus.on('player:death', (e) => events.push(`death:${e.cause}`));
    r.bus.on('player:respawn', (e) => events.push(`respawn:${e.x},${e.y},${e.z}`));
    r.bus.on('sfx', (e) => events.push(`sfx:${e.name}`));
    r.player.damage(50, 'lava');
    expect(r.player.dead).toBe(true);
    expect(r.player.health).toBe(0);
    expect(r.player.deathCause).toBe('lava');
    expect(r.player.stats.deaths).toBe(1);
    expect(events).toEqual(['sfx:death', 'death:lava']);
    // Nothing happens to a dead player.
    r.run(5);
    r.player.damage(3, 'cold');
    expect(r.player.warmth).toBe(5);
    expect(r.damage).toHaveLength(1);
    expect(r.survival.homeIsHot()).toBe(true);
    r.survival.respawn();
    expect(r.player.dead).toBe(false);
    expect(r.player.health).toBe(MAX_HEALTH);
    expect(r.player.warmth).toBe(MAX_WARMTH);
    expect(r.player.position).toEqual({ x: 2.5, y: 10, z: -0.5 });
    expect(events[2]).toBe('respawn:2.5,10,-0.5');
    expect(r.player.inventory.count('plank')).toBe(30);
    expect(r.player.inventory.get(1)).toEqual({ item: 'flint_pickaxe', count: 1, durability: 17 });
    r.run(1);
    expect(r.survival.inHeat).toBe(true);
  });

  it('respawns at half health by a cold furnace, and at the world spawn without one', () => {
    const cold = rig();
    furnace(cold.world, 3, 10, 0, 80);
    cold.player.setHome(3, 10, 0);
    cold.player.damage(99, 'fall');
    cold.survival.respawn();
    expect(cold.player.health).toBe(MAX_HEALTH / 2);
    expect(cold.player.position).toEqual({ x: 2.5, y: 10, z: -0.5 });

    const gone = rig();
    furnace(gone.world, 3, 10, 0, 900);
    gone.player.setHome(3, 10, 0);
    gone.world.removeEntity(3, 10, 0);
    gone.world.put(3, 10, 0, 'air');
    gone.player.position.x = 77;
    gone.player.damage(99, 'drown');
    gone.survival.respawn();
    expect(gone.player.health).toBe(MAX_HEALTH / 2);
    expect(gone.player.position).toEqual({ x: 0.5, y: 10, z: 0.5 });

    const homeless = rig();
    homeless.player.position.y = 50;
    homeless.player.damage(99, 'fall');
    homeless.survival.respawn();
    expect(homeless.player.position).toEqual(homeless.player.spawn);
  });

  it('finds a free spot on solid ground next to a block, else its top', () => {
    const world = new FakeWorld();
    expect(findStandingSpot(world, { x: 3, y: 10, z: 0 })).toEqual({ x: 3.5, y: 11, z: 0.5 });
    world.fill(-8, 9, -8, 8, 9, 8, 'stone');
    // Walled in on its own level: the nearest free spot is on top of the wall.
    world.fill(1, 10, -2, 5, 10, 2, 'stone');
    expect(findStandingSpot(world, { x: 3, y: 10, z: 0 })).toEqual({ x: 2.5, y: 11, z: -0.5 });
    const lake = new FakeWorld();
    lake.fill(-8, 9, -8, 8, 9, 8, 'stone');
    lake.fill(2, 10, -1, 4, 10, 1, 'lava');
    lake.put(3, 10, 0, 'furnace_clay');
    expect(findStandingSpot(lake, { x: 3, y: 10, z: 0 })).toEqual({ x: 1.5, y: 10, z: -1.5 });
  });

  it('saves and restores its timers', () => {
    const r = rig(NIGHT);
    r.player.warmth = 0;
    r.run(2);
    const snapshot = JSON.parse(JSON.stringify(r.survival)) as SurvivalSnapshot;
    expect(snapshot.coldS).toBeCloseTo(2, 5);
    const other = rig(NIGHT);
    other.player.warmth = 0;
    other.survival.load(snapshot);
    other.run(1.2);
    expect(other.player.health).toBe(19);
  });
});

describe('Survival: rain and snow (spec 15)', () => {
  const soak = (r: Rig, precipitation: 'rain' | 'snow' | 'dust', intensity: number): void => {
    r.survival.weather = { ...createWeatherState(), kind: 'rain', previous: 'rain', precipitation, intensity };
  };

  it('chills a player in the rain under open sky, by day and on top of the night drain', () => {
    const day = rig();
    day.player.warmth = 50;
    soak(day, 'rain', 0.6);
    day.run(10);
    expect(day.survival.wet).toBe(true);
    expect(day.survival.warmthRate).toBeCloseTo(-WARMTH_DRAIN_WET);
    expect(day.player.warmth).toBeCloseTo(50 - 10 * WARMTH_DRAIN_WET, 1);

    const night = rig(NIGHT);
    soak(night, 'snow', 1);
    night.run(10);
    expect(night.survival.warmthRate).toBeCloseTo(-(0.3 + WARMTH_DRAIN_WET));
  });

  it('spares a player under a roof, in drizzle, in dust, and inside a heat radius', () => {
    const roofed = rig();
    roofed.world.fill(-2, 14, -2, 2, 14, 2, 'plank');
    soak(roofed, 'rain', 1);
    roofed.run(2);
    expect(roofed.survival.wet).toBe(false);
    expect(roofed.survival.warmthRate).toBeCloseTo(0.5);

    const drizzle = rig();
    soak(drizzle, 'rain', 0.2);
    drizzle.run(2);
    expect(drizzle.survival.wet).toBe(false);

    const dust = rig();
    soak(dust, 'dust', 1);
    dust.run(2);
    expect(dust.survival.wet).toBe(false);

    const fire = rig();
    furnace(fire.world, 2, 10, 0, 500);
    soak(fire, 'rain', 1);
    fire.player.warmth = 50;
    fire.run(2);
    expect(fire.survival.warmthRate).toBeGreaterThan(0);
  });

  it('halves the rain chill with a padded coat', () => {
    const r = rig();
    r.player.give('padded_coat');
    soak(r, 'rain', 1);
    r.run(2);
    expect(r.survival.warmthRate).toBeCloseTo(-WARMTH_DRAIN_WET / 2);
  });
});
