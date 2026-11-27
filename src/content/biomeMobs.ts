/**
 * Biome life (docs/SYNERGY_PLAN.md section 3): one wild animal and one feral servant for each biome. The animals are plain
 * passive game like the hen and the goat (src/content/creatures.ts rules). The servants are what is left of the helpers the
 * old artificers made out of the land itself: wood in the woodland, glass in the dunes, ice in the frostfell, basalt in the
 * scar, clay and marsh-light in the marsh. They are Emberbound-class hostiles (AUTOMATON_SPECS) that walk only their own
 * biome at night, and they drop what they are made of. Units as in creatures.ts: 1/16 block, authored facing -Z.
 */
import type { CreatureAnim, CreaturePart, CreatureSpec } from '../core/types';

type V3 = readonly [number, number, number];

const box = (name: string, from: V3, to: V3, color: number): CreaturePart => ({ name, from, to, color, anim: 'none' });
const glow = (name: string, from: V3, to: V3, color: number): CreaturePart => ({ name, from, to, color, anim: 'none', emissive: true });
function group(anim: CreatureAnim, pivot: V3) {
  return (name: string, from: V3, to: V3, color: number, hot = false): CreaturePart =>
    ({ name, from, to, color, anim, pivot, ...(hot ? { emissive: true } : {}) });
}
/** A leg swinging about its top centre. */
function leg(anim: 'legFL' | 'legFR' | 'legBL' | 'legBR', from: V3, to: V3, color: number): CreaturePart {
  return { name: anim, from, to, color, anim, pivot: [(from[0] + to[0]) / 2, to[1], (from[2] + to[2]) / 2] };
}
function fourLegs(x: number, front: number, back: number, w: number, l: number, h: number, color: number): CreaturePart[] {
  const at = (anim: 'legFL' | 'legFR' | 'legBL' | 'legBR', cx: number, cz: number): CreaturePart =>
    leg(anim, [cx - w / 2, 0, cz - l / 2], [cx + w / 2, h, cz + l / 2], color);
  return [at('legFL', -x, front), at('legFR', x, front), at('legBL', -x, back), at('legBR', x, back)];
}

// ---- wild animals --------------------------------------------------------------------------------------------------
const STAG_HEAD = group('head', [0, 15, -6]);
const STAG: CreaturePart[] = [
  box('body', [-4, 9, -7], [4, 16, 6], 0x8a5a38),
  box('belly', [-3.5, 8.5, -5], [3.5, 10, 5], 0xc9a27a),
  box('tail', [-1, 14, 6], [1, 17, 7.5], 0xe8dcc8),
  STAG_HEAD('neck', [-1.75, 14, -8], [1.75, 20, -5], 0x80522f),
  STAG_HEAD('head', [-2.5, 17, -11], [2.5, 21, -7], 0x8a5a38),
  STAG_HEAD('muzzle', [-1.5, 17, -13], [1.5, 19.5, -11], 0xc9a27a),
  STAG_HEAD('nose', [-1, 18.25, -13.25], [1, 19.25, -13], 0x2a1e18),
  STAG_HEAD('eyeL', [-2.7, 19, -10], [-2.5, 20, -9], 0x140e0a),
  STAG_HEAD('eyeR', [2.5, 19, -10], [2.7, 20, -9], 0x140e0a),
  STAG_HEAD('antlerL', [-2.75, 21, -9], [-1.75, 26, -8], 0xd8c9a8),
  STAG_HEAD('antlerR', [1.75, 21, -9], [2.75, 26, -8], 0xd8c9a8),
  STAG_HEAD('tineL', [-4, 24, -9], [-2.75, 25, -8], 0xd8c9a8),
  STAG_HEAD('tineR', [2.75, 24, -9], [4, 25, -8], 0xd8c9a8),
  ...fourLegs(2.5, -5, 4.5, 2, 2, 9, 0x6e4529),
];

