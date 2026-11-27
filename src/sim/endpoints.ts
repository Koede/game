/**
 * Item and fluid endpoints (spec 16.2): what a pipe end touching a block may put in and take out. The transport
 * networks talk to blocks only through these, so the rules of each block live here, next to its slots:
 *
 * - crate: every slot takes and gives;
 * - processors (crusher, still, centrifuge, electrolyzer): their recipe inputs go in, products come out;
 * - fuel generators and the fission pile: their fuels go in, nothing comes out;
 * - bore rig: nothing goes in, its buffer comes out;
 * - drill rig: drill bits go in (slot 0), its buffer comes out;
 * - FURNACE (smart sides): fuel goes to the firebox and smeltables to a working crucible holding the same item or an
 *   empty one (an item that is both - logs, coal - goes to a crucible only when one is already loaded with it);
 *   forge ingredients are refused; out come finished crucible products (locked crucibles too) and containers burned
 *   fuels left in the firebox (the lava bucket's bronze bucket);
 * - item hatch / fluid hatch of a FORMED hearth: proxies for its controller (a hatch of no formed hearth is no
 *   endpoint);
 * - fluids: every machine with MachineSpec.fluids, through its buffers (MachineEntity.fluidIn / fluidOut).
 *
 * Endpoint objects are cached per entity: ask again after a block change rather than keeping one across ticks.
 */
import { fuelOf, machine } from '../core/registry';
import type { BlockEntity, FluidKey, ItemStack, MachineSpec } from '../core/types';
import type { Inventory } from '../game/inventory';
import { isFurnace, stackMax, type FluidStack, type FurnaceEntity, type MachineEntity, type SimEntity } from './entities';
import { crucibleRecipe } from './furnace';
import type { FurnaceStats } from './hearthStats';
import { isProcessor } from './machines';
import type { FurnaceSlots } from './slots';

export interface ItemEndpoint {
  /** The entity that really holds the items (a hatch's controller furnace). */
  readonly entity: BlockEntity;
  /** How many of `item` it would take right now (0: refuses it). Reservations are the caller's business. */
  room(item: string): number;
  /** Puts up to `count` of `item` where its sides send it; returns how many it took. Tools keep `durability`. */
  insert(item: string, count: number, durability?: number): number;
  /** A copy of the first stack it would give that passes `filter`, or null. */
  offer(filter?: (item: string) => boolean): ItemStack | null;
  /** Takes up to `max` of `item` out of the first slot giving it (durability travels along); null when it has none. */
  take(item: string, max: number): ItemStack | null;
}

export interface FluidEndpoint {
  readonly entity: BlockEntity;
  /** Litres of `fluid` it would take right now (0: refuses it). */
  room(fluid: FluidKey): number;
  /** Puts up to `litres` in; returns how many litres it took. */
  fill(fluid: FluidKey, litres: number): number;
  /** What it would give right now (a copy), or null. */
  offer(): FluidStack | null;
  /** Takes up to `litres` of `fluid`; returns how many litres it gave. */
  drain(fluid: FluidKey, litres: number): number;
}

/** What the endpoints need from the simulation. */
export interface EndpointHost {
  machineSlots(e: MachineEntity): Inventory;
  furnaceSlots(e: FurnaceEntity): FurnaceSlots;
  furnaceStats(e: FurnaceEntity): FurnaceStats;
  /** Tells open screens the simulation wrote into these slots. */
  touch(e: SimEntity): void;
}

/** Room for `item` in the slots [from, to) of an inventory that accept it. */
function roomIn(inv: Inventory, item: string, from: number, to: number): number {
  const limit = stackMax(item);
  let room = 0;
  for (let i = from; i < to; i++) {
    if (!inv.accepts(item, i)) continue;
    const s = inv.get(i);
    if (!s) room += limit;
    else if (s.item === item && s.durability === undefined) room += Math.max(0, limit - s.count);
  }
  return room;
}

function offerIn(inv: Inventory, from: number, to: number, filter?: (item: string) => boolean): ItemStack | null {
  for (let i = from; i < to; i++) {
    const s = inv.get(i);
    if (s && (!filter || filter(s.item))) return { ...s };
  }
  return null;
}

function takeIn(inv: Inventory, item: string, max: number, from: number, to: number, skip?: (item: string) => boolean): ItemStack | null {
  for (let i = from; i < to; i++) {
    const s = inv.get(i);
    if (s && s.item === item && !(skip && skip(item))) return inv.removeAt(i, max);
  }
  return null;
}

/** A machine or crate: items go into slots [inFrom, inTo) through the inventory's accept rule, come out of [outFrom, outTo). */
function slotEndpoint(e: MachineEntity, inv: Inventory, inFrom: number, inTo: number, outFrom: number, outTo: number): ItemEndpoint {
  return {
    entity: e,
    room: (item) => roomIn(inv, item, inFrom, inTo),
    insert: (item, count, durability) => (inTo > inFrom ? count - inv.add(item, count, durability, inFrom, inTo) : 0),
    offer: (filter) => offerIn(inv, outFrom, outTo, filter),
    take: (item, max) => takeIn(inv, item, max, outFrom, outTo),
  };
}

