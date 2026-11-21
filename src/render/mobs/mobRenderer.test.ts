import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { creature, CREATURES } from '../../core/registry';
import { createWorldUniforms } from '../materials';
import { FakeWorld } from '../testKit';
import { buildSpeciesGeometry } from './geometry';
import { MobRenderer, type MobRenderView } from './mobRenderer';

function view(id: number, species: string, x: number, z: number, extra: Partial<MobRenderView> = {}): MobRenderView {
  return { id, spec: creature(species), x, y: 11, z, yaw: 0, scale: 1, walk: 0, stride: 0, head: 0, flash: 0, tip: 0, fade: 0, onGround: true, eager: false, ...extra };
}

function setup() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.06, 400);
  camera.position.set(0, 12.6, 0);
  camera.rotation.order = 'YXZ';
  camera.updateProjectionMatrix();
  const uniforms = createWorldUniforms(null);
  uniforms.uFog.value.set(60, 90);
  const world = new FakeWorld(10);
  const r = new MobRenderer({ scene, camera, uniforms }, world);
  const mesh = (key: string): THREE.InstancedMesh => scene.getObjectByName(`mob-${key}`) as THREE.InstancedMesh;
  return { scene, camera, world, r, mesh };
}

describe('species geometry', () => {
  it('has six faces per part, the right animation groups and pivots', () => {
    for (const spec of CREATURES) {
      const g = buildSpeciesGeometry(spec);
      const pos = g.geometry.getAttribute('position');
      expect(pos.count).toBe(spec.model.length * 24);
      expect(g.geometry.getIndex()!.count).toBe(spec.model.length * 36);
      const part = g.geometry.getAttribute('aPart');
      const groups = new Set<number>();
      for (let i = 0; i < part.count; i++) groups.add(part.getX(i));
      expect(groups.has(1)).toBe(true);
      expect(groups.has(2) && groups.has(3)).toBe(true);
      g.geometry.computeBoundingBox();
      const box = g.geometry.boundingBox!;
      expect(box.min.y).toBeCloseTo(0, 5);
      expect(box.max.y).toBeCloseTo(g.height, 5);
      // The head sticks out at the front (-z): models face north.
      expect(-box.min.z).toBeGreaterThan(box.max.z);
      expect(g.radius).toBeGreaterThan(Math.max(box.max.y - 0.5, -box.min.z));
      g.geometry.dispose();
    }
  });

  it('puts the hen legs in opposite swing groups', () => {
    const g = buildSpeciesGeometry(creature('hen'));
    const part = g.geometry.getAttribute('aPart');
    const pos = g.geometry.getAttribute('position');
    const left = new Set<number>();
    const right = new Set<number>();
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0.2) continue;
      (pos.getX(i) < 0 ? left : right).add(part.getX(i));
    }
    expect([...left]).toEqual([2]);
    expect([...right]).toEqual([3]);
  });
});

