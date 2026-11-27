/**
 * The Renderer: owns the WebGL2 canvas, the world scene (sky, chunk meshes, target box, particles) and the
 * first-person hand, and implements IView for the player controller. One render(dt) per frame, allocation-free.
 */
import { ResolutionGovernor } from './resolutionGovernor';
import * as THREE from 'three';
import { HeatView } from './heatView';
import { STAR_TURNS_PER_DAY } from '../core/constants';
import type { GameBus, IView, Settings } from '../core/context';
import { blockOf } from '../core/registry';
import { CHUNK_SIZE, type IWorld, type WeatherState } from '../core/types';
import { createAtlas, type Atlas } from './atlas';
import { ChunkMeshes } from './chunkMeshes';
import { BrewFx } from './brewFx';
import { BrewLiquid } from './brewLiquid';
import { DistillFx } from './distill/distillFx';
import { Emitters } from './emitters';
import { heldGlowOf } from '../game/legendary';
import { HandParts } from './handwork/handParts';
import { MachineParts } from './machines';
import { Glows } from './glows';
import { HeldItem } from './heldItem';
import { lightColor, LightProbe } from './lightProbe';
import { createChunkMaterials, createWorldUniforms, type ChunkMaterials, type WorldUniforms } from './materials';
import { Particles, type ParticleSpec } from './particles';
import { PRECIP_MAX_DESKTOP, PRECIP_MAX_TOUCH, PrecipitationLayer } from './precipitation';
import { RainMask } from './rainMask';
import { setLiquidRate } from './liquids/liquidBoxes';
import { graphicsProfile } from './quality';
import { Sky, type SkyExtras } from './sky';
import { applyWeather, computeSky, createSkyState, luminance, type SkyState } from './skyModel';
import { TargetBox } from './target';
import type { GridCell } from '../sim';
import { TechLayer, type TechStats, type TransportSource } from './tech';
import { SteamVents } from './vents';
import { WeatherFx } from './weatherFx';

/** What the renderer needs from the game clock (GameClock satisfies it). */
export interface ClockLike {
  readonly timeOfDay: number;
  sunlight(): number;
  /** 1-based day (turns the star field); taken as 1 when missing. */
  readonly day?: number;
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
  /** Rain / snow / dust particles drawn, and CPU milliseconds the weather took in the last frame (roof mask included). */
  precipitation: number;
  /** Animated machines (rotors, wheels, drills...) drawn, and CPU milliseconds their update took. */
  machines: number;
  machinesMs: number;
  weatherMs: number;
  /** Pipe packets, pipe overlay pieces, glowing hearths and ghost cells drawn (spec 16, 17.4), and their CPU time. */
  tech: TechStats;
  techMs: number;
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
/** Roof-mask columns measured per frame at most (a whole new window takes a few frames). */
const MASK_BUDGET = 256;
/** In rain or snow the fog closes in by up to this share; in a dust wind by DUST_FOG. */
const WET_FOG = 0.3;
const DUST_FOG = 0.55;

export class Renderer implements IView {
  readonly canvas: HTMLCanvasElement;
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly stats: RenderStats = {
    drawCalls: 0, triangles: 0, chunks: 0, chunkTriangles: 0, particles: 0, effectSources: 0, cpuMs: 0, pixelRatio: 1, precipitation: 0, weatherMs: 0, machines: 0, machinesMs: 0,
    tech: { packets: 0, pipePieces: 0, hearths: 0, ghosts: 0, formed: 0 }, techMs: 0,
  };
  /** True while the WebGL context is lost (render() does nothing until it is restored). */
  contextLost = false;

