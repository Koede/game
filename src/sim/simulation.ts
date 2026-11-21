/**
 * The simulation facade: owns the runtime nodes of every block entity, follows block changes, ticks the
 * machines, solves the power networks, and exposes the player's actions and the queries the UI needs.
 */
import { STATION_CRATE_RADIUS, TICK_RATE } from '../core/constants';
import type { GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { mulberry32 } from '../core/math';
import { blockOf, furnaceTierOfBlock, machine } from '../core/registry';
import { voxelActive, withActive, type IWorld } from '../core/types';
import type { GameClock } from '../game/clock';
import type { Inventory } from '../game/inventory';
import type { PlayerState } from '../game/playerState';
import {
  OK, addToSlots, createFurnace, createMachine, createNode, isFurnace, posKey, refuse, resizeFurnace,
  type ActionResult, type FurnaceEntity, type MachineEntity, type SimContext, type SimEntity, type SimNode,
} from './entities';
import { explode, fissionPile, meltDown } from './fission';
import { applyFurnace, prepareFurnace } from './furnace';
import * as actions from './furnaceActions';
import type { ActionHost, ForgeResult } from './furnaceActions';
import { behaviourOf, windAt, type Behaviour } from './machines';
import { Network, buildNetworks, chunkKey } from './power';
import { SlotAccess, type FurnaceSlots } from './slots';
import { concerns, nearChunk, surroundings } from './surroundings';
import { gridSummary, machineView, networkStats, type GridSummary, type MachineView, type NetworkStats } from './gridViews';
import { forgeRows, furnaceView, type ForgeRow, type FurnaceView } from './views';

const WIND = machine('wind_turbine').params ?? {};

export class Simulation implements ActionHost {
  sunlight = 1;
  wind = 1;
  everySecond = false;

  private readonly nodes: SimNode[] = [];
  private readonly furnaceNodes: SimNode[] = [];
  private readonly tickers: SimNode[] = [];
  private readonly behaviours: Behaviour[] = [];
  private readonly byKey = new Map<string, SimNode>();
  private networks: Network[] = [];
  /** Network of every cable position, refilled with the networks. */
  private readonly cableNets = new Map<string, Network>();
  private envDirty = true;
  private topologyDirty = true;
  /** Set while an explosion removes blocks: what the machines held is lost, not returned. */
  private destroying = false;
  private tickCount = 0;
  private readonly flags = new Set<string>();
  private readonly meltdowns: SimNode[] = [];
  private readonly slots = new SlotAccess();
  private readonly offs: Array<() => void> = [];
  readonly random: () => number;

  constructor(
    readonly world: IWorld,
    readonly bus: GameBus,
    readonly player: PlayerState,
    readonly clock: GameClock,
  ) {
    this.random = mulberry32(world.seed ^ 0x5eed);
    this.offs.push(
      bus.on('block:changed', (ev) => this.onBlockChanged(ev)),
      bus.on('chunk:loaded', ({ cx, cz }) => this.onChunk(cx, cz)),
      bus.on('chunk:unloaded', ({ cx, cz }) => this.onChunk(cx, cz)),
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
    this.nodes.length = 0;
    this.furnaceNodes.length = 0;
    this.tickers.length = 0;
    this.behaviours.length = 0;
    this.byKey.clear();
    this.networks = [];
    for (const e of this.world.entities()) this.track(e as SimEntity);
    this.markDirty();
  }

  // ---- ticking ------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.tickCount++;
    this.everySecond = this.tickCount % TICK_RATE === 0;
    this.fresh();
    this.sunlight = this.clock.sunlight();
    this.wind = windAt(this.clock.worldTimeS, WIND.windMin, WIND.windMax);
    const world = this.world;

    for (const n of this.furnaceNodes) {
      n.loaded = world.isLoaded(n.e.x, n.e.z);
      (n.e as FurnaceEntity).extractW = 0;
    }
    const tickers = this.tickers;
    const behaviours = this.behaviours;
    for (let i = 0; i < tickers.length; i++) {
      const n = tickers[i];
      n.loaded = world.isLoaded(n.e.x, n.e.z);
      if (n.loaded) behaviours[i].prepare(n, this);
      else {
        n.e.availW = 0;
        n.e.demandW = 0;
      }
    }
    for (const n of this.furnaceNodes) {
      if (n.loaded) prepareFurnace(n);
      else {
        n.e.availW = 0;
        n.e.demandW = 0;
      }
    }
    for (const net of this.networks) {
      net.solve(dt);
      net.alert(this.bus);
      if (this.everySecond) net.sample();
    }
    for (let i = 0; i < tickers.length; i++) if (tickers[i].loaded) behaviours[i].apply(tickers[i], this, dt);
    for (const n of this.furnaceNodes) if (n.loaded) applyFurnace(n, this, dt);

    if (this.meltdowns.length > 0) {
      const due = this.meltdowns.splice(0);
      for (const n of due) if (this.byKey.get(n.key) === n) this.explodeNode(n);
    }
  }

  private explodeNode(node: SimNode): void {
    this.destroying = true;
    try {
      meltDown(this, node);
    } finally {
      this.destroying = false;
    }
  }

  /** Blows up a sphere of blocks around a position (machines inside are destroyed with their contents). */
  explode(x: number, y: number, z: number, radius: number): void {
    this.destroying = true;
    try {
      explode(this, x, y, z, radius);
    } finally {
      this.destroying = false;
    }
  }

  /** Everything must be looked at again (a save was loaded). */
  private markDirty(): void {
    for (const n of this.nodes) n.dirty = true;
    this.envDirty = true;
    this.topologyDirty = true;
  }

  /** A chunk column arrived or left: only machines in or beside it, and networks reaching it, can change. */
  private onChunk(cx: number, cz: number): void {
    for (const n of this.nodes) {
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

  /** Brings surroundings and networks up to date with the blocks, if anything changed. */
  private fresh(): void {
    if (this.envDirty) {
      for (const n of this.nodes) {
        if (!n.dirty) continue;
        surroundings(this.world, this.byKey, this.tickers, n);
        n.dirty = false;
      }
      this.envDirty = false;
    }
    if (this.topologyDirty) {
      this.networks = buildNetworks(this.world, this.nodes, this.byKey, this.networks, this.cableNets);
      this.topologyDirty = false;
    }
  }

  // ---- entity lifecycle ---------------------------------------------------------------------------------------

  private track(e: SimEntity): SimNode {
    const node = createNode(e);
    node.active = voxelActive(this.world.getVoxel(e.x, e.y, e.z));
    this.nodes.push(node);
    this.byKey.set(node.key, node);
    if (isFurnace(e)) this.furnaceNodes.push(node);
    else if (e.kind !== 'crate') {
      this.tickers.push(node);
      this.behaviours.push(e.kind === 'fission_pile' ? fissionPile : behaviourOf(e.kind));
    }
    return node;
  }

  private untrack(node: SimNode): void {
    this.byKey.delete(node.key);
    this.nodes.splice(this.nodes.indexOf(node), 1);
    const f = this.furnaceNodes.indexOf(node);
    if (f >= 0) this.furnaceNodes.splice(f, 1);
    const t = this.tickers.indexOf(node);
    if (t >= 0) {
      this.tickers.splice(t, 1);
      this.behaviours.splice(t, 1);
    }
  }

  private onBlockChanged(ev: GameEvents['block:changed']): void {
    const from = blockOf(ev.from);
    const to = blockOf(ev.to);
    if (from.id === to.id) return;
    const { x, y, z } = ev;
    if (from.power !== null || to.power !== null) this.topologyDirty = true;
    const wheel = from.machine === 'water_wheel' || to.machine === 'water_wheel';
    for (const n of this.nodes) {
      if (n.dirty || !concerns(n, x, y, z, wheel)) continue;
      n.dirty = true;
      this.envDirty = true;
    }
    const node = this.byKey.get(posKey(x, y, z));
    if (node && node.e.kind !== to.machine) this.removeMachine(node);
    if (to.machine === null) return;
    const kept = this.byKey.get(posKey(x, y, z));
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
    this.track(e);
    this.envDirty = true;
    if (ev.source !== 'load') this.bus.emit('machine:placed', { entity: e });
    if (ev.source === 'player' && isFurnace(e)) this.player.setHome(x, y, z);
  }

  private removeMachine(node: SimNode): void {
    const e = node.e;
    this.untrack(node);
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
    if (node.crates.length === 0) return;
    const slots = (node.e as MachineEntity).slots;
    for (let i = from; i < to; i++) {
      for (const crate of node.crates) {
        const s = slots[i];
        if (!s) break;
        const left = addToSlots(crate.slots, s.item, s.count);
        if (left === s.count) continue;
        if (left > 0) s.count = left;
        else slots[i] = null;
        this.touch(crate);
        this.touch(node.e);
      }
    }
  }

  meltdown(node: SimNode): void {
    if (!this.meltdowns.includes(node)) this.meltdowns.push(node);
  }

  /** The player's inventory, then the crates within STATION_CRATE_RADIUS of a station (nearest first). */
  stationSources(x: number, y: number, z: number): Inventory[] {
    const near: Array<{ d: number; e: MachineEntity }> = [];
    for (const n of this.nodes) {
      if (n.e.kind !== 'crate') continue;
      const d = Math.max(Math.abs(n.e.x - x), Math.abs(n.e.y - y), Math.abs(n.e.z - z));
      if (d <= STATION_CRATE_RADIUS) near.push({ d, e: n.e as MachineEntity });
    }
    near.sort((a, b) => a.d - b.d);
    return [this.player.inventory, ...near.map((c) => this.slots.machine(c.e))];
  }

  // ---- lookups --------------------------------------------------------------------------------------------------

  furnaceAt(x: number, y: number, z: number): FurnaceEntity | null {
    const node = this.byKey.get(posKey(x, y, z));
    return node && isFurnace(node.e) ? node.e : null;
  }

  machineAt(x: number, y: number, z: number): MachineEntity | null {
    const node = this.byKey.get(posKey(x, y, z));
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
    const node = this.byKey.get(posKey(x, y, z));
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
    this.fresh();
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
    this.fresh();
    const node = this.byKey.get(posKey(x, y, z));
    return node && isFurnace(node.e) ? furnaceView(this, node) : null;
  }

  /** The forge recipe list of a furnace with per-row availability (also part of furnaceView). */
  forgeList(x: number, y: number, z: number): ForgeRow[] {
    const e = this.furnaceAt(x, y, z);
    return e ? forgeRows(this, e) : [];
  }

  machineView(x: number, y: number, z: number): MachineView | null {
    this.fresh();
    const node = this.byKey.get(posKey(x, y, z));
    return node && !isFurnace(node.e) ? machineView(node) : null;
  }

  /** Stats of the network a power device or cable at this position belongs to (null: none, or a lone cable run). */
  networkAt(x: number, y: number, z: number): NetworkStats | null {
    this.fresh();
    const key = posKey(x, y, z);
    const net = this.byKey.get(key)?.net ?? this.cableNets.get(key);
    return net ? networkStats(net) : null;
  }

  allNetworks(): NetworkStats[] {
    this.fresh();
    return this.networks.map(networkStats);
  }

  /** Totals of every network and the worst alert state, for the HUD. */
  grid(): GridSummary {
    return gridSummary(this.networks);
  }

  /** The furnace the player calls home (player.home), or null when there is none or it is gone. */
  homeFurnace(): FurnaceEntity | null {
    const h = this.player.home;
    return h ? this.furnaceAt(h.x, h.y, h.z) : null;
  }

  maxFurnaceTempC(): number {
    let t = 0;
    for (const n of this.furnaceNodes) t = Math.max(t, (n.e as FurnaceEntity).tempC);
    return t;
  }

  maxFurnaceTier(): number {
    let t = 0;
    for (const n of this.furnaceNodes) t = Math.max(t, (n.e as FurnaceEntity).tier);
    return t;
  }

  /** Sum of available generator watts over all networks. */
  generationW(): number {
    let w = 0;
    for (const net of this.networks) w += net.generationW;
    return w;
  }

  storedJ(): number {
    let j = 0;
    for (const net of this.networks) j += net.storedJ;
    return j;
  }

  get entityCount(): number {
    return this.nodes.length;
  }
}
