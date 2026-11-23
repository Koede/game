import { describe, expect, it } from 'vitest';
import { DT as TICK } from '../core/constants';
import { DEFAULT_SETTINGS, createBus, createInputState } from '../core/context';
import { creature, item, recipe } from '../core/registry';
import { fullDurability, makeStack } from '../game';
import { MobManager, mobPlayerOf } from '../mobs';
import { YIELD_COOLDOWN_S } from '../mobs/yields';
import { PlayerController } from './controller';
import { Script, StubView, flatWorld, makePlayer } from './testKit';

const DT = 1 / 60;

/** A player looking at an animal 2.5 blocks north; `use()` presses Use for one frame. */
function setup(species = 'goat', baby = false) {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  const mobs = new MobManager(world, bus, { timeOfDay: 0.2, sunlight: () => 1 }, 1, { naturalSpawning: false, spawn: null });
  const spec = creature(species);
  const mob = mobs.add(spec, { x: 0.5, y: 10, z: -2, yaw: 0 }, baby);
  const input = new Script();
  const controller = new PlayerController({
    world, bus, player, view: new StubView(), input, settings: { ...DEFAULT_SETTINGS }, state: createInputState(), rng: () => 0, animals: mobs,
  });
  const tickMobs = (seconds: number): void => {
    const mp = mobPlayerOf(player);
    for (let t = 0; t < seconds - 1e-9; t += TICK) mobs.tick(TICK, mp);
  };
  tickMobs(TICK);
  mob.x = 0.5;
  mob.z = -2;
  player.yaw = 0;
  player.pitch = Math.atan2(10 + spec.size.h * 0.5 - player.eyeY, -(mob.z - player.position.z));
  const hold = (key: string, count = 1): void => player.inventory.set(player.selectedSlot, makeStack(key, count, fullDurability(key)));
  const use = (): void => {
    input.next.use = true;
    controller.update(DT);
  };
  return { player, mobs, mob, hold, use, toasts, tickMobs, input, controller };
}

describe('milking a goat', () => {
  it('an empty pail becomes a pail of goat milk and the goat goes on cooldown', () => {
    const t = setup();
    t.hold('pail');
    t.use();
    expect(t.player.heldStack()?.item).toBe('milk_pail');
    expect(t.mob.milkS).toBe(YIELD_COOLDOWN_S.milk);
  });

  it('an empty glass beaker becomes a beaker of goat milk', () => {
    const t = setup();
    t.hold('glass_beaker');
    t.use();
    expect(t.player.heldStack()?.item).toBe('milk_beaker');
  });

  it('a goat that was just milked refuses (with its seconds in a toast) and the pail stays empty; later it gives again', () => {
    const t = setup();
    t.hold('pail');
    t.use();
    t.hold('pail');
    t.use();
    expect(t.player.heldStack()?.item).toBe('pail');
    expect(t.toasts.some((s) => /milked a while ago/.test(s))).toBe(true);
    t.tickMobs(YIELD_COOLDOWN_S.milk + 1);
    expect(t.mob.milkS).toBe(0);
    t.mob.x = 0.5;
    t.mob.z = -2;
    t.use();
    expect(t.player.heldStack()?.item).toBe('milk_pail');
  });

  it('a kid gives nothing, and an animal that gives no milk lets the pail go on as if it were not there', () => {
    const kid = setup('goat', true);
    kid.hold('pail');
    kid.use();
    expect(kid.player.heldStack()?.item).toBe('pail');
    expect(kid.toasts.some((s) => /too young/.test(s))).toBe(true);
    const boar = setup('boar');
    boar.hold('pail');
    boar.use();
    expect(boar.player.heldStack()?.item).toBe('pail');
    expect(boar.mob.milkS).toBe(0);
  });

  it('milk timers are saved and restored: a reloaded goat keeps waiting', () => {
    const t = setup();
    t.hold('pail');
    t.use();
    t.tickMobs(10);
    const snap = JSON.parse(JSON.stringify(t.mobs.toJSON()));
    const bus = createBus();
    const again = new MobManager(flatWorld(bus), bus, { timeOfDay: 0.2, sunlight: () => 1 }, 1, { naturalSpawning: false, spawn: null });
    again.load(snap);
    const goat = again.get(t.mob.id)!;
    expect(goat.milkS).toBeGreaterThan(YIELD_COOLDOWN_S.milk - 15);
    expect(goat.milkS).toBeLessThan(YIELD_COOLDOWN_S.milk);
    expect(goat.woolS).toBe(0);
  });

  it('an old save without timers loads ready', () => {
    const t = setup();
    const snap = JSON.parse(JSON.stringify(t.mobs.toJSON()));
    for (const m of snap.mobs) {
      delete m.milkS;
      delete m.woolS;
    }
    const bus = createBus();
    const again = new MobManager(flatWorld(bus), bus, { timeOfDay: 0.2, sunlight: () => 1 }, 1, { naturalSpawning: false, spawn: null });
    again.load(snap);
    expect(again.get(t.mob.id)?.milkS).toBe(0);
  });
});

