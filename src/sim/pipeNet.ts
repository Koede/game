/**
 * One pipe network as the transport simulation sees it (spec 16.4): its pipes (local indices into flat arrays), the
 * joints between them, its ports (pipe ends touching endpoints) and what it reports. The item and fluid networks
 * extend it with what they carry. Built by src/sim/pipeGraph.ts, only when pipes or endpoints are placed or removed.
 */
import type { BlockDef } from '../core/types';
import type { Family, PipeEntity, PortConfig } from './pipeState';

/** Why two touching pipes of one family are not joined. */
export type JointReason = 'cut' | 'mismatch' | 'hot';

export interface Joint {
  /** Cell key and position of this network's pipe, and the direction of the other pipe. */
  key: number;
  x: number;
  y: number;
  z: number;
  dir: number;
  reason: JointReason;
}

/** What a port did last (the view turns it into words). */
export type PortState =
  | 'idle'
  | 'moving'
  | 'no_dest'
  | 'dest_full'
  | 'empty'
  | 'cap'
  | 'no_endpoint'
  | 'too_hot'
  | 'other_fluid'
  | 'filtered'
  | 'refuses'
  | 'full'
  | 'waiting';

/** Distances and next hops towards one pipe of a network (breadth-first over its joints). */
export interface Reach {
  dist: Int32Array;
  next: Int32Array;
}

export class Port {
  /** Seconds until a pulling port may fire again (item pipes). */
  cool = 0;
  state: PortState = 'idle';
  /** Items in its last transfer, and the network time it happened (item pipes). */
  last = 0;
  at = -Infinity;
  /** Round-robin pointer over the destinations of a pulling port. */
  rr = 0;
  /** Litres moved this second, and in the last full second (fluid pipes). */
  litres = 0;
  rateL = 0;
  /** The fluid or item it last dealt with (for status words). */
  subject: string | null = null;
  reach: Reach | null = null;
  /** Cached endpoint and the transport generation it was resolved at. */
  ep: unknown = null;
  epGen = -1;

  constructor(
    readonly id: number,
    /** Local index of its pipe in the network. */
    readonly pipe: number,
    readonly key: number,
    readonly x: number,
    readonly y: number,
    readonly z: number,
    /** Direction (Face) from the pipe to the endpoint block. */
    readonly dir: number,
    /** The endpoint block when the network was built. */
    readonly block: BlockDef,
    /** Live settings: the entity's own object once saved, else a default kept here. */
    public cfg: PortConfig,
    public saved: boolean,
    /** The numbers of the pipe this end belongs to. */
    readonly rate: number,
    readonly batch: number,
  ) {}

  get ex(): number {
    return this.x + (this.dir === 0 ? 1 : this.dir === 1 ? -1 : 0);
  }
  get ey(): number {
    return this.y + (this.dir === 2 ? 1 : this.dir === 3 ? -1 : 0);
  }
  get ez(): number {
    return this.z + (this.dir === 4 ? 1 : this.dir === 5 ? -1 : 0);
  }
}

export class PipeNet {
  id = 0;
  /** Active pipes: cell keys in local-index order, and their positions. */
  keys: number[] = [];
  readonly index = new Map<number, number>();
  xs = new Int32Array(0);
  ys = new Int32Array(0);
  zs = new Int32Array(0);
  /** Six neighbour local indices per pipe (-1: none or not joined). */
  adj = new Int32Array(0);
  /** Item pipes: travel speed in blocks per second. Fluid pipes: litres each adds to the capacity. */
  value = new Float32Array(0);
  /** Pipes beyond PIPE_MAX_PIPES: part of the run but inert ("Network too long"). */
  overflow: number[] = [];
  ports: Port[] = [];
  /** Ports beyond PIPE_MAX_PORTS, or on inert pipes: shown, never used. */
  extraPorts: Port[] = [];
  joints: Joint[] = [];
  /** Chunk columns the build could not look into (not loaded yet): loading one rebuilds the network. */
  readonly frontier = new Set<number>();
  /** The pipe entity holding this network's saved content, or null when it has none to keep. */
  anchor: PipeEntity | null = null;
  /** Every pipe may carry hot fluids. */
  hot = true;
  /** The active bit currently written on its pipes. */
  carrying = false;
  /** Network time of the last moment it carried something (item networks keep the bit a little longer). */
  busyAt = -Infinity;
  /** A joint was refused because of what a network held (fluids): running dry rebuilds it so the joint can close. */
  refused = false;

  constructor(readonly family: Family) {}

  get size(): number {
    return this.keys.length;
  }

  /** Breadth-first distances and next hops towards a pipe, computed once per pipe and network. */
  reach(port: Port): Reach {
    if (port.reach) return port.reach;
    const n = this.keys.length;
    const dist = new Int32Array(n).fill(-1);
    const next = new Int32Array(n).fill(-1);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    dist[port.pipe] = 0;
    queue[tail++] = port.pipe;
    const adj = this.adj;
    while (head < tail) {
      const a = queue[head++];
      const d = dist[a] + 1;
      for (let k = a * 6, end = k + 6; k < end; k++) {
        const b = adj[k];
        if (b < 0 || dist[b] >= 0) continue;
        dist[b] = d;
        next[b] = a;
        queue[tail++] = b;
      }
    }
    port.reach = { dist, next };
    return port.reach;
  }

  /** The port with this id, or null. */
  port(id: number): Port | null {
    for (const p of this.ports) if (p.id === id) return p;
    return null;
  }
}
