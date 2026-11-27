/**
 * Recipe discovery by experiment (docs/api/discovery.md). Hidden recipes live in HIDDEN_RECIPES; the player puts
 * unknown things together at a station and `experiment` says what happened. A try that has all but one of the right
 * parts is "close" and teaches a hint; a full match is discovered, consumes the ingredients and fills the
 * RecipeBook. DOM-free; the book saves as a plain object.
 */
import { itemOrNull } from '../core/registry';
import type { ItemAmount } from '../core/types';
import { craft, mergeAmounts } from './crafting';
import type { Inventory } from './inventory';

export interface HiddenRecipe {
  id: string;
  /** Station key the experiment must be made at ('workbench', 'furnace' ...). */
  station: string;
  inputs: readonly ItemAmount[];
  output: ItemAmount;
  /** Shown in the book once the player gets close. */
  hint: string;
}

export const HIDDEN_RECIPES: readonly HiddenRecipe[] = [
  { id: 'waxed_cord', station: 'workbench', inputs: [{ item: 'fiber', count: 3 }, { item: 'pine_resin', count: 1 }], output: { item: 'cord', count: 4 }, hint: 'Sticky resin grips loose fibre.' },
  { id: 'sweet_bun_wild', station: 'workbench', inputs: [{ item: 'dough', count: 1 }, { item: 'sugar', count: 1 }, { item: 'wildberries', count: 2 }], output: { item: 'sweet_bun', count: 2 }, hint: 'Dough likes sweet, tart company.' },
  { id: 'cookie_batch', station: 'workbench', inputs: [{ item: 'flour', count: 2 }, { item: 'sugar', count: 1 }, { item: 'pine_sap', count: 1 }], output: { item: 'sugar_cookie', count: 4 }, hint: 'Sap and sugar bind flour into crisp rounds.' },
  { id: 'cloth_bolt', station: 'workbench', inputs: [{ item: 'fiber', count: 4 }, { item: 'cord', count: 1 }], output: { item: 'cloth', count: 1 }, hint: 'Fibre, tied and tightly worked, becomes cloth.' },
  { id: 'travellers_stew', station: 'furnace', inputs: [{ item: 'raw_chop', count: 1 }, { item: 'carrot', count: 1 }, { item: 'potato', count: 1 }], output: { item: 'hearth_stew', count: 2 }, hint: 'Meat and roots, simmered together, feed two.' },
  { id: 'quick_brick', station: 'furnace', inputs: [{ item: 'silica', count: 2 }, { item: 'coal', count: 1 }], output: { item: 'firebrick', count: 2 }, hint: 'Sand glass and coal bake hard.' },
  { id: 'blister_steel', station: 'furnace', inputs: [{ item: 'iron_ingot', count: 3 }, { item: 'charcoal', count: 2 }], output: { item: 'steel_ingot', count: 2 }, hint: 'Iron that soaks in charcoal fire turns hard.' },
  { id: 'quartz_melt', station: 'furnace', inputs: [{ item: 'silica', count: 4 }, { item: 'coal', count: 1 }], output: { item: 'fused_quartz', count: 1 }, hint: 'Glass sand held very hot runs clear as water.' },
  { id: 'flux_aluminum', station: 'furnace', inputs: [{ item: 'alumina', count: 3 }, { item: 'coal', count: 2 }], output: { item: 'aluminum_ingot', count: 1 }, hint: 'The white powder gives up its metal to a hungry fire.' },
];

export type ExperimentResult =
  | { kind: 'empty'; message: string }
  | { kind: 'nothing'; message: string }
  | { kind: 'close'; message: string; hint: string; recipeId: string }
  | { kind: 'known'; message: string; recipe: HiddenRecipe }
  | { kind: 'discovered'; message: string; recipe: HiddenRecipe };

export interface RecipeBookSave {
  found: string[];
  hinted: string[];
  tries: number;
}

const sig = (list: readonly ItemAmount[]): string =>
  mergeAmounts(list)
    .filter((a) => a.count > 0)
    .sort((a, b) => a.item.localeCompare(b.item))
    .map((a) => `${a.item}x${a.count}`)
    .join('|');

/** How close a try is to a recipe: -1 not close, else higher is closer. All but one right item, at most one stranger. */
function closeness(attempt: readonly ItemAmount[], r: HiddenRecipe): number {
  const have = new Map(mergeAmounts(attempt).map((a) => [a.item, a.count] as const));
  const present = r.inputs.filter((w) => have.has(w.item)).length;
  const exact = r.inputs.filter((w) => have.get(w.item) === w.count).length;
  const extras = [...have.keys()].filter((k) => !r.inputs.some((w) => w.item === k)).length;
  if (present < 1 || present < r.inputs.length - 1 || extras > 1) return -1;
  if (present + extras < 2 && r.inputs.length > 1 && present < r.inputs.length) return -1;
  return present * 2 + exact;
}

