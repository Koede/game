/**
 * Enchantments (docs/plans/enchantments.md): behaviour a stack carries, not a stat. `ItemStack.enchants` maps an enchant key
 * to its level; effects read ONLY `enchantLevel(stack, key)`, so a new enchant is a registry entry plus one call at the place
 * its verb happens. Pure data and helpers, DOM-free, no world.
 */
import type { Aspect } from '../magic/aspects';
import { itemOrNull } from './registry';
import type { ItemDef, ItemStack, Slot } from './types';

export interface EnchantDef {
  key: string;
  name: string;
  /** Highest level (1..max). */
  max: number;
  /** The aspect the enchant is tied to: its colour and icon, and what the altar will ask for. */
  aspect: Aspect;
  /** What the altar asks: `perLevel` of the aspect times the level being written (see `enchantCost`). */
  cost: { aspect: Aspect; perLevel: number };
  colour: string;
  description: string;
  /** Whether an item can take this enchant. */
  appliesTo(def: ItemDef | null | undefined): boolean;
}

const isPickaxe = (def: ItemDef | null | undefined): boolean => def?.tool?.kind === 'pickaxe' && !def.tool.fell;
const isDigTool = (def: ItemDef | null | undefined): boolean => {
  const k = def?.tool?.kind;
  return (k === 'pickaxe' || k === 'axe' || k === 'shovel') && !def?.tool?.fell;
};
/** Any tool a player holds (Featherfall and Lightstep ride on what is in hand). */
const isTool = (def: ItemDef | null | undefined): boolean => !!def?.tool;

export const ENCHANTS: readonly EnchantDef[] = [
  {
    key: 'veinseeker',
    name: 'Veinseeker',
    max: 3,
    aspect: 'vein',
    cost: { aspect: 'vein', perLevel: 2 },
    colour: '#c7a24a',
    description: 'Breaking an ore also breaks the connected vein: 3, 6 or 10 more blocks. It still never beats the pick\'s tier.',
    appliesTo: isPickaxe,
  },
  {
    key: 'magnet',
    name: 'Magnet',
    max: 3,
    aspect: 'drive',
    cost: { aspect: 'drive', perLevel: 2 },
    colour: '#e0a060',
    description: 'What this tool breaks or kills flies to you from 3, 5 or 7 blocks away, never through a wall.',
    appliesTo: isDigTool,
  },
  {
    key: 'ember',
    name: 'Ember',
    max: 1,
    aspect: 'cinder',
    cost: { aspect: 'cinder', perLevel: 2 },
    colour: '#e0683a',
    description: 'What this tool breaks is smelted as it falls: ore comes out as ingot, and a log as charcoal.',
    appliesTo: isDigTool,
  },
  {
    key: 'featherfall',
    name: 'Featherfall',
    max: 2,
    aspect: 'gale',
    cost: { aspect: 'gale', perLevel: 2 },
    colour: '#a8d8e8',
    description: 'Falls cost no health while you carry it. II: holding Jump on the way down slows the fall for a moment.',
    appliesTo: isTool,
  },
  {
    key: 'lightstep',
    name: 'Lightstep',
    max: 3,
    aspect: 'glow',
    cost: { aspect: 'glow', perLevel: 2 },
    colour: '#f4eab0',
    description: 'You leave a soft trail of light behind you that fades: a few cells at I, more at II and III.',
    appliesTo: isTool,
  },
  {
    key: 'bounty',
    name: 'Bounty',
    max: 3,
    aspect: 'clarity',
    cost: { aspect: 'clarity', perLevel: 2 },
    colour: '#f2c94c',
    description: 'What this tool breaks has a chance of one extra drop: 10%, 20% or 30%, marked by a small glint.',
    appliesTo: isDigTool,
  },
];

const BY_KEY = new Map<string, EnchantDef>(ENCHANTS.map((e) => [e.key, e]));

export const enchantDef = (key: string): EnchantDef | null => BY_KEY.get(key) ?? null;
export const isEnchantKey = (key: string): boolean => BY_KEY.has(key);

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
export const levelName = (level: number): string => ROMAN[level] ?? String(level);

/** Level of an enchant on a stack: 0 when it has none (or the stack is empty). THE helper every effect reads. */
export function enchantLevel(stack: Slot | undefined, key: string): number {
  const n = stack?.enchants?.[key];
  return typeof n === 'number' && n > 0 ? Math.floor(n) : 0;
}

/**
 * The level an effect runs at: the written level, one higher on a Masterwork tool (never past the enchant's maximum, and
 * never from nothing). Every effect in src/game/enchantEffects.ts reads this, so quality and enchantments work together.
 */
