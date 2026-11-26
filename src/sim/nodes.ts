/**
 * The simulation's runtime bookkeeping: one SimNode per tracked block entity, grouped the way the tick walks
 * them, plus the power networks and which of both must be refreshed after the world changed.
 */
import { voxelActive, type IWorld } from '../core/types';
import { createNode, isFurnace, type SimEntity, type SimNode } from './entities';
import { fissionPile } from './fission';
import { fluidBehaviour } from './fluidMachines';
import { behaviourOf, type Behaviour } from './machines';
import { buildNetworks, chunkKey, type Network } from './power';
import { concerns, nearChunk, surroundings, type ShellOwner } from './surroundings';

export class NodeSet {
  readonly all: SimNode[] = [];
  readonly furnaces: SimNode[] = [];
  /** Every node except furnaces and crates, with its behaviour at the same index. */
  readonly tickers: SimNode[] = [];
  readonly behaviours: Behaviour[] = [];
  readonly byKey = new Map<string, SimNode>();
  networks: Network[] = [];
  /** Network of every cable position, refilled with the networks. */
  readonly cableNets = new Map<string, Network>();
  private envDirty = true;
  private topologyDirty = true;
  /** Formed hearths: links between a controller and its power ports, and the furnace each shell block stands for. */
  links: ReadonlyMap<string, readonly number[]> | null = null;
  shellOwner: ShellOwner | null = null;

  constructor(private readonly world: IWorld) {}

  clear(): void {
    this.all.length = 0;
    this.furnaces.length = 0;
    this.tickers.length = 0;
    this.behaviours.length = 0;
    this.byKey.clear();
    this.networks = [];
    this.cableNets.clear();
    this.envDirty = true;
    this.topologyDirty = true;
  }

  track(e: SimEntity): SimNode {
    const node = createNode(e);
    node.active = voxelActive(this.world.getVoxel(e.x, e.y, e.z));
    this.all.push(node);
    this.byKey.set(node.key, node);
    if (isFurnace(e)) this.furnaces.push(node);
    else if (e.kind !== 'crate') {
      this.tickers.push(node);
      this.behaviours.push(fluidBehaviour(e.kind) ?? (e.kind === 'fission_pile' ? fissionPile : behaviourOf(e.kind)));
    }
    this.envDirty = true;
    return node;
  }

  untrack(node: SimNode): void {
    this.byKey.delete(node.key);
    this.all.splice(this.all.indexOf(node), 1);
    const f = this.furnaces.indexOf(node);
    if (f >= 0) this.furnaces.splice(f, 1);
    const t = this.tickers.indexOf(node);
    if (t >= 0) {
      this.tickers.splice(t, 1);
      this.behaviours.splice(t, 1);
    }
  }

  /** A block changed at x,y,z: refresh the nodes it concerns; `power` when a power block came or went, `shared` the shared generator kind that did. */
  blockChanged(x: number, y: number, z: number, power: boolean, shared: string | null): void {
    if (power) this.topologyDirty = true;
    for (const n of this.all) {
      if (n.dirty || !concerns(n, x, y, z, shared)) continue;
      n.dirty = true;
      this.envDirty = true;
    }
  }

  /** A chunk column arrived or left: only machines in or beside it, and networks reaching it, can change. */
  chunkChanged(cx: number, cz: number): void {
    for (const n of this.all) {
      if (!nearChunk(n, cx, cz)) continue;
      n.dirty = true;
      this.envDirty = true;
      this.topologyDirty = true;
    }
    if (this.topologyDirty) return;
    for (const net of this.networks) {
      const c = net.chunks;
      if (c.has(chunkKey(cx, cz)) || c.has(chunkKey(cx + 1, cz)) || c.has(chunkKey(cx - 1, cz)) || c.has(chunkKey(cx, cz + 1)) || c.has(chunkKey(cx, cz - 1))) {
        this.topologyDirty = true;
        return;
      }
    }
  }

  /**
   * A formed hearth changed within [min, max]: what touches its shell sees a different furnace, and its power ports
   * link differently.
   */
  shellChanged(min: readonly number[], max: readonly number[]): void {
    this.topologyDirty = true;
    for (const n of this.all) {
      const { x, y, z } = n.e;
      if (x < min[0] - 1 || x > max[0] + 1 || y < min[1] - 1 || y > max[1] + 1 || z < min[2] - 1 || z > max[2] + 1) continue;
      n.dirty = true;
      this.envDirty = true;
    }
  }

  /** Brings surroundings and networks up to date with the blocks, if anything changed. */
  fresh(): void {
    if (this.envDirty) {
      for (const n of this.all) {
        if (!n.dirty) continue;
        surroundings(this.world, this.byKey, this.tickers, n, this.shellOwner);
        n.dirty = false;
      }
      this.envDirty = false;
    }
    if (this.topologyDirty) {
      this.networks = buildNetworks(this.world, this.all, this.byKey, this.networks, this.cableNets, this.links);
      this.topologyDirty = false;
    }
  }
}
