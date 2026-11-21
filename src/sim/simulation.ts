/**
 * The simulation facade: follows block changes to create and remove block entities, ticks the machines, solves
 * the power networks, and exposes the player's actions and the queries the UI and the objectives need.
 */
import { TICK_RATE } from '../core/constants';
import type { GameBus } from '../core/context';
import type { GameEvents } from '../core/gameEvents';
import { mulberry32 } from '../core/math';
import { blockOf, furnaceTierOfBlock, machine } from '../core/registry';
import { voxelActive, withActive, type BlockDef, type Face, type IWorld, type WeatherState } from '../core/types';
import type { GameClock } from '../game/clock';
import type { Inventory } from '../game/inventory';
import type { PlayerState } from '../game/playerState';
import { cratesNear, pushToCrates } from './crates';
import { isPlant, isPlantBlock, type CropView } from './cropRules';
import { CropField } from './crops';
import {
  OK, createFurnace, createMachine, isFurnace, posKey, refuse, resizeFurnace,
  type ActionResult, type FurnaceEntity, type MachineEntity, type SimEntity, type SimNode,
} from './entities';
import { Endpoints, type FluidEndpoint, type ItemEndpoint } from './endpoints';
import { explode, meltDown } from './fission';
import { applyFurnace, prepareFurnace, statsOf } from './furnace';
import * as actions from './furnaceActions';
import type { ActionHost, ForgeResult } from './furnaceActions';
import { gridSummary, machineView, networkStats, type GridSummary, type MachineView, type NetworkStats } from './gridViews';
import { HearthSet } from './hearth';
import { furnaceStats, type FurnaceStats } from './hearthStats';
import { structureView, type StructureTarget, type StructureView } from './hearthView';
import { windAt } from './machines';
import { NodeSet } from './nodes';
import type { Network } from './power';
import { SlotAccess, type FurnaceSlots } from './slots';
import { forgeRows, furnaceView, type ForgeRow, type FurnaceView } from './views';
import { SimWeather, type SimBiomeLookup } from './weather';

const WIND = machine('wind_turbine').params ?? {};

export class Simulation implements ActionHost {
  /** Sunlight factor and wind factor of the current tick (read by solar panels and wind turbines). */
  sunlight = 1;
  wind = 1;
  /** Solar multiplier of the weather this tick (1 without weather). */
  solar = 1;
  /** The weather's effects on machines, furnaces and crops (spec 15); fair weather until `useWeather`. */
  readonly weather = new SimWeather();
  private readonly rainAt = (x: number, y: number, z: number): boolean => this.weather.wetAt(x, y, z);
  /** True on one tick per second. */
  everySecond = false;
  readonly random: () => number;

