/**
 * Interaction matrix: every item against every slot of every machine, station and container, checked against the
 * rule that slot is documented to follow. A slot must take exactly the items its machine can use (nothing it would
 * hold and never touch, nothing refused that the machine would run), and every fuel must burn the same way wherever
 * it is offered: the firebox, a pipe's furnace side, the burner generator, the combustion engine.
 */
import { describe, expect, it } from 'vitest';
import { FIRST_HEARTH_TIER } from '../core/constants';
import { CHEM_CONTAINERS, FUEL_GRADES, fuelGrade } from '../core/distill';
import { FURNACE_TIERS, ITEMS, MACHINES, fuelOf, item, itemOrNull, machine, recipesAt } from '../core/registry';
import { Face } from '../core/types';
import { isSawFuel } from '../game/felling';
import { ALLOY_POT } from './casting';
import { fuelContainerOf, fuelEnergyJ, isProcessor, machineRecipeFor } from './machines';
import { fire, makeKit } from './testKit';
import type { Inventory } from '../game/inventory';

const ALL_ITEMS = ITEMS.map((i) => i.key);
const FUELS = ITEMS.filter((i) => i.fuel).map((i) => i.key);
const smeltsFor = (key: string, tier: number): boolean =>
  recipesAt('furnace').some((r) => r.kind === 'smelt' && r.inputs[0].item === key && (r.minTier ?? 1) <= tier);

/** The items a slot accepts, out of every item in the game. */
const acceptedBy = (inv: Inventory, slot: number): string[] => ALL_ITEMS.filter((k) => inv.accepts(k, slot));
const missing = (want: Iterable<string>, got: readonly string[]): string[] => [...want].filter((k) => !got.includes(k));
const extra = (want: Iterable<string>, got: readonly string[]): string[] => {
  const w = new Set(want);
  return got.filter((k) => !w.has(k));
};

describe('furnace firebox', () => {
  it('takes exactly the items that carry a fuel spec, in every slot', () => {
    const kit = makeKit();
    kit.furnace(0, 5, 0, 'furnace_clay');
    const slots = kit.sim.furnaceSlots(0, 5, 0)!;
    for (let slot = 0; slot < slots.fuel.size; slot++) {
      const got = acceptedBy(slots.fuel, slot);
      expect({ slot, missing: missing(FUELS, got), extra: extra(FUELS, got) }).toEqual({ slot, missing: [], extra: [] });
    }
  });

  it.each(FUELS)('%s burns: the fire takes it, with the energy, time and flame temperature of its fuel spec', (key) => {
    const spec = fuelOf(key)!;
    expect(spec.energyJ, key).toBeGreaterThan(0);
    expect(spec.burnS, key).toBeGreaterThan(0);
    expect(spec.flameTempC, key).toBeGreaterThan(0);
    const kit = makeKit();
    const e = kit.furnace(0, 5, 0);
    fire(kit, e, key, 1);
    kit.run(0.5);
    expect(e.burnItem, key).toBe(key);
    expect(e.burnLeftS, key).toBeGreaterThan(0);
    // The container a burned fuel leaves comes back to the firebox (the lava bucket's empty bucket).
    if (spec.fuelReturns) expect(e.fuel.some((s) => s?.item === spec.fuelReturns), key).toBe(true);
    expect(itemOrNull(spec.fuelReturns ?? key), key).not.toBeNull();
  });

  it('never takes the container a fuel leaves behind back in as fuel, but hands it out through a pipe', () => {
    const kit = makeKit();
    const e = kit.furnace(0, 5, 0);
    fire(kit, e, 'lava_bucket', 1);
    kit.run(0.5);
    const slots = kit.sim.furnaceSlots(0, 5, 0)!;
    expect(slots.fuel.accepts('bronze_bucket', 0)).toBe(false);
    const ep = kit.sim.itemEndpoint(0, 5, 0, Face.PX)!;
    expect(ep.offer()).toEqual({ item: 'bronze_bucket', count: 1 });
  });
});

