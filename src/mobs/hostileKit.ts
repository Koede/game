/** Test fixtures for the automatons (not used by the game): a night-time flat world, a manager and event records. */
import { DT } from '../core/constants';
import { createBus, type Difficulty, type GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import type { SkyFacts } from '../core/hostile';
import { creature } from '../core/registry';
import type { DamageCause } from '../core/gameEvents';
import { MobManager } from './manager';
import type { SafeZones } from './hostileTypes';
import { FlatWorld, TestClock, testPlayer } from './testKit';
import type { Mob, MobPlayer } from './types';

export interface Blow {
  t: number;
  amount: number;
  cause: DamageCause;
  kind: string;
  x: number;
  z: number;
}

export interface Arena {
  bus: GameBus;
  world: FlatWorld;
  clock: TestClock;
  mobs: MobManager;
  player: MobPlayer & { held: string | null };
  /** Every damagePlayer call, with the time (seconds since setup). */
  blows: Blow[];
  /** Every knockPlayer call. */
  knocks: number[][];
  /** Events by name with the time they came. */
  log: Array<{ t: number; name: keyof GameEvents; payload: unknown }>;
  /** Seconds simulated. */
  time(): number;
  /** Runs `seconds` of ticks (each after `each`, if given). */
  run(seconds: number, each?: () => void): void;
  /** Adds an automaton at a spot (natural, awake). */
  spawn(key: string, x: number, y: number, z: number, yaw?: number): Mob;
  /** The zones `isSafe` reports (boxes, inclusive). */
  zones: Array<{ x0: number; z0: number; x1: number; z1: number }>;
  names(name: keyof GameEvents): Array<{ t: number; payload: unknown }>;
}

const LOGGED: (keyof GameEvents)[] = [
  'hostile:woke', 'hostile:dormant', 'hostile:windup', 'hostile:attack', 'player:attacked', 'projectile:fired',
  'projectile:hit', 'automaton:salvaged', 'mob:died', 'mob:spawned', 'flag', 'sfx',
];

/** A flat grass world (ground y 10, feet at 11) at night with the player at (0.5, 11, 0.5). */
export function arena(options: { light?: number; difficulty?: Difficulty; ground?: number; sky?: SkyFacts } = {}): Arena {
  const bus = createBus();
  const ground = options.ground ?? 10;
  const world = new FlatWorld(ground, 1234, bus);
  const clock = new TestClock(0.9, options.light ?? 0.05);
  const mobs = new MobManager(world, bus, clock, 99, { naturalSpawning: false, spawn: null, difficulty: options.difficulty ?? 'normal' });
  const player = testPlayer(0.5, ground + 1, 0.5);
  let t = 0;
  const blows: Blow[] = [];
  const knocks: number[][] = [];
  const zones: Arena['zones'] = [];
  const safe: SafeZones = {
    isSafe: (x, _y, z) => zones.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1),
  };
  mobs.useHostileHooks({
    safeZones: safe,
    damagePlayer: (amount, cause, x, z, kind) => blows.push({ t, amount, cause, kind, x, z }),
    knockPlayer: (vx, vy, vz) => knocks.push([vx, vy, vz]),
    sky: options.sky ? () => options.sky! : null,
  });
  const log: Arena['log'] = [];
  for (const name of LOGGED) bus.on(name, (payload) => log.push({ t, name, payload }));
  return {
    bus, world, clock, mobs, player, blows, knocks, log, zones,
    time: () => t,
    run(seconds, each) {
      const n = Math.round(seconds / DT);
      for (let i = 0; i < n; i++) {
        mobs.tick(DT, player);
        t += DT;
        each?.();
      }
    },
    spawn(key, x, y, z, yaw = 0) {
      return mobs.add(creature(key), { x, y, z, yaw });
    },
    names: (name) => log.filter((e) => e.name === name),
  };
}
