/**
 * The animals of spec 12.5: plain, passive, real-world animals drawn as our own blocky models. Numbers are the
 * spec's; behaviour lives in src/mobs and the models are built by src/render from the part lists below.
 *
 * Model units are 1/16 block from the centre of the feet, authored facing north (-Z): the head is at negative z.
 * Legs pivot at the hip (top centre), every head part pivots at the neck. Parts that share an anim tag share
 * one pivot.
 */
import type { CreaturePart, CreatureSpec } from '../core/types';

type V3 = readonly [number, number, number];

const box = (name: string, from: V3, to: V3, color: number): CreaturePart => ({ name, from, to, color, anim: 'none' });

/** A part that moves with the head about the neck. */
const headPart = (neck: V3) => (name: string, from: V3, to: V3, color: number): CreaturePart =>
  ({ name, from, to, color, anim: 'head', pivot: neck });

/** One leg (and an optional hoof at its foot) swinging about the top centre of its box. */
function leg(anim: 'legFL' | 'legFR' | 'legBL' | 'legBR', from: V3, to: V3, color: number, hoof?: number): CreaturePart[] {
  const pivot: V3 = [(from[0] + to[0]) / 2, to[1], (from[2] + to[2]) / 2];
  const parts: CreaturePart[] = [{ name: anim, from, to, color, anim, pivot }];
  if (hoof !== undefined) {
    parts.push({ name: `${anim}Hoof`, from: [from[0] - 0.1, from[1], from[2] - 0.1], to: [to[0] + 0.1, from[1] + 1, to[2] + 0.1], color: hoof, anim, pivot });
  }
  return parts;
}

/** Four legs of a quadruped: `w` wide and `l` deep, `h` tall, centred on x = ±x and z = front/back. */
function fourLegs(x: number, front: number, back: number, w: number, l: number, h: number, color: number, hoof?: number): CreaturePart[] {
  const at = (anim: 'legFL' | 'legFR' | 'legBL' | 'legBR', cx: number, cz: number): CreaturePart[] =>
    leg(anim, [cx - w / 2, 0, cz - l / 2], [cx + w / 2, h, cz + l / 2], color, hoof);
  return [...at('legFL', -x, front), ...at('legFR', x, front), ...at('legBL', -x, back), ...at('legBR', x, back)];
}

// ---- hen: a russet-buff hen with a red comb, two yellow legs ---------------------------------------
const HEN_NECK: V3 = [0, 9, -3];
const henHead = headPart(HEN_NECK);
const HEN: CreaturePart[] = [
  box('body', [-3, 4, -3], [3, 9, 4], 0xc98d55),
  box('wingL', [-3.5, 5, -2], [-3, 8.5, 3], 0x9c6638),
  box('wingR', [3, 5, -2], [3.5, 8.5, 3], 0x9c6638),
  box('tail', [-2, 7, 3], [2, 12, 5.5], 0x6e4527),
  box('breast', [-2.5, 4.5, -3.5], [2.5, 8, -3], 0xdcaa72),
  henHead('head', [-2, 8, -6], [2, 12, -2], 0xd29a62),
  henHead('beak', [-0.75, 9.5, -7.5], [0.75, 10.75, -6], 0xe3a63a),
  henHead('comb', [-0.75, 12, -5], [0.75, 13.25, -2.5], 0xc0392b),
  henHead('wattle', [-0.5, 8, -6.75], [0.5, 9.5, -6], 0xc0392b),
  henHead('eyeL', [-2.2, 10.25, -5], [-2, 11.25, -4], 0x1b1410),
  henHead('eyeR', [2, 10.25, -5], [2.2, 11.25, -4], 0x1b1410),
  // Two legs: a biped uses the front pair only, and the toes swing with their leg.
  ...leg('legFL', [-2, 0, -0.5], [-1, 4, 0.5], 0xe3a63a),
  ...leg('legFR', [1, 0, -0.5], [2, 4, 0.5], 0xe3a63a),
  { name: 'toesL', from: [-2.5, 0, -2], to: [-0.5, 0.5, 0.5], color: 0xd39530, anim: 'legFL', pivot: [-1.5, 4, 0] },
  { name: 'toesR', from: [0.5, 0, -2], to: [2.5, 0.5, 0.5], color: 0xd39530, anim: 'legFR', pivot: [1.5, 4, 0] },
];

