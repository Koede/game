/**
 * The Bronze workshop's modular parts (docs/OVERHAUL_PLAN.md A.2, A.5-A.7): transmission (reverse box, ratio dial,
 * clutch, split box, gearshift, governor, worm gear, chain sprocket, belt pulley), a clockwork motor, and the
 * logistics and processing pieces that follow. Each part is a block with a generated front (src/render/textures/
 * iconsWorkshopParts.ts) and runs from src/workshop. Gate: Bronze, like the first slice.
 */
import type { BlockSpec, ItemSpec } from '../core/types';
import { ageIndexOf } from '../magic/ageMap';

const BRONZE = ageIndexOf('bronze');

export interface PartDef { key: string; name: string; desc: string; /** has a running front */ anim: boolean }

export const PART_DEFS: readonly PartDef[] = [
  { key: 'reverse_box', name: 'Reverse Box', anim: true, desc: 'Two meshed cogs: what leaves it turns the other way. Use it to read its direction under goggles.' },
  { key: 'ratio_dial', name: 'Ratio Dial', anim: true, desc: 'A gear train with a dial. Use it to cycle the output speed: half, equal, double, triple.' },
  { key: 'clutch', name: 'Clutch', anim: true, desc: 'Use it to engage or release: a released clutch hands nothing on, so the machines beyond it stop.' },
  { key: 'split_box', name: 'Split Box', anim: true, desc: 'A bevel box that joins shafts on every side and shares the load between them.' },
  { key: 'sequence_gearshift', name: 'Sequenced Gearshift', anim: true, desc: 'A drum that engages, reverses and changes speed on a loop. Use it to pick one of three programs.' },
  { key: 'governor', name: 'Governor', anim: true, desc: 'Flyweights that cap the speed beyond it. Use it to cycle 32, 64 and 96 rpm.' },
  { key: 'worm_gear', name: 'Worm Gear', anim: true, desc: 'Slows the turning to an eighth. Only the worm side can drive it.' },
  { key: 'chain_sprocket', name: 'Chain Sprocket', anim: true, desc: 'Face two sprockets along a straight line, up to 16 blocks apart, and a chain joins their shafts without slipping.' },
  { key: 'belt_pulley', name: 'Belt Pulley', anim: true, desc: 'Pulleys up to 9 blocks apart in a line are joined by a leather belt. Use it to pick the size: the big one turns slower.' },
  { key: 'clockwork_motor', name: 'Clockwork Motor', anim: true, desc: 'Use it to wind it (30 s a wind). While wound it turns at 24 rpm and carries 48 stress units.' },
];

export const PART_ITEMS: ItemSpec[] = [
  { key: 'bronze_cog', name: 'Bronze Cog', category: 'material', age: BRONZE, stack: 64, desc: 'A toothed bronze wheel. Gearboxes, dials and motors are built from them.' },
];

const front = (key: string, anim: boolean) => ({ side: 'ws_machine_side', top: 'ws_hopper_top', bottom: 'ws_machine_side', front: `ws_${key}_front`, ...(anim ? { frontActive: `ws_${key}_front_on` } : {}) });

export const PART_BLOCKS: BlockSpec[] = PART_DEFS.map((d): BlockSpec => ({
  key: d.key, name: d.name, desc: d.desc, category: 'machine', age: BRONZE, hardness: 1.2, tool: 'pickaxe', minTier: 0, stack: 16,
  oriented: true, textures: front(d.key, d.anim),
}));
