/**
 * An instanced draw of a unit shape (box or quad with corners in 0..1) stretched per instance from aMin to aMax, with
 * one vec4 of data. Fill it between begin() and end() each frame; nothing is allocated after construction.
 */
import * as THREE from 'three';

export function unitQuadUp(): THREE.InstancedBufferGeometry {
  // A horizontal quad facing up (counter-clockwise seen from above).
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

export function unitQuadUpright(): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

const attr = (n: number, size: number): THREE.InstancedBufferAttribute =>
  new THREE.InstancedBufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);

export function flush(a: THREE.InstancedBufferAttribute, count: number): void {
  a.clearUpdateRanges();
  a.addUpdateRange(0, count * a.itemSize);
  a.needsUpdate = true;
}

export class BoxBatch {
  readonly mesh: THREE.Mesh;
  count = 0;
  private readonly aMin: THREE.InstancedBufferAttribute;
  private readonly aMax: THREE.InstancedBufferAttribute;
  private readonly aData: THREE.InstancedBufferAttribute;

  constructor(
    readonly capacity: number,
    private readonly geometry: THREE.InstancedBufferGeometry,
    readonly material: THREE.ShaderMaterial,
    name: string,
  ) {
    this.aMin = attr(capacity, 3);
    this.aMax = attr(capacity, 3);
    this.aData = attr(capacity, 4);
    geometry.setAttribute('aMin', this.aMin);
    geometry.setAttribute('aMax', this.aMax);
    geometry.setAttribute('aData', this.aData);
    geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = name;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  begin(): void {
    this.count = 0;
  }

  push(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, g: number, b: number, w: number): void {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    const mn = this.aMin.array as Float32Array;
    const mx = this.aMax.array as Float32Array;
    const d = this.aData.array as Float32Array;
    mn[i * 3] = x0;
    mn[i * 3 + 1] = y0;
    mn[i * 3 + 2] = z0;
    mx[i * 3] = x1;
    mx[i * 3 + 1] = y1;
    mx[i * 3 + 2] = z1;
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = w;
  }

  end(): void {
    const n = this.count;
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
    if (n === 0) return;
    flush(this.aMin, n);
    flush(this.aMax, n);
    flush(this.aData, n);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
