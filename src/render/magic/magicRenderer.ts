/**
 * Draws Essentia & Research in the world (docs/api/magic.md): the essentia inside jars, the floating
 * wellsprings (soft breathing orbs of light that rise and sink, fainter as they are drawn), and the items resting on pedestals and altars
 * (through a second GroundItemRenderer, so they look exactly like dropped items). Simple unlit materials: glowing glass.
 * Meshes are pooled; nothing is allocated per frame once the pools are warm.
 *
 * LIQUIDS (src/render/liquids/liquidBoxes.ts, one draw call, rebuilt every LIQUID_INTERVAL_S): the essentia in each jar
 * glows in its aspect's colour and drifts slowly upward (faster, and churning, while something draws on the jar);
 * essentia being drawn runs as a glowing stream through the tubes from jar to consumer, or arcs through the air from a jar
 * to the altar it feeds; a crucible's water takes the tint of what is dissolved in it, boils over heat with flecks of
 * every aspect circling on top, and swirls in the colour of a draught when it holds one (ready for its catalyst, or just
 * brewed). The shader moves everything between rebuilds.
 */
import * as THREE from 'three';
import type { IWorld } from '../../core/types';
import type { GroundItem } from '../../game/groundItems';
import { aspectInfo, type Aspect, type Aspects } from '../../magic/aspects';
import { CRUCIBLE_CAP } from '../../magic/crucible';
import { arcRoute, crucibleColour, flowPath, type Cell, type EssentiaFlow } from '../../magic/essentiaFlow';
import type { MirrorLink } from '../../magic/essentiaNet';
import { NODE_POOL } from '../../magic/nodes';
import { GroundItemRenderer, type GroundScene } from '../groundItems';
import { LiquidBoxes, surfaceDip } from '../liquids/liquidBoxes';
import { LightProbe, lightColor } from '../lightProbe';

/** A crucible's water stands this far above the block top (the rim) at rest. The boil dips from there and never rises. */
export const CRUCIBLE_RIM_LIFT = 0.004;

/**
 * The water body of a crucible whose block top is `top`: `level` is its open surface (the highest point of the slosh, at the
 * rim) and `bottom` reaches below the deepest dip of a full boil, so the shader's displaced top never inverts the box.
 */
export function crucibleSurface(top: number): { bottom: number; level: number } {
  const level = top + CRUCIBLE_RIM_LIFT;
  return { bottom: level - surfaceDip(1) - 0.01, level };
}

export interface JarFill { x: number; y: number; z: number; aspect: Aspect; fill: number }
export interface NodeView { key: string; x: number; y: number; z: number; aspect: Aspect; left: number }
/** `glow`: an altar humming for this aspect in the jars near it (docs/plans/enchantments.md). */
export interface DisplayItem { item: string; x: number; y: number; z: number; glow?: Aspect }
export interface CrucibleView { x: number; y: number; z: number; hot: boolean; ess: Aspects; potion: number | null }
/** Where the liquids come from (the Magic system): crucibles, essentia on the move, mirror links for tube paths. */
export interface LiquidSource {
  crucibleViews(): CrucibleView[];
  readonly flows: { readonly flows: readonly EssentiaFlow[]; draining(x: number, y: number, z: number): boolean };
  readonly mirrorLink?: MirrorLink;
}

/** Wellsprings farther than this (blocks) are not drawn. */
export const NODE_DRAW_DIST = 64;
/** Liquids farther than this (blocks) are not drawn. */
export const LIQUID_DRAW_DIST = 48;
export const LIQUID_MAX = 384;
const LIQUID_INTERVAL_S = 0.25;
/** Seconds a stream's tube path is trusted before it is searched again. */
const PATH_TTL_S = 2;
const WATER = 0x3f8fd8;
// Inside a jar's glass (src/world/glassModels.ts): x/z 4..12, y from 1/16 to 11/16.
const JAR_W = 0.48;
const JAR_Y = 1 / 16;
const JAR_H = 10 / 16 - 0.02;
// An essentia tube's channel is 4/16 wide; the stream runs inside it.
const STREAM_W = 0.12;
const ARC_W = 0.035;

const hexCache = new Map<Aspect, number>();
const aspectHex = (a: Aspect): number => {
  let h = hexCache.get(a);
  if (h === undefined) hexCache.set(a, (h = parseInt(aspectInfo(a).color.slice(1), 16)));
  return h;
};

