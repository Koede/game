/**
 * Modular tools (docs/plans/modular-tools.md, phases 1-2 and the swap rule of 3). A pickaxe, axe or shovel is a HEAD of a
 * material, a HANDLE and a BINDING. Materials are data below; every combination is a real item, generated here, so saves,
 * stacks, wear, enchants and mining all work on it with no per-stack bookkeeping.
 *
 * The default build (any head, oak handle = two sticks, cord) is the old tool of that material, number for number: the
 * legacy keys (`flint_pickaxe`...) stay valid items and recipes and read as that build (`partsOfItem`). Stats:
 *   speed = head.speed * handle.speed          durability = round(head.durability * handle.durability * binding.hold)
 * Pure data and pure functions; imports no registry (the registry imports this).
 */
import type { ItemSpec, RecipeSpec, ToolKind } from '../core/types';
import { amount, amounts } from './amounts';

export type PartRole = 'head' | 'handle' | 'binding';
export type ModularKind = Extract<ToolKind, 'pickaxe' | 'axe' | 'shovel'>;
export const MODULAR_KINDS: readonly ModularKind[] = ['pickaxe', 'axe', 'shovel'];

export interface HeadMaterial {
  key: string;
  name: string;
  /** Mining tier it reaches. A rare handle or binding never adds tier. */
  tier: number;
  speed: number;
  durability: number;
  age: number;
  /** Item that mends it at an anvil (src/game/toolQuality.ts). */
  repair: string;
}
export interface HandleMaterial {
  key: string;
  name: string;
  /** Items spent to make one handle (the default oak handle is two sticks). */
  inputs: string;
  /** Factor on mining speed. */
  speed: number;
  /** Factor on durability. */
  durability: number;
  trait: string;
}
export interface BindingMaterial {
  key: string;
  name: string;
  /** Item that is the binding. */
  item: string;
  /** Factor on durability. */
  hold: number;
  trait: string;
}

export const HEADS: Readonly<Record<string, HeadMaterial>> = {
  wooden: { key: 'wooden', name: 'Wooden', tier: 1, speed: 1.4, durability: 12, age: 0, repair: 'plank' },
  flint: { key: 'flint', name: 'Flint', tier: 1, speed: 2, durability: 64, age: 0, repair: 'flint' },
  bronze: { key: 'bronze', name: 'Bronze', tier: 2, speed: 3, durability: 192, age: 0, repair: 'bronze_ingot' },
  iron: { key: 'iron', name: 'Iron', tier: 3, speed: 4.5, durability: 384, age: 2, repair: 'iron_ingot' },
  steel: { key: 'steel', name: 'Steel', tier: 4, speed: 6, durability: 768, age: 2, repair: 'steel_ingot' },
};
export const HANDLES: Readonly<Record<string, HandleMaterial>> = {
  oak: { key: 'oak', name: 'Oak', inputs: '2 stick', speed: 1, durability: 1, trait: 'Oak Grip: the standard handle' },
  pine: { key: 'pine', name: 'Pine', inputs: '1 pine_handle', speed: 1.1, durability: 0.85, trait: 'Pine Light: swings faster, wears sooner' },
};
export const BINDINGS: Readonly<Record<string, BindingMaterial>> = {
  cord: { key: 'cord', name: 'Cord', item: 'cord', hold: 1, trait: 'Cord: plain' },
  resin: { key: 'resin', name: 'Resin', item: 'pine_resin', hold: 1.2, trait: 'Resin: holds longer' },
};

/** Heads that are made as items (bronze heads already exist from the Ember handwork; wooden tools stay stopgaps). */
export const HEAD_ITEM_MATERIALS = ['flint', 'bronze', 'iron', 'steel'] as const;
export const DEFAULT_HANDLE = 'oak';
export const DEFAULT_BINDING = 'cord';

export interface ToolBuild {
  kind: ModularKind;
  head: string;
  handle: string;
  binding: string;
}

