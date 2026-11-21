import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Facing } from '../../core/types';
import { createWorldUniforms } from '../materials';
import { FakeWorld } from '../testKit';
import { MACHINE_DRAW_CAPACITY, MachineParts, placeMatrix } from './machineParts';
import { Motion } from './model';
import { MACHINE_ANIMS } from './models';

type Vec = [number, number, number];

/** CPU twin of the machine shader's vertex motion (material.ts), for checking the models move as intended. */
function moved(g: THREE.BufferGeometry, v: number, angle: number, extent = 1): Vec {
  const p = g.getAttribute('position');
  const piv = g.getAttribute('aPivot');
  const ax = g.getAttribute('aAxis');
  const ph = g.getAttribute('aPhase');
  let pos: Vec = [p.getX(v), p.getY(v), p.getZ(v)];
  const pivot: Vec = [piv.getX(v), piv.getY(v), piv.getZ(v)];
  const axis: Vec = [ax.getX(v), ax.getY(v), ax.getZ(v)];
  const motion = Math.round(ax.getW(v));
  const along = (k: number): void => {
    pos = [pos[0] + axis[0] * k, pos[1] + axis[1] * k, pos[2] + axis[2] * k];
  };
  if (motion === Motion.Slide) along(Math.sin(angle + ph.getX(v)) * piv.getW(v));
  else if (motion !== Motion.Static) {
    if (motion === Motion.Stretch) along((pos[0] - pivot[0]) * axis[0] * (extent - 1) + (pos[1] - pivot[1]) * axis[1] * (extent - 1) + (pos[2] - pivot[2]) * axis[2] * (extent - 1));
    else if (motion === Motion.Follow) along(extent - 1);
    const a = angle * piv.getW(v);
    const d: Vec = [pos[0] - pivot[0], pos[1] - pivot[1], pos[2] - pivot[2]];
    const c = Math.cos(a);
    const s = Math.sin(a);
    const kd = axis[0] * d[0] + axis[1] * d[1] + axis[2] * d[2];
    const cr: Vec = [axis[1] * d[2] - axis[2] * d[1], axis[2] * d[0] - axis[0] * d[2], axis[0] * d[1] - axis[1] * d[0]];
    pos = [0, 1, 2].map((i) => pivot[i] + d[i] * c + cr[i] * s + axis[i] * kd * (1 - c)) as Vec;
  }
  return pos;
}

const anim = (kind: string) => MACHINE_ANIMS.find((a) => a.kind === kind)!;
/** Vertices of the boxes whose motion is `motion` (by attribute). */
function verticesWith(g: THREE.BufferGeometry, motion: Motion): number[] {
  const ax = g.getAttribute('aAxis');
  const out: number[] = [];
  for (let v = 0; v < ax.count; v++) if (Math.round(ax.getW(v)) === motion) out.push(v);
  return out;
}

function scene(): { world: FakeWorld; parts: MachineParts; camera: THREE.PerspectiveCamera } {
  const world = new FakeWorld(10);
  const parts = new MachineParts(world, createWorldUniforms(null));
  const camera = new THREE.PerspectiveCamera(70, 1, 0.06, 500);
  camera.position.set(0.5, 13, 12);
  camera.lookAt(0.5, 12, 0);
  camera.updateProjectionMatrix();
  return { world, parts, camera };
}

function place(world: FakeWorld, kind: string, x: number, y: number, z: number, fields: Record<string, unknown> = {}, facing = Facing.North, active = true): void {
  world.put(x, y, z, kind, facing, active);
  world.setEntity({ kind, x, y, z, ...fields });
}

