/**
 * Pneumatic tubes (src/sim/pneumatics.ts): two air-network stations that shoot items between crates through Air Tubes.
 * Appended after every older block so saved voxel ids never move.
 */
import { PNEU_CAPSULE_L, PNEU_CAPSULE_MAX, PNEU_MIN_BAR } from '../core/constants';
import type { BlockSpec } from '../core/types';

export const PNEUMATIC_BLOCKS: BlockSpec[] = [
  {
    key: 'tube_sender', name: 'Pneumatic Sender',
    desc: `Set against a crate and joined to Air Tubes, it shoots up to ${PNEU_CAPSULE_MAX} items a second to a Pneumatic Receiver, for ${PNEU_CAPSULE_L} litres of air. Needs ${PNEU_MIN_BAR} bar.`,
    age: 1, air: { role: 'station', station: 'send', volumeL: 20 }, hardness: 2, tool: 'pickaxe', stack: 16, category: 'machine',
    textures: { side: 'tube_sender_side', top: 'tube_station_top' },
  },
  {
    key: 'tube_receiver', name: 'Pneumatic Receiver',
    desc: 'Set against a crate and joined to Air Tubes, it catches capsules from every sender. One whose crate already holds an item gets that item first, so a row of them sorts.',
    age: 1, air: { role: 'station', station: 'receive', volumeL: 20 }, hardness: 2, tool: 'pickaxe', stack: 16, category: 'machine',
    textures: { side: 'tube_receiver_side', top: 'tube_station_top' },
  },
];
