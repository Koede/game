/** Read-only snapshots of machines and power networks for the UI and the HUD. Built on demand, never per tick. */
import { conditionOf, isBroken, repairCost, wearOf, wearsOut, type Condition } from './wear';
import { BROWNOUT_STALL } from '../core/constants';
import { furnaceTier, recipe } from '../core/registry';
import type { MachineRole, RecipeDef, Slot } from '../core/types';
import { formatWatts } from '../game/objectives';
import type { FluidStack, FurnaceEntity, MachineEntity, SimNode } from './entities';
import { pileCooled } from './fission';
import { bitUses, bitUsesLeft } from './drillRig';
import { fluidStatus, oilProgress } from './fluidMachines';
import { fuelEnergyJ, holdsFuel, isProcessor, itemName, placementProblem } from './machines';
import { hearthName } from './hearthScan';
import type { Network, NetworkState } from './power';
import type { FluidLinks } from './transportViews';

export interface MachineView {
  /** Wear (src/sim/wear.ts): 0 as new .. 1 worn out, or null for a machine that does not wear. */
  wear: number | null;
  condition: Condition | null;
  /** Iron ingots a repair costs now (0: nothing to repair or it does not wear). */
  repairCost: number;
  kind: string;
  name: string;
  role: MachineRole;
  x: number;
  y: number;
  z: number;
  /** The machine's on/off switch. */
  on: boolean;
  /** The voxel's active flag: generating, running, lit. */
  running: boolean;
  status: string;
  /** What is wrong with where it stands, or null. */
  problem: string | null;
  /** The placement rule of this kind, or null. */
  hint: string | null;
  /** Id of its network (see NetworkStats.id), or null. */
  network: number | null;
  /** Generators: watts available and watts actually delivered. Storage: discharge watts in outW. */
  availW: number;
  outW: number;
  /** Consumers: watts wanted, and the fraction of it the network delivers (generators and storage: 1). */
  demandW: number;
  satisfaction: number;
  /** Processors and bore rig: 0..1 through the current job or block. */
  progress: number;
  recipe: RecipeDef | null;
  /** Storage. */
  storedJ: number;
  capacityJ: number;
  chargeW: number;
  /** Fuel generators and the fission pile: electric joules left (burning item plus the slot). */
  fuelJ: number;
  /** Seconds the loaded fuel lasts at the present output (Infinity when idle). */
  fuelLeftS: number;
  /** Fission pile. */
  coreC: number;
  cooled: boolean;
  /** Bore rig: y of the last block it mined. */
  depthY: number;
  /** The live slot array (read-only for the UI; use Simulation.machineSlots to move items). */
  slots: Slot[];
  /** Machines with fluid ports (spec 16.2): their buffers; null for the others. */
  fluids: MachineFluidView | null;
}

export interface MachineFluidView {
  /** What pipes or buckets put in (a tank: its own part of the stack), and what it hands out. Copies. */
  input: FluidStack | null;
  output: FluidStack | null;
  /** Litres each buffer holds. */
  capacityL: number;
  /** Litres a second it pumped, boiled or used last tick (pump, boiler, steam turbine), else 0. */
  rateL: number;
  /** Tanks: the stack it is part of (they share one fluid and one level). */
  stack: { tanks: number; fluid: FluidStack['fluid'] | null; litres: number; capacityL: number } | null;
}

/** What a machine's status needs beyond its own node: the hearth a hearth part sits in, the pipes reaching it. */
export interface MachineSurroundings {
  /** Hearth parts: the tier of the formed hearth it is part of, or 0. */
  hearthTier?: number;
  /** Boiler and steam turbine: the fluid pipe ends touching it. */
  links?: FluidLinks | null;
}

function hearthPartStatus(e: MachineEntity, tier: number): string {
  if (tier <= 0) return 'Not part of a formed hearth - build it into a hearth wall';
  const part = `Part of the ${hearthName(tier)}`;
  const lava = e.kind === 'fluid_hatch' && e.fluidIn?.fluid === 'lava' ? e.fluidIn.litres : 0;
  return lava > 0 ? `${part} - holds ${Math.round(lava).toLocaleString('en-US')} L of lava` : part;
}

