/**
 * The heat view (docs/api/thermal.md): a translucent tile on the floor of every cell around the player, blue where it is cold,
 * clear where it is comfortable, orange and red where it is warm. Fed a `Thermal.grid()` by the game a couple of times a second;
 * between feeds it only follows the camera's visibility. One InstancedMesh, so a phone pays one draw call.
 */
import * as THREE from 'three';
import { heatColor } from '../game/thermal';

export interface HeatGrid {
  temps: Float32Array;
  floors: Int16Array;
  size: number;
  /** World x, z of the grid's first (north-west) cell. */
  x0: number;
  z0: number;
}

export class HeatView {
  readonly mesh: THREE.InstancedMesh;
  private readonly geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  /** Cells drawn by the last feed. */
  drawn = 0;

  constructor(capacity = 41 * 41) {
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity);
    this.mesh.name = 'heat-view';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    this.mesh.count = 0;
  }

  get visible(): boolean {
    return this.mesh.visible;
  }

  setVisible(on: boolean): void {
    this.mesh.visible = on;
  }

  /** Lays one tile per cell that has a floor and something to show (comfortable air is left clear). */
  set(grid: HeatGrid): void {
    const { temps, floors, size } = grid;
    let n = 0;
    const cap = this.mesh.instanceMatrix.count;
    for (let j = 0; j < size && n < cap; j++) {
      for (let i = 0; i < size && n < cap; i++) {
        const fy = floors[j * size + i];
        if (fy < 0) continue;
        const [r, g, b, a] = heatColor(temps[j * size + i]);
        if (a < 0.1) continue;
        this.dummy.position.set(grid.x0 + i + 0.5, fy + 0.04, grid.z0 + j + 0.5);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(n, this.dummy.matrix);
        this.color.setRGB(r, g, b);
        this.mesh.setColorAt(n, this.color);
        n++;
      }
    }
    this.mesh.count = n;
    this.drawn = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.mesh.dispose();
  }
}
