/**
 * "What is this for?" lookup (docs/api/itemLookup.md): for one item, the recipes that make it, the recipes that use it,
 * and where it can be found without a recipe (drops, loot, fishing, rewards). Pure over the registry and the content
 * tables, so a panel (menus search, item card) only has to draw rows.
 */
import { BLOCKS, CREATURES, MACHINES, OBJECTIVES, RECIPES, block, itemOrNull } from '../core/registry';
import { LOOT_TABLES, NAMED_TABLES } from '../content/loot';
import { STRUCTURE_LOOT } from '../content/lootStructures';
import { ANIMAL_YIELDS } from '../content/animalYields';
import { FISH, JUNK } from '../content/fishing';
import { ALCHEMY, ARCANE_RECIPES, INFUSIONS } from '../content/recipesMagic';
import { BUILD_RECIPE_SPECS } from '../content/toolParts';
import type { LootTableSpec } from '../core/types';

export interface RecipeRow {
  id: string;
  /** Where it is made, in words ("Workbench", "Furnace", "Rune Desk"). */
  station: string;
  /** "2 Plank, 1 Stick" -> "1 Chair". */
  text: string;
  /** Every other item in the row (inputs and output), so a page can link to them. */
  items: string[];
}

const title = (s: string): string => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const nameOf = (key: string): string => itemOrNull(key)?.name ?? title(key);
const stationName = (station: string): string => {
  if (station === 'hand') return 'By hand';
  if (station === 'workbench') return 'Workbench';
  if (station === 'furnace') return 'Furnace';
  const b = BLOCKS.find((x) => x.key === station);
  return b?.name ?? (MACHINES.get(station) ? title(station) : title(station));
};
const amountText = (list: readonly { item: string; count: number }[]): string => list.map((a) => `${a.count} ${nameOf(a.item)}`).join(', ');

interface Flat { id: string; station: string; inputs: { item: string; count: number }[]; output: { item: string; count: number } }

let flatCache: Flat[] | null = null;
function allRecipes(): Flat[] {
  if (flatCache) return flatCache;
  const out: Flat[] = [];
  for (const r of RECIPES) out.push({ id: r.id, station: stationName(r.station), inputs: r.inputs, output: r.output });
  for (const r of BUILD_RECIPE_SPECS) out.push({ id: r.id, station: 'Workbench', inputs: r.inputs, output: r.output });
  for (const r of ARCANE_RECIPES) out.push({ id: r.id, station: r.bench ? 'Arcane Workbench' : 'Rune Desk', inputs: r.inputs, output: r.output });
  for (const r of INFUSIONS) out.push({ id: r.id, station: 'Infusion Altar', inputs: [{ item: r.center, count: 1 }, ...r.around.map((item) => ({ item, count: 1 }))], output: r.output });
  for (const r of ALCHEMY) out.push({ id: r.id, station: 'Alchemy', inputs: [{ item: r.catalyst, count: 1 }], output: r.output });
  flatCache = out;
  return out;
}

const row = (r: Flat): RecipeRow => ({ id: r.id, station: r.station, text: `${amountText(r.inputs)} -> ${amountText([r.output])}`, items: [...new Set([...r.inputs.map((i) => i.item), r.output.item])] });

/** Recipes that make the item (byproducts of registry recipes count too). */
export function madeBy(item: string): RecipeRow[] {
  const rows = allRecipes().filter((r) => r.output.item === item).map(row);
  for (const r of RECIPES) if (r.byproducts.some((b) => b.item === item) && r.output.item !== item) rows.push({ ...row({ id: r.id, station: stationName(r.station), inputs: r.inputs, output: r.output }), text: `${amountText(r.inputs)} -> ${amountText([r.output])} (leftover ${nameOf(item)})` });
  return rows;
}

/** Recipes that take the item as an input. */
export function usedIn(item: string): RecipeRow[] {
  return allRecipes().filter((r) => r.inputs.some((i) => i.item === item)).map(row);
}

function lootHolds(t: LootTableSpec, item: string): boolean {
  return [...t.entries, ...(t.guaranteed ?? [])].some((e) => e.item === item);
}

/** Where the item turns up without a recipe: block drops, creature drops, loot, fishing, rewards. Short phrases, deduplicated. */
export function foundIn(item: string): string[] {
  const out = new Set<string>();
  for (const b of BLOCKS) if (b.drops.some((d) => d.item === item)) out.add(`${b.shape === 'cross' ? 'Picking' : 'Digging'} ${b.name}`);
  for (const c of CREATURES) if (c.drops.some((d) => d.item === item)) out.add(`Dropped by ${c.name}`);
  for (const [animal, items] of Object.entries(ANIMAL_YIELDS)) if (items.includes(item)) out.add(`From a ${title(animal).toLowerCase()}`);
  if (FISH.some((f) => f.item === item)) out.add('Fishing');
  if (JUNK.some((j) => j.item === item)) out.add('Fishing (junk)');
  const isTrader = (t: LootTableSpec): boolean => (t.id ?? '').startsWith('trader');
  if ([...LOOT_TABLES, ...NAMED_TABLES].some((t) => !isTrader(t) && lootHolds(t, item))) out.add('Ruin and cache loot');
  if ([...LOOT_TABLES, ...NAMED_TABLES].some((t) => isTrader(t) && lootHolds(t, item))) out.add('The wandering trader');
  for (const [where, t] of Object.entries(STRUCTURE_LOOT)) if (lootHolds(t, item)) out.add(`Crate at a ${title(where).toLowerCase()}`);
  for (const o of OBJECTIVES) if ((o.reward ?? []).some((r) => r.item === item)) out.add('Goal reward');
  const def = itemOrNull(item);
  if (def?.block && block(def.block).placeOn && def.block !== item) out.add('Planted');
  return [...out];
}

export interface ItemLookup { item: string; name: string; madeAt: RecipeRow[]; usedFor: RecipeRow[]; foundAt: string[] }

/** Everything the "what is this for" page shows for one item. */
export function lookupItem(item: string): ItemLookup {
  return { item, name: nameOf(item), madeAt: madeBy(item), usedFor: usedIn(item), foundAt: foundIn(item) };
}

/** Short row for the item card: "Made at: Workbench, Furnace . Used in 6 recipes". Empty when there is nothing to say. */
export function cardLine(item: string): string {
  const made = [...new Set(madeBy(item).map((r) => r.station))];
  const uses = usedIn(item).length;
  const parts: string[] = [];
  if (made.length) parts.push(`Made at: ${made.slice(0, 3).join(', ')}`);
  else {
    const f = foundIn(item);
    if (f.length) parts.push(`Found: ${f.slice(0, 2).join(', ')}`);
  }
  if (uses > 0) parts.push(`Used in ${uses} recipe${uses === 1 ? '' : 's'}`);
  return parts.join('. ');
}

/** The two card rows ("Made at" or "Found", and "Used in"); empty when there is nothing to say. */
export function cardRows(item: string): [string, string][] {
  const rows: [string, string][] = [];
  const made = [...new Set(madeBy(item).map((r) => r.station))];
  if (made.length) rows.push(['Made at', made.slice(0, 3).join(', ')]);
  else {
    const f = foundIn(item);
    if (f.length) rows.push(['Found', f.slice(0, 2).join(', ')]);
  }
  const uses = usedIn(item).length;
  if (uses > 0) rows.push(['Used in', `${uses} recipe${uses === 1 ? '' : 's'}`]);
  return rows;
}
