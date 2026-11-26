/**
 * The proof that the core loop works: one long scripted game through the public API only - raw materials are
 * found, everything else is crafted, smelted, forged, crushed, distilled, spun and split by the real rules, the
 * furnace is upgraded in place from clay to Starhearth inside the hearth built around it for each tier (spec 17: the
 * player places every wall block), power grows from a thermopile to fission piles, and the Starhearth is ignited. The
 * objective tracker and survival run alongside, so every objective must complete too.
 */
import { describe, expect, it } from 'vitest';
import { FLAG_AUTOMATON_SALVAGED, FLAG_BOILED_WATER, FLAG_BREWED, FLAG_DROVE_TRACTOR, FLAG_FELLED_TREE, FLAG_FIRST_POUR, FLAG_SIX_CUPS, FURNACE_HOT_C, REGEN_MIN_FOOD } from '../core/constants';
import { OBJECTIVES, blockId, blockOf, furnaceTier, machine } from '../core/registry';
import { Face, voxelActive } from '../core/types';
import { eat, plant, till, type UseTarget } from '../game';
import { swapSlots } from '../game/transfer';
import type { FakeWorld } from '../game/fakeWorld';
import { Play, type Pos } from './playKit';

/**
 * The home furnace faces south (the way the player looks at it), so its hearth lies north of it: the hearths grow
 * from a 1x1x1 inside (Blast, Arc) to 2x2x2 (Plasma) and 3x3x3 (Starhearth), all within x -3..1, z -4..0, y 0..4.
 * Everything else stays out of that block.
 */
const F = { x: 0, y: 1, z: 0 };
const BENCH = { x: -2, y: 1, z: 5 };
/** The Ember Age's hand stations, in a row beside the bench (docs/api/handwork.md). */
const CHOP = { x: -4, y: 1, z: 5 };
const QUERN = { x: -5, y: 1, z: 5 };
const ANVIL = { x: -6, y: 1, z: 5 };
const CLAY_TABLE = { x: -7, y: 1, z: 5 };
const LOOM = { x: -8, y: 1, z: 5 };
const RACK = { x: -9, y: 1, z: 5 };
const TROUGH = { x: -10, y: 1, z: 5 };
/** Twelve crates south-west of the furnace, within its reach (and the bench's). */
const CRATES = [2, 3, 4].flatMap((z) => [-1, -2, -3, -4].map((x) => ({ x, y: 1, z })));
/** At the furnace's mouth: it touches the furnace and carries the grid to it. */
const THERMOPILE = { x: 0, y: 1, z: 1 };
const LAMP = { x: -1, y: 1, z: 1 };
/** On the furnace: the Blast hearth's open top leaves room for it. */
const STEAM = { x: 0, y: 2, z: 0 };
/** A patch of grass beside the base: tilled into farmland and sown with wheat. */
const FIELD = { x: 5, y: 1, z: 5 };
/** What the player eats, best first, when the bar drops to the line below which health stops regenerating. */
const MEALS = ['hearth_stew', 'cooked_chop', 'bread', 'baked_potato'];
/** The hotbar slot the script puts things in hand with. */
const HAND = 8;

/** The power bus: a run of cable east from the thermopile along z = 1, machines on both sides of it. */
const BUS = [1, 2, 3, 4, 5, 6, 7, 8].map((x) => ({ x, y: 1, z: 1 }));
const CRUSHER = { x: 3, y: 1, z: 2 };
/** Spec 19.4: on the bus beside the crusher. */
const WARD = { x: 2, y: 1, z: 2 };
const BATTERY = { x: 4, y: 1, z: 2 };
const BURNERS = [{ x: 5, y: 1, z: 2 }, { x: 6, y: 1, z: 2 }, { x: 2, y: 1, z: 0 }];
const STILL = { x: 3, y: 1, z: 0 };
const ENGINES = [{ x: 4, y: 1, z: 0 }, { x: 5, y: 1, z: 0 }];
const CENTRIFUGE = { x: 7, y: 1, z: 2 };
/** The fission pile, with water above it and beside it. */
const PILE = { x: 8, y: 1, z: 2 };
const BANKS = [{ x: 7, y: 1, z: 0 }, { x: 9, y: 1, z: 1 }];
const ELECTROLYZER = { x: 10, y: 1, z: 1 };
/**
 * Spec 16, items: ore is piped from a crate into an item hatch in the hearth's east wall, ingots out of a hatch in the
 * north wall into a crate within the furnace's reach (so forging takes them from there). The Plasma hearth swallows
 * the north hatch; the ingots then leave through a second hatch in the east wall.
 */
const IN_HATCH = { x: 1, y: 1, z: -1 };
const IN_PIPES = [2, 3, 4].map((x) => ({ x, y: 1, z: -1 }));
const ORE_CRATE = { x: 5, y: 1, z: -1 };
const OUT_HATCH = { x: 0, y: 1, z: -2 };
const OUT_PIPE = { x: 0, y: 1, z: -3 };
const OUT_CRATE = { x: 0, y: 1, z: -4 };
const OUT2_HATCH = { x: 1, y: 1, z: -2 };
const OUT2_PIPES = [{ x: 2, y: 1, z: -2 }, { x: 2, y: 1, z: -3 }];
const OUT2_CRATE = { x: 3, y: 1, z: -3 };
/**
 * Spec 16, fluids, on the Arc hearth's roof: a pump in a pool feeds a steam engine and a boiler; the boiler's steam
 * runs a turbine through a hot pipe. Two cables put the engine on the grid. The pool is 2x2, so the source the pump
 * draws from has two sources beside it and never runs dry (spec 18.3).
 */
const POOL = [{ x: -1, y: 3, z: -1 }, { x: -1, y: 3, z: -2 }, { x: 0, y: 3, z: -1 }, { x: 0, y: 3, z: -2 }];
const PUMP = { x: -1, y: 3, z: 0 };
const ROOF_ENGINE = { x: 0, y: 3, z: 0 };
const BOILER = { x: 1, y: 3, z: -1 };
const WATER_PIPES = [{ x: -1, y: 4, z: 0 }, { x: 0, y: 4, z: 0 }, { x: 1, y: 4, z: 0 }, { x: 1, y: 4, z: -1 }];
const STEAM_PIPES = [{ x: 2, y: 3, z: -1 }, { x: 2, y: 3, z: 0 }, { x: 2, y: 3, z: 1 }, { x: 2, y: 2, z: 1 }];
const TURBINE = { x: 1, y: 2, z: 1 };
const ROOF_CABLES = [{ x: 0, y: 2, z: 1 }, { x: 0, y: 3, z: 1 }];

