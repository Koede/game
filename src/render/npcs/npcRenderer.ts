/**
 * NpcRenderer: the tavern's people and props as camera-facing pixel sprites (docs/api/npcs.md), standing on their block with a gentle
 * idle bob. One THREE.Sprite per person, nearest-neighbour textures from `paintNpc`; the clock's texture is repainted when its minute
 * changes; sprites are dimmed with the sky so they sit in the night like everything else.
 */
import * as THREE from 'three';
import type { NpcView } from '../../npcs';
import { BEAT_S } from '../../npcs/jukebox';
import { npcArt, onNpcArt } from './art';
import { designSize, paintNpc } from './sprites';

/** The parts of the Renderer it draws into. */
export interface NpcScene {
  readonly scene: THREE.Scene;
}

/** World size of one sprite pixel: a 40 px person is 2 blocks tall. */
const PIXEL = 0.05;

export class NpcRenderer {
  private readonly sprites = new Map<string, THREE.Sprite>();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly clockMinute = new Map<string, number>();
  private time = 0;

  private readonly offArt: () => void;

  constructor(private readonly host: NpcScene) {
    // Drop-in art (assets/npcs) arrives after the first frames: rebuild every sprite from it.
    this.offArt = onNpcArt(() => this.reset());
  }

  private reset(): void {
    for (const s of this.sprites.values()) {
      this.host.scene.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
    }
    this.sprites.clear();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.clockMinute.clear();
  }

  /** Call every frame with the views and a 0..1 brightness (the sky). */
  update(dt: number, views: readonly NpcView[], brightness = 1): void {
    this.time += dt;
    const seen = new Set<string>();
    for (const v of views) {
      seen.add(v.id);
      let s = this.sprites.get(v.id);
      if (!s) {
        s = this.make(v);
        this.sprites.set(v.id, s);
        this.host.scene.add(s);
      }
      if (v.sprite === 'clock' && this.clockMinute.get(v.id) !== v.extra) this.repaint(v);
      const bob = v.kind === 'person' ? Math.sin(this.time * 1.6 + v.x * 0.7) * 0.015 : 0;
      // Dancers (the jukebox is on): every one of them keeps the beat on their own phase, hopping, shuffling side to side and swaying.
      // Women swing wider and higher than the men.
      let hop = 0;
      let side = 0;
      let tilt = 0;
      if (v.dancing) {
        const wide = v.role === 'witch' || v.role === 'barkeep' ? 1 : 0.65;
        const beat = this.time * ((Math.PI * 2) / (BEAT_S * 4)) + v.x * 1.9;
        hop = Math.abs(Math.sin(beat)) * 0.16 * wide;
        side = Math.sin(beat * 0.5) * 0.22 * wide;
        tilt = Math.sin(beat) * 0.14 * wide;
      }
      s.position.set(v.x + side, v.y + bob + hop, v.z);
      (s.material as THREE.SpriteMaterial).rotation = tilt;
      const k = 0.35 + 0.65 * Math.max(0, Math.min(1, brightness));
      (s.material as THREE.SpriteMaterial).color.setRGB(k, k, k);
    }
    for (const [id, s] of this.sprites) {
      if (seen.has(id)) continue;
      this.host.scene.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
      this.sprites.delete(id);
      this.textures.get(id)?.dispose();
      this.textures.delete(id);
    }
  }

  /** Drop-in art for a person, if there is one. */
  private art(v: NpcView): HTMLCanvasElement | undefined {
    return v.kind === 'person' ? npcArt(v.id) : undefined;
  }

  private texture(v: NpcView): THREE.Texture {
    const art = this.art(v);
    if (art) {
      const t = new THREE.CanvasTexture(art);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    const img = paintNpc(v.sprite, v.extra);
    const tex = new THREE.DataTexture(img.data, img.w, img.h, THREE.RGBAFormat);
    tex.flipY = true;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  private repaint(v: NpcView): void {
    const s = this.sprites.get(v.id);
    if (!s) return;
    const old = this.textures.get(v.id);
    const tex = this.texture(v);
    this.textures.set(v.id, tex);
    const mat = s.material as THREE.SpriteMaterial;
    mat.map = tex;
    mat.needsUpdate = true;
    old?.dispose();
    this.clockMinute.set(v.id, v.extra);
  }

  private make(v: NpcView): THREE.Sprite {
    const tex = this.texture(v);
    this.textures.set(v.id, tex);
    if (v.sprite === 'clock') this.clockMinute.set(v.id, v.extra);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: true });
    const s = new THREE.Sprite(mat);
    const size = designSize(v.sprite);
    const art = this.art(v);
    if (art) {
      // Art keeps its own proportions: two blocks tall (times the person's scale).
      s.center.set(0.5, 0);
      s.scale.set((art.width / art.height) * 2 * v.scale, 2 * v.scale, 1);
      return s;
    }
    s.center.set(0.5, 0);
    s.scale.set(size.w * PIXEL * v.scale, size.h * PIXEL * v.scale, 1);
    return s;
  }

  dispose(): void {
    this.offArt();
    for (const s of this.sprites.values()) {
      this.host.scene.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
    }
    this.sprites.clear();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
  }
}