export class RecipeBook {
  private readonly found = new Set<string>();
  private readonly hinted = new Set<string>();
  tries = 0;

  constructor(private readonly recipes: readonly HiddenRecipe[] = HIDDEN_RECIPES) {}

  knows(id: string): boolean {
    return this.found.has(id);
  }

  get count(): number {
    return this.found.size;
  }

  get total(): number {
    return this.recipes.length;
  }

  /** Marks a recipe found without an experiment (a scroll, a trader). False when already known or an unknown id. */
  learn(id: string): boolean {
    if (!this.recipes.some((r) => r.id === id) || this.found.has(id)) return false;
    this.found.add(id);
    return true;
  }

  /** Book pages: found recipes in full, the rest a riddle (the hint shows only after a close try). */
  entries(): { id: string; found: boolean; title: string; text: string }[] {
    return this.recipes.map((r) => {
      const found = this.found.has(r.id);
      const name = itemOrNull(r.output.item)?.name ?? r.output.item;
      if (found) {
        const list = r.inputs.map((i) => `${i.count} ${itemOrNull(i.item)?.name ?? i.item}`).join(', ');
        return { id: r.id, found, title: name, text: `${list} at the ${r.station} makes ${r.output.count} ${name}` };
      }
      return { id: r.id, found, title: '???', text: this.hinted.has(r.id) ? r.hint : 'Not yet discovered' };
    });
  }

  /** The hidden recipe an experiment matches exactly, without consuming anything. */
  match(station: string, attempt: readonly ItemAmount[]): HiddenRecipe | null {
    const s = sig(attempt);
    return this.recipes.find((r) => r.station === station && sig(r.inputs) === s) ?? null;
  }

  /**
   * The player experiments at `station` with `attempt` (taken from `source`). A full match consumes the inputs and
   * puts the output into `into`; a repeat is 'known'. A near miss costs nothing and teaches a hint.
   */
  experiment(station: string, attempt: readonly ItemAmount[], source: Inventory, into: Inventory = source): ExperimentResult {
    const parts = attempt.filter((a) => a.count > 0);
    if (parts.length === 0) return { kind: 'empty', message: 'Put something on the table first' };
    const hit = this.match(station, parts);
    if (hit) {
      const was = this.found.has(hit.id);
      const r = craft({ inputs: hit.inputs, output: hit.output }, [source], into);
      if (!r.ok) return { kind: 'nothing', message: r.reason };
      this.tries++;
      this.found.add(hit.id);
      return was
        ? { kind: 'known', message: 'You make it again', recipe: hit }
        : { kind: 'discovered', message: `Discovered: ${itemOrNull(hit.output.item)?.name ?? hit.output.item}!`, recipe: hit };
    }
    this.tries++;
    let best: HiddenRecipe | null = null;
    let bestScore = -1;
    for (const r of this.recipes) {
      if (r.station !== station) continue;
      const score = closeness(parts, r);
      if (score > bestScore) {
        best = r;
        bestScore = score;
      }
    }
    if (best && bestScore >= 0 && !this.found.has(best.id)) {
      this.hinted.add(best.id);
      return { kind: 'close', message: 'Something stirs, but it is not quite right', hint: best.hint, recipeId: best.id };
    }
    return { kind: 'nothing', message: 'Nothing happens' };
  }

  toJSON(): RecipeBookSave {
    return { found: [...this.found], hinted: [...this.hinted], tries: this.tries };
  }

  /** Replaces this book's contents from a save (missing or damaged data leaves it empty). */
  load(raw: Partial<RecipeBookSave> | null | undefined): void {
    const b = RecipeBook.fromJSON(raw, this.recipes);
    this.found.clear();
    this.hinted.clear();
    for (const id of b.found) this.found.add(id);
    for (const id of b.hinted) this.hinted.add(id);
    this.tries = b.tries;
  }

  static fromJSON(raw: Partial<RecipeBookSave> | null | undefined, recipes: readonly HiddenRecipe[] = HIDDEN_RECIPES): RecipeBook {
    const book = new RecipeBook(recipes);
    const ok = (id: unknown): id is string => typeof id === 'string' && recipes.some((r) => r.id === id);
    for (const id of raw?.found ?? []) if (ok(id)) book.found.add(id);
    for (const id of raw?.hinted ?? []) if (ok(id)) book.hinted.add(id);
    if (typeof raw?.tries === 'number' && raw.tries >= 0) book.tries = Math.floor(raw.tries);
    return book;
  }
}
