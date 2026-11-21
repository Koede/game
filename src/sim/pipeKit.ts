/** Test fixture for transport: laying pipe runs in the fake world and reading their networks. Import by path from tests. */
import { DT } from '../core/constants';
import type { FakeWorld } from '../game/fakeWorld';
import type { PipeNet } from './pipeNet';
import type { Kit } from './testKit';

/** Puts `block` on every cell of a straight run from a to b (inclusive), along one axis. */
export function run(world: FakeWorld, block: string, a: [number, number, number], b: [number, number, number]): void {
  const axis = a[0] !== b[0] ? 0 : a[1] !== b[1] ? 1 : 2;
  const step = Math.sign(b[axis] - a[axis]) || 1;
  const p: [number, number, number] = [...a];
  for (;;) {
    world.put(p[0], p[1], p[2], block);
    if (p[axis] === b[axis]) break;
    p[axis] += step;
  }
}

/** The network the pipe at a position belongs to (fails the test when there is none). */
export function netOf(kit: Kit, x: number, y: number, z: number): PipeNet {
  const net = kit.sim.transport.netAt(x, y, z);
  if (!net) throw new Error(`no pipe network at ${x},${y},${z}`);
  return net;
}

/** Ticks until `done` holds; fails after `maxS` seconds of game time. */
export function until(kit: Kit, what: string, done: () => boolean, maxS: number): number {
  let t = 0;
  while (!done()) {
    if (t > maxS) throw new Error(`${what}: not after ${maxS} s`);
    kit.sim.tick(DT);
    t += DT;
  }
  return t;
}