describe('shearing a goat', () => {
  it('shears take two wool, wear by one use, and the goat is shorn until it regrows', () => {
    const t = setup();
    t.hold('shears');
    const uses = t.player.heldStack()!.durability!;
    t.use();
    expect(t.player.inventory.count('wool')).toBe(2);
    expect(t.player.heldStack()?.durability).toBe(uses - 1);
    expect(t.mob.woolS).toBe(YIELD_COOLDOWN_S.wool);
    t.use();
    expect(t.player.inventory.count('wool')).toBe(2);
    expect(t.toasts.some((s) => /still shorn/.test(s))).toBe(true);
    t.tickMobs(YIELD_COOLDOWN_S.wool + 1);
    t.mob.x = 0.5;
    t.mob.z = -2;
    t.use();
    expect(t.player.inventory.count('wool')).toBe(4);
  });

  it('a flint or bronze axe blade shears too; bare hands and a pail do not shear', () => {
    for (const blade of ['flint_axe', 'bronze_axe']) {
      const t = setup();
      t.hold(blade);
      t.use();
      expect(t.player.inventory.count('wool'), blade).toBe(2);
    }
    const hands = setup();
    hands.use();
    expect(hands.player.inventory.count('wool')).toBe(0);
  });

  it('milking and shearing run on separate timers', () => {
    const t = setup();
    t.hold('pail');
    t.use();
    t.hold('shears');
    t.use();
    expect(t.player.inventory.count('wool')).toBe(2);
  });
});

describe('what milk and wool are for', () => {
  it('ties milk into brewing, baking, stews, the sugar chain and the hand stations', () => {
    expect(recipe('milk_tea')?.inputs.map((i) => i.item)).toEqual(['dried_tea', 'milk_beaker', 'clay_cup']);
    expect(recipe('milk_coffee')?.inputs.map((i) => i.item)).toContain('ground_coffee');
    expect(item('milk_tea').food).toMatchObject({ hunger: 5, buff: 'well_fed' });
    expect(recipe('dough_milk')?.output).toEqual({ item: 'dough', count: 2 });
    expect(recipe('hearth_stew_milk')).toMatchObject({ station: 'furnace', kind: 'forge', output: { item: 'hearth_stew', count: 2 } });
    expect(recipe('hearth_stew_milk')?.byproducts).toEqual([{ item: 'pail', count: 1 }]);
    expect(recipe('sugar_cake_milk')?.inputs.map((i) => i.item)).toContain('milk_pail');
    expect(recipe('bread_butter')?.output).toEqual({ item: 'bread', count: 2 });
    expect(recipe('cheese')).toMatchObject({ station: 'drying_rack', timeS: 180 });
    expect(recipe('butter')).toMatchObject({ station: 'mortar', strokes: 8 });
  });

  it('ties wool into the loom, the padded coat, bellows and bedding', () => {
    expect(recipe('cloth_wool')).toMatchObject({ station: 'loom', output: { item: 'cloth', count: 2 } });
    expect(recipe('padded_coat_wool')?.output.item).toBe('padded_coat');
    expect(recipe('bellows_wool')?.output.item).toBe('bellows');
    expect(recipe('wool_bedding')?.output.item).toBe('wool_bedding');
    expect(recipe('shears')?.inputs.map((i) => i.item)).toContain('bronze_plate');
  });

  it('no recipe or text calls a pail a pail', () => {
    for (const key of ['milk_pail', 'milk_beaker', 'wool', 'shears', 'cheese', 'butter']) expect(`${item(key).name} ${item(key).desc}`).not.toMatch(/\bpails?\b/i);
  });
});
