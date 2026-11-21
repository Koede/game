/**
 * The proof that the core loop works: one long scripted game through the public API only - raw materials are
 * found, everything else is crafted, smelted, forged, crushed, distilled, spun and split by the real rules, the
 * furnace is upgraded in place from clay to Starhearth, power grows from a thermopile to a fission pile, and the
 * Starhearth is ignited. The objective tracker and survival run alongside, so every objective must complete too.
 */
import { describe, expect, it } from 'vitest';
import { FURNACE_HOT_C } from '../core/constants';
import { OBJECTIVES, blockOf, furnaceTier, machine } from '../core/registry';
import { voxelActive } from '../core/types';
import { Play } from './playKit';

const F = { x: 0, y: 1, z: 0 };
const BENCH = { x: 2, y: 1, z: 2 };
const CRATES = [{ x: -2, y: 1, z: 1 }, { x: -2, y: 1, z: 0 }, { x: -3, y: 1, z: -1 }, { x: -3, y: 1, z: 0 }, { x: -3, y: 1, z: 1 }, { x: -4, y: 1, z: 0 }];
const THERMOPILE = { x: 1, y: 1, z: 0 };
const LAMP = { x: 2, y: 1, z: 0 };
const STEAM = { x: 0, y: 2, z: 0 };
/** The power bus: a link north of the furnace and a run of cable along z = -2. Generators sit on the z = -3 side. */
const BUS = [{ x: 0, y: 1, z: -1 }, { x: 0, y: 1, z: -2 }, { x: -1, y: 1, z: -2 }, { x: -2, y: 1, z: -2 }, { x: 1, y: 1, z: -2 }, { x: 2, y: 1, z: -2 }];
const CRUSHER = { x: -3, y: 1, z: -2 };
const BATTERY = { x: -1, y: 1, z: -3 };
const BURNERS = [{ x: -2, y: 1, z: -3 }, { x: 0, y: 1, z: -3 }, { x: 1, y: 1, z: -3 }];
const STILL = { x: 3, y: 1, z: -2 };
const ENGINES = [{ x: 2, y: 1, z: -3 }, { x: -2, y: 1, z: -1 }];
const CENTRIFUGE = { x: -1, y: 1, z: -1 };
const PILE = { x: -1, y: 2, z: -3 };
const BANKS = [{ x: 3, y: 1, z: -3 }, { x: 4, y: 1, z: -3 }];
const ELECTROLYZER = { x: 1, y: 1, z: -1 };

