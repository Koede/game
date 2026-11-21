import { describe, expect, it } from 'vitest';
import { MOB_HIT_COOLDOWN_S, DT as TICK } from '../core/constants';
import { DEFAULT_SETTINGS, createBus, createInputState } from '../core/context';
import { blockId, creature } from '../core/registry';
import { voxelId } from '../core/types';
import { MobManager, mobPlayerOf } from '../mobs';
import { likedByAnimals } from './animals';
import type { BrewHands } from './brewTools';
import { PlayerController } from './controller';
import { Script, StubView, flatWorld, makePlayer, record } from './testKit';

const DT = 1 / 60;

/** A player on a flat stone floor (top at y 10) looking at an animal 2.5 blocks north (-Z) of them. */
function setup(species = 'goat', brew?: BrewHands) {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const mobs = new MobManager(world, bus, { timeOfDay: 0.2, sunlight: () => 1 }, 1, { naturalSpawning: false, spawn: null });
  const spec = creature(species);
  const mob = mobs.add(spec, { x: 0.5, y: 10, z: -2, yaw: 0 });
  const view = new StubView();
  const input = new Script();
  const controller = new PlayerController({
    world, bus, player, view, input, settings: { ...DEFAULT_SETTINGS }, state: createInputState(), rng: () => 0, animals: mobs, brew,
  });
  const aim = (): void => {
    const eye = player.eyeY;
    player.yaw = 0;
    player.pitch = Math.atan2(10 + spec.size.h * 0.5 - eye, -(mob.z - player.position.z));
  };
  const tickMobs = (seconds: number): void => {
    const mp = mobPlayerOf(player);
    for (let t = 0; t < seconds - 1e-9; t += TICK) mobs.tick(TICK, mp);
  };
  // One tick lists the animal as loaded (only those can be targeted); then it is put back exactly in front.
  tickMobs(TICK);
  mob.x = 0.5;
  mob.z = -2;
  aim();
  return { bus, world, player, mobs, mob, view, input, controller, aim, tickMobs };
}

describe('the player and the animals', () => {
  it('targets the animal in front of the floor: no block outline, the animal id instead', () => {
    const { controller, view, mob } = setup();
    controller.update(DT);
    expect(controller.targetAnimal).toBe(mob.id);
    expect(controller.target).toBeNull();
    expect(view.target).toBeNull();
  });

  it('targets the block when it is nearer than the animal', () => {
    const { controller, world, mob } = setup();
    world.fill(0, 10, -1, 0, 11, -1, 'stone');
    controller.update(DT);
    expect(controller.targetAnimal).toBeNull();
    expect(controller.target).not.toBeNull();
    expect(mob.health).toBe(creature('goat').health);
  });

  it('Mine hits the animal by the damage table, wears the tool by 1, knocks it back and never mines the floor', () => {
    const { controller, input, player, mob, mobs, bus, tickMobs, aim } = setup();
    player.give('flint_axe', 1);
    const durability = player.heldStack()!.durability!;
    const log = record(bus, 'mob:hurt', 'block:mining');
    input.next.mine = true;
    controller.update(DT);
    expect(mob.health).toBe(creature('goat').health - 3); // flint axe: tier 1 + 2
    expect(player.heldStack()!.durability).toBe(durability - 1);
    expect(Math.hypot(mob.vx, mob.vz)).toBeGreaterThan(1);
    // Held Mine hits again only after the animal's cooldown (and the player's own swing: 0.4 s with a tool).
    controller.update(DT);
    expect(mob.health).toBe(creature('goat').health - 3);
    tickMobs(MOB_HIT_COOLDOWN_S + TICK);
    player.combat.coolStrike(MOB_HIT_COOLDOWN_S);
    mob.x = 0.5;
    mob.z = -2;
    aim();
    controller.update(DT);
    expect(mob.health).toBe(creature('goat').health - 6);
    expect(log.filter((l) => l.type === 'mob:hurt')).toHaveLength(2);
    expect(log.some((l) => l.type === 'block:mining')).toBe(false);
    expect(mobs.describe(mob.id)).toBe('Goat - 2/8');
  });

  it('a killed animal gives its drops to whoever listens for deaths (the game hands them to the player)', () => {
    const { controller, input, player, mob, mobs, tickMobs } = setup('hen');
    mobs.onDeath((d) => {
      for (const s of d.drops) player.give(s.item, s.count);
    });
    player.give('bronze_axe', 1);
    input.next.mine = true;
    controller.update(DT);
    expect(mob.state).toBe('dying');
    tickMobs(1);
    expect(player.inventory.count('raw_fowl')).toBe(1);
  });

  it('Use with a liked item feeds the animal (before eating it) and takes one', () => {
    const { controller, input, player, mob } = setup('boar');
    player.give('carrot', 3);
    player.food = 10;
    input.next.use = true;
    controller.update(DT);
    expect(mob.eagerS).toBeGreaterThan(0);
    expect(player.inventory.count('carrot')).toBe(2);
    expect(player.food).toBe(10);
  });

  it('a liked item the animal refuses explains why; anything else acts as if no animal were there', () => {
    const { controller, input, player, bus, world } = setup('goat');
    const toasts = record(bus, 'toast');
    player.give('wheat_seeds', 2);
    input.next.use = true;
    controller.update(DT);
    expect(toasts.map((t) => t.e.text)).toContain('Goats eat wheat');
    expect(player.inventory.count('wheat_seeds')).toBe(2);

    player.inventory.clear();
    player.give('dirt', 1);
    input.next.use = true;
    controller.update(DT);
    // The dirt went onto the floor behind the goat's legs, where the crosshair meets it.
    expect(player.inventory.count('dirt')).toBe(0);
    let placed = 0;
    for (let z = -6; z <= 0; z++) if (voxelId(world.getVoxel(0, 10, z)) === blockId('dirt')) placed++;
    expect(placed).toBe(1);
  });

  it('an animal with a liked item beats a cup behind it; an item the animal does not like goes to the cup', () => {
    const calls: Array<{ x: number; y: number; z: number; held: string | null }> = [];
    const brew: BrewHands = {
      brewUse: (x, y, z, held) => (calls.push({ x, y, z, held }), { ok: false, reason: 'Set a drip cone on the cup' }),
      placeContainer: () => ({ ok: false, reason: 'no' }),
      isFurnaceTop: () => false,
    };
    const { controller, input, player, world, mob } = setup('goat', brew);
    world.put(0, 10, -3, 'clay_cup');
    player.give('wheat', 2);
    input.next.use = true;
    controller.update(DT);
    expect(mob.eagerS).toBeGreaterThan(0);
    expect(player.inventory.count('wheat')).toBe(1);
    expect(calls).toHaveLength(0);

    player.inventory.clear();
    player.give('drip_cone', 1);
    input.next.use = true;
    controller.update(DT);
    expect(calls).toEqual([{ x: 0, y: 10, z: -3, held: 'drip_cone' }]);
  });

  it('knows which items animals like', () => {
    expect(likedByAnimals('wheat')).toBe(true);
    expect(likedByAnimals('potato')).toBe(true);
    expect(likedByAnimals('dirt')).toBe(false);
  });
});