/** The player's crosshair on the top face of a block (what a hoe tills and seeds are sown on). */
function aimDown(world: FakeWorld, p: { x: number; y: number; z: number }): UseTarget {
  return { x: p.x, y: p.y, z: p.z, face: Face.PY, px: p.x, py: p.y + 1, pz: p.z, block: world.getBlock(p.x, p.y, p.z) };
}

/** The scripted player also eats, through the real eating rule, whenever it gets peckish (spec 12.1). */
class FedPlay extends Play {
  meals = 0;

  /** Takes an item into the hand: from the hotbar if it is there, else fetched into the HAND slot. */
  hold(itemKey: string): void {
    const pack = this.player.inventory;
    for (let i = 0; i < 9; i++) {
      if (pack.get(i)?.item !== itemKey) continue;
      this.player.selectSlot(i);
      return;
    }
    const at = pack.slots.findIndex((s) => s?.item === itemKey);
    if (at >= 0) swapSlots(pack, at, pack, HAND);
    else {
      if (pack.get(HAND)) swapSlots(pack, HAND, pack, pack.firstEmpty());
      this.load(pack, itemKey, 1, HAND);
    }
    this.player.selectSlot(HAND);
  }

  step(seconds: number): void {
    // In slices, so even a long wait by the furnace has supper on time.
    for (let left = seconds; left > 1e-9; left -= 20) {
      super.step(Math.min(20, left));
      this.eatIfPeckish();
    }
  }

  /**
   * Works at a hand station (docs/api/handwork.md) the way a player does: loads `input` (one Use per item where several
   * recipes share it), strikes with `tool` in hand (or bare hands) until the work bar fills, takes each output. Returns
   * once `count` input items are used up.
   */
  work(p: Pos, input: string, count: number, tool: string | null = null, perLoad = 16): void {
    const { x, y, z } = p;
    const loaded = (): number => this.sim.handView(x, y, z)?.input?.count ?? 0;
    let left = count;
    while (left > 0) {
      if (loaded() === 0) {
        const have = this.have(input);
        if (have === 0) throw new Error(`work: no ${input} left`);
        for (let guard = 0; guard < 99 && loaded() < Math.min(left, have, perLoad); guard++) {
          this.hold(input);
          this.must(this.sim.stroke(x, y, z, input), `load ${input}`);
        }
      }
      if (tool) this.hold(tool);
      for (let guard = 0; guard < 400 && !this.sim.handView(x, y, z)?.output; guard++) {
        const before = loaded();
        this.must(this.sim.stroke(x, y, z, tool), `strike ${input}`);
        left -= before - loaded();
        this.eatIfPeckish();
      }
      this.must(this.sim.stroke(x, y, z, null), `take at ${input}`);
    }
    if (loaded() > 0) this.must(this.sim.handReturn(x, y, z), `take back ${input}`);
    this.step(0.5);
  }

  /** Copper wire at the stone anvil: one ingot loaded at a time makes wire (two would make a plate). */
  wire(n: number): void {
    this.work(ANVIL, 'copper_ingot', Math.ceil(n / 3), null, 1);
  }

  /** STAND-IN (casting replaces): bronze ingots, which the alloy pot and the moulds will make. */
  bronze(n: number): void {
    this.find(`${n} bronze_ingot`);
    this.made('bronze_ingot', n);
  }

  /** STAND-IN (handwork sim and casting replace): an item that was made at a hand station or poured, announced the way the sim will. */
  made(item: string, count: number): void {
    this.kit.bus.emit('item:made', { item, count, station: 'hand', recipeId: item });
    this.step(0.5);
  }

