/**
 * The problem highlight (spec 17.4, 'highlight:block'): a pulsing red outline round one block for a few seconds, seen
 * through whatever stands in front of it, and - while the block is off-screen or behind the camera - a red arrow at
 * the edge of the screen pointing the way (a small DOM element placed just above the canvas, under the UI).
 * A new highlight replaces the old one. A 'hearth:formed' round the marked block ends it early (it fades out): the
 * problem it pointed at is solved, and a red marker on the finished shell would say otherwise.
 */
import * as THREE from 'three';
import type { GameBus } from '../../core/context';
import { edgeGeometry } from '../target';

/** Seconds of fading out at the end of a highlight. */
const FADE_S = 0.6;
const STYLE_ID = 'hw-highlight-style';
const CSS = `
.hw-hl-arrow { position: absolute; left: 0; top: 0; width: 40px; height: 40px; pointer-events: none; display: none;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75)); will-change: transform; }
.hw-hl-arrow svg { width: 100%; height: 100%; display: block; animation: hw-hl-pulse 0.45s ease-in-out infinite alternate; }
@keyframes hw-hl-pulse { from { opacity: 0.6; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
`;
const ARROW_SVG =
  '<svg viewBox="0 0 36 36" aria-hidden="true"><path d="M33 18 L8 4 L13 18 L8 32 Z" fill="#ff3b2f" stroke="#fff3e8" stroke-width="2.2" stroke-linejoin="round"/></svg>';

export interface EdgeArrow {
  /** False while the block is on screen (no arrow). */
  visible: boolean;
  /** Arrow centre in CSS pixels from the top left, and its heading (radians, 0 = pointing right, clockwise). */
  x: number;
  y: number;
  angle: number;
}

/** Keep-out bands of the screen edges for the arrow (CSS pixels): the HUD at the top, the hotbar and buttons below. */
export interface ArrowInsets {
  side: number;
  top: number;
  bottom: number;
}

/**
 * Where the edge-of-screen arrow goes. `vx, vy, vz` is the block in view space (camera looks down -z), `ndcX, ndcY`
 * its projection (used when it is in front), `w, h` the view in CSS pixels. The arrow sits where the line from the
 * screen centre towards the block leaves the rectangle inside `insets`. A block behind the camera gets an arrow on
 * the left or right edge: the way to turn.
 */
export function edgeArrow(vx: number, _vy: number, vz: number, ndcX: number, ndcY: number, w: number, h: number, insets: ArrowInsets, out: EdgeArrow): EdgeArrow {
  const front = vz < 0;
  if (front && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1) {
    out.visible = false;
    return out;
  }
  // Screen direction (x right, y down) from the centre.
  let dx = front ? ndcX * w : vx >= 0 ? 1 : -1;
  let dy = front ? -ndcY * h : 0;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) dx = 1;
  const cx = w / 2;
  const cy = h / 2;
  const left = Math.min(insets.side, cx - 1);
  const right = Math.max(w - insets.side, cx + 1);
  const top = Math.min(insets.top, cy - 1);
  const bottom = Math.max(h - insets.bottom, cy + 1);
  const tx = dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity;
  const ty = dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity;
  const t = Math.min(tx, ty);
  dx *= t;
  dy *= t;
  out.visible = true;
  out.x = cx + dx;
  out.y = cy + dy;
  out.angle = Math.atan2(dy, dx);
  return out;
}

export class BlockHighlight {
  readonly group = new THREE.Group();
  private readonly outline: THREE.Mesh;
  private readonly fill: THREE.Mesh;
  private readonly outlineMaterial: THREE.MeshBasicMaterial;
  private readonly fillMaterial: THREE.MeshBasicMaterial;
  private readonly arrow: HTMLDivElement;
  private readonly offs: (() => void)[];
  private readonly v = new THREE.Vector3();
  private readonly ndc = new THREE.Vector3();
  private readonly placed: EdgeArrow = { visible: false, x: 0, y: 0, angle: 0 };
  private readonly insets: ArrowInsets = { side: 0, top: 0, bottom: 0 };
  private left = 0;
  private time = 0;
  private lastX = NaN;
  private lastY = NaN;
  private lastA = NaN;
  private lastFade = -1;
  private x = 0;
  private y = 0;
  private z = 0;