describe('crucibles', () => {
  it.each(FURNACE_TIERS.map((t) => [t.tier, t.block] as const))(
    'tier %i (%s): a crucible takes what the furnace can smelt at its running tier, and the alloy pot',
    (tier, block) => {
      const kit = makeKit();
      const e = kit.furnace(0, 5, 0, block);
      if (tier >= FIRST_HEARTH_TIER) kit.formed(0, 5, 0);
      const view = kit.sim.furnaceView(0, 5, 0)!;
      const slots = kit.sim.furnaceSlots(0, 5, 0)!;
      const running = view.effectiveTier;
      expect(running).toBe(tier);
      const smeltable = ALL_ITEMS.filter((k) => smeltsFor(k, running));
      for (let slot = 0; slot < e.crucibleIn.length; slot++) {
        const got = acceptedBy(slots.crucibleIn, slot);
        const want = slot < view.cruciblesActive ? [...smeltable, ALLOY_POT] : [];
        expect({ slot, missing: missing(want, got), extra: extra(want, got) }).toEqual({ slot, missing: [], extra: [] });
      }
      // Crucible outputs are take-only.
      expect(acceptedBy(slots.crucibleOut, 0)).toEqual([]);
    },
  );

  it('every smelt recipe has real inputs and outputs, a time, and a temperature the tier can reach', () => {
    for (const r of recipesAt('furnace')) {
      if (r.kind !== 'smelt') continue;
      expect(r.inputs, r.id).toHaveLength(1);
      expect(r.timeS ?? 0, r.id).toBeGreaterThan(0);
      const tier = FURNACE_TIERS.find((t) => t.tier === (r.minTier ?? 1))!;
      expect(r.minTempC ?? 0, `${r.id} at tier ${tier.tier}`).toBeLessThanOrEqual(tier.maxTempC);
    }
  });
});

describe("a furnace's smart sides (item pipes, hatches)", () => {
  it('route every item: fuel to the firebox, smeltables to a crucible, the rest refused', () => {
    const kit = makeKit();
    kit.furnace(0, 5, 0, 'furnace_clay');
    const ep = kit.sim.itemEndpoint(0, 5, 0, Face.PX)!;
    const tier = kit.sim.furnaceView(0, 5, 0)!.effectiveTier;
    for (const key of ALL_ITEMS) {
      const usable = fuelOf(key) !== null || smeltsFor(key, tier);
      expect(ep.room(key) > 0, `room ${key}`).toBe(usable);
    }
  });
});

