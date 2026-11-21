/**
 * The problem highlight (spec 17.4, 'highlight:block'): a pulsing red outline round one block for a few seconds, seen
 * through whatever stands in front of it, and - while the block is off-screen or behind the camera - a red arrow at
 * the edge of the screen pointing the way (a small DOM element placed just above the canvas, under the UI).
 * A new highlight replaces the old one.
 */
import * as THREE from 'three';
import type { GameBus } from '../../core/context';
import { edgeGeometry } from '../target';

/** Seconds of fading out at the end of a highlight. */
const FADE_S = 0.6;
const STYLE_ID = 'hw-highlight-style';
const CSS = `
.hw-hl-arrow { position: absolute; left: 0; top: 0; width: 36px; height: 36px; pointer-events: none; display: none;
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

/**
 * Where the edge-of-screen arrow goes. `vx, vy, vz` is the block in view space (camera looks down -z), `ndcX, ndcY`
 * its projection (used when it is in front), `w, h` the view in CSS pixels, `margin` the arrow's inset from the edge.
 */
export function edgeArrow(vx: number, vy: number, vz: number, ndcX: number, ndcY: number, w: number, h: number, margin: number, out: EdgeArrow): EdgeArrow {
  const front = vz < 0;
  if (front && Math.abs(ndcX) <= 1 && Math.abs(ndcY) <= 1) {
    out.visible = false;
    return out;
  }
  let dx = front ? (ndcX * w) / 2 : vx;
  let dy = front ? (ndcY * h) / 2 : vy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = -1;
  const hw = Math.max(1, w / 2 - margin);
  const hh = Math.max(1, h / 2 - margin);
  const t = Math.min(dx !== 0 ? hw / Math.abs(dx) : Infinity, dy !== 0 ? hh / Math.abs(dy) : Infinity);
  dx *= t;
  dy *= t;
  out.visible = true;
  out.x = w / 2 + dx;
  out.y = h / 2 - dy;
  out.angle = Math.atan2(-dy, dx);
  return out;
}

export class BlockHighlight {
  readonly group = new THREE.Group();
  private readonly outline: THREE.Mesh;
  private readonly fill: THREE.Mesh;
  private readonly outlineMaterial: THREE.MeshBasicMaterial;
  private readonly fillMaterial: THREE.MeshBasicMaterial;
  private readonly arrow: HTMLDivElement;
  private readonly off: () => void;
  private readonly v = new THREE.Vector3();
  private readonly ndc = new THREE.Vector3();
  private readonly placed: EdgeArrow = { visible: false, x: 0, y: 0, angle: 0 };
  private left = 0;
  private time = 0;
  private lastX = NaN;
  private lastY = NaN;
  private lastA = NaN;
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
    this.off = bus.on('highlight:block', ({ x, y, z, seconds }) => this.show(x, y, z, seconds));
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
    const margin = 26 + Math.min(w, h) * 0.06;
    const a = edgeArrow(v.x, v.y, v.z, ndc.x, ndc.y, w, h, margin, this.placed);
    if (!a.visible || this.left <= 0) {
      this.hideArrow();
      return;
    }
    const style = this.arrow.style;
    if (style.display !== 'block') style.display = 'block';
    const px = Math.round(a.x - 18);
    const py = Math.round(a.y - 18);
    const deg = Math.round((a.angle * 180) / Math.PI);
    if (px !== this.lastX || py !== this.lastY || deg !== this.lastA) {
      this.lastX = px;
      this.lastY = py;
      this.lastA = deg;
      style.transform = `translate(${px}px, ${py}px) rotate(${deg}deg)`;
    }
    style.opacity = fade.toFixed(2);
  }

  dispose(): void {
    this.off();
    this.arrow.remove();
    this.outline.geometry.dispose();
    this.fill.geometry.dispose();
    this.outlineMaterial.dispose();
    this.fillMaterial.dispose();
  }

  private hideArrow(): void {
    if (this.arrow.style.display !== 'none') this.arrow.style.display = 'none';
    this.lastX = NaN;
  }
}
