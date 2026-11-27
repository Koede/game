/**
 * Test fixture: the artificer's attuned tools (src/content/areas/synergy_artificer.ts) and the altar rows that make them,
 * typed in a second time. They exist only through the Infusion Altar, so the progression solver reads them from INFUSIONS.
 */
const metals = ['bronze', 'iron'];
const kinds = ['pickaxe', 'axe', 'shovel'];
const aspects = ['rune', 'gale'];

export const SYNERGY_ARTIFICER_SPEC = {
  items: metals.flatMap((m) => kinds.flatMap((k) => aspects.map((a) => `${a}_${m}_${k}`))),
  /** Altar infusions (recipesMagic.ts INFUSIONS): the plain tool at the heart, two vials of the aspect around it. */
  infusions: metals.flatMap((m) => kinds.flatMap((k) => aspects.map((a) => ({ id: `${a}_${m}_${k}`, center: `${m}_${k}`, around: [`vial_${a}`, `vial_${a}`] })))),
  textures: 12,
};
