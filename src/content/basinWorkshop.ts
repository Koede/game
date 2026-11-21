/** Basin recipes (docs/OVERHAUL_PLAN.md A.5): what a mixer or a press makes of the items and water in a basin below it. */
export interface BasinRecipe {
  id: string;
  machine: 'mixer' | 'mech_press';
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
];

/** One line per recipe, drawn as a card: inputs, the machine and its speed, the output ("2 flour + 250 L water > mixer 32 rpm, 4 s > 2 dough"). */
export function basinCard(r: BasinRecipe): string {
  const ins = [...Object.entries(r.items).map(([i, n]) => `${n} ${i.replace(/_/g, ' ')}`), ...(r.fluid ? [`${r.fluid.litres} L ${r.fluid.key}`] : [])];
  return `${ins.join(' + ')} > ${r.machine === 'mixer' ? 'mixer' : 'press'} ${r.minRpm} rpm, ${r.seconds} s > ${r.output.count} ${r.output.item.replace(/_/g, ' ')}`;
}
