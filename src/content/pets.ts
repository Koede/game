/**
 * Pets (docs/api/pets.md): a dog and a cat. Strays wander in now and then (src/game/pets.ts); feed one something it
 * likes and it is yours: it follows you everywhere, carries a little and growls when something hostile is near.
 * Units as in creatures.ts: 1/16 block, authored facing -Z.
 */
import type { CreatureAnim, CreaturePart, CreatureSpec } from '../core/types';

type V3 = readonly [number, number, number];
const box = (name: string, from: V3, to: V3, color: number): CreaturePart => ({ name, from, to, color, anim: 'none' });
const head = (name: string, from: V3, to: V3, color: number, neck: V3): CreaturePart => ({ name, from, to, color, anim: 'head', pivot: neck });
function legs(x: number, front: number, back: number, w: number, h: number, color: number): CreaturePart[] {
  const mk = (anim: Extract<CreatureAnim, 'legFL' | 'legFR' | 'legBL' | 'legBR'>, cx: number, cz: number): CreaturePart =>
    ({ name: anim, from: [cx - w / 2, 0, cz - w / 2], to: [cx + w / 2, h, cz + w / 2], color, anim, pivot: [cx, h, cz] });
  return [mk('legFL', -x, front), mk('legFR', x, front), mk('legBL', -x, back), mk('legBR', x, back)];
}

const DOG_NECK: V3 = [0, 11, -6];
const DOG: CreaturePart[] = [
  box('body', [-3, 5, -6], [3, 11, 5], 0x9a6b3f),
  box('chest', [-2.5, 5.5, -6.5], [2.5, 9.5, -6], 0xd9c4a0),
  head('head', [-2.5, 9, -10], [2.5, 14, -6], 0xa87848, DOG_NECK),
  head('snout', [-1.5, 9, -12.5], [1.5, 11.5, -10], 0xd9c4a0, DOG_NECK),
  head('nose', [-0.75, 10.5, -13], [0.75, 11.5, -12.5], 0x1a1412, DOG_NECK),
  head('earL', [-3, 13, -8], [-2, 16, -6.5], 0x6e4726, DOG_NECK),
  head('earR', [2, 13, -8], [3, 16, -6.5], 0x6e4726, DOG_NECK),
  head('eyeL', [-2.6, 11.5, -9.5], [-2.4, 12.5, -8.5], 0x140e0a, DOG_NECK),
  head('eyeR', [2.4, 11.5, -9.5], [2.6, 12.5, -8.5], 0x140e0a, DOG_NECK),
  box('tail', [-0.75, 9, 5], [0.75, 14, 6.5], 0x9a6b3f),
  ...legs(2, -4.5, 3.5, 2, 5, 0x7d5430),
];

const CAT_NECK: V3 = [0, 9, -4];
const CAT: CreaturePart[] = [
  box('body', [-2, 4, -4], [2, 8.5, 4], 0x6f7378),
  box('stripe', [-0.5, 8.5, -3], [0.5, 8.75, 3], 0x3d4044),
  head('head', [-2.25, 7.5, -7.5], [2.25, 11.5, -4], 0x7a7e84, CAT_NECK),
  head('muzzle', [-1, 7.5, -8], [1, 9, -7.5], 0xe8e0d4, CAT_NECK),
  head('earL', [-2.25, 11.5, -6], [-1, 13.5, -5], 0x6f7378, CAT_NECK),
  head('earR', [1, 11.5, -6], [2.25, 13.5, -5], 0x6f7378, CAT_NECK),
  head('eyeL', [-1.75, 9.25, -7.75], [-1, 10, -7.5], 0x9be06a, CAT_NECK),
  head('eyeR', [1, 9.25, -7.75], [1.75, 10, -7.5], 0x9be06a, CAT_NECK),
  box('tail', [-0.5, 6, 4], [0.5, 12, 5.25], 0x4f5256),
  ...legs(1.4, -3, 2.6, 1.6, 4, 0x5c6065),
];

export const PET_SPECS: CreatureSpec[] = [
  {
    key: 'dog', name: 'Dog', pet: true, desc: 'A stray dog. Offer it raw meat and it is yours: it follows you, carries a few things and growls when something dangerous is near.',
    biomes: [], health: 10, speed: 3.6, size: { w: 0.55, h: 1.0 }, drops: [], likes: ['raw_chop', 'raw_mutton', 'raw_fowl'], group: [1, 1], model: DOG,
  },
  {
    key: 'cat', name: 'Cat', pet: true, desc: 'A stray cat. Offer it a raw fish and it is yours: it follows you, carries a little and hisses when something dangerous is near.',
    biomes: [], health: 6, speed: 3.2, size: { w: 0.4, h: 0.85 }, drops: [], likes: ['raw_perch', 'raw_trout'], group: [1, 1], model: CAT,
  },
];