  private eatIfPeckish(): void {
    if (this.player.food > REGEN_MIN_FOOD) return;
    const meal = MEALS.find((m) => this.have(m) > 0);
    if (!meal) return;
    this.hold(meal);
    const result = eat(this.player);
    if (!result.ok) throw new Error(`could not eat ${meal}: ${result.reason}`);
    this.meals++;
  }
}
describe('scripted playthrough', () => {
  it('walks the whole tech tree from a clay furnace to an ignited Starhearth', () => {
    const play = new FedPlay(F);
    const { sim, player, tracker, kit } = play;
    kit.world.put(FIELD.x, FIELD.y, FIELD.z, 'grass');
    const won = kit.record('game:won');
    const alerts = kit.record('power:alert');
    const ages = kit.record('age:advanced');
    const flags = kit.record('flag');
    const toasts = kit.record('toast');
    const damage = kit.record('player:damage');
    const hearths = kit.record('hearth:formed');
    const done = (id: string) => expect(tracker.isComplete(id), `objective ${id}`).toBe(true);
    const log: string[] = [];
    const mark = (what: string) => log.push(`${(play.time / 60).toFixed(1).padStart(6)} min  ${what}`);

    // ---- Ember Age: wood, flint, a clay furnace ------------------------------------------------------------------
    play.gather('oak_log', 44, '44 oak_log');
    done('gather_logs');
    play.craft('chopping_block');
    play.place('chopping_block', CHOP);
    play.work(CHOP, 'oak_log', 30);
    done('make_planks');
    play.craft('workbench');
    play.place('workbench', BENCH);
    done('place_workbench');
    play.gather('gravel', 6, '6 gravel, 8 flint');
    done('find_flint');
    play.gather('tall_grass', 24, '24 fiber');
    play.craft('cord', 8);
    play.work(CHOP, 'plank', 4);
    play.craft('flint_pickaxe');
    done('make_pickaxe');
    play.gather('stone', 12, '12 rubble');
    play.gather('clay', 6, '6 clay');
    done('collect_clay');
    // The hand stations: a quern for flour and a stone anvil for wire and plate, from stone brick.
    play.gather('stone', 8, '8 rubble');
    play.craft('stone_brick', 2, BENCH);
    play.craft('hand_quern', 1, BENCH);
    play.craft('stone_anvil', 1, BENCH);
    play.place('hand_quern', QUERN);
    play.place('stone_anvil', ANVIL);
    play.craft('furnace_clay', 1, BENCH);
    for (let i = 0; i < CRATES.length; i++) play.craft('crate', 1, BENCH);
    play.place('furnace_clay', F);
    done('place_furnace');
    expect(player.home).toEqual(F);
    for (const c of CRATES) play.place('crate', c);
    play.stash();

    expect(play.view()).toMatchObject({ tier: 1, lit: false, status: 'No fuel', home: true });
    expect(sim.light(F.x, F.y, F.z)).toEqual({ ok: false, reason: 'No fuel in the firebox' });
    play.load(play.furnaceSlots().fuel, 'oak_log', 4);
    expect(play.view().status).toBe('Ready to light');
    play.must(sim.light(F.x, F.y, F.z), 'light');
    done('light_furnace');
    play.must(sim.pump(F.x, F.y, F.z), 'pump');
    expect(flags).toContainEqual({ flag: 'bellows_pumped' });
    play.smelt('oak_log', 6);
    done('make_charcoal');
    play.until('Well-Warmed', () => tracker.isComplete('get_warm'), 60);
    expect(player.wellWarmed).toBe(true);
    // Supper, and food for the rest of the game: a boar's chops roast in the crucible at 200 C.
    play.find('12 raw_chop');
    play.smelt('raw_chop', 12);
    done('cook_food');
    expect(player.food).toBeLessThan(20);
    play.hold('cooked_chop');
    expect(eat(player)).toMatchObject({ ok: true, item: 'cooked_chop', hunger: 8 });
    play.step(0.5);
    done('eat_food');
    mark('furnace lit, charcoal, warm, fed');

    // STAND-IN (handwork sim and casting replace): a clay table, a pressed and fired ingot mould, and the first pour. Copper
    // smelts to plain ingots in this simulation until the molten window and the moulds are in (docs/api/handwork-content.md).
    play.find('1 clay');
    play.craft('clay_table', 1, BENCH);
    play.place('clay_table', CLAY_TABLE);
    play.find('3 clay');
    play.work(CLAY_TABLE, 'clay', 3);
    play.find('1 ingot_mould');
    play.made('ingot_mould', 1);
    play.step(0.5);
    done('place_clay_table');
    done('fire_mould');
    kit.bus.emit('flag', { flag: FLAG_FIRST_POUR });

    play.find('40 coal, 15 copper_ore, 5 tin_ore, 8 clay, 2 sand');
    play.fuel = 'coal';
    play.heat(780);
    // Bronze is no longer forged at the furnace: it is alloyed in the pot (docs/api/casting.md).
    expect(play.view().forge.find((r) => r.recipe.id === 'bronze_ingot')).toBeUndefined();
    play.smelt('copper_ore', 15);
    done('smelt_copper');
    play.craft('flint_hoe', 1, BENCH);
    play.hold('flint_hoe');
    expect(till(kit.world, player, aimDown(kit.world, FIELD))).toBe(true);
    expect(blockOf(kit.world.getVoxel(FIELD.x, FIELD.y, FIELD.z)).key).toBe('farmland');
    play.step(0.5);
    done('till_soil');
    expect(player.inventory.count('wheat_seeds')).toBe(4); // the objective's reward
    play.hold('wheat_seeds');
    expect(plant(kit.world, player, aimDown(kit.world, FIELD))).toEqual({ ...FIELD, y: FIELD.y + 1 });
    expect(kit.world.getVoxel(FIELD.x, FIELD.y + 1, FIELD.z)).toBe(blockId('wheat_0'));
    play.step(0.5);
    done('plant_seeds');
    // Flour at the quern, dough and bread, the brewing goals, then a copper plate at the anvil: the goals come in this order.
    play.find('4 wheat, 1 water_pail');
    play.work(QUERN, 'wheat', 4);
    done('grind_flour');
    play.craft('dough', 1, BENCH);
    play.smelt('dough', 1);
    done('bake_bread');
    // STAND-IN (the brewing simulation replaces these): the three brewing goals complete from their flags alone. The
    // real actions (a bucket boiled on the furnace, a cup brewed, all six drinks drunk) are tested in src/sim/brewing*.test.ts.
    for (const [flag, id] of [[FLAG_BOILED_WATER, 'boil_bucket'], [FLAG_BREWED, 'first_brew'], [FLAG_SIX_CUPS, 'six_cups']] as const) {
      kit.bus.emit('flag', { flag });
      play.step(0.5);
      done(id);
    }
    play.work(ANVIL, 'copper_ingot', 2, null, 2);
    done('hammer_plate');
    done('reach_800');
    play.smelt('tin_ore', 5);
    // The furnace's recipe list is the tech tree: higher tiers are listed, locked, with what they need.
    const steelRow = play.view().forge.find((r) => r.recipe.id === 'steel_ingot');
    expect(steelRow).toMatchObject({ locked: true, canMake: false, reason: 'Needs the Blast Furnace' });
    play.bronze(4);
    done('make_bronze');
    // Spec 19.4: a maul for the automatons that wake at night (four more bronze than the pickaxe alone needs).
    play.find('3 copper_ore, 1 tin_ore');
    play.smelt('copper_ore', 3);
    play.smelt('tin_ore', 1);
    play.bronze(1);
    play.find('1 bronze_maul_head, 1 bronze_pickaxe_head'); // STAND-IN (casting replaces): poured into the maul and pickaxe moulds
    play.made('bronze_pickaxe_head', 1);
    done('cast_pick_head');
    play.craft('bronze_maul', 1, BENCH);
    done('forge_maul');
    play.craft('bronze_pickaxe', 1, BENCH);
    done('bronze_pickaxe');
    // Stand-in for src/mobs until automatons fight: one is broken apart (a ruin's kiln sentry) and its salvage taken.
    play.find('3 scrap_metal, 2 ember_core');
    kit.bus.emit('flag', { flag: FLAG_AUTOMATON_SALVAGED });
    play.step(0.5);
    done('salvage_automaton');
    play.smelt('clay', 8);
    play.smelt('sand', 2);
    play.forge('thermopile');
    play.place('thermopile', THERMOPILE);
    play.step(2);
    expect(sim.machineView(THERMOPILE.x, THERMOPILE.y, THERMOPILE.z)!.availW).toBeCloseTo(0.25 * (800 - 100), 0);
    done('first_power');
    play.wire(1);
    play.forge('lamp');
    play.place('lamp', LAMP);
    play.step(1);
    done('place_lamp');
    expect(voxelActive(kit.world.getVoxel(LAMP.x, LAMP.y, LAMP.z))).toBe(true);

    // A night by the fire.
    kit.clock.setTimeOfDay(0.7);
    expect(play.view().canRest).toEqual({ ok: true });
    play.must(sim.rest(F.x, F.y, F.z), 'rest');
    expect(kit.clock.isNight).toBe(false);
    expect(flags).toContainEqual({ flag: 'rested' });

    // The rest of the Ember handwork: a drying rack, leather (STAND-IN: the rack needs a dry day under open sky, tested in
    // src/sim/handWork*.test.ts), and a loom that weaves cloth stroke by stroke.
    play.find('3 stick, 1 cord');
    play.craft('drying_rack', 1, BENCH);
    play.place('drying_rack', RACK);
    play.find('2 leather');
    play.made('leather', 2);
    play.find('4 plank, 2 stick, 2 cord');
    play.craft('loom', 1, BENCH);
    play.place('loom', LOOM);
    play.find('4 fiber');
    play.work(LOOM, 'fiber', 4);
    play.step(0.5);
    done('place_drying_rack');
    done('make_leather');
    done('weave_cloth');

    // BRONZE_PLAN W0: the Clay Furnace is rebuilt in place as the single-block Bronze Furnace (1100 C, two crucibles).
    play.find('8 bronze_ingot, 4 firebrick, 1 bellows'); // STAND-IN: the bellows is crafted for the Blast Furnace below
    expect(play.view().upgrade).toMatchObject({ ok: true, structureOk: true, reason: null, requiredC: 700 });
    play.must(sim.upgrade(F.x, F.y, F.z), 'upgrade to the bronze furnace');
    done('bronze_furnace');
    expect(blockOf(kit.world.getVoxel(F.x, F.y, F.z)).key).toBe('furnace_bronze');
    expect(play.view()).toMatchObject({ tier: 2, effectiveTier: 2, cruciblesActive: 2 });
    mark('Bronze Furnace');
    // The Bronze workshop goals (docs/OVERHAUL_PLAN.md A): the first of each piece, set down in a spare corner.
    play.find('1 bronze_ingot, 1 hand_crank, 1 mech_millstone, 1 ratio_dial, 1 mixer, 1 mech_arm, 1 saw_arm, 1 item_vault, 1 crank_lever, 1 bell, 1 piston');
    play.forge('bronze_cog');
    play.place('hand_crank', { x: 8, y: 1, z: 8 });
    play.place('mech_millstone', { x: 9, y: 1, z: 8 });
    play.place('ratio_dial', { x: 10, y: 1, z: 8 });
    play.place('mixer', { x: 11, y: 1, z: 8 });
    play.place('mech_arm', { x: 12, y: 1, z: 8 });
    play.place('saw_arm', { x: 13, y: 1, z: 8 });
    play.place('item_vault', { x: 14, y: 1, z: 8 });
    play.place('crank_lever', { x: 15, y: 1, z: 8 });
    play.place('bell', { x: 16, y: 1, z: 8 });
    play.place('piston', { x: 17, y: 1, z: 8 });
    // The small steam loop: a copper steam kettle, and a rotor to turn a shaft with it.
    play.find('4 copper_ingot, 4 bronze_plate, 1 drive_shaft, 1 bronze_cog');
    play.forge('steam_kettle');
    play.forge('steam_rotor');
    play.place('steam_kettle', { x: 18, y: 1, z: 8 });
    play.place('steam_rotor', { x: 18, y: 2, z: 8 });
    play.find('2 bronze_plate, 2 glass');
    play.forge('boiler_gauge_glass');
    play.place('boiler_gauge_glass', { x: 19, y: 1, z: 8 });
    play.find('8 bronze_plate, 2 bronze_cog, 1 flywheel');
    play.forge('steam_pipe');
    play.forge('beam_engine');
    play.place('beam_engine', { x: 20, y: 1, z: 8 });
    play.step(0.5);
    for (const id of ['place_hand_crank', 'place_mech_millstone', 'make_bronze_cog', 'place_ratio_dial', 'place_mixer', 'place_mech_arm', 'place_saw_arm', 'place_item_vault', 'place_crank_lever', 'place_bell', 'place_piston', 'place_steam_kettle', 'place_steam_rotor', 'place_boiler', 'place_beam_engine']) done(id);

    // Spec 17: the Blast Furnace needs a Blast hearth - 16 brick around the Bronze Furnace, open at the top.
    play.craft('bellows', 1, BENCH);
    expect(play.view().upgrade).toMatchObject({ ok: false, structureOk: false, reason: 'Build a Blast hearth: brick walls around the furnace' });
    play.find('26 clay');
    play.smelt('clay', 26);
    play.forge('brick', 16);
    const formed = kit.record('hearth:formed');
    expect(play.buildHearth(3)).toBe(16);
    expect(formed).toEqual([{ ...F, tier: 3, min: [-1, 0, -2], max: [1, 1, 0] }]);
    expect(toasts.map((t) => t.text)).toContain('Blast hearth formed');
    expect(play.view()).toMatchObject({ tier: 2, effectiveTier: 2, hearth: { formed: true, text: 'Formed - Blast hearth 1x1x1' } });
    const upgrade1 = play.view().upgrade!;
    expect(upgrade1).toMatchObject({ ok: true, reason: null, requiredC: 700 });
    play.must(sim.upgrade(F.x, F.y, F.z), 'upgrade to blast furnace');
    done('blast_furnace');
    expect(blockOf(kit.world.getVoxel(F.x, F.y, F.z)).key).toBe('furnace_blast');
    expect(play.view()).toMatchObject({ tier: 3, effectiveTier: 3, cruciblesActive: 2, lit: true });
    mark('Blast Furnace');

    // ---- Forge Age: iron, steel, the first machines and power ---------------------------------------------------
    play.find('130 iron_ore, 160 coal, 16 limestone, 36 copper_ore, 4 tin_ore, 60 clay, 4 sand, 3 sulfur');
    play.heat(1150);
    play.find('12 raw_chop'); // the hunt goes on: supper for the long middle of the game
    play.smelt('raw_chop', 12);
    play.smelt('iron_ore', 20);
    play.smelt('scrap_metal', 3); // the salvage of spec 19: the old smiths' iron, back into ingots
    // Spec 16: two item hatches swapped into the Blast hearth's walls (each in one go, so it never comes apart), a
    // crate of ore piped into one and the ingots piped out of the other into a crate beside the furnace.
    play.gather('oak_log', 8, '8 oak_log');
    play.craft('plank', 8);
    for (let i = 0; i < 4; i++) play.craft('crate', 1, BENCH);
    play.forge('iron_plate', 4);
    play.forge('item_hatch', 2);
    play.bronze(5); // STAND-IN (casting replaces): the wrench and the chutes are still forged from bronze ingots
    play.forge('wrench');
    play.forge('item_pipe');
    const formedBefore = hearths.length;
    for (const p of [IN_HATCH, OUT_HATCH]) {
      play.breakBlock(p);
      play.place('item_hatch', p);
    }
    expect(hearths).toHaveLength(formedBefore);
    expect(play.view().hearth.formed).toBe(true);
    play.place('crate', ORE_CRATE);
    play.place('crate', OUT_CRATE);
    play.crates.splice(play.crates.length - 2, 2); // the player keeps these two for the pipes, not for stashing
    for (const p of IN_PIPES) play.place('item_pipe', p);
    done('pipe_ore');
    play.place('item_pipe', OUT_PIPE);
    play.must(sim.wrenchPort(4, 1, -1, Face.PX), 'the ore crate end pulls');
    play.must(sim.wrenchPort(OUT_PIPE.x, OUT_PIPE.y, OUT_PIPE.z, Face.PZ), 'the north hatch end pulls');
    expect(toasts.map((t) => t.text)).toEqual(expect.arrayContaining(['Pulling from Crate', 'Pulling from Item Hatch']));
    const oreCrate = play.machineSlots(ORE_CRATE);
    const outCrate = play.machineSlots(OUT_CRATE);
    play.load(oreCrate, 'iron_ore', 90);
    play.step(10);
    expect(sim.pipeView(3, 1, -1)!.ports.map((p) => [p.name, p.status])).toEqual(expect.arrayContaining([
      ['Item Hatch', 'Receiving Iron Ore'],
      ['Crate', 'Moving 4 every 2 s'],
    ]));
    play.until('90 iron ingots piped out', () => outCrate.count('iron_ingot') >= 90, 1500);
    expect(oreCrate.count('iron_ore')).toBe(0);
    expect(sim.pipeView(OUT_PIPE.x, OUT_PIPE.y, OUT_PIPE.z)!.ports.find((p) => p.mode === 'pull')!.status).toMatch(/^Moving \d+ every 2 s$|^Nothing to pull$/);
    done('smelt_iron');
    mark('iron piped through the hearth');
    play.smelt('coal', 50);
    play.smelt('copper_ore', 36);
    play.smelt('tin_ore', 4);
    play.smelt('clay', 60);
    play.smelt('sand', 4);
    // Steel needs 1400 C: a coke fire (1550 C) instead of coal (1250 C).
    play.collect(play.furnaceSlots().fuel);
    play.fuel = 'coke';
    play.heat(1400);
    play.forge('steel_ingot', 4);
    done('make_steel');
    play.wire(60);
    play.bronze(6);
    play.forge('copper_coil', 3);
    play.forge('iron_plate', 6);
    play.forge('chassis');
    play.forge('crusher');
    play.place('crusher', CRUSHER);
    done('place_crusher');
    // Six cables came with the first power; the bus takes eight.
    play.find('1 clay, 1 sand');
    play.forge('ceramic_insulator');
    play.forge('copper_cable');
    for (const p of BUS) play.place('copper_cable', p);
    expect(sim.networkAt(BUS[3].x, BUS[3].y, BUS[3].z)!.ratingW).toBe(10000);
    expect(sim.machineView(CRUSHER.x, CRUSHER.y, CRUSHER.z)!.network).toBe(sim.networkAt(F.x, F.y, F.z)!.id);

    // Steam: an engine on top of the furnace (the Blast hearth is open at the top) with water beside it.
    play.forge('iron_plate', 8);
    play.bronze(2); // STAND-IN (casting replaces)
    play.forge('chassis');
    play.forge('copper_coil', 2);
    play.forge('steam_engine');
    play.place('steam_engine', STEAM);
    expect(sim.machineView(STEAM.x, STEAM.y, STEAM.z)!.problem).toBe('Needs water on one side');
    play.pour({ x: 1, y: 2, z: 0 });
    play.until('2 kW of steam', () => sim.generationW() >= 2000, 300);
    mark('steam power');

    play.process(CRUSHER, 'iron_ore', 20);
    done('machine_job');
    done('generate_2kw');
    expect(play.have('crushed_iron')).toBe(40);
    play.forge('iron_plate', 2);
    play.forge('battery');
    play.place('battery', BATTERY);
    // The battery soaks up what the grid does not use, so the steam engine now draws real heat: 3 J for every J.
    play.step(2);
    expect(sim.furnaceView(F.x, F.y, F.z)!.extractW).toBeGreaterThan(5000);
    play.until('1 MJ stored', () => tracker.isComplete('store_energy'), 1500);
    for (const p of BURNERS) {
      play.forge('iron_plate', 4);
      play.bronze(2); // STAND-IN (casting replaces)
      play.forge('chassis');
      play.forge('copper_coil', 2);
      play.forge('burner_generator');
      play.place('burner_generator', p);
      play.load(play.machineSlots(p), 'coal', 15);
    }
    play.must(sim.toggleMachine(STEAM.x, STEAM.y, STEAM.z), 'steam off');
    expect(sim.machineView(STEAM.x, STEAM.y, STEAM.z)!.status).toBe('Switched off');
    play.smelt('crushed_iron', 40);
    play.forge('steel_ingot', 8);
    play.forge('steel_plate', 8);
    play.forge('graphite_electrode', 3);
    play.wire(2);
    play.forge('copper_coil', 4);
    // The Arc hearth: refractory brick walls, a ceiling with an electrode. Forged while the Blast hearth still stands
    // (refractory brick needs 1300 C); building it puts a lid on the furnace, so the steam engine comes off it.
    play.forge('brick', 24);
    play.forge('refractory_brick', 6);
    play.forge('electrode');
    expect(play.view().upgrade).toMatchObject({
      ok: false, structure: 'Build an Arc hearth: refractory brick walls around the furnace, a ceiling and 1 Arc Electrode',
    });
    play.buildHearth(4);
    expect(kit.world.getBlock(STEAM.x, STEAM.y, STEAM.z).key).toBe('refractory_brick');
    expect(play.view()).toMatchObject({ tier: 3, effectiveTier: 3, hearth: { tier: 4, closed: true } });
    play.heat(1200);
    expect(play.view().upgrade).toMatchObject({ ok: true, requiredC: 1200 });
    play.must(sim.upgrade(F.x, F.y, F.z), 'upgrade to arc furnace');
    done('arc_furnace');
    mark('Arc Furnace');
    // Objective 'pump_water' (spec 16): a pump forged from a chassis, a coil and two fluid pipes, and set down.
    play.forge('iron_plate', 6);
    play.bronze(2); // STAND-IN (casting replaces)
    play.forge('chassis');
    play.wire(2);
    play.forge('copper_coil');
    play.find('1 sand');
    play.smelt('sand', 1);
    play.forge('fluid_pipe');
    play.forge('pump');
    for (const p of POOL) play.pour(p);
    play.place('pump', PUMP);
    done('pump_water');
    expect(sim.machineView(PUMP.x, PUMP.y, PUMP.z)!.status).toBe('No power');

    // ---- Current Age: electric heat --------------------------------------------------------------------------------
    play.find('190 coal, 80 iron_ore, 40 limestone, 30 copper_ore, 3 tin_ore, 22 quartz_ore, 30 bauxite, 24 wolframite, 40 oil_shale, 12 clay, 12 sand');
    for (const p of BURNERS) play.load(play.machineSlots(p), 'coal', 30);
    play.until('1900 C on electric heat', () => tracker.isComplete('reach_1900'), 900);
    const arc = play.view();
    expect(arc.electric).toMatchObject({ available: true, on: true, networked: true, maxW: 8000 });
    expect(arc.electric.deliveredW).toBeGreaterThan(5000);
    expect(arc.flameC === null || arc.flameC < 1900).toBe(true);
    mark('1900 C on electricity');

    // Spec 16.5 on the roof: the steam engine back on the hearth (it runs on piped water now), a boiler beside it, and
    // the boiler's steam piped to a turbine on the grid.
    play.find('50 iron_ore, 20 copper_ore, 1 tin_ore, 6 sand, 2 clay, 8 limestone, 16 coal');
    play.smelt('iron_ore', 50);
    play.smelt('copper_ore', 20);
    play.smelt('tin_ore', 1);
    play.smelt('sand', 6);
    play.smelt('coal', 16);
    play.forge('steel_ingot', 6);
    play.forge('steel_plate', 6);
    play.forge('iron_plate', 12);
    play.wire(30);
    play.forge('copper_coil', 6);
    play.forge('ceramic_insulator');
    play.bronze(1);
    play.forge('chassis');
    play.forge('tank');
    play.forge('boiler');
    play.forge('hot_fluid_pipe');
    play.forge('steam_turbine');
    for (const p of ROOF_CABLES) play.place('copper_cable', p);
    play.place('steam_engine', ROOF_ENGINE);
    play.place('boiler', BOILER);
    play.place('steam_turbine', TURBINE);
    for (const p of WATER_PIPES) play.place('fluid_pipe', p);
    for (const p of STEAM_PIPES) play.place('hot_fluid_pipe', p);
    // The hot pipe's end at the boiler pulls by itself: the boiler only hands steam out.
    expect(sim.pipeView(STEAM_PIPES[0].x, STEAM_PIPES[0].y, STEAM_PIPES[0].z)!.ports.find((p) => p.block === 'boiler')!.mode).toBe('pull');
    play.until('turbine power', () => sim.machineView(TURBINE.x, TURBINE.y, TURBINE.z)!.outW > 2000, 120);
    expect(sim.machineView(PUMP.x, PUMP.y, PUMP.z)!.running || sim.machineView(PUMP.x, PUMP.y, PUMP.z)!.status.startsWith('Full')).toBe(true);
    expect(sim.machineView(ROOF_ENGINE.x, ROOF_ENGINE.y, ROOF_ENGINE.z)).toMatchObject({ problem: null, availW: 2000 });
    expect(sim.machineView(BOILER.x, BOILER.y, BOILER.z)!.status).toMatch(/^Boiling \d+ L of steam a second$/);
    const water = sim.pipeView(WATER_PIPES[0].x, WATER_PIPES[0].y, WATER_PIPES[0].z)!;
    expect(water.network).toMatchObject({ family: 'fluid', fluid: 'water' });
    expect(sim.machineView(ROOF_ENGINE.x, ROOF_ENGINE.y, ROOF_ENGINE.z)!.fluids!.input).toMatchObject({ fluid: 'water' });
    expect(water.ports.map((p) => [p.name, p.mode])).toEqual([['Pump', 'pull'], ['Steam Engine', 'push'], ['Boiler', 'push']]);
    expect(sim.pipeView(STEAM_PIPES[3].x, STEAM_PIPES[3].y, STEAM_PIPES[3].z)!.network.fluid).toBe('steam');
    expect(blockOf(kit.world.getVoxel(POOL[0].x, POOL[0].y, POOL[0].z)).key).toBe('water'); // a 2x2 pool is endless
    mark('steam turbine on the roof');
    // Steam takes its heat from the fire: switched off again, so the furnace keeps its heat for the plasma casings.
    play.must(sim.setMachineOn(TURBINE.x, TURBINE.y, TURBINE.z, false), 'turbine off');
    play.must(sim.setMachineOn(ROOF_ENGINE.x, ROOF_ENGINE.y, ROOF_ENGINE.z, false), 'engine off');
    // From here electricity does the heating; the last coke burns away and the fire is not fed again.
    play.fuel = null;

    play.smelt('coal', 40);
    play.process(CRUSHER, 'iron_ore', 40);
    play.process(CRUSHER, 'iron_ore', 40);
    play.process(CRUSHER, 'copper_ore', 30);
    play.process(CRUSHER, 'quartz_ore', 22);
    play.process(CRUSHER, 'bauxite', 30);
    play.process(CRUSHER, 'wolframite', 24);
    play.smelt('crushed_iron', 160);
    play.smelt('crushed_copper', 60);
    play.smelt('tin_ore', 3);
    play.wire(24);
    play.forge('ceramic_insulator', 6);
    play.forge('silicon_wafer', 8);
    play.forge('circuit', 8);
    done('make_circuits');
    play.forge('steel_ingot', 26);
    play.forge('steel_plate', 26);
    // Spec 19.4: a ward beacon on the bus, built around the salvaged ember cores.
    play.find('1 sand');
    play.smelt('sand', 1);
    play.forge('ward_beacon');
    play.place('ward_beacon', WARD);
    play.step(1);
    done('ward_base');
    play.bronze(14);
    play.forge('iron_plate', 36);
    play.forge('chassis', 7);
    play.wire(66);
    play.forge('copper_coil', 17);
    play.forge('still');
    play.place('still', STILL);
    play.process(STILL, 'oil_shale', 40);
    for (const p of ENGINES) {
      play.forge('combustion_engine');
      play.place('combustion_engine', p);
      play.load(play.machineSlots(p), 'fuel_canister', 10);
    }
    // Vehicles: the chainsaw and the tractor (with its tiller) are forged at the Arc Furnace; felling and driving
    // themselves are tested in felling.test.ts / vehicle tests, so the flags are raised here like the other world actions.
    play.forge('chainsaw');
    play.forge('tractor');
    play.forge('tractor_tiller');
    kit.bus.emit('flag', { flag: FLAG_FELLED_TREE });
    kit.bus.emit('flag', { flag: FLAG_DROVE_TRACTOR });
    play.step(1);
    done('fell_tree');
    done('drive_tractor');
    play.step(2);
    done('generate_10kw');
    mark('combustion engines');
    play.smelt('tungsten_powder', 48);
    done('make_tungsten');
    play.smelt('alumina', 60);

    // The Plasma hearth: a 2x2x2 inside in plasma casing, with two power ports. 53 casings, forged at 1900 C.
    play.find('130 iron_ore, 70 coal, 54 limestone, 40 bauxite, 32 wolframite, 20 copper_ore, 10 clay, 10 sand');
    play.smelt('iron_ore', 130);
    play.smelt('coal', 70);
    play.process(CRUSHER, 'bauxite', 40);
    play.process(CRUSHER, 'wolframite', 32);
    play.smelt('alumina', 76);
    play.smelt('tungsten_powder', 64);
    play.smelt('copper_ore', 20);
    play.smelt('clay', 10);
    play.forge('steel_ingot', 54);
    play.forge('steel_plate', 54);
    play.heat(1900);
    play.forge('plasma_casing', 27);
    play.wire(14);
    play.forge('copper_coil', 4);
    play.forge('ceramic_insulator', 2);
    play.forge('iron_plate', 2);
    play.forge('power_port', 2);
    // The Plasma hearth's inside takes the north hatch's place: the ingots will leave through a second east hatch.
    play.find('4 iron_ore');
    play.smelt('iron_ore', 4);
    play.forge('iron_plate', 2);
    play.gather('oak_log', 4, '4 oak_log');
    play.craft('plank', 4);
    play.craft('crate', 2, BENCH);
    play.forge('item_hatch');
    play.place('item_hatch', OUT2_HATCH);
    play.buildHearth(5);
    play.collect(outCrate);
    play.breakBlock(OUT_CRATE);
    play.place('crate', OUT2_CRATE);
    play.crates.pop();
    for (const p of OUT2_PIPES) play.place('item_pipe', p);
    play.must(sim.wrenchJoint(OUT2_PIPES[0].x, OUT2_PIPES[0].y, OUT2_PIPES[0].z, Face.PZ), 'part the two lines');
    play.must(sim.wrenchPort(OUT2_PIPES[0].x, OUT2_PIPES[0].y, OUT2_PIPES[0].z, Face.NX), 'the east hatch end pulls');
    expect(sim.transport.netAt(OUT2_PIPES[0].x, 1, OUT2_PIPES[0].z)).not.toBe(sim.transport.netAt(IN_PIPES[0].x, 1, IN_PIPES[0].z));
    expect(play.view()).toMatchObject({ tier: 4, effectiveTier: 4, hearth: { tier: 5, inner: [2, 2, 2] } });
    // The arc heater sized up to the bigger shell is more than copper cable carries.
    play.step(2);
    expect(sim.networkAt(F.x, F.y, F.z)).toMatchObject({ overloaded: true, ratingW: 10000 });
    expect(alerts.map((a) => a.kind)).toContain('overload');
    play.forge('ceramic_insulator', 2);
    play.forge('heavy_cable', 2);
    for (const p of [...BUS, ...ROOF_CABLES]) {
      play.breakBlock(p);
      play.place('heavy_cable', p);
    }
    play.step(2);
    expect(sim.networkAt(F.x, F.y, F.z)).toMatchObject({ overloaded: false, ratingW: 120000 });
    play.heat(1900);
    expect(play.view().upgrade, JSON.stringify(play.view().upgrade)).toMatchObject({ ok: true, requiredC: 1900 });
    play.must(sim.upgrade(F.x, F.y, F.z), 'upgrade to plasma furnace');
    done('plasma_furnace');
    mark('Plasma Furnace');

    // ---- Atomic Age: plasma, superalloy, fission ----------------------------------------------------------------------
    // The Plasma hearth's heater (40 kW, sized up to its 2x2x2 shell) fits heavy cable.
    play.step(2);
    expect(sim.networkAt(F.x, F.y, F.z)).toMatchObject({ overloaded: false, ratingW: 120000 });
    play.find('50 iron_ore, 30 limestone, 50 copper_ore, 3 tin_ore, 20 quartz_ore, 13 spodumene, 48 pitchblende, 10 clay, 10 sand, 64 oil_shale, 150 coal');
    for (const p of BURNERS) play.load(play.machineSlots(p), 'coal', 30);
    play.smelt('coal', 50);
    play.process(CRUSHER, 'iron_ore', 50);
    play.process(CRUSHER, 'copper_ore', 50);
    play.process(CRUSHER, 'quartz_ore', 20);
    play.process(CRUSHER, 'spodumene', 13);
    play.process(CRUSHER, 'pitchblende', 48);
    play.process(STILL, 'oil_shale', 64);
    for (const p of ENGINES) play.load(play.machineSlots(p), 'fuel_canister', 10);
    play.smelt('crushed_iron', 100);
    play.smelt('crushed_copper', 100);
    play.smelt('tin_ore', 3);
    play.forge('steel_ingot', 28);
    play.heat(2600, 900);
    play.forge('superalloy', 26);
    done('make_superalloy');
    play.smelt('silica', 24);
    play.wire(60);
    play.forge('ceramic_insulator', 8);
    play.forge('silicon_wafer', 14);
    play.forge('circuit', 14);
    play.bronze(6);
    play.forge('iron_plate', 12);
    play.forge('chassis', 3);
    play.wire(136);
    play.forge('copper_coil', 34);
    mark('superalloy');

    play.forge('centrifuge');
    play.place('centrifuge', CENTRIFUGE);
    play.process(CENTRIFUGE, 'yellowcake', 96);
    play.forge('fuel_rod', 6); // spares for the long climb and the Star Age (one rod lasts twenty minutes)
    play.forge('fission_pile');
    play.place('fission_pile', PILE);
    done('place_fission_pile');
    expect(sim.machineView(PILE.x, PILE.y, PILE.z)!.problem).toBe('Needs water on 2 sides (0 now)');
    play.pour({ x: PILE.x, y: PILE.y + 1, z: PILE.z });
    play.pour({ x: PILE.x + 1, y: PILE.y, z: PILE.z });
    play.load(play.machineSlots(PILE), 'fuel_rod', 1);
    play.until('60 kW', () => tracker.isComplete('generate_60kw'), 30);
    play.until('pile at its running temperature', () => sim.machineView(PILE.x, PILE.y, PILE.z)!.coreC >= 600, 120);
    expect(sim.machineView(PILE.x, PILE.y, PILE.z)).toMatchObject({ cooled: true, availW: 60000 });
    mark('fission');

    play.forge('magnet_ring', 6);
    play.forge('lithium_bank', 2);
    for (const p of BANKS) play.place('lithium_bank', p);
    play.forge('empty_cell', 4);
    play.forge('electrolyzer');
    play.place('electrolyzer', ELECTROLYZER);
    expect(sim.machineView(ELECTROLYZER.x, ELECTROLYZER.y, ELECTROLYZER.z)!.problem).toBe('Must touch water');
    play.pour({ x: ELECTROLYZER.x + 1, y: 1, z: ELECTROLYZER.z });
    play.process(ELECTROLYZER, 'empty_cell', 8);
    // The tracker checks on an interval: give it a moment to see the last cell.
    play.until('deuterium objective', () => tracker.isComplete('make_deuterium'), 5);
    play.forge('star_core');
    done('make_star_core');
    mark('star core');

    // ---- The Starhearth's hearth: 3x3x3 in star casing with four power ports, and super cable for the ignition ------
    play.find(
      '520 iron_ore, 240 limestone, 330 copper_ore, 130 bauxite, 130 wolframite, 70 quartz_ore, 60 spodumene, 12 clay, '
      + '8 sand, 300 coal',
    );
    play.find('12 raw_chop');
    play.smelt('raw_chop', 12);
    play.smelt('coal', 140);
    play.smelt('iron_ore', 520);
    // 330 copper ore through the pipes: a crate of ore in, ingots out beside the furnace.
    play.load(oreCrate, 'copper_ore', 330);
    const out2 = play.machineSlots(OUT2_CRATE);
    // STAND-IN (casting replaces): copper smelted in the hearth cools to blooms (docs/api/casting.md), so the ingots this step
    // pipes out are found instead; the piping itself is proved by the iron above and by the sim's own pipe tests.
    play.until('some copper blooms or ingots piped out', () => out2.count('copper_bloom') + out2.count('copper_ingot') > 0, 3000);
    play.find('330 copper_ingot');
    mark('copper piped through the hearth');
    // More canisters for the engines' refills, distilled while the pile carries the grid.
    play.find('64 oil_shale');
    play.process(STILL, 'oil_shale', 64);
    // The pile's rod lasts twenty minutes and this stretch is longer: the player swaps in the second rod once the first is spent.
    const topUp = (): void => {
      if (play.machineSlots(PILE).get(0) === null && play.have('fuel_rod') > 0) play.load(play.machineSlots(PILE), 'fuel_rod', 1);
      for (const p of ENGINES) if (play.machineSlots(p).get(0) === null && play.have('fuel_canister') > 0) play.load(play.machineSlots(p), 'fuel_canister', Math.min(10, play.have('fuel_canister')));
    };
    for (const ore of ['bauxite', 'wolframite', 'quartz_ore', 'spodumene'] as const) play.process(CRUSHER, ore, play.have(ore));
    play.smelt('alumina', 260);
    topUp();
    play.smelt('tungsten_powder', 260);
    topUp();
    play.smelt('silica', 140);
    topUp();
    play.forge('steel_ingot', 128);
    topUp();
    play.forge('superalloy', 128);
    play.wire(960);
    topUp();
    play.forge('copper_coil', 240);
    topUp();
    play.forge('magnet_ring', 52);
    play.forge('star_casing', 47);
    play.forge('ceramic_insulator', 6);
    play.forge('super_cable', 2);
    for (const p of [...BUS, ...ROOF_CABLES]) {
      play.breakBlock(p);
      play.place('super_cable', p);
    }
    play.forge('iron_plate', 4);
    play.forge('power_port', 4);
    play.buildHearth(6);
    expect(play.view()).toMatchObject({ tier: 5, effectiveTier: 5, hearth: { tier: 6, inner: [3, 3, 3] } });
    play.heat(3000, 900);
    expect(play.view().upgrade).toMatchObject({ ok: true, requiredC: 3000 });
    play.must(sim.upgrade(F.x, F.y, F.z), 'upgrade to Starhearth');
    done('starhearth');
    mark('Starhearth');

    // ---- Star Age: 300 kW for 90 s ----------------------------------------------------------------------------------
    // Super cable carries 2 MW; the ignition needs 340 kW with the hearth's own heating.
    for (const p of ENGINES) play.load(play.machineSlots(p), 'fuel_canister', 6);
    // One fuel rod runs the pile for twenty minutes; the long climb through the Atomic Age outlasts it, so a second goes in.
    if (play.machineSlots(PILE).get(0) === null) play.load(play.machineSlots(PILE), 'fuel_rod', 1);
    play.until('banks charged', () => sim.grid().storedJ >= 30e6, 1200);
    play.heat(3000);
    const ready = play.view();
    expect(ready.ignition).toMatchObject({ state: 'idle', canStart: { ok: true }, powerW: 300000, seconds: 90 });
    play.must(sim.startIgnition(F.x, F.y, F.z), 'ignition');
    play.step(45);
    expect(play.view().ignition.state).toBe('running');
    expect(sim.networkAt(F.x, F.y, F.z)!.satisfaction).toBeGreaterThanOrEqual(0.95);
    play.until('ignition', () => won.length > 0, 60);
    mark('ignited');
    play.step(5);

    // ---- The end state --------------------------------------------------------------------------------------------
    const star = play.view();
    expect(star).toMatchObject({ tier: 6, ignited: true, tempC: 5000, hot: true, status: 'A star burns here. It needs nothing more.' });
    expect(sim.generationW()).toBeGreaterThanOrEqual(machine('furnace').outputW!);
    expect(sim.maxFurnaceTier()).toBe(6);
    expect(won).toHaveLength(1);
    expect(tracker.allDone).toBe(true);
    expect(tracker.completed.map((o) => o.id)).toEqual(OBJECTIVES.map((o) => o.id));
    expect(ages.map((a) => a.age)).toEqual([1, 2, 3, 4, 5]);
    expect(player.dead).toBe(false);
    expect(player.home).toEqual(F);
    expect(play.furnace.tempC).toBeGreaterThan(FURNACE_HOT_C);
    console.log(`playthrough, game time:\n${log.join('\n')}`);
    // Nothing hurt the player who stayed by the fire, and the grid spoke only when its state changed.
    expect(damage).toEqual([]);
    expect(player.warmth).toBe(100);
    // ... and who ate whenever the bar ran low, so it never reached Hungry.
    expect(play.meals).toBeGreaterThan(5);
    expect(player.food).toBeGreaterThan(REGEN_MIN_FOOD - 1);
    expect(toasts.some((t) => /hungry/i.test(t.text))).toBe(false);
    expect(alerts.length).toBeLessThan(16);
    for (let i = 1; i < alerts.length; i++) expect(alerts[i].kind).not.toBe(alerts[i - 1].kind);
    const said = toasts.map((t) => t.text);
    for (let tier = 2; tier <= 5; tier++) expect(said).toContain(`Upgraded to the ${furnaceTier(tier).name}`);
    // Each hearth formed once, as it was finished; the last one stands around the Starhearth.
    expect(hearths.map((h) => h.tier)).toEqual([3, 4, 5, 6]);
    for (const name of ['Blast hearth', 'Arc hearth', 'Plasma hearth', 'Starhearth']) expect(said).toContain(`${name} formed`);
    expect(star.hearth).toMatchObject({ formed: true, tier: 6, inner: [3, 3, 3], closed: true });
    expect(hearths[3]).toMatchObject({ min: [-3, 0, -4], max: [1, 4, 0] });
    expect(said).not.toContain('The furnace fire burned out');
  }, 120_000);
});
