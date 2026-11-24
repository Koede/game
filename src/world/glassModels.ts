/**
 * Glassware models (docs/api/glass.md): one hand-built model per piece of glass, in 1/16ths of a cell. Each model is a list of
 * boxes (x0, y0, z0, x1, y1, z1) that make the piece's body: a round flask is layered boxes that step in and out, a beaker is
 * four hollow walls on a base, a condenser is a coil of bars round a rod. Each model also names its `ports`: the faces where it
 * can join another piece. A joint (a tube and a flange ring) appears only on a face where both pieces have a port facing each
 * other (meshGlass.ts), so pieces join where glass really joins and a loose piece stays clean. Pure data: no imports.
 */
export type Box = readonly [number, number, number, number, number, number];

/** Port bits, in Face order: +X, -X, +Y, -Y, +Z, -Z. */
export const PX = 1;
export const NX = 2;
export const PY = 4;
export const NY = 8;
export const PZ = 16;
export const NZ = 32;
const SIDES = PX | NX | PZ | NZ;
const ALL = SIDES | PY | NY;

export interface GlassModel {
  /** The body, drawn whatever the neighbours are. */
  readonly body: readonly Box[];
  /** Faces where this piece joins a neighbour that has a port on the face looking back at it. */
  readonly ports: number;
}

/** Half the width of a joint's tube (the tube is 2 * TUBE_HALF / 16 wide), centred on the cell. */
export const TUBE_HALF = 2;
/** Half the width of the flange ring that marks a joint at the cell face. */
export const FLANGE_HALF = 3;

/** Four hollow walls round (x0, z0)-(x1, z1) from y0 to y1, `t` thick. */
function walls(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, t = 1): Box[] {
  return [[x0, y0, z0, x1, y1, z0 + t], [x0, y0, z1 - t, x1, y1, z1], [x0, y0, z0 + t, x0 + t, y1, z1 - t], [x1 - t, y0, z0 + t, x1, y1, z1 - t]];
}

export const GLASS_MODELS: Readonly<Record<string, GlassModel>> = {
  // The chemistry pieces (CHEM in src/core/distill.ts).
  // A burner plate: flat plate on feet, with a ring the flask stands in.
  still_base: { ports: PY, body: [[1, 0, 1, 15, 2, 15], ...walls(4, 4, 12, 12, 2, 5, 2), [7, 2, 7, 9, 3, 9], [1, 2, 1, 3, 3, 3], [13, 2, 1, 15, 3, 3]] },
  // A round-bottomed flask: a sphere of stepped layers under a long neck and a lipped mouth.
  boiling_flask: {
    ports: ALL,
    body: [[5, 0, 5, 11, 1, 11], [3, 1, 3, 13, 3, 13], [2, 3, 2, 14, 9, 14], [3, 9, 3, 13, 11, 13], [5, 11, 5, 11, 12, 11], [6, 12, 6, 10, 15, 10], [5, 15, 5, 11, 16, 11]],
  },
  // A wide jar with a lid and a knob.
  reaction_vessel: {
    ports: PY | NY | SIDES,
    body: [[2, 0, 2, 14, 1, 14], ...walls(2, 2, 14, 14, 1, 11), [2, 11, 2, 14, 12, 14], [7, 12, 7, 9, 14, 9]],
  },
  // A tall hollow tube with flanges at both ends and packing rings inside.
  column_segment: {
    ports: PY | NY | SIDES,
    body: [...walls(5, 5, 11, 11, 1, 15), [4, 0, 4, 12, 1, 12], [4, 15, 4, 12, 16, 12], [6, 3, 6, 10, 4, 10], [6, 7, 6, 10, 8, 10], [6, 11, 6, 10, 12, 10]],
  },
  // A coil: bars turning round a central rod, climbing.
  condenser_coil: {
    ports: NY | SIDES,
    body: [[7, 0, 7, 9, 16, 9], [3, 2, 3, 13, 3, 5], [11, 4, 3, 13, 5, 13], [3, 6, 11, 13, 7, 13], [3, 8, 3, 5, 9, 13], [3, 10, 3, 13, 11, 5], [11, 12, 3, 13, 13, 13]],
  },
  // A jacket: a thick outer shell round a clear inner tube, with a cap.
  cooling_jacket: {
    ports: ALL,
    body: [...walls(1, 1, 15, 15, 0, 13, 2), [6, 0, 6, 10, 16, 10], [2, 13, 2, 14, 14, 14]],
  },
  // A collecting jar with a shoulder, a neck and a funnel mouth.
  receiver: {
    ports: PY | SIDES,
    body: [[4, 0, 4, 12, 1, 12], [3, 1, 3, 13, 7, 13], [5, 7, 5, 11, 9, 11], [6, 9, 6, 10, 13, 10], [4, 13, 4, 12, 15, 12]],
  },
  // A ball joint: a hub with a collar. The tubes come from its joints.
  glass_tube: { ports: ALL, body: [[6, 6, 6, 10, 10, 10], [5, 7, 5, 11, 9, 11]] },
  // A stopper with an S-bend bubbler: two bulbs on a bent tube.
  airlock_cap: { ports: NY, body: [[4, 0, 4, 12, 3, 12], [7, 3, 7, 9, 12, 9], [5, 4, 5, 11, 7, 11], [5, 9, 5, 11, 12, 11], [6, 12, 6, 10, 13, 10]] },
  // A brass manifold: a block with corner posts, where pipes meet the glass.
  chem_port: { ports: ALL, body: [[4, 4, 4, 12, 12, 12], [3, 3, 3, 5, 13, 5], [11, 3, 3, 13, 13, 5], [3, 3, 11, 5, 13, 13], [11, 3, 11, 13, 13, 13]] },
  // A cap with a valve and a side arm that carries the reflux back.
  reflux_head: { ports: NY | PY, body: [[4, 0, 4, 12, 6, 12], [6, 6, 6, 10, 9, 10], [10, 6, 7, 15, 8, 9], [5, 9, 5, 11, 10, 11]] },
  // A funnel narrowing downwards over a bed of medium.
  filter_bed: { ports: PY | NY, body: [[2, 14, 2, 14, 15, 14], [3, 10, 3, 13, 14, 13], [4, 6, 4, 12, 10, 12], [5, 3, 5, 11, 6, 11], [6, 0, 6, 10, 3, 10]] },
  // A dome with a nipple for the pump.
  vacuum_cap: { ports: NY, body: [[3, 0, 3, 13, 2, 13], [4, 2, 4, 12, 5, 12], [5, 5, 5, 11, 7, 11], [7, 7, 7, 9, 10, 9]] },
  // The furnace-top glass (src/content/itemsGlass.ts): a hollow beaker and a thin vial. They stand alone.
  beaker: { ports: 0, body: [[4, 0, 4, 12, 1, 12], ...walls(3, 3, 13, 13, 0, 10)] },
  vial: { ports: 0, body: [[6, 0, 6, 10, 1, 10], ...walls(6, 6, 10, 10, 0, 14)] },
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

/** The ports of a block key's model (0 when it has none or is not glassware). */
export function glassPorts(key: string): number {
  const name = glassModelName(key);
  return name === null ? 0 : GLASS_MODELS[name].ports;
}