describe('generators with a fuel slot', () => {
  const GENERATORS = [...MACHINES.values()].filter((m) => (m.fuels?.length ?? 0) > 0).map((m) => m.kind);

  it('exist for the burner generator, the combustion engine, the fission pile and the kerosene lamp', () => {
    expect(GENERATORS.sort()).toEqual(['burner_generator', 'combustion_engine', 'fission_pile', 'kerosene_lamp']);
  });

  it.each(GENERATORS)('%s takes exactly its fuels, each worth some energy', (kind) => {
    const spec = machine(kind);
    const kit = makeKit();
    kit.machine(kind, 0, 5, 0);
    const slots = kit.sim.machineSlots(0, 5, 0)!;
    const got = acceptedBy(slots, 0);
    expect({ missing: missing(spec.fuels!, got), extra: extra(spec.fuels!, got) }).toEqual({ missing: [], extra: [] });
    for (const key of spec.fuels!) expect(fuelEnergyJ(spec, key), `${kind} ${key}`).toBeGreaterThan(0);
    // The fuel is the only thing its slot takes, and a pipe may feed it but never empty it.
    const ep = kit.sim.itemEndpoint(0, 5, 0, Face.PY)!;
    for (const key of ALL_ITEMS) expect(ep.room(key) > 0, `${kind} pipe room ${key}`).toBe(spec.fuels!.includes(key));
    expect(ep.offer()).toBeNull();
  });

  it('the burner generator burns every item the furnace firebox does', () => {
    const spec = machine('burner_generator');
    expect(missing(FUELS, spec.fuels!)).toEqual([]);
    expect(extra(FUELS, spec.fuels!)).toEqual([]);
  });

  it.each(FUELS)('burner generator: %s turns into electricity at the fuel spec energy, and any container comes back', (key) => {
    const kit = makeKit();
    const burner = kit.machine('burner_generator', 0, 5, 0);
    kit.machine('space_heater', 1, 5, 0);
    burner.slots[0] = { item: key, count: 2 };
    const given: string[] = [];
    const give = kit.player.give.bind(kit.player);
    kit.player.give = (k: string, n = 1) => {
      given.push(k);
      return give(k, n);
    };
    kit.run(1);
    const worth = fuelOf(key)!.energyJ * machine('burner_generator').efficiency!;
    expect(burner.availW).toBe(3000);
    expect(burner.slots[0]!.count).toBe(1);
    expect(burner.fuelJ).toBeGreaterThan(0);
    expect(burner.fuelJ).toBeLessThanOrEqual(worth);
    const back = fuelOf(key)!.fuelReturns;
    expect(given).toEqual(back ? [back] : []);
  });

  const ENGINE_FUELS = Object.entries(FUEL_GRADES).filter(([, g]) => g.engine > 0).map(([k]) => k);
  it('the combustion engine takes every refined fuel container an engine can burn', () => {
    expect(machine('combustion_engine').fuels).toEqual(ENGINE_FUELS);
    for (const k of ['fuel_canister', 'gasoline_canister', 'diesel_canister', 'kerosene_canister', 'fuel_ethanol_beaker']) expect(ENGINE_FUELS).toContain(k);
    // Crude oil, residue, slop and the lubricants are not fuels.
    for (const k of ['crude_canister', 'residue_canister', 'slop_canister', 'lube_base_canister', 'lubricant_canister', 'empty_canister']) expect(ENGINE_FUELS).not.toContain(k);
  });

  it.each(ENGINE_FUELS)('combustion engine: %s burns at its grade, and the empty container comes back', (key) => {
    const grade = fuelGrade(key)!;
    const kit = makeKit();
    const engine = kit.machine('combustion_engine', 0, 5, 0);
    kit.machine('space_heater', 1, 5, 0);
    engine.slots[0] = { item: key, count: 2 };
    const given: string[] = [];
    const give = kit.player.give.bind(kit.player);
    kit.player.give = (k: string, n = 1) => {
      given.push(k);
      return give(k, n);
    };
    kit.run(1);
    expect(engine.availW).toBe(12000);
    expect(engine.slots[0]!.count).toBe(1);
    // A fuel canister is 6 MJ of heat at 40%; every other fuel scales with its grade.
    expect(fuelEnergyJ(machine('combustion_engine'), key)).toBeCloseTo(2_400_000 * grade.engine, 6);
    expect(engine.fuelJ).toBeGreaterThan(0);
    expect(engine.fuelJ).toBeLessThanOrEqual(2_400_000 * grade.engine);
    expect(given).toEqual(grade.empty ? [grade.empty] : []);
    expect(fuelContainerOf(key)).toBe(grade.empty);
  });
});

describe('engine fuels agree between the saw, the tractor and the combustion engine', () => {
  it.each(Object.entries(FUEL_GRADES))('%s is a real item with a real empty container, and every engine that reads its grade can use it', (key, grade) => {
    expect(itemOrNull(key), key).not.toBeNull();
    if (grade.empty) expect(itemOrNull(grade.empty), key).not.toBeNull();
    expect(isSawFuel(key)).toBe(grade.saw > 0);
    expect(grade.tractor).toBeGreaterThan(0);
    expect(grade.engine).toBeGreaterThan(0);
    // Whatever one engine burns is poured the same way into a flask, so a full container can always be emptied again.
    if (grade.empty) expect(Object.values(CHEM_CONTAINERS).some((c) => c.empty === grade.empty), key).toBe(true);
  });

  it('every container of a refined fuel cut that the still makes has a consumer', () => {
    // Fuel-class cuts of the column: each canister must be burnable somewhere, or it is a dead end.
    for (const key of ['gasoline_canister', 'kerosene_canister', 'diesel_canister', 'fuel_ethanol_beaker']) {
      expect(fuelGrade(key), key).not.toBeNull();
      expect(machine('combustion_engine').fuels, key).toContain(key);
    }
  });
});

