import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BLOCKS, blockId } from '../core/registry';
import { Facing, makeVoxel, voxelId, type IWorld, type Voxel } from '../core/types';
import { GroundItems } from '../game/groundItems';
import { createIntent } from '../player/input/intent';
import { DECK_MAX } from './drawbridge';
import { Lifts, WINCH_STATS, type LiftPlayer } from './lifts';
import { Workshop } from './workshop';

/** A world of stone below y = 0 and air above, a workshop, the lifts and a stand-in player. */
function setup() {
  const bus = createBus();
  const cells = new Map<string, Voxel>();
  const world = {
    getVoxel: (x: number, y: number, z: number) => cells.get(`${x},${y},${z}`) ?? (y < 0 ? makeVoxel(blockId('stone')) : 0),
    getBlock: (x: number, y: number, z: number) => BLOCKS[voxelId(world.getVoxel(x, y, z))],
    setVoxel: (x: number, y: number, z: number, v: Voxel) => {
      const from = world.getVoxel(x, y, z);
      cells.set(`${x},${y},${z}`, v);
      bus.emit('block:changed', { x, y, z, from, to: v, source: 'sim' });
      return true;
    },
    isLoaded: () => true,
  } as unknown as IWorld;
  const ground = new GroundItems(bus);
  const shop = new Workshop(world, bus, ground, () => 0.99);
  const look = { x: 1, y: 0, z: 0 };
  const player: LiftPlayer = {
    position: { x: 3.5, y: 0, z: 1.5 }, velocity: { x: 0, y: 0, z: 0 }, get eyeY() { return this.position.y + 1.6; }, dead: false, sprinting: false,
    viewDir: (out) => Object.assign(out, look), heldStack: () => null,
  };
  const lifts = new Lifts({ world, bus, rpmAt: (x, y, z) => shop.rpmOf(x, y, z), player });
  const put = (x: number, y: number, z: number, key: string, facing: Facing = Facing.North) => world.setVoxel(x, y, z, makeVoxel(blockId(key), facing));
  const wind = (x: number, y: number, z: number) => { for (let i = 0; i < 4; i++) shop.use(x, y, z, null, () => undefined); };
  /** Runs the workshop's ticks and the lifts' frames together. */
  const run = (s: number) => {
    for (let t = 0; t < s; t += 0.05) {
      shop.tick(0.05);
      lifts.update(0.05);
    }
  };
  const toasts: string[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  return { world, shop, lifts, player, look, put, wind, run, toasts };
}

/**
 * A winch at (0, 0, 0) facing north (placed from the north), so its cage hangs south of it at (0, z 1).
 * The shaft is dug from y -1 to -10 (floor on stone at -11), with a side tunnel two high at y -5 on its east side.
 */
function shaft(t: ReturnType<typeof setup>, kind = 'lift_winch') {
  for (let y = -1; y >= -10; y--) t.world.setVoxel(0, y, 1, 0);
  t.world.setVoxel(1, -5, 1, 0);
  t.world.setVoxel(1, -4, 1, 0);
  t.put(-1, 0, 0, 'clockwork_motor');
  t.put(0, 0, 0, kind);
  const l = t.lifts.get(0, 0, 0)!;
  return l;
}

describe('lifts: the shaft and its landings', () => {
  it('hangs the cage beside the winch, away from the placer, and finds the top, the tunnel and the floor', () => {
    const t = setup();
    const l = shaft(t);
    expect([l.sx, l.sz]).toEqual([0, 1]);
    expect(l.floor).toBe(0);
    expect(t.lifts.bottomOf(l)).toBe(-10);
    expect(t.lifts.stops(l)).toEqual([0, -5, -10]);
    expect(t.lifts.describe(0, 0, 0)).toBe('cage at the top, 3 landings, 10 deep');
  });

  it('a winch with nothing open beside it says so', () => {
    const t = setup();
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) t.put(x, 0, z, 'stone');
    t.put(0, 0, 0, 'lift_winch');
    expect(t.toasts.some((s) => s.includes('needs an open shaft'))).toBe(true);
    expect(t.lifts.views()).toEqual([]);
  });

  it('the rope is 40 blocks: a deeper drop ends in the air', () => {
    const t = setup();
    for (let y = -1; y >= -60; y--) t.world.setVoxel(0, y, 1, 0);
    t.put(0, 0, 0, 'lift_winch');
    const l = t.lifts.get(0, 0, 0)!;
    expect(t.lifts.bottomOf(l)).toBe(-WINCH_STATS.lift_winch.cable);
    expect(t.lifts.stops(l)).toEqual([0]);
  });
});

