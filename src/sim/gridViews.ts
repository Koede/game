/** Read-only snapshots of machines and power networks for the UI and the HUD. Built on demand, never per tick. */
import { BROWNOUT_STALL } from '../core/constants';
import { furnaceTier, recipe } from '../core/registry';
import type { MachineRole, RecipeDef, Slot } from '../core/types';
import { formatWatts } from '../game/objectives';
import type { FluidStack, FurnaceEntity, MachineEntity, SimNode } from './entities';
import { pileCooled } from './fission';
import { fluidStatus, oilProgress } from './fluidMachines';
import { fuelEnergyJ, holdsFuel, isProcessor, itemName, placementProblem } from './machines';
import type { Network, NetworkState } from './power';

export interface MachineView {
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

function machineStatus(node: SimNode, v: MachineView): string {
  const e = node.e as MachineEntity;
  const spec = node.spec;
  if (spec.role === 'crate') return '';
  if (!e.on) return 'Switched off';
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
  const fluid = fluidStatus(node, null);
  if (fluid) return fluid;
  if (spec.role === 'generator') {
    if (spec.fuels && spec.fuels.length > 0 && !holdsFuel(node)) return 'No fuel';
    if (e.availW <= 0) {
      if (e.kind === 'solar_panel') return 'No sunlight';
      return e.kind === 'steam_engine' || e.kind === 'thermopile' ? 'The furnace is too cold' : 'Idle';
    }
    return `${formatWatts(e.outW)} of ${formatWatts(e.availW)} in use`;
  }
  if (e.kind === 'bore_rig') {
    if (e.halted !== '') return e.halted;
    if (e.demandW <= 0) return 'Buffer full';
  } else if (isProcessor(e.kind)) {
    if (!e.slots[0]) return 'Waiting for input';
    if (v.recipe === null) return 'Not enough input';
    if (e.demandW <= 0) return 'Output is full';
  }
  if (e.demandW > 0 && v.satisfaction < BROWNOUT_STALL) return v.satisfaction > 0 ? 'Not enough power' : 'No power';
  if (e.kind === 'bore_rig') return `Boring at depth ${e.depthY}`;
  if (v.recipe) return `Making ${itemName(v.recipe.output.item)} - ${Math.round(v.progress * 100)}%`;
  return v.satisfaction < 1 ? `Running at ${Math.round(v.satisfaction * 100)}% power` : 'Running';
}

export function machineView(node: SimNode): MachineView {
  const e = node.e as MachineEntity;
  const spec = node.spec;
  const consumer = spec.role === 'consumer';
  const r = e.recipe ? recipe(e.recipe) : null;
  const span = e.kind === 'bore_rig' ? spec.params?.secondsPerBlock ?? 1 : r ? r.timeS : 1;
  const slot = e.slots[0];
  const fuelJ = spec.fuels && spec.fuels.length > 0 ? e.fuelJ + (slot ? slot.count * fuelEnergyJ(spec, slot.item) : 0) : 0;
  const view: MachineView = {
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
  view.status = machineStatus(node, view);
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
    const view = machineView(n);
    const watts = n.spec.role === 'storage' ? view.outW - view.chargeW : n.spec.role === 'generator' ? view.outW : -view.demandW * net.f;
    return { ...base, name: n.spec.name, watts, status: view.status };
  });
}

/** A snapshot of one network. `members` is worked out on first access (the HUD only needs the totals). */
export function networkStats(net: Network): NetworkStats {
  let members: NetworkMember[] | null = null;
  return {
    id: net.id, generationW: net.generationW, demandW: net.demandW, deliveredW: net.deliveredW, storedJ: net.storedJ,
    capacityJ: net.capacityJ, chargeW: net.chargeW, dischargeW: net.dischargeW, ratingW: net.ratingW, cables: net.cables,
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
