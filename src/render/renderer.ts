/**
 * The Renderer: owns the WebGL2 canvas, the world scene (sky, chunk meshes, target box, particles) and the
 * first-person hand, and implements IView for the player controller. One render(dt) per frame, allocation-free.
 */
import * as THREE from 'three';
import type { GameBus, IView, Settings } from '../core/context';
import { blockOf } from '../core/registry';
import { CHUNK_SIZE, type IWorld } from '../core/types';
import { createAtlas, type Atlas } from './atlas';
import { ChunkMeshes } from './chunkMeshes';
import { Emitters } from './emitters';
import { Glows } from './glows';
import { HeldItem } from './heldItem';
import { lightColor, LightProbe } from './lightProbe';
import { createChunkMaterials, createWorldUniforms, type ChunkMaterials, type WorldUniforms } from './materials';
import { Particles } from './particles';
import { Sky } from './sky';
import { computeSky, createSkyState, luminance, type SkyState } from './skyModel';
import { TargetBox } from './target';

/** What the renderer needs from the game clock (GameClock satisfies it). */
export interface ClockLike {
  readonly timeOfDay: number;
  sunlight(): number;
}

export interface RenderStats {
  /** Draw calls and triangles of the last frame (world + hand). */
  drawCalls: number;
  triangles: number;
  /** Chunks with a mesh, and triangles across all of them (drawn or culled). */
  chunks: number;
  chunkTriangles: number;
  particles: number;
  /** Smoke and steam sources (hot furnaces, running machines) near the camera. */
  effectSources: number;
  /** CPU milliseconds spent in the last render() call. */
  cpuMs: number;
  pixelRatio: number;
}

/** Colour of full block light: firelight, warm. */
const BLOCK_TINT = new Float32Array([1.0, 0.71, 0.42]);
/** Darkest a surface gets (a sealed cave without a torch). */
const AMBIENT = 0.035;
const CLOUD_RANGE = 330;
const UNDERWATER_FOG = new THREE.Vector3(0.05, 0.2, 0.27);
const LAVA_FOG = new THREE.Vector3(0.75, 0.25, 0.04);
/** How often the light at the eye is re-probed for the held item. */
const PROBE_INTERVAL_S = 0.2;

export class Renderer implements IView {
  readonly canvas: HTMLCanvasElement;
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly stats: RenderStats = { drawCalls: 0, triangles: 0, chunks: 0, chunkTriangles: 0, particles: 0, effectSources: 0, cpuMs: 0, pixelRatio: 1 };
  /** True while the WebGL context is lost (render() does nothing until it is restored). */
  contextLost = false;

  private readonly atlas: Atlas;
  private readonly uniforms: WorldUniforms;
  private readonly materials: ChunkMaterials;
  private readonly chunks: ChunkMeshes;
  private readonly sky = new Sky();
  private readonly skyState: SkyState = createSkyState();
  private readonly target = new TargetBox();
  private readonly particles: Particles;
  private readonly glows = new Glows();
  private readonly emitters: Emitters;
  private readonly held: HeldItem;
  private readonly probe: LightProbe;
  private readonly lightRgb = new Float32Array(3);
  private readonly offs: (() => void)[] = [];
  private readonly resizeObserver: ResizeObserver | null = null;
  private readonly pixelRatioCap: number;
  private time = 0;
  private probeTimer = 0;
  private targetValid = false;
  private targetX = 0;
  private targetY = 0;
  private targetZ = 0;
  private mining = -1;
  private width = 0;
  private height = 0;
  private renderDistance: number;
  private disposed = false;

