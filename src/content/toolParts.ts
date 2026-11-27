/**
 * Modular tools (docs/plans/modular-tools.md). A pickaxe, axe, shovel, hoe or maul is a HEAD of a
 * material, a HANDLE and a BINDING. Materials are data below; every combination is a real item, generated here, so saves,
 * stacks, wear, enchants and mining all work on it with no per-stack bookkeeping.
 *
 * The default build (any head, oak handle = two sticks, cord) is the old tool of that material, number for number: the
 * legacy keys (`flint_pickaxe`...) stay valid items and recipes and read as that build (`partsOfItem`). Stats:
 *   speed = head.speed * handle.speed          durability = round(head.durability * handle.durability * binding.hold)
 * (hoes and mauls never mine faster: speed 1; a maul's damage is its head's.) A resin binding sometimes spares a use of wear.
 * Pure data and pure functions; imports no registry (the registry imports this).
 */
import type { ItemSpec, RecipeSpec, ToolKind } from '../core/types';
import { amount, amounts } from './amounts';

export type PartRole = 'head' | 'handle' | 'binding';
export type ModularKind = Extract<ToolKind, 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'maul' | 'sword' | 'spear'>;
export const MODULAR_KINDS: readonly ModularKind[] = ['pickaxe', 'axe', 'shovel', 'hoe', 'maul', 'sword', 'spear'];
/** Kinds that are weapons: they carry `weapon` damage and never mine (mauls came first; swords and spears follow). */
export const WEAPON_KINDS: readonly ModularKind[] = ['maul', 'sword', 'spear'];
export const isWeaponKind = (k: ModularKind): boolean => WEAPON_KINDS.includes(k);
/** Kinds whose bronze head already exists from the Ember handwork (casting moulds); the rest get every head from here. */
const HAND_CAST_KINDS: readonly ModularKind[] = ['pickaxe', 'axe', 'shovel', 'hoe', 'maul'];
/** Kinds that mine faster with a better head (the rest keep speed 1). */
export const MINING_KINDS: readonly ModularKind[] = ['pickaxe', 'axe', 'shovel'];

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
  /** One line for the tooltip (the numbers are shown beside it). */
  trait: string;
  /** Weapon damage a blow of this head deals (a maul's; swords and spears take a share, `DAMAGE_SHARE`). */
  damage?: number;
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
  wooden: { key: 'wooden', name: 'Wooden', tier: 1, speed: 1.4, durability: 12, age: 0, repair: 'plank', trait: 'Splinters: breaks after a dozen swings' },
  flint: { key: 'flint', name: 'Flint', tier: 1, speed: 2, durability: 64, age: 0, repair: 'flint', trait: 'Brittle Flint: quick and cheap, wears sooner', damage: 4 },
  bronze: { key: 'bronze', name: 'Bronze', tier: 2, speed: 3, durability: 192, age: 0, repair: 'bronze_ingot', trait: 'Bronze Temper: tough and steady', damage: 5 },
  iron: { key: 'iron', name: 'Iron', tier: 3, speed: 4.5, durability: 384, age: 2, repair: 'iron_ingot', trait: 'Iron Weight: heavy and strong', damage: 7 },
  steel: { key: 'steel', name: 'Steel', tier: 4, speed: 6, durability: 768, age: 2, repair: 'steel_ingot', trait: 'Steel Edge: the keenest and longest-lived', damage: 9 },
};
export const HANDLES: Readonly<Record<string, HandleMaterial>> = {
  oak: { key: 'oak', name: 'Oak', inputs: '2 stick', speed: 1, durability: 1, trait: 'Oak Grip: the standard handle' },
  pine: { key: 'pine', name: 'Pine', inputs: '1 pine_handle', speed: 1.1, durability: 0.85, trait: 'Pine Light: swings faster, wears sooner' },
};
export const BINDINGS: Readonly<Record<string, BindingMaterial>> = {
  cord: { key: 'cord', name: 'Cord', item: 'cord', hold: 1, trait: 'Cord: plain' },
  resin: { key: 'resin', name: 'Resin', item: 'pine_resin', hold: 1.2, trait: 'Resin: holds longer' },
};

