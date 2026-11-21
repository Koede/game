/**
 * The simulation facade: follows block changes to create and remove block entities, ticks the machines, solves
 * the power networks, and exposes the player's actions and the queries the UI and the objectives need.
 */
import { TICK_RATE } from '../core/constants';
import type { GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { mulberry32 } from '../core/math';
import { blockOf, furnaceTierOfBlock, machine } from '../core/registry';
import { voxelActive, withActive, type IWorld } from '../core/types';
import type { GameClock } from '../game/clock';
import type { Inventory } from '../game/inventory';
import type { PlayerState } from '../game/playerState';
import { cratesNear, pushToCrates } from './crates';
import {
  OK, createFurnace, createMachine, isFurnace, posKey, refuse, resizeFurnace,
  type ActionResult, type FurnaceEntity, type MachineEntity, type SimEntity, type SimNode,
} from './entities';
import { explode, meltDown } from './fission';
import { applyFurnace, prepareFurnace } from './furnace';
import * as actions from './furnaceActions';
import type { ActionHost, ForgeResult } from './furnaceActions';
import { gridSummary, machineView, networkStats, type GridSummary, type MachineView, type NetworkStats } from './gridViews';
import { windAt } from './machines';
import { NodeSet } from './nodes';
import type { Network } from './power';
import { SlotAccess, type FurnaceSlots } from './slots';
import { forgeRows, furnaceView, type ForgeRow, type FurnaceView } from './views';

const WIND = machine('wind_turbine').params ?? {};

export class Simulation implements ActionHost {
  /** Sunlight factor and wind factor of the current tick (read by solar panels and wind turbines). */
  sunlight = 1;
  wind = 1;
  /** True on one tick per second. */
  everySecond = false;
  readonly random: () => number;

  private readonly nodes: NodeSet;
  /** Set while an explosion removes blocks: what the machines held is lost, not returned. */
  private destroying = false;
  private tickCount = 0;
  private readonly flags = new Set<string>();
  private readonly meltdowns: SimNode[] = [];
  private readonly slots = new SlotAccess();
  private readonly offs: Array<() => void> = [];
  /** allNetworks() of the current tick and topology. */
  private stats: NetworkStats[] = [];
  private statsTick = -1;
  private statsOf: Network[] | null = null;

  constructor(
    readonly world: IWorld,
    readonly bus: GameBus,
    readonly player: PlayerState,
    readonly clock: GameClock,
  ) {
    this.random = mulberry32(world.seed ^ 0x5eed);
    this.nodes = new NodeSet(world);
    this.offs.push(
      bus.on('block:changed', (ev) => this.onBlockChanged(ev)),
      bus.on('chunk:loaded', ({ cx, cz }) => this.nodes.chunkChanged(cx, cz)),
      bus.on('chunk:unloaded', ({ cx, cz }) => this.nodes.chunkChanged(cx, cz)),
      bus.on('ui:opened', ({ screen }) => {
        if (screen.type === 'furnace' && this.furnaceAt(screen.x, screen.y, screen.z)) player.setHome(screen.x, screen.y, screen.z);
      }),
    );
    this.resync();
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  /** Rebuilds the runtime from the world's entities. Call after a save was loaded into the world. */
  resync(): void {
    this.nodes.clear();
    for (const e of this.world.entities()) this.nodes.track(e as SimEntity);
  }

  // ---- ticking ------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.tickCount++;
    this.everySecond = this.tickCount % TICK_RATE === 0;
    const { world, nodes } = this;
    nodes.fresh();
    this.sunlight = this.clock.sunlight();
    this.wind = windAt(this.clock.worldTimeS, WIND.windMin, WIND.windMax);

    for (const n of nodes.furnaces) {
      n.loaded = world.isLoaded(n.e.x, n.e.z);
      (n.e as FurnaceEntity).extractW = 0;
    }
    const { tickers, behaviours } = nodes;
    for (let i = 0; i < tickers.length; i++) {
      const n = tickers[i];
      n.loaded = world.isLoaded(n.e.x, n.e.z);
      if (n.loaded) behaviours[i].prepare(n, this);
      else {
        n.e.availW = 0;
        n.e.demandW = 0;
      }
    }
    for (const n of nodes.furnaces) {
      if (n.loaded) prepareFurnace(n);
      else {
        n.e.availW = 0;
        n.e.demandW = 0;
      }
    }
    for (const net of nodes.networks) {
      net.solve(dt);
      net.alert(this.bus);
      if (this.everySecond) net.sample();
    }
    for (let i = 0; i < tickers.length; i++) if (tickers[i].loaded) behaviours[i].apply(tickers[i], this, dt);
    for (const n of nodes.furnaces) if (n.loaded) applyFurnace(n, this, dt);

    if (this.meltdowns.length > 0) {
      for (const n of this.meltdowns.splice(0)) if (nodes.byKey.get(n.key) === n) this.destroy(() => meltDown(this, n));
    }
  }

  /** Blows up a sphere of blocks around a position (machines inside are destroyed with their contents). */
  explode(x: number, y: number, z: number, radius: number): void {
    this.destroy(() => explode(this, x, y, z, radius));
  }

  private destroy(fn: () => void): void {
    this.destroying = true;
    try {
      fn();
    } finally {
      this.destroying = false;
    }
  }

  // ---- entity lifecycle ---------------------------------------------------------------------------------------

  private onBlockChanged(ev: GameEvents['block:changed']): void {
    const from = blockOf(ev.from);
    const to = blockOf(ev.to);
    if (from.id === to.id) return;
    const { x, y, z } = ev;
    const key = posKey(x, y, z);
    this.nodes.blockChanged(x, y, z, from.power !== null || to.power !== null, from.machine === 'water_wheel' || to.machine === 'water_wheel');
    const node = this.nodes.byKey.get(key);
    if (node && node.e.kind !== to.machine) this.removeMachine(node);
    if (to.machine === null) return;
    const kept = this.nodes.byKey.get(key);
    if (kept) {
      // Same machine kind under a new block: a furnace was rebuilt as another tier.
      const tier = furnaceTierOfBlock(to.key);
      if (tier && isFurnace(kept.e) && kept.e.tier !== tier.tier) resizeFurnace(kept.e, tier.tier);
      return;
    }
    const stored = this.world.getEntity(x, y, z) as SimEntity | undefined;
    let e: SimEntity;
    if (stored && stored.kind === to.machine) e = stored;
    else {
      e = to.machine === 'furnace' ? createFurnace(x, y, z, furnaceTierOfBlock(to.key)?.tier ?? 1) : createMachine(to.machine, x, y, z);
      this.world.setEntity(e);
    }
    this.nodes.track(e);
    if (ev.source !== 'load') this.bus.emit('machine:placed', { entity: e });
    if (ev.source === 'player' && isFurnace(e)) this.player.setHome(x, y, z);
  }

  private removeMachine(node: SimNode): void {
    const e = node.e;
    this.nodes.untrack(node);
    this.world.removeEntity(e.x, e.y, e.z);
    if (!this.destroying) {
      const held = isFurnace(e) ? [...e.fuel, ...e.crucibleIn, ...e.crucibleOut] : (e as MachineEntity).slots;
      for (const s of held) if (s) this.player.give(s.item, s.count, s.durability);
    }
    this.bus.emit('machine:removed', { entity: e });
  }

  // ---- SimContext -----------------------------------------------------------------------------------------------

  setActive(node: SimNode, active: boolean): void {
    if (node.active === active) return;
    node.active = active;
    const { x, y, z } = node.e;
    const v = this.world.getVoxel(x, y, z);
    if (voxelActive(v) !== active) this.world.setVoxel(x, y, z, withActive(v, active), 'sim');
  }

  touch(e: SimEntity): void {
    this.slots.touch(e);
  }

  flagOnce(flag: string): void {
    if (this.flags.has(flag)) return;
    this.flags.add(flag);
    this.bus.emit('flag', { flag });
  }

  pushToCrates(node: SimNode, from: number, to: number): void {
    pushToCrates(node, from, to, (e) => this.touch(e));
  }

  meltdown(node: SimNode): void {
    if (!this.meltdowns.includes(node)) this.meltdowns.push(node);
  }

  /** The player's inventory, then the crates within STATION_CRATE_RADIUS of a station (nearest first). */
  stationSources(x: number, y: number, z: number): Inventory[] {
    return [this.player.inventory, ...cratesNear(this.nodes.all, x, y, z).map((c) => this.slots.machine(c))];
  }

  // ---- lookups --------------------------------------------------------------------------------------------------

  furnaceAt(x: number, y: number, z: number): FurnaceEntity | null {
    const node = this.nodes.byKey.get(posKey(x, y, z));
    return node && isFurnace(node.e) ? node.e : null;
  }

  machineAt(x: number, y: number, z: number): MachineEntity | null {
    const node = this.nodes.byKey.get(posKey(x, y, z));
    return node && !isFurnace(node.e) ? (node.e as MachineEntity) : null;
  }

  /** Slot groups of the furnace at a position, as inventories with accept rules. */
  furnaceSlots(x: number, y: number, z: number): FurnaceSlots | null {
    const e = this.furnaceAt(x, y, z);
    return e ? this.slots.furnace(e) : null;
  }

  /** Slots of the machine or crate at a position, as an inventory with accept rules. */
  machineSlots(x: number, y: number, z: number): Inventory | null {
    const e = this.machineAt(x, y, z);
    return e ? this.slots.machine(e) : null;
  }

  // ---- player actions -------------------------------------------------------------------------------------------

  private withFurnace(x: number, y: number, z: number, fn: (e: FurnaceEntity, node: SimNode) => ActionResult): ActionResult {
    const node = this.nodes.byKey.get(posKey(x, y, z));
    return node && isFurnace(node.e) ? fn(node.e, node) : refuse('There is no furnace here');
  }

  light(x: number, y: number, z: number): ActionResult {
    return this.withFurnace(x, y, z, (e) => actions.light(this, e));
  }

  douse(x: number, y: number, z: number): ActionResult {
    return this.withFurnace(x, y, z, (e) => actions.douse(this, e));
  }

  pump(x: number, y: number, z: number): ActionResult {
    return this.withFurnace(x, y, z, (e) => actions.pump(this, e));
  }

  setElectric(x: number, y: number, z: number, on: boolean): ActionResult {
    return this.withFurnace(x, y, z, (e) => actions.setElectric(this, e, on));
  }

  forge(x: number, y: number, z: number, recipeId: string, times = 1): ForgeResult {
    const e = this.furnaceAt(x, y, z);
    return e ? actions.forge(this, e, recipeId, times) : { ok: false, reason: 'There is no furnace here' };
  }

  upgrade(x: number, y: number, z: number): ActionResult {
    return this.withFurnace(x, y, z, (e) => actions.upgrade(this, e));
  }

  startIgnition(x: number, y: number, z: number): ActionResult {
    this.nodes.fresh();
    return this.withFurnace(x, y, z, (e, node) => actions.startIgnition(this, e, node));
  }

  rest(x: number, y: number, z: number): ActionResult {
    return this.withFurnace(x, y, z, (e) => actions.rest(this, e));
  }

  /** Switches a machine (generator, consumer, storage, fission pile) on or off. Crates have no switch. */
  setMachineOn(x: number, y: number, z: number, on: boolean): ActionResult {
    const e = this.machineAt(x, y, z);
    if (!e || e.kind === 'crate') return refuse('There is no machine here');
    if (e.on !== on) {
      e.on = on;
      this.bus.emit('sfx', { name: on ? 'machine_on' : 'machine_off', x, y, z });
    }
    return OK;
  }

  /** Flips a machine's switch. */
  toggleMachine(x: number, y: number, z: number): ActionResult {
    const e = this.machineAt(x, y, z);
    return this.setMachineOn(x, y, z, e ? !e.on : true);
  }

  // ---- queries --------------------------------------------------------------------------------------------------

  furnaceView(x: number, y: number, z: number): FurnaceView | null {
    this.nodes.fresh();
    const node = this.nodes.byKey.get(posKey(x, y, z));
    return node && isFurnace(node.e) ? furnaceView(this, node) : null;
  }

  /** The forge recipe list of a furnace with per-row availability (also part of furnaceView). */
  forgeList(x: number, y: number, z: number): ForgeRow[] {
    const e = this.furnaceAt(x, y, z);
    return e ? forgeRows(this, e) : [];
  }

  machineView(x: number, y: number, z: number): MachineView | null {
    this.nodes.fresh();
    const node = this.nodes.byKey.get(posKey(x, y, z));
    return node && !isFurnace(node.e) ? machineView(node) : null;
  }

  /** Stats of the network a power device or cable at this position belongs to (null: none, or a lone cable run). */
  networkAt(x: number, y: number, z: number): NetworkStats | null {
    this.nodes.fresh();
    const key = posKey(x, y, z);
    const net = this.nodes.byKey.get(key)?.net ?? this.nodes.cableNets.get(key);
    return net ? networkStats(net) : null;
  }

  /** Every network. The list is built at most once per tick; treat it as read-only. */
  allNetworks(): NetworkStats[] {
    this.nodes.fresh();
    const networks = this.nodes.networks;
    if (this.statsTick !== this.tickCount || this.statsOf !== networks) {
      this.stats = networks.map(networkStats);
      this.statsTick = this.tickCount;
      this.statsOf = networks;
    }
    return this.stats;
  }

  /** Totals of every network and the worst alert state, for the HUD. */
  grid(): GridSummary {
    return gridSummary(this.nodes.networks);
  }

  /** The furnace the player calls home (player.home), or null when there is none or it is gone. */
  homeFurnace(): FurnaceEntity | null {
    const h = this.player.home;
    return h ? this.furnaceAt(h.x, h.y, h.z) : null;
  }

  maxFurnaceTempC(): number {
    let t = 0;
    for (const n of this.nodes.furnaces) t = Math.max(t, (n.e as FurnaceEntity).tempC);
    return t;
  }

  maxFurnaceTier(): number {
    let t = 0;
    for (const n of this.nodes.furnaces) t = Math.max(t, (n.e as FurnaceEntity).tier);
    return t;
  }

  /** Sum of available generator watts over all networks. */
  generationW(): number {
    let w = 0;
    for (const net of this.nodes.networks) w += net.generationW;
    return w;
  }

  /** Joules held in every battery and lithium bank. */
  storedJ(): number {
    let j = 0;
    for (const net of this.nodes.networks) j += net.storedJ;
    return j;
  }

  get entityCount(): number {
    return this.nodes.all.length;
  }
}