describe('processing machines', () => {
  // Powered machines with an input and an output slot (the distillery and alloy pot run process cards, not machine nodes).
  const PROCESSORS = [...MACHINES.values()].filter((m) => isProcessor(m.kind) && (m.drawW ?? 0) > 0 && (m.slots ?? 0) > 0).map((m) => m.kind);

  it('are the four powered machines that run recipes', () => {
    expect(PROCESSORS.sort()).toEqual(['centrifuge', 'crusher', 'electrolyzer', 'still']);
  });

  it.each(PROCESSORS)('%s: the input slot takes exactly its recipe inputs, the output slot nothing', (kind) => {
    const kit = makeKit();
    kit.machine(kind, 0, 5, 0);
    const slots = kit.sim.machineSlots(0, 5, 0)!;
    const want = recipesAt(kind).map((r) => r.inputs[0].item);
    const got = acceptedBy(slots, 0);
    expect({ missing: missing(want, got), extra: extra(want, got) }).toEqual({ missing: [], extra: [] });
    expect(acceptedBy(slots, 1)).toEqual([]);
    // Through a pipe the same, and only the output can be taken.
    const ep = kit.sim.itemEndpoint(0, 5, 0, Face.PY)!;
    for (const key of ALL_ITEMS) expect(ep.room(key) > 0, `${kind} pipe room ${key}`).toBe(want.includes(key));
  });

  it.each(PROCESSORS)('%s: every recipe has one input item, a timed energy cost and a produced item', (kind) => {
    const seen = new Set<string>();
    for (const r of recipesAt(kind)) {
      expect(r.inputs, r.id).toHaveLength(1);
      expect(r.timeS ?? 0, r.id).toBeGreaterThan(0);
      expect(r.energyJ ?? 0, r.id).toBeGreaterThan(0);
      expect(itemOrNull(r.output.item), r.id).not.toBeNull();
      expect(machineRecipeFor(kind, r.inputs[0].item)?.id, r.id).toBe(r.id);
      // Two recipes on one input would shadow each other (the machine keys its recipes by the input item).
      expect(seen.has(r.inputs[0].item), `${kind} input ${r.inputs[0].item} used twice`).toBe(false);
      seen.add(r.inputs[0].item);
    }
  });
});

describe('storage and buffers', () => {
  it('a crate takes every item, in every slot', () => {
    const kit = makeKit();
    kit.machine('crate', 0, 5, 0);
    const slots = kit.sim.machineSlots(0, 5, 0)!;
    for (const slot of [0, slots.size - 1]) expect(acceptedBy(slots, slot)).toEqual(ALL_ITEMS);
  });

  it('the bore rig buffer takes nothing in but gives everything out', () => {
    const kit = makeKit();
    kit.machine('bore_rig', 0, 5, 0);
    const slots = kit.sim.machineSlots(0, 5, 0)!;
    for (let slot = 0; slot < slots.size; slot++) expect(acceptedBy(slots, slot)).toEqual([]);
  });

  it('the drill rig takes only drill bits, in its bit slot, and gives its buffer out', () => {
    const kit = makeKit();
    kit.machine('drill_rig', 0, 5, 0);
    const slots = kit.sim.machineSlots(0, 5, 0)!;
    expect(acceptedBy(slots, 0)).toEqual(['drill_bit', 'steel_drill_bit']);
    for (let slot = 1; slot < slots.size; slot++) expect(acceptedBy(slots, slot)).toEqual([]);
  });

  it('every machine with slots has an inventory rule that matches its role', () => {
    for (const m of MACHINES.values()) {
      if (!m.slots) continue;
      const rule = m.kind === 'crate' ? 'crate' : (m.fuels?.length ?? 0) > 0 ? 'fuel' : isProcessor(m.kind) ? 'processor' : m.kind === 'bore_rig' || m.kind === 'casting_bench' ? 'out' : m.kind === 'drill_rig' ? 'bit'  : 'unknown';
      expect(rule, `${m.kind} has slots but no accept rule in the matrix`).not.toBe('unknown');
    }
  });
});

describe('item sanity', () => {
  it('every fuel item and every fuel container exists and has a name, and none burns for nothing', () => {
    for (const key of FUELS) {
      const it = item(key);
      expect(it.name, key).toBeTruthy();
      expect(fuelOf(key)!.energyJ, key).toBeGreaterThan(0);
    }
  });
});

describe('refined fuels in furnaces', () => {
  it.each(['gasoline_canister', 'kerosene_canister', 'diesel_canister', 'fuel_ethanol_beaker'])('%s burns in a firebox and hands its empty container back', (key) => {
    const spec = fuelOf(key)!;
    expect(spec.fuelReturns).toBe(fuelGrade(key)!.empty);
    const kit = makeKit();
    const e = kit.furnace(0, 5, 0);
    expect(kit.sim.furnaceSlots(0, 5, 0)!.fuel.accepts(key, 0)).toBe(true);
    fire(kit, e, key, 1);
    kit.run(0.5);
    expect(e.burnItem).toBe(key);
    expect(e.fuel.some((s) => s?.item === spec.fuelReturns)).toBe(true);
  });
});