const KIND_LABEL: Record<ModularKind, string> = { pickaxe: 'Pickaxe', axe: 'Axe', shovel: 'Shovel' };
/** Units of head material one head costs (as the old tools: pickaxe and axe three, shovel one; flint two and one). */
const HEAD_UNITS: Record<string, Record<ModularKind, number>> = {
  flint: { pickaxe: 2, axe: 2, shovel: 1 },
  iron: { pickaxe: 3, axe: 3, shovel: 1 },
  steel: { pickaxe: 3, axe: 3, shovel: 1 },
};

export const isDefaultBuild = (b: Pick<ToolBuild, 'handle' | 'binding'>): boolean => b.handle === DEFAULT_HANDLE && b.binding === DEFAULT_BINDING;
export const headItemKey = (head: string, kind: ModularKind): string => `${head}_${kind}_head`;
/** Item key of a build: the plain legacy tool for the default build, else `<head>_<handle>_<binding>_<kind>`. */
export const buildItemKey = (b: ToolBuild): string => (isDefaultBuild(b) ? `${b.head}_${b.kind}` : `${b.head}_${b.handle}_${b.binding}_${b.kind}`);

/** The numbers a build comes to (the formulas in the file header). */
export function buildStats(b: ToolBuild): { tier: number; speed: number; durability: number } {
  const head = HEADS[b.head], handle = HANDLES[b.handle], binding = BINDINGS[b.binding];
  return {
    tier: head.tier,
    speed: Math.round(head.speed * handle.speed * 100) / 100,
    durability: Math.round(head.durability * handle.durability * binding.hold),
  };
}

export function buildName(b: ToolBuild): string {
  const base = `${HEADS[b.head].name} ${KIND_LABEL[b.kind]}`;
  return isDefaultBuild(b) ? base : `${base} (${HANDLES[b.handle].name}, ${BINDINGS[b.binding].name})`;
}

/** Heads that can be built into tools: those with a legacy tool of this kind (wooden too, as a virtual build only). */
const buildable = (head: string): boolean => HEADS[head] !== undefined;

const BUILDS: ToolBuild[] = [];
for (const head of HEAD_ITEM_MATERIALS)
  for (const kind of MODULAR_KINDS)
    for (const handle of Object.keys(HANDLES))
      for (const binding of Object.keys(BINDINGS)) BUILDS.push({ kind, head, handle, binding });

const BY_KEY = new Map<string, ToolBuild>();
for (const b of BUILDS) BY_KEY.set(buildItemKey(b), b);

/** The parts of a tool item: its build, or null for anything that is not a modular-capable tool. Legacy tools are the default build. */
export function partsOfItem(item: string): ToolBuild | null {
  const hit = BY_KEY.get(item);
  if (hit) return hit;
  for (const kind of MODULAR_KINDS) {
    if (!item.endsWith(`_${kind}`)) continue;
    const head = item.slice(0, -kind.length - 1);
    if (buildable(head)) return { kind, head, handle: DEFAULT_HANDLE, binding: DEFAULT_BINDING };
  }
  return null;
}

/** The part items one build is assembled from. */
export function partInputs(b: ToolBuild): string {
  const parts = [`1 ${headItemKey(b.head, b.kind)}`, HANDLES[b.handle].inputs, `1 ${BINDINGS[b.binding].item}`];
  return parts.join(', ');
}

/** The item key after replacing one part of a tool. Null when the replacement is not a known material of that role. */
export function swapPartKey(item: string, role: PartRole, material: string): string | null {
  const b = partsOfItem(item);
  if (!b) return null;
  const next: ToolBuild = { ...b, [role]: material };
  if (!HEADS[next.head] || !HANDLES[next.handle] || !BINDINGS[next.binding]) return null;
  const key = buildItemKey(next);
  return key === item || BY_KEY.has(key) || (isDefaultBuild(next) && buildable(next.head)) ? key : null;
}