const mixHex = (a: number, b: number, k: number): number => {
  const m = (sh: number): number => Math.round(((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k) << sh;
  return m(16) | m(8) | m(0);
};

export class MagicRenderer {
  readonly group = new THREE.Group();
  // Round, not faceted: a wellspring is welling light, not a cut gem.
  private readonly nodeGeo = new THREE.SphereGeometry(0.36, 14, 10);
  private readonly haloGeo = new THREE.SphereGeometry(0.6, 14, 10);
  private readonly nodeMeshes: { core: THREE.Mesh; halo: THREE.Mesh }[] = [];
  // A humming altar's aspect: a small pulsing orb above the heart item (the aspect icon "glows").
  private readonly humGeo = new THREE.SphereGeometry(0.11, 10, 8);
  private readonly humMeshes: THREE.Mesh[] = [];
  private readonly materials = new Map<string, THREE.MeshBasicMaterial>();
  private readonly items: GroundItemRenderer;
  private readonly fake: GroundItem[] = [];
  private time = 0;
  private readonly liquids = new LiquidBoxes(LIQUID_MAX, 'essentia-liquids');
  private readonly probe: LightProbe;
  private readonly light = new Float32Array(3);
  private readonly tint = new Float32Array(3);
  private readonly warm = new Float32Array(3);
  private readonly sky = new Float32Array(3);
  private readonly col = new THREE.Color();
  private readonly paths = new Map<string, { path: Cell[] | null; age: number }>();
  private clock = 0;
  private timer = 0;
  private jars: readonly JarFill[] = [];
  /** Counts last frame, for tests and diagnostics. */
  stats = { jars: 0, nodes: 0, items: 0, liquids: 0, streams: 0 };

  constructor(private readonly scene: GroundScene, private readonly world: IWorld, private readonly source: LiquidSource | null = null) {
    scene.scene.add(this.group);
    this.items = new GroundItemRenderer(scene, world);
    this.probe = new LightProbe(world);
    this.group.add(this.liquids.mesh);
  }

  private material(color: string, opacity: number): THREE.MeshBasicMaterial {
    const key = `${color}:${opacity}`;
    let m = this.materials.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity, depthWrite: false });
      this.materials.set(key, m);
    }
    return m;
  }

  update(dt: number, jars: readonly JarFill[], nodes: readonly NodeView[], displays: readonly DisplayItem[], eye: { x: number; y: number; z: number }): void {
    this.time += dt;
    this.clock = (this.clock + dt) % 3600;
    this.liquids.tick(this.clock);
    // Liquids: rebuilt a few times a second (and at once when a jar appears or empties); the shader moves them between.
    this.jars = jars;
    this.timer -= dt;
    if (this.timer <= 0 || jars.length !== this.stats.jars) {
      this.timer = LIQUID_INTERVAL_S;
      this.rebuild(eye);
    }
    // Wellsprings: a bright orb in a faint halo that breathes and rises and sinks slowly, never spins.
    let n = 0;
    for (const node of nodes) {
      if (Math.hypot(node.x - eye.x, node.z - eye.z) > NODE_DRAW_DIST) continue;
      let m = this.nodeMeshes[n];
      if (!m) {
        m = { core: new THREE.Mesh(this.nodeGeo), halo: new THREE.Mesh(this.haloGeo) };
        this.nodeMeshes.push(m);
        this.group.add(m.core, m.halo);
      }
      const color = aspectInfo(node.aspect).color;
      const strength = 0.35 + 0.6 * Math.max(0, Math.min(1, node.left / NODE_POOL));
      m.core.material = this.material(color, Math.round(strength * 20) / 20);
      m.halo.material = this.material(color, 0.18);
      const phase = (node.x * 13 + node.z * 7) % 6;
      const y = node.y + Math.sin(this.time * 0.9 + phase) * 0.18;
      const breath = 1 + 0.08 * Math.sin(this.time * 2 + phase);
      m.core.visible = true;
      m.core.position.set(node.x + 0.5, y, node.z + 0.5);
      m.core.scale.setScalar(1);
      m.halo.visible = true;
      m.halo.position.set(node.x + 0.5, y, node.z + 0.5);
      m.halo.scale.setScalar(breath);
      n++;
    }
    for (let i = n; i < this.nodeMeshes.length; i++) {
      this.nodeMeshes[i].core.visible = false;
      this.nodeMeshes[i].halo.visible = false;
    }
    // Items on pedestals and altars.
    this.fake.length = 0;
    displays.forEach((d, i) => {
      this.fake.push({
        id: -1 - i, item: d.item, count: 1, x: d.x, y: d.y, z: d.z, vx: 0, vy: 0, vz: 0, age: 0, delayS: 1e9,
        onGround: true, homing: false, pulled: false, phase: i * 1.7,
      });
    });
    this.items.update(dt, this.fake, false);
    let hum = 0;
    for (const d of displays) {
      if (!d.glow || Math.hypot(d.x - eye.x, d.z - eye.z) > NODE_DRAW_DIST) continue;
      let m = this.humMeshes[hum];
      if (!m) {
        m = new THREE.Mesh(this.humGeo);
        this.humMeshes.push(m);
        this.group.add(m);
      }
      m.material = this.material(aspectInfo(d.glow).color, 0.7);
      const pulse = 1 + 0.25 * Math.sin(this.time * 4 + d.x * 3 + d.z);
      m.position.set(d.x, d.y + 0.45, d.z);
      m.scale.setScalar(pulse);
      m.visible = true;
      hum++;
    }
    for (let i = hum; i < this.humMeshes.length; i++) this.humMeshes[i].visible = false;
    this.stats.jars = jars.length;
    this.stats.nodes = n;
    this.stats.items = displays.length;
  }

  /** An aspect or liquid colour lit by the light where it stands, plus its own glow. */
  private lit(hex: number, x: number, y: number, z: number, glow: number): THREE.Color {
    const u = this.scene.uniforms;
    this.probe.probe(x, y, z);
    u.uBlockLight.value.toArray(this.warm);
    u.uSkyLight.value.toArray(this.sky);
    const l = lightColor(this.probe.sky, this.probe.block, this.sky, this.probe.tint(this.warm, this.tint), u.uAmbient.value, this.light);
    const c = this.col.setHex(hex);
    return c.setRGB(c.r * Math.min(1, l[0] * 1.1 + glow), c.g * Math.min(1, l[1] * 1.1 + glow), c.b * Math.min(1, l[2] * 1.1 + glow));
  }

  private rebuild(eye: { x: number; y: number; z: number }): void {
    const L = this.liquids;
    const r2 = LIQUID_DRAW_DIST * LIQUID_DRAW_DIST;
    const near = (x: number, z: number): boolean => (x + 0.5 - eye.x) ** 2 + (z + 0.5 - eye.z) ** 2 < r2;
    L.begin();
    const flows = this.source?.flows;
    // Jars: glowing essentia drifting slowly up; stirred while something draws on it.
    for (const j of this.jars) {
      if (!near(j.x, j.z)) continue;
      const h = Math.max(0.04, Math.min(1, j.fill)) * JAR_H;
      const drawn = flows?.draining(j.x, j.y, j.z) ?? false;
      const seed = (j.x * 7 + j.z * 13 + j.y * 3) % 6.28;
      L.add(j.x + 0.5, j.y + JAR_Y, j.z + 0.5, JAR_W, h, JAR_W, this.lit(aspectHex(j.aspect), j.x + 0.5, j.y + 0.5, j.z + 0.5, 0.35), {
        flow: [Math.sin(seed) * 0.4, 1, Math.cos(seed) * 0.4], speed: drawn ? 0.4 : 0.07, boil: drawn ? 0.2 : 0, surface: true, glow: 0.35,
      });
    }
    // Streams of essentia on the move.
    let streams = 0;
    if (flows && this.source) {
      const blockAt = (x: number, y: number, z: number): string => this.world.getBlock(x, y, z).key;
      for (const f of flows.flows) {
        if (!near(f.from[0], f.from[2]) && !near(f.to[0], f.to[2])) continue;
        streams++;
        const k = `${f.from[0]},${f.from[1]},${f.from[2]}|${f.to[0]},${f.to[1]},${f.to[2]}`;
        let p = this.paths.get(k);
        if (!p || p.age > PATH_TTL_S) {
          p = { path: flowPath(blockAt, f.from, f.to, this.source.mirrorLink), age: 0 };
          this.paths.set(k, p);
        }
        const hex = aspectHex(f.aspect);
        if (p.path) this.tubeStream(p.path, hex);
        else this.airStream(f, hex);
      }
    }
    for (const [k, p] of this.paths) if ((p.age += LIQUID_INTERVAL_S) > PATH_TTL_S * 3) this.paths.delete(k);
    // Crucibles: tinted water, boiling over heat, flecks of every aspect, a draught's swirl.
    if (this.source) for (const c of this.source.crucibleViews()) if (near(c.x, c.z)) this.crucible(c);
    L.end();
    this.stats.liquids = L.count;
    this.stats.streams = streams;
  }

  /** A stream along the tube cells from a jar to its consumer: one box per leg, running the way the essentia goes. */
  private tubeStream(path: readonly Cell[], hex: number): void {
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i];
      const b = path[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) !== 1) continue; // a mirror jump
      // From inside the jar's glass at the start; up to the face of the consumer at the end.
      const s = i === 0 ? 0.24 : 0;
      const e = i + 2 === path.length ? 0.5 : 1;
      const len = e - s;
      const mid = s + len / 2;
      const cx = a[0] + 0.5 + dx * mid;
      const cy = a[1] + 0.5 + dy * mid;
      const cz = a[2] + 0.5 + dz * mid;
      const c = this.lit(hex, cx, cy, cz, 0.5);
      this.liquids.add(cx, dy ? cy - len / 2 : cy - STREAM_W / 2, cz, dx ? len : STREAM_W, dy ? len : STREAM_W, dz ? len : STREAM_W, c, {
        flow: [dx, dy, dz], speed: 1.4, glow: 0.5,
      });
    }
  }

  /** A thin stream arcing through the air from the top of a jar to just above its consumer (an altar's heart item). */
  private airStream(f: EssentiaFlow, hex: number): void {
    const [jx, jy, jz] = f.from;
    const [tx, ty, tz] = f.to;
    const pts = arcRoute(jx + 0.5, jy + 0.9, jz + 0.5, tx + 0.5, ty + 1.3, tz + 0.5, 0.35);
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay, az] = pts[i];
      const [bx, by, bz] = pts[i + 1];
      const ly = Math.abs(by - ay);
      const c = this.lit(hex, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, 0.9);
      const w = ARC_W;
      // Legs overlap by a stream's width at the corners so the bends close.
      this.liquids.add((ax + bx) / 2, ly ? Math.min(ay, by) - w / 2 : ay - w / 2, (az + bz) / 2, Math.abs(bx - ax) + w, ly + w, Math.abs(bz - az) + w, c, {
        flow: [bx - ax, by - ay, bz - az], speed: 1.8, glow: 0.8,
      });
    }
  }

  private crucible(v: CrucibleView): void {
    const L = this.liquids;
    const cx = v.x + 0.5;
    const cz = v.z + 0.5;
    const top = v.y + 1;
    let total = 0;
    for (const n of Object.values(v.ess)) total += n ?? 0;
    const fill = Math.min(1, total / CRUCIBLE_CAP);
    const boil = v.hot ? 0.35 + 0.45 * fill : 0;
    // The water's face sits just proud of the block top (the rim) and the shader's slosh only dips down from it, so a boil
    // never lifts the surface above the rim. The body runs down into the block so the dip never shows a gap at the edge.
    const hex = v.potion !== null ? mixHex(crucibleColour(v.ess, WATER, CRUCIBLE_CAP), v.potion, 0.7) : crucibleColour(v.ess, WATER, CRUCIBLE_CAP);
    const { bottom, level } = crucibleSurface(top);
    L.add(cx, bottom, cz, 0.64, level - bottom, 0.64, this.lit(hex, cx, top + 0.2, cz, 0.1 + 0.2 * fill), {
      flow: v.potion !== null ? [-0.5, 0, 1] : [1, 0, 0.5], speed: v.hot ? 0.35 : 0.06, boil, surface: true, glow: (v.potion !== null ? 0.2 : 0.05) + 0.2 * fill,
    });
    // Flecks of the richest aspects circling the surface, two rings turning opposite ways.
    let n = 0;
    for (const a in v.ess) if ((v.ess[a as Aspect] ?? 0) > 0 && n < 6) this.fleck(cx, level, cz, a as Aspect, n++, Object.keys(v.ess).length, boil);
  }

  /** A fleck lies on the surface: its box ends at the level, so it never rises past the rim either. */
  private fleck(cx: number, level: number, cz: number, a: Aspect, i: number, of: number, boil: number): void {
    const hex = aspectHex(a);
    const n = Math.min(6, of);
    for (let r = 0; r < 2; r++) {
      const ang = this.clock * 0.6 * (r ? -0.7 : 1) + (i / n) * Math.PI * 2 + r * 1.3;
      const rad = r ? 0.12 : 0.23;
      const fx = cx + Math.cos(ang) * rad;
      const fz = cz + Math.sin(ang) * rad;
      this.liquids.add(fx, level - 0.016, fz, 0.05, 0.016, 0.05, this.lit(hex, fx, level + 0.2, fz, 0.6), { glow: 0.6, boil: boil * 0.5 });
    }
  }

  dispose(): void {
    this.items.dispose();
    this.scene.scene.remove(this.group);
    this.liquids.dispose();
    this.nodeGeo.dispose();
    this.haloGeo.dispose();
    this.humGeo.dispose();
    for (const m of this.materials.values()) m.dispose();
  }
}