describe('machine part models', () => {
  it('build consistent geometry for every animated machine', () => {
    expect(MACHINE_ANIMS.map((a) => a.kind).sort()).toEqual(['bore_rig', 'pump', 'steam_engine', 'steam_turbine', 'water_wheel', 'wind_turbine']);
    for (const a of MACHINE_ANIMS) {
      const m = a.build();
      const g = m.geometry;
      expect(m.vertices, a.kind).toBe(m.boxes * 24);
      for (const name of ['position', 'normal', 'uv', 'aLayer', 'aTint', 'aPivot', 'aAxis', 'aPhase']) expect(g.getAttribute(name).count, `${a.kind} ${name}`).toBe(m.vertices);
      expect(g.getIndex()!.count).toBe(m.boxes * 36);
      expect(verticesWith(g, Motion.Static).length + verticesWith(g, Motion.Spin).length + verticesWith(g, Motion.Slide).length
        + verticesWith(g, Motion.Stretch).length + verticesWith(g, Motion.Follow).length).toBe(m.vertices);
      // Something moves, and at rest everything lies inside the culling sphere.
      expect(verticesWith(g, Motion.Static).length, a.kind).toBeLessThan(m.vertices);
      // (A drill string at rest is one block long: MachineParts grows the sphere by the extent, down the shaft.)
      const p = g.getAttribute('position');
      const cy = a.centerY - (a.extent ? 0.5 : 0);
      const radius = a.radius + (a.extent ? 1 : 0);
      for (let v = 0; v < p.count; v++) {
        const d = Math.hypot(p.getX(v), p.getY(v) - cy, p.getZ(v));
        expect(d, `${a.kind} vertex ${v}`).toBeLessThanOrEqual(radius + 1e-6);
      }
      g.dispose();
    }
  });

  it('turn about the right axes: rotor out of the front, wheel axle across, drill straight down', () => {
    const axisOf = (kind: string, motion: Motion): Vec => {
      const g = anim(kind).build().geometry;
      const v = verticesWith(g, motion)[0];
      const ax = g.getAttribute('aAxis');
      return [ax.getX(v), ax.getY(v), ax.getZ(v)].map((c) => Math.round(c * 1000) / 1000 + 0) as Vec;
    };
    expect(axisOf('wind_turbine', Motion.Spin)).toEqual([0, 0, 1]);
    expect(axisOf('steam_turbine', Motion.Spin)).toEqual([0, 0, 1]);
    expect(axisOf('water_wheel', Motion.Spin)).toEqual([1, 0, 0]);
    expect(axisOf('steam_engine', Motion.Spin)).toEqual([1, 0, 0]);
    expect(axisOf('bore_rig', Motion.Spin)).toEqual([0, -1, 0]);
    expect(axisOf('bore_rig', Motion.Stretch)).toEqual([0, -1, 0]);
    expect(axisOf('pump', Motion.Slide)).toEqual([0, 1, 0]);
  });

  it('keeps the steam engine piston rod in step with the crank pin', () => {
    const g = anim('steam_engine').build().geometry;
    const pos = g.getAttribute('position');
    // The crank pin is the last spinning box (brass, off-centre); the crosshead the last sliding box.
    const spin = verticesWith(g, Motion.Spin);
    const slide = verticesWith(g, Motion.Slide);
    const pin = spin.slice(-24);
    const head = slide.slice(-24);
    const centreZ = (vs: number[], angle: number): number => vs.reduce((sum, v) => sum + moved(g, v, angle)[2], 0) / vs.length;
    expect(pos.count).toBeGreaterThan(0);
    for (const angle of [0, 0.7, 1.6, 2.9, 4.2, 5.5]) expect(centreZ(head, angle)).toBeCloseTo(centreZ(pin, angle), 2);
    // And it really travels: a full stroke of twice the crank radius.
    expect(centreZ(head, Math.PI) - centreZ(head, 0)).toBeCloseTo(0.36, 2);
  });

  it('runs the drill string down the shaft to just inside the last block mined', () => {
    const bore = anim('bore_rig');
    const g = bore.build().geometry;
    const lowest = (extent: number): number => {
      let min = Infinity;
      for (let v = 0; v < g.getAttribute('position').count; v++) min = Math.min(min, moved(g, v, 1.3, extent)[1]);
      return min;
    };
    // Bored 6 blocks: the shaft runs from y - 6 to the rig; the bit ends inside the deepest cell.
    const extent = bore.extent!({ kind: 'bore_rig', x: 0, y: 40, z: 0, depthY: 34 });
    expect(lowest(extent)).toBeGreaterThan(-6);
    expect(lowest(extent)).toBeLessThan(-5.5);
    // Nothing bored yet: the bit hides in the ground right under the rig.
    const none = bore.extent!({ kind: 'bore_rig', x: 0, y: 40, z: 0, depthY: 40 });
    expect(lowest(none)).toBeGreaterThan(-1);
  });
});

