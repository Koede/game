/**
 * The Emberbound (spec 19): war-forged automatons left over from the age when the Old Works were lit. Numbers are the
 * spec's (19.1); behaviour lives in src/mobs, models are drawn by src/render from the part lists below.
 *
 * Model units are 1/16 block from the centre of the feet (a hovering drone: the bottom of its body), authored facing
 * north (-Z). `glow` parts are emissive ember parts: eyes, vents, cores - lit while active, flaring through every
 * wind-up, dark when dormant. Each silhouette is meant to read at a glance on a phone: a low six-legged scuttler, a
 * shield-and-hammer soldier, a squat kiln on a tripod, a long low hound with glowing ribs, a drum with a coil, a hulk.
 */
import { ALL_BIOMES, type CreatureAnim, type CreaturePart, type CreatureSpec } from '../core/types';
import { BIOME_SERVANTS } from './biomeMobs';

type V3 = readonly [number, number, number];

const box = (name: string, from: V3, to: V3, color: number): CreaturePart => ({ name, from, to, color, anim: 'none' });
const glow = (name: string, from: V3, to: V3, color: number): CreaturePart => ({ name, from, to, color, anim: 'none', emissive: true });

/** Parts that move together about one pivot (a head, an arm, a leg). `hot` parts of the group glow. */
function group(anim: CreatureAnim, pivot: V3) {
  return (name: string, from: V3, to: V3, color: number, hot = false): CreaturePart =>
    ({ name, from, to, color, anim, pivot, ...(hot ? { emissive: true } : {}) });
}

/** Mirror of a part across x = 0 (the model's right side from its left). */
const mirrorX = (p: CreaturePart, name: string, anim: CreatureAnim = p.anim): CreaturePart => ({
  ...p, name, anim,
  from: [-p.to[0], p.from[1], p.from[2]],
  to: [-p.from[0], p.to[1], p.to[2]],
  ...(p.pivot ? { pivot: [-p.pivot[0], p.pivot[1], p.pivot[2]] as V3 } : {}),
});

// Shared palette: soot iron, old bronze, rust, slag, and the ember glows.
const SOOT = 0x37322e;
const IRON = 0x4d4741;
const IRON_LIGHT = 0x625a51;
const BRONZE = 0x7d6544;
const BRONZE_DARK = 0x5c4a33;
const RUST = 0x7c4a2c;
const EMBER = 0xff7a1e;
const EMBER_HOT = 0xffb04a;
const EMBER_DEEP = 0xff5a12;

// ---- cinder mite: a low six-legged scuttler with a glowing back vent ---------------------------------------------
const MITE_HEAD = group('head', [0, 3, -5]);
/** One spider leg: a thigh out from the body and a shin down to the ground, swinging about the hip. */
function miteLeg(anim: CreatureAnim, z: number): CreaturePart[] {
  const leg = group(anim, [-4, 3.5, z]);
  return [leg(`${anim}Thigh`, [-6.5, 2.5, z - 0.5], [-4, 3.5, z + 0.5], IRON_LIGHT), leg(`${anim}Shin`, [-6.5, 0, z - 0.5], [-5.5, 2.5, z + 0.5], BRONZE_DARK)];
}
const leftLegs = [...miteLeg('legFL', -3.5), ...miteLeg('legML', 0), ...miteLeg('legBL', 3.5)];
const MIRRORED: Partial<Record<CreatureAnim, CreatureAnim>> = { legFL: 'legFR', legML: 'legMR', legBL: 'legBR', armL: 'armR' };
const CINDER_MITE: CreaturePart[] = [
  box('carapace', [-4, 2, -5], [4, 5, 5], SOOT),
  box('rimL', [-2.75, 5, -1.5], [-2, 6.5, 3.5], RUST),
  box('rimR', [2, 5, -1.5], [2.75, 6.5, 3.5], RUST),
  glow('vent', [-2, 5, -1], [2, 6, 3], EMBER),
  box('tail', [-2, 2.5, 5], [2, 4.5, 7], IRON),
  MITE_HEAD('head', [-3, 2, -8], [3, 4.5, -5], IRON),
  MITE_HEAD('eyeL', [-2.25, 3, -8.2], [-1.25, 4, -8], EMBER_HOT, true),
  MITE_HEAD('eyeR', [1.25, 3, -8.2], [2.25, 4, -8], EMBER_HOT, true),
  MITE_HEAD('mandibleL', [-2.5, 1.5, -9.5], [-1.5, 2.5, -8], BRONZE),
  MITE_HEAD('mandibleR', [1.5, 1.5, -9.5], [2.5, 2.5, -8], BRONZE),
  ...leftLegs,
  ...leftLegs.map((p) => mirrorX(p, p.name.replace(/^leg(.)L/, 'leg$1R'), MIRRORED[p.anim])),
];

