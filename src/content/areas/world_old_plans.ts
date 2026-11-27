/** Old plans (src/content/oldPlans.ts, docs/api/old-plans.md): loot items found in ruin crates. Use one to read it. Optional. */
import type { AreaContent } from '../area';
import { OLD_PLANS } from '../oldPlans';

export default {
  items: OLD_PLANS.map((p) => ({
    key: p.item, name: p.title, category: 'misc' as const, age: p.tier === 'near' ? 0 : 1, stack: 1,
    desc: `An Old Works drawing of ${p.title.replace(/^Plan of /, '').toLowerCase()}. Use it to read it and keep the plan as a blueprint.`,
  })),
} satisfies AreaContent;
