/**
 * The content golden snapshot (tests/golden/content.json): every authored block, item, recipe, machine and objective
 * reduced to its balance-relevant data (names, descriptions and texture names left out). `golden.test.ts` fails when an
 * EXISTING entry changes or disappears and only lists additions; `npm run golden:update` rewrites the file and the
 * diff is reviewed like a lockfile.
 */
import { BLOCK_SPECS } from './blocks';
import { ITEM_SPECS } from './items';
import { RECIPE_SPECS } from './recipes';
import { MACHINE_SPECS } from './tech';
import { OBJECTIVES } from './objectives';

const SKIP = new Set(['name', 'desc', 'textures', 'icon', 'iconLayer', 'blurb', 'title', 'text', 'hint', 'model']);

/** JSON-stable copy of `v` without presentation fields. */
function clean(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) if (!SKIP.has(k) && (v as Record<string, unknown>)[k] !== undefined) out[k] = clean((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}

export interface ContentGolden {
  blocks: Record<string, unknown>;
  items: Record<string, unknown>;
  recipes: Record<string, unknown>;
  machines: Record<string, unknown>;
  objectives: Record<string, unknown>;
}

export function contentSnapshot(): ContentGolden {
  const by = (list: readonly { key?: string; id?: string; kind?: string }[], k: 'key' | 'id' | 'kind'): Record<string, unknown> =>
    Object.fromEntries(list.map((e) => [e[k] as string, clean(e)]));
  return {
    blocks: by(BLOCK_SPECS, 'key'),
    items: by(ITEM_SPECS, 'key'),
    recipes: by(RECIPE_SPECS, 'id'),
    machines: by(MACHINE_SPECS, 'kind'),
    objectives: by(OBJECTIVES as never, 'id'),
  };
}