// ---- forge warden: an upright soldier, shield arm and hammer arm, a glowing visor -------------------------------
const WARDEN_HEAD = group('head', [0, 25, 0]);
const WARDEN_SHIELD = group('armL', [-6.5, 24, 0]);
const WARDEN_HAMMER = group('armR', [6.5, 24, 0]);
const wardenLeg = (anim: 'legFL' | 'legFR', x0: number, x1: number): CreaturePart[] => {
  const leg = group(anim, [(x0 + x1) / 2, 12, 0]);
  return [
    leg(anim, [x0, 0, -1.5], [x1, 12, 1.5], SOOT),
    leg(`${anim}Foot`, [x0 - 0.5, 0, -3], [x1 + 0.5, 1.5, 1.5], IRON),
    leg(`${anim}Knee`, [x0 - 0.25, 6, -2], [x1 + 0.25, 8, -1.5], BRONZE),
  ];
};
const FORGE_WARDEN: CreaturePart[] = [
  ...wardenLeg('legFL', -4, -1),
  ...wardenLeg('legFR', 1, 4),
  box('hips', [-4.5, 12, -2], [4.5, 15, 2], IRON),
  box('torso', [-5.5, 15, -3], [5.5, 25, 3], BRONZE_DARK),
  box('chestPlate', [-4.5, 17, -3.5], [4.5, 24, -3], BRONZE),
  glow('chestVent', [-1.5, 19, -3.75], [1.5, 22, -3.5], EMBER),
  box('backVent', [-3, 18, 3], [3, 23, 3.5], RUST),
  WARDEN_HEAD('head', [-3, 25, -2.5], [3, 31, 2.5], IRON),
  WARDEN_HEAD('visor', [-2.5, 27.5, -2.8], [2.5, 28.75, -2.5], EMBER_HOT, true),
  WARDEN_HEAD('crest', [-0.75, 31, -2.5], [0.75, 33, 2.5], RUST),
  WARDEN_SHIELD('shoulderL', [-7.5, 23, -2], [-5.5, 26, 2], BRONZE),
  WARDEN_SHIELD('armL', [-7.5, 14, -1.5], [-5.5, 23, 1.5], SOOT),
  WARDEN_SHIELD('shield', [-7.5, 11, -5.5], [-1.5, 24, -4], BRONZE),
  WARDEN_SHIELD('shieldRim', [-7.25, 11.25, -5.75], [-1.75, 12, -5.5], BRONZE_DARK),
  WARDEN_SHIELD('shieldBoss', [-5.25, 16, -6], [-3.75, 19, -5.5], IRON_LIGHT),
  WARDEN_HAMMER('shoulderR', [5.5, 23, -2], [7.5, 26, 2], BRONZE),
  WARDEN_HAMMER('armR', [5.5, 14, -1.5], [7.5, 23, 1.5], SOOT),
  WARDEN_HAMMER('haft', [6, 5, -1], [7, 14, 0], RUST),
  WARDEN_HAMMER('hammer', [4.5, 1, -3.5], [7.5, 6, 1.5], IRON_LIGHT),
  WARDEN_HAMMER('hammerFace', [4.75, 1.5, -3.75], [7.25, 5.5, -3.5], EMBER_DEEP, true),
];

