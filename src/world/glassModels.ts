/**
 * Glassware models (docs/api/glass.md): one hand-built model per piece of glass, in 1/16ths of a cell. A model is clear glass
 * boxes (`body`), brass boxes (`metal`: plates, flanges, clamps, stoppers) and, on the pieces whose work has steps, a small status
 * lamp (`lamp`) that shows the block's own lamp colour (idle, working, done, blocked). Each model also names its `ports`: the
 * faces where it can join another piece. A joint (a glass tube and a brass flange ring) appears only on a face where both pieces
 * have a port facing each other and belong to one family (meshGlass.ts), so pieces join where glass really joins and a loose
 * piece stays clean.
 * Pure data: no imports.
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
  /** Clear glass, drawn whatever the neighbours are. */
  readonly body: readonly Box[];
  /** Brass parts. */
  readonly metal?: readonly Box[];
  /** The status lamp, drawn with the block's own lamp. */
  readonly lamp?: Box;
  /** Faces where this piece joins a neighbour that has a port on the face looking back at it. */
  readonly ports: number;
  /** Pieces join only within one family: the distillery's glass and the essentia line never share a joint. Default `chem`. */
  readonly family?: 'chem' | 'essentia';
}

/** Family numbers for the mesher's tables (0: not glassware). */
export const FAMILY_CODE: Readonly<Record<'chem' | 'essentia', number>> = { chem: 1, essentia: 2 };

/** Half the width of a joint's tube (the tube is 2 * TUBE_HALF / 16 wide), centred on the cell. */
export const TUBE_HALF = 2;
/** Half the width of the brass flange ring that marks a joint at the cell face. */
export const FLANGE_HALF = 3;

/** Four walls round (x0, z0)-(x1, z1) from y0 to y1, `t` thick: a hollow vessel. */
function walls(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, t = 1): Box[] {
  return [[x0, y0, z0, x1, y1, z0 + t], [x0, y0, z1 - t, x1, y1, z1], [x0, y0, z0 + t, x0 + t, y1, z1 - t], [x1 - t, y0, z0 + t, x1, y1, z1 - t]];
}

