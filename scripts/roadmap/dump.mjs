import { importSource } from '../lib/bundle.mjs';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));

const m = await importSource(`
import { BLOCKS, ITEMS, RECIPES, MACHINES, AGES, FURNACE_TIERS } from 'src/core/registry';
import { OBJECTIVES } from 'src/content/objectives';
import { RESEARCH } from 'src/magic/entries';
import { ASPECTS } from 'src/magic/aspects';
export { BLOCKS, ITEMS, RECIPES, MACHINES, AGES, FURNACE_TIERS, OBJECTIVES, RESEARCH, ASPECTS };
`);

const pick = (o, ks) => Object.fromEntries(ks.filter((k) => o[k] !== undefined && o[k] !== null).map((k) => [k, o[k]]));
const out = {
  ages: m.AGES.map((a) => pick(a, ['key', 'name', 'blurb', 'tagline', 'index', 'age'])),
  tiers: m.FURNACE_TIERS.map((t) => pick(t, ['tier', 'name', 'age', 'maxTempC', 'crucibles', 'blurb'])),
  blocks: m.BLOCKS.filter((b) => b.key !== 'air').map((b) => ({ ...pick(b, ['key', 'name', 'desc', 'age', 'shape', 'machine', 'tool', 'hardness', 'handStation']), hs: !!b.handStation })),
  items: m.ITEMS.map((i) => ({ ...pick(i, ['key', 'name', 'desc', 'category', 'age', 'stack', 'wear']), food: i.food ? 1 : 0, fuel: i.fuel ? 1 : 0, tool: i.tool ? i.tool.kind : null })),
  recipes: m.RECIPES.map((r) => ({ id: r.id, station: r.station, kind: r.kind, age: r.age, tier: r.minTier, t: r.minTempC, out: r.output.item, n: r.output.count, in: r.inputs.map((x) => x.item + (x.count > 1 ? ' x' + x.count : '')) })),
  machines: [...m.MACHINES.values()].map((x) => ({ ...pick(x, ['kind', 'name', 'role', 'age']), blocks: x.blocks })),
  objectives: m.OBJECTIVES.map((o, i) => ({ i, ...pick(o, ['id', 'age', 'title', 'text']) })),
  research: m.RESEARCH.map((e) => pick(e, ['key', 'title', 'age', 'requires', 'lore'])),
  aspects: Object.values(m.ASPECTS).map((a) => pick(a, ['name', 'tier', 'parts', 'meaning'])),
};
writeFileSync(join(HERE, 'dump.json'), JSON.stringify(out));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
console.log('sample item', JSON.stringify(out.items[40]));
console.log('sample block', JSON.stringify(out.blocks[40]));
console.log('sample objective', JSON.stringify(out.objectives[0]));
console.log('ages', JSON.stringify(out.ages).slice(0, 400));
