/**
 * NpcRenderer: the tavern's people as camera-facing pixel sprites (docs/api/npcs.md), standing on their block with a gentle idle bob.
 * One THREE.Sprite per person, nearest-neighbour textures from `paintNpc`; the sprite is dimmed with the sky so they sit in the
 * night like everything else.
 */
import * as THREE from 'three';
import type { NpcView } from '../../npcs';
import { SPRITE_H, SPRITE_W, paintNpc } from './sprites';

/** The parts of the Renderer it draws into. */
export interface NpcScene {
  readonly scene: THREE.Scene;
}

/** World size of one sprite pixel: 40 px = 2 blocks tall. */
const PIXEL = 0.05;

export class NpcRenderer {
  private readonly sprites = new Map<string, THREE.Sprite>();
  private readonly textures = new Map<string, THREE.DataTexture>();
  private time = 0;

  constructor(private readonly host: NpcScene) {}

  /** Call every frame with the people's views and a 0..1 brightness (the sky). */
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
      const bob = Math.sin(this.time * 1.6 + v.x * 0.7) * 0.015;
      s.position.set(v.x, v.y + bob, v.z);
      const k = 0.35 + 0.65 * Math.max(0, Math.min(1, brightness));
      (s.material as THREE.SpriteMaterial).color.setRGB(k, k, k);
    }
    for (const [id, s] of this.sprites) {
      if (seen.has(id)) continue;
      this.host.scene.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
      this.sprites.delete(id);
    }
  }

  private make(v: NpcView): THREE.Sprite {
    let tex = this.textures.get(v.sprite);
    if (!tex) {
      const img = paintNpc(v.sprite);
      tex = new THREE.DataTexture(img.data, img.w, img.h, THREE.RGBAFormat);
      tex.flipY = true;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      this.textures.set(v.sprite, tex);
    }
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: true });
    const s = new THREE.Sprite(mat);
    s.center.set(0.5, 0);
    s.scale.set(SPRITE_W * PIXEL, SPRITE_H * PIXEL, 1);
    return s;
  }

  dispose(): void {
    for (const s of this.sprites.values()) {
      this.host.scene.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
    }
    this.sprites.clear();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
  }
}
