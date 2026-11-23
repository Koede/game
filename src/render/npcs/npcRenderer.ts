/**
 * NpcRenderer: the tavern's people and props as camera-facing pixel sprites (docs/api/npcs.md), standing on their block with a gentle
 * idle bob. One THREE.Sprite per person, nearest-neighbour textures from `paintNpc`; the clock's texture is repainted when its minute
 * changes; sprites are dimmed with the sky so they sit in the night like everything else.
 */
import * as THREE from 'three';
import type { NpcView } from '../../npcs';
import { danceFrame, dancePose, STILL, type Pose } from '../../npcs/choreo';
import { ANIM_FPS, ANIM_FRAMES, DANCE_FRAMES, npcArt, npcDanceBodyFrac, onNpcArt } from './art';
import { BubbleLayer } from './bubbles';
import { designSize, paintNpc } from './sprites';

/** The parts of the Renderer it draws into. */
export interface NpcScene {
  readonly scene: THREE.Scene;
}

/** World size of one sprite pixel: a 40 px person is 2 blocks tall. */
const PIXEL = 0.05;

/** Rows the picture of a person is cut into, so it can bend (lean and S-curve) when they dance. */
const BEND_ROWS = 12;

/** A person: a camera-facing plane cut into rows, bent by the dance pose; props are plain sprites. */
interface Body {
  mesh: THREE.Mesh;
  base: Float32Array;
  w: number;
  h: number;
  tex: THREE.Texture;
  /** The dance atlas (assets/npcs/<id>_dance.png): frame 0 standing, then the poses; null when this person has none. */
  dance: { tex: THREE.Texture; w: number; h: number; frames: number } | null | undefined;
  /** After-images that trail a dancer (a beat behind, tinted and see-through), made on first dance. */
  ghosts?: { mesh: THREE.Mesh; tex: THREE.Texture }[];
}

/** How far behind the dancer each after-image is (seconds), and how strongly it shows. */
/** The frame to show: a hand-drawn loop plays straight through at ANIM_FPS; a pose atlas steps on the beat (choreo). */
function frameAt(frames: number, id: string, danceS: number): number {
  if (frames === ANIM_FRAMES) return ((Math.floor(danceS * ANIM_FPS) % ANIM_FRAMES) + ANIM_FRAMES) % ANIM_FRAMES;
  return danceFrame(id, danceS);
}

const GHOSTS: readonly { lag: number; alpha: number }[] = [{ lag: 0.12, alpha: 0.45 }, { lag: 0.26, alpha: 0.22 }];

export class NpcRenderer {
  private readonly sprites = new Map<string, THREE.Sprite>();
  private readonly bodies = new Map<string, Body>();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly clockMinute = new Map<string, number>();
  private time = 0;
  private readonly bubbles: BubbleLayer;

  private readonly offArt: () => void;

  constructor(private readonly host: NpcScene) {
    // Drop-in art (assets/npcs) arrives after the first frames: rebuild every sprite from it.
    this.bubbles = new BubbleLayer(host.scene);
    this.offArt = onNpcArt(() => this.reset());
  }

  private reset(): void {
    for (const s of this.sprites.values()) {
      this.host.scene.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
    }
    this.sprites.clear();
    for (const b of this.bodies.values()) this.dropBody(b);
    this.bodies.clear();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
    this.clockMinute.clear();
  }

  private dropBody(b: Body): void {
    this.host.scene.remove(b.mesh);
    b.mesh.geometry.dispose();
    (b.mesh.material as THREE.Material).dispose();
    b.dance?.tex.dispose();
    for (const g of b.ghosts ?? []) {
      this.host.scene.remove(g.mesh);
      (g.mesh.material as THREE.Material).dispose();
      g.tex.dispose();
    }
  }

