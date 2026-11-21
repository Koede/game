import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DIFFICULTIES } from './context';
import { HOSTILE_DEEP_Y, HOSTILE_PEAK_Y } from './constants';
import {
  armouredDamage, bestArmour, hostileCap, hostileDamage, isMoonless, pickAutomaton, placeWeight, skyAllows, spawnPlacesAt,
} from './hostile';
import { validateAutomaton, validateGear } from './hostileValidation';
import { AUTOMATONS, ITEMS, creature, item, itemOrNull } from './registry';
import type { CreatureSpec, ItemDef } from './types';

const known = (key: string): boolean => itemOrNull(key) !== null;

describe('spawn places', () => {
  it('tells caves, the deep, the night surface, the scar and peaks apart', () => {
    const at = (skyOpen: boolean, y: number, night: boolean, biome: 'woodland' | 'scar' = 'woodland') => spawnPlacesAt({ skyOpen, y, night, biome });
    expect(at(false, HOSTILE_DEEP_Y, false)).toEqual(['cave']);
    expect(at(false, HOSTILE_DEEP_Y - 1, true)).toEqual(['deep']);
    expect(at(true, 40, false)).toEqual([]); // a sunlit surface never spawns anything
    expect(at(true, 40, true)).toEqual(['surface']);
    expect(at(true, HOSTILE_PEAK_Y, true)).toEqual(['surface', 'peak']);
    expect(at(false, 30, false, 'scar')).toEqual(['cave', 'scar']);
    expect(at(true, 40, true, 'scar')).toEqual(['surface', 'scar', 'scar_night']);
  });

  it('weighs a type by the best of its places', () => {
    const mite = creature('cinder_mite');
    expect(placeWeight(mite, ['cave', 'scar'])).toBe(6);
    expect(placeWeight(mite, ['peak'])).toBe(0);
    expect(placeWeight(creature('kiln_sentry'), ['cave', 'deep', 'surface', 'scar', 'scar_night', 'peak'])).toBe(0);
  });

  it('reads the moon and the storm for drones', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].filter(isMoonless)).toEqual([0, 1, 7]);
    const drone = creature('arc_drone').hostile?.habitat;
    const mite = creature('cinder_mite').hostile?.habitat;
    if (!drone || !mite) throw new Error('missing habitat');
    expect(skyAllows(drone, { storm: false, moonPhase: 4 })).toBe(false);
    expect(skyAllows(drone, { storm: true, moonPhase: 4 })).toBe(true);
    expect(skyAllows(drone, { storm: false, moonPhase: 0 })).toBe(true);
    expect(skyAllows(mite, { storm: false, moonPhase: 4 })).toBe(true);
  });

  it('picks by weight, deterministically, and never past a type cap', () => {
    const places = spawnPlacesAt({ skyOpen: false, y: 10, night: false, biome: 'woodland' });
    const sky = { storm: false, moonPhase: 4 };
    // deep: mite 4, colossus 1 -> the first 80% of the draw is a mite, the rest the colossus.
    expect(pickAutomaton(places, sky, () => 0, () => 0.79)?.key).toBe('cinder_mite');
    expect(pickAutomaton(places, sky, () => 0, () => 0.81)?.key).toBe('slag_colossus');
    expect(pickAutomaton(places, sky, (k) => (k === 'slag_colossus' ? 1 : 0), () => 0.99)?.key).toBe('cinder_mite');
    expect(pickAutomaton([], sky, () => 0, () => 0.5)).toBeNull();
  });
});