function machineStatus(node: SimNode, v: MachineView, around: MachineSurroundings): string {
  const e = node.e as MachineEntity;
  const spec = node.spec;
  if (spec.role === 'crate') return '';
  if (spec.role === 'hearth_part') return hearthPartStatus(e, around.hearthTier ?? 0);
  if (!e.on) return 'Switched off';
  if (wearsOut(e.kind) && isBroken(e)) return 'Broken - repair it to run again';
  if (spec.role === 'storage') {
    const pct = Math.round((100 * e.storedJ) / (spec.capacityJ ?? 1));
    if (v.network === null || (node.net !== null && node.net.nodes.length < 2)) return `${pct}% - not connected`;
    return v.chargeW > 0 ? `${pct}% - charging ${formatWatts(v.chargeW)}` : e.outW > 0 ? `${pct}% - feeding ${formatWatts(e.outW)}` : `${pct}% - idle`;
  }
  if (e.kind === 'fission_pile') {
    if (!holdsFuel(node)) return 'No fuel rod';
    if (!v.cooled) return `No cooling - core at ${Math.round(e.coreC)} C and rising`;
  }
  if (v.problem) return v.problem;
  const fluid = fluidStatus(node, null, around.links ?? null);
  if (fluid) return fluid;
  if (spec.role === 'generator') {
    if (spec.fuels && spec.fuels.length > 0 && !holdsFuel(node)) return 'No fuel';
    if (e.availW <= 0) {
      if (e.kind === 'solar_panel') return 'No sunlight';
      return e.kind === 'steam_engine' || e.kind === 'thermopile' ? 'The furnace is too cold' : 'Idle';
    }
    return `${formatWatts(e.outW)} of ${formatWatts(e.availW)} in use`;
  }
  if (e.kind === 'bore_rig' || e.kind === 'drill_rig') {
    if (e.halted !== '') return e.halted;
    if (e.demandW <= 0) return 'Buffer full';
  } else if (isProcessor(e.kind)) {
    if (!e.slots[0]) return 'Waiting for input';
    if (v.recipe === null) return 'Not enough input';
    if (e.demandW <= 0) return 'Output is full';
  }
  if (e.kind === 'ward_beacon') {
    if (v.satisfaction < BROWNOUT_STALL) return `${v.satisfaction > 0 ? 'Not enough power' : 'No power'} - automatons can come near`;
    return `Warding ${spec.params?.radius ?? 0} blocks all round - automatons keep away`;
  }
  if (e.demandW > 0 && v.satisfaction < BROWNOUT_STALL) return v.satisfaction > 0 ? 'Not enough power' : 'No power';
  if (e.kind === 'bore_rig') return `Boring at depth ${e.depthY}`;
  if (e.kind === 'drill_rig') return `Drilling at depth ${e.depthY} - bit ${bitUsesLeft(e)} of ${bitUses(e.slots[0]?.item ?? '')} left`;
  if (v.recipe) return `Making ${itemName(v.recipe.output.item)} - ${Math.round(v.progress * 100)}%`;
  return v.satisfaction < 1 ? `Running at ${Math.round(v.satisfaction * 100)}% power` : 'Running';
}

export function machineView(node: SimNode, around: MachineSurroundings = {}): MachineView {
  const e = node.e as MachineEntity;
  const spec = node.spec;
  const consumer = spec.role === 'consumer';
  const r = e.recipe ? recipe(e.recipe) : null;
  const span = e.kind === 'bore_rig' || e.kind === 'drill_rig' ? spec.params?.secondsPerBlock ?? 1 : r ? r.timeS : 1;
  const slot = e.slots[0];
  const fuelJ = spec.fuels && spec.fuels.length > 0 ? e.fuelJ + (slot ? slot.count * fuelEnergyJ(spec, slot.item) : 0) : 0;
  const wears = wearsOut(e.kind);
  const view: MachineView = {
    wear: wears ? wearOf(e) : null, condition: wears ? conditionOf(e) : null, repairCost: wears ? repairCost(e) : 0,
    kind: e.kind, name: spec.name, role: spec.role, x: e.x, y: e.y, z: e.z, on: e.on, running: node.active, status: '',
    problem: placementProblem(node), hint: spec.placementHint ?? null, network: node.net ? node.net.id : null,
    availW: e.availW, outW: e.outW, demandW: e.demandW, satisfaction: consumer ? (node.net ? node.net.f : 0) : 1,
    progress: oilProgress(e) ?? Math.min(1, e.progress / span), recipe: r, storedJ: e.storedJ, capacityJ: spec.capacityJ ?? 0,
    chargeW: spec.role === 'storage' ? e.f : 0, fuelJ, fuelLeftS: e.outW > 0 ? fuelJ / e.outW : Infinity, coreC: e.coreC,
    cooled: e.kind === 'fission_pile' ? pileCooled(node) : true, depthY: e.depthY, slots: e.slots,
    fluids: spec.fluids
      ? {
        input: e.fluidIn ? { ...e.fluidIn } : null, output: e.fluidOut ? { ...e.fluidOut } : null,
        capacityL: spec.fluids.capacityL, rateL: e.rateL ?? 0, stack: null,
      }
      : null,
  };
  view.status = machineStatus(node, view, around);
  return view;
}

