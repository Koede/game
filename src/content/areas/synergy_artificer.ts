/**
 * Artificer's attunement (docs/SYNERGY_PLAN.md section 2): the Infusion Altar tempers a bronze or iron tool with an aspect.
 * Rune-tempered tools last three times as long; Gale-edged tools cut half as fast again. They are made at the altar from the
 * plain tool (src/content/recipesMagic.ts INFUSIONS, gated by research 'attunement' and 'master_attunement'). Numbers below are
 * the base tool's, scaled; `synergyArtificer.test.ts` keeps them honest. Data only.
 */
import type { AreaContent } from '../area';
import type { ItemSpec, ToolKind } from '../../core/types';

const BASE = {
  bronze: { name: 'Bronze', tier: 2, speed: 3, durability: 192, age: 1 },
  iron: { name: 'Iron', tier: 3, speed: 4.5, durability: 384, age: 2 },
} as const;
const KINDS: Array<{ kind: Extract<ToolKind, 'pickaxe' | 'axe' | 'shovel'>; name: string }> = [
  { kind: 'pickaxe', name: 'Pickaxe' }, { kind: 'axe', name: 'Axe' }, { kind: 'shovel', name: 'Shovel' },
];
const ATTUNEMENTS = {
  rune: { adjective: 'Rune-Tempered', speed: 1, durability: 3, text: 'Runes folded into the metal at the altar: it keeps its edge three times as long.' },
  gale: { adjective: 'Gale-Edged', speed: 1.5, durability: 1, text: 'Gale drawn into the edge at the altar: it cuts half as fast again.' },
} as const;

const items: ItemSpec[] = [];
for (const [material, b] of Object.entries(BASE)) {
  for (const k of KINDS) {
    for (const [aspect, a] of Object.entries(ATTUNEMENTS)) {
      items.push({
        key: `${aspect}_${material}_${k.kind}`, name: `${a.adjective} ${b.name} ${k.name}`, category: 'tool', age: b.age, stack: 1,
        desc: `A ${b.name.toLowerCase()} ${k.name.toLowerCase()} tempered at an Infusion Altar. ${a.text}`,
        tool: { kind: k.kind, tier: b.tier, speed: b.speed * a.speed, durability: b.durability * a.durability },
      });
    }
  }
}

export default { items } satisfies AreaContent;
