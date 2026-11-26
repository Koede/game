import { OLD_PLANS } from './oldPlans';
/** Test fixture: the old plans (src/content/oldPlans.ts) are loot-only items with one icon each. */
export const OLD_PLANS_SPEC = { textures: OLD_PLANS.length, icons: OLD_PLANS.length, worldOnly: OLD_PLANS.map((p) => p.item) };
