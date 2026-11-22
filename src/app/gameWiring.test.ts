import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DRINK_BUFF_S, DRINK_COOLDOWN_S } from '../core/constants';
import { createBus } from '../core/context';
import { DRINKS } from '../core/registry';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game/playerState';
import { createRigScreen } from '../ui/screens/distill';
import {
  applyStructureHide,
  blockUnder,
  drinkElixir,
  extendRoadMove,
  followRide,
  hiddenStructureCells,
  MagicWorkshopLink,
  mobFeetInCell,
  registerDistillRig,
  showRodAura,
  tractorRoadFactor,
  treadwheelOccupied,
  walkRoadFactor,
  workshopClockAndPack,
} from './gameWiring';

describe('treadwheel occupancy', () => {
  const cell = { x: 4, y: 2, z: 7 };
  const away = { x: 0, y: 10, z: 0 };

  it('is true when a tame mob has its feet in the cell, and false for a wild mob there', () => {
    const tame = { x: 4.2, y: 2, z: 7.8, tame: true };
    const wild = { x: 4.2, y: 2, z: 7.8, tame: false };
    expect(mobFeetInCell(tame, cell.x, cell.y, cell.z)).toBe(true);
    expect(treadwheelOccupied(away, [wild], cell.x, cell.y, cell.z)).toBe(false);
    expect(treadwheelOccupied(away, [tame], cell.x, cell.y, cell.z)).toBe(true);
    expect(treadwheelOccupied(away, [{ ...tame, x: 5.1 }], cell.x, cell.y, cell.z)).toBe(false);
  });

  it('stays true for the player standing on the cell', () => {
    expect(treadwheelOccupied({ x: 4.5, y: 2.1, z: 7.5 }, [], cell.x, cell.y, cell.z)).toBe(true);
  });
});

describe('skiff ride', () => {
  it('moves the player x/z onto the block centre and null gives control back', () => {
    const body = {
      position: { x: 1, y: 4, z: 2 },
      velocity: { x: 3, y: -1, z: 2 },
    };
    expect(followRide(body, { x: 8, y: 3, z: 5 })).toBe(true);
    expect(body.position.x).toBe(8.5);
    expect(body.position.z).toBe(5.5);
    // Feet on the top of the block. The eye stays one eye-height above the feet; this does not store a separate eye.
    expect(body.position.y).toBe(4);
    expect(body.velocity).toEqual({ x: 0, y: 0, z: 0 });

    expect(followRide(body, null)).toBe(false);
    body.position.x = 2;
    body.position.z = 9;
    expect(followRide(body, null)).toBe(false);
    expect(body.position.x).toBe(2);
    expect(body.position.z).toBe(9);
  });
});

describe('rod aura', () => {
  it('passes the rod reading through, including null', () => {
    const seen: (string | null)[] = [];
    const hud = { setAura: (text: string | null) => seen.push(text) };
    showRodAura(hud, 'Gale 2');
    showRodAura(hud, null);
    expect(seen).toEqual(['Gale 2', null]);
  });
});

describe('magic workshop link', () => {
  it('binds the workshop before the first tick', () => {
    const order: string[] = [];
    const magic = {
      bindWorkshop() {
        order.push('bind');
      },
      tick() {
        order.push('tick');
      },
    };
    const link = new MagicWorkshopLink();
    expect(() => link.tick(magic, 0.05)).toThrow(/bindWorkshop/);
    link.bind(magic, { offer() { return 0; } });
    link.tick(magic, 0.05);
    expect(order).toEqual(['bind', 'tick']);
  });
});

describe('distill rig screen', () => {
  it('registers createRigScreen for distill_rig', () => {
    const factories = new Map<string, unknown>();
    registerDistillRig({
      registerScreen(type, factory) {
        factories.set(type, factory);
      },
    });
    expect(factories.get('distill_rig')).toBe(createRigScreen);
  });
});