// ---- networks ---------------------------------------------------------------------------------------------------

export interface NetworkMember {
  kind: string;
  name: string;
  x: number;
  y: number;
  z: number;
  role: MachineRole;
  /** Positive = feeds the network, negative = draws from it (storage: discharge minus charge). */
  watts: number;
  status: string;
}

export interface NetworkStats {
  /** Identifies the network until the next topology change (ids are renumbered when blocks change). */
  id: number;
  /** Potential generation G, demand D and what is actually delivered (f x D), in watts. */
  generationW: number;
  demandW: number;
  deliveredW: number;
  storedJ: number;
  capacityJ: number;
  /** Watts going into storage (before the 90% efficiency) and coming out of it. */
  chargeW: number;
  dischargeW: number;
  /** Watts lost charging batteries, and watts of demand the weakest cable held back. */
  lossW: number;
  chokedW: number;
  /** Demand that goes unmet (demand minus what is delivered). */
  shortW: number;
  /** Most the switched-on storage can give at once, in watts (0 without storage). */
  storageRateW: number;
  /** Most the cables carry; Infinity without cables. */
  ratingW: number;
  cables: number;
  /** f: the fraction of its demand every consumer receives. */
  satisfaction: number;
  overloaded: boolean;
  /** The announced state (alerts fire when it changes). */
  state: NetworkState;
  members: NetworkMember[];
  /** One sample per second (mean over that second), oldest first, HISTORY_SECONDS of each. */
  historyG: number[];
  historyUsed: number[];
}

/** The tier of the formed hearth on the same network whose shell holds this part (its power ports link it), or 0. */
function hearthTierAround(net: Network, part: SimNode): number {
  const { x, y, z } = part.e;
  for (const n of net.nodes) {
    const h = n.e.kind === 'furnace' ? (n.e as FurnaceEntity).hearth : null;
    if (h && x >= h.min[0] && x <= h.max[0] && y >= h.min[1] && y <= h.max[1] && z >= h.min[2] && z <= h.max[2]) return h.tier;
  }
  return 0;
}

function membersOf(net: Network): NetworkMember[] {
  return net.nodes.map((n) => {
    const base = { kind: n.e.kind, x: n.e.x, y: n.e.y, z: n.e.z, role: n.spec.role };
    if (n.e.kind === 'furnace') {
      const e = n.e as FurnaceEntity;
      const name = furnaceTier(e.tier).name;
      if (e.ignited) return { ...base, name, watts: e.availW * net.load, status: `Generating ${formatWatts(e.availW)}` };
      const status = e.demandW > 0 ? `Drawing ${formatWatts(e.deliveredW)} of ${formatWatts(e.demandW)}` : 'No electric load';
      return { ...base, name, watts: -e.deliveredW, status };
    }
    const view = machineView(n, n.spec.role === 'hearth_part' ? { hearthTier: hearthTierAround(net, n) } : {});
    const watts = n.spec.role === 'storage' ? view.outW - view.chargeW : n.spec.role === 'generator' ? view.outW : -view.demandW * net.f;
    return { ...base, name: n.spec.name, watts, status: view.status };
  });
}

function storageRate(net: Network): number {
  let w = 0;
  for (const n of net.storage) if (n.loaded && (n.e as MachineEntity).on) w += n.spec.rateW ?? 0;
  return w;
}