// ---- kiln sentry: a squat kiln turret on a tripod, its mouth glowing ----------------------------------------------
const KILN = group('head', [0, 7, 0]);
const KILN_SENTRY: CreaturePart[] = [
  box('legFrontL', [-6, 0, -5], [-4.5, 6, -3.5], SOOT),
  box('legFrontR', [4.5, 0, -5], [6, 6, -3.5], SOOT),
  box('legBack', [-0.75, 0, 4], [0.75, 6, 6], SOOT),
  box('base', [-4.5, 5, -4.5], [4.5, 7, 4.5], IRON),
  KILN('kiln', [-5, 7, -5], [5, 15, 5], RUST),
  KILN('bandLow', [-5.25, 8, -5.25], [5.25, 8.75, 5.25], IRON),
  KILN('cap', [-4, 15, -4], [4, 17, 4], BRONZE_DARK),
  KILN('chimney', [-1.5, 17, -1.5], [1.5, 19.5, 1.5], SOOT),
  KILN('chimneyGlow', [-1, 19.5, -1], [1, 20.25, 1], EMBER, true),
  KILN('lipTop', [-3.75, 13, -6], [3.75, 13.75, -5], IRON_LIGHT),
  KILN('lipBottom', [-3.75, 8.25, -6], [3.75, 9, -5], IRON_LIGHT),
  KILN('lipL', [-3.75, 9, -6], [-3, 13, -5], IRON_LIGHT),
  KILN('lipR', [3, 9, -6], [3.75, 13, -5], IRON_LIGHT),
  KILN('mouth', [-3, 9, -5.5], [3, 13, -5], EMBER_HOT, true),
  KILN('ventL', [-5.25, 11, -1], [-5, 13, 1], EMBER, true),
  KILN('ventR', [5, 11, -1], [5.25, 13, 1], EMBER, true),
];

// ---- bellows hound: a long low quadruped whose bellows ribs glow ---------------------------------------------------
const HOUND_HEAD = group('head', [0, 10, -8]);
/** Four long thin legs with dark paws. */
function houndLegs(): CreaturePart[] {
  const out: CreaturePart[] = [];
  for (const [anim, x, z] of [['legFL', -2.75, -5.5], ['legFR', 2.75, -5.5], ['legBL', -2.75, 4.5], ['legBR', 2.75, 4.5]] as const) {
    const leg = group(anim, [x, 7.5, z]);
    out.push(leg(anim, [x - 0.75, 0, z - 1], [x + 0.75, 7.5, z + 1], IRON), leg(`${anim}Paw`, [x - 1, 0, z - 1.5], [x + 1, 1, z + 1], SOOT));
  }
  return out;
}
const ribs = [-6, -3.5, -1, 1.5, 4].map((z, i) => box(`rib${i}`, [-4, 7, z], [4, 12, z + 1.25], SOOT));
const BELLOWS_HOUND: CreaturePart[] = [
  glow('bellows', [-3.5, 7.5, -6], [3.5, 11.5, 5.5], EMBER),
  ...ribs,
  box('chest', [-4, 6.5, -8], [4, 12.5, -6], IRON),
  box('haunch', [-4, 7, 5.5], [4, 12, 7], IRON),
  box('spine', [-1, 12, -7], [1, 13, 6], RUST),
  box('exhaust', [-0.75, 10, 7], [0.75, 11.5, 10], BRONZE_DARK),
  glow('exhaustTip', [-0.5, 10.25, 10], [0.5, 11.25, 10.25], EMBER_HOT),
  HOUND_HEAD('head', [-2.5, 8, -13], [2.5, 12, -8], IRON_LIGHT),
  HOUND_HEAD('jaw', [-2, 6.5, -13.5], [2, 8, -9], SOOT),
  HOUND_HEAD('eyeL', [-2.25, 10, -13.25], [-1, 11, -13], EMBER_HOT, true),
  HOUND_HEAD('eyeR', [1, 10, -13.25], [2.25, 11, -13], EMBER_HOT, true),
  HOUND_HEAD('maw', [-1.5, 7.5, -13.75], [1.5, 8.5, -13.5], EMBER, true),
  HOUND_HEAD('ventL', [-2, 12, -10], [-1, 14, -9], RUST),
  HOUND_HEAD('ventR', [1, 12, -10], [2, 14, -9], RUST),
  ...houndLegs(),
];

// ---- arc drone: a hovering drum with a lightning coil and no legs -------------------------------------------------
const COIL = group('head', [0, 8, 0]);
const ARC = 0x9fe6ff;
const COPPER = 0xb06a3a;
const ARC_DRONE: CreaturePart[] = [
  glow('thruster', [-2, 0, -2], [2, 2, 2], EMBER),
  box('drum', [-4, 2, -4], [4, 8, 4], IRON),
  box('band', [-4.25, 4, -4.25], [4.25, 5, 4.25], COPPER),
  glow('lens', [-1.5, 5.25, -4.5], [1.5, 7, -4.25], EMBER_HOT),
  box('finL', [-5, 3, -0.5], [-4, 7, 0.5], BRONZE_DARK),
  box('finR', [4, 3, -0.5], [5, 7, 0.5], BRONZE_DARK),
  box('finBack', [-0.5, 3, 4], [0.5, 7, 5], BRONZE_DARK),
  COIL('coil', [-1.5, 8, -1.5], [1.5, 13, 1.5], COPPER),
  COIL('winding0', [-2.25, 9, -2.25], [2.25, 10, 2.25], BRONZE_DARK),
  COIL('winding1', [-2.25, 11, -2.25], [2.25, 12, 2.25], BRONZE_DARK),
  COIL('spark', [-1.25, 13, -1.25], [1.25, 15, 1.25], ARC, true),
];

