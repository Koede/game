/** Test fixture: a simulation over the in-memory fake world. Imported by path from tests only. */
import { DT } from '../core/constants';
import { createBus, type GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { GameClock } from '../game/clock';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game/playerState';
import type { FurnaceEntity, MachineEntity } from './entities';
import { Simulation } from './simulation';

export interface Kit {
  bus: GameBus;
  world: FakeWorld;
  player: PlayerState;
  clock: GameClock;
  sim: Simulation;
  /** Ticks the simulation for this many seconds of game time. */
  run(seconds: number): void;
  /** Places a furnace block and returns its entity. */
  furnace(x: number, y: number, z: number, block?: string): FurnaceEntity;
  /** Places a machine block and returns its entity. */
  machine(block: string, x: number, y: number, z: number): MachineEntity;
  /** Records every payload of an event from now on. */
  record<K extends keyof GameEvents>(type: K): Array<GameEvents[K]>;
}

/** A simulation over a fresh fake world (or one made by `makeWorld`, e.g. a subclass with unloaded chunks). */
export function makeKit(makeWorld: (bus: GameBus) => FakeWorld = (bus) => new FakeWorld(bus)): Kit {
  const bus = createBus();
  const world = makeWorld(bus);
  const player = new PlayerState(bus, { x: 0.5, y: 1, z: 2.5 });
  const clock = new GameClock(bus);
  const sim = new Simulation(world, bus, player, clock);
  return {
    bus, world, player, clock, sim,
    run(seconds) {
      const ticks = Math.round(seconds / DT);
      for (let i = 0; i < ticks; i++) sim.tick(DT);
    },
    furnace(x, y, z, block = 'furnace_clay') {
      world.put(x, y, z, block);
      return sim.furnaceAt(x, y, z) as FurnaceEntity;
    },
    machine(block, x, y, z) {
      world.put(x, y, z, block);
      return sim.machineAt(x, y, z) as MachineEntity;
    },
    record(type) {
      const seen: Array<GameEvents[typeof type]> = [];
      bus.on(type, (p) => seen.push(p));
      return seen;
    },
  };
}

/** Loads fuel and lights the furnace. */
export function fire(kit: Kit, e: FurnaceEntity, fuel: string, count = 99): void {
  e.fuel[0] = { item: fuel, count };
  const r = kit.sim.light(e.x, e.y, e.z);
  if (!r.ok) throw new Error(r.reason);
}
