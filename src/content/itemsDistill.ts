/**
 * Items of the glass distillery (docs/DISTILLERY_PLAN.md 8.2): the containers that carry its fluids in and out of a
 * rig. Beakers hold 250 L (the Glass Beaker of the sugar chain; `pine_sap` is its sap twin), canisters 1000 L; the
 * table of what holds what is CHEM_CONTAINERS in src/core/distill.ts. Engine fuels and what they are worth are
 * FUEL_GRADES there (chainsaw and tractor read it).
 */
import type { ItemSpec } from '../core/types';

const beaker = (key: string, name: string, desc: string): ItemSpec => ({ key, name, desc, category: 'material', age: 0, stack: 16 });
const can = (key: string, name: string, desc: string): ItemSpec => ({ key, name, desc, category: 'material', age: 1, stack: 8 });

export const DISTILL_ITEMS: ItemSpec[] = [
  beaker('syrup_beaker', 'Pine Syrup', 'A beaker of thick amber syrup boiled from pine sap. Ferment it with water in a sealed Reaction Vessel.'),
  beaker('wash_beaker', 'Sugar Wash', 'A beaker of fermented wash, a little alcohol in a lot of water. Distil it at 97 C into Low Wines.'),
  beaker('low_wines_beaker', 'Low Wines', 'A beaker of weak first-run spirit. Distil it again at 92 C into Spirit.'),
  beaker('spirit_beaker', 'Spirit', 'A beaker of clear distilled spirit, more than half alcohol.'),
  { ...beaker('fuel_ethanol_beaker', 'Fuel Ethanol', 'Nearly pure alcohol from a column still. It burns clean: a weak fuel for the chainsaw and the tractor.'), age: 1 },
  can('empty_canister', 'Empty Canister', 'A steel canister for 1000 litres. Fill it at a receiver, a tank, a pump or an oil pool.'),
  can('crude_canister', 'Crude Oil Canister', 'A canister of black crude oil. Pour it into a flask under a column of three segments and refine it at 350 C.'),
  can('gasoline_canister', 'Gasoline Canister', 'Light, golden gasoline from the top of the column. The best chainsaw fuel; the tractor runs on it too.'),
  can('kerosene_canister', 'Kerosene Canister', 'Pale kerosene, the middle cut of crude oil. Lamp and heater fuel to come.'),
  can('diesel_canister', 'Diesel Canister', 'Heavy amber diesel from the lowest cut. The tractor goes half again as far on it; a chainsaw cannot burn it.'),
  can('residue_canister', 'Heavy Residue', 'What crude oil leaves in the flask: lube base and bitumen. Vacuum stills will split it later.'),
  can('slop_canister', 'Slop Canister', 'A canister of mixed-up liquid. Pour it back into a flask and distil it again.'),
];
