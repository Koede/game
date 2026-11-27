/**
 * Swords and spears you can forge (the ToolKinds exist for the found legendaries; these are the ordinary ones). A sword hits harder
 * than a maul of the same metal; a spear hits like a maul but its shaft is long and lasts. Neither mines: no block names them.
 * Bronze at the Bronze Furnace, iron and steel with the hearth, like the mauls.
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

const METALS = [
  { m: 'bronze', name: 'Bronze', tier: 2, sword: 6, spear: 5, dur: 192, ingot: 'bronze_ingot', furnace: 2, temp: 900, age: 1 },
  { m: 'iron', name: 'Iron', tier: 3, sword: 8, spear: 7, dur: 384, ingot: 'iron_ingot', furnace: 3, temp: 1100, age: 2 },
  { m: 'steel', name: 'Steel', tier: 4, sword: 10, spear: 9, dur: 768, ingot: 'steel_ingot', furnace: 3, temp: 1400, age: 2 },
] as const;

export default {
  items: METALS.flatMap((s) => [
    {
      key: `${s.m}_sword`, name: `${s.name} Sword`, icon: `item_${s.m}_sword`, category: 'tool' as const, age: s.age,
      desc: `A straight ${s.name.toLowerCase()} blade on a wooden grip. Quick to swing and harder-hitting than a maul; it cannot mine.`,
      tool: { kind: 'sword' as const, tier: s.tier, speed: 1, durability: s.dur }, weapon: { damage: s.sword },
    },
    {
      key: `${s.m}_spear`, name: `${s.name} Spear`, icon: `item_${s.m}_spear`, category: 'tool' as const, age: s.age,
      desc: `A ${s.name.toLowerCase()} point on a long ash shaft. Hits like a maul and wears slowly; it cannot mine.`,
      tool: { kind: 'spear' as const, tier: s.tier, speed: 1, durability: Math.round(s.dur * 1.25) }, weapon: { damage: s.spear },
    },
  ]),
  recipes: METALS.flatMap((s) => [
    { id: `${s.m}_sword`, station: 'furnace' as const, kind: 'forge' as const, inputs: amounts(`3 ${s.ingot}, 1 stick`), output: amount(`${s.m}_sword`), minTempC: s.temp, minTier: s.furnace, age: s.age },
    { id: `${s.m}_spear`, station: 'furnace' as const, kind: 'forge' as const, inputs: amounts(`2 ${s.ingot}, 2 stick`), output: amount(`${s.m}_spear`), minTempC: s.temp, minTier: s.furnace, age: s.age },
  ]),
} satisfies AreaContent;