describe('MobRenderer', () => {
  it('draws one instance per visible animal, culls behind the camera and past the fog', () => {
    const { r, mesh } = setup();
    // Camera looks north (-z).
    r.update(0.016, [view(1, 'hen', 0.5, -5), view(2, 'goat', 1.5, -8), view(3, 'goat', -2, -12), view(4, 'boar', 0, 6), view(5, 'boar', 0, -150)]);
    expect(mesh('hen').count).toBe(1);
    expect(mesh('goat').count).toBe(2);
    expect(mesh('boar').count).toBe(0);
    expect(r.drawn).toBe(3);
  });

  it('writes the instance transform: position, yaw, baby scale and the tip-over lift', () => {
    const { r, mesh } = setup();
    r.update(0.016, [view(7, 'goat', 2, -6, { yaw: Math.PI / 2, scale: 0.5 })]);
    const m = new THREE.Matrix4();
    mesh('goat').getMatrixAt(0, m);
    // The model's nose (-z) turned by +90 degrees points west (-x).
    const nose = new THREE.Vector3(0, 0, -1).applyMatrix4(m).sub(new THREE.Vector3(2, 11, -6));
    expect(nose.x).toBeCloseTo(-0.5, 5);
    expect(nose.z).toBeCloseTo(0, 5);
    r.update(0.016, [view(7, 'goat', 2, -6, { tip: 1 })]);
    mesh('goat').getMatrixAt(0, m);
    const up = new THREE.Vector3(0, 1, 0).applyMatrix4(m).sub(new THREE.Vector3().setFromMatrixPosition(m));
    expect(Math.abs(up.y)).toBeLessThan(1e-6);
    expect(new THREE.Vector3().setFromMatrixPosition(m).y).toBeCloseTo(11 + creature('goat').size.w / 2, 5);
  });

  it('feeds light from the probe and animation into the instance attributes', () => {
    const { r, mesh, world } = setup();
    world.put(1, 11, -4, 'torch');
    // A roof makes the spot dark to the sky.
    for (let x = -3; x <= 3; x++) for (let z = -7; z <= -1; z++) world.put(x, 14, z, 'stone');
    r.update(0.016, [view(1, 'hen', 0.5, -4, { walk: 0.3, stride: 1, flash: 1, eager: true })]);
    const geo = mesh('hen').geometry;
    const light = geo.getAttribute('aLight');
    const anim = geo.getAttribute('aAnim');
    expect(light.getX(0)).toBeLessThan(1);
    expect(light.getY(0)).toBeGreaterThan(0.5);
    expect(light.getW(0)).toBe(1);
    expect(Math.abs(anim.getX(0))).toBeGreaterThan(0.1);
    expect(anim.getW(0)).toBe(1);
  });

  it('takes the cool glow colour: cyan by glowcaps, violet (negative) by crystals, none by a torch', () => {
    const { r, mesh, world } = setup();
    world.put(1, 11, -6, 'glowcap');
    world.put(-7, 11, -20, 'crystal_cluster');
    world.put(9, 11, -20, 'torch');
    r.update(0.016, [view(1, 'hen', 0.5, -6), view(2, 'hen', -6.5, -20), view(3, 'hen', 8.5, -19)]);
    const cool = mesh('hen').geometry.getAttribute('aCool');
    const values = [cool.getX(0), cool.getX(1), cool.getX(2)].sort((a, b) => a - b);
    expect(values[0]).toBeLessThan(-0.9);
    expect(values[1]).toBe(0);
    expect(values[2]).toBeGreaterThan(0.9);
  });

  it('allocates nothing new per frame once warm and frees everything on dispose', () => {
    const { r, scene } = setup();
    const herd = Array.from({ length: 30 }, (_, i) => view(i + 1, ['hen', 'goat', 'boar'][i % 3], (i % 6) - 3, -4 - Math.floor(i / 6) * 2));
    r.update(0.016, herd);
    const before = scene.children[0].children.length;
    for (let f = 0; f < 50; f++) r.update(0.016, herd);
    expect(scene.children[0].children.length).toBe(before);
    r.dispose();
    expect(scene.getObjectByName('mobs')).toBeUndefined();
  });
});

