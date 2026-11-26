/**
 * The Bronze Age air blocks (BRONZE_PLAN 4.4): the tube, the tank, the compressor and the blast nozzle. They are
 * members of an air network (BlockSpec.air, simulated by src/sim/airNet.ts), not of a pipe network, so none of them has
 * a `pipe` spec. Appended after every older block so saved voxel ids never move.
 */
import { AIR_MAX_BAR, AIR_NOZZLE_TUYERES } from '../core/constants';
import type { BlockSpec } from '../core/types';

export const AIR_BLOCKS: BlockSpec[] = [
  {
    key: 'air_tube', name: 'Air Tube',
    desc: `A bronze and glass tube for compressed air. It joins every air block it touches. An open end hisses and leaks, so cap it with a tank, a compressor or a nozzle.`,
    age: 1, shape: 'pipe', air: { role: 'tube', volumeL: 50 }, hardness: 0.4, tool: 'pickaxe', category: 'machine', textures: { all: 'pipe_air' },
  },
  {
    key: 'air_tank', name: 'Air Tank',
    desc: `A bronze drum that holds 4000 litres of air, so the pressure holds while a compressor rests. Up to ${AIR_MAX_BAR} bar.`,
    age: 1, air: { role: 'tank', volumeL: 4000 }, hardness: 2, tool: 'pickaxe', stack: 16, category: 'machine',
    textures: { side: 'air_tank_side', top: 'air_tank_top' },
  },
  {
    key: 'air_compressor', name: 'Air Compressor',
    desc: 'Turns a shaft into air: 2 L/s per rpm from 32 rpm, up to 6 bar. Use also pumps it by hand.',
    age: 1, air: { role: 'source', volumeL: 50 }, hardness: 2, tool: 'pickaxe', stack: 16, category: 'machine',
    textures: { side: 'air_compressor_side', top: 'air_compressor_top' },
  },
  {
    key: 'blast_nozzle', name: 'Blast Nozzle',
    desc: `A bronze nozzle set in the face of a Blast hearth. Fed 2 bar of air it blows the fire white and counts as ${AIR_NOZZLE_TUYERES} tuyeres. A Blast hearth cannot form without one.`,
    age: 1, air: { role: 'user', volumeL: 20, minBar: 2, useLPerS: 20 }, hardness: 2, tool: 'pickaxe', stack: 16, category: 'machine',
    textures: { all: 'blast_nozzle', sideActive: 'blast_nozzle_on', topActive: 'blast_nozzle_on', bottomActive: 'blast_nozzle_on' },
  },
];