  private readonly atlas: Atlas;
  /**
   * The world's shared lighting / fog / time uniforms (updated in render()). Public so extra scene objects
   * (src/render/mobs) can be lit and fogged exactly like the terrain by sharing them.
   */
  readonly uniforms: WorldUniforms;
  private readonly materials: ChunkMaterials;
  private readonly chunks: ChunkMeshes;
  private readonly sky = new Sky();
  private readonly skyState: SkyState = createSkyState();
  private readonly target = new TargetBox();
  private readonly particles: Particles;
  /** Adds one particle (the ambient night critters use it). */
  spawnParticle(p: ParticleSpec): void {
    this.particles.spawn(p);
  }
  private readonly glows = new Glows();
  private readonly emitters: Emitters;
  private heldGlow: readonly [number, number, number] | null = null;
  private readonly brewFx: BrewFx;
  private readonly brewLiquid: BrewLiquid;
  /** Liquids, bubbles, drips and column bands of the glass distillery (two draw calls). */
  private readonly distillFx: DistillFx;
  private readonly handParts: HandParts;
  private readonly machines: MachineParts;
  private readonly tech: TechLayer;
  private readonly vents: SteamVents;
  private readonly held: HeldItem;
  private readonly probe: LightProbe;
  private readonly fx = new WeatherFx();
  private readonly rainMask: RainMask;
  private readonly precipitation: PrecipitationLayer;
  private readonly skyExtras: SkyExtras = { moonPhase: 4, starAngle: 0, flashDir: new THREE.Vector3(0, 0.4, -1), bolt: new THREE.Vector4(), dt: 0 };
  private weather: WeatherState | null = null;
  private readonly lightRgb = new Float32Array(3);
  /** Block-light colour at the last probe (firelight, or a glowcap's cyan nearby). */
  private readonly probeTint = new Float32Array(3);
  private readonly offs: (() => void)[] = [];
  private readonly resizeObserver: ResizeObserver | null = null;
  private readonly pixelRatioCap: number;
  /** Lowers the drawing resolution on a slow phone (touch devices only; `scale` stays 1 elsewhere). */
  private readonly governor = new ResolutionGovernor();
  private readonly adaptive: boolean;
  private lastDrawAt = 0;
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
    this.adaptive = this.pixelRatioCap < 2;
    container.prepend(this.canvas);

    this.renderDistance = settings.renderDistance;
    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.06, 1000);
    this.camera.rotation.order = 'YXZ';

    this.atlas = createAtlas(context.getParameter(context.MAX_ARRAY_TEXTURE_LAYERS) as number);
    this.uniforms = createWorldUniforms(this.atlas.texture, this.atlas.texture2, this.atlas.split);
    this.uniforms.uBlockLight.value.fromArray(BLOCK_TINT);
    this.uniforms.uAmbient.value = AMBIENT;
    this.materials = createChunkMaterials(this.uniforms);
    this.chunks = new ChunkMeshes(bus, this.materials);
    this.particles = new Particles(this.uniforms);
    this.probe = new LightProbe(world);
    this.emitters = new Emitters(bus, world, this.particles, (x, y, z, out) => this.lightAt(x, y, z, out));
    this.vents = new SteamVents(bus, world, this.particles);
    this.brewFx = new BrewFx(world, this.particles);
    this.handParts = new HandParts(world, this.uniforms, bus, this.particles);
    this.brewLiquid = new BrewLiquid(world, (x, y, z, out) => this.lightAt(x, y, z, out));
    this.distillFx = new DistillFx(world, (x, y, z, out) => this.lightAt(x, y, z, out));
    this.held = new HeldItem(this.uniforms);
    this.machines = new MachineParts(world, this.uniforms);
    this.heatView = new HeatView();
    this.tech = new TechLayer(world, bus, this.uniforms, this.particles, this.canvas);
    this.stats.tech = this.tech.stats;
    this.rainMask = new RainMask(world);
    this.precipitation = new PrecipitationLayer(this.rainMask, this.pixelRatioCap < 2 ? PRECIP_MAX_TOUCH : PRECIP_MAX_DESKTOP);

    this.scene.add(this.sky.dome, this.chunks.group, this.sky.clouds, this.target.group, this.particles.points, this.glows.points, this.precipitation.mesh, this.machines.group, this.handParts.group, this.tech.group, this.heatView.mesh, this.brewLiquid.mesh, this.distillFx.group);
    this.applyDistance();

