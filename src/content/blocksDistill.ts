/**
 * Blocks of the glass distillery (docs/DISTILLERY_PLAN.md 2). Appended after every older block, so saved voxel ids
 * never move. Each module is a brass-framed glass case (translucent cube); the glassware and the liquid inside are
 * drawn by src/render/distill. Where a block stands says what it does (plan 3): nothing is configured.
 *
 * Step completion is shown on the block itself (plan 2.1): flask, vessel and receiver have a `_done` twin, and with the
 * voxel's active bit that makes four lamp states - idle (dark), working (amber), done (green), blocked (red). The sim
 * swaps the blocks; a `_done` block is no item and drops its plain twin.
 */
import { ASPHALT_BLOCK, CHEM, DONE_SUFFIX, ROAD_SPEED, STATEFUL, type ChemKind } from '../core/distill';
import type { BlockSpec } from '../core/types';

interface Look {
  name: string;
  desc: string;
  age: number;
  /** Light while working (active bit on the plain block). */
  glow?: number;
}

const LOOKS: Record<ChemKind, Look> = {
  still_base: {
    name: 'Still Base', age: 0, glow: 6,
    desc: 'A copper burner plate. Set it on a furnace and a flask on it; tap it to choose the temperature it holds the flask at.',
  },
  boiling_flask: {
    name: 'Boiling Flask', age: 0, glow: 3,
    desc: 'A big round-bottomed flask. On a Still Base it boils what you pour in; the vapour rises into a condenser or a column on top.',
  },
  reaction_vessel: {
    name: 'Reaction Vessel', age: 0,
    desc: 'A wide glass jar. Capped with an Airlock it ferments syrup and water into wash; it lets its liquid go once the work is done.',
  },
  column_segment: {
    name: 'Column Segment', age: 2,
    desc: 'A glass column packed with rings. Stack them on a flask: every segment sharpens the cut, and a condenser beside one draws a cut there.',
  },
  condenser_coil: {
    name: 'Condenser Coil', age: 0,
    desc: 'A glass coil that turns vapour back into liquid. On top of a flask or column it takes the head; beside a column segment, a side cut.',
  },
  cooling_jacket: {
    name: 'Cooling Jacket', age: 2,
    desc: 'A water jacket. Filled with a bucket of water, it makes every condenser it touches three times faster and the column head colder.',
  },
  receiver: {
    name: 'Receiver', age: 0,
    desc: 'A collecting jar. Liquid drips into it from a condenser or tube; take it out with an empty beaker or canister.',
  },
  glass_tube: {
    name: 'Glass Tube', age: 0,
    desc: 'Carries liquid sideways and down, never up. A tube is the only thing that pours into the side of a flask or vessel.',
  },
  airlock_cap: {
    name: 'Airlock Cap', age: 0,
    desc: 'A water-sealed cap. On a Reaction Vessel it keeps the air out so the wash ferments.',
  },
  chem_port: {
    name: 'Chemistry Port', age: 2,
    desc: 'Joins fluid pipes to the glassware: touching a flask or vessel it takes fluid in, touching a receiver it gives fluid out.',
  },
  reflux_head: {
    name: 'Reflux Head', age: 2,
    desc: 'Sits on a column. A wrench cycles how much vapour it sends back down: none, half, or three quarters. More return, sharper cut.',
  },
  filter_bed: {
    name: 'Filter Bed', age: 0, glow: 2,
    desc: 'Liquid in from above, out below. Load it with charcoal, sand or clay; the medium is used up, and a spent bed shows blocked until you load another.',
  },
  separatory_funnel: {
    name: 'Separatory Funnel', age: 0,
    desc: 'A pear-shaped funnel with a tap. Liquids that do not mix settle into layers in it; it lets the bottom layer out below and keeps the top one.',
  },
  vacuum_cap: {
    name: 'Vacuum Cap', age: 3,
    desc: 'On a column or a flask it lowers every boiling point. Residue run gently this way gives lube base overhead and bitumen left behind.',
  },
};

function module(kind: ChemKind): BlockSpec[] {
  const look = LOOKS[kind];
  const cap = kind === CHEM.airlock || kind === CHEM.vacuum;
  const base: BlockSpec = {
    key: kind, name: look.name, desc: look.desc, machine: kind, hardness: 0.6, tool: 'pickaxe', age: look.age,
    shape: 'glass', solid: true, opaque: false, translucent: true, category: 'machine', stack: 16,
    lightActive: look.glow ?? 0,
    textures: { side: `chem_${kind}`, top: cap ? `chem_${kind}` : 'chem_top', sideActive: `chem_${kind}_on`, topActive: cap ? `chem_${kind}_on` : 'chem_top' },
  };
  if (!STATEFUL.includes(kind)) return [base];
  return [
    base,
    {
      ...base, key: `${kind}${DONE_SUFFIX}`, name: `${look.name} (done)`, item: false, drops: [{ item: kind, count: 1 }], lightActive: 0,
      textures: { side: `chem_${kind}_done`, top: 'chem_top', sideActive: `chem_${kind}_blocked`, topActive: 'chem_top' },
    },
  ];
}

const asphalt: BlockSpec = {
  key: ASPHALT_BLOCK,
  name: 'Asphalt',
  age: 3,
  desc: `Bitumen, gravel and sand heated in a vessel. Walking is ${ROAD_SPEED.walk} times as fast on it, and a tractor ${ROAD_SPEED.tractor} times.`,
  tool: 'pickaxe',
  textures: { all: 'asphalt' },
};

export const DISTILL_BLOCKS: BlockSpec[] = [...Object.values(CHEM).flatMap(module), asphalt];
