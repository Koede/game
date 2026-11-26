/**
 * Test fixture for the scripted playthrough: a diligent player over the fake world who only does what a real
 * player can do - gather blocks, hand/workbench crafting, placing and breaking blocks, moving stacks between
 * inventories with the game's transfer functions, and pressing the furnace and machine buttons. Survival, the
 * clock and the objective tracker run alongside the simulation. Imported by path from tests only.
 */
import { DT } from '../core/constants';
import { block, blockId, blockOf, item, recipe } from '../core/registry';
import { makeVoxel, type Voxel } from '../core/types';
import { craftByPlayer } from '../game/crafting';
import type { Inventory } from '../game/inventory';
import { ObjectiveTracker } from '../game/objectives';
import { Survival } from '../game/survival';
import { quickMove, transfer } from '../game/transfer';
import type { FurnaceEntity } from './entities';
import { makeKit, type Kit } from './testKit';
import type { FurnaceView } from './views';

/** Facing of everything the player places: the front looks south, towards where the player stands. */
const SOUTH = 2;

export interface Pos {
  x: number;
  y: number;
  z: number;
}

/** "3 copper_ore, 1 tin_ore" -> [['copper_ore', 3], ['tin_ore', 1]] */
const parse = (text: string): Array<[string, number]> =>
  text.split(',').map((part) => {
    const [n, key] = part.trim().split(/\s+/);
    return [key, Number(n)];
  });

export class Play {
  readonly kit: Kit;
  readonly survival: Survival;
  readonly tracker: ObjectiveTracker;
  /** The home furnace. */
  readonly at: Pos;
  /** Crates near the furnace, in placing order. */
  readonly crates: Pos[] = [];
  /** Fuel the player keeps the firebox stocked with (null: leave the fire alone). */
  fuel: string | null = null;
  /** Game seconds played. */
  time = 0;
  private sinceTend = 0;

  constructor(at: Pos) {
    this.kit = makeKit();
    this.at = at;
    this.survival = new Survival(this.kit.world, this.kit.player, this.kit.clock, () => 'woodland');
    this.tracker = new ObjectiveTracker(this.kit.bus, this.kit.player, this.kit.sim);
  }

  get sim() {
    return this.kit.sim;
  }

  get player() {
    return this.kit.player;
  }

  get furnace(): FurnaceEntity {
    const e = this.sim.furnaceAt(this.at.x, this.at.y, this.at.z);
    if (!e) throw new Error('the home furnace is gone');
    return e;
  }

  view(): FurnaceView {
    const v = this.sim.furnaceView(this.at.x, this.at.y, this.at.z);
    if (!v) throw new Error('the home furnace is gone');
    return v;
  }

  // ---- time ---------------------------------------------------------------------------------------------------

  /** Plays on for this many seconds: the 20 Hz tick of the game loop, plus tending the fire once a second. */
  step(seconds: number): void {
    const ticks = Math.round(seconds / DT);
    const { clock, sim } = this.kit;
    for (let i = 0; i < ticks; i++) {
      clock.tick(DT);
      sim.tick(DT);
      this.survival.tick(DT);
      this.tracker.tick(DT);
      this.time += DT;
      this.sinceTend += DT;
      if (this.sinceTend >= 1) {
        this.sinceTend = 0;
        this.tend();
        // Machines wear out (src/sim/wear.ts): the scripted player services a broken one at once, ingots found along the way.
        for (const w of this.sim.wornMachines(1)) {
          this.player.inventory.add('iron_ingot', 3);
          this.sim.repairMachine(w.x, w.y, w.z);
        }
      }
    }
  }

  /** Plays until `done` holds; fails with the furnace's status if it takes longer than `maxS`. */
  until(what: string, done: () => boolean, maxS: number): void {
    const start = this.time;
    while (!done()) {
      if (this.time - start > maxS) {
        const v = this.view();
        throw new Error(`${what}: not after ${maxS} s (furnace ${v.tempC.toFixed(0)} C, "${v.status}", grid ${JSON.stringify(this.sim.grid())})`);
      }
      this.step(0.25);
    }
  }

  /** Waits for the furnace to reach a temperature. */
  heat(tempC: number, maxS = 600): void {
    this.until(`heat to ${tempC} C`, () => this.furnace.tempC >= tempC, maxS);
  }

  /** Keeps the firebox stocked and lit, as a player standing by the furnace would. */
  private tend(): void {
    if (!this.fuel || this.furnace.ignited) return;
    const box = this.furnaceSlots().fuel;
    const n = Math.min(12, this.have(this.fuel), box.space(this.fuel));
    if (box.count(this.fuel) < 4 && n > 0) this.load(box, this.fuel, n);
    if (!this.furnace.lit && box.count(this.fuel) > 0) this.sim.light(this.at.x, this.at.y, this.at.z);
  }

  // ---- inventories ----------------------------------------------------------------------------------------------

  furnaceSlots() {
    const s = this.sim.furnaceSlots(this.at.x, this.at.y, this.at.z);
    if (!s) throw new Error('the home furnace is gone');
    return s;
  }

