/**
 * The Bronze workshop, first pieces (docs/OVERHAUL_PLAN.md A, docs/api/workshop.md): a hand crank and drive shafts that
 * carry its turning, belts that carry ground items, mechanical twins of four hand stations (saw, millstone, mortar,
 * loom) that work the same recipes from items dropped on their top, and Engineer's Goggles that read machines.
 *
 * Gate (BRONZE_PLAN W0 done): these are Bronze Age pieces, age 1, and every one is forged at the Bronze Furnace (furnace
 * tier 2, src/content/recipesWorkshop.ts); ageMap.ts maps 'bronze' to the age index.
 */
import type { BlockSpec, ItemSpec } from '../core/types';
import { ageIndexOf } from '../magic/ageMap';
import { PART_BLOCKS, PART_ITEMS } from './itemsWorkshopParts';

const BRONZE = ageIndexOf('bronze');

/** A mechanical twin: the station whose recipes it works, and seconds per stroke at 16 rpm. */
export interface MechTwin { block: string; station: string; name: string; desc: string }

export const MECH_TWINS: readonly MechTwin[] = [
  { block: 'mech_saw', station: 'chopping_block', name: 'Mechanical Saw', desc: 'A turning blade over a bench. Drop logs or planks on top while it turns: it cuts them like a chopping block with a full blade yield, out of its front.' },
  { block: 'mech_millstone', station: 'hand_quern', name: 'Millstone', desc: 'A stone runner on a turning shaft. Drop wheat on top while it turns: flour comes out of its front.' },
  { block: 'mech_mortar', station: 'mortar', name: 'Stamp Mill', desc: 'Cam-lifted stamps. Drop ore on top while it turns: crushed ore comes out of its front, now and then a double portion.' },
  { block: 'mech_hammer', station: 'stone_anvil', name: 'Trip Hammer', desc: 'A cam-lifted hammer over an anvil face. Drop ingots and stock on top while it turns: it works them like the anvil, hot or cold, out of its front.' },
  { block: 'mech_rack', station: 'drying_rack', name: 'Drying Machine', desc: 'A rack in a warm draught from a turning fan. Drop wet stock on top while it turns: it dries in half the time, rain or shine, out of its front.' },
  { block: 'mech_loom', station: 'loom', name: 'Power Loom', desc: 'A loom whose shuttle a shaft throws. Drop fibre on top while it turns: cloth comes out of its front.' },
];

export const WORKSHOP_ITEMS: ItemSpec[] = [
  ...PART_ITEMS,
  {
    key: 'engineer_goggles', name: "Engineer's Goggles", category: 'tool', age: BRONZE, stack: 1,
    desc: 'Carry them anywhere in your pack: aiming at a machine, a shaft or a furnace names its speed, load, heat or power under the crosshair.',
  },
];

const machineFaces = (key: string) => ({ side: 'ws_machine_side', top: 'ws_hopper_top', bottom: 'ws_machine_side', front: `ws_${key}_front`, frontActive: `ws_${key}_front_on` });

export const WORKSHOP_BLOCKS: BlockSpec[] = [
  {
    key: 'hand_crank', name: 'Hand Crank', category: 'machine', age: BRONZE, hardness: 0.6, tool: 'axe', minTier: 0, stack: 16,
    textures: { side: 'ws_crank_side', top: 'ws_crank_top', bottom: 'ws_shaft_end', sideActive: 'ws_crank_side_on' },
    desc: 'Use it (hold Use to keep turning): it turns every shaft, belt and machine joined to it for a few seconds. One crank drives two machines or a long belt.',
  },
  {
    key: 'drive_shaft', name: 'Drive Shaft', category: 'machine', age: BRONZE, hardness: 0.5, tool: 'axe', minTier: 0, stack: 64,
    opaque: false, translucent: true,
    textures: { side: 'ws_shaft_side', top: 'ws_shaft_end', bottom: 'ws_shaft_end', sideActive: 'ws_shaft_side_on' },
    desc: 'A wooden shaft in a frame. Joins cranks, belts and machines on every side so one source can turn them all.',
  },
  {
    key: 'conveyor_belt', name: 'Conveyor Belt', category: 'machine', age: BRONZE, hardness: 0.4, tool: 'axe', minTier: 0, stack: 64,
    shape: 'slab', oriented: true, opaque: false,
    textures: { top: 'ws_belt_top', topActive: 'ws_belt_top_on', side: 'ws_belt_side', bottom: 'ws_machine_side' },
    desc: 'A leather belt on rollers. While it turns, loose items on it ride the way you faced when you laid it, one block per second at 16 rpm.',
  },
  ...MECH_TWINS.map((t): BlockSpec => ({
    key: t.block, name: t.name, desc: t.desc, category: 'machine', age: BRONZE, hardness: 1.2, tool: 'pickaxe', minTier: 0, stack: 16,
    oriented: true, textures: machineFaces(t.block.slice(5)),
  })),
  ...PART_BLOCKS,
];