/** The furnace's smart sides. */
function furnaceEndpoint(e: FurnaceEntity, host: EndpointHost): ItemEndpoint {
  const slots = host.furnaceSlots(e);
  const working = (): number => Math.min(host.furnaceStats(e).crucibles, e.crucibleIn.length);
  /**
   * Working crucibles that may take `item` (empty ones and those already holding it), least filled first, so piped
   * ore spreads over every crucible instead of stacking up in one while the others stand idle.
   */
  const crucibles = (item: string): number[] => {
    const n = working();
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = e.crucibleIn[i];
      if (!s || s.item === item) out.push(i);
    }
    const count = (i: number): number => e.crucibleIn[i]?.count ?? 0;
    return out.sort((a, b) => count(a) - count(b) || a - b);
  };
  const route = (item: string): 'fuel' | 'crucible' | null => {
    const smelts = crucibleRecipe(item, host.furnaceStats(e)) !== null;
    if (fuelOf(item)) {
      if (!smelts) return 'fuel';
      const n = working();
      for (let i = 0; i < n; i++) if (e.crucibleIn[i]?.item === item) return 'crucible';
      return 'fuel';
    }
    return smelts ? 'crucible' : null;
  };
  /** Only what is not fuel leaves the firebox: containers burned fuels left there. */
  const isFuel = (item: string): boolean => fuelOf(item) !== null;
  return {
    entity: e,
    room(item) {
      const to = route(item);
      if (to === 'fuel') return roomIn(slots.fuel, item, 0, e.fuel.length);
      if (to === null) return 0;
      let room = 0;
      for (const i of crucibles(item)) room += roomIn(slots.crucibleIn, item, i, i + 1);
      return room;
    },
    insert(item, count, durability) {
      const to = route(item);
      if (to === 'fuel') return count - slots.fuel.add(item, count, durability);
      if (to === null) return 0;
      let left = count;
      for (const i of crucibles(item)) if (left > 0) left = slots.crucibleIn.add(item, left, durability, i, i + 1);
      return count - left;
    },
    offer(filter) {
      return offerIn(slots.crucibleOut, 0, e.crucibleOut.length, filter)
        ?? offerIn(slots.fuel, 0, e.fuel.length, (item) => !isFuel(item) && (!filter || filter(item)));
    },
    take(item, max) {
      return takeIn(slots.crucibleOut, item, max, 0, e.crucibleOut.length) ?? takeIn(slots.fuel, item, max, 0, e.fuel.length, isFuel);
    },
  };
}

/** The item endpoint of a machine entity, or null when it has no slots a pipe could use. */
function machineItemEndpoint(e: MachineEntity, host: EndpointHost): ItemEndpoint | null {
  const spec = machine(e.kind);
  const size = e.slots.length;
  if (size === 0) return null;
  const inv = host.machineSlots(e);
  if (e.kind === 'crate') return slotEndpoint(e, inv, 0, size, 0, size);
  if (isProcessor(e.kind) || e.kind === 'drill_rig') return slotEndpoint(e, inv, 0, 1, 1, size);
  if (spec.fuels && spec.fuels.length > 0) return slotEndpoint(e, inv, 0, size, 0, 0);
  return slotEndpoint(e, inv, 0, 0, 0, size);
}

const shares = (spec: MachineSpec, fluid: FluidKey): boolean =>
  (spec.fluids?.accepts?.includes(fluid) ?? false) && (spec.fluids?.gives?.includes(fluid) ?? false);

/** The fluid endpoint of a machine with fluid ports (its buffers), or null. */
function machineFluidEndpoint(e: MachineEntity, host: EndpointHost): FluidEndpoint | null {
  const spec = machine(e.kind);
  const f = spec.fluids;
  if (!f) return null;
  const cap = f.capacityL;
  /** The buffer a fluid that comes out sits in: shared with the input for a tank, the output buffer otherwise. */
  const outBuffer = (fluid: FluidKey): 'fluidIn' | 'fluidOut' => (shares(spec, fluid) ? 'fluidIn' : 'fluidOut');
  return {
    entity: e,
    room(fluid) {
      if (!f.accepts?.includes(fluid)) return 0;
      const b = e.fluidIn;
      return !b || b.litres <= 0 ? cap : b.fluid === fluid ? Math.max(0, cap - b.litres) : 0;
    },
    fill(fluid, litres) {
      const n = Math.min(litres, this.room(fluid));
      if (n <= 0) return 0;
      const b = e.fluidIn;
      if (b && b.litres > 0) b.litres += n;
      else e.fluidIn = { fluid, litres: n };
      host.touch(e);
      return n;
    },
    offer() {
      const out = e.fluidOut;
      if (out && out.litres > 0 && f.gives?.includes(out.fluid)) return { ...out };
      const shared = e.fluidIn;
      if (shared && shared.litres > 0 && shares(spec, shared.fluid)) return { ...shared };
      return null;
    },
    drain(fluid, litres) {
      if (!f.gives?.includes(fluid)) return 0;
      const which = outBuffer(fluid);
      const b = e[which];
      if (!b || b.fluid !== fluid || b.litres <= 0) return 0;
      const n = Math.min(litres, b.litres);
      b.litres -= n;
      if (b.litres <= 0) e[which] = null;
      host.touch(e);
      return n;
    },
  };
}

/** Builds (and caches per entity) the endpoints of blocks. */
export class Endpoints {
  private readonly items = new WeakMap<SimEntity, ItemEndpoint | null>();
  private readonly fluids = new WeakMap<SimEntity, FluidEndpoint | null>();

  constructor(private readonly host: EndpointHost) {}

  /** The item endpoint of a furnace, crate or machine entity (hatches resolve to their controller before this). */
  item(e: SimEntity): ItemEndpoint | null {
    let ep = this.items.get(e);
    if (ep === undefined) {
      ep = isFurnace(e) ? furnaceEndpoint(e, this.host) : machineItemEndpoint(e as MachineEntity, this.host);
      this.items.set(e, ep);
    }
    return ep;
  }

  fluid(e: SimEntity): FluidEndpoint | null {
    let ep = this.fluids.get(e);
    if (ep === undefined) {
      ep = isFurnace(e) ? null : machineFluidEndpoint(e as MachineEntity, this.host);
      this.fluids.set(e, ep);
    }
    return ep;
  }
}