describe('MobRenderer automatons', () => {
  const auto = (id: number, species: string, x: number, z: number, extra: Partial<MobRenderView> = {}): MobRenderView =>
    view(id, species, x, z, { glow: 1, flare: 0, attack: null, dormant: false, ...extra });

  it('draws automatons with their ember glow, flare and arm angles in the instance attributes', () => {
    const { r, mesh } = setup();
    r.update(0.016, [auto(1, 'forge_warden', 0, -6, { attack: 'melee', flare: 1 })]);
    for (let f = 0; f < 30; f++) r.update(0.016, [auto(1, 'forge_warden', 0, -6, { attack: 'melee', flare: 1 })]);
    const geo = mesh('forge_warden').geometry;
    const ember = geo.getAttribute('aEmber');
    expect(mesh('forge_warden').count).toBe(1);
    expect(ember.getX(0)).toBe(1);
    expect(ember.getY(0)).toBe(1);
    expect(ember.getW(0)).toBeGreaterThan(2); // hammer arm overhead
    expect(ember.getZ(0)).toBeLessThan(1);
  });

  it('draws a dormant automaton dark and an animal with no ember at all', () => {
    const { r, mesh } = setup();
    r.update(0.016, [auto(1, 'bellows_hound', 0, -6, { glow: 0, dormant: true }), view(2, 'hen', 1, -5)]);
    expect(mesh('bellows_hound').geometry.getAttribute('aEmber').getX(0)).toBe(0);
    const hen = mesh('hen').geometry.getAttribute('aEmber');
    expect([hen.getX(0), hen.getY(0), hen.getZ(0), hen.getW(0)]).toEqual([0, 0, 0, 0]);
  });

  it('crouches a hound before its dash and turns a sentry kiln towards a changed yaw', () => {
    const { r, mesh } = setup();
    const m = new THREE.Matrix4();
    for (let f = 0; f < 20; f++) r.update(0.016, [auto(1, 'bellows_hound', 0, -6, { attack: 'dash', flare: 1, stride: 0 })]);
    mesh('bellows_hound').getMatrixAt(0, m);
    const up = new THREE.Vector3(0, 1, 0).applyMatrix4(m).sub(new THREE.Vector3().setFromMatrixPosition(m));
    expect(up.y).toBeLessThan(0.85);
    r.update(0.016, [auto(2, 'kiln_sentry', 0, -6, { yaw: 0 })]);
    r.update(0.016, [auto(2, 'kiln_sentry', 0, -6, { yaw: 1 })]);
    expect(mesh('kiln_sentry').geometry.getAttribute('aCool').getY(0)).toBeCloseTo(1, 5);
  });

  it('breaks a dead automaton into debris instead of drawing it, once', () => {
    const { r, mesh, scene } = setup();
    r.update(0.016, [auto(1, 'forge_warden', 0, -6)]);
    expect(mesh('forge_warden').count).toBe(1);
    r.update(0.016, [auto(1, 'forge_warden', 0, -6, { tip: 1, glow: 0 })]);
    expect(mesh('forge_warden').count).toBe(0);
    const cubes = scene.getObjectByName('ember-cubes') as THREE.InstancedMesh;
    expect(cubes.count).toBeGreaterThan(20);
    const first = cubes.count;
    r.update(0.016, [auto(1, 'forge_warden', 0, -6, { tip: 1, glow: 0 })]);
    expect(cubes.count).toBeLessThanOrEqual(first); // no second burst
  });

  it('draws bolts as full-bright cubes with halos and a trail, capped, and frees them', () => {
    const { r, scene } = setup();
    const bolts = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, x: i - 6, y: 12.5, z: -8, vx: 14, vy: 0, vz: 0 }));
    r.setBolts(bolts);
    r.update(0.016, []);
    for (const b of bolts) b.x += 0.3;
    r.update(0.016, []);
    const cubes = scene.getObjectByName('ember-cubes') as THREE.InstancedMesh;
    expect(cubes.count).toBe(8);
    expect(r.fxStats.halos).toBeGreaterThanOrEqual(8);
    expect(r.fxStats.particles).toBeGreaterThan(8);
    r.dispose();
    expect(scene.getObjectByName('automaton-fx')).toBeUndefined();
  });

  it('adds nothing to the scene per frame once warm, with a pack of automatons and bolts', () => {
    const { r, scene } = setup();
    const pack = ['cinder_mite', 'forge_warden', 'kiln_sentry', 'bellows_hound', 'arc_drone', 'slag_colossus'].map((k, i) => auto(i + 1, k, i - 3, -7));
    r.setBolts([{ id: 1, x: 0, y: 12.5, z: -9, vx: 14, vy: 0, vz: 0 }]);
    for (let f = 0; f < 3; f++) r.update(0.016, pack);
    const children = scene.children[0].children.length + scene.children[1].children.length;
    for (let f = 0; f < 60; f++) r.update(0.016, pack);
    expect(scene.children[0].children.length + scene.children[1].children.length).toBe(children);
    expect(r.fxStats.particles).toBeLessThan(640);
  });
});

