/**
 * Glue audit of the content tables: finds items, blocks and recipes that nothing makes, nothing uses, or the player
 * cannot read about. Pure functions over the registry plus a textual scan of src/ for code-side references (shops,
 * hand-written handlers, tables that live outside the registry). Used by glueAudit.test.ts, which turns the findings
 * into a ratchet: new content must be wired in, and an entry may leave the allowlist but never join it silently.
 */
// @ts-expect-error the game's tsconfig carries no node types; vitest runs on node
import { readdirSync, readFileSync } from 'node:fs';
// @ts-expect-error same
import { join } from 'node:path';
import { BLOCKS, CREATURES, ITEMS, MACHINES, OBJECTIVES, RECIPES, FURNACE_TIERS } from '../core/registry';
import { LOOT_TABLES, NAMED_TABLES } from './loot';
import { ALCHEMY, ARCANE_RECIPES, INFUSIONS } from './recipesMagic';
import { BUILD_RECIPE_SPECS } from './toolParts';
import { STRUCTURE_LOOT } from './lootStructures';
import { ANIMAL_YIELDS } from './animalYields';
import { FISH, JUNK } from './fishing';
import { ROD_TIERS } from './itemsMagic';
import { ASPECTS } from '../magic/aspects';
import type { LootTableSpec } from '../core/types';

export interface GlueFindings {
  /** Items nothing makes, drops, sells or hands out. */
  itemsNoSource: string[];
  /** Items nothing consumes, wears, eats, places or trades. */
  itemsNoUse: string[];
  /** Items with no description (tooltip). Icons are covered by textures.test.ts ("a dedicated painter for every registry texture"). */
  itemsNoTooltip: string[];
  /** Soft tier: no structural source/use in the tables, only code mentions (item -> files). Needs a human look. */
  itemsSourceByCodeOnly: string[];
  itemsUseByCodeOnly: string[];
  /** Soft tier: block items whose only use is to be placed (no recipe, fuel, food or machine takes them). */
  itemsPlaceOnly: string[];
  /** Blocks whose item cannot be had: no item places it, nothing drops it, and nothing spawns it in code. */
  blocksNoSource: string[];
  /** Blocks nothing uses: no recipe station, no machine, no world code mentions it, and it is not decor/scenery. */
  blocksNoUse: string[];
  blocksNoTooltip: string[];
  /** Recipes whose output nothing uses (output item has no use) or whose inputs are not obtainable. */
  recipesDeadOutput: string[];
  recipesUnobtainableInput: string[];
  /** Recipes that cannot be made anywhere: the station block has no item and cannot be found. */
  recipesNoStation: string[];
  /** Two recipes at one station with the same inputs and output (a duplicate row in the crafting list). */
  recipesDuplicate: string[];
}

declare const __dirname: string;
const SRC: string = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.ts$/.test(e.name) && !/\.test\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

/** The files that merely define content: a mention there is not a use. */
const DEFINING = /src[\\/]content[\\/](items|blocks|recipes)[A-Za-z]*\.ts$|src[\\/]content[\\/]specRoster|blockIds\.lock|aliases\.ts|glueAudit\.ts$/;

let cache: { text: Map<string, string> } | null = null;
function sources(): Map<string, string> {
  if (!cache) {
    const text = new Map<string, string>();
    for (const f of walk(SRC)) if (!DEFINING.test(f)) text.set(f, readFileSync(f, 'utf8'));
    cache = { text };
  }
  return cache.text;
}

/** Files that only hand things out (drop tables, world generation, solver lists): a mention there is a source, not a use. */
const GIVING = /src[\\/](content[\\/](loot|lootStructures|biomeMobs|creatures|oreVeins|animalYields|fishing|progression|specRoster[A-Za-z]*)\.ts|world[\\/](ids|structureDefs)\.ts)$/;