// ---- slag colossus: a huge slag-plated hulk with a molten chest core ----------------------------------------------
const SLAG = 0x3b322c;
const SLAG_DARK = 0x2a231f;
const SLAG_HEAD = group('head', [0, 36, -2]);
const colossusArm = (anim: 'armL' | 'armR', s: -1 | 1): CreaturePart[] => {
  const arm = group(anim, [11 * s, 34, 0]);
  const x = (a: number, b: number): [number, number] => (s < 0 ? [-b, -a] : [a, b]);
  const side = s < 0 ? 'L' : 'R';
  const [a0, a1] = x(9.5, 12.5);
  const [f0, f1] = x(9, 13);
  return [
    arm(`arm${side}`, [a0, 8, -3.5], [a1, 32, 3.5], SLAG),
    arm(`pad${side}`, [f0, 31, -5], [f1, 37, 5], SLAG_DARK),
    arm(`fist${side}`, [f0, 3, -4.5], [f1, 9, 4.5], IRON),
    arm(`knuckles${side}`, [f0, 3.5, -4.75], [f1, 5.5, -4.5], EMBER_DEEP, true),
  ];
};
const colossusLeg = (anim: 'legFL' | 'legFR', x0: number, x1: number): CreaturePart[] => {
  const leg = group(anim, [(x0 + x1) / 2, 14, 0]);
  return [leg(anim, [x0, 0, -3], [x1, 14, 3], SLAG), leg(`${anim}Foot`, [x0 - 0.5, 0, -4.5], [x1 + 0.5, 2, 3.5], SLAG_DARK)];
};
const SLAG_COLOSSUS: CreaturePart[] = [
  ...colossusLeg('legFL', -8, -2),
  ...colossusLeg('legFR', 2, 8),
  box('pelvis', [-8, 14, -4], [8, 18, 4], SLAG_DARK),
  box('torso', [-9, 18, -6], [9, 36, 6], SLAG),
  box('plateL', [-9, 25, -6.5], [-3, 35, -6], SLAG_DARK),
  box('plateR', [3, 25, -6.5], [9, 35, -6], SLAG_DARK),
  box('belly', [-7, 18, -6.5], [7, 23, -6], RUST),
  glow('core', [-3, 24, -6.75], [3, 32, -6], EMBER_DEEP),
  glow('seamL', [-8.5, 23, -6.25], [-6, 24, -6], EMBER),
  glow('seamR', [6, 23, -6.25], [8.5, 24, -6], EMBER),
  glow('backVentL', [-6, 30, 6], [-3, 34, 6.5], EMBER),
  glow('backVentR', [3, 30, 6], [6, 34, 6.5], EMBER),
  box('hump', [-5, 36, 0], [5, 39, 6], SLAG_DARK),
  SLAG_HEAD('head', [-3.5, 36, -5], [3.5, 41, 1], SLAG),
  SLAG_HEAD('brow', [-3.75, 39, -5.5], [3.75, 40, -5], SLAG_DARK),
  SLAG_HEAD('eyeL', [-2.5, 37.5, -5.25], [-1, 38.75, -5], EMBER_HOT, true),
  SLAG_HEAD('eyeR', [1, 37.5, -5.25], [2.5, 38.75, -5], EMBER_HOT, true),
  ...colossusArm('armL', -1),
  ...colossusArm('armR', 1),
];

/** Automatons live in every biome; where and when they appear is their habitat. */
const EVERYWHERE = [...ALL_BIOMES];