const HARE_HEAD = group('head', [0, 8, -3]);
const DUNE_HARE: CreaturePart[] = [
  box('body', [-2.5, 4, -3.5], [2.5, 9, 3], 0xcaa66c),
  box('belly', [-2, 3.5, -2.5], [2, 5, 2.5], 0xe6d3a8),
  box('tail', [-1, 7, 3], [1, 9, 5], 0xf0e6cc),
  HARE_HEAD('head', [-2, 7, -6], [2, 11, -3], 0xcaa66c),
  HARE_HEAD('nose', [-0.75, 8, -6.5], [0.75, 9, -6], 0x8a5a4a),
  HARE_HEAD('eyeL', [-2.2, 9, -5.5], [-2, 10, -4.5], 0x1b1410),
  HARE_HEAD('eyeR', [2, 9, -5.5], [2.2, 10, -4.5], 0x1b1410),
  HARE_HEAD('earL', [-1.75, 11, -4.5], [-0.5, 16, -3.5], 0xb88f55),
  HARE_HEAD('earR', [0.5, 11, -4.5], [1.75, 16, -3.5], 0xb88f55),
  ...fourLegs(2, -2.5, 2.5, 1.5, 2, 4, 0xb88f55),
];

const OX_HEAD = group('head', [0, 15, -9]);
const SNOW_OX: CreaturePart[] = [
  box('body', [-6, 8, -9], [6, 18, 9], 0xe8e4da),
  box('skirt', [-6.5, 5, -8], [6.5, 9, 8], 0xd6d0c2),
  box('hump', [-3.5, 18, -6], [3.5, 20, 2], 0xd6d0c2),
  box('tail', [-1, 11, 9], [1, 16, 10], 0xbfb8a8),
  OX_HEAD('head', [-3.5, 10, -15], [3.5, 17, -9], 0xd6d0c2),
  OX_HEAD('muzzle', [-2.5, 10, -16.5], [2.5, 13.5, -15], 0x4a3f38),
  OX_HEAD('eyeL', [-3.7, 14, -13], [-3.5, 15.25, -12], 0x140e0a),
  OX_HEAD('eyeR', [3.5, 14, -13], [3.7, 15.25, -12], 0x140e0a),
  OX_HEAD('hornL', [-6, 16, -12.5], [-3.5, 17.5, -11.5], 0xeee4cc),
  OX_HEAD('hornTipL', [-6.5, 17.5, -12.5], [-5.5, 20, -11.5], 0xeee4cc),
  OX_HEAD('hornR', [3.5, 16, -12.5], [6, 17.5, -11.5], 0xeee4cc),
  OX_HEAD('hornTipR', [5.5, 17.5, -12.5], [6.5, 20, -11.5], 0xeee4cc),
  ...fourLegs(4, -6.5, 6.5, 3, 3, 8, 0xbfb8a8),
];

const NEWT_HEAD = group('head', [0, 3, -7]);
const SLAG_NEWT: CreaturePart[] = [
  box('body', [-3, 1.5, -7], [3, 4, 6], 0x3a3330),
  glow('stripe', [-1, 4, -5], [1, 5, 4], 0xd9531e),
  box('tail', [-1.5, 1.5, 6], [1.5, 3.5, 9], 0x2e2826),
  NEWT_HEAD('head', [-2.5, 1.5, -11], [2.5, 4.5, -7], 0x4a403a),
  NEWT_HEAD('eyeL', [-2.7, 3.5, -10], [-2.5, 4.5, -9], 0xffb04a),
  NEWT_HEAD('eyeR', [2.5, 3.5, -10], [2.7, 4.5, -9], 0xffb04a),
  ...fourLegs(3.5, -4.5, 4.5, 1.5, 2, 2, 0x2e2826),
];

const HERON_HEAD = group('head', [0, 18, -2.5]);
const MARSH_HERON: CreaturePart[] = [
  box('body', [-2.5, 12, -3], [2.5, 18, 4], 0x8da3ad),
  box('wingL', [-3.25, 13, -2], [-2.5, 17.5, 3], 0x6f8791),
  box('wingR', [2.5, 13, -2], [3.25, 17.5, 3], 0x6f8791),
  box('tail', [-1.5, 14, 4], [1.5, 16, 7], 0x5a717b),
  HERON_HEAD('neck', [-0.75, 18, -3.25], [0.75, 26, -1.75], 0xdfe6e8),
  HERON_HEAD('head', [-1.5, 26, -5], [1.5, 28.5, -1], 0xdfe6e8),
  HERON_HEAD('crest', [-0.5, 28.5, -3], [0.5, 29.5, 1], 0x2a3238),
  HERON_HEAD('beak', [-0.5, 26.5, -9], [0.5, 27.75, -5], 0xe3b23a),
  HERON_HEAD('eyeL', [-1.7, 27, -4.5], [-1.5, 28, -3.5], 0x140e0a),
  HERON_HEAD('eyeR', [1.5, 27, -4.5], [1.7, 28, -3.5], 0x140e0a),
  leg('legFL', [-1.5, 0, -0.5], [-0.5, 12, 0.5], 0xc9a64a),
  leg('legFR', [0.5, 0, -0.5], [1.5, 12, 0.5], 0xc9a64a),
];

