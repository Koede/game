import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBus } from '../../core/context';
import { Facing } from '../../core/types';
import { createWorldUniforms } from '../materials';
import { Particles } from '../particles';
import { FakeWorld } from '../testKit';
import { HandParts } from './handParts';
import { HAND_ANIMS, QUERN_STEP, flash, swing, type HandRec } from './handModels';

function scene() {
  const bus = createBus();
  const world = new FakeWorld(10);
  const uniforms = createWorldUniforms(null);
  const particles = new Particles(uniforms, 2048);
  const parts = new HandParts(world, uniforms, bus, particles);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.06, 500);
  camera.position.set(0.5, 13, 8);
  camera.lookAt(0.5, 11.5, 0.5);
  camera.updateProjectionMatrix();
  return { bus, world, particles, parts, camera };
}

function station(world: FakeWorld, key: string, x: number, z: number, fields: Record<string, unknown> = {}, facing = Facing.North): void {
  world.put(x, 11, z, key, facing);
  const { input = null, output = null, ...rest } = fields;
  world.setEntity({ kind: 'hand', station: key, x, y: 11, z, slots: [input, output], progress: 0, recipe: null, hotS: 0, ...rest });
}

const mesh = (parts: HandParts, name: string): THREE.InstancedMesh => parts.group.children.find((m) => m.name === name) as THREE.InstancedMesh;
const stateOf = (m: THREE.InstancedMesh): THREE.InstancedBufferAttribute => m.geometry.getAttribute('aState') as THREE.InstancedBufferAttribute;
const stroke = (bus: ReturnType<typeof scene>['bus'], station: string, x: number, z: number, progress = 1, needed = 6) =>
  bus.emit('hand:stroke', { x, y: 11, z, station, progress, needed, double: false });

describe('hand animations', () => {
  it('builds consistent geometry for every part', () => {
    for (const a of HAND_ANIMS) {
      expect(a.stations.length).toBeGreaterThan(0);
      for (const p of a.parts) {
        const m = p.build();
        const g = m.geometry;
        expect(m.vertices, p.name).toBe(m.boxes * 24);
        for (const n of ['position', 'normal', 'uv', 'aLayer', 'aTint', 'aPivot', 'aAxis', 'aPhase']) expect(g.getAttribute(n).count, `${p.name} ${n}`).toBe(m.vertices);
      }
    }
  });

  it('swings up and back down within a stroke, and flashes after the impact', () => {
    expect(swing(0)).toBe(0);
    expect(swing(0.07)).toBe(1);
    expect(swing(0.16)).toBe(0);
    expect(swing(0.5)).toBe(0);
    expect(flash(0.1, 0.14, 0.14)).toBe(0);
    expect(flash(0.14, 0.14, 0.14)).toBe(1);
    expect(flash(0.5, 0.14, 0.14)).toBe(0);
  });

  it('keeps every part inside the cell it is drawn in (plus its swing)', () => {
    for (const a of HAND_ANIMS) {
      for (const p of a.parts) {
        const pos = p.build().geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          expect(Math.abs(pos.getX(i)), `${p.name} x`).toBeLessThanOrEqual(0.95);
          expect(Math.abs(pos.getZ(i)), `${p.name} z`).toBeLessThanOrEqual(0.95);
          expect(pos.getY(i), `${p.name} y`).toBeGreaterThanOrEqual(-0.35);
        }
      }
    }
  });
});

