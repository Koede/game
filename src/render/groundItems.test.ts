import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FakeWorld } from '../game/fakeWorld';
import { GroundItems } from '../game/groundItems';
import { GroundItemRenderer } from './groundItems';
import { createWorldUniforms } from './materials';

function make() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 6, 0);
  const view = { scene, camera, uniforms: createWorldUniforms(null) };
  const world = new FakeWorld();
  world.fill(-20, 0, -20, 20, 4, 20, 'stone');
  const renderer = new GroundItemRenderer(view, world);
  const ground = new GroundItems(null, () => 0.5);
  return { renderer, ground, scene };
}

describe('GroundItemRenderer', () => {
  it('draws one instanced mesh per item kind, whatever the count', () => {
    const { renderer, ground } = make();
    for (let i = 0; i < 40; i++) ground.spawn('coal', 1, (i % 8) * 0.9, 5, Math.floor(i / 8) * 0.9, { scatter: false });
    for (let i = 0; i < 5; i++) ground.spawn('stick', 1, i, 5, 5, { scatter: false });
    ground.spawn('stone', 1, 1, 5, 7, { scatter: false }); // a block item: a cube, not a sprite
    renderer.update(0.016, ground.items);
    expect(renderer.drawn).toBe(3);
    expect(renderer.instances).toBe(46);
    renderer.dispose();
  });

  it('shows more copies for bigger stacks, skips far items, and clears when they are gone', () => {
    const { renderer, ground } = make();
    ground.spawn('coal', 1, 1, 5, 1, { scatter: false });
    ground.spawn('coal', 5, 2, 5, 1, { scatter: false });
    ground.spawn('coal', 40, 3, 5, 1, { scatter: false });
    ground.spawn('coal', 1, 900, 5, 1, { scatter: false }); // beyond the fog
    renderer.update(0.016, ground.items);
    expect(renderer.instances).toBe(1 + 2 + 3);
    ground.clear();
    renderer.update(0.016, ground.items);
    expect(renderer.drawn).toBe(0);
    renderer.dispose();
  });

  it('grows its buffers instead of dropping items, and ignores unknown kinds', () => {
    const { renderer, ground } = make();
    for (let i = 0; i < 100; i++) ground.spawn('coal', 1, (i % 10) * 0.5, 5, Math.floor(i / 10) * 0.5, { scatter: false });
    renderer.update(0.016, ground.items);
    expect(renderer.instances).toBe(100);
    ground.items.push({ ...ground.items[0], id: 999, item: 'nonsense' });
    renderer.update(0.016, ground.items);
    expect(renderer.instances).toBe(100);
    renderer.dispose();
  });

  it('shows rings only while a collector runs', () => {
    const { renderer, scene } = make();
    const rings = (): number => (scene.children[0] as THREE.Group).children.filter((c) => c instanceof THREE.Mesh && !(c as THREE.InstancedMesh).isInstancedMesh && c.visible).length;
    renderer.update(0.016, [], false);
    expect(rings()).toBe(0);
    renderer.update(0.016, [], true);
    expect(rings()).toBe(3);
    renderer.update(0.016, [], false);
    expect(rings()).toBe(0);
    renderer.dispose();
  });
});