/** Files (outside the defining ones) that mention the key as a quoted string; `forUse` skips the files that only give. */
export function codeRefs(key: string, forUse = false): string[] {
  const needles = [`'${key}'`, `"${key}"`, `\`${key}\``];
  const hits: string[] = [];
  for (const [f, t] of sources()) if (!(forUse && GIVING.test(f)) && needles.some((n) => t.includes(n))) hits.push(f.slice(SRC.length - 3));
  return hits;
}

function lootItems(t: LootTableSpec, out: Set<string>): void {
  for (const e of [...t.entries, ...(t.guaranteed ?? [])]) {
    const anyE = e as unknown as { item?: string; table?: string };
    if (anyE.item) out.add(anyE.item);
  }
}

export function auditGlue(): GlueFindings {
  const made = new Set<string>();      // structural sources
  const consumed = new Set<string>();  // structural uses
  for (const r of RECIPES) {
    made.add(r.output.item);
    for (const b of r.byproducts) made.add(b.item);
    for (const i of r.inputs) consumed.add(i.item);
  }
  // Recipes that live outside the registry's RECIPES: modular tool builds, the Rune Desk, the altar and the alchemy bench.
  for (const r of BUILD_RECIPE_SPECS) { made.add(r.output.item); for (const i of r.inputs) consumed.add(i.item); }
  for (const r of ARCANE_RECIPES) { made.add(r.output.item); for (const i of r.inputs) consumed.add(i.item); }
  for (const r of INFUSIONS) { made.add(r.output.item); consumed.add(r.center); for (const k of r.around) consumed.add(k); }
  for (const r of ALCHEMY) { made.add(r.output.item); consumed.add(r.catalyst); }
  for (const b of BLOCKS) for (const d of b.drops) made.add(d.item);
  for (const c of CREATURES) for (const d of c.drops) made.add(d.item);
  for (const k of Object.values(ANIMAL_YIELDS)) for (const i of k) made.add(i);
  for (const fish of FISH) made.add(fish.item);
  for (const j of JUNK) made.add(j.item);
  const loot = new Set<string>();
  for (const t of [...LOOT_TABLES, ...NAMED_TABLES, ...Object.values(STRUCTURE_LOOT)]) lootItems(t, loot);
  for (const k of loot) made.add(k);
  for (const o of OBJECTIVES) for (const r of o.reward ?? []) made.add(r.item);
  // Families whose keys are built in code: every aspect has a vial (bottled at a thin place or from a jar and spent
  // refilling jars), and every rod and wand is a gathering rod.
  for (const a of ASPECTS) { made.add(`vial_${a.key}`); consumed.add(`vial_${a.key}`); }
  for (const r of ROD_TIERS) consumed.add(r.key);
  for (const t of FURNACE_TIERS) for (const c of t.upgradeCost) consumed.add(c.item);
  for (const m of MACHINES.values()) for (const f of m.fuels ?? []) consumed.add(f);
  for (const it of ITEMS) {
    if (it.fuel?.fuelReturns) made.add(it.fuel.fuelReturns);
    if (it.brews) { consumed.add(it.key); made.add(it.brews); }
    if (it.cools) made.add((it.cools as unknown as { to?: string }).to ?? '');
    if (it.container) {
      const c = it.container as unknown as Record<string, unknown>;
      for (const v of Object.values(c)) if (typeof v === 'string') made.add(v);
    }
  }

  // Blocks have an item that places them (itemKey) or are reached some other way.
  const blockItem = new Map(BLOCKS.map((b) => [b.key, b.itemKey]));
  const placedBlocks = new Set(ITEMS.filter((i) => i.block).map((i) => i.block as string));

  const f: GlueFindings = {
    itemsNoSource: [], itemsNoUse: [], itemsNoTooltip: [], itemsSourceByCodeOnly: [], itemsUseByCodeOnly: [], itemsPlaceOnly: [],
    blocksNoSource: [], blocksNoUse: [], blocksNoTooltip: [],
    recipesDeadOutput: [], recipesUnobtainableInput: [], recipesNoStation: [], recipesDuplicate: [],
  };

  const hasSource = (key: string): boolean => made.has(key) || codeRefs(key).length > 0;
  const structUse = (it: (typeof ITEMS)[number]): boolean =>
    consumed.has(it.key) || !!(it.tool || it.weapon || it.armour || it.food || it.drink || it.fuel || it.block || it.mould || it.brews || it.container || it.wear);
  const hasUse = (it: (typeof ITEMS)[number]): boolean => structUse(it) || codeRefs(it.key, true).length > 0;

  for (const it of ITEMS) {
    // Block items follow their block: they exist to be placed (itemsNoUse) and are made like any other item.
    if (!hasSource(it.key)) f.itemsNoSource.push(it.key);
    if (!hasUse(it)) f.itemsNoUse.push(it.key);
    if (it.block && !consumed.has(it.key) && !it.fuel && !it.food && !it.drink && !it.tool && !it.weapon && !it.armour && it.block === it.key && !it.container && !it.brews) f.itemsPlaceOnly.push(it.key);
    if (!made.has(it.key) && codeRefs(it.key).length > 0) f.itemsSourceByCodeOnly.push(`${it.key} <- ${codeRefs(it.key).join(', ')}`);
    if (!structUse(it) && codeRefs(it.key, true).length > 0) f.itemsUseByCodeOnly.push(`${it.key} -> ${codeRefs(it.key, true).join(', ')}`);
    if (!it.desc || it.desc.trim() === '') f.itemsNoTooltip.push(it.key);
  }
  for (const b of BLOCKS) {
    if (b.key === 'air') continue;
    if (!b.desc || b.desc.trim() === '') f.blocksNoTooltip.push(b.key);
    const itemKey = blockItem.get(b.key);
    // Obtainable: an item places it, or something drops/gives it, or code spawns it (world gen, harvestLeaves).
    const worldMade = codeRefs(b.key).length > 0 || BLOCKS.some((o) => o.harvestLeaves === b.key);
    if (!itemKey && !placedBlocks.has(b.key) && !worldMade) f.blocksNoSource.push(b.key);
    const used = b.station !== null || b.machine !== null || RECIPES.some((r) => r.station === b.key) || codeRefs(b.key).length > 0
      || ITEMS.some((i) => i.block === b.key) || FURNACE_TIERS.some((t) => t.block === b.key) || b.drops.length > 0;
    if (!used) f.blocksNoUse.push(b.key);
  }

  const useKeys = new Set(ITEMS.filter(hasUse).map((i) => i.key));
  const seen = new Map<string, string>();
  const stationBlocks = new Set(BLOCKS.filter((b) => b.itemKey || placedBlocks.has(b.key)).flatMap((b) => [b.key, b.machine ?? '']));
  for (const r of RECIPES) {
    if (!useKeys.has(r.output.item) && !consumed.has(r.output.item)) f.recipesDeadOutput.push(r.id);
    for (const i of r.inputs) if (!hasSource(i.item) && !f.recipesUnobtainableInput.includes(r.id)) f.recipesUnobtainableInput.push(r.id);
    if (r.station !== 'hand' && r.station !== 'workbench' && r.station !== 'furnace') {
      const ok = stationBlocks.has(r.station) || MACHINES.get(r.station)?.blocks.some((b) => blockItem.get(b) || placedBlocks.has(b));
      if (!ok) f.recipesNoStation.push(r.id);
    }
    const sig = `${r.station}|${r.inputs.map((i) => `${i.count}${i.item}`).sort().join(',')}|${r.output.count}${r.output.item}`;
    const prev = seen.get(sig);
    if (prev) f.recipesDuplicate.push(`${prev} = ${r.id}`);
    else seen.set(sig, r.id);
  }
  for (const k of Object.keys(f) as Array<keyof GlueFindings>) f[k].sort();
  return f;
}
