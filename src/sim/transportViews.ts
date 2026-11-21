/**
 * What transport shows (spec 16.3): the pipe screen's view of a pipe's network and its ports, each with a status that
 * always says why it is idle; and the render snapshot - every packet in flight with its path and how far along it is,
 * and every fluid network's fill - so the renderer only interpolates.
 */
import { PIPE_MAX_PACKETS } from '../core/constants';
import { fluid as fluidSpec, itemOrNull, MACHINES } from '../core/registry';
import type { FluidKey } from '../core/types';
import { FluidNet } from './fluidNet';
import { ItemNet } from './itemNet';
import type { Joint, JointReason, PipeNet, Port } from './pipeNet';
import { cellKey, type Distribution, type Family, type FilterMode, type PortMode } from './pipeState';
import type { Transport } from './transport';

const machineOrNull = (kind: string) => MACHINES.get(kind) ?? null;

export interface PortView {
  /** The pipe, and the direction (Face) of the block it touches. */
  x: number;
  y: number;
  z: number;
  dir: number;
  /** The endpoint block: position, key, name, and the item to draw as its icon. */
  ex: number;
  ey: number;
  ez: number;
  block: string;
  name: string;
  icon: string;
  mode: PortMode;
  distribution: Distribution;
  filter: string[];
  filterMode: FilterMode;
  priority: number;
  /** "Moving 4 every 2 s", "No destination", "Destination full", "Too hot for this pipe", "Blocked", ... */
  status: string;
  /** It moved something lately. */
  moving: boolean;
  /** Item packets waiting at this end. */
  blocked: number;
  /** Beyond the network's caps: shown, never used ("Network too long"). */
  inert: boolean;
  /** What this end can move: "4 every 2 s" or "200 L/s". */
  rate: string;
  /** Blocks from the pipe the view was asked for (the list is sorted by it). */
  distance: number;
}

export interface JointView {
  x: number;
  y: number;
  z: number;
  dir: number;
  reason: JointReason;
  text: string;
}

export interface PipeNetView {
  id: number;
  family: Family;
  pipes: number;
  /** Pipes beyond PIPE_MAX_PIPES, and ports beyond PIPE_MAX_PORTS: inert. */
  inertPipes: number;
  ports: number;
  inertPorts: number;
  /** Fluid networks: every pipe is a hot pipe. */
  hot: boolean;
  /** What it holds, or what flows through it right now (a network that passes everything on holds nothing). */
  fluid: FluidKey | null;
  fluidName: string | null;
  litres: number;
  capacityL: number;
  /** litres / capacity, 0..1. */
  fill: number;
  /** Item networks: packets in flight (and waiting), items in them, the cap. */
  packets: number;
  items: number;
  maxPackets: number;
  warnings: string[];
}

export interface PipeView {
  x: number;
  y: number;
  z: number;
  block: string;
  name: string;
  family: Family;
  network: PipeNetView;
  /** Every port of the network, nearest to this pipe first. */
  ports: PortView[];
  /** Joints of the network that are not joined (parted, different fluids, too hot). */
  joints: JointView[];
}

/** One packet for the renderer: follow `points` (xyz world coordinates) for `along` of its `length` blocks. */
export interface PacketRender {
  item: string;
  count: number;
  points: Float32Array;
  length: number;
  along: number;
  /** Blocks per second right now, to extrapolate between ticks (0 while waiting). */
  speed: number;
  blocked: boolean;
}

/** One fluid network for the renderer: its fluid and fill, and its pipes as xyz triples. */
export interface FluidRender {
  fluid: FluidKey;
  colour: number;
  glow: boolean;
  fill: number;
  litres: number;
  capacityL: number;
  cells: Int32Array;
}

export interface TransportRender {
  /** Transport tick it was taken at (the same object is returned within one tick). */
  tick: number;
  packets: PacketRender[];
  fluids: FluidRender[];
}

