/**
 * The telegraph's copper lines (docs/api/telegraph.md): one sagging line between each pair of joined poles, offices and
 * masts, from the top of one to the top of the other. Rebuilt only when the wiring changes (`Telegraph.version`).
 */
import * as THREE from 'three';
import type { TelegraphNode } from '../game/telegraph';

const SEGMENTS = 10;
/** Sag at mid-span per block of span. */
const SAG = 0.035;

export interface WireSource {
  readonly version: number;
  lines(): readonly [TelegraphNode, TelegraphNode][];
}

const top = (n: TelegraphNode): THREE.Vector3 => new THREE.Vector3(n.x + 0.5, n.y + (n.kind === 'office' ? 0.85 : 0.95), n.z + 0.5);

export class TelegraphWires {
  private readonly material = new THREE.LineBasicMaterial({ color: 0x2a1e16 });
  private readonly mesh = new THREE.LineSegments(new THREE.BufferGeometry(), this.material);
  private shown = -1;

  constructor(private readonly scene: { readonly scene: THREE.Scene }) {
    this.mesh.frustumCulled = false;
    this.mesh.name = 'telegraph-wires';
    scene.scene.add(this.mesh);
  }

  /** Point count of the lines drawn now (tests and the e2e check read it). */
  get points(): number {
    return (this.mesh.geometry.getAttribute('position')?.count as number | undefined) ?? 0;
  }

  update(src: WireSource): void {
    if (src.version === this.shown) return;
    this.shown = src.version;
    const pts: number[] = [];
    for (const [a, b] of src.lines()) {
      const p = top(a), q = top(b);
      const sag = p.distanceTo(q) * SAG;
      let prev = p;
      for (let i = 1; i <= SEGMENTS; i++) {
        const t = i / SEGMENTS;
        const cur = new THREE.Vector3().lerpVectors(p, q, t);
        cur.y -= sag * 4 * t * (1 - t);
        pts.push(prev.x, prev.y, prev.z, cur.x, cur.y, cur.z);
        prev = cur;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.mesh.geometry.dispose();
    this.mesh.geometry = g;
  }

  dispose(): void {
    this.scene.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