  constructor(bus: GameBus, private readonly canvas: HTMLCanvasElement) {
    this.outlineMaterial = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, depthTest: false, depthWrite: false });
    this.fillMaterial = new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, depthTest: false, depthWrite: false, opacity: 0.15 });
    this.outline = new THREE.Mesh(edgeGeometry(0.05), this.outlineMaterial);
    const box = new THREE.BoxGeometry(1.04, 1.04, 1.04);
    box.translate(0.52, 0.52, 0.52);
    this.fill = new THREE.Mesh(box, this.fillMaterial);
    for (const m of [this.outline, this.fill]) {
      m.renderOrder = 6;
      m.frustumCulled = false;
    }
    this.group.add(this.fill, this.outline);
    this.group.visible = false;
    this.group.name = 'highlight';
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    this.arrow = document.createElement('div');
    this.arrow.className = 'hw-hl-arrow';
    this.arrow.innerHTML = ARROW_SVG;
    // Right above the canvas and under the UI root (which comes later in the container).
    canvas.after(this.arrow);
    this.offs = [
      bus.on('highlight:block', ({ x, y, z, seconds }) => this.show(x, y, z, seconds)),
      bus.on('hearth:formed', ({ min, max }) => this.settle(min, max)),
    ];
  }

  /** Seconds the current highlight has left (0: none). */
  get remaining(): number {
    return this.left;
  }

  /** Whether the edge arrow is showing (the block is off-screen). */
  get arrowShown(): boolean {
    return this.placed.visible && this.left > 0;
  }

  show(x: number, y: number, z: number, seconds: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.left = Math.max(0, seconds);
    this.time = 0;
    this.group.position.set(x - 0.02, y - 0.02, z - 0.02);
    this.outline.scale.setScalar(1.04);
  }

  /**
   * A hearth formed with its shell in min..max: a highlight on it (or one block round it, where its problems are
   * reported) fades out now.
   */
  private settle(min: readonly number[], max: readonly number[]): void {
    if (this.left <= 0) return;
    const inside =
      this.x >= min[0] - 1 && this.x <= max[0] + 1 &&
      this.y >= min[1] - 1 && this.y <= max[1] + 1 &&
      this.z >= min[2] - 1 && this.z <= max[2] + 1;
    if (inside) this.left = Math.min(this.left, FADE_S);
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    if (this.left <= 0) {
      if (this.group.visible) {
        this.group.visible = false;
        this.hideArrow();
      }
      return;
    }
    this.left = Math.max(0, this.left - dt);
    this.time += dt;
    const fade = Math.min(1, this.left / FADE_S);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * Math.PI * 2 * 1.6);
    this.outlineMaterial.opacity = (0.55 + 0.45 * pulse) * fade;
    this.fillMaterial.opacity = (0.08 + 0.14 * pulse) * fade;
    this.group.visible = true;

    const v = this.v.set(this.x + 0.5, this.y + 0.5, this.z + 0.5).applyMatrix4(camera.matrixWorldInverse);
    const ndc = this.ndc.set(v.x, v.y, v.z).applyMatrix4(camera.projectionMatrix);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const ins = this.insets;
    ins.side = 30 + w * 0.04;
    ins.top = 40 + h * 0.08;
    ins.bottom = 70 + h * 0.14;
    const a = edgeArrow(v.x, v.y, v.z, ndc.x, ndc.y, w, h, ins, this.placed);
    if (!a.visible || this.left <= 0) {
      this.hideArrow();
      return;
    }
    const style = this.arrow.style;
    if (style.display !== 'block') style.display = 'block';
    const px = Math.round(a.x - 20);
    const py = Math.round(a.y - 20);
    const deg = Math.round((a.angle * 180) / Math.PI);
    if (px !== this.lastX || py !== this.lastY || deg !== this.lastA) {
      this.lastX = px;
      this.lastY = py;
      this.lastA = deg;
      style.transform = `translate(${px}px, ${py}px) rotate(${deg}deg)`;
    }
    // The fade only moves in the last FADE_S seconds: write it in steps of 1/20 so the style is not rebuilt every frame.
    const step = Math.round(fade * 20);
    if (step !== this.lastFade) {
      this.lastFade = step;
      style.opacity = String(step / 20);
    }
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.arrow.remove();
    this.outline.geometry.dispose();
    this.fill.geometry.dispose();
    this.outlineMaterial.dispose();
    this.fillMaterial.dispose();
  }

  private hideArrow(): void {
    if (this.arrow.style.display !== 'none') this.arrow.style.display = 'none';
    this.lastX = NaN;
    this.lastFade = -1;
  }
}