export const BIOME_ANIMALS: CreatureSpec[] = [
  {
    key: 'stag', name: 'Stag', desc: 'A russet stag of the woodland glades. It bolts at a footstep, but a sheaf of wheat will bring it close.',
    biomes: ['woodland'], health: 9, speed: 3, size: { w: 0.8, h: 1.5 },
    drops: [{ item: 'raw_chop', count: [1, 3] }, { item: 'hide', count: [1, 2] }], likes: ['wheat'], group: [2, 3], model: STAG,
  },
  {
    key: 'dune_hare', name: 'Dune Hare', desc: 'A sand-coloured hare with ears like sails. It lives off dry shrub and the seeds travellers drop.',
    biomes: ['dunes'], health: 3, speed: 3.4, size: { w: 0.4, h: 1 },
    drops: [{ item: 'raw_fowl', count: 1 }, { item: 'hide', count: 1, chance: 0.4 }], likes: ['wheat_seeds'], group: [2, 4], model: DUNE_HARE,
  },
  {
    key: 'snow_ox', name: 'Snow Ox', desc: 'A shaggy white ox of the frostfell. Slow and warm-blooded, it follows anyone carrying wheat.',
    biomes: ['frostfell'], health: 14, speed: 2.1, size: { w: 1.1, h: 1.25 },
    drops: [{ item: 'raw_mutton', count: [2, 3] }, { item: 'hide', count: [1, 2] }], likes: ['wheat'], group: [2, 3], model: SNOW_OX,
  },
  {
    key: 'slag_newt', name: 'Slag Newt', desc: 'A low black newt with an ember stripe, warming itself on basalt in the scar. It will take a lump of coal from your hand.',
    biomes: ['scar'], health: 4, speed: 2.4, size: { w: 0.55, h: 0.35 },
    drops: [{ item: 'raw_fowl', count: 1 }, { item: 'coal', count: [1, 2], chance: 0.6 }], likes: ['coal'], group: [2, 3], model: SLAG_NEWT,
  },
  {
    key: 'marsh_heron', name: 'Marsh Heron', desc: 'A tall grey heron stalking the shallows. Wildberries on the bank draw it near.',
    biomes: ['marsh'], health: 5, speed: 2.3, size: { w: 0.5, h: 1.7 },
    drops: [{ item: 'raw_fowl', count: [1, 2] }, { item: 'fiber', count: 1, chance: 0.5 }], likes: ['wildberries'], group: [2, 3], model: MARSH_HERON,
  },
];

// ---- feral servants ------------------------------------------------------------------------------------------------
interface ServantLook {
  limb: number;
  torso: number;
  plate: number;
  head: number;
  crown: number;
  eye: number;
  /** Total height in sixteenths, set by the legs and torso below (about 31). */
  shield?: number;
}

/** An upright servant: two legs, a torso, a head with an eye-glow and a crown, two long arms (one may carry a slab). */
function servant(l: ServantLook): CreaturePart[] {
  const head = group('head', [0, 23, 0]);
  const armL = group('armL', [-7, 22, 0]);
  const armR = group('armR', [7, 22, 0]);
  const legPart = (anim: 'legFL' | 'legFR', x0: number, x1: number): CreaturePart =>
    leg(anim, [x0, 0, -2], [x1, 11, 2], l.limb);
  const parts: CreaturePart[] = [
    legPart('legFL', -4.5, -1), legPart('legFR', 1, 4.5),
    box('hips', [-5, 11, -3], [5, 13, 3], l.plate),
    box('torso', [-5.5, 13, -3.5], [5.5, 23, 3.5], l.torso),
    box('chest', [-4.5, 15, -4], [4.5, 21, -3.5], l.plate),
    glow('heart', [-1.25, 17, -4.25], [1.25, 19.5, -4], l.eye),
    head('head', [-3, 23, -3], [3, 29, 3], l.head),
    head('crown', [-3.5, 29, -3.5], [3.5, 31, 3.5], l.crown),
    head('eyeL', [-2.25, 26, -3.25], [-0.75, 27.25, -3], l.eye, true),
    head('eyeR', [0.75, 26, -3.25], [2.25, 27.25, -3], l.eye, true),
    armL('armL', [-8.5, 10, -1.5], [-5.5, 22, 1.5], l.limb),
    armL('fistL', [-9, 8, -2], [-5, 10, 2], l.plate),
    armR('armR', [5.5, 10, -1.5], [8.5, 22, 1.5], l.limb),
    armR('fistR', [5, 8, -2], [9, 10, 2], l.plate),
  ];
  if (l.shield !== undefined) {
    parts.push(armL('slab', [-9.5, 8, -6], [-5, 23, -4.5], l.shield), armL('slabRim', [-9.75, 8, -6.25], [-4.75, 9.25, -5.75], l.plate));
  }
  return parts;
}

