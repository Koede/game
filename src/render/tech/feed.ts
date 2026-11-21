/**
 * What the renderer draws of item and fluid transport (spec 16): the packets in flight and the networks that carry
 * something. The renderer only reads these shapes; `simTransportFeed` builds them from the simulation once per tick
 * (sim.transportView() for the packets, the networks themselves for which pipes carry what - a network that passes
 * everything straight through holds 0 L at the end of a tick and is missing from transportView's fluid list).
 */
import { fluid as fluidSpec } from '../../core/registry';
import type { FluidKey } from '../../core/types';
import type { Simulation } from '../../sim';

/** One packet: follow `points` (xyz world vertices) for `along` of its `length` blocks, moving `speed` blocks/s. */
export interface PacketFeed {
  readonly item: string;
  readonly points: Float32Array;
  readonly length: number;
  readonly along: number;
  readonly speed: number;
}

/** One pipe network that carries something right now (its pipes' active bit). */
export interface PipeNetFeed {
  family: 'item' | 'fluid';
  /** The fluid it holds or moved last (fluid networks), else null. */
  fluid: FluidKey | null;
  /** 0xRRGGBB of the fluid (0 for item networks). */
  colour: number;
  /** The fluid glows (lava). */
  glow: boolean;
  /** Litres held / capacity, 0..1. */
  fill: number;
  /** Fluid moved through it within the last second. */
  flowing: boolean;
  /** Pipe positions: xs[i], ys[i], zs[i] for i < size (the arrays may be longer and are replaced on rebuilds). */
  xs: Int32Array;
  ys: Int32Array;
  zs: Int32Array;
  size: number;
}

export interface TransportFeed {
  /** Changes every simulation tick (packets are interpolated from here). */
  readonly tick: number;
  readonly packets: ArrayLike<PacketFeed>;
  /** Carrying networks: the first `netCount` entries (the pool behind it is reused). */
  readonly nets: ArrayLike<PipeNetFeed>;
  readonly netCount: number;
}

/** The renderer asks this once per frame. */
export interface TransportSource {
  frame(): TransportFeed;
}

/** Seconds after its last movement a fluid network still counts as flowing (the sim's own active-bit hold). */
const FLOW_HOLD_S = 1;

interface MutableFeed {
  tick: number;
  packets: ArrayLike<PacketFeed>;
  nets: PipeNetFeed[];
  netCount: number;
}

/** Adapts a Simulation (DOM-free, its own snapshot objects reused) to what the renderer draws. Allocation-free per tick once warm. */
export function simTransportFeed(sim: Simulation): TransportSource {
  const feed: MutableFeed = { tick: -1, packets: [], nets: [], netCount: 0 };
  const empty = new Int32Array(0);
  return {
    frame(): TransportFeed {
      const view = sim.transportView();
      if (view.tick === feed.tick) return feed;
      feed.tick = view.tick;
      feed.packets = view.packets;
      const t = sim.transport;
      const nets = feed.nets;
      let n = 0;
      const slot = (): PipeNetFeed => {
        let r = nets[n];
        if (!r) r = nets[n] = { family: 'item', fluid: null, colour: 0, glow: false, fill: 0, flowing: false, xs: empty, ys: empty, zs: empty, size: 0 };
        n++;
        return r;
      };
      for (const net of t.items) {
        if (!net.carrying) continue;
        const r = slot();
        r.family = 'item';
        r.fluid = null;
        r.colour = 0;
        r.glow = false;
        r.fill = 0;
        r.flowing = net.packets.length > 0;
        r.xs = net.xs;
        r.ys = net.ys;
        r.zs = net.zs;
        r.size = net.size;
      }
      for (const net of t.fluids) {
        if (!net.carrying) continue;
        const key = net.store.fluid ?? net.lastFluid;
        if (!key) continue;
        const spec = fluidSpec(key);
        const r = slot();
        r.family = 'fluid';
        r.fluid = key;
        r.colour = spec.colour;
        r.glow = spec.glow;
        r.fill = net.capacity > 0 ? Math.min(1, net.store.litres / net.capacity) : 0;
        r.flowing = t.time - net.busyAt < FLOW_HOLD_S;
        r.xs = net.xs;
        r.ys = net.ys;
        r.zs = net.zs;
        r.size = net.size;
      }
      feed.netCount = n;
      return feed;
    },
  };
}