/** Heads each kind comes in as items (bronze heads already exist from the Ember handwork; wooden tools stay stopgaps). */
export const KIND_HEADS: Readonly<Record<ModularKind, readonly string[]>> = {
  pickaxe: ['flint', 'bronze', 'iron', 'steel'],
  axe: ['flint', 'bronze', 'iron', 'steel'],
  shovel: ['flint', 'bronze', 'iron', 'steel'],
  hoe: ['flint', 'bronze', 'iron'],
  maul: ['bronze', 'iron', 'steel'],
  sword: ['bronze', 'iron', 'steel'],
  spear: ['flint', 'bronze', 'iron', 'steel'],
};
/** Share of the head's damage a blow of this kind deals (a maul takes it all; sword and spear trade weight for speed, see `WEAPON_COOLDOWN_S`). */
export const DAMAGE_SHARE: Readonly<Partial<Record<ModularKind, number>>> = { maul: 1, sword: 0.8, spear: 0.75 };
/** Seconds between two blows of a weapon kind: the sword is the quick one, the maul the slow heavy one. Absent = the shared weapon cooldown. */
export const WEAPON_COOLDOWN_S: Readonly<Partial<Record<ModularKind, number>>> = { sword: 0.4, spear: 0.45 };
export const DEFAULT_HANDLE = 'oak';
export const DEFAULT_BINDING = 'cord';

export interface ToolBuild {
  kind: ModularKind;
  head: string;
  handle: string;
  binding: string;
}

export const KIND_LABEL: Record<ModularKind, string> = { pickaxe: 'Pickaxe', axe: 'Axe', shovel: 'Shovel', hoe: 'Hoe', maul: 'Maul', sword: 'Sword', spear: 'Spear' };
/** Units of head material one head costs (as the old tools: pickaxe and axe three, shovel one; flint two and one). */
const HEAD_UNITS: Record<string, Partial<Record<ModularKind, number>>> = {
  flint: { pickaxe: 2, axe: 2, shovel: 1, hoe: 1, spear: 2 },
  bronze: { sword: 3, spear: 2 },
  iron: { pickaxe: 3, axe: 3, shovel: 1, hoe: 2, maul: 4, sword: 3, spear: 2 },
  steel: { pickaxe: 3, axe: 3, shovel: 1, maul: 4, sword: 3, spear: 2 },
};

export const isDefaultBuild = (b: Pick<ToolBuild, 'handle' | 'binding'>): boolean => b.handle === DEFAULT_HANDLE && b.binding === DEFAULT_BINDING;
export const headItemKey = (head: string, kind: ModularKind): string => `${head}_${kind}_head`;
/** Item key of a build: the plain legacy tool for the default build, else `<head>_<handle>_<binding>_<kind>`. */
export const buildItemKey = (b: ToolBuild): string => (isDefaultBuild(b) ? `${b.head}_${b.kind}` : `${b.head}_${b.handle}_${b.binding}_${b.kind}`);

/** The numbers a build comes to (the formulas in the file header). */
export function buildStats(b: ToolBuild): { tier: number; speed: number; durability: number; damage?: number } {
  const head = HEADS[b.head], handle = HANDLES[b.handle], binding = BINDINGS[b.binding];
  const mines = MINING_KINDS.includes(b.kind);
  const out: { tier: number; speed: number; durability: number; damage?: number } = {
    tier: head.tier,
    speed: mines ? Math.round(head.speed * handle.speed * 100) / 100 : 1,
    durability: Math.round(head.durability * handle.durability * binding.hold),
  };
  if (isWeaponKind(b.kind) && head.damage !== undefined) out.damage = Math.round(head.damage * (DAMAGE_SHARE[b.kind] ?? 1));
  return out;
}

