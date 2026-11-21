/**
 * Aspect fingerprints of every block and item (docs/OVERHAUL_PLAN.md B.2). Deterministic and memoised; all numbers in
 * aspectTable.ts. Order: OVERRIDES, else crafted (first recipe making the key: inputs summed / output count, + craft 1),
 * else raw (keyword rules + category base + age bonus). Finally the four strongest, clamped 1..MAX_AMOUNT.
 */
import { blockOrNull, itemOrNull, RECIPES } from '../core/registry';
import type { RecipeDef } from '../core/types';
import { ASPECT_LIST, aspectOrder, type Aspect, type Aspects } from './aspects';
import { AGE_BONUS_PER_AGE, CATEGORY_BASE, KEYWORD_RULES, MAX_AMOUNT, MAX_ASPECTS, OVERRIDES } from './aspectTable';

const cache = new Map<string, Aspects>();
const inProgress = new Set<string>();
let firstRecipe: Map<string, RecipeDef> | null = null;

function recipeFor(key: string): RecipeDef | null {
  if (!firstRecipe) {
    firstRecipe = new Map();
    for (const r of RECIPES) if (!firstRecipe.has(r.output.item)) firstRecipe.set(r.output.item, r);
  }
  return firstRecipe.get(key) ?? null;
}

const add = (into: Record<string, number>, as: Aspects, times = 1): void => {
  for (const a of ASPECT_LIST) {
    const n = as[a];
    if (n) into[a] = (into[a] ?? 0) + n * times;
  }
};

/** The four strongest aspects (ties by aspect order), each clamped to 1..MAX_AMOUNT. */
export function normalise(raw: Record<string, number>): Aspects {
  const list = ASPECT_LIST.filter((a) => (raw[a] ?? 0) > 0)
    .map((a) => [a, raw[a]] as [Aspect, number])
    .sort((x, y) => y[1] - x[1] || aspectOrder(x[0]) - aspectOrder(y[0]))
    .slice(0, MAX_ASPECTS);
  const out: Aspects = {};
  for (const [a, n] of list) out[a] = Math.min(MAX_AMOUNT, Math.max(1, Math.round(n)));
  return out;
}

function rawOf(key: string): Record<string, number> {
  const sum: Record<string, number> = {};
  for (const word of key.split('_')) {
    const rule = KEYWORD_RULES[word];
    if (rule) add(sum, rule);
  }
  const it = itemOrNull(key);
  const category = it?.category ?? (blockOrNull(key) ? 'block' : 'misc');
  add(sum, CATEGORY_BASE[category] ?? { rune: 1 });
  const age = it?.age ?? 0;
  if (age > 0) {
    const top = ASPECT_LIST.filter((a) => (sum[a] ?? 0) > 0).sort((x, y) => (sum[y] ?? 0) - (sum[x] ?? 0))[0];
    if (top) sum[top] += age * AGE_BONUS_PER_AGE;
  }
  return sum;
}

function craftedOf(key: string, r: RecipeDef): Record<string, number> | null {
  const sum: Record<string, number> = {};
  let any = false;
  for (const input of r.inputs) {
    if (inProgress.has(input.item)) continue;
    add(sum, aspectsOf(input.item), input.count);
    any = true;
  }
  if (!any) return null;
  const per = Math.max(1, r.output.count);
  for (const a of Object.keys(sum)) sum[a] = Math.ceil(sum[a] / per);
  sum.craft = (sum.craft ?? 0) + 1;
  // Keep a little of what the key's own words say (a "copper_coil" stays copper-ish even when made from wire).
  add(sum, rawOf(key));
  return sum;
}

/** The fingerprint of any block, item or creature key. Never empty. */
export function aspectsOf(key: string): Aspects {
  const hit = cache.get(key);
  if (hit) return hit;
  let out: Aspects;
  const override = OVERRIDES[key];
  if (override) out = normalise(override as Record<string, number>);
  else {
    inProgress.add(key);
    const r = recipeFor(key);
    const crafted = r ? craftedOf(key, r) : null;
    inProgress.delete(key);
    out = normalise(crafted ?? rawOf(key));
  }
  if (Object.keys(out).length === 0) out = { rune: 1 };
  cache.set(key, out);
  return out;
}

/** Total units in a fingerprint. */
export const aspectTotal = (as: Aspects): number => ASPECT_LIST.reduce((s, a) => s + (as[a] ?? 0), 0);

/** For tests and the Codex: forget memoised results. */
export function resetFingerprints(): void {
  cache.clear();
  firstRecipe = null;
}