export const AUTOMATON_SPECS: CreatureSpec[] = [
  {
    key: 'cinder_mite', name: 'Cinder Mite',
    desc: 'An ember-tick from the old forges, no bigger than a hound\'s head. Its back vent glows like a coal, and where one creeps, more follow.',
    biomes: EVERYWHERE, health: 4, speed: 3.2, size: { w: 0.8, h: 0.45 },
    drops: [{ item: 'scrap_metal', count: 1, chance: 0.5 }], likes: [], group: [2, 4], model: CINDER_MITE,
    hostile: {
      attack: 'melee', damage: 1, windupS: 0.3, cooldownS: 0.8, range: 1.4, senseRange: 16,
      habitat: { places: { cave: 6, deep: 4, surface: 4, scar: 4 } },
    },
  },
  {
    key: 'forge_warden', name: 'Forge Warden',
    desc: 'A soldier of the Old Works, still guarding forges no one has lit in an age. Its shield turns blows from the front: strike it from the side.',
    biomes: EVERYWHERE, health: 16, speed: 2.4, size: { w: 0.9, h: 2.1 },
    drops: [{ item: 'scrap_metal', count: [1, 3] }, { item: 'copper_coil', count: 1, chance: 0.1 }, { item: 'circuit', count: 1, chance: 0.04 }],
    likes: [], group: [1, 1], model: FORGE_WARDEN,
    hostile: {
      attack: 'melee', damage: 3, windupS: 0.5, cooldownS: 1.6, range: 2, senseRange: 16, shieldFront: 0.5,
      habitat: { places: { surface: 1 }, ruin: 'guard' },
    },
  },
  {
    key: 'kiln_sentry', name: 'Kiln Sentry',
    desc: 'A turret built like a little kiln and set on a ruin wall to keep thieves off. Its mouth brightens just before it spits a bolt of embers.',
    biomes: EVERYWHERE, health: 12, speed: 0, size: { w: 1, h: 1.3 },
    drops: [{ item: 'ember_core', count: 1 }, { item: 'scrap_metal', count: [1, 2] }], likes: [], group: [1, 1], model: KILN_SENTRY,
    hostile: {
      attack: 'bolt', damage: 2, windupS: 0.7, cooldownS: 3, range: 16, senseRange: 16, stationary: true,
      burn: { seconds: 2, perS: 1 }, projectileSpeed: 14,
      habitat: { places: {}, ruin: 'turret' },
    },
  },
  {
    key: 'bellows_hound', name: 'Bellows Hound',
    desc: 'A long iron hunter that breathes through bellows ribs. When the ribs flare and it crouches, it is about to charge: step aside.',
    biomes: EVERYWHERE, health: 10, speed: 4.5, size: { w: 0.8, h: 1 },
    drops: [{ item: 'scrap_metal', count: [1, 2] }, { item: 'ember_core', count: 1, chance: 0.25 }], likes: [], group: [1, 2], model: BELLOWS_HOUND,
    hostile: {
      attack: 'dash', damage: 4, windupS: 0.8, cooldownS: 3, range: 8, senseRange: 16, knockback: 8, dashSpeed: 12,
      habitat: { places: { surface: 2, scar: 4 } },
    },
  },
  {
    key: 'arc_drone', name: 'Arc Drone',
    desc: 'A hovering drum that drinks the storm and hunts the high ground on dark nights. Its coil crackles before it strikes, and water carries the arc.',
    biomes: EVERYWHERE, health: 8, speed: 3, size: { w: 0.8, h: 0.8 },
    drops: [{ item: 'scrap_metal', count: 1 }, { item: 'copper_wire', count: 2, chance: 0.2 }, { item: 'silicon_wafer', count: 1, chance: 0.08 }],
    likes: [], group: [1, 1], model: ARC_DRONE,
    hostile: {
      attack: 'zap', damage: 2, windupS: 0.6, cooldownS: 2.5, range: 8, senseRange: 16, flying: true, wetMult: 2,
      habitat: { places: { peak: 3 }, sky: 'storm_or_moonless' },
    },
  },
  {
    key: 'slag_colossus', name: 'Slag Colossus',
    desc: 'A walking heap of slag around a molten heart, built to haul ore from the deep. When both arms rise, get clear: the ground itself is the blow.',
    biomes: EVERYWHERE, health: 60, speed: 1.6, size: { w: 1.6, h: 2.7 },
    drops: [
      { item: 'superalloy', count: 1 }, { item: 'ember_core', count: 3 }, { item: 'magnet_ring', count: 1, chance: 0.3 },
      { item: 'scrap_metal', count: [4, 8] },
    ],
    likes: [], group: [1, 1], model: SLAG_COLOSSUS,
    hostile: {
      attack: 'slam', damage: 6, windupS: 1.2, cooldownS: 4, range: 3, senseRange: 16, knockback: 10,
      habitat: { places: { deep: 1, scar_night: 1 }, maxLoaded: 1 },
    },
  },
];

// The feral servants of the five biomes (docs/SYNERGY_PLAN.md section 3): walk their own biome at night.
AUTOMATON_SPECS.push(...BIOME_SERVANTS);
