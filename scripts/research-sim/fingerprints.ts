/** Prints the aspect fingerprints of the research simulator's specimen shelf (real game data) as JSON. */
import { itemOrNull, blockOrNull } from '../../src/core/registry';
import { aspectsOf } from '../../src/magic/fingerprint';

const SHELF = [
  'oak_log', 'plank', 'stone', 'dirt', 'sand', 'clay', 'copper_ore', 'tin_ore', 'iron_ore', 'coal_ore', 'glass',
  'workbench', 'furnace_clay', 'charcoal', 'fiber', 'flint', 'stick', 'water_vial', 'bronze_ingot', 'copper_ingot',
  'leaves', 'grass', 'gravel', 'torch', 'bread', 'wool', 'hide', 'bone', 'feather', 'apple', 'berries', 'mushroom',
];
const out: { key: string; name: string; aspects: Record<string, number> }[] = [];
for (const key of SHELF) {
  const def = itemOrNull(key) ?? blockOrNull(key);
  if (!def) continue;
  const aspects = aspectsOf(key) as Record<string, number>;
  if (Object.keys(aspects).length) out.push({ key, name: def.name, aspects });
}
console.log(JSON.stringify(out));