/** A snapshot of one network. `members` is worked out on first access (the HUD only needs the totals). */
export function networkStats(net: Network): NetworkStats {
  let members: NetworkMember[] | null = null;
  return {
    id: net.id, generationW: net.generationW, demandW: net.demandW, deliveredW: net.deliveredW, storedJ: net.storedJ,
    capacityJ: net.capacityJ, chargeW: net.chargeW, dischargeW: net.dischargeW, storageRateW: storageRate(net),
    lossW: net.lossW, chokedW: net.chokedW, shortW: Math.max(0, net.demandW - net.deliveredW), ratingW: net.ratingW, cables: net.cables,
    satisfaction: net.f, overloaded: net.overloaded, state: net.state,
    get members(): NetworkMember[] {
      if (members === null) members = membersOf(net);
      return members;
    },
    historyG: [...net.historyG], historyUsed: [...net.historyUsed],
  };
}

/** Totals over every network, cheap enough for the HUD to read every frame. */
export interface GridSummary {
  networks: number;
  generationW: number;
  demandW: number;
  deliveredW: number;
  storedJ: number;
  capacityJ: number;
  /** The worst announced state of any network: 'overload' beats 'brownout' beats 'ok'. */
  state: NetworkState;
}

const SEVERITY: Record<NetworkState, number> = { ok: 0, brownout: 1, overload: 2 };

export function gridSummary(networks: readonly Network[]): GridSummary {
  const s: GridSummary = { networks: networks.length, generationW: 0, demandW: 0, deliveredW: 0, storedJ: 0, capacityJ: 0, state: 'ok' };
  for (const net of networks) {
    s.generationW += net.generationW;
    s.demandW += net.demandW;
    s.deliveredW += net.deliveredW;
    s.storedJ += net.storedJ;
    s.capacityJ += net.capacityJ;
    if (SEVERITY[net.state] > SEVERITY[s.state]) s.state = net.state;
  }
  return s;
}

// ---- the grid overlay -------------------------------------------------------------------------------------------

export type GridCellKind = 'cable' | 'source' | 'load' | 'storage';

/** One block of a power network, as the grid overlay draws it. */
export interface GridCell {
  x: number;
  y: number;
  z: number;
  kind: GridCellKind;
  /** NetworkStats.id of its network. */
  net: number;
  /** 0..1: how full the cables are (consumers and sources share their network's figure). */
  load: number;
  state: NetworkState;
  /** A consumer that is not getting all it asks for. */
  short: boolean;
}

/** How full a network's cables are: what they carry against the weakest cable's rating. */
export function cableLoad(net: Network): number {
  const carried = net.deliveredW + net.chargeW;
  if (Number.isFinite(net.ratingW)) return Math.min(1, carried / net.ratingW);
  const supply = net.generationW + net.dischargeW;
  return supply > 0 ? Math.min(1, carried / supply) : 0;
}

/**
 * Every cable and machine within `range` blocks (Chebyshev, so a box) of a point, for the overlay. `only` limits it to
 * one network (a grid monitor shows just its own). Built on demand, once a tick at most.
 */
export function gridCells(
  networks: readonly Network[], cables: ReadonlyMap<string, Network>, px: number, py: number, pz: number, range: number,
  only: number | null, out: GridCell[] = [],
): GridCell[] {
  out.length = 0;
  const near = (x: number, y: number, z: number): boolean =>
    Math.abs(x + 0.5 - px) <= range && Math.abs(y + 0.5 - py) <= range && Math.abs(z + 0.5 - pz) <= range;
  for (const net of networks) {
    if (only !== null && net.id !== only) continue;
    const load = cableLoad(net);
    for (const n of net.nodes) {
      const { x, y, z } = n.e;
      if (!near(x, y, z)) continue;
      const role = n.spec.role;
      const kind: GridCellKind = role === 'generator' || n.e.kind === 'furnace' ? 'source' : role === 'storage' ? 'storage' : 'load';
      out.push({ x, y, z, kind, net: net.id, load, state: net.state, short: kind === 'load' && n.e.demandW > 0 && net.f < BROWNOUT_BELOW_LOAD });
    }
  }
  for (const [key, net] of cables) {
    if (only !== null && net.id !== only) continue;
    const [x, y, z] = key.split(',').map(Number);
    if (!near(x, y, z)) continue;
    out.push({ x, y, z, kind: 'cable', net: net.id, load: cableLoad(net), state: net.state, short: false });
  }
  return out;
}

/** A consumer counts as short of power below this satisfaction (one part in a thousand of slack for rounding). */
const BROWNOUT_BELOW_LOAD = 0.999;