  private readonly nodes: NodeSet;
  private readonly crops: CropField;
  /** Set while an explosion removes blocks: what the machines held is lost, not returned. */
  private destroying = false;
  private tickCount = 0;
  private readonly flags = new Set<string>();
  private readonly meltdowns: SimNode[] = [];
  private readonly slots = new SlotAccess((e) => this.statsOfFurnace(e));
  private readonly hearths: HearthSet;
  private readonly endpoints: Endpoints;
  readonly giveBack = (item: string): void => {
    this.player.give(item, 1);
  };
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
    this.crops = new CropField(world, bus);
    const nodes = this.nodes;
    this.hearths = new HearthSet({
      world, bus, player, byKey: nodes.byKey,
      setActive: (node, active) => this.setActive(node, active),
      shellChanged: (min, max) => nodes.shellChanged(min, max),
    });
    nodes.links = this.hearths.links;
    nodes.shellOwner = (key) => this.hearths.shellOwner(key)?.e ?? null;
    this.endpoints = new Endpoints({
      machineSlots: (e) => this.slots.machine(e),
      furnaceSlots: (e) => this.slots.furnace(e),
      furnaceStats: (e) => this.statsOfFurnace(e),
      touch: (e) => this.touch(e),
    });
    const chunkChanged = ({ cx, cz }: { cx: number; cz: number }): void => {
      this.nodes.chunkChanged(cx, cz);
      this.crops.chunkChanged(cx, cz);
      this.hearths.chunkChanged(cx, cz);
    };
    this.offs.push(
      bus.on('block:changed', (ev) => this.onBlockChanged(ev)),
      bus.on('chunk:loaded', chunkChanged),
      bus.on('chunk:unloaded', chunkChanged),
      bus.on('ui:opened', ({ screen }) => {
        const furnace = screen.type === 'furnace' && this.furnaceAt(screen.x, screen.y, screen.z);
        this.hearths.screenAt = furnace ? posKey(screen.x, screen.y, screen.z) : null;
        if (furnace) player.setHome(screen.x, screen.y, screen.z);
      }),
      bus.on('ui:closed', () => {
        this.hearths.screenAt = null;
      }),
    );
    this.resync();
  }

  /**
   * Follows the world's weather (read every tick; pass the Weather's live `state`) with a biome lookup for where
   * rain turns to snow or dust. Null = always fair.
   */
  useWeather(weather: WeatherState | null, biomeAt: SimBiomeLookup | null): void {
    this.weather.use(weather, biomeAt);
  }

  dispose(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  /** Where rain soaks exposed crops this tick, or null when nothing soaks anywhere (the crops skip the check). */
  private get wetAt(): ((x: number, y: number, z: number) => boolean) | null {
    return this.weather.soaks ? this.rainAt : null;
  }

  /** Rebuilds the runtime from the world's entities. Call after a save was loaded into the world. */
  resync(): void {
    this.nodes.clear();
    this.crops.clear();
    this.hearths.clear();
    for (const e of this.world.entities()) {
      if (isPlant(e)) this.crops.track(e);
      else this.trackNode(e as SimEntity);
    }
  }

  private trackNode(e: SimEntity): SimNode {
    const node = this.nodes.track(e);
    if (isFurnace(e)) this.hearths.track(node);
    this.lampSeen(node, true);
    return node;
  }

  // ---- ticking ------------------------------------------------------------------------------------------------

  tick(dt: number): void {
    this.tickCount++;
    this.everySecond = this.tickCount % TICK_RATE === 0;
    const { world, nodes } = this;
    this.hearths.tick(dt);
    nodes.fresh();
    const weather = this.weather;
    weather.update();
    this.sunlight = this.clock.sunlight();
    this.wind = windAt(this.clock.worldTimeS, WIND.windMin, WIND.windMax) * weather.wind;
    this.solar = weather.solar;

    for (const n of nodes.furnaces) n.loaded = world.isLoaded(n.e.x, n.e.z);
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
    for (const n of nodes.furnaces) if (n.loaded) applyFurnace(n, this, dt, weather.furnaceLoss(n));
    this.crops.tick(dt, this.sunlight, this.wetAt);

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
    this.hearths.blockChanged(x, y, z);
    this.crops.blockChanged(x, y, z, from, to);
    // Crops and wild bushes (spec 12.4, 14) are plants the crops follow, never machines.
    const fromCrop = isPlantBlock(from);
    if (isPlantBlock(to)) {
      // A crop growing a stage, a bush picked or fruiting, or planted: nothing a machine looks at changes.
      if (!fromCrop) this.machineBlockChanged(x, y, z, from, to);
      this.crops.place(x, y, z, to);
      return;
    }
    if (fromCrop) this.crops.remove(x, y, z);
    this.machineBlockChanged(x, y, z, from, to);
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
    this.trackNode(e);
    if (ev.source !== 'load') this.bus.emit('machine:placed', { entity: e });
    if (ev.source === 'player' && isFurnace(e)) this.player.setHome(x, y, z);
  }

  /** Refreshes the machines a block change concerns, and removes the machine that stood there if it is gone. */
  private machineBlockChanged(x: number, y: number, z: number, from: BlockDef, to: BlockDef): void {
    this.nodes.blockChanged(x, y, z, from.power !== null || to.power !== null, from.machine === 'water_wheel' || to.machine === 'water_wheel');
    const node = this.nodes.byKey.get(posKey(x, y, z));
    if (node && node.e.kind !== to.machine) this.removeMachine(node);
  }

  /** Tells the crops about a lamp that is lit (`present`) or gone. */
  private lampSeen(node: SimNode, present: boolean): void {
    if (node.e.kind === 'lamp') this.crops.lampChanged(node.e.x, node.e.y, node.e.z, present && node.active);
  }

  private removeMachine(node: SimNode): void {
    const e = node.e;
    this.lampSeen(node, false);
    if (isFurnace(e)) this.hearths.untrack(node);
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
    this.lampSeen(node, true);
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
    this.hearths.validate();
    const node = this.nodes.byKey.get(posKey(x, y, z));
    return node && isFurnace(node.e) ? fn(node.e, node) : refuse('There is no furnace here');
  }

  light(x: number, y: number, z: number): ActionResult {
    return this.withFurnace(x, y, z, (e, node) => actions.light(this, e, node));
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
    this.hearths.validate();
    const e = this.furnaceAt(x, y, z);
    return e ? actions.forge(this, e, recipeId, times) : { ok: false, reason: 'There is no furnace here' };
  }

  upgrade(x: number, y: number, z: number): ActionResult {
    const result = this.withFurnace(x, y, z, (e) => actions.upgrade(this, e));
    // The new tier counts at once (crucibles, temperatures) instead of on the next tick.
    if (result.ok) this.validateHearths();
    return result;
  }

  startIgnition(x: number, y: number, z: number): ActionResult {
    this.nodes.fresh();
    return this.withFurnace(x, y, z, (e, node) => actions.startIgnition(this, e, node));
  }

  rest(x: number, y: number, z: number): ActionResult {
    return this.withFurnace(x, y, z, (e, node) => actions.rest(this, e, node));
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
    this.hearths.validate();
    this.nodes.fresh();
    const key = posKey(x, y, z);
    const node = this.nodes.byKey.get(key);
    if (!node || !isFurnace(node.e)) return null;
    this.weather.update();
    const hearth = this.hearths.get(key) ?? null;
    hearth?.refreshStats();
    return furnaceView(this, node, this.weather.furnaceLoss(node), hearth);
  }

  // ---- multiblock hearths (spec 17) -------------------------------------------------------------------------------

  /**
   * The STRUCTURE tab of the furnace at a position: status, checklist, problems, and for `target` (default: the tier
   * the furnace needs next) the materials and the ghost-preview cells. Null when there is no furnace.
   */
  structureView(x: number, y: number, z: number, target?: StructureTarget): StructureView | null {
    this.hearths.validate();
    const key = posKey(x, y, z);
    const node = this.nodes.byKey.get(key);
    if (!node || !isFurnace(node.e)) return null;
    return structureView(this.world, node.e, this.hearths.get(key)?.scan ?? null, this.stationSources(x, y, z), target);
  }

  /** Runs every hearth scan that is due now (each tick does this first; for callers that need edits seen at once). */
  validateHearths(): void {
    this.hearths.validate();
    for (const h of this.hearths.list) h.refreshStats();
  }

  /**
   * What a pipe end touching the block at x, y, z on `face` may put in and take out (spec 16.2): a furnace's smart
   * sides, a crate's or a machine's slots; an item hatch of a formed hearth stands for its controller. Null for
   * anything else. `face` is the side of that block the pipe touches; every side of today's blocks behaves the same.
   */
  itemEndpoint(x: number, y: number, z: number, face: Face): ItemEndpoint | null {
    const key = posKey(x, y, z);
    const node = this.nodes.byKey.get(key);
    if (!node) return null;
    if (node.e.kind === 'item_hatch') {
      const owner = this.hearths.shellOwner(key);
      return owner ? this.endpoints.item(owner.e) : null;
    }
    return node.spec.role === 'hearth_part' ? null : this.endpoints.item(node.e);
  }

  /**
   * The fluid side of the block at x, y, z (spec 16.2): a machine with fluid ports, through its buffers. A fluid hatch
   * counts only as part of a formed hearth (its lava fuels the controller). Null for anything else.
   */
  fluidEndpoint(x: number, y: number, z: number, face: Face): FluidEndpoint | null {
    const key = posKey(x, y, z);
    const node = this.nodes.byKey.get(key);
    if (!node) return null;
    if (node.e.kind === 'fluid_hatch' && !this.hearths.shellOwner(key)) return null;
    return this.endpoints.fluid(node.e);
  }

  /** The numbers a furnace entity runs at (its node's; a furnace no longer tracked counts as standing alone). */
  private statsOfFurnace(e: FurnaceEntity): FurnaceStats {
    const node = this.nodes.byKey.get(posKey(e.x, e.y, e.z));
    return node && node.e === e ? statsOf(node) : furnaceStats(e.tier, null);
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

  /** What the crop at a position is doing (stage, light, water, status), or null. Crops have no machine view. */
  cropView(x: number, y: number, z: number): CropView | null {
    this.weather.update();
    return this.crops.view(x, y, z, this.clock.sunlight(), this.wetAt);
  }

  /** Furnaces, machines and crates (crops are counted by `cropCount`). */
  get entityCount(): number {
    return this.nodes.all.length;
  }

  get cropCount(): number {
    return this.crops.count;
  }

  /** Crops visited on a tick (the others sleep until something relevant changes): a diagnostic. */
  get cropsAwake(): number {
    return this.crops.awakeCount;
  }
}
