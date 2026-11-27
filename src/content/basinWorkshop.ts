/** Basin recipes (docs/OVERHAUL_PLAN.md A.5): what a mixer or a press makes of the items and water in a basin below it. */
export interface BasinRecipe {
  id: string;
  machine: 'mixer' | 'mech_press' | 'rolling_mill' | 'drop_forge';
  items: Record<string, number>;
  fluid?: { key: string; litres: number };
  output: { item: string; count: number };
  seconds: number;
  minRpm: number;
}

export const BASIN_RECIPES: readonly BasinRecipe[] = [
  { id: 'dough', machine: 'mixer', items: { flour: 2 }, fluid: { key: 'water', litres: 250 }, output: { item: 'dough', count: 2 }, seconds: 4, minRpm: 32 },
  { id: 'bronze_alloy', machine: 'mixer', items: { copper_ingot: 3, tin_ingot: 1 }, output: { item: 'bronze_ingot', count: 4 }, seconds: 8, minRpm: 32 },
  { id: 'bronze_plate_press', machine: 'mech_press', items: { bronze_ingot: 2 }, output: { item: 'bronze_plate', count: 1 }, seconds: 3, minRpm: 16 },
  { id: 'iron_plate_press', machine: 'mech_press', items: { iron_ingot: 2 }, output: { item: 'iron_plate', count: 1 }, seconds: 3, minRpm: 16 },
  // Forge heavy industry: the rolling mill gives a plate for every ingot where the press needs two; the drop forge shapes parts cold.
  { id: 'iron_plate_roll', machine: 'rolling_mill', items: { iron_ingot: 2 }, output: { item: 'iron_plate', count: 2 }, seconds: 4, minRpm: 64 },
  { id: 'steel_plate_roll', machine: 'rolling_mill', items: { steel_ingot: 2 }, output: { item: 'steel_plate', count: 2 }, seconds: 5, minRpm: 64 },
  { id: 'copper_plate_roll', machine: 'rolling_mill', items: { copper_ingot: 2 }, output: { item: 'copper_plate', count: 2 }, seconds: 3, minRpm: 64 },
  { id: 'bronze_plate_roll', machine: 'rolling_mill', items: { bronze_ingot: 2 }, output: { item: 'bronze_plate', count: 2 }, seconds: 3, minRpm: 64 },
  { id: 'chassis_drop', machine: 'drop_forge', items: { iron_plate: 4, bronze_ingot: 2 }, output: { item: 'chassis', count: 1 }, seconds: 6, minRpm: 32 },
  { id: 'copper_coil_drop', machine: 'drop_forge', items: { copper_wire: 4, iron_ingot: 1 }, output: { item: 'copper_coil', count: 2 }, seconds: 4, minRpm: 32 },
  { id: 'steel_axle_drop', machine: 'drop_forge', items: { steel_ingot: 1 }, output: { item: 'steel_axle', count: 3 }, seconds: 4, minRpm: 32 },
];

/** One line per recipe, drawn as a card: inputs, the machine and its speed, the output ("2 flour + 250 L water > mixer 32 rpm, 4 s > 2 dough"). */
export function basinCard(r: BasinRecipe): string {
  const ins = [...Object.entries(r.items).map(([i, n]) => `${n} ${i.replace(/_/g, ' ')}`), ...(r.fluid ? [`${r.fluid.litres} L ${r.fluid.key}`] : [])];
  return `${ins.join(' + ')} > ${r.machine === 'mixer' ? 'mixer' : r.machine === 'mech_press' ? 'press' : r.machine === 'rolling_mill' ? 'rolling mill' : 'drop forge'} ${r.minRpm} rpm, ${r.seconds} s > ${r.output.count} ${r.output.item.replace(/_/g, ' ')}`;
}