describe('HandParts', () => {
  it('draws a quern stone that turns 30 degrees per stroke, easing there', () => {
    const { bus, world, parts, camera } = scene();
    station(world, 'hand_quern', 0, 0);
    parts.update(0.016, camera);
    const runner = mesh(parts, 'hand-hand_quern-runner');
    expect(runner.count).toBe(1);
    expect(stateOf(runner).getX(0)).toBeCloseTo(0);
    stroke(bus, 'hand_quern', 0, 0);
    stroke(bus, 'hand_quern', 0, 0, 2);
    for (let i = 0; i < 60; i++) parts.update(0.02, camera);
    expect(stateOf(runner).getX(0)).toBeCloseTo(2 * QUERN_STEP, 2);
    // Easing: right after a stroke it has not arrived yet.
    stroke(bus, 'hand_quern', 0, 0, 3);
    parts.update(0.016, camera);
    const mid = stateOf(runner).getX(0);
    expect(mid).toBeGreaterThan(2 * QUERN_STEP);
    expect(mid).toBeLessThan(3 * QUERN_STEP);
  });

  it('shows the hammer and the flash only around a stroke', () => {
    const { bus, world, parts, camera } = scene();
    station(world, 'stone_anvil', 0, 0);
    parts.update(0.016, camera);
    expect(mesh(parts, 'hand-stone_anvil-hammer').count).toBe(0);
    stroke(bus, 'stone_anvil', 0, 0);
    parts.update(0.07, camera);
    const hammer = mesh(parts, 'hand-stone_anvil-hammer');
    expect(hammer.count).toBe(1);
    expect(stateOf(hammer).getX(0)).toBeGreaterThan(0.5);
    for (let i = 0; i < 10; i++) parts.update(0.07, camera);
    expect(hammer.count).toBe(0);
    expect(mesh(parts, 'hand-stone_anvil-flash').count).toBe(0);
  });

  it('opens the log as the work advances and hides it once nothing is loaded', () => {
    const { world, parts, camera } = scene();
    station(world, 'chopping_block', 0, 0, { input: { item: 'oak_log', count: 1 }, progress: 0, recipe: null });
    parts.update(0.016, camera);
    const log = mesh(parts, 'hand-chopping_block-log');
    expect(log.count).toBe(1);
    world.setEntity({ kind: 'hand', station: 'chopping_block', x: 0, y: 11, z: 0, slots: [null, { item: 'plank', count: 4 }], progress: 0, recipe: null });
    for (let i = 0; i < 40; i++) parts.update(0.02, camera);
    expect(log.count).toBe(0);
  });

  it('hangs the bundle that matches what the rack holds', () => {
    const { world, parts, camera } = scene();
    station(world, 'drying_rack', 0, 0, { input: { item: 'soaked_hide', count: 2 } });
    station(world, 'drying_rack', 3, 0, { input: { item: 'tall_grass', count: 4 } });
    station(world, 'drying_rack', -3, 0, { output: { item: 'leather', count: 2 } });
    parts.update(0.016, camera);
    expect(mesh(parts, 'hand-drying_rack-hide').count).toBe(1);
    expect(mesh(parts, 'hand-drying_rack-leaves').count).toBe(1);
    expect(mesh(parts, 'hand-drying_rack-dried').count).toBe(1);
  });

  it('spawns sparks on the anvil and chips on the chopping block, and a puff when work is done', () => {
    const { bus, world, particles, parts, camera } = scene();
    station(world, 'stone_anvil', 0, 0);
    station(world, 'chopping_block', 2, 0);
    parts.update(0.016, camera);
    stroke(bus, 'stone_anvil', 0, 0);
    const sparks = particles.count;
    expect(sparks).toBeGreaterThanOrEqual(5);
    stroke(bus, 'chopping_block', 2, 0);
    expect(particles.count).toBeGreaterThan(sparks);
    const before = particles.count;
    bus.emit('hand:done', { x: 2, y: 11, z: 0, station: 'chopping_block', output: 'plank', count: 4 });
    expect(particles.count).toBeGreaterThan(before);
  });

  it('forgets a station whose block was removed and ignores strokes on other blocks', () => {
    const { bus, world, parts, camera } = scene();
    station(world, 'loom', 0, 0);
    parts.update(0.016, camera);
    expect(parts.tracked).toBe(1);
    world.setVoxel(0, 11, 0, 0);
    for (let i = 0; i < 40; i++) parts.update(0.02, camera);
    expect(parts.tracked).toBe(0);
    stroke(bus, 'loom', 5, 5);
    expect(parts.tracked).toBe(0);
  });

  it('turns with the block facing', () => {
    const { world, parts, camera } = scene();
    station(world, 'loom', 0, 0, {}, Facing.East);
    parts.update(0.016, camera);
    const shuttle = mesh(parts, 'hand-loom-shuttle');
    const m = new THREE.Matrix4().fromArray(shuttle.instanceMatrix.array as Float32Array, 0);
    const front = new THREE.Vector3(0, 0, -1).transformDirection(m);
    expect(front.x).toBeCloseTo(1);
  });
});

describe('poses', () => {
  const rec = (over: Partial<HandRec>): HandRec => ({ strokes: 0, since: 1e3, time: 0, frac: 0, loaded: false, ready: false, variant: 0, angle: 0, phase: 0, ...over });
  it('puts the loom shuttle across the frame, alternating each stroke', () => {
    const shuttle = HAND_ANIMS.find((a) => a.stations[0] === 'loom')!.parts[0];
    const o = { x: 0, y: 0 };
    shuttle.pose(rec({ angle: 0 }), o);
    const a = Math.cos(o.x) * 0.3;
    shuttle.pose(rec({ angle: Math.PI }), o);
    expect(Math.cos(o.x) * 0.3).toBeCloseTo(-a);
  });
});