  machineSlots(p: Pos): Inventory {
    const inv = this.sim.machineSlots(p.x, p.y, p.z);
    if (!inv) throw new Error(`no machine at ${p.x},${p.y},${p.z}`);
    return inv;
  }

  /** The pack, then the crates near the furnace: everything the player can reach from the furnace screen. */
  sources(): Inventory[] {
    return this.sim.stationSources(this.at.x, this.at.y, this.at.z);
  }

  have(itemKey: string): number {
    let n = 0;
    for (const inv of this.sources()) n += inv.count(itemKey);
    return n;
  }

  /** Raw materials found in the world: they arrive in the pack and are carried to the crates. */
  find(list: string): void {
    for (const [key, count] of parse(list)) {
      let left = count;
      while (left > 0) {
        const n = Math.min(left, item(key).stack);
        if (this.player.give(key, n) !== 0) throw new Error(`no room in the pack for ${key}`);
        left -= n;
        this.stash();
      }
    }
  }

  /** Moves `count` of an item from the pack and crates into `to` (any of its slots, or one slot). */
  load(to: Inventory, itemKey: string, count: number, toSlot?: number): void {
    let left = count;
    for (const from of this.sources()) {
      for (let i = 0; i < from.size && left > 0; i++) {
        if (from.get(i)?.item !== itemKey) continue;
        const slots = toSlot === undefined ? [...Array(to.size).keys()] : [toSlot];
        for (const j of slots) {
          if (left <= 0 || from.get(i) === null) break;
          left -= transfer(from, i, to, j, left);
        }
      }
    }
    if (left > 0) throw new Error(`could not load ${count} ${itemKey} (${left} left over)`);
  }

  /** Takes every stack out of an inventory into the pack, then carries the pack to the crates. */
  collect(from: Inventory): void {
    for (let i = 0; i < from.size; i++) if (from.get(i)) quickMove(from, i, this.player.inventory);
    this.stash();
  }

  /** Empties the pack into the crates (tools stay in the pack). */
  stash(): void {
    const pack = this.player.inventory;
    for (let i = 0; i < pack.size; i++) {
      const s = pack.get(i);
      if (!s || s.durability !== undefined) continue;
      for (const c of this.crates) {
        if (!pack.get(i)) break;
        quickMove(pack, i, this.machineSlots(c));
      }
    }
  }

  // ---- the world ------------------------------------------------------------------------------------------------

  /** Mines `count` blocks of a kind somewhere out in the world and pockets what they drop. */
  gather(blockKey: string, count: number, drops: string): void {
    const v = makeVoxel(blockId(blockKey));
    for (let i = 0; i < count; i++) this.kit.bus.emit('block:broken', { x: 1000, y: 40, z: i, voxel: v });
    for (const [key, n] of parse(drops)) this.player.give(key, n);
    this.step(0.5);
  }

  /** Places a block item from the pack (fetched from a crate if needed), as the player's "use" does. */
  place(blockKey: string, p: Pos): void {
    if (this.player.inventory.count(blockKey) === 0) this.load(this.player.inventory, blockKey, 1);
    if (this.player.inventory.remove(blockKey, 1) !== 1) throw new Error(`no ${blockKey} to place`);
    const v: Voxel = makeVoxel(blockId(blockKey), block(blockKey).oriented ? SOUTH : 0);
    this.kit.world.setVoxel(p.x, p.y, p.z, v, 'player');
    this.kit.bus.emit('block:placed', { x: p.x, y: p.y, z: p.z, voxel: v });
    if (blockKey === 'crate') this.crates.push(p);
    this.step(0.5);
  }

  /** Breaks a block with a pickaxe: it drops itself (machines hand back their contents through the simulation). */
  breakBlock(p: Pos): void {
    const v = this.kit.world.getVoxel(p.x, p.y, p.z);
    const def = blockOf(v);
    this.kit.world.setVoxel(p.x, p.y, p.z, 0, 'player');
    this.kit.bus.emit('block:broken', { x: p.x, y: p.y, z: p.z, voxel: v });
    if (def.itemKey) this.player.give(def.itemKey, 1);
  }

  /** Pours water from a pail (the environment the generators need). */
  pour(p: Pos): void {
    this.kit.world.setVoxel(p.x, p.y, p.z, makeVoxel(blockId('water')), 'player');
  }

  // ---- making things ----------------------------------------------------------------------------------------------

  /** Hand or workbench crafting (the workbench borrows from crates near it, like the furnace). */
  craft(recipeId: string, times = 1, bench?: Pos): void {
    const r = recipe(recipeId);
    if (!r) throw new Error(`no recipe ${recipeId}`);
    const crates = bench ? this.sim.stationSources(bench.x, bench.y, bench.z).slice(1) : [];
    const result = craftByPlayer(this.player, r, { crates, times });
    if (!result.ok) throw new Error(`craft ${recipeId}: ${result.reason}`);
    this.step(0.5);
  }