// ---- goat: shaggy cream coat, grey-brown legs, swept-back horns and a beard ------------------------
const GOAT_NECK: V3 = [0, 14, -5];
const goatHead = headPart(GOAT_NECK);
const GOAT: CreaturePart[] = [
  box('body', [-5, 8, -6], [5, 15, 6], 0xd9d1bf),
  box('shag', [-5.25, 7, -5], [5.25, 9, 5], 0xc4b9a3),
  box('tail', [-1, 13, 6], [1, 16, 8], 0xe6dfd0),
  goatHead('neck', [-2, 12, -7], [2, 17, -4], 0xd9d1bf),
  goatHead('head', [-3, 14, -10], [3, 19, -6], 0xd9d1bf),
  goatHead('snout', [-2, 14, -12], [2, 17, -10], 0xc7bba6),
  goatHead('nose', [-1.5, 15.5, -12.2], [1.5, 16.75, -12], 0x4a3f38),
  goatHead('beard', [-1, 11, -11.5], [1, 14, -10], 0xa89d88),
  goatHead('eyeL', [-3.2, 16.5, -9], [-3, 17.5, -8], 0x3a2a14),
  goatHead('eyeR', [3, 16.5, -9], [3.2, 17.5, -8], 0x3a2a14),
  goatHead('earL', [-5, 16.5, -8], [-3, 17.5, -7], 0xc7bba6),
  goatHead('earR', [3, 16.5, -8], [5, 17.5, -7], 0xc7bba6),
  goatHead('hornL', [-2.75, 19, -8.5], [-1.25, 21, -7], 0x5c4b3b),
  goatHead('hornR', [1.25, 19, -8.5], [2.75, 21, -7], 0x5c4b3b),
  goatHead('hornTipL', [-2.75, 20, -7], [-1.25, 21.5, -5], 0x463829),
  goatHead('hornTipR', [1.25, 20, -7], [2.75, 21.5, -5], 0x463829),
  ...fourLegs(3, -4, 4, 2, 2, 8, 0x8f8576, 0x3d342c),
];

// ---- boar: dark umber bristles, a ridge of black mane, pale tusks and a pink-brown snout -----------
const BOAR_NECK: V3 = [0, 10, -8];
const boarHead = headPart(BOAR_NECK);
const BOAR: CreaturePart[] = [
  box('body', [-6, 4, -8], [6, 13, 8], 0x5e4434),
  box('belly', [-5, 3.5, -6], [5, 5, 6], 0x4a352a),
  box('mane', [-1.5, 13, -8], [1.5, 14.5, 4], 0x2c201a),
  box('tail', [-0.5, 9, 8], [0.5, 12, 9], 0x2c201a),
  boarHead('head', [-4, 5, -14], [4, 12, -8], 0x553d2f),
  boarHead('snout', [-2.5, 5, -16], [2.5, 8.5, -14], 0xb07c68),
  boarHead('nostrils', [-2, 6, -16.2], [2, 8, -16], 0x6a4236),
  boarHead('tuskL', [-3.25, 7, -15.25], [-2.25, 10, -14.25], 0xe8dfc6),
  boarHead('tuskR', [2.25, 7, -15.25], [3.25, 10, -14.25], 0xe8dfc6),
  boarHead('eyeL', [-4.2, 9.5, -12.5], [-4, 10.5, -11.5], 0x140e0a),
  boarHead('eyeR', [4, 9.5, -12.5], [4.2, 10.5, -11.5], 0x140e0a),
  boarHead('earL', [-4, 11.5, -10], [-2.5, 14, -9], 0x3b2a22),
  boarHead('earR', [2.5, 11.5, -10], [4, 14, -9], 0x3b2a22),
  ...fourLegs(3.5, -4.5, 5.5, 3, 3, 5, 0x3b2a22, 0x1c1410),
];

export const CREATURE_SPECS: CreatureSpec[] = [
  {
    key: 'hen', name: 'Hen', desc: 'A plump, fussy bird of the woods, the dunes and the marsh. Scatter wheat seeds and she will follow you home.',
    biomes: ['woodland', 'dunes', 'marsh'], health: 4, speed: 2.2, size: { w: 0.45, h: 0.7 },
    drops: [{ item: 'raw_fowl', count: 1 }], likes: ['wheat_seeds'], group: [2, 4], model: HEN,
  },
  {
    key: 'goat', name: 'Goat', desc: 'A sure-footed goat of the cold hills and woods. It will follow a sheaf of wheat anywhere.',
    biomes: ['frostfell', 'woodland'], health: 8, speed: 2.6, size: { w: 0.8, h: 1.2 },
    drops: [{ item: 'raw_mutton', count: [1, 2] }, { item: 'hide', count: 1, chance: 0.5 }], likes: ['wheat'], group: [2, 3], model: GOAT,
  },
  {
    key: 'boar', name: 'Boar', desc: 'A bristly wild boar of the woods, the scar and the marsh wallows. Shy, but potatoes and carrots win it over.',
    biomes: ['woodland', 'scar', 'marsh'], health: 10, speed: 2.8, size: { w: 0.9, h: 0.9 },
    drops: [{ item: 'raw_chop', count: [1, 3] }, { item: 'hide', count: 1 }], likes: ['potato', 'carrot'], group: [2, 3], model: BOAR,
  },
];
