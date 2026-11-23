/**
 * Items and blocks of Essentia & Research (docs/OVERHAUL_PLAN.md B, docs/api/magic.md). The field notebook scans things;
 * glass vials hold VIAL_UNITS of one aspect (one item per aspect, generated from the aspect list); gathering rods draw
 * essentia from the land into empty vials or into their own charge; jars keep it in the world; tubes carry it to the rune
 * desk, the infusion altar and the furnace; foci spend a rod's charge. Recipes in recipesMagic.ts; which of them research
 * unlocks is in src/magic/entries.ts.
 */
import type { BlockSpec, ItemSpec } from '../core/types';
import { ASPECTS } from '../magic/aspects';
import { ageIndexOf } from '../magic/ageMap';
import { CHARMS } from '../magic/charms';
import { MODS } from '../magic/focusMods';
import { POTIONS } from '../magic/potions';
import { GOLEMS, MARKER_DROP, MARKER_PULL } from '../magic/golems';

/** Units of essentia in one filled vial. */
export const VIAL_UNITS = 4;
/** Units one essentia jar holds (eight vials), and a void jar. */
export const JAR_UNITS = 32;
export const VOID_JAR_UNITS = 128;

export const vialKey = (aspect: string): string => `vial_${aspect}`;

/** Gathering rods: vis each primal pool holds and units each Use draws (src/magic/vis.ts). */
export interface RodTier { key: string; capacity: number; draw: number; /** Primals a cap favours: drawn a half more, cost a quarter less in foci. */ favour?: readonly PrimalKey[] }
export type PrimalKey = 'cinder' | 'loam' | 'brook' | 'gale' | 'rune' | 'rift';
export const RODS: readonly RodTier[] = [
  { key: 'vis_rod', capacity: 16, draw: 1 },
  { key: 'bronze_rod', capacity: 32, draw: 2 },
  { key: 'iron_rod', capacity: 64, draw: 3 },
];

/** Foci: primal vis each cast takes from the rod, and seconds before the next cast. */
export interface FocusSpec { key: string; vis: Partial<Record<'cinder' | 'loam' | 'brook' | 'gale' | 'rune' | 'rift', number>>; cooldownS: number }
export const FOCI: readonly FocusSpec[] = [
  { key: 'focus_kindle', vis: { cinder: 2 }, cooldownS: 1 },
  { key: 'focus_light', vis: { cinder: 1 }, cooldownS: 0.5 },
  { key: 'focus_ward', vis: { loam: 3, rune: 3 }, cooldownS: 20 },
  { key: 'focus_blink', vis: { gale: 2, rift: 2 }, cooldownS: 2 },
];

/** Wands: a core (the plain rod it is made from sets capacity and draw) and a metal cap that favours two primals. */
export const WAND_CORES = [
  { key: 'reed', name: 'Reed', rod: 'vis_rod', capacity: 16, draw: 1, age: 'bronze' },
  { key: 'bronze', name: 'Bronze', rod: 'bronze_rod', capacity: 32, draw: 2, age: 'bronze' },
  { key: 'iron', name: 'Iron', rod: 'iron_rod', capacity: 64, draw: 3, age: 'forge' },
] as const;
export const WAND_CAPS = [
  { key: 'copper', name: 'Copper', ingot: 'copper_ingot', favour: ['cinder', 'loam'], color: 0xc0703a },
  { key: 'tin', name: 'Tin', ingot: 'tin_ingot', favour: ['brook', 'gale'], color: 0xb8c4cc },
  { key: 'bronze', name: 'Bronze', ingot: 'bronze_ingot', favour: ['rune', 'rift'], color: 0xe0a060 },
] as const;
export const wandKey = (core: string, cap: string): string => `wand_${core}_${cap}`;
export const WANDS: readonly (RodTier & { core: string; cap: string })[] = WAND_CORES.flatMap((c) =>
  WAND_CAPS.map((p) => ({ key: wandKey(c.key, p.key), capacity: c.capacity, draw: c.draw, favour: p.favour as readonly PrimalKey[], core: c.key, cap: p.key })));
/** Every item that works as a gathering rod, plain rods first. */
export const ROD_TIERS: readonly RodTier[] = [...RODS, ...WANDS];

const BRONZE = ageIndexOf('bronze');
const FORGE = ageIndexOf('forge');
const tool = (key: string, name: string, age: number, desc: string): ItemSpec => ({ key, name, category: 'tool', age, stack: 1, desc });

