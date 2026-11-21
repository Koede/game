/**
 * Items of the Ember handwork (docs/api/handwork-content.md section 7): hammers, cast heads, blooms, plates, hide goods
 * and the clay pieces before and after firing. The ten station blocks' items are generated from blocksHand.ts.
 */
import { MOULD_POURS } from '../core/constants';
import type { ItemSpec } from '../core/types';

const hammer = (material: string, name: string, tier: number, durability: number, desc: string): ItemSpec => ({
  key: `${material}_hammer`, name: `${name} Hammer`, desc, category: 'tool', age: 0, tool: { kind: 'hammer', tier, speed: 1, durability },
});

const head = (kind: string, name: string, desc: string): ItemSpec => ({
  key: `bronze_${kind}_head`, name: `Bronze ${name} Head`, desc, category: 'component', age: 0,
});

const bloom = (metal: string, name: string, tempC: number): ItemSpec => ({
  key: `${metal}_bloom`, name: `${name} Bloom`, category: 'material', age: 0,
  desc: `Metal that cooled in the crucible instead of the mould: a rough lump. Smelt it again at ${tempC} C and pour it in time.`,
});

const unfired = (key: string, name: string, desc: string): ItemSpec => ({ key: `unfired_${key}`, name: `Unfired ${name}`, desc, category: 'material', age: 0, stack: 16 });

const mould = (kind: string, name: string, desc: string): ItemSpec => ({
  key: `${kind}_mould`, name: `${name} Mould`, desc, category: 'component', age: 0, stack: 1, mould: { pours: MOULD_POURS },
});

export const HAND_ITEMS: ItemSpec[] = [
  hammer('flint', 'Flint', 1, 120, 'A flint head lashed to a stick. Held at the Stone Anvil it makes every stroke count double.'),
  hammer('bronze', 'Bronze', 2, 400, 'A bronze head on a short haft. It doubles strokes at the Stone Anvil and lasts three times as long as flint.'),
  head('pickaxe', 'Pickaxe', 'A cast bronze pickaxe head. Bind it to two sticks with cord at the workbench.'),
  head('axe', 'Axe', 'A cast bronze axe head. Bind it to two sticks with cord at the workbench.'),
  head('shovel', 'Shovel', 'A cast bronze shovel head. Bind it to two sticks with cord at the workbench.'),
  head('hoe', 'Hoe', 'A cast bronze hoe head. Bind it to two sticks with cord at the workbench.'),
  head('maul', 'Maul', 'A cast bronze maul head, heavy as a fist of rock. Bind it to two sticks with cord at the workbench.'),
  bloom('copper', 'Copper', 700),
  bloom('tin', 'Tin', 250),
  bloom('bronze', 'Bronze', 800),
  {
    key: 'copper_plate', name: 'Copper Plate', category: 'material', age: 0,
    desc: 'Two copper ingots beaten flat on the Stone Anvil.',
  },
  {
    key: 'bronze_plate', name: 'Bronze Plate', category: 'material', age: 0,
    desc: 'Two bronze ingots beaten flat. Furnace upgrades ask for it.',
  },
  { key: 'soaked_hide', name: 'Soaked Hide', category: 'material', age: 0, desc: 'A hide left in the tanning trough for a minute. Hang it on a drying rack in the sun to make leather.' },
  { key: 'leather', name: 'Leather', category: 'material', age: 0, desc: 'Hide, tanned and dried hard but supple. It lines bellows, coats and furnace seals.' },
  { key: 'cloth', name: 'Cloth', category: 'material', age: 0, desc: 'Fiber woven on the loom. A padded coat is stuffed with it.' },
  unfired('cup', 'Cup', 'Wet clay in the shape of a cup. Fire it in a furnace crucible at 400 C or hotter.'),
  unfired('cone', 'Drip Cone', 'A wet clay cone. Fire it in a crucible.'),
  unfired('alloy_pot', 'Alloy Pot', 'A wet clay pot with a spout. Fire it in a crucible, then set it against a furnace.'),
  unfired('ingot_mould', 'Ingot Mould', 'A slab of wet clay with a bar-shaped hollow. Fire it before you pour into it.'),
  unfired('pickaxe_mould', 'Pickaxe Mould', 'Wet clay with a pickaxe head pressed into it. Fire it before you pour.'),
  unfired('axe_mould', 'Axe Mould', 'Wet clay with an axe head pressed into it. Fire it before you pour.'),
  unfired('shovel_mould', 'Shovel Mould', 'Wet clay with a shovel blade pressed into it. Fire it before you pour.'),
  unfired('hoe_mould', 'Hoe Mould', 'Wet clay with a hoe blade pressed into it. Fire it before you pour.'),
  unfired('maul_mould', 'Maul Mould', 'Wet clay with a maul head pressed into it. Fire it before you pour.'),
  mould('ingot', 'Ingot', 'Fired clay. Hold it and take molten metal from a crucible within 20 seconds: copper, tin or bronze set as an ingot. Lasts 40 pours.'),
  mould('pickaxe', 'Pickaxe', 'Fired clay. Pour molten bronze into it for a pickaxe head (3 ingots a pour). Lasts 40 pours.'),
  mould('axe', 'Axe', 'Fired clay. Pour molten bronze into it for an axe head (3 ingots a pour). Lasts 40 pours.'),
  mould('shovel', 'Shovel', 'Fired clay. Pour molten bronze into it for a shovel head (1 ingot a pour). Lasts 40 pours.'),
  mould('hoe', 'Hoe', 'Fired clay. Pour molten bronze into it for a hoe head (2 ingots a pour). Lasts 40 pours.'),
  mould('maul', 'Maul', 'Fired clay. Pour molten bronze into it for a maul head (4 ingots a pour). Lasts 40 pours.'),
];