  /** Call every frame with the views, a 0..1 brightness (the sky) and where the camera is (people turn to face it). */
  update(dt: number, views: readonly NpcView[], brightness = 1, eye?: { x: number; z: number }): void {
    this.time += dt;
    this.bubbles.update(views);
    const seen = new Set<string>();
    const k = 0.35 + 0.65 * Math.max(0, Math.min(1, brightness));
    for (const v of views) {
      seen.add(v.id);
      if (v.kind === 'person') {
        let body = this.bodies.get(v.id);
        if (!body) {
          body = this.makeBody(v);
          this.bodies.set(v.id, body);
          this.host.scene.add(body.mesh);
        }
        this.poseBody(body, v, eye, k);
        continue;
      }
      let s = this.sprites.get(v.id);
      if (!s) {
        s = this.make(v);
        this.sprites.set(v.id, s);
        this.host.scene.add(s);
      }
      if (v.sprite === 'clock' && this.clockMinute.get(v.id) !== v.extra) this.repaint(v);
      s.position.set(v.x, v.y, v.z);
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
    for (const [id, b] of this.bodies) {
      if (seen.has(id)) continue;
      this.dropBody(b);
      this.bodies.delete(id);
      this.textures.get(id)?.dispose();
      this.textures.delete(id);
    }
  }

  /** Places and bends one person: idle bob, or the dance pose when the jukebox plays. */
  private poseBody(b: Body, v: NpcView, eye: { x: number; z: number } | undefined, k: number): void {
    const idle = Math.sin(this.time * 1.6 + v.x * 0.7) * 0.015;
    const art = v.dancing ? this.danceArt(b, v) : null;
    // A hand-drawn loop carries its own motion: no procedural bend, turn or hop on top of it.
    const pose: Pose = v.dancing && !(art && art.frames === ANIM_FRAMES) ? dancePose(v.id, v.danceS) : STILL;
    const m = b.mesh;
    m.position.set(v.x, v.y + (v.dancing ? 0 : idle) + pose.hop, v.z);
    m.rotation.y = eye ? Math.atan2(eye.x - v.x, eye.z - v.z) : 0;
    // Sideways moves go along the screen's right-hand axis, which is the plane's local x.
    m.translateX(pose.side);
    // Dancers with pose art step through its frames on the beat; everyone else (and Gruk) keeps the standing picture.
    const mat = m.material as THREE.MeshBasicMaterial;
    const dance = art;
    let w = b.w;
    let h = b.h;
    if (dance) {
      dance.tex.offset.x = frameAt(dance.frames, v.id, v.danceS) / dance.frames;
      if (mat.map !== dance.tex) {
        mat.map = dance.tex;
        mat.needsUpdate = true;
      }
      w = dance.w;
      h = dance.h;
    } else if (mat.map !== b.tex) {
      mat.map = b.tex;
      mat.needsUpdate = true;
    }
    const squash = Math.max(0.5, pose.squash);
    const sx = Math.abs(pose.turn) < 0.06 ? 0.06 * Math.sign(pose.turn || 1) : pose.turn;
    m.scale.set((w * sx) / Math.sqrt(squash), h * squash, 1);
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    const aspect = h / w;
    for (let i = 0; i < pos.count; i++) {
      const t = b.base[i * 3 + 1]; // 0 at the feet .. 1 at the top
      pos.setX(i, b.base[i * 3] + (pose.lean * t + pose.curve * Math.sin(t * Math.PI)) * aspect);
    }
    pos.needsUpdate = true;
    mat.color.setRGB(k, k, k);
    this.trail(b, v, dance, h, eye, k);
  }

  /** The after-image trail behind a dancer with pose art: earlier poses, purple-tinted and fading, a hair behind the body. */
  private trail(b: Body, v: NpcView, dance: { tex: THREE.Texture; w: number; h: number; frames: number } | null, h: number, eye: { x: number; z: number } | undefined, k: number): void {
    if (!dance) {
      for (const g of b.ghosts ?? []) g.mesh.visible = false;
      return;
    }
    if (!b.ghosts) {
      b.ghosts = GHOSTS.map((spec) => {
        const tex = dance.tex.clone();
        tex.needsUpdate = true;
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: spec.alpha, alphaTest: 0.05, depthWrite: false, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(b.mesh.geometry, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = -1;
        this.host.scene.add(mesh);
        return { mesh, tex };
      });
    }
    b.ghosts.forEach((g, i) => {
      const t = v.danceS - GHOSTS[i].lag;
      const p = dance.frames === ANIM_FRAMES ? STILL : dancePose(v.id, t);
      g.tex.offset.x = frameAt(dance.frames, v.id, t) / dance.frames;
      const m = g.mesh;
      m.visible = true;
      m.position.set(v.x, v.y + p.hop, v.z);
      m.rotation.y = eye ? Math.atan2(eye.x - v.x, eye.z - v.z) : 0;
      m.translateX(p.side);
      m.translateZ(-0.03 * (i + 1));
      const squash = Math.max(0.5, p.squash);
      const sx = Math.abs(p.turn) < 0.06 ? 0.06 * Math.sign(p.turn || 1) : p.turn;
      m.scale.set((dance.w * sx) / Math.sqrt(squash), h * squash, 1);
      (m.material as THREE.MeshBasicMaterial).color.setRGB(0.55 * k, 0.4 * k, 0.9 * k);
    });
  }

  /** The dance atlas texture for a person, made on first use (a sub-rectangle of it is one frame). */
  private danceArt(b: Body, v: NpcView): { tex: THREE.Texture; w: number; h: number; frames: number } | null {
    if (b.dance !== undefined) return b.dance;
    const anim = npcArt(`${v.id}_anim`);
    const frames = anim ? ANIM_FRAMES : DANCE_FRAMES;
    const atlas = anim ?? npcArt(`${v.id}_dance`);
    if (!atlas) return (b.dance = null);
    const tex = new THREE.CanvasTexture(atlas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.repeat.set(1 / frames, 1);
    // The standing body in the cell matches the standing picture's height; the cell is taller by the headroom raised arms need.
    const cellW = atlas.width / frames;
    const h = b.h / npcDanceBodyFrac(v.id);
    return (b.dance = { tex, w: (cellW / atlas.height) * h, h, frames });
  }

  private makeBody(v: NpcView): Body {
    const tex = this.texture(v);
    this.textures.set(v.id, tex);
    const geo = new THREE.PlaneGeometry(1, 1, 1, BEND_ROWS);
    geo.translate(0, 0.5, 0);
    const art = this.art(v);
    let w: number;
    let h: number;
    if (art) {
      // Art keeps its own proportions: two blocks tall (times the person's scale).
      h = 2 * v.scale;
      w = (art.width / art.height) * h;
    } else {
      const size = designSize(v.sprite);
      w = size.w * PIXEL * v.scale;
      h = size.h * PIXEL * v.scale;
    }
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(w, h, 1);
    mesh.frustumCulled = false;
    return { mesh, base: new Float32Array((geo.getAttribute('position') as THREE.BufferAttribute).array), w, h, tex, dance: undefined };
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

  /** A prop (board, clock, jukebox): a plain sprite standing on its spot. */
  private make(v: NpcView): THREE.Sprite {
    const tex = this.texture(v);
    this.textures.set(v.id, tex);
    if (v.sprite === 'clock') this.clockMinute.set(v.id, v.extra);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.5, depthWrite: true });
    const s = new THREE.Sprite(mat);
    const size = designSize(v.sprite);
    s.center.set(0.5, 0);
    s.scale.set(size.w * PIXEL * v.scale, size.h * PIXEL * v.scale, 1);
    return s;
  }

  dispose(): void {
    this.offArt();
    this.bubbles.dispose();
    for (const s of this.sprites.values()) {
      this.host.scene.remove(s);
      (s.material as THREE.SpriteMaterial).dispose();
    }
    this.sprites.clear();
    for (const b of this.bodies.values()) this.dropBody(b);
    this.bodies.clear();
    for (const t of this.textures.values()) t.dispose();
    this.textures.clear();
  }
}