/** What comes back when a part is taken off a tool: the item (a handle is its parts, a head its cast head). */
export function partReturn(b: ToolBuild, role: PartRole): string {
  if (role === 'head') return headItemKey(b.head, b.kind);
  if (role === 'binding') return BINDINGS[b.binding].item;
  return b.handle === DEFAULT_HANDLE ? 'stick' : `${b.handle}_handle`;
}

// ---- content ------------------------------------------------------------------------------------

export const TOOL_PART_ITEMS: ItemSpec[] = [
  {
    key: 'pine_handle', name: 'Pine Handle', category: 'component', age: 0, icon: 'item_stick',
    desc: 'A light, straight pine haft. Fitted to a head it swings a tenth faster than oak and wears a little sooner.',
  },
  // Heads not already cast from bronze (itemsHand.ts makes the bronze ones).
  ...HEAD_ITEM_MATERIALS.filter((m) => m !== 'bronze').flatMap((m) =>
    MODULAR_KINDS.map((kind): ItemSpec => ({
      key: headItemKey(m, kind), name: `${HEADS[m].name} ${KIND_LABEL[kind]} Head`, category: 'component', age: HEADS[m].age,
      desc: `A ${HEADS[m].name.toLowerCase()} ${kind} head. Bind it to a handle at the workbench; the handle and binding you pick change how it works.`,
    })),
  ),
  ...BUILDS.filter((b) => !isDefaultBuild(b)).map((b): ItemSpec => {
    const s = buildStats(b);
    return {
      key: buildItemKey(b), name: buildName(b), category: 'tool', age: HEADS[b.head].age, icon: `item_${b.head}_${b.kind}`,
      desc: `${HEADS[b.head].name} head, ${HANDLES[b.handle].name.toLowerCase()} handle, ${BINDINGS[b.binding].name.toLowerCase()} binding. ${HANDLES[b.handle].trait}. ${BINDINGS[b.binding].trait}.`,
      tool: { kind: b.kind, tier: s.tier, speed: s.speed, durability: s.durability },
    };
  }),
];

/** The pine handle and the new heads (assembly is BUILD_RECIPES: it lists at the workbench but is not part of the recipe tree). */
export const TOOL_PART_RECIPES: RecipeSpec[] = [
  { id: 'pine_handle', station: 'hand', inputs: amounts('1 pine_log'), output: amount('2 pine_handle'), age: 0 },
  ...HEAD_ITEM_MATERIALS.filter((m) => m !== 'bronze').flatMap((m) =>
    MODULAR_KINDS.map((kind): RecipeSpec => {
      const inputs = amounts(`${HEAD_UNITS[m][kind]} ${m === 'flint' ? 'flint' : `${m}_ingot`}`);
      const out = amount(headItemKey(m, kind));
      if (m === 'flint') return { id: out.item, station: 'hand', inputs, output: out, age: 0 };
      return { id: out.item, station: 'furnace', kind: 'forge', inputs, output: out, minTempC: m === 'iron' ? 1000 : 1300, minTier: 3, age: 2 };
    }),
  ),
];

/**
 * One assembly per build: head, handle and binding in, the tool out (the default build too: a second route to the legacy
 * tool). They list at the workbench screen (src/game/crafting.ts BUILD_RECIPES) beside the recipes but stay out of the
 * recipe tree, so the sixty-odd combinations do not drown the furnace list or the progression solver.
 */
export const BUILD_RECIPE_SPECS: RecipeSpec[] = BUILDS.filter((b) => !(b.head === 'bronze' && isDefaultBuild(b))).map((b): RecipeSpec => { // bronze's default is recipesHand.ts's
  const key = buildItemKey(b);
  return { id: isDefaultBuild(b) ? `assemble_${key}` : key, station: 'workbench', inputs: amounts(partInputs(b)), output: amount(key), age: HEADS[b.head].age };
});

/** True for a built tool that is not a plain legacy one (a pine handle or a resin binding on some head). */
export const isModularVariant = (item: string): boolean => {
  const b = BY_KEY.get(item);
  return b !== undefined && !isDefaultBuild(b);
};
