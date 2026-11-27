/**
 * Veyra's cigar and skull smoke (src/npcs/smoke.ts has the schedule and the pool): a small cigar billboard at her mouth with a pulsing
 * ember, and a pooled set of smoke sprites that play the hand-authored pixel animation in smokeArt.ts. Each smoke pixel is exactly one
 * character-sprite pixel in size, textures are nearest-neighbour and alpha is cut (alphaTest), so it is as crisp as the people.
 * Everything is allocated once; nothing allocates per frame.
 */
import * as THREE from 'three';
import { SMOKE_FRAMES, SMOKE_MAX, SmokePool, puffFrame, type SmokeState } from '../../npcs/smoke';
import { ANCHOR_X, CELL_H, CELL_W, smokeAtlasRgba } from './smokeArt';

/** Smoke is not simulated or drawn beyond this many blocks from the camera. */
export const SMOKE_RANGE = 40;
/** World size of one sprite pixel for a person `h` blocks tall: the people are 128 px tall (SPRITE_PX). */
const pixel = (h: number): number => h / 128;

/** Mouth and cigar placement in her sprite, as fractions: up from the feet, and sideways from the centre (screen right positive). */
export const MOUTH_UP = 0.895;
export const MOUTH_SIDE = 0.088;
/** Cigar tip offset from the mouth along the screen's left, and up (blocks, at scale 1). */
const CIGAR_LEN = 0.21;
const CIGAR_LIFT = 0.03;

/** The shared atlas: SMOKE_FRAMES cells in a row, built from the pixel grids. */
export function paintSmokeAtlas(): HTMLCanvasElement {
  const { w, h, data } = smokeAtlasRgba();
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d')!.putImageData(new ImageData(data, w, h), 0, 0);
  return c;
}

/** A tiny cigar: a pale ash tip and an ember on the left, a tan wrapper with a band, the mouth end on the right. */
function paintCigar(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 24;
  c.height = 8;
  const g = c.getContext('2d')!;
  g.fillStyle = '#4a2c17';
  g.fillRect(4, 2, 20, 4);
  g.fillStyle = '#7a4a26';
  g.fillRect(4, 2, 20, 2);
  g.fillStyle = '#c9a052';
  g.fillRect(14, 2, 2, 4);
  g.fillStyle = '#b9b4a8';
  g.fillRect(2, 2, 3, 4);
  g.fillStyle = '#ff7a1c';
  g.fillRect(0, 2, 3, 4);
  g.fillStyle = '#ffd36a';
  g.fillRect(0, 3, 2, 2);
  return c;
}