export function effectiveEnchantLevel(stack: Slot | undefined, key: string): number {
  const written = enchantLevel(stack, key);
  if (written < 1) return 0;
  return Math.min(BY_KEY.get(key)?.max ?? written, written + (stack?.quality === 2 ? 1 : 0));
}

export const isEnchanted = (stack: Slot | undefined): boolean => !!stack?.enchants && Object.keys(stack.enchants).length > 0;

/**
 * Clean enchants: unknown keys, non-numeric and non-positive levels dropped, levels clamped to each enchant's max.
 * Returns undefined when nothing is left (so a stack never carries an empty object).
 */
export function sanitizeEnchants(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, number> = {};
  for (const [key, v] of Object.entries(raw as Record<string, unknown>)) {
    const def = BY_KEY.get(key);
    if (!def || typeof v !== 'number' || !Number.isFinite(v)) continue;
    const level = Math.min(def.max, Math.floor(v));
    if (level >= 1) out[key] = level;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** A copy of the enchants (undefined stays undefined). */
export const copyEnchants = (e: Readonly<Record<string, number>> | undefined): Record<string, number> | undefined =>
  e && Object.keys(e).length > 0 ? { ...e } : undefined;

/** Whether `item` can take the enchant at all (the item's definition decides). */
export function canEnchant(def: ItemDef | null | undefined, key: string): boolean {
  const e = BY_KEY.get(key);
  return !!e && !!def && e.appliesTo(def);
}

/**
 * Returns new enchants with `key` set to `level` (clamped 1..max; the higher of the old and new level wins). Unknown key
 * returns the input unchanged.
 */
export function addEnchant(enchants: Readonly<Record<string, number>> | undefined, key: string, level: number): Record<string, number> | undefined {
  const def = BY_KEY.get(key);
  if (!def) return copyEnchants(enchants);
  const lv = Math.min(def.max, Math.max(1, Math.floor(level)));
  return { ...(enchants ?? {}), [key]: Math.max(lv, enchants?.[key] ?? 0) };
}

/**
 * Enchants a stack in place: THE entry the altar (phase 3) and loot tables call (loot: `enchantStack(stack, 'veinseeker', 1)`).
 * False, changing nothing, when the item cannot take it (`appliesTo`) or the key is unknown.
 */
export function enchantStack(stack: ItemStack, key: string, level: number, def?: ItemDef | null): boolean {
  const d = def === undefined ? itemOrNull(stack.item) : def;
  if (!canEnchant(d, key)) return false;
  stack.enchants = addEnchant(stack.enchants, key, level);
  return true;
}

/** The level an altar writes next on an item: one above what it has, or null when the enchant is already at max (or unknown). */
export function nextEnchantLevel(enchants: Readonly<Record<string, number>> | undefined, key: string): number | null {
  const def = BY_KEY.get(key);
  if (!def) return null;
  const cur = enchants?.[key] ?? 0;
  return cur >= def.max ? null : cur + 1;
}

/** Essentia an altar draws to write `level` of an enchant: its perLevel times the level (so II costs twice I). */
export function enchantCost(key: string, level: number): Partial<Record<Aspect, number>> {
  const def = BY_KEY.get(key);
  return def ? { [def.cost.aspect]: def.cost.perLevel * Math.max(1, Math.floor(level)) } : {};
}

/**
 * How unstable writing `level` onto an item with these enchants is: the sum of the levels already on it, plus the levels
 * above the first being written. A first enchant on a bare tool is steady (0).
 */
export function enchantInstability(enchants: Readonly<Record<string, number>> | undefined, level: number): number {
  const existing = Object.values(enchants ?? {}).reduce((s, n) => s + (typeof n === 'number' ? n : 0), 0);
  return existing + Math.max(0, Math.floor(level) - 1);
}

/** The research entry that records an enchant once the altar has taught it (src/magic/entries.ts). */
export const enchantEntryKey = (key: string): string => `enchant_${key}`;

export interface EnchantLine {
  key: string;
  level: number;
  /** "Veinseeker II" */
  text: string;
  colour: string;
  aspect: Aspect;
}

/** Tooltip lines, in registry order. Empty for a plain stack. */
export function enchantLines(stack: Slot | undefined): EnchantLine[] {
  const out: EnchantLine[] = [];
  for (const e of ENCHANTS) {
    const level = enchantLevel(stack, e.key);
    if (level > 0) out.push({ key: e.key, level, text: `${e.name} ${levelName(level)}`, colour: e.colour, aspect: e.aspect });
  }
  return out;
}
