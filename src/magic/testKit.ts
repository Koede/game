/** Shared setup for the magic runtime tests: a stone floor world, a player, a Magic. Not a test itself. */
import { createBus } from '../core/context';
import { BLOCKS, block, blockId } from '../core/registry';
import { Face, makeVoxel, voxelActive, voxelId, type IWorld, type Voxel } from '../core/types';
import { PlayerState } from '../game/playerState';
import { Magic, type MagicTarget } from './magic';
import { RESEARCH } from './entries';

/** A stone floor at y=0, air above; cells set by `put`. */
export function setup() {
  const bus = createBus();
  const cells = new Map<string, Voxel>();
  const world = {
    getVoxel: (x: number, y: number, z: number): Voxel => cells.get(`${x},${y},${z}`) ?? (y <= 0 ? makeVoxel(blockId('stone')) : 0),
    getBlock: (x: number, y: number, z: number) => BLOCKS[voxelId(world.getVoxel(x, y, z))],
    setVoxel: (x: number, y: number, z: number, v: Voxel) => {
      const from = world.getVoxel(x, y, z);
      cells.set(`${x},${y},${z}`, v);
      bus.emit('block:changed', { x, y, z, from, to: v, source: 'sim' });
      return true;
    },
    isLoaded: () => true,
    surfaceY: () => 0,
  } as unknown as IWorld;
  const player = new PlayerState(bus, { x: 0.5, y: 1, z: 0.5 });
  const cranked: string[] = [];
  let fire = 10;
  let stoked = 0;
  const magic = new Magic(world, bus, player, {
    crank: (x, y, z) => (cranked.push(`${x},${y},${z}`), true),
    furnaceFire: () => fire,
    stokeFurnace: (_x, _y, _z, s) => ((stoked += s), (fire += s), true),
    lightFurnace: () => null,
    purifyFlask: (_x, _y, _z, l) => l,
  }, 12345);
  const put = (x: number, y: number, z: number, key: string) => world.setVoxel(x, y, z, makeVoxel(blockId(key)));
  const hold = (item: string, count = 1): void => {
    player.inventory.clear();
    player.inventory.add(item, count);
    player.selectedSlot = 0;
  };
  const at = (x: number, y: number, z: number, face?: Face): MagicTarget => ({ x, y, z, block: world.getBlock(x, y, z), face });
  const learn = (...keys: string[]) => {
    for (const k of keys) magic.research.entries[k] = { done: true, tokens: {} };
  };
  const learnAll = () => learn(...RESEARCH.map((e) => e.key));
  return { bus, world, player, magic, put, hold, at, learn, learnAll, cranked, stoked: () => stoked, setFire: (f: number) => (fire = f) };
}


/** Pours `n` vials of `aspect` into the jar at x, y, z. */
export function fillJar(t: ReturnType<typeof setup>, x: number, y: number, z: number, aspect: string, vials: number): void {
  for (let i = 0; i < vials; i++) {
    t.hold(`vial_${aspect}`, 1);
    t.magic.use(t.at(x, y, z));
  }
}