  /** Forges a recipe `times` times at the home furnace, waiting for the heat to come back between chills. */
  forge(recipeId: string, times = 1): void {
    let left = times;
    while (left > 0) {
      const row = this.view().forge.find((r) => r.recipe.id === recipeId);
      if (!row) throw new Error(`no forge recipe ${recipeId}`);
      if (row.locked) throw new Error(`forge ${recipeId}: ${row.reason}`);
      if (!row.tempOk) {
        this.heat(row.recipe.minTempC, 300);
        continue;
      }
      if (!row.canMake) throw new Error(`forge ${recipeId}: ${row.reason}`);
      const result = this.sim.forge(this.at.x, this.at.y, this.at.z, recipeId, Math.min(left, row.heatAllows));
      if (!result.ok) throw new Error(`forge ${recipeId}: ${result.reason}`);
      left -= result.made;
      this.stash();
    }
    this.step(0.5);
  }

  /**
   * Pours every crucible's molten metal into ingot moulds (casting, docs/api/casting.md): the pack gets a mould when it
   * has none - a STAND-IN for the clay table and the firing - and the ingots go to the crates. True when nothing is
   * molten any more.
   */
  pourMolten(): boolean {
    const e = this.furnace;
    let clear = true;
    for (let i = 0; i < e.crucibleMelt.length; i++) {
      if (!e.crucibleMelt[i] || e.crucibleMoltenS[i] <= 0) continue;
      if (!this.player.inventory.has('ingot_mould')) this.player.inventory.add('ingot_mould', 1);
      const r = this.sim.pourCrucible(this.at.x, this.at.y, this.at.z, i, 'ingot_mould');
      if (!r.ok) throw new Error(`pour crucible ${i}: ${r.reason}`);
      clear = clear && !e.crucibleMelt[i];
    }
    this.stash();
    return clear;
  }

  /** Smelts `count` input items in the working crucibles, a batch at a time, and carries the products to the crates. */
  smelt(input: string, count: number): void {
    const slots = this.furnaceSlots();
    const crucibles = this.view().cruciblesActive;
    let left = count;
    while (left > 0) {
      const each = Math.min(Math.ceil(left / crucibles), 40);
      for (let i = 0; i < crucibles && left > 0; i++) {
        const n = Math.min(each, left);
        this.load(slots.crucibleIn, input, n, i);
        left -= n;
      }
      this.until(`smelt ${input}`, () => this.pourMolten() && slots.crucibleIn.count(input) === 0, 1200);
      this.collect(slots.crucibleOut);
    }
    this.step(0.5);
  }

  /**
   * Feeds a processing machine `count` input items and waits until it has done all it can with them. Products
   * pushed into a touching crate stay there; products left in the output slot are carried to the crates.
   */
  process(p: Pos, input: string, count: number): void {
    const inv = this.machineSlots(p);
    const name = this.sim.machineView(p.x, p.y, p.z)?.name ?? 'machine';
    let left = count;
    for (;;) {
      if (inv.get(0) === null && left > 0) {
        const n = Math.min(left, item(input).stack);
        this.load(inv, input, n, 0);
        left -= n;
      }
      this.step(0.1);
      this.until(`${name} on ${input}`, () => {
        const e = this.sim.machineAt(p.x, p.y, p.z);
        if (!e) throw new Error(`${name} is gone`);
        return e.slots[0] === null || e.recipe === null || this.sim.machineView(p.x, p.y, p.z)?.status === 'Output is full';
      }, 3000);
      if (inv.get(1)) quickMove(inv, 1, this.player.inventory);
      const e = this.sim.machineAt(p.x, p.y, p.z);
      if (e && e.slots[0] !== null && e.recipe === null) quickMove(inv, 0, this.player.inventory);
      this.stash();
      if (inv.get(0) === null && left === 0) return;
    }
  }

  /**
   * Builds the hearth of `tier` around the home furnace the way the STRUCTURE tab's ghost preview shows it: breaks
   * every block that is in the way, places every block that is missing (from the pack or the crates), and checks that
   * it formed. Returns how many blocks were placed.
   */
  buildHearth(tier: number): number {
    const { x, y, z } = this.at;
    const plan = this.sim.structureView(x, y, z, { tier });
    if (!plan) throw new Error('the home furnace is gone');
    const short = plan.target.materials.filter((m) => !m.ok).map((m) => `${m.missing - m.have} ${m.item}`);
    if (short.length > 0) throw new Error(`hearth ${tier}: short of ${short.join(', ')}`);
    let placed = 0;
    for (const c of plan.target.cells) {
      if (c.state === 'ok') continue;
      if (c.state === 'wrong') this.breakBlock(c);
      if (c.want === 'air') continue;
      this.place(c.want, c);
      placed++;
    }
    this.stash();
    const built = this.sim.structureView(x, y, z, { tier });
    if (!built || built.tier < tier) throw new Error(`hearth ${tier} did not form: ${JSON.stringify(built?.problems)}`);
    return placed;
  }

  /** Checks the result of one of the furnace's or a machine's buttons, then lets half a second pass. */
  must(result: { ok: boolean; reason?: string }, what: string): void {
    if (!result.ok) throw new Error(`${what}: ${result.reason}`);
    this.step(0.5);
  }
}
