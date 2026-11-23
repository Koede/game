/**
 * Feature visuals part 2 (spec 16, 17.4): items moving through pipes, fluids in pipes and the carrying tint, formed
 * hearths (molten pool, inner glow, halos, smoke, shimmer, formation sweep), the ghost preview and the problem
 * highlight. The Renderer owns one TechLayer and calls update() once per frame before drawing.
 */
import * as THREE from 'three';
import type { GameBus } from '../../core/context';
import type { IWorld } from '../../core/types';
import type { WorldUniforms } from '../materials';
import type { Particles } from '../particles';
import { FormedLayer } from '../formed';
import { CellLight } from './cellLight';
import type { TransportFeed, TransportSource } from './feed';
import { GhostLayer } from './ghosts';
import { HearthLights } from './hearths';
import { BlockHighlight } from './highlight';
import { PacketLayer } from './packets';
import { PipeOverlay } from './pipeOverlay';

export { simTransportFeed, type PacketFeed, type PipeNetFeed, type TransportFeed, type TransportSource } from './feed';

/** What the layer drew last frame (RenderStats.tech). */
export interface TechStats {
  packets: number;
  pipePieces: number;
  hearths: number;
  ghosts: number;
  /** Merged multiblock models drawn (src/render/formed). */
  formed: number;
}

export class TechLayer {
  readonly group = new THREE.Group();
  readonly stats: TechStats = { packets: 0, pipePieces: 0, hearths: 0, ghosts: 0, formed: 0 };
  readonly highlight: BlockHighlight;
  private readonly light: CellLight;
  private readonly packets: PacketLayer;
  private readonly overlay: PipeOverlay;
  private readonly hearths: HearthLights;
  private readonly ghosts: GhostLayer;
  private readonly formed: FormedLayer;
  private readonly frustum = new THREE.Frustum();
  private readonly projView = new THREE.Matrix4();
  private source: TransportSource | null = null;

  constructor(world: IWorld, bus: GameBus, uniforms: WorldUniforms, particles: Particles, canvas: HTMLCanvasElement) {
    // Two new cells a frame (a probe reads ~3400 voxels), one known cell re-probed every frame.
    this.light = new CellLight(world, 2, 1);
    this.packets = new PacketLayer(world, uniforms, this.light);
    this.overlay = new PipeOverlay(world, bus, uniforms, this.light);
    this.hearths = new HearthLights(world, bus, uniforms, particles);
    this.ghosts = new GhostLayer(world, bus, uniforms);
    this.formed = new FormedLayer(world, bus, uniforms);
    this.highlight = new BlockHighlight(bus, canvas);
    this.group.add(this.packets.group, this.overlay.mesh, this.hearths.group, this.formed.group, this.ghosts.group, this.highlight.group);
    this.group.name = 'tech';
  }

  /** Where packets and pipe contents come from (null: draw none). */
  setTransport(source: TransportSource | null): void {
    this.source = source;
  }

  setScale(pixelsPerUnit: number): void {
    this.hearths.setScale(pixelsPerUnit);
  }

  /**
   * One frame. `sky` / `block` (0..1) light anything inside a pipe whose cell is not probed yet; `day` 0 night .. 1 day.
   * Allocation-free once warm.
   */
  update(dt: number, time: number, camera: THREE.PerspectiveCamera, day: number, sky: number, block: number): void {
    const p = camera.position;
    camera.updateMatrixWorld();
    this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);
    const feed: TransportFeed | null = this.source ? this.source.frame() : null;
    this.packets.update(dt, feed, camera, this.frustum, sky, block);
    this.overlay.update(feed, p.x, p.y, p.z, sky, block);
    this.light.update();
    this.hearths.update(dt, time, p.x, p.z, day);
    this.formed.update(dt, p.x, p.z);
    this.ghosts.update(p.x, p.y, p.z);
    this.highlight.update(dt, camera);
    const s = this.stats;
    s.packets = this.packets.drawn;
    s.pipePieces = this.overlay.drawn;
    s.hearths = this.hearths.shown;
    s.ghosts = this.ghosts.shown;
    s.formed = this.formed.stats.models;
  }

  dispose(): void {
    this.packets.dispose();
    this.overlay.dispose();
    this.hearths.dispose();
    this.ghosts.dispose();
    this.formed.dispose();
    this.highlight.dispose();
  }
}
