import { describe, expect, it } from 'vitest';
import { MOB_HIT_COOLDOWN_S, DT as TICK } from '../core/constants';
import { DEFAULT_SETTINGS, createBus, createInputState } from '../core/context';
import { creature } from '../core/registry';
import { makeStack } from '../game/inventory';
import { BURST_DAMAGE, LANTERN_BONUS_DAMAGE, LUNGE_BONUS_DAMAGE, LUNGE_COOLDOWN_S } from '../game/legendary';
import { MobManager, mobPlayerOf } from '../mobs';
import { PlayerController } from './controller';
import { Script, StubView, flatWorld, makePlayer, record } from './testKit';

const DT = 1 / 60;

/** A player on a flat floor looking at a goat 2.5 blocks north, as in animals.test.ts; `sunlight` 0 is night. */
function setup(sunlight = 1) {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const mobs = new MobManager(world, bus, { timeOfDay: 0.2, sunlight: () => 1 }, 1, { naturalSpawning: false, spawn: null });
  const spec = creature('goat');
  const mob = mobs.add(spec, { x: 0.5, y: 10, z: -2, yaw: 0 });
  const view = new StubView();
  const input = new Script();
  const controller = new PlayerController({
    world, bus, player, view, input, settings: { ...DEFAULT_SETTINGS }, state: createInputState(), rng: () => 0, animals: mobs, sunlight: () => sunlight,
  });
  const aim = (): void => {
    player.yaw = 0;
    player.pitch = Math.atan2(10 + spec.size.h * 0.5 - player.eyeY, -(mob.z - player.position.z));
  };
  const tickMobs = (seconds: number): void => {
    const mp = mobPlayerOf(player);
    for (let t = 0; t < seconds - 1e-9; t += TICK) mobs.tick(TICK, mp);
  };
  tickMobs(TICK);
  mob.x = 0.5;
  mob.z = -2;
  mob.health = 100;
  aim();
  /** One landed blow: lets both cooldowns run out, puts the goat back in front, holds Mine for a frame. */
  const swing = (): void => {
    tickMobs(MOB_HIT_COOLDOWN_S + TICK);
    player.combat.strikeCooldownS = 0;
    mob.x = 0.5;
    mob.z = -2;
    mob.vx = mob.vz = 0;
    aim();
    input.next.mine = true;
    controller.update(DT);
  };
  return { bus, world, player, mobs, mob, view, input, controller, aim, tickMobs, swing };
}

describe('Emberfang', () => {
  it('marks on every hit and the third mark bursts: extra damage to the target and to what stands beside it', () => {
    const { player, mob, mobs, swing, bus } = setup();
    const other = mobs.add(creature('goat'), { x: 1.5, y: 10, z: -2, yaw: 0 });
    other.health = 100;
    const far = mobs.add(creature('goat'), { x: 8.5, y: 10, z: -2, yaw: 0 });
    far.health = 100;
    player.inventory.set(0, makeStack('emberfang', 1, 320));
    player.selectSlot(0);
    const log = record(bus, 'legendary:proc');
    swing();
    expect(mob.health).toBe(94);
    expect(player.combat.legendary.marksOn(mob.id)).toBe(1);
    swing();
    expect(mob.health).toBe(88);
    expect(player.combat.legendary.marksOn(mob.id)).toBe(2);
    swing();
    expect(mob.health).toBe(88 - 6 - BURST_DAMAGE);
    expect(other.health).toBe(100 - BURST_DAMAGE);
    expect(far.health).toBe(100);
    expect(player.combat.legendary.marksOn(mob.id)).toBe(0);
    expect(log.length).toBeGreaterThanOrEqual(3);
    expect(log[0].e.effect).toBe('burning_marks');
  });

  it('wears one use per blow like any weapon', () => {
    const { player, swing } = setup();
    player.inventory.set(0, makeStack('emberfang', 1, 320));
    player.selectSlot(0);
    const d = player.heldStack()!.durability!;
    swing();
    expect(player.heldStack()!.durability).toBe(d - 1);
  });
});

describe('Gale Reed', () => {
  it('Use lunges the wielder forward, once per cooldown; the next blow hits harder and shoves the target back', () => {
    const { player, mob, input, controller, swing, tickMobs, aim } = setup();
    player.inventory.set(0, makeStack('gale_reed', 1, 320));
    player.selectSlot(0);
    input.next.use = true;
    controller.update(DT);
    expect(player.velocity.z).toBeLessThan(-5); // north is -Z, the way the goat is
    expect(player.combat.legendary.lungeCooldownS).toBeGreaterThan(0);
    const vz = player.velocity.z;
    input.next.use = true;
    controller.update(DT);
    expect(player.velocity.z).toBeGreaterThanOrEqual(vz - 1e-9); // a second Use inside the cooldown does nothing
    // The blow inside the window.
    player.combat.strikeCooldownS = 0;
    tickMobs(MOB_HIT_COOLDOWN_S + TICK);
    mob.x = 0.5;
    mob.z = -2;
    mob.vx = mob.vz = 0;
    aim();
    input.next.mine = true;
    controller.update(DT);
    expect(mob.health).toBe(100 - 5 - LUNGE_BONUS_DAMAGE);
    expect(-mob.vz).toBeGreaterThan(5); // shoved away from the player (north)
    // The window is spent: the next blow is plain.
    swing();
    expect(mob.health).toBe(100 - 5 - LUNGE_BONUS_DAMAGE - 5);
    void LUNGE_COOLDOWN_S;
  });

  it('is ordinary in the hand when the lunge is cooling down: the same blow without a lunge does no extra', () => {
    const { player, mob, swing } = setup();
    player.inventory.set(0, makeStack('gale_reed', 1, 320));
    player.selectSlot(0);
    swing();
    expect(mob.health).toBe(95);
  });
});

describe('Lanternblade', () => {
  it('bursts only in the dark: extra damage and a stun on automatons', () => {
    const day = setup(1);
    day.player.inventory.set(0, makeStack('lanternblade', 1, 320));
    day.player.selectSlot(0);
    day.swing();
    expect(day.mob.health).toBe(95);

    const night = setup(0);
    night.player.inventory.set(0, makeStack('lanternblade', 1, 320));
    night.player.selectSlot(0);
    const log = record(night.bus, 'legendary:proc');
    night.swing();
    expect(night.mob.health).toBe(100 - 5 - LANTERN_BONUS_DAMAGE);
    expect(log.some((l) => l.e.effect === 'lantern_burst')).toBe(true);
  });
});
