/** Test rig for the tavern-life features (rooms, drinks, gossip, favours, sparring, upkeep, festival). */
import { createBus } from '../core/context';
import { FakeWorld } from '../game/fakeWorld';
import { NPCS } from './data';
import { NpcManager, type NpcHost } from './manager';

export interface RigState {
  goal: string | null;
  done: Set<string>;
  held: { item: string; count: number } | null;
  tod: number;
  day: number;
  pack: Record<string, number>;
  slept: number;
  buffs: Array<[string, number]>;
  hostiles: { id: number; x: number; y: number; z: number }[];
}

export function lifeRig(opts: { coins?: number; tod?: number; held?: RigState['held']; pack?: Record<string, number> } = {}) {
  const bus = createBus();
  const toasts: string[] = [];
  const says: Array<{ id: string; text: string }> = [];
  bus.on('toast', (t) => toasts.push(t.text));
  bus.on('npc:say', (e) => {
    says.push({ id: e.id, text: e.text });
    toasts.push(`${e.name}: ${e.text}`);
  });
  let seed = 11;
  const rng = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const npcs = new NpcManager(bus, rng);
  const state: RigState = { goal: 'gather_logs', done: new Set(), held: opts.held ?? null, tod: opts.tod ?? 0.8, day: 3, pack: { ...(opts.pack ?? {}) }, slept: 0, buffs: [], hostiles: [] };
  const world = new FakeWorld(bus);
  const host: NpcHost = {
    give: (item, n) => (state.pack[item] = (state.pack[item] ?? 0) + n, 0),
    currentGoal: () => state.goal,
    completed: () => state.done,
    timeOfDay: () => state.tod,
    day: () => state.day,
    held: () => state.held,
    takeHeld: (n) => {
      if (!state.held) return;
      state.held.count -= n;
      if (state.held.count <= 0) state.held = null;
    },
    advice: (role) => `ADVICE-${role}`,
    sleepToDawn: () => {
      state.slept++;
      state.tod = 0.05;
      state.day++;
    },
    companion: { world, player: () => ({ x: 100, y: 41, z: 100, dead: false }), hostiles: () => state.hostiles, hit: () => undefined },
  };
  npcs.bind(host);
  npcs.at = [100, 40, 100];
  npcs.coins = opts.coins ?? 0;
  const by = (id: string) => NPCS.find((n) => n.id === id)!;
  return { npcs, toasts, says, state, by, bus, host };
}