const fmtS = (s: number): string => `${Number.isInteger(s) ? s : s.toFixed(1)} s`;
const fmtL = (l: number): string => `${Math.round(l).toLocaleString('en-US')} L`;
const itemName = (key: string | null): string => (key ? itemOrNull(key)?.name ?? key : 'it');
const fluidName = (key: string | null): string => (key ? fluidSpec(key as FluidKey).name : 'it');
/** Seconds a pushing end counts as "receiving" after its last delivery. */
const RECENT_S = 3;

const JOINT_TEXT: Record<JointReason, string> = {
  cut: 'Parted with the wrench',
  mismatch: 'The pipes hold different fluids',
  hot: 'Too hot for this pipe',
};

function noEndpoint(port: Port): string {
  return port.block.key === 'item_hatch' || port.block.key === 'fluid_hatch' ? 'The hearth is not formed' : 'Not connected';
}

function itemStatus(t: Transport, net: ItemNet, port: Port): string {
  const blocked = net.blockedAt(port);
  if (blocked > 0) return 'Blocked';
  if (port.cfg.mode === 'off') return 'Off';
  if (!t.itemEndpointOf(port)) return noEndpoint(port);
  if (port.cfg.mode === 'push') {
    if (t.time - port.at < RECENT_S) return `Receiving ${itemName(port.subject)}`;
    return port.state === 'full' ? 'Destination full' : 'Ready';
  }
  switch (port.state) {
    case 'moving':
      return `Moving ${port.last} every ${fmtS(1 / port.rate)}`;
    case 'no_dest':
      return 'No destination';
    case 'dest_full':
      return 'Destination full';
    case 'empty':
      return 'Nothing to pull';
    case 'cap':
      return 'Pipes are full - waiting';
    case 'no_endpoint':
      return noEndpoint(port);
    default:
      return 'Waiting';
  }
}

/** The fluid the endpoint of a port holds to hand out and does not take in itself (a boiler's steam), or null. */
function givesOnly(t: Transport, port: Port): FluidKey | null {
  const ep = t.fluidEndpointOf(port);
  const offer = ep?.offer() ?? null;
  if (!ep || !offer || offer.litres <= 0) return null;
  const accepts = machineOrNull(ep.entity.kind)?.fluids?.accepts ?? [];
  return accepts.includes(offer.fluid) ? null : offer.fluid;
}

/** How the fluid pipes reach a block: whether any touch it, any of those networks pulls at all, and any end pulls from it. */
export interface FluidLinks {
  piped: boolean;
  netPulls: boolean;
  pullsHere: boolean;
}

/**
 * The fluid pipe ends (not switched off) touching the block at x, y, z: by default only hot pipes count (steam only
 * moves through them: the boiler's and the turbine's status); `hotOnly` false counts every fluid pipe (the pump's).
 * Views only: walks every fluid network.
 */
export function fluidLinksAt(t: Transport, x: number, y: number, z: number, hotOnly = true): FluidLinks {
  t.refresh();
  const links: FluidLinks = { piped: false, netPulls: false, pullsHere: false };
  for (const net of t.fluids) {
    let touches = false;
    for (const p of net.ports) {
      if (p.ex !== x || p.ey !== y || p.ez !== z || p.cfg.mode === 'off') continue;
      touches = true;
      if (p.cfg.mode === 'pull') links.pullsHere = true;
    }
    if (!touches || (hotOnly && !net.hot)) continue;
    links.piped = true;
    if (net.ports.some((p) => p.cfg.mode === 'pull')) links.netPulls = true;
  }
  return links;
}

