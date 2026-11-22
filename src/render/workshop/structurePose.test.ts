import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { StructureMotion } from '../../workshop/contraption';
import type { WorldUniforms } from '../materials';
import type { GroundScene } from '../groundItems';
import { WorkshopRenderer } from './workshopRenderer';
import { structurePose } from './structurePose';

const slide = (t: number): StructureMotion => ({
  from: [2, 0, 0],
  to: [3, 0, 0],
  t,
  yaw: 0,
  pivot: null,
  kind: 'contraption_frame',
});

describe('structure pose', () => {
  it('slides the block centre from the old cell to the new one', () => {
    expect(structurePose(slide(0))).toMatchObject({ x: 2.5, y: 0.5, z: 0.5, yaw: 0 });
    const mid = structurePose(slide(0.5));
    expect(mid.x).toBeCloseTo(3);
    expect(mid.y).toBeCloseTo(0.5);
    expect(mid.z).toBeCloseTo(0.5);
    expect(structurePose(slide(1))).toMatchObject({ x: 3.5, y: 0.5, z: 0.5, yaw: 0 });
  });

  it('yaws a bearing block about the pivot instead of cutting the chord', () => {
    const motion: StructureMotion = {
      from: [2, 1, 0],
      to: [1, 1, 1],
      t: 0.5,
      yaw: Math.PI / 4,
      pivot: [1, 0, 0],
      kind: 'mech_arm',
    };
    const pose = structurePose(motion);
    expect(pose.x).toBeCloseTo(1.5 + Math.SQRT1_2);
    expect(pose.z).toBeCloseTo(0.5 + Math.SQRT1_2);
    expect(pose.y).toBeCloseTo(1.5);
    expect(pose.yaw).toBeCloseTo(Math.PI / 4);
    // The straight lerp would sit on the chord, a full diagonal step in from the arc.
    expect(pose.x).not.toBeCloseTo(2);
    const landed = structurePose({ ...motion, t: 1, yaw: Math.PI / 2 });
    expect(landed.x).toBeCloseTo(1.5);
    expect(landed.z).toBeCloseTo(1.5);
  });
});

describe('workshop structure mesh', () => {
  const scene = (): GroundScene => ({
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    uniforms: {} as WorldUniforms,
  });

  const centre = (mesh: THREE.InstancedMesh, i: number): THREE.Vector3 => {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(i, m);
    return new THREE.Vector3().setFromMatrixPosition(m);
  };

  it('draws a sliding block at the lerped cell and carries a cog on it', () => {
    const renderer = new WorkshopRenderer(scene());
    const empty = { spin: [], swings: [], links: [] };
    renderer.update(0, empty);
    expect(renderer.stats.blocks).toBe(0);
    renderer.update(0, {
      spin: [{ key: 'shaft', kind: 'drive_shaft', x: 2, y: 0, z: 0, rpm: 0 }],
      swings: [],
      links: [],
    }, [slide(0.5)]);
    expect(renderer.stats.blocks).toBe(1);
    expect(renderer.stats.cogs).toBe(1);
    const blocks = renderer.group.children.find((c) => c.name === 'structure-blocks') as THREE.InstancedMesh;
    const cogs = renderer.group.children[0] as THREE.InstancedMesh;
    const block = centre(blocks, 0);
    const cog = centre(cogs, 0);
    expect(block.x).toBeCloseTo(3);
    expect(block.y).toBeCloseTo(0.5);
    expect(block.z).toBeCloseTo(0.5);
    expect(cog.x).toBeCloseTo(3);
    expect(cog.y).toBeCloseTo(0.5);
    expect(cog.z).toBeCloseTo(0.5);
    renderer.dispose();
  });

  it('draws a bearing block on the arc with the quarter-turn yaw', () => {
    const renderer = new WorkshopRenderer(scene());
    const motion: StructureMotion = {
      from: [2, 1, 0],
      to: [1, 1, 1],
      t: 0.5,
      yaw: Math.PI / 4,
      pivot: [1, 0, 0],
      kind: 'contraption_frame',
    };
    renderer.update(0, { spin: [], swings: [], links: [] }, [motion]);
    const blocks = renderer.group.children.find((c) => c.name === 'structure-blocks') as THREE.InstancedMesh;
    const at = centre(blocks, 0);
    expect(at.x).toBeCloseTo(1.5 + Math.SQRT1_2);
    expect(at.z).toBeCloseTo(0.5 + Math.SQRT1_2);
    const m = new THREE.Matrix4();
    blocks.getMatrixAt(0, m);
    const q = new THREE.Quaternion();
    m.decompose(new THREE.Vector3(), q, new THREE.Vector3());
    const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
    expect(e.y).toBeCloseTo(Math.PI / 4);
    renderer.dispose();
  });
});