export const GLASS_MODELS: Readonly<Record<string, GlassModel>> = {
  // The chemistry pieces (CHEM in src/core/distill.ts).
  // A burner plate: a brass plate on four feet, with a ring the flask stands in and a lamp on the rim.
  still_base: {
    ports: PY,
    body: [[6, 2, 6, 10, 3, 10]],
    metal: [[1, 1, 1, 15, 2, 15], [1, 0, 1, 3, 1, 3], [13, 0, 1, 15, 1, 3], [1, 0, 13, 3, 1, 15], [13, 0, 13, 15, 1, 15], ...walls(4, 4, 12, 12, 2, 4)],
    lamp: [12, 2, 2, 14, 4, 4],
  },
  // A round-bottomed flask: a hollow sphere of stepped layers, a long neck held by a brass clamp, and a lipped mouth.
  boiling_flask: {
    ports: ALL,
    body: [[5, 0, 5, 11, 1, 11], ...walls(3, 3, 13, 13, 1, 3), ...walls(2, 2, 14, 14, 3, 9), ...walls(3, 3, 13, 13, 9, 11), [5, 11, 5, 11, 12, 11], ...walls(6, 6, 10, 10, 12, 15), [5, 15, 5, 11, 16, 11]],
    metal: [[5, 13, 5, 11, 14, 11]],
    lamp: [11, 12, 7, 13, 14, 9],
  },
  // A wide hollow jar under a brass lid with a knob.
  reaction_vessel: {
    ports: PY | NY | SIDES,
    body: [[2, 0, 2, 14, 1, 14], ...walls(2, 2, 14, 14, 1, 11)],
    metal: [[2, 11, 2, 14, 12, 14], [7, 12, 7, 9, 14, 9]],
    lamp: [11, 12, 6, 13, 14, 8],
  },
  // A tall hollow tube between brass flanges, with packing rings inside.
  column_segment: {
    ports: PY | NY | SIDES,
    body: [...walls(5, 5, 11, 11, 1, 15), [6, 4, 6, 10, 5, 10], [6, 8, 6, 10, 9, 10], [6, 12, 6, 10, 13, 10]],
    metal: [[4, 0, 4, 12, 1, 12], [4, 15, 4, 12, 16, 12]],
  },
  // A coil: glass bars turning round a central glass rod, climbing, between brass end caps.
  condenser_coil: {
    ports: NY | SIDES,
    body: [[7, 1, 7, 9, 15, 9], [3, 2, 3, 13, 3, 5], [11, 4, 3, 13, 5, 13], [3, 6, 11, 13, 7, 13], [3, 8, 3, 5, 9, 13], [3, 10, 3, 13, 11, 5], [11, 12, 3, 13, 13, 13]],
    metal: [[6, 0, 6, 10, 1, 10], [6, 15, 6, 10, 16, 10]],
  },
  // A jacket: a hollow outer shell round a clear inner tube, held by brass bands under a brass cap.
  cooling_jacket: {
    ports: ALL,
    body: [...walls(1, 1, 15, 15, 0, 13), [6, 0, 6, 10, 16, 10]],
    metal: [...walls(1, 1, 15, 15, 3, 4), ...walls(1, 1, 15, 15, 9, 10), [2, 13, 2, 14, 14, 14]],
  },
  // A collecting jar on a brass foot, with a shoulder, a neck and a funnel mouth.
  receiver: {
    ports: PY | SIDES,
    body: [...walls(3, 3, 13, 13, 1, 7), [5, 7, 5, 11, 9, 11], [6, 9, 6, 10, 13, 10], ...walls(4, 4, 12, 12, 13, 15)],
    metal: [[3, 0, 3, 13, 1, 13]],
    lamp: [13, 0, 7, 15, 2, 9],
  },
  // A ball joint: a glass hub with a brass collar. The tubes come from its joints.
  glass_tube: { ports: ALL, body: [[6, 6, 6, 10, 10, 10]], metal: [[5, 7, 5, 11, 9, 11]] },
  // A brass stopper with an S-bend bubbler: two bulbs on a bent glass tube.
  airlock_cap: { ports: NY, body: [[7, 3, 7, 9, 12, 9], [5, 4, 5, 11, 7, 11], [5, 9, 5, 11, 12, 11], [6, 12, 6, 10, 13, 10]], metal: [[4, 0, 4, 12, 3, 12]] },
  // A brass manifold with a glass sight window: where pipes meet the glass.
  chem_port: { ports: ALL, body: [[5, 12, 5, 11, 13, 11]], metal: [[4, 4, 4, 12, 12, 12], [3, 3, 3, 5, 13, 5], [11, 3, 3, 13, 13, 5], [3, 3, 11, 5, 13, 13], [11, 3, 11, 13, 13, 13]] },
  // A glass head with a brass valve and a side arm that carries the reflux back.
  reflux_head: { ports: NY | PY, body: [...walls(4, 4, 12, 12, 0, 6), [10, 6, 7, 15, 8, 9]], metal: [[6, 6, 6, 10, 9, 10], [5, 9, 5, 11, 10, 11]] },
  // A glass funnel narrowing downwards under a brass rim, with a lamp.
  filter_bed: {
    ports: PY | NY,
    body: [...walls(3, 3, 13, 13, 10, 14), ...walls(4, 4, 12, 12, 6, 10), [5, 3, 5, 11, 6, 11], [6, 0, 6, 10, 3, 10]],
    metal: [...walls(2, 2, 14, 14, 14, 15)],
    lamp: [13, 12, 7, 15, 14, 9],
  },
  // A glass dome on a brass base, with a brass nipple for the pump.
  vacuum_cap: { ports: NY, body: [[4, 2, 4, 12, 5, 12], [5, 5, 5, 11, 7, 11]], metal: [[3, 0, 3, 13, 2, 13], [7, 7, 7, 9, 10, 9]] },
  // A separatory funnel: a pear-shaped bulb tapering to a brass tap over a thin stem, a stopper on top.
  separatory_funnel: {
    ports: PY | NY,
    body: [[7, 0, 7, 9, 4, 9], ...walls(6, 6, 10, 10, 5, 7), ...walls(4, 4, 12, 12, 7, 10), ...walls(3, 3, 13, 13, 10, 13), [6, 13, 6, 10, 15, 10]],
    metal: [[5, 4, 7, 11, 5, 9], [10, 4, 7, 12, 6, 8], [5, 15, 5, 11, 16, 11]],
    lamp: [13, 11, 7, 15, 13, 9],
  },
  // Essentia (src/content/itemsMagic.ts): a stoppered jar, its folded void twin, and the tube that joins them.
  essentia_jar: {
    family: 'essentia', ports: SIDES | PY | NY,
    body: [[3, 0, 3, 13, 1, 13], ...walls(3, 3, 13, 13, 1, 11), ...walls(5, 5, 11, 11, 11, 12)],
    metal: [[5, 12, 5, 11, 14, 11], [7, 14, 7, 9, 15, 9]],
  },
  void_jar: {
    family: 'essentia', ports: SIDES | PY | NY,
    body: [[3, 0, 3, 13, 1, 13], ...walls(3, 3, 13, 13, 1, 11), ...walls(5, 5, 11, 11, 11, 12)],
    metal: [...walls(3, 3, 13, 13, 4, 5), ...walls(3, 3, 13, 13, 8, 9), [5, 12, 5, 11, 14, 11], [6, 14, 6, 10, 15, 10]],
  },
  essentia_tube: { family: 'essentia', ports: ALL, body: [[6, 6, 6, 10, 10, 10]], metal: [[6, 7, 5, 10, 9, 11], [5, 7, 6, 11, 9, 10]] },
  // The furnace-top glass (src/content/itemsGlass.ts): a hollow beaker with a pouring lip and a thin vial. They stand alone.
  beaker: { ports: 0, body: [[4, 0, 4, 12, 1, 12], ...walls(3, 3, 13, 13, 0, 10), [6, 10, 2, 10, 11, 3]] },
  vial: { ports: 0, body: [[6, 0, 6, 10, 1, 10], ...walls(6, 6, 10, 10, 0, 14), [5, 14, 5, 11, 15, 11]] },
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

/** The family code of a block key's model (0 when it is not glassware). */
export function glassFamily(key: string): number {
  const name = glassModelName(key);
  return name === null ? 0 : FAMILY_CODE[GLASS_MODELS[name].family ?? 'chem'];
}

/** The ports of a block key's model (0 when it has none or is not glassware). */
export function glassPorts(key: string): number {
  const name = glassModelName(key);
  return name === null ? 0 : GLASS_MODELS[name].ports;
}
