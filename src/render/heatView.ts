/**
 * The heat view (docs/api/thermal.md): a translucent tile on the floor of every cell around the player, blue where it is cold,
 * clear where it is comfortable, orange and red where it is warm. Fed a `Thermal.grid()` by the game a couple of times a second;
 * between feeds it only follows the camera's visibility. One InstancedMesh, so a phone pays one draw call.
 */
import * as THREE from 'three';
import { heatColor } from '../game/thermal';
import type { ColorMode } from '../core/context';
import { rampFor, rampRgb01 } from '../ui/kit/palette';

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
  /** Settings.colorMode: 'off' keeps the cold-blue / warm-orange look, the others use the colour-blind heat ramp. */
  colorMode: ColorMode = 'off';
  private last: HeatGrid | null = null;
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
    this.last = grid;
    const { temps, floors, size } = grid;
    const ramp = this.colorMode === 'off' ? null : rampFor(this.colorMode, 'heat');
    let n = 0;
    const cap = this.mesh.instanceMatrix.count;
    for (let j = 0; j < size && n < cap; j++) {
      for (let i = 0; i < size && n < cap; i++) {
        const fy = floors[j * size + i];
        if (fy < 0) continue;
        const temp = temps[j * size + i];
        const [r, g, b, a] = heatColor(temp);
        if (a < 0.1) continue;
        this.dummy.position.set(grid.x0 + i + 0.5, fy + 0.04, grid.z0 + j + 0.5);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(n, this.dummy.matrix);
        if (ramp) this.color.setRGB(...rampRgb01(ramp, (temp + 5) / 49)); // 0 at -5 C and below, 1 at 44 C and above
        else this.color.setRGB(r, g, b);
        this.mesh.setColorAt(n, this.color);
        n++;
      }
    }
    this.mesh.count = n;
    this.drawn = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Repaints the last grid (the colour mode changed). */
  refresh(): void {
    if (this.last) this.set(this.last);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.mesh.dispose();
  }
}