describe('scripted playthrough', () => {
  it('walks the whole tech tree from a clay furnace to an ignited Starhearth', () => {
    const play = new Play(F);
    const { sim, player, tracker, kit } = play;
    const won = kit.record('game:won');
    const alerts = kit.record('power:alert');
    const ages = kit.record('age:advanced');
    const flags = kit.record('flag');
    const toasts = kit.record('toast');
    const damage = kit.record('player:damage');
    const done = (id: string) => expect(tracker.isComplete(id), `objective ${id}`).toBe(true);
    const log: string[] = [];
    const mark = (what: string) => log.push(`${(play.time / 60).toFixed(1).padStart(6)} min  ${what}`);

    // ---- Ember Age: wood, flint, a clay furnace ------------------------------------------------------------------
    play.gather('oak_log', 28, '28 oak_log');
    done('gather_logs');
    play.craft('plank', 17);
    done('make_planks');
    play.craft('workbench');
    play.place('workbench', BENCH);
    done('place_workbench');
    play.gather('gravel', 6, '6 gravel, 8 flint');
    done('find_flint');
    play.gather('tall_grass', 24, '24 fiber');
    play.craft('cord', 8);
    play.craft('stick', 4);
    play.craft('flint_pickaxe');
    done('make_pickaxe');
    play.gather('stone', 12, '12 rubble');
    play.gather('clay', 6, '6 clay');
    done('collect_clay');
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
    mark('furnace lit, charcoal, warm');

    play.find('40 coal, 15 copper_ore, 5 tin_ore, 8 clay, 2 sand');
    play.fuel = 'coal';
    play.heat(780);
    expect(play.view().forge.find((r) => r.recipe.id === 'bronze_ingot')).toMatchObject({ locked: false, canMake: false });
    play.smelt('copper_ore', 15);
    done('smelt_copper');
    done('reach_800');
    play.smelt('tin_ore', 5);
    // The furnace's recipe list is the tech tree: higher tiers are listed, locked, with what they need.
    const steelRow = play.view().forge.find((r) => r.recipe.id === 'steel_ingot');
    expect(steelRow).toMatchObject({ locked: true, canMake: false, reason: 'Needs the Blast Furnace' });
    play.forge('bronze_ingot', 3);
    done('make_bronze');
    play.forge('bronze_pickaxe');
    done('bronze_pickaxe');
    play.smelt('clay', 8);
    play.smelt('sand', 2);
    play.forge('thermopile');
    play.place('thermopile', THERMOPILE);
    play.step(2);
    expect(sim.machineView(THERMOPILE.x, THERMOPILE.y, THERMOPILE.z)!.availW).toBeCloseTo(0.25 * (800 - 100), 0);
    done('first_power');
    play.forge('copper_wire');
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

    play.craft('bellows', 1, BENCH);
    const upgrade1 = play.view().upgrade!;
    expect(upgrade1).toMatchObject({ ok: true, reason: null, requiredC: 700 });
    play.must(sim.upgrade(F.x, F.y, F.z), 'upgrade to blast furnace');
    done('blast_furnace');
    expect(blockOf(kit.world.getVoxel(F.x, F.y, F.z)).key).toBe('furnace_blast');
    expect(play.view()).toMatchObject({ tier: 2, lit: true });
    mark('Blast Furnace');

    // ---- Forge Age: iron, steel, the first machines and power ---------------------------------------------------
    play.find('130 iron_ore, 150 coal, 16 limestone, 32 copper_ore, 4 tin_ore, 12 clay, 4 sand, 3 sulfur');
    play.heat(1150);
    play.smelt('iron_ore', 110);
    done('smelt_iron');
    play.smelt('coal', 40);
    play.smelt('copper_ore', 32);
    play.smelt('tin_ore', 4);
    play.smelt('clay', 12);
    play.smelt('sand', 4);
    // Steel needs 1400 C: a coke fire (1550 C) instead of coal (1250 C).
    play.collect(play.furnaceSlots().fuel);
    play.fuel = 'coke';
    play.heat(1400);
    play.forge('steel_ingot', 4);
    done('make_steel');
    play.forge('copper_wire', 20);
    play.forge('bronze_ingot', 3);
    play.forge('copper_coil', 3);
    play.forge('iron_plate', 6);
    play.forge('chassis');
    play.forge('crusher');
    play.place('crusher', CRUSHER);
    done('place_crusher');
    for (const p of BUS) play.place('copper_cable', p);
    expect(sim.networkAt(BUS[3].x, BUS[3].y, BUS[3].z)!.ratingW).toBe(10000);
    expect(sim.machineView(CRUSHER.x, CRUSHER.y, CRUSHER.z)!.network).toBe(sim.networkAt(F.x, F.y, F.z)!.id);

    // Steam: an engine on top of the furnace with water beside it.
    play.forge('iron_plate', 8);
    play.forge('chassis');
    play.forge('copper_coil', 2);
    play.forge('steam_engine');
    play.place('steam_engine', STEAM);
    expect(sim.machineView(STEAM.x, STEAM.y, STEAM.z)!.problem).toBe('Needs water on one side');
    play.pour({ x: 1, y: 2, z: 0 });
    play.until('2 kW of steam', () => sim.generationW() >= 2000, 300);
    expect(sim.furnaceView(F.x, F.y, F.z)!.extractW).toBeGreaterThan(6000);
    mark('steam power');

    play.process(CRUSHER, 'iron_ore', 20);
    done('machine_job');
    done('generate_2kw');
    expect(play.have('crushed_iron')).toBe(40);
    play.forge('iron_plate', 2);
    play.forge('battery');
    play.place('battery', BATTERY);
    play.until('1 MJ stored', () => tracker.isComplete('store_energy'), 1500);
    for (const p of BURNERS) {
      play.forge('iron_plate', 4);
      play.forge('chassis');
      play.forge('copper_coil', 2);
      play.forge('burner_generator');
      play.place('burner_generator', p);
      play.load(play.machineSlots(p), 'coal', 15);
    }
    // The steam engine steals 6 kW of heat; with burners on the grid it can be switched off to get the heat back.
    play.must(sim.toggleMachine(STEAM.x, STEAM.y, STEAM.z), 'steam off');
    expect(sim.machineView(STEAM.x, STEAM.y, STEAM.z)!.status).toBe('Switched off');
    play.smelt('crushed_iron', 40);
    play.forge('steel_ingot', 8);
    play.forge('steel_plate', 8);
    play.forge('graphite_electrode', 3);
    play.forge('copper_coil', 4);
    play.heat(1200);
    expect(play.view().upgrade).toMatchObject({ ok: true, requiredC: 1200 });
    play.must(sim.upgrade(F.x, F.y, F.z), 'upgrade to arc furnace');
    done('arc_furnace');
    mark('Arc Furnace');

    // ---- Current Age: electric heat --------------------------------------------------------------------------------
    play.find('140 coal, 40 iron_ore, 20 limestone, 30 copper_ore, 3 tin_ore, 16 quartz_ore, 30 bauxite, 24 wolframite, 40 oil_shale, 12 clay, 12 sand');
    for (const p of BURNERS) play.load(play.machineSlots(p), 'coal', 30);
    play.until('1900 C on electric heat', () => tracker.isComplete('reach_1900'), 900);
    const arc = play.view();
    expect(arc.electric).toMatchObject({ available: true, on: true, networked: true, maxW: 8000 });
    expect(arc.electric.deliveredW).toBeGreaterThan(5000);
    expect(arc.flameC === null || arc.flameC < 1900).toBe(true);
    mark('1900 C on electricity');
    // From here electricity does the heating; the last coke burns away and the fire is not fed again.
    play.fuel = null;

    play.smelt('coal', 40);
    play.process(CRUSHER, 'iron_ore', 40);
    play.process(CRUSHER, 'copper_ore', 30);
    play.process(CRUSHER, 'quartz_ore', 16);
    play.process(CRUSHER, 'bauxite', 30);
    play.process(CRUSHER, 'wolframite', 24);
    play.smelt('crushed_iron', 80);
    play.smelt('crushed_copper', 60);
    play.smelt('tin_ore', 3);
    play.forge('copper_wire', 24);
    play.forge('ceramic_insulator', 6);
    play.forge('silicon_wafer', 6);
    play.forge('circuit', 6);
    done('make_circuits');
    play.forge('steel_ingot', 18);
    play.forge('steel_plate', 18);
    play.forge('bronze_ingot', 3);
    play.forge('iron_plate', 12);
    play.forge('chassis', 3);
    play.forge('copper_coil', 13);
    play.forge('still');
    play.place('still', STILL);
    play.process(STILL, 'oil_shale', 40);
    for (const p of ENGINES) {
      play.forge('combustion_engine');
      play.place('combustion_engine', p);
      play.load(play.machineSlots(p), 'fuel_canister', 10);
    }
    play.step(2);
    done('generate_10kw');
    mark('combustion engines');
    play.smelt('tungsten_powder', 48);
    done('make_tungsten');
    play.smelt('alumina', 60);
    play.heat(1900);
    expect(play.view().upgrade).toMatchObject({ ok: true, requiredC: 1900 });
    play.must(sim.upgrade(F.x, F.y, F.z), 'upgrade to plasma furnace');
    done('plasma_furnace');
    mark('Plasma Furnace');

    // ---- Atomic Age: plasma, superalloy, fission ----------------------------------------------------------------------
    // 40 kW of plasma heating is more than copper cable carries.
    play.step(2);
    expect(sim.networkAt(F.x, F.y, F.z)).toMatchObject({ overloaded: true, ratingW: 10000 });
    expect(alerts.map((a) => a.kind)).toContain('overload');
    for (const p of BUS) {
      play.breakBlock(p);
      play.place('heavy_cable', p);
    }
    play.step(2);
    expect(sim.networkAt(F.x, F.y, F.z)).toMatchObject({ overloaded: false, ratingW: 120000 });
    play.find('50 iron_ore, 30 limestone, 50 copper_ore, 3 tin_ore, 20 quartz_ore, 13 spodumene, 8 pitchblende, 10 clay, 10 sand, 64 oil_shale, 150 coal');
    for (const p of BURNERS) play.load(play.machineSlots(p), 'coal', 30);
    play.smelt('coal', 50);
    play.process(CRUSHER, 'iron_ore', 50);
    play.process(CRUSHER, 'copper_ore', 50);
    play.process(CRUSHER, 'quartz_ore', 20);
    play.process(CRUSHER, 'spodumene', 13);
    play.process(CRUSHER, 'pitchblende', 8);
    play.process(STILL, 'oil_shale', 64);
    for (const p of ENGINES) play.load(play.machineSlots(p), 'fuel_canister', 10);
    play.smelt('crushed_iron', 100);
    play.smelt('crushed_copper', 100);
    play.smelt('tin_ore', 3);
    play.forge('steel_ingot', 20);
    play.heat(2600, 900);
    play.forge('superalloy', 20);
    done('make_superalloy');
    play.smelt('silica', 24);
    play.forge('copper_wire', 60);
    play.forge('ceramic_insulator', 8);
    play.forge('silicon_wafer', 14);
    play.forge('circuit', 14);
    play.forge('bronze_ingot', 3);
    play.forge('iron_plate', 12);
    play.forge('chassis', 3);
    play.forge('copper_coil', 34);
    mark('superalloy');

    play.forge('centrifuge');
    play.place('centrifuge', CENTRIFUGE);
    play.process(CENTRIFUGE, 'yellowcake', 16);
    play.forge('fuel_rod');
    play.forge('fission_pile');
    play.place('fission_pile', PILE);
    done('place_fission_pile');
    expect(sim.machineView(PILE.x, PILE.y, PILE.z)!.problem).toBe('Needs water on 2 sides (0 now)');
    play.pour({ x: PILE.x, y: PILE.y + 1, z: PILE.z });
    play.pour({ x: PILE.x - 1, y: PILE.y, z: PILE.z });
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
    play.pour({ x: 2, y: 1, z: -1 });
    play.process(ELECTROLYZER, 'empty_cell', 8);
    done('make_deuterium');
    play.forge('star_core');
    done('make_star_core');
    play.heat(3000);
    expect(play.view().upgrade).toMatchObject({ ok: true, requiredC: 3000 });
    play.must(sim.upgrade(F.x, F.y, F.z), 'upgrade to Starhearth');
    done('starhearth');
    mark('Starhearth');

    // ---- Star Age: 300 kW for 90 s ----------------------------------------------------------------------------------
    // Heavy cable carries 120 kW; the ignition needs 340. Super cable carries 2 MW.
    play.forge('magnet_ring');
    play.forge('super_cable');
    for (const p of BUS) {
      play.breakBlock(p);
      play.place('super_cable', p);
    }
    for (const p of ENGINES) play.load(play.machineSlots(p), 'fuel_canister', 6);
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
    expect(star).toMatchObject({ tier: 5, ignited: true, tempC: 5000, hot: true, status: 'A star burns here. It needs nothing more.' });
    expect(sim.generationW()).toBeGreaterThanOrEqual(machine('furnace').outputW!);
    expect(sim.maxFurnaceTier()).toBe(5);
    expect(won).toHaveLength(1);
    expect(tracker.allDone).toBe(true);
    expect(tracker.completed.map((o) => o.id)).toEqual(OBJECTIVES.map((o) => o.id));
    expect(ages.map((a) => a.age)).toEqual([1, 2, 3, 4]);
    expect(player.dead).toBe(false);
    expect(player.home).toEqual(F);
    expect(play.furnace.tempC).toBeGreaterThan(FURNACE_HOT_C);
    console.log(`playthrough, game time:\n${log.join('\n')}`);
    // Nothing hurt the player who stayed by the fire, and the grid spoke only when its state changed.
    expect(damage).toEqual([]);
    expect(player.warmth).toBe(100);
    expect(alerts.length).toBeLessThan(16);
    for (let i = 1; i < alerts.length; i++) expect(alerts[i].kind).not.toBe(alerts[i - 1].kind);
    const said = toasts.map((t) => t.text);
    for (let tier = 2; tier <= 5; tier++) expect(said).toContain(`Upgraded to the ${furnaceTier(tier).name}`);
    expect(said).not.toContain('The furnace fire burned out');
  }, 120_000);
});