const BARKWRIGHT = servant({ limb: 0x5b4630, torso: 0x6e5538, plate: 0x4a3a28, head: 0x7a5f3f, crown: 0x4f8a3a, eye: 0xb6ee6a });
const RIME_HUSK = servant({ limb: 0x8fb6c8, torso: 0xb9d6e4, plate: 0x6f98ad, head: 0xd6ecf5, crown: 0xeaf6fb, eye: 0x9fe6ff, shield: 0xa8cfe0 });

const SCARAB_HEAD = group('head', [0, 5, -6]);
const GLASS_SCARAB: CreaturePart[] = [
  box('shell', [-4, 3, -6], [4, 7, 5], 0xd9c27a),
  box('shellRim', [-4.25, 3, -5], [4.25, 4, 4], 0xb89a4a),
  box('wingL', [-3.5, 7, -3], [-0.25, 8.5, 4], 0x9fe2dc),
  box('wingR', [0.25, 7, -3], [3.5, 8.5, 4], 0x9fe2dc),
  glow('core', [-1.5, 4.5, -1], [1.5, 6.5, 2], 0xffd35a),
  SCARAB_HEAD('head', [-2.5, 3, -9], [2.5, 6, -6], 0xb89a4a),
  SCARAB_HEAD('mandibleL', [-2, 2, -10.5], [-0.75, 3.5, -9], 0x8a6f3a),
  SCARAB_HEAD('mandibleR', [0.75, 2, -10.5], [2, 3.5, -9], 0x8a6f3a),
  SCARAB_HEAD('eyeL', [-2.25, 4.5, -9.25], [-1.25, 5.5, -9], 0xffd35a, true),
  SCARAB_HEAD('eyeR', [1.25, 4.5, -9.25], [2.25, 5.5, -9], 0xffd35a, true),
  ...fourLegs(4.5, -3.5, 3, 1, 1.5, 3, 0x8a6f3a),
];

const CRAWLER_HEAD = group('head', [0, 4, -8]);
const MAGMA_CRAWLER: CreaturePart[] = [
  box('body', [-4, 2, -8], [4, 6, 6], 0x2b2523),
  glow('back', [-2.5, 6, -6], [2.5, 7, 4], 0xff5a12),
  box('plateL', [-4.25, 4, -5], [-3.5, 6.5, 3], 0x1c1815),
  box('plateR', [3.5, 4, -5], [4.25, 6.5, 3], 0x1c1815),
  box('tail', [-1.5, 3, 6], [1.5, 5, 12], 0x2b2523),
  glow('tailTip', [-1, 3.5, 12], [1, 4.5, 13], 0xffb04a),
  CRAWLER_HEAD('head', [-3, 2, -12], [3, 6, -8], 0x3b322c),
  CRAWLER_HEAD('maw', [-2, 2.5, -12.25], [2, 4, -12], 0xff7a1e, true),
  CRAWLER_HEAD('eyeL', [-2.75, 5, -11], [-1.75, 6, -10.5], 0xffb04a, true),
  CRAWLER_HEAD('eyeR', [1.75, 5, -11], [2.75, 6, -10.5], 0xffb04a, true),
  ...fourLegs(4.5, -5, 4, 2, 2, 2, 0x1c1815),
];

const LANTERN_HEAD = group('head', [0, 6, 0]);
const BOG_LANTERN: CreaturePart[] = [
  box('foot', [-1.5, 0, -1.5], [1.5, 2, 1.5], 0x4f6a3a),
  box('frame', [-3.25, 2, -3.25], [3.25, 3, 3.25], 0x6b5a3a),
  LANTERN_HEAD('cage', [-3, 3, -3], [3, 10, 3], 0x6b5a3a),
  LANTERN_HEAD('flame', [-2, 4, -2], [2, 9, 2], 0xbaff7a, true),
  LANTERN_HEAD('cap', [-3.5, 10, -3.5], [3.5, 11.5, 3.5], 0x4a3e28),
  LANTERN_HEAD('hook', [-0.5, 11.5, -0.5], [0.5, 14, 0.5], 0x4a3e28),
  box('reedL', [-4.5, 1, -0.5], [-3.25, 6, 0.5], 0x4f6a3a),
  box('reedR', [3.25, 1, -0.5], [4.5, 6, 0.5], 0x4f6a3a),
];

