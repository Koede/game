/**
 * Glassware models (docs/api/glass.md): one hand-built model per piece of glass, in 1/16ths of a cell. Each model is a list of
 * boxes (x0, y0, z0, x1, y1, z1) that make the piece's body: a round flask is stacked boxes that step in and out, a beaker is
 * four hollow walls on a base. Every glass piece also sends a tube arm (TUBE_HALF wide) towards each neighbour that is glass,
 * so any two glass pieces meet with the same port wherever they stand (meshGlass.ts). Pure data: no imports.
 */
export type Box = readonly [number, number, number, number, number, number];

export interface GlassModel {
  /** The body, drawn whatever the neighbours are. */
  readonly body: readonly Box[];
}

/** Half the width of a tube arm (the arm is 2 * TUBE_HALF / 16 wide), centred on the cell. */
export const TUBE_HALF = 2;

const base: Box = [4, 0, 4, 12, 1, 12];

export const GLASS_MODELS: Readonly<Record<string, GlassModel>> = {
  // The chemistry pieces (CHEM in src/core/distill.ts).
  still_base: { body: [[1, 0, 1, 15, 2, 15], [4, 2, 4, 12, 5, 12], [6, 5, 6, 10, 7, 10]] },
  boiling_flask: { body: [[3, 1, 3, 13, 4, 13], [2, 3, 2, 14, 10, 14], [4, 9, 4, 12, 12, 12], [6, 12, 6, 10, 16, 10]] },
  reaction_vessel: { body: [[2, 0, 2, 14, 11, 14], [3, 11, 3, 13, 12, 13], [5, 12, 5, 11, 14, 11]] },
  column_segment: { body: [[5, 0, 5, 11, 16, 11], [4, 2, 4, 12, 3, 12], [4, 6, 4, 12, 7, 12], [4, 10, 4, 12, 11, 12], [4, 14, 4, 12, 15, 12]] },
  condenser_coil: { body: [[1, 1, 2, 5, 3, 6], [4, 3, 5, 8, 5, 9], [7, 5, 8, 11, 7, 12], [10, 7, 11, 14, 9, 15], [12, 9, 12, 14, 11, 14]] },
  cooling_jacket: { body: [[1, 0, 1, 15, 13, 15], [2, 13, 2, 14, 15, 14]] },
  receiver: { body: [[3, 0, 3, 13, 8, 13], [6, 8, 6, 10, 11, 10], [5, 11, 5, 11, 12, 11]] },
  glass_tube: { body: [[6, 6, 6, 10, 10, 10]] },
  airlock_cap: { body: [[4, 12, 4, 12, 16, 12], [7, 9, 7, 9, 12, 9], [6, 8, 6, 10, 9, 10]] },
  chem_port: { body: [[5, 5, 5, 11, 11, 11]] },
  reflux_head: { body: [[4, 10, 4, 12, 13, 12], [3, 13, 3, 13, 14, 13]] },
  filter_bed: { body: [[3, 0, 3, 13, 14, 13], [2, 14, 2, 14, 15, 14]] },
  vacuum_cap: { body: [[5, 12, 5, 11, 16, 11], [3, 10, 3, 13, 12, 13]] },
  // The furnace-top glass (src/content/itemsGlass.ts): a hollow beaker and a thin vial.
  beaker: { body: [base, [3, 0, 3, 13, 10, 4], [3, 0, 12, 13, 10, 13], [3, 0, 4, 4, 10, 12], [12, 0, 4, 13, 10, 12]] },
  vial: { body: [[6, 0, 6, 10, 1, 10], [6, 0, 6, 10, 14, 7], [6, 0, 9, 10, 14, 10], [6, 0, 7, 7, 14, 9], [9, 0, 7, 10, 14, 9]] },
};

/** Block key -> model name. Done twins (`_done`) and the boiling furnace-top forms share their plain piece's model. */
const MODEL_OF_KEY: Readonly<Record<string, string>> = {
  furnace_beaker: 'beaker', furnace_beaker_boiling: 'beaker',
  furnace_vial: 'vial', furnace_vial_boiling: 'vial',
  furnace_sap: 'beaker', furnace_sap_resin: 'beaker',
};

/** The model name for a glass block key, or null when the block is not glassware. */
export function glassModelName(key: string): string | null {
  if (MODEL_OF_KEY[key]) return MODEL_OF_KEY[key];
  const plain = key.endsWith('_done') ? key.slice(0, -'_done'.length) : key;
  return GLASS_MODELS[plain] ? plain : null;
}

/** The model names in a fixed order: a glass block's model index is its position here plus one (0 means none). */
export const GLASS_MODEL_NAMES: readonly string[] = Object.keys(GLASS_MODELS);

/** 1-based index into GLASS_MODEL_NAMES for a block key, 0 when it is not glassware. */
export function glassModelIndex(key: string): number {
  const name = glassModelName(key);
  return name === null ? 0 : GLASS_MODEL_NAMES.indexOf(name) + 1;
}