function canvasTex(c: HTMLCanvasElement, nearest: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface SmokeAnchor {
  /** Feet position, the facing angle (the body's rotation.y), the picture's size in blocks and the scene brightness 0.35..1. */
  x: number;
  y: number;
  z: number;
  rotY: number;
  w: number;
  h: number;
  k: number;
}

export class SmokeLayer {
  private readonly pool = new SmokePool(SMOKE_MAX);
  private readonly sprites: THREE.Sprite[] = [];
  private readonly texes: THREE.Texture[] = [];
  private readonly atlas = canvasTex(paintSmokeAtlas(), true);
  private readonly cigarTex = canvasTex(paintCigar(), true);
  private readonly cigar: THREE.Sprite;
  private readonly glow: THREE.Sprite;
  private readonly glowTex: THREE.CanvasTexture;
  private wasSmoking = false;

  constructor(private readonly scene: THREE.Scene) {
    this.atlas.repeat.set(1 / SMOKE_FRAMES, 1);
    for (let i = 0; i < SMOKE_MAX; i++) {
      const tex = this.atlas.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1 / SMOKE_FRAMES, 1);
      this.texes.push(tex);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: true }));
      s.center.set(ANCHOR_X / CELL_W, 0);
      s.visible = false;
      s.renderOrder = 3;
      scene.add(s);
      this.sprites.push(s);
    }
    this.cigar = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.cigarTex, transparent: true, alphaTest: 0.3, depthWrite: false }));
    this.cigar.center.set(0.92, 0.5);
    this.cigar.renderOrder = 4;
    this.cigar.visible = false;
    scene.add(this.cigar);
    const gc = document.createElement('canvas');
    gc.width = gc.height = 32;
    const g = gc.getContext('2d')!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,190,90,0.95)');
    grad.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    this.glowTex = canvasTex(gc, false);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.renderOrder = 5;
    this.glow.visible = false;
    scene.add(this.glow);
  }

  /** Alive puffs, for tests and diagnostics. */
  get alive(): number {
    return this.pool.alive;
  }

  /**
   * Call every frame. `state` is the schedule's answer; `reduceMotion` shows only the cigar and one static faint curl;
   * `eye` is the camera (smoke beyond SMOKE_RANGE is dropped and not drawn).
   */
  update(dt: number, time: number, state: SmokeState, a: SmokeAnchor, eye: { x: number; z: number } | undefined, reduceMotion: boolean): void {
    const near = !eye || Math.hypot(eye.x - a.x, eye.z - a.z) < SMOKE_RANGE;
    const sin = Math.sin(a.rotY);
    const cos = Math.cos(a.rotY);
    // The plane's local axes in the world: right (screen right) and forward (towards the camera).
    const rx = cos;
    const rz = -sin;
    const fx = sin;
    const fz = cos;
    const side = MOUTH_SIDE * a.w;
    const mx = a.x + rx * side + fx * 0.07;
    const my = a.y + MOUTH_UP * a.h;
    const mz = a.z + rz * side + fz * 0.07;
    const on = state.smoking && near;
    // The cigar.
    this.cigar.visible = on;
    this.glow.visible = on;
    if (on) {
      const len = CIGAR_LEN * (a.h / 2);
      this.cigar.position.set(mx + fx * 0.02, my - 0.005, mz + fz * 0.02);
      this.cigar.scale.set(len, len / 3, 1);
      (this.cigar.material as THREE.SpriteMaterial).rotation = -0.18;
      (this.cigar.material as THREE.SpriteMaterial).color.setRGB(a.k, a.k, a.k);
      const tipX = mx - rx * len * 0.96 + fx * 0.04;
      const tipY = my + CIGAR_LIFT * state.raise * 0.5 + len * 0.17;
      const tipZ = mz - rz * len * 0.96 + fz * 0.04;
      this.glow.position.set(tipX, tipY, tipZ);
      const pulse = 0.78 + 0.22 * Math.sin(time * 5.5) + 0.1 * Math.sin(time * 13.1);
      const gs = 0.07 * pulse * state.raise;
      this.glow.scale.set(gs, gs, 1);
      (this.glow.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.55 + 0.45 * pulse);
      const tx = tipX;
      const ty = tipY + 0.03;
      const tz = tipZ;
      if (reduceMotion) {
        // One still curl above the ember; nothing moves.
        this.pool.clear();
        const s = this.sprites[0];
        const px = pixel(a.h);
        this.setFrame(0, 3);
        s.visible = true;
        s.position.set(tx, ty, tz);
        s.scale.set(CELL_W * px, CELL_H * px, 1);
        for (let i = 1; i < this.sprites.length; i++) this.sprites[i].visible = false;
        this.wasSmoking = true;
        return;
      }
      this.pool.step(dt, true, tx, ty, tz, state.index);
    } else {
      if (this.wasSmoking && !near) this.pool.clear();
      this.pool.step(dt, false, 0, 0, 0);
    }
    this.wasSmoking = on;
    // Draw the pool: one pixel is one character-sprite pixel; positions step in whole pixels.
    const px = pixel(a.h);
    const snap = (v: number): number => Math.round(v / px) * px;
    for (let i = 0; i < this.sprites.length; i++) {
      const p = this.pool.puffs[i];
      const s = this.sprites[i];
      if (!p.alive || !near) {
        s.visible = false;
        continue;
      }
      s.visible = true;
      // They drift to the screen's right, away from the face.
      const drift = snap(0.05 * p.age);
      s.position.set(p.x + rx * drift, snap(p.y), p.z + rz * drift);
      s.scale.set(CELL_W * px, CELL_H * px, 1);
      const m = s.material as THREE.SpriteMaterial;
      const c = 0.7 + 0.3 * a.k;
      m.color.setRGB(c, c, c);
      this.setFrame(i, puffFrame(p.age));
    }
  }

  private setFrame(i: number, f: number): void {
    this.texes[i].offset.x = f / SMOKE_FRAMES;
  }

  dispose(): void {
    for (const s of this.sprites) {
      this.scene.remove(s);
      (s.material as THREE.Material).dispose();
    }
    for (const t of this.texes) t.dispose();
    this.atlas.dispose();
    for (const s of [this.cigar, this.glow]) {
      this.scene.remove(s);
      (s.material as THREE.Material).dispose();
    }
    this.cigarTex.dispose();
    this.glowTex.dispose();
  }
}
