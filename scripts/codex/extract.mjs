// Dumps the game registry (items, recipes, blocks, furnace tiers, ages) plus 16x16 texture PNG data URIs
// and per-item crafting complexity (`cx`) as one JSON-serialisable object.
import { importSource } from '../lib/bundle.mjs';
import { encodePng } from '../lib/png.mjs';

/** Magenta/black checker, used for any texture the painter cannot produce. */
function missingTexture() {
  const px = Buffer.alloc(16 * 16 * 4);
  for (let i = 0; i < 256; i++) {
    const on = ((i & 15) >> 2) + (i >> 6) & 1;
    px.set(on ? [255, 0, 255, 255] : [20, 0, 20, 255], i * 4);
  }
  return px;
}

/**
 * Per item: depth (crafting steps from raw materials, via the shallowest recipe), raw (raw-material units
 * per one item, via that recipe, 1 decimal), station/tier/temp of that recipe ('raw' / 0 / 0 if not crafted).
 * Cycles are cut: an item already on the path counts as raw.
 */
export function computeCx(itemKeys, recipes) {
  const byOut = new Map();
  for (const r of recipes) {
    if (!byOut.has(r.output.item)) byOut.set(r.output.item, []);
    byOut.get(r.output.item).push(r);
  }
  const memo = new Map();
  const solve = (key, path) => {
    if (memo.has(key)) return memo.get(key);
    const options = path.has(key) ? [] : byOut.get(key) ?? [];
    if (!options.length) return { depth: 0, raw: 1, recipe: null };
    path.add(key);
    let best = null;
    for (const r of options) {
      let depth = 0, raw = 0;
      for (const i of r.inputs) {
        const s = solve(i.item, path);
        depth = Math.max(depth, s.depth);
        raw += (s.raw * i.count) / r.output.count;
      }
      if (!best || depth + 1 < best.depth || (depth + 1 === best.depth && raw < best.raw)) best = { depth: depth + 1, raw, recipe: r };
    }
    path.delete(key);
    memo.set(key, best);
    return best;
  };
  const cx = {};
  for (const k of itemKeys) {
    const s = solve(k, new Set());
    const r = s.recipe;
    cx[k] = {
      depth: s.depth,
      raw: r ? Math.round(s.raw * 10) / 10 : 0,
      station: r ? r.station : 'raw',
      tier: r ? r.tier ?? 0 : 0,
      temp: r ? r.temp ?? 0 : 0,
    };
  }
  return cx;
}

export async function extract() {
  const g = await importSource(`
    export { BLOCKS, ITEMS, RECIPES, TEXTURE_NAMES, FURNACE_TIERS, AGES } from 'src/core/registry';
    export { paintTexture } from 'src/render/textures';
    export { ASPECTS } from 'src/magic/aspects';
    export { RESEARCH } from 'src/magic/entries';
    export { aspectsOf } from 'src/magic/fingerprint';
    export { ARCANE_RECIPES, INFUSIONS } from 'src/content/recipesMagic';
  `);
  const tex = { missing: 'data:image/png;base64,' + encodePng(16, 16, missingTexture()).toString('base64') };
  const unknown = new Set();
  const uri = (layer) => {
    const name = g.TEXTURE_NAMES[layer];
    if (name === undefined) return 'missing';
    if (!tex[name]) {
      try {
        tex[name] = 'data:image/png;base64,' + encodePng(16, 16, Buffer.from(g.paintTexture(name))).toString('base64');
      } catch {
        unknown.add(name);
        return 'missing';
      }
    }
    return name;
  };
  const blockByKey = new Map(g.BLOCKS.map((b) => [b.key, b]));
  const items = {};
  for (const it of g.ITEMS) {
    let icon, top = null;
    const b = it.iconLayer >= 0 ? null : blockByKey.get(it.block);
    if (it.iconLayer >= 0) icon = uri(it.iconLayer);
    else if (b) { icon = uri(b.layers[0]); top = uri(b.layers[2]); }
    else icon = 'missing';
    items[it.key] = { name: it.name, desc: it.desc, cat: it.category, age: it.age, icon, top, food: it.food?.hunger ?? null, fuel: it.fuel ? it.fuel.flameTempC : null };
  }
  const recipes = g.RECIPES.map((r) => ({ id: r.id, station: r.station, kind: r.kind, inputs: r.inputs, output: r.output, by: r.byproducts, t: r.timeS, temp: r.minTempC, tier: r.minTier, age: r.age }));
  const blocks = g.BLOCKS.filter((b) => b.key !== 'air').map((b) => ({
    key: b.key, name: b.name, desc: b.desc, shape: b.shape, side: uri(b.layers[0]), top: uri(b.layers[2]), front: uri(b.layersActive?.[5] ?? b.layers[5]),
    hard: b.hardness, tool: b.tool, tier: b.minTier, light: b.light, drops: b.drops.map((d) => d.item), machine: b.machine, age: b.age, liquid: b.liquid,
  }));
  const tiers = g.FURNACE_TIERS.map((t) => ({ tier: t.tier, name: t.name, max: t.maxTempC, age: t.age }));
  const ages = g.AGES.map((a) => ({ key: a.key, name: a.name, blurb: a.blurb }));
  const cx = computeCx(Object.keys(items), recipes);
  // Essentia & Research (docs/api/magic.md): aspects, the research tree, desk and altar recipes, every item's fingerprint.
  const magic = {
    aspects: g.ASPECTS.map((a) => ({ key: a.key, name: a.name, tier: a.tier, parts: a.parts, meaning: a.meaning, color: a.color })),
    research: g.RESEARCH.map((e) => ({ key: e.key, title: e.title, age: e.age, requires: e.requires, text: e.text, unlocks: e.unlocks })),
    arcane: g.ARCANE_RECIPES, infusions: g.INFUSIONS,
    fp: Object.fromEntries(Object.keys(items).map((k) => [k, g.aspectsOf(k)])),
  };
  return { data: { tex, items, recipes, blocks, tiers, ages, cx, magic }, unknownTextures: [...unknown] };
}