describe('lifts: riding', () => {
  it('a powered cage carries its rider down to the next landing, eased, and lets them out into the tunnel', () => {
    const t = setup();
    const l = shaft(t);
    t.wind(-1, 0, 0);
    t.run(0.2);
    t.player.position.x = 0.5;
    t.player.position.z = 1.5;
    t.lifts.board(l, true);
    expect(l.target).toBe(-5);
    t.run(0.5);
    expect(l.floor).toBeLessThan(0);
    expect(l.floor).toBeGreaterThan(-5);
    t.run(5);
    expect(l.floor).toBe(-5);
    expect(l.target).toBeNull();
    expect(t.toasts.some((s) => s.startsWith('Landing 5 down - Exit'))).toBe(true);
    expect(t.lifts.carry()).toBe(true);
    expect(t.player.position.y).toBeCloseTo(-4.98, 2);
    const status = t.lifts.status()!;
    expect(status).toMatchObject({ name: 'lift', depth: 5, moving: 0, powered: true, landing: true, above: 1, below: 1 });
    expect(t.lifts.leave()).toBe(true);
    expect(t.player.position).toMatchObject({ x: 1.5, y: -5, z: 1.5 });
    expect(t.lifts.riding).toBeNull();
  });

  it('Jump goes up a landing and Mine goes down one (the controls are taken while riding)', () => {
    const t = setup();
    const l = shaft(t);
    t.wind(-1, 0, 0);
    t.run(0.2);
    t.lifts.board(l, false);
    expect(l.target).toBeNull();
    const down = createIntent();
    down.mine = true;
    down.moveX = 1;
    const out = t.lifts.handle(down, 0.05);
    expect(out.mine).toBe(false);
    expect(out.moveX).toBe(0);
    expect(l.target).toBe(-5);
    t.run(6);
    const up = createIntent();
    up.jump = true;
    t.lifts.handle(up, 0.05);
    expect(l.target).toBe(0);
    t.run(6);
    expect(l.floor).toBe(0);
  });

  it('there is no stepping out between landings, nor while moving', () => {
    const t = setup();
    const l = shaft(t);
    t.wind(-1, 0, 0);
    t.run(0.2);
    t.lifts.board(l, true);
    t.run(0.6);
    expect(t.lifts.leave()).toBe(false);
    expect(t.toasts.at(-1)).toBe('Wait for the cage to stop at a landing');
  });

  it('with no power the brake holds an empty cage but lets a rider down to the landing below', () => {
    const t = setup();
    const l = shaft(t);
    t.lifts.send(l, -10);
    t.run(3);
    expect(l.floor).toBe(0);
    expect(t.toasts.some((s) => s.includes('not turning'))).toBe(true);
    // At a landing the rider can step out: it holds there. Stuck between landings, it lets them down to the next one.
    t.lifts.board(l, false);
    t.lifts.send(l, -10);
    t.run(1);
    expect(l.floor).toBe(0);
    l.floor = -1.5;
    t.lifts.send(l, -10);
    t.run(2);
    expect(l.floor).toBeLessThan(-2.5);
    expect(l.floor).toBeGreaterThan(-5);
    t.run(4);
    expect(l.floor).toBe(-5);
    expect(l.target).toBeNull();
  });

  it('the steam elevator is twice as fast as the lift', () => {
    const time = (kind: string) => {
      const t = setup();
      const l = shaft(t, kind);
      t.wind(-1, 0, 0);
      t.run(0.2);
      t.lifts.send(l, -10);
      let s = 0;
      while (l.target !== null && s < 20) {
        t.run(0.05);
        s += 0.05;
      }
      return s;
    };
    const lift = time('lift_winch');
    const elevator = time('elevator_winch');
    expect(lift).toBeLessThan(6);
    expect(elevator).toBeLessThan(lift * 0.7);
  });

  it('a block set into the shaft stops a cage going down short of it', () => {
    const t = setup();
    const l = shaft(t);
    t.wind(-1, 0, 0);
    t.run(0.2);
    t.lifts.send(l, -10);
    t.put(0, -7, 1, 'stone');
    t.run(8);
    expect(l.floor).toBe(-6);
    expect(l.target).toBeNull();
  });

  it('walking into the waiting cage boards it; stepping out at the floor does not board again until you leave the column', () => {
    const t = setup();
    const l = shaft(t);
    t.player.position.x = 0.5;
    t.player.position.z = 1.5;
    t.player.position.y = 0;
    t.lifts.handle(createIntent(), 0.05);
    expect(t.lifts.riding).toBe(l);
  });

  it('Use aimed at the cage from beside it boards and sets off', () => {
    const t = setup();
    const l = shaft(t);
    t.wind(-1, 0, 0);
    t.run(0.2);
    // Standing east of the shaft top at (1.5, 0, 1.5), looking west and a little down at the cage.
    t.player.position.x = 1.6;
    t.player.position.z = 1.5;
    Object.assign(t.look, { x: -1, y: -0.3, z: 0 });
    const use = createIntent();
    use.use = true;
    const out = t.lifts.handle(use, 0.05);
    expect(out.use).toBe(false);
    expect(t.lifts.riding).toBe(l);
    expect(l.target).toBe(-5);
  });

  it('Use at the rope from a landing calls the cage to that level', () => {
    const t = setup();
    const l = shaft(t);
    t.wind(-1, 0, 0);
    t.run(0.2);
    t.lifts.send(l, -10);
    t.run(6);
    expect(l.floor).toBe(-10);
    // In the tunnel at y -5, looking west into the shaft: the rope hangs there.
    t.player.position.x = 1.6;
    t.player.position.y = -5;
    t.player.position.z = 1.5;
    Object.assign(t.look, { x: -1, y: 0, z: 0 });
    const use = createIntent();
    use.use = true;
    t.lifts.handle(use, 0.05);
    expect(t.lifts.riding).toBeNull();
    expect(l.target).toBe(-5);
    t.run(6);
    expect(l.floor).toBe(-5);
  });

  it('saves and loads the cages; nobody rides after a load; bad entries are dropped', () => {
    const t = setup();
    const l = shaft(t);
    l.floor = -5;
    const snap = JSON.parse(JSON.stringify(t.lifts.toJSON()));
    const u = setup();
    shaft(u);
    u.lifts.load({ ...snap, lifts: [...snap.lifts, [1, 2, 3, 'nonsense', 0], 'x'] });
    u.lifts.settle();
    expect(u.lifts.all().length).toBe(1);
    expect(u.lifts.get(0, 0, 0)!.floor).toBe(-5);
    expect(u.lifts.riding).toBeNull();
    u.lifts.load(undefined);
    expect(u.lifts.all()).toEqual([]);
  });
});