/** Each part's trait line, head first (shown in the tooltip and the builder). */
export const buildTraits = (b: ToolBuild): string[] => [HEADS[b.head].trait, HANDLES[b.handle].trait, BINDINGS[b.binding].trait];

/** Chance a use of a resin-bound tool costs no wear. */
export const RESIN_SPARE_CHANCE = 0.15;
/** True when this use of `item` is spared its wear (`roll` is a uniform [0,1) draw). */
export function sparesWear(item: string, roll: number): boolean {
  const b = partsOfItem(item);
  return b !== null && b.binding === 'resin' && roll < RESIN_SPARE_CHANCE;
}

export function buildName(b: ToolBuild): string {
  const base = `${HEADS[b.head].name} ${KIND_LABEL[b.kind]}`;
  return isDefaultBuild(b) ? base : `${base} (${HANDLES[b.handle].name}, ${BINDINGS[b.binding].name})`;
}

/** Heads that can be built into tools: those with a legacy tool of this kind (wooden too, as a virtual build only). */
const buildable = (head: string, kind: ModularKind): boolean => KIND_HEADS[kind].includes(head) || (head === 'wooden' && !isWeaponKind(kind));

export const BUILDS: ToolBuild[] = [];
for (const kind of MODULAR_KINDS)
  for (const head of KIND_HEADS[kind])
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
    if (buildable(head, kind)) return { kind, head, handle: DEFAULT_HANDLE, binding: DEFAULT_BINDING };
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
  return key === item || BY_KEY.has(key) || (isDefaultBuild(next) && buildable(next.head, next.kind)) ? key : null;
}

/** What comes back when a part is taken off a tool: the item (a handle is its parts, a head its cast head). */
export function partReturn(b: ToolBuild, role: PartRole): string {
  if (role === 'head') return headItemKey(b.head, b.kind);
  if (role === 'binding') return BINDINGS[b.binding].item;
  return b.handle === DEFAULT_HANDLE ? 'stick' : `${b.handle}_handle`;
}

// ---- content ------------------------------------------------------------------------------------

/** Seconds between blows of a build: its kind's base over the handle's swing speed (pine swings faster). Undefined = the shared weapon cooldown. */
export function weaponCooldown(b: ToolBuild): number | undefined {
  const base = WEAPON_COOLDOWN_S[b.kind];
  const speed = HANDLES[b.handle].speed;
  if (base === undefined) return undefined; // mauls keep the shared cooldown (their items predate this)
  return Math.round((base / speed) * 100) / 100;
}

/** Heads of this kind made here (the hand-cast bronze ones of the older kinds excluded). */
/** Age a head item first appears (its metal's; bronze is within reach of the first furnace). */
const headAge = (m: string, kind: ModularKind): number => HEADS[m].age;
/** Age of a build: its head's. */
const buildAge = (b: ToolBuild): number => headAge(b.head, b.kind);

function castHeads(kind: ModularKind): string[] {
  return KIND_HEADS[kind].filter((m) => m !== 'bronze' || !HAND_CAST_KINDS.includes(kind));
}

