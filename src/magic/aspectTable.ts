/**
 * The one data table behind every fingerprint (docs/OVERHAUL_PLAN.md B.2). Raw objects are scored by the words in their
 * key; crafted objects are derived from their recipe (fingerprint.ts); OVERRIDES win over both. Edit numbers here only.
 */
import type { Aspects } from './aspects';

/** Words of a key (split on '_') -> aspects added. */
export const KEYWORD_RULES: Record<string, Aspects> = {
  ore: { vein: 3, loam: 1 }, ingot: { vein: 2, craft: 1 }, plate: { vein: 2, craft: 1 }, wire: { vein: 1, drive: 1 },
  copper: { vein: 2, cinder: 1 }, tin: { vein: 2, frost: 1 }, bronze: { vein: 3, craft: 1 }, iron: { vein: 3, ward: 1 },
  steel: { vein: 4, ward: 2 }, aluminum: { vein: 3, gale: 1 }, tungsten: { vein: 3, cinder: 2 }, scrap: { vein: 2, rift: 2 },
  stone: { loam: 3 }, rubble: { loam: 2, rift: 1 }, gravel: { loam: 2, rift: 1 }, sand: { loam: 2, gale: 1 }, dirt: { loam: 2, spring: 1 },
  clay: { loam: 2, brook: 1 }, brick: { loam: 2, cinder: 1 }, firebrick: { loam: 2, cinder: 2 }, concrete: { loam: 3, rune: 1 },
  basalt: { loam: 3, cinder: 1 }, limestone: { loam: 3, brook: 1 }, corestone: { loam: 4, rune: 2 }, farmland: { loam: 2, spring: 2 },
  log: { spring: 2, craft: 1 }, plank: { spring: 1, craft: 2 }, stick: { spring: 1, craft: 1 }, leaves: { spring: 2, gale: 1 },
  grass: { spring: 2 }, shrub: { spring: 1, wane: 1 }, fiber: { spring: 1, gale: 1 }, cord: { spring: 1, craft: 1 }, cloth: { spring: 1, craft: 1 },
  leather: { spring: 1, ward: 1 }, hide: { spring: 2, ward: 1 }, wheat: { spring: 2 }, potato: { spring: 2, loam: 1 }, carrot: { spring: 2 },
  bread: { spring: 3, craft: 1 }, flour: { spring: 1, loam: 1 }, dough: { spring: 2, brook: 1 }, sugar: { spring: 2, glow: 1 },
  tea: { spring: 2, steam: 1 }, coffee: { spring: 2, drive: 1 }, berry: { spring: 2 }, raw: { spring: 2, wane: 1 }, cooked: { spring: 3, cinder: 1 },
  seeds: { spring: 2 }, seed: { spring: 2 }, sapling: { spring: 3 }, mushroom: { spring: 1, wane: 1 },
  water: { brook: 4 }, ice: { frost: 3, brook: 1 }, snow: { frost: 2, brook: 1 }, lava: { cinder: 5, rift: 1 }, oil: { wane: 2, cinder: 2 },
  coal: { cinder: 3, loam: 1 }, charcoal: { cinder: 3, spring: 1 }, coke: { cinder: 4, loam: 1 }, sulfur: { cinder: 3, rift: 1 },
  flint: { loam: 2, rift: 1 }, glass: { clarity: 3, cinder: 1 }, quartz: { clarity: 3, vein: 1 }, silica: { clarity: 2, loam: 1 },
  torch: { glow: 2, cinder: 1 }, lamp: { glow: 3, clarity: 1 }, glowcap: { glow: 3, spring: 1 }, crystal: { vein: 2, clarity: 2 },
  furnace: { cinder: 4, craft: 2 }, bellows: { gale: 3, craft: 1 }, kettle: { steam: 3, craft: 1 }, boiler: { steam: 4, ward: 1 },
  pipe: { brook: 1, craft: 1 }, pump: { drive: 2, brook: 2 }, axle: { drive: 2, craft: 1 }, cog: { drive: 2, craft: 2 }, gear: { drive: 2, craft: 2 },
  wheel: { drive: 2, spring: 1 }, windmill: { gale: 3, drive: 2 }, wind: { gale: 3 }, turbine: { drive: 3, steam: 2 }, engine: { drive: 3, cinder: 2 },
  battery: { spark: 3, vein: 1 }, cable: { spark: 2, vein: 1 }, circuit: { spark: 3, mind: 1 }, coil: { spark: 2, vein: 2 },
  solar: { glow: 3, spark: 1 }, magnet: { drive: 2, vein: 2 }, fission: { spark: 4, ash: 3 }, pitchblende: { vein: 2, ash: 2 },
  pickaxe: { craft: 2, rift: 1 }, axe: { craft: 2, rift: 1 }, shovel: { craft: 2, loam: 1 }, hoe: { craft: 2, spring: 1 }, wrench: { craft: 2, drive: 1 },
  bucket: { craft: 1, brook: 1 }, pail: { craft: 1, brook: 1 }, crate: { craft: 1, ward: 1 }, workbench: { craft: 3, rune: 1 },
  coat: { ward: 2, spring: 1 }, shield: { ward: 3, rune: 1 }, suit: { ward: 3 },
  beaker: { clarity: 2, craft: 1 }, vial: { clarity: 2, craft: 1 }, still: { steam: 2, clarity: 2, craft: 1 },
  gasoline: { cinder: 3, drive: 2 }, diesel: { cinder: 3, drive: 2 }, ethanol: { cinder: 2, spring: 1, clarity: 1 }, resin: { spring: 1, ward: 1 },
  sap: { spring: 2, brook: 1 }, salt: { clarity: 2, loam: 1 }, bone: { wane: 2, ward: 1 }, feather: { gale: 2, spring: 1 }, wool: { spring: 1, ward: 1 },
  egg: { spring: 3 }, milk: { spring: 2, brook: 1 }, meat: { spring: 2 }, fowl: { spring: 2, gale: 1 }, chop: { spring: 2 }, mutton: { spring: 2 },
  ruin: { ash: 2, rune: 1 }, ember: { cinder: 2, ash: 1 }, mould: { craft: 2, loam: 1 }, anvil: { craft: 3, vein: 2 }, quern: { craft: 2, loam: 2 },
  loom: { craft: 2, spring: 1 }, mortar: { craft: 2, loam: 2 }, hammer: { craft: 2, drive: 1 }, chassis: { craft: 2, vein: 2 },
};