describe('drawbridges', () => {
  /** A drawbridge at (0, 0, 0) placed from the north (front north), so its deck runs south, a motor beside it. */
  function bridge() {
    const t = setup();
    t.put(-1, 0, 0, 'clockwork_motor');
    t.put(0, 0, 0, 'drawbridge');
    return t;
  }
  const deckAt = (t: ReturnType<typeof setup>, z: number) => t.world.getBlock(0, 0, z).key;

  it('lays its deck out while its shaft turns, up to 16 planks, and lifts it back when set to', () => {
    const t = bridge();
    t.run(2);
    expect(t.shop.bridges.length(0, 0, 0)).toBe(0);
    t.wind(-1, 0, 0);
    t.run(1.2);
    const part = t.shop.bridges.length(0, 0, 0);
    expect(part).toBeGreaterThan(2);
    expect(part).toBeLessThan(DECK_MAX);
    expect(deckAt(t, 1)).toBe('bridge_deck');
    t.run(6);
    expect(t.shop.bridges.length(0, 0, 0)).toBe(DECK_MAX);
    expect(deckAt(t, DECK_MAX)).toBe('bridge_deck');
    expect(deckAt(t, DECK_MAX + 1)).toBe('air');
    expect(t.shop.describe(0, 0, 0)).toContain('deck 16/16');
    t.shop.use(0, 0, 0, null, () => undefined);
    t.run(8);
    expect(t.shop.bridges.length(0, 0, 0)).toBe(0);
    expect(deckAt(t, 1)).toBe('air');
  });

  it('stops at something solid, and puts water back when it lifts', () => {
    const t = bridge();
    t.put(0, 0, 1, 'water');
    t.put(0, 0, 5, 'stone');
    t.wind(-1, 0, 0);
    t.run(4);
    expect(t.shop.bridges.length(0, 0, 0)).toBe(4);
    expect(deckAt(t, 1)).toBe('bridge_deck');
    t.shop.use(0, 0, 0, null, () => undefined);
    t.run(4);
    expect(deckAt(t, 1)).toBe('water');
    expect(deckAt(t, 5)).toBe('stone');
  });

  it('a lever beside it decides: lit lowers, unlit lifts', () => {
    const t = bridge();
    t.put(1, 0, 0, 'crank_lever');
    t.wind(-1, 0, 0);
    t.run(2);
    expect(t.shop.bridges.length(0, 0, 0)).toBe(0);
    t.shop.use(1, 0, 0, null, () => undefined);
    t.run(3);
    expect(t.shop.bridges.length(0, 0, 0)).toBeGreaterThan(5);
    t.shop.use(0, 0, 0, null, () => undefined);
    expect(t.toasts.at(-1)).toContain('A signal decides');
    t.shop.use(1, 0, 0, null, () => undefined);
    t.run(6);
    expect(t.shop.bridges.length(0, 0, 0)).toBe(0);
  });

  it('saves the deck and its setting', () => {
    const t = bridge();
    t.wind(-1, 0, 0);
    t.run(7);
    const snap = JSON.parse(JSON.stringify(t.shop.bridges.toJSON()));
    const u = bridge();
    u.shop.bridges.load(snap);
    expect(u.shop.bridges.length(0, 0, 0)).toBe(DECK_MAX);
    u.shop.bridges.load({ bridges: [{ x: 'a' }] });
    expect(u.shop.bridges.length(0, 0, 0)).toBe(-1);
  });
});