describe('elixir drinking', () => {
  it('calls elixirGrant, grants the longer buff, and does not put the elixir in DRINKS', () => {
    const bus = createBus();
    const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
    player.inventory.set(0, { item: 'elixir_swift', count: 2 });
    player.selectedSlot = 0;
    const drank = drinkElixir(player);
    expect(drank.kind).toBe('drunk');
    if (drank.kind !== 'drunk') return;
    expect(drank.grant.buff).toBe('swift');
    expect(drank.grant.buffS).toBe(DRINK_BUFF_S * 3);
    expect(drank.grant.strengthAdd).toBe(1);
    expect(player.buffs.timeLeftS('swift')).toBe(DRINK_BUFF_S * 3);
    expect(player.inventory.get(0)?.count).toBe(1);
    expect(DRINKS.some((d) => d.key === 'elixir_swift')).toBe(false);
    expect(drinkElixir(player)).toEqual({ kind: 'refused' });
    expect(player.drinkCooldownS).toBe(DRINK_COOLDOWN_S);
    player.dispose();
  });
});

describe('workshop clock and pack', () => {
  it('reads world time and adds the returned card', () => {
    const clock = { worldTimeS: 12 };
    const added: [string, number][] = [];
    const hooks = workshopClockAndPack(clock, (item, n) => {
      added.push([item, n]);
      return 0;
    });
    expect(hooks.timeS()).toBe(12);
    clock.worldTimeS = 40;
    expect(hooks.timeS()).toBe(40);
    hooks.giveItem('punched_card', 1);
    expect(added).toEqual([['punched_card', 1]]);
  });
});

describe('road speed', () => {
  it('walks 1.25 on asphalt and leaves sprint, swim and flight alone', () => {
    const standing = { onGround: true, sprinting: false, inLiquid: false, flying: false };
    expect(walkRoadFactor('asphalt', standing)).toBe(1.25);
    expect(walkRoadFactor('stone', standing)).toBe(1);
    expect(walkRoadFactor('asphalt', { ...standing, sprinting: true })).toBe(1);
    expect(walkRoadFactor('asphalt', { ...standing, inLiquid: true })).toBe(1);
    expect(walkRoadFactor('asphalt', { ...standing, flying: true })).toBe(1);
  });

  it('moves a tractor 1.4 on asphalt only while it moved', () => {
    expect(tractorRoadFactor('asphalt', true)).toBe(1.4);
    expect(tractorRoadFactor('asphalt', false)).toBe(1);
    expect(tractorRoadFactor('dirt', true)).toBe(1);
  });

  it('sweeps the extra slice and stops it on a wall', () => {
    const world = new FakeWorld();
    world.fill(0, 4, 0, 6, 4, 2, 'asphalt');
    const open = { x: 1.5, y: 5, z: 0.5 };
    expect(blockUnder(world, open.x, open.y, open.z)).toBe('asphalt');
    extendRoadMove(world, open, 0.5, 0.5, 1.25, 0.3, 1.8);
    expect(open.x).toBeCloseTo(1.75);

    world.put(1, 5, 0, 'stone');
    const blocked = { x: 0.65, y: 5, z: 0.5 };
    extendRoadMove(world, blocked, 0.2, 0.5, 2, 0.3, 1.8);
    expect(blocked.x).toBeCloseTo(0.7, 3);
  });
});

describe('structure mesh hide', () => {
  it('drops from-cells and vacating cells, then restores the chunk mesh', () => {
    expect(hiddenStructureCells([{ from: [1, 2, 3] }], [[4, 5, 6]])).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      3, 0, 0, 4, 0, 0, 3, 1, 0,
      1, 0, 0, 2, 0, 0, 1, 1, 0,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const mesh = new THREE.Mesh(geo);
    const group = new THREE.Group();
    group.add(mesh);

    applyStructureHide(group, hiddenStructureCells([{ from: [0, 0, 0] }], [[3, 0, 0]]));
    expect(Array.from(geo.getIndex()!.array)).toEqual([6, 7, 8]);

    applyStructureHide(group, []);
    expect(Array.from(geo.getIndex()!.array)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