    this.applyColorMode();
    this.offs.push(bus.on('settings:changed', () => this.onSettings()));
    this.offs.push(bus.on('block:placed', () => this.held.bump()));
    this.offs.push(bus.on('weather:lightning', ({ distance, bearing }) => this.fx.lightning(distance, bearing)));
    this.offs.push(bus.on('block:changed', ({ x, z }) => this.rainMask.invalidateColumn(x, z)));
    this.offs.push(bus.on('chunk:meshed', ({ mesh }) => this.rainMask.invalidateChunk(mesh.cx, mesh.cz)));
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
    this.heldGlow = heldGlowOf(itemKey);
    this.held.set(itemKey);
  }

  triggerSwing(): void {
    this.held.swing();
  }

  /**
   * The weather to draw (the Weather's live state object, read every frame), or null for a clear sky with a
   * gibbous moon. Lightning comes from the 'weather:lightning' event.
   */
  setWeather(weather: WeatherState | null): void {
    this.weather = weather;
  }

  /**
   * Where items in pipes and pipe contents come from (spec 16), asked once per frame - `simTransportFeed(sim)` from
   * src/render; null draws none. Formed hearths, ghosts and highlights need nothing: they come from the world and
   * the bus.
   */
  /** The heat view (src/render/heatView.ts): `heatView.setVisible(on)` and `heatView.set(grid)`; the game feeds it. */
  readonly heatView: HeatView;

  setTransport(source: TransportSource | null): void {
    this.tech.setTransport(source);
  }

  /** The power grid overlay (held Grid Meter, or a Grid Monitor close by): the cells to draw, or null for none. */
  setGridOverlay(feed: { tick: number; cells: readonly GridCell[] } | null): void {
    this.tech.setGrid(feed);
  }

  // ---------------------------------------------------------------------------------------------- frame

  /** Skips the first-person hand and held item (postcards and other third-person frames). */
  hideHand = false;

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

    const weatherStarted = performance.now();
    const fx = this.fx;
    fx.update(dt, this.weather);
    const sky = computeSky(this.clock.timeOfDay, this.clock.sunlight(), this.skyState, fx.nightLevel);
    applyWeather(sky, fx.sky);
    const u = this.uniforms;
    const quality = graphicsProfile(this.settings.graphics);
    u.uFx.value = quality.fx;
    setLiquidRate(quality.liquidRate);
    u.uWet.value = fx.wet;
    u.uTime.value = this.time % 3600;
    u.uSkyLight.value.fromArray(sky.skyLight);
    // Firelight breathes a little: two incommensurate waves, never strobing.
    const flicker = 0.97 + 0.02 * Math.sin(this.time * 6.1) + 0.012 * Math.sin(this.time * 13.7);
    u.uBlockLight.value.set(BLOCK_TINT[0] * flicker, BLOCK_TINT[1] * flicker, BLOCK_TINT[2] * flicker);
    u.uSunDir.value.fromArray(sky.sunDir);
    const submerged = this.applyFog(sky);
    const extras = this.skyExtras;
    extras.moonPhase = fx.moonPhase;
    extras.starAngle = (2 * Math.PI * STAR_TURNS_PER_DAY * ((this.clock.day ?? 1) - 1 + this.clock.timeOfDay)) % (2 * Math.PI);
    extras.flashDir.fromArray(fx.flashDir).normalize();
    extras.bolt.fromArray(fx.bolt);
    extras.dt = dt;
    this.sky.update(sky, cam, this.time, CLOUD_RANGE, submerged ? u.uFogColor.value : null, extras);
    this.rainMask.center(cam.position.x, cam.position.z);
    this.rainMask.update(MASK_BUDGET);
    this.precipitation.update(fx.precipitation, fx.amount, fx.sky.storm, fx.windAngle, this.time, cam.position, sky.skyLight, submerged);
    const weatherMs = performance.now() - weatherStarted;

    if (this.targetValid) {
      const v = this.world.getVoxel(this.targetX, this.targetY, this.targetZ);
      if (blockOf(v).shape === 'none') this.target.hide();
      else this.target.set(this.targetX, this.targetY, this.targetZ, v, this.mining);
    } else this.target.hide();

    this.probeTimer -= dt;
    if (this.probeTimer <= 0) {
      this.probeTimer = PROBE_INTERVAL_S;
      this.probe.probe(cam.position.x, cam.position.y, cam.position.z);
      const tint = this.probe.tint(BLOCK_TINT, this.probeTint);
      const c = lightColor(this.probe.sky, this.probe.block, sky.skyLight, tint, AMBIENT, this.lightRgb);
      // A held legendary lights itself: its glow is a floor under the held item's light (no extra light source), so it reads in the dark.
      const g = this.heldGlow;
      this.held.setLight(g ? Math.max(c[0], g[0]) : c[0], g ? Math.max(c[1], g[1]) : c[1], g ? Math.max(c[2], g[2]) : c[2]);
      this.target.setBrightness(luminance(c));
    }

    this.emitters.day = sky.day;
    this.emitters.update(dt, cam.position.x, cam.position.y, cam.position.z, this.glows, this.time);
    this.vents.day = sky.day;
    this.vents.update(dt, cam.position.x, cam.position.y, cam.position.z);
    this.brewFx.day = sky.day;
    this.brewFx.update(dt, cam.position.x, cam.position.z);
    this.brewLiquid.update(dt, cam.position.x, cam.position.z);
    this.distillFx.update(dt, cam.position.x, cam.position.z);
    const machinesStarted = performance.now();
    this.machines.update(dt, cam);
    this.handParts.update(dt, cam);
    const machinesMs = performance.now() - machinesStarted;
    const techStarted = performance.now();
    this.tech.update(dt, this.time, cam, sky.day, this.probe.sky, this.probe.block);
    const techMs = performance.now() - techStarted;
    const windPhase = this.time * 0.05;
    this.particles.update(dt, 0.7 + Math.sin(windPhase) * 0.4, 0.25 + Math.cos(windPhase * 0.7) * 0.3);
    this.held.update(dt);

    if (this.adaptive) {
      const now = performance.now();
      if (dt > 0 && this.lastDrawAt > 0 && this.governor.frame(now - this.lastDrawAt)) this.resize();
      this.lastDrawAt = dt > 0 ? now : 0;
    }

    const gl = this.gl;
    gl.info.reset();
    gl.clear();
    gl.render(this.scene, cam);
    if (!this.hideHand) {
      gl.clearDepth();
      gl.render(this.held.scene, this.held.camera);
    }

    const s = this.stats;
    s.drawCalls = gl.info.render.calls;
    s.triangles = gl.info.render.triangles;
    s.chunks = this.chunks.count;
    s.chunkTriangles = this.chunks.triangles;
    s.particles = this.particles.count;
    s.effectSources = this.emitters.activeSources + this.vents.count + this.brewFx.activeSources;
    s.precipitation = this.precipitation.count;
    s.machines = this.machines.drawn;
    s.machinesMs = machinesMs;
    s.weatherMs = weatherMs;
    s.techMs = techMs;
    s.cpuMs = performance.now() - started;
  }

  /** Matches the drawing buffer to the container's size (also called automatically on resize). */
  resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    const ratio = Math.round(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap) * this.governor.scale * 100) / 100;
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
    this.brewLiquid.dispose();
    this.distillFx.dispose();
    this.vents.dispose();
    this.chunks.dispose();
    this.particles.dispose();
    this.glows.dispose();
    this.target.dispose();
    this.sky.dispose();
    this.precipitation.dispose();
    this.machines.dispose();
    this.handParts.dispose();
    this.tech.dispose();
    this.heatView.dispose();
    this.held.dispose();
    this.materials.dispose();
    this.atlas.texture.dispose();
    this.atlas.texture2?.dispose();
    this.gl.dispose();
    this.canvas.remove();
  }

  // ---------------------------------------------------------------------------------------------- internals

  /** Hands Settings.colorMode to the overlays that draw ramps (heat view, grid overlay). */
  private applyColorMode(): void {
    const mode = this.settings.colorMode ?? 'off';
    this.tech.setColorMode(mode);
    if (this.heatView.colorMode !== mode) {
      this.heatView.colorMode = mode;
      this.heatView.refresh();
    }
  }

  private onSettings(): void {
    this.setFov(this.settings.fov);
    this.applyColorMode();
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
      const fx = this.fx;
      const close = fx.precipitation === 'dust' ? DUST_FOG : fx.precipitation === 'none' ? 0 : WET_FOG;
      const g = graphicsProfile(this.settings.graphics);
      const edge = ((this.renderDistance + 0.5) * CHUNK_SIZE - 6) * g.fogEnd * (1 - close * fx.amount);
      u.uFogColor.value.fromArray(sky.horizon);
      u.uFogGlow.value.fromArray(sky.glow);
      u.uFog.value.set(edge * (g.fogStart - 0.35 * close * fx.amount), edge);
    }
    return false;
  }

  /** Light colour (0..1 per channel) at a point for particles, tinted by firelight or a cool glow like the terrain. */
  private lightAt(x: number, y: number, z: number, out: Float32Array): Float32Array {
    this.probe.probe(x, y, z);
    const tint = this.probe.tint(BLOCK_TINT, this.probeTint);
    const c = lightColor(this.probe.sky, this.probe.block, this.skyState.skyLight, tint, AMBIENT, out);
    for (let i = 0; i < 3; i++) c[i] = Math.min(1, c[i] * 1.1);
    return c;
  }

  private updateParticleScale(): void {
    // gl_PointSize is in drawing-buffer pixels.
    const h = (this.height || 1) * this.stats.pixelRatio;
    const scale = h / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    this.particles.setScale(scale);
    this.glows.setScale(scale);
    this.tech.setScale(scale);
  }
}
