/** Goals of the Bronze workshop (docs/OVERHAUL_PLAN.md A), spliced into objectives.ts after the bronze pickaxe. */
import type { ObjectiveSpec } from '../core/types';
import { ageIndexOf } from '../magic/ageMap';

const goal = (id: string, title: string, condition: ObjectiveSpec['condition'], text: string): ObjectiveSpec => ({ id, title, text, condition, age: ageIndexOf('bronze') });

export const WORKSHOP_OBJECTIVES: ObjectiveSpec[] = [
  goal('place_hand_crank', 'Set up a hand crank', { type: 'place', block: 'hand_crank', count: 1 },
    'A Hand Crank turns every shaft, belt and machine joined to it while you hold Use. Put goggles in your pack to read speed and load.'),
  goal('place_mech_millstone', 'Build a millstone', { type: 'place', block: 'mech_millstone', count: 1 },
    'Join a Millstone to the crank with drive shafts. Drop wheat on a conveyor belt that ends at it and flour comes out of its front.'),
  goal('make_bronze_cog', 'Cut bronze cogs', { type: 'make', item: 'bronze_cog', count: 2 },
    'Forge a bronze ingot into two cogs. Reverse boxes, ratio dials, clutches and mixers are built from them.'),
  goal('place_ratio_dial', 'Gear the speed up', { type: 'place', block: 'ratio_dial', count: 1 },
    'A Ratio Dial in the line multiplies the speed (Use cycles it). The Mixer needs 32 rpm, twice what one crank gives.'),
  goal('place_mixer', 'Mix in a basin', { type: 'place', block: 'mixer', count: 1 },
    'Put a Mixer over a Basin of flour and water. Dough comes out in the basin.'),
  goal('place_mech_arm', 'Teach an arm', { type: 'place', block: 'mech_arm', count: 1 },
    'Use a wrench on a Mechanical Arm, then on a source and up to four targets, then the arm again. It carries items between depots, basins and crates.'),
];