describe('MachineParts', () => {
  it('draws machines in view with instance data and their speed following the output', () => {
    const { world, parts, camera } = scene();
    place(world, 'wind_turbine', 0, 11, 0, { availW: 1500 });
    place(world, 'wind_turbine', 4, 11, 0, { availW: 0 }, Facing.East, false);
    place(world, 'water_wheel', -4, 11, 0, { availW: 200 });
    parts.update(0.016, camera);
    expect(parts.tracked).toBe(3);
    expect(parts.drawn).toBe(3);
    for (let i = 0; i < 300; i++) parts.update(0.02, camera);
    const turbines = parts.group.children.find((m) => m.name === 'machine-wind_turbine') as THREE.InstancedMesh;
    expect(turbines.count).toBe(2);
    const state = turbines.geometry.getAttribute('aState') as THREE.InstancedBufferAttribute;
    const angles = [state.getX(0), state.getX(1)];
    parts.update(0.1, camera);
    const turned = [Math.abs(state.getX(0) - angles[0]), Math.abs(state.getX(1) - angles[1])];
    // Full output: 3.4 rad/s x 0.1 s; no output: still.
    expect(Math.max(...turned)).toBeCloseTo(0.34, 2);
    expect(Math.min(...turned)).toBeCloseTo(0, 3);
    // Lit like the terrain: open sky above the turbine.
    expect(state.getZ(0)).toBe(1);
  });

  it('orients by facing: an east-facing rotor sits east of its mast', () => {
    const m = new Float32Array(16);
    placeMatrix(m, 10.5, 11, 3.5, -Facing.East * (Math.PI / 2));
    const hub = new THREE.Vector3(0, 2.47, -0.36).applyMatrix4(new THREE.Matrix4().fromArray(m));
    expect(hub.x).toBeCloseTo(10.86);
    expect(hub.z).toBeCloseTo(3.5);
  });

  it('culls what is behind the camera, forgets broken machines and ignores far ones', () => {
    const { world, parts, camera } = scene();
    place(world, 'pump', 0, 11, 0);
    place(world, 'pump', 0, 11, 30);
    place(world, 'pump', 300, 11, 0);
    parts.update(0.016, camera);
    expect(parts.tracked).toBe(2);
    expect(parts.drawn).toBe(1);
    world.setVoxel(0, 11, 0, 0);
    for (let i = 0; i < 40; i++) parts.update(0.016, camera);
    expect(parts.tracked).toBe(1);
    expect(parts.drawn).toBe(0);
  });

  it('updates 50 animated machines in well under a millisecond per frame', () => {
    const { world, parts, camera } = scene();
    camera.position.set(0, 30, 40);
    camera.lookAt(0, 11, -10);
    for (let i = 0; i < 50; i++) {
      const a = MACHINE_ANIMS[i % MACHINE_ANIMS.length];
      place(world, a.kind, (i % 10) * 4 - 20, 11, -Math.floor(i / 10) * 4, { availW: 500, f: 1, depthY: 5 });
    }
    for (let i = 0; i < 20; i++) parts.update(0.016, camera);
    expect(parts.drawn).toBe(50);
    const frames = 400;
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) parts.update(0.016, camera);
    const ms = (performance.now() - t0) / frames;
    console.log(`MachineParts.update: ${ms.toFixed(3)} ms per frame with 50 machines (scans and probes included)`);
    expect(ms).toBeLessThan(1);
    expect(MACHINE_DRAW_CAPACITY).toBeGreaterThanOrEqual(64);
  });
});
