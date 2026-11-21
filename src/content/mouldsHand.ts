/**
 * Casting (docs/EMBER_PLAN.md section 2, docs/api/handwork-content.md section 4): which metals can be poured, and
 * which mould turns which metal into which cast item. One pour uses `units` ingots of the molten stack, so a head costs
 * exactly the metal the instant forge recipe it replaced did (pickaxe 3, axe 3, shovel 1, hoe 2, maul 4).
 */
import type { CastMetalSpec, MouldSpec } from '../core/types';

export const CAST_METAL_SPECS: CastMetalSpec[] = [
  { key: 'copper', ingot: 'copper_ingot', bloom: 'copper_bloom' },
  { key: 'tin', ingot: 'tin_ingot', bloom: 'tin_bloom' },
  { key: 'bronze', ingot: 'bronze_ingot', bloom: 'bronze_bloom' },
];

export const MOULD_SPECS: MouldSpec[] = [
  { item: 'ingot_mould', unfired: 'unfired_ingot_mould', units: 1, casts: { copper: 'copper_ingot', tin: 'tin_ingot', bronze: 'bronze_ingot' } },
  { item: 'pickaxe_mould', unfired: 'unfired_pickaxe_mould', units: 3, casts: { bronze: 'bronze_pickaxe_head' } },
  { item: 'axe_mould', unfired: 'unfired_axe_mould', units: 3, casts: { bronze: 'bronze_axe_head' } },
  { item: 'shovel_mould', unfired: 'unfired_shovel_mould', units: 1, casts: { bronze: 'bronze_shovel_head' } },
  { item: 'hoe_mould', unfired: 'unfired_hoe_mould', units: 2, casts: { bronze: 'bronze_hoe_head' } },
  { item: 'maul_mould', unfired: 'unfired_maul_mould', units: 4, casts: { bronze: 'bronze_maul_head' } },
];