function fluidStatus(t: Transport, net: FluidNet, port: Port): string {
  if (port.cfg.mode === 'off') return 'Off';
  if (!t.fluidEndpointOf(port)) return noEndpoint(port);
  const moving = `Moving ${fmtL(port.rateL > 0 ? port.rateL : port.rate)}/s`;
  const held = net.store.fluid;
  if (port.cfg.mode === 'pull') {
    switch (port.state) {
      case 'moving':
        return moving;
      case 'too_hot':
        return 'Too hot for this pipe';
      case 'other_fluid':
        return `The pipes hold ${fluidName(port.subject)}`;
      case 'filtered':
        return `Filter blocks ${fluidName(port.subject)}`;
      case 'no_dest':
        return 'No destination';
      case 'dest_full':
        return 'Destination full';
      case 'no_endpoint':
        return noEndpoint(port);
      case 'empty':
        return 'Nothing to pull';
      default:
        return 'Waiting';
    }
  }
  if (port.state === 'no_endpoint') return noEndpoint(port);
  // A block that only hands this fluid out (a boiler's steam) at an end that pushes, with nothing pulling anywhere.
  const out = givesOnly(t, port);
  if (out && port.rateL <= 0 && !net.ports.some((p) => p.cfg.mode === 'pull')) return `Holds ${fluidName(out).toLowerCase()} - set this end to Pull`;
  switch (port.state) {
    case 'moving':
      return port.rateL > 0 ? moving : 'Waiting for fluid';
    case 'full':
      return 'Destination full';
    case 'refuses':
      return `Does not take ${fluidName(port.subject)}`;
    case 'filtered':
      return `Filter blocks ${fluidName(port.subject)}`;
    default:
      return held ? 'Waiting' : 'Waiting for fluid';
  }
}

function portView(t: Transport, net: PipeNet, port: Port, inert: boolean, from: { x: number; y: number; z: number }): PortView {
  const status = inert
    ? 'Network too long'
    : net instanceof ItemNet ? itemStatus(t, net, port) : fluidStatus(t, net as FluidNet, port);
  const rate = net instanceof ItemNet ? `${port.batch} every ${fmtS(1 / port.rate)}` : `${fmtL(port.rate)}/s`;
  const moving = !inert && (net instanceof ItemNet ? t.time - port.at < RECENT_S : port.rateL > 0);
  return {
    x: port.x, y: port.y, z: port.z, dir: port.dir, ex: port.ex, ey: port.ey, ez: port.ez,
    block: port.block.key, name: port.block.name, icon: port.block.itemKey ?? port.block.key,
    mode: port.cfg.mode, distribution: port.cfg.distribution, filter: [...port.cfg.filter], filterMode: port.cfg.filterMode,
    priority: port.cfg.priority, status, moving, blocked: net instanceof ItemNet ? net.blockedAt(port) : 0, inert, rate,
    distance: Math.hypot(port.x - from.x, port.y - from.y, port.z - from.z),
  };
}

export function netView(t: Transport, net: PipeNet): PipeNetView {
  const warnings: string[] = [];
  if (net.overflow.length > 0) warnings.push(`Network too long - ${net.size} of ${net.size + net.overflow.length} pipes work`);
  if (net.extraPorts.length > 0) warnings.push(`Too many ends - ${net.extraPorts.length} do nothing`);
  const fluid = net instanceof FluidNet ? net.store : null;
  const flowing = net instanceof FluidNet ? fluid?.fluid ?? (t.time - net.busyAt < 1 ? net.lastFluid : null) : null;
  const items = net instanceof ItemNet ? net.packets : [];
  if (items.length >= PIPE_MAX_PACKETS) warnings.push('Pipes are full - pulling waits');
  if (fluid && net.joints.some((j) => j.reason === 'mismatch')) warnings.push('Touches pipes holding another fluid');
  const capacity = net instanceof FluidNet ? net.capacity : 0;
  return {
    id: net.id, family: net.family, pipes: net.size, inertPipes: net.overflow.length, ports: net.ports.length,
    inertPorts: net.extraPorts.length, hot: net.hot, fluid: flowing, fluidName: flowing ? fluidSpec(flowing).name : null,
    litres: fluid?.litres ?? 0, capacityL: capacity, fill: capacity > 0 && fluid ? Math.min(1, fluid.litres / capacity) : 0,
    packets: items.length, items: items.reduce((n, p) => n + p.rec.count, 0), maxPackets: PIPE_MAX_PACKETS, warnings,
  };
}