export const TOOL_PART_ITEMS: ItemSpec[] = [
  {
    key: 'pine_handle', name: 'Pine Handle', category: 'component', age: 0, icon: 'item_stick',
    desc: 'A light, straight pine haft. Fitted to a head it swings a tenth faster than oak and wears a little sooner.',
  },
  // Heads not already cast from bronze (itemsHand.ts makes the bronze ones).
  ...MODULAR_KINDS.flatMap((kind) =>
    castHeads(kind).map((m): ItemSpec => ({
      key: headItemKey(m, kind), name: `${HEADS[m].name} ${KIND_LABEL[kind]} Head`, category: 'component', age: headAge(m, kind),
      desc: `A ${HEADS[m].name.toLowerCase()} ${kind} head. Bind it to a handle at the workbench; the handle and binding you pick change how it works.`,
    })),
  ),
  ...BUILDS.filter((b) => !isDefaultBuild(b) || !HAND_CAST_KINDS.includes(b.kind)).map((b): ItemSpec => {
    const s = buildStats(b);
    const spec: ItemSpec = {
      key: buildItemKey(b), name: buildName(b), category: 'tool', age: buildAge(b),
      desc: `${HEADS[b.head].name} head, ${HANDLES[b.handle].name.toLowerCase()} handle, ${BINDINGS[b.binding].name.toLowerCase()} binding. ${buildTraits(b).join('. ')}.`,
      tool: { kind: b.kind, tier: s.tier, speed: s.speed, durability: s.durability },
    };
    // Pickaxes, axes, shovels and hoes paint their own composed icon (render/textures/iconsTools.ts); a maul borrows its metal's.
    if (b.kind === 'maul') spec.icon = `item_${b.head}_maul`;
    if (isWeaponKind(b.kind)) {
      const cd = weaponCooldown(b);
      spec.weapon = { damage: s.damage!, ...(cd !== undefined ? { cooldownS: cd } : {}) };
    }
    return spec;
  }),
];

/** New head items, each with an icon of its own (the bronze heads were cast before this). */
export const TOOL_HEAD_ICON_COUNT = MODULAR_KINDS.reduce((n, k) => n + castHeads(k).length, 0);

/** Builds that paint a composed icon of their own (everything but mauls). */
export const COMPOSED_ICON_BUILDS: ToolBuild[] = BUILDS.filter((b) => b.kind !== 'maul' && (!isDefaultBuild(b) || !HAND_CAST_KINDS.includes(b.kind)));

/** The pine handle and the new heads (assembly is BUILD_RECIPES: it lists at the workbench but is not part of the recipe tree). */
export const TOOL_PART_RECIPES: RecipeSpec[] = [
  { id: 'pine_handle', station: 'hand', inputs: amounts('1 pine_log'), output: amount('2 pine_handle'), age: 0 },
  ...MODULAR_KINDS.flatMap((kind) =>
    castHeads(kind).map((m): RecipeSpec => {
      const inputs = amounts(`${HEAD_UNITS[m][kind]} ${m === 'flint' ? 'flint' : `${m}_ingot`}`);
      const out = amount(headItemKey(m, kind));
      if (m === 'flint') return { id: out.item, station: 'hand', inputs, output: out, age: 0 };
      if (m === 'bronze') return { id: out.item, station: 'furnace', kind: 'forge', inputs, output: out, minTempC: 800, minTier: 1, age: 0 };
      return { id: out.item, station: 'furnace', kind: 'forge', inputs, output: out, minTempC: m === 'iron' ? (kind === 'maul' ? 1100 : 1000) : kind === 'maul' ? 1400 : 1300, minTier: 3, age: 2 };
    }),
  ),
];

/**
 * One assembly per build: head, handle and binding in, the tool out (the default build too: a second route to the legacy
 * tool). They list at the workbench screen (src/game/crafting.ts BUILD_RECIPES) beside the recipes but stay out of the
 * recipe tree, so the sixty-odd combinations do not drown the furnace list or the progression solver.
 */
export const BUILD_RECIPE_SPECS: RecipeSpec[] = BUILDS.filter((b) => !(b.head === 'bronze' && isDefaultBuild(b) && HAND_CAST_KINDS.includes(b.kind))).map((b): RecipeSpec => { // bronze's default is recipesHand.ts's
  const key = buildItemKey(b);
  return { id: isDefaultBuild(b) ? `assemble_${key}` : key, station: 'workbench', inputs: amounts(partInputs(b)), output: amount(key), age: buildAge(b) };
});

/** True for a built tool that is not a plain legacy one (a pine handle or a resin binding on some head). */
export const isModularVariant = (item: string): boolean => {
  const b = BY_KEY.get(item);
  return b !== undefined && !isDefaultBuild(b);
};