describe('difficulty and armour', () => {
  it('defaults to Normal with normal UI size', () => {
    expect(DEFAULT_SETTINGS.difficulty).toBe('normal');
    expect(DEFAULT_SETTINGS.uiScale).toBe('normal');
    expect(DIFFICULTIES).toEqual(['peaceful', 'normal', 'hard']);
  });

  it('scales caps and damage', () => {
    const colossus = creature('slag_colossus');
    expect(hostileCap('peaceful')).toBe(0);
    expect(hostileCap('hard')).toBe(hostileCap('normal') * 1.5);
    expect(hostileDamage(colossus, 'normal')).toBe(6);
    expect(hostileDamage(colossus, 'hard')).toBe(7.5);
    expect(hostileDamage(creature('hen'), 'hard')).toBe(0);
  });

  it('counts the best armour carried and softens only automaton blows', () => {
    expect(bestArmour([null, { item: 'stick' }])).toEqual({ reduction: 0, warmthDrainMult: 1 });
    expect(bestArmour([{ item: 'padded_coat' }])).toEqual({ reduction: 0, warmthDrainMult: 0.5 });
    expect(bestArmour([{ item: 'plated_coat' }, { item: 'steel_cuirass' }, { item: 'nonsense' }])).toEqual({ reduction: 0.4, warmthDrainMult: 0.5 });
    const worn = bestArmour([{ item: 'steel_cuirass' }]);
    expect(armouredDamage(10, 'automaton', worn)).toBe(6);
    expect(armouredDamage(10, 'ember', worn)).toBe(10);
    expect(armouredDamage(10, 'fall', worn)).toBe(10);
  });
});

describe('validation', () => {
  it('accepts the shipped automatons and gear', () => {
    for (const c of AUTOMATONS) expect(validateAutomaton(c, known), c.key).toEqual([]);
    expect(validateGear(ITEMS)).toEqual([]);
  });

  it('flags broken automatons', () => {
    const sentry = creature('kiln_sentry');
    const warden = creature('forge_warden');
    const drone = creature('arc_drone');
    const problems = (c: CreatureSpec): string => validateAutomaton(c, known).join('\n');
    expect(problems({ ...warden, hostile: undefined })).toMatch(/no hostile spec/);
    expect(problems({ ...warden, likes: ['wheat'] })).toMatch(/likes must be empty/);
    expect(problems({ ...sentry, speed: 1 })).toMatch(/speed must be 0 exactly when it is stationary/);
    const sh = sentry.hostile;
    const wh = warden.hostile;
    const dh = drone.hostile;
    if (!sh || !wh || !dh) throw new Error('missing hostile');
    expect(problems({ ...sentry, hostile: { ...sh, projectileSpeed: 5 } })).toMatch(/cannot reach 16 blocks/);
    expect(problems({ ...sentry, hostile: { ...sh, cooldownS: 0.5 } })).toMatch(/must exceed windupS/);
    expect(problems({ ...warden, hostile: { ...wh, burn: { seconds: 1, perS: 1 } } })).toMatch(/burn is only for 'bolt'/);
    expect(problems({ ...warden, hostile: { ...wh, habitat: { places: {} } } })).toMatch(/spawns nowhere/);
    expect(problems({ ...warden, hostile: { ...wh, shieldFront: 1.5 } })).toMatch(/shieldFront/);
    expect(problems({ ...warden, model: warden.model.map((p) => ({ ...p, emissive: false })) })).toMatch(/no emissive/);
    expect(problems({ ...warden, model: warden.model.filter((p) => p.anim !== 'legFR') })).toMatch(/needs legFL and legFR/);
    expect(problems({ ...drone, model: [...drone.model, ...warden.model.filter((p) => p.anim === 'legFL')] })).toMatch(/flying automaton has no walking legs/);
    expect(problems({ ...drone, hostile: { ...dh, stationary: true } })).toMatch(/cannot both fly and stand still/);
  });

  it('flags broken gear', () => {
    const maul = item('bronze_maul');
    const coat = item('plated_coat');
    const problems = (it: ItemDef): string => validateGear([it]).join('\n');
    expect(problems({ ...maul, weapon: undefined })).toMatch(/a maul needs a weapon spec/);
    expect(problems({ ...maul, tool: undefined })).toMatch(/needs a ToolSpec/);
    expect(problems({ ...maul, tool: { kind: 'maul', tier: 2, speed: 3, durability: 10 } })).toMatch(/never mines faster/);
    expect(problems({ ...coat, armour: { reduction: 1 } })).toMatch(/reduction must be in/);
    expect(problems({ ...coat, armour: { reduction: 0 } })).toMatch(/armour that does nothing/);
    expect(problems({ ...coat, stack: 4 })).toMatch(/stacks to 1/);
  });
});