export const MAGIC_ITEMS: ItemSpec[] = [
  tool('field_notebook', 'Field Notebook', 0,
    'Aim it at anything and press Use to note its nature: you learn its aspects and gain lore. Use it at the sky to open the notes and the research boards.'),
  { key: 'sanity_soap', name: 'Sanity Soap', category: 'misc', age: BRONZE, stack: 16, desc: 'A rough bar that smells of lye and clear water. Use it to scrub warp from your mind: it lifts three points.' },
  { ...tool('scribing_tools', 'Scribing Tools', 0,
    'A quill and a pot of ink. Every aspect you write onto research notes at a research table spends one stroke of ink; 64 strokes, then make new ones.'), wear: 64 },
  {
    key: 'glass_vial', name: 'Glass Vial', category: 'material', age: 0, stack: 16,
    desc: 'A small stoppered vial. A gathering rod fills it with one aspect of essentia; it also serves as a beaker.',
  },
  tool('vis_rod', 'Gathering Rod', 0,
    'Hold Use to draw essentia from the land: into an empty vial in your pack, or, without one, into the rod (16 charge) for a focus to spend.'),
  tool('bronze_rod', 'Bronze Gathering Rod', BRONZE, 'Draws two units a Use and holds 32 charge for foci. Near a wellspring it draws its aspect twice as fast.'),
  tool('iron_rod', 'Iron Gathering Rod', FORGE, 'Draws three units a Use and holds 64 charge for foci.'),
  tool('focus_kindle', 'Kindling Focus', BRONZE, 'Carry a rod with charge and Use this: a furnace you aim at lights; anywhere else a small fire starts. 2 charge.'),
  tool('focus_light', 'Light Focus', BRONZE, 'Use it at a block: a floating light settles on that face. 1 charge each; break the light to take it back.'),
  tool('focus_ward', 'Warding Focus', FORGE, 'Use it: for 30 seconds every blow you take is halved. 6 charge.'),
  tool('focus_blink', 'Blinking Focus', FORGE, 'Use it: you step up to eight blocks to where you look, if there is room to stand. 4 charge.'),
  tool('vein_lens', 'Scrying Lens', BRONZE, 'Carried in the pack, every new thing you note teaches half again as much lore, and a held notebook shows the nature of what you aim at.'),
  ...ASPECTS.map((a): ItemSpec => ({
    key: vialKey(a.key), name: `Vial of ${a.name}`, category: 'material', age: 0, stack: 8,
    desc: `${VIAL_UNITS} units of ${a.name} essentia (${a.meaning}). Use it on an essentia jar to pour it in.`,
  })),
  ...WANDS.map((w): ItemSpec => {
    const core = WAND_CORES.find((c) => c.key === w.core)!;
    const cap = WAND_CAPS.find((c) => c.key === w.cap)!;
    return tool(w.key, `${core.name} Wand, ${cap.name}-capped`, core.age === 'forge' ? FORGE : BRONZE,
      `${w.capacity} vis a primal, ${w.draw} a Use. ${cap.name} caps: ${cap.favour.join(' and ')} drawn a half more, a quarter cheaper in foci. Plug a focus in at an Arcane Workbench.`);
  }),
];

MAGIC_ITEMS.push(...CHARMS.map((c): ItemSpec => ({ key: c.key, name: c.name, category: 'misc', age: BRONZE, stack: 1, desc: `${c.text} Etched with a rune at an Arcane Workbench.` })));

MAGIC_ITEMS.push(...MODS.map((m): ItemSpec => ({ key: m.key, name: m.name, category: 'misc', age: BRONZE, stack: 16, desc: `${m.text} Use it at a bench or desk with a focus carried.` })));

MAGIC_ITEMS.push(...POTIONS.map((p): ItemSpec => ({ key: p.key, name: p.name, category: 'misc', age: 0, stack: 8, desc: `${p.text} Brewed at a crucible; Use it to drink.` })));

const glassBlock = { opaque: false, translucent: true } as const;