/** Added once to a raw object by its item category (block items use 'block'). */
export const CATEGORY_BASE: Record<string, Aspects> = {
  block: { loam: 1 }, resource: { loam: 1 }, material: { craft: 1 }, component: { craft: 1, drive: 1 },
  tool: { craft: 2 }, machine: { craft: 2, drive: 1 }, fuel: { cinder: 2 }, misc: { rune: 1 }, food: { spring: 2 },
};

/** Item age added to the object's strongest aspect (a later age is a denser object). */
export const AGE_BONUS_PER_AGE = 1;
export const MAX_ASPECTS = 4;
export const MAX_AMOUNT = 8;

/** Hand-authored fingerprints that beat every rule. Keep short: only things the rules get wrong or special objects. */
export const OVERRIDES: Record<string, Aspects> = {
  air: { gale: 1 }, stone: { loam: 4 }, water: { brook: 5 }, lava: { cinder: 6, rift: 2 },
  furnace_clay: { cinder: 4, loam: 2, craft: 2 }, furnace_bronze: { cinder: 5, vein: 1, craft: 2 }, furnace_blast: { cinder: 6, vein: 2, craft: 2 }, furnace_arc: { spark: 4, cinder: 4, craft: 2 },
  furnace_plasma: { spark: 4, glow: 4, soul: 1 }, furnace_star: { glow: 8, cinder: 6, void: 2 },
  star_core: { glow: 8, void: 3, mind: 2 }, corium: { ash: 6, spark: 3 }, superalloy: { vein: 8, ward: 4, rune: 2 },
  stick: { spring: 1, craft: 1 }, flint: { loam: 2, rift: 1 }, fiber: { spring: 1, gale: 1 }, tall_grass: { spring: 2, gale: 1 },
  glass: { clarity: 3, cinder: 1 }, sulfur_ore: { cinder: 3, vein: 2, rift: 1 }, quartz_ore: { clarity: 3, vein: 2 },
  field_notebook: { mind: 2, craft: 1, spring: 1 }, glass_vial: { clarity: 2, craft: 1 }, essentia_vial: { clarity: 2, mind: 1 },
  vis_rod: { mind: 2, gale: 2, craft: 1 }, essentia_jar: { clarity: 3, ward: 1, mind: 1 },
};