const jointView = (j: Joint): JointView => ({ x: j.x, y: j.y, z: j.z, dir: j.dir, reason: j.reason, text: JOINT_TEXT[j.reason] });

/** The pipe screen of the pipe at x, y, z, or null when there is none. */
export function pipeView(t: Transport, x: number, y: number, z: number): PipeView | null {
  const net = t.netAt(x, y, z);
  const def = t.graph.cellNet.has(cellKey(x, y, z)) ? t.blockAt(x, y, z) : null;
  if (!net || !def || !def.pipe) return null;
  const from = { x, y, z };
  const ports = [
    ...net.ports.map((p) => portView(t, net, p, false, from)),
    ...net.extraPorts.map((p) => portView(t, net, p, true, from)),
  ].sort((a, b) => a.distance - b.distance);
  return { x, y, z, block: def.key, name: def.name, family: def.pipe.family, network: netView(t, net), ports, joints: net.joints.map(jointView) };
}

/** Builds the render snapshot at most once per transport tick, reusing its objects. */
export class TransportRenderer {
  private readonly snap: TransportRender = { tick: -1, packets: [], fluids: [] };
  private readonly cells = new WeakMap<PipeNet, Int32Array>();

  constructor(private readonly t: Transport) {}

  view(): TransportRender {
    const t = this.t;
    t.refresh();
    const s = this.snap;
    if (s.tick === t.ticks) return s;
    s.tick = t.ticks;
    let n = 0;
    for (const net of t.items) {
      for (const p of net.packets) {
        let r = s.packets[n];
        if (!r) r = s.packets[n] = { item: '', count: 0, points: p.path.points, length: 0, along: 0, speed: 0, blocked: false };
        r.item = p.rec.item;
        r.count = p.rec.count;
        r.points = p.path.points;
        r.length = p.path.length;
        r.along = p.along;
        r.speed = p.speed;
        r.blocked = p.blocked;
        n++;
      }
    }
    s.packets.length = n;
    let f = 0;
    for (const net of t.fluids) {
      const store = net.store;
      if (!store.fluid || store.litres <= 0) continue;
      const spec = fluidSpec(store.fluid);
      let r = s.fluids[f];
      if (!r) r = s.fluids[f] = { fluid: store.fluid, colour: 0, glow: false, fill: 0, litres: 0, capacityL: 0, cells: this.cellsOf(net) };
      r.fluid = store.fluid;
      r.colour = spec.colour;
      r.glow = spec.glow;
      r.litres = store.litres;
      r.capacityL = net.capacity;
      r.fill = net.capacity > 0 ? Math.min(1, store.litres / net.capacity) : 0;
      r.cells = this.cellsOf(net);
      f++;
    }
    s.fluids.length = f;
    return s;
  }

  private cellsOf(net: PipeNet): Int32Array {
    let c = this.cells.get(net);
    if (!c) {
      c = new Int32Array(net.size * 3);
      for (let i = 0; i < net.size; i++) {
        c[i * 3] = net.xs[i];
        c[i * 3 + 1] = net.ys[i];
        c[i * 3 + 2] = net.zs[i];
      }
      this.cells.set(net, c);
    }
    return c;
  }
}

/** Fluid and fill of the pipe at x, y, z (null: no fluid pipe, or empty). */
export function fluidAt(t: Transport, x: number, y: number, z: number): { fluid: FluidKey; fill: number; litres: number } | null {
  const net = t.netAt(x, y, z);
  if (!(net instanceof FluidNet) || !net.store.fluid || net.store.litres <= 0) return null;
  return { fluid: net.store.fluid, fill: net.capacity > 0 ? Math.min(1, net.store.litres / net.capacity) : 0, litres: net.store.litres };
}