export const MAGIC_BLOCKS: BlockSpec[] = [
  {
    key: 'research_table', name: 'Research Table', category: 'machine', age: 0, hardness: 1, tool: 'axe', minTier: 0,
    textures: { top: 'magic_desk_top', side: 'magic_desk_side', bottom: 'magic_desk_side' },
    desc: 'Use it to work on research notes: write aspects onto the hexagon with scribing tools until every anchor is joined, and combine aspects into compounds.',
  },
  {
    key: 'essentia_jar', name: 'Essentia Jar', category: 'machine', age: 0, hardness: 0.5, tool: 'pickaxe', minTier: 0, ...glassBlock,
    stack: 16, textures: { side: 'magic_jar_side', top: 'magic_jar_top' },
    desc: `Holds up to ${JAR_UNITS} units of one aspect. Use a filled vial on it to pour in; Use an empty vial to fill it back.`,
  },
  {
    key: 'void_jar', name: 'Void Jar', category: 'machine', age: FORGE, hardness: 0.8, tool: 'pickaxe', minTier: 0, ...glassBlock,
    stack: 16, textures: { side: 'magic_void_jar_side', top: 'magic_void_jar_top' },
    desc: `A jar folded inside itself: up to ${VOID_JAR_UNITS} units of one aspect. Vials and tubes use it like any jar.`,
  },
  {
    key: 'essentia_tube', name: 'Essentia Tube', category: 'machine', age: BRONZE, hardness: 0.4, tool: 'pickaxe', minTier: 0, ...glassBlock,
    stack: 64, textures: { all: 'magic_tube' },
    desc: 'A glass tube. Jars, the rune desk, the infusion altar and a furnace joined by tubes share every jar on the line.',
  },
  {
    key: 'rune_desk', name: 'Rune Desk', category: 'machine', age: BRONZE, hardness: 1.2, tool: 'axe', minTier: 0,
    textures: { top: 'magic_desk_top', side: 'magic_desk_side', bottom: 'magic_desk_side' },
    desc: 'Use it to make arcane things. Each pays in essentia from the jars within three blocks (or tubed to it) and the vials you carry.',
  },
  {
    key: 'arcane_workbench', name: 'Arcane Workbench', category: 'machine', age: BRONZE, hardness: 1, tool: 'axe', minTier: 0,
    textures: { top: 'magic_desk_top', side: 'magic_desk_side', bottom: 'magic_desk_side' },
    desc: 'A bench for small arcane work: ordinary things made with a little vis from your rod. Use it to see what it can make.',
  },
  {
    key: 'crucible', name: 'Crucible', category: 'machine', age: 0, hardness: 2, tool: 'pickaxe', minTier: 0,
    textures: { top: 'magic_crucible_top', side: 'magic_crucible_side', bottom: 'magic_crucible_side' },
    desc: 'Pour in water over a burning furnace. Items Used on it melt into essentia, an empty vial bottles it, a catalyst turns into something new.',
  },
  {
    key: 'infusion_altar', name: 'Infusion Altar', category: 'machine', age: BRONZE, hardness: 2, tool: 'pickaxe', minTier: 0,
    textures: { top: 'magic_altar_top', side: 'magic_altar_side', topActive: 'magic_altar_top_on' },
    desc: 'Put the heart item on it, the others on pedestals two blocks away, then Use it with a rod. It draws essentia from nearby or tubed jars.',
  },
  {
    key: 'arcane_pedestal', name: 'Arcane Pedestal', category: 'machine', age: BRONZE, hardness: 1.5, tool: 'pickaxe', minTier: 0,
    textures: { top: 'magic_pedestal_top', side: 'magic_pedestal_side' },
    desc: 'Use it with an item to set the item on it; Use it empty-handed to take it back. An infusion altar reaches pedestals two blocks away.',
  },
  {
    key: 'clay_servant', name: 'Clay Servant', category: 'machine', age: FORGE, hardness: 1, tool: 'pickaxe', minTier: 0, oriented: true,
    textures: { side: 'magic_servant_side', top: 'magic_servant_top', front: 'magic_servant_front', frontActive: 'magic_servant_front_on' },
    desc: 'Fed one Spring from a touching or tubed jar, it walks up to eight blocks and does one task: a crank, a deployer, or a belt item.',
  },
  {
    key: 'magic_light', name: 'Floating Light', category: 'misc', age: BRONZE, hardness: 0, shape: 'torch', solid: false, opaque: false,
    light: 14, item: false, drops: 'none', textures: { all: 'magic_light' },
    desc: 'A small light set by a Light Focus. Break it and it is gone.',
  },
  {
    key: 'linked_mirror', name: 'Linked Mirror', category: 'machine', age: BRONZE, hardness: 0.6, tool: 'pickaxe', minTier: 0, ...glassBlock,
    textures: { all: 'magic_mirror' },
    desc: "Made in pairs; Use one, then the other, to link them. Essentia lines they touch join; the first sends items from its crate into the second's.",
  },
  ...GOLEMS.filter((g) => g.key !== 'clay_servant').map((g): BlockSpec => ({
    key: g.key, name: g.name, category: 'machine', age: FORGE, hardness: 1.5, tool: 'pickaxe', minTier: 0, oriented: true,
    textures: { side: `magic_${g.key}_side`, top: `magic_${g.key}_top`, front: `magic_${g.key}_front`, frontActive: `magic_${g.key}_front_on` },
    desc: `A servant with a ${g.key.split('_')[0]} body: ${g.traitText}. Fed Spring like a clay servant; carries between marked containers.`,
  })),
  {
    key: MARKER_PULL, name: 'Pull Marker', category: 'machine', age: BRONZE, hardness: 0.5, tool: 'axe', minTier: 0,
    textures: { all: 'magic_marker_pull' },
    desc: 'Set it against a crate, vault or depot: a golem that carries takes items out of that container.',
  },
  {
    key: MARKER_DROP, name: 'Drop Marker', category: 'machine', age: BRONZE, hardness: 0.5, tool: 'axe', minTier: 0,
    textures: { all: 'magic_marker_drop' },
    desc: 'Set it against a crate, vault or depot: a hauling golem delivers what it carries into that container.',
  },
];
