/**
 * Machines of the glass distillery (docs/DISTILLERY_PLAN.md): one MachineSpec per module kind, all of role 'chem'.
 * They are never machine nodes: src/sim/distill.ts keeps an entity per module and finds rigs by touching blocks.
 * Numbers live in src/core/distill.ts; the recipes at these stations (recipesDistill.ts) are the process cards.
 */
import { CHEM, CHEM_CAPACITY_L, CHEM_KINDS, DONE_SUFFIX, STATEFUL } from '../core/distill';
import type { FluidKey, MachineSpec } from '../core/types';
import { DISTILL_FLUIDS } from './fluidsDistill';

const DESC: Record<string, string> = {
  still_base: 'Holds the flask on it at the set temperature with the heat of the furnace below.',
  boiling_flask: 'Boils its charge on a Still Base; the run ends by itself when nothing left boils at the set temperature.',
  reaction_vessel: 'Ferments under an Airlock; lets its liquid go once the work is done.',
  column_segment: 'One plate of a fractionating column: stack height is the number of cuts.',
  condenser_coil: 'Condenses vapour into the receiver or tube beside or below it.',
  cooling_jacket: 'Water-cooled: condensers it touches work three times as fast.',
  receiver: 'Collects what drips into it.',
  glass_tube: 'Carries liquid sideways and down.',
  airlock_cap: 'Seals the vessel below it.',
  chem_port: 'Fluid pipes in and out of the glassware.',
  reflux_head: 'Wrench cycles the return: 0, 50 or 75 percent. Plates count (1 + 2 r) times.',
  separatory_funnel: 'Holds 1000 L. Liquid enters from above or from a tube. Layers that do not mix settle for a few seconds, then the tap lets the bottom one out below.',
  filter_bed: 'Holds 500 L. Liquid enters from above and leaves below. Charcoal, sand or clay is used up; clay turns lube base into lubricant.',
  vacuum_cap: 'On the stack, boiling points are 0.7 times. No shaft is required.',
};

const distillFluids = DISTILL_FLUIDS.map((f) => f.key);
const PORT_ACCEPTS: FluidKey[] = ['water', 'crude_oil', ...distillFluids];

const title = (kind: string): string => kind.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export const DISTILL_MACHINES: MachineSpec[] = CHEM_KINDS.map((kind): MachineSpec => ({
  kind, name: title(kind), role: 'chem',
  blocks: STATEFUL.includes(kind) ? [kind, `${kind}${DONE_SUFFIX}`] : [kind],
  desc: DESC[kind],
  ...(CHEM_CAPACITY_L[kind] > 0 ? { params: { capacityL: CHEM_CAPACITY_L[kind] } } : {}),
  ...(kind === CHEM.port ? { fluids: { accepts: PORT_ACCEPTS, gives: ['water' as FluidKey, ...distillFluids], capacityL: 1000 } } : {}),
}));