export const BIOME_SERVANTS: CreatureSpec[] = [
  {
    key: 'barkwright', name: 'Barkwright',
    desc: 'A servant of oak and moss, made by the old artificers to haul timber and left to run wild. It walks the woodland at night and drops the planks it was built from.',
    biomes: ['woodland'], health: 14, speed: 2.2, size: { w: 1.1, h: 1.95 },
    drops: [{ item: 'plank', count: [2, 4] }, { item: 'cord', count: 1, chance: 0.4 }, { item: 'ember_core', count: 1, chance: 0.1 }], likes: [], group: [1, 1], model: BARKWRIGHT,
    hostile: { attack: 'melee', damage: 3, windupS: 0.6, cooldownS: 1.8, range: 2, senseRange: 14, knockback: 4, habitat: { places: { wood_night: 3 } } },
  },
  {
    key: 'glass_scarab', name: 'Glass Scarab',
    desc: 'A beetle of fused sand and amber glass, blown by an artificer and set loose in the dunes. It crouches, glints, then charges: step aside.',
    biomes: ['dunes'], health: 8, speed: 3.4, size: { w: 0.8, h: 0.55 },
    drops: [{ item: 'silica', count: [1, 3] }, { item: 'glass_vial', count: 1, chance: 0.2 }, { item: 'scrap_metal', count: 1, chance: 0.2 }], likes: [], group: [1, 2], model: GLASS_SCARAB,
    hostile: { attack: 'dash', damage: 3, windupS: 0.7, cooldownS: 3, range: 7, senseRange: 14, knockback: 6, dashSpeed: 10, habitat: { places: { dunes_night: 3 } } },
  },
  {
    key: 'rime_husk', name: 'Rime Husk',
    desc: 'A servant of ice and packed snow, still holding the slab it was set to guard the cold roads with. Strike it from the side: the slab turns blows from the front.',
    biomes: ['frostfell'], health: 16, speed: 2, size: { w: 1.2, h: 1.95 },
    drops: [{ item: 'ice', count: [2, 4] }, { item: 'hide', count: 1, chance: 0.3 }, { item: 'vial_frost', count: 1, chance: 0.1 }], likes: [], group: [1, 1], model: RIME_HUSK,
    hostile: { attack: 'melee', damage: 3, windupS: 0.6, cooldownS: 2, range: 2, senseRange: 14, shieldFront: 0.6, knockback: 4, habitat: { places: { frost_night: 3 } } },
  },
  {
    key: 'magma_crawler', name: 'Magma Crawler',
    desc: 'A basalt lizard with a river of lava down its back, shaped to crawl the scar and spit embers at intruders. Its mouth brightens before it fires.',
    biomes: ['scar'], health: 10, speed: 1.8, size: { w: 0.8, h: 0.5 },
    drops: [{ item: 'coal', count: [1, 3] }, { item: 'sulfur', count: 1, chance: 0.4 }, { item: 'ember_core', count: 1, chance: 0.25 }], likes: [], group: [1, 2], model: MAGMA_CRAWLER,
    hostile: {
      attack: 'bolt', damage: 2, windupS: 0.8, cooldownS: 3.5, range: 12, senseRange: 14, burn: { seconds: 2, perS: 1 }, projectileSpeed: 12,
      habitat: { places: { scar_night: 2 } },
    },
  },
  {
    key: 'bog_lantern', name: 'Bog Lantern',
    desc: 'A hanging lantern with a green flame that drifts over the marsh at night, luring the careless. Its spark arcs to you, and water carries it farther.',
    biomes: ['marsh'], health: 6, speed: 2.6, size: { w: 0.8, h: 0.85 },
    drops: [{ item: 'glowcap', count: [1, 2] }, { item: 'copper_wire', count: 1, chance: 0.25 }, { item: 'vial_brook', count: 1, chance: 0.1 }], likes: [], group: [1, 1], model: BOG_LANTERN,
    hostile: { attack: 'zap', damage: 2, windupS: 0.6, cooldownS: 2.5, range: 7, senseRange: 14, flying: true, wetMult: 2, habitat: { places: { marsh_night: 3 } } },
  },
];