  constructor(
    private readonly container: HTMLElement,
    private readonly world: IWorld,
    bus: GameBus,
    private readonly clock: ClockLike,
    private readonly settings: Settings,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    const context = this.canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance' });
    if (!context) throw new Error('Hearthwatt needs WebGL2, which this browser or device does not provide.');
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, context, antialias: false });
    // Textures are painted in display space and shaders output display space: no conversion anywhere.
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.gl.autoClear = false;
    this.gl.info.autoReset = false;
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.pixelRatioCap = touch || navigator.maxTouchPoints > 0 ? 1.5 : 2;
    container.prepend(this.canvas);

    this.renderDistance = settings.renderDistance;
    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.06, 1000);
    this.camera.rotation.order = 'YXZ';

    this.atlas = createAtlas();
    this.uniforms = createWorldUniforms(this.atlas.texture);
    this.uniforms.uBlockLight.value.fromArray(BLOCK_TINT);
    this.uniforms.uAmbient.value = AMBIENT;
    this.materials = createChunkMaterials(this.uniforms);
    this.chunks = new ChunkMeshes(bus, this.materials);
    this.particles = new Particles(this.uniforms);
    this.probe = new LightProbe(world);
    this.emitters = new Emitters(bus, world, this.particles, (x, y, z) => this.brightnessAt(x, y, z));
    this.held = new HeldItem(this.atlas.texture);

    this.scene.add(this.sky.dome, this.chunks.group, this.sky.clouds, this.target.group, this.particles.points, this.glows.points);
    this.scene.matrixWorldAutoUpdate = true;
    this.applyDistance();

    this.offs.push(bus.on('settings:changed', () => this.onSettings()));
    const lost = (e: Event): void => {
      e.preventDefault();
      this.contextLost = true;
    };
    const restored = (): void => {
      this.contextLost = false;
    };
    this.canvas.addEventListener('webglcontextlost', lost);
    this.canvas.addEventListener('webglcontextrestored', restored);
    this.offs.push(() => this.canvas.removeEventListener('webglcontextlost', lost));
    this.offs.push(() => this.canvas.removeEventListener('webglcontextrestored', restored));
    if (typeof ResizeObserver === 'function') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    } else {
      const onResize = (): void => this.resize();
      window.addEventListener('resize', onResize);
      this.offs.push(() => window.removeEventListener('resize', onResize));
    }
    this.resize();
  }

  // ---------------------------------------------------------------------------------------------- IView

  setView(x: number, y: number, z: number, yaw: number, pitch: number): void {
    this.camera.position.set(x, y, z);
    this.camera.rotation.set(pitch, yaw, 0);
  }

  setFov(degrees: number): void {
    if (this.camera.fov === degrees) return;
    this.camera.fov = degrees;
    this.camera.updateProjectionMatrix();
    this.updateParticleScale();
  }

  setTarget(target: { x: number; y: number; z: number } | null, mining: number): void {
    if (!target) {
      this.targetValid = false;
      return;
    }
    this.targetValid = true;
    this.targetX = target.x;
    this.targetY = target.y;
    this.targetZ = target.z;
    this.mining = mining;
  }

  setHeldItem(itemKey: string | null): void {
    this.held.set(itemKey);
  }

  triggerSwing(): void {
    this.held.swing();
  }

  // ---------------------------------------------------------------------------------------------- frame

  /** Draws one frame. `dt` in seconds drives animation (water, plants, particles, the hand). */
  render(dt: number): void {
    if (this.disposed || this.contextLost) return;
    const started = performance.now();
    this.time += dt;
    const cam = this.camera;
    if (this.settings.renderDistance !== this.renderDistance) {
      this.renderDistance = this.settings.renderDistance;
      this.applyDistance();
    }

    const sky = computeSky(this.clock.timeOfDay, this.clock.sunlight(), this.skyState);
    const u = this.uniforms;
    u.uTime.value = this.time % 3600;
    u.uSkyLight.value.fromArray(sky.skyLight);
    // Firelight breathes a little: two incommensurate waves, never strobing.
    const flicker = 0.97 + 0.02 * Math.sin(this.time * 6.1) + 0.012 * Math.sin(this.time * 13.7);
    u.uBlockLight.value.set(BLOCK_TINT[0] * flicker, BLOCK_TINT[1] * flicker, BLOCK_TINT[2] * flicker);
    u.uSunDir.value.fromArray(sky.sunDir);
    const submerged = this.applyFog(sky);
    this.sky.update(sky, cam, this.time, CLOUD_RANGE, submerged ? u.uFogColor.value : null);

    if (this.targetValid) {
      const v = this.world.getVoxel(this.targetX, this.targetY, this.targetZ);
      if (blockOf(v).shape === 'none') this.target.hide();
      else this.target.set(this.targetX, this.targetY, this.targetZ, v, this.mining);
    } else this.target.hide();

    this.probeTimer -= dt;
    if (this.probeTimer <= 0) {
      this.probeTimer = PROBE_INTERVAL_S;
      this.probe.probe(cam.position.x, cam.position.y, cam.position.z);
      const c = lightColor(this.probe.sky, this.probe.block, sky.skyLight, BLOCK_TINT, AMBIENT, this.lightRgb);
      this.held.setLight(c[0], c[1], c[2]);
      this.target.setBrightness(luminance(c));
    }

    this.emitters.day = sky.day;
    this.emitters.update(dt, cam.position.x, cam.position.y, cam.position.z, this.glows, this.time);
    const windPhase = this.time * 0.05;
    this.particles.update(dt, 0.7 + Math.sin(windPhase) * 0.4, 0.25 + Math.cos(windPhase * 0.7) * 0.3);
    this.held.update(dt);

    const gl = this.gl;
    gl.info.reset();
    gl.clear();
    gl.render(this.scene, cam);
    gl.clearDepth();
    gl.render(this.held.scene, this.held.camera);

    const s = this.stats;
    s.drawCalls = gl.info.render.calls;
    s.triangles = gl.info.render.triangles;
    s.chunks = this.chunks.count;
    s.chunkTriangles = this.chunks.triangles;
    s.particles = this.particles.count;
    s.effectSources = this.emitters.activeSources;
    s.cpuMs = performance.now() - started;
  }

  /** Matches the drawing buffer to the container's size (also called automatically on resize). */
  resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const ratio = Math.min(window.devicePixelRatio || 1, this.pixelRatioCap);
    if (w === this.width && h === this.height && ratio === this.stats.pixelRatio) return;
    this.width = w;
    this.height = h;
    this.stats.pixelRatio = ratio;
    this.gl.setPixelRatio(ratio);
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.held.setAspect(w / h);
    this.updateParticleScale();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.offs) off();
    this.resizeObserver?.disconnect();
    this.emitters.dispose();
    this.chunks.dispose();
    this.particles.dispose();
    this.glows.dispose();
    this.target.dispose();
    this.sky.dispose();
    this.held.dispose();
    this.materials.dispose();
    this.atlas.texture.dispose();
    this.gl.dispose();
    this.canvas.remove();
  }

  // ---------------------------------------------------------------------------------------------- internals

  private onSettings(): void {
    this.setFov(this.settings.fov);
    if (this.settings.renderDistance !== this.renderDistance) {
      this.renderDistance = this.settings.renderDistance;
      this.applyDistance();
    }
  }

  /** Fog ends just inside the edge of the loaded circle so the world dissolves into the sky instead of ending. */
  private applyDistance(): void {
    const edge = (this.renderDistance + 0.5) * CHUNK_SIZE;
    this.camera.far = Math.max(400, edge + 64);
    this.camera.updateProjectionMatrix();
  }

  /** Sets the fog for the camera's surroundings; true when the camera is inside a liquid. */
  private applyFog(sky: SkyState): boolean {
    const u = this.uniforms;
    const p = this.camera.position;
    const inside = blockOf(this.world.getVoxel(p.x, p.y, p.z)).liquid;
    if (inside === 'water') {
      const k = 0.25 + 0.75 * luminance(sky.skyLight);
      u.uFogColor.value.copy(UNDERWATER_FOG).multiplyScalar(k);
      u.uFogGlow.value.set(0, 0, 0);
      u.uFog.value.set(1, 20);
      return true;
    } else if (inside === 'lava') {
      u.uFogColor.value.copy(LAVA_FOG);
      u.uFogGlow.value.set(0, 0, 0);
      u.uFog.value.set(0.2, 2.5);
      return true;
    } else {
      const edge = (this.renderDistance + 0.5) * CHUNK_SIZE - 6;
      u.uFogColor.value.fromArray(sky.horizon);
      u.uFogGlow.value.fromArray(sky.glow);
      u.uFog.value.set(edge * 0.62, edge);
    }
    return false;
  }

  private brightnessAt(x: number, y: number, z: number): number {
    this.probe.probe(x, y, z);
    const c = lightColor(this.probe.sky, this.probe.block, this.skyState.skyLight, BLOCK_TINT, AMBIENT, this.lightRgb);
    return Math.min(1, luminance(c) * 1.1);
  }

  private updateParticleScale(): void {
    // gl_PointSize is in drawing-buffer pixels.
    const h = (this.height || 1) * this.stats.pixelRatio;
    const scale = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.particles.setScale(scale);
    this.glows.setScale(scale);
  }
}
