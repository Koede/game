/** DOM-free helpers of the machine screens and network panels: which layout a machine gets, alert and readout texts. */
import { machine, recipesAt } from '../../../core/registry';
import type { MachineRole } from '../../../core/types';
import type { MachineView, NetworkStats } from '../../../sim';
import { formatDuration, formatJoules, formatPercent, formatWatts } from '../../kit/format';
import { FIRST_HEARTH_TIER, FIRST_ELECTRIC_TIER } from '../../../core/constants';

export type MachineLayout = 'generator' | 'burner' | 'processor' | 'consumer' | 'storage' | 'bore' | 'fission' | 'crate' | 'tank' | 'boiler' | 'part';

/** The screen layout for a machine kind. */
export function machineLayout(kind: string, role: MachineRole): MachineLayout {
  if (role === 'crate' || kind === 'crate') return 'crate';
  if (kind === 'fission_pile') return 'fission';
  if (kind === 'bore_rig') return 'bore';
  if (role === 'storage') return 'storage';
  if (role === 'tank') return 'tank';
  if (role === 'boiler') return 'boiler';
  if (role === 'hearth_part') return 'part';
  if (role === 'generator') return (machine(kind).fuels?.length ?? 0) > 0 ? 'burner' : 'generator';
  return recipesAt(kind).length > 0 ? 'processor' : 'consumer';
}

/** One sentence for a network in trouble, or null when all is well. */
export function alertText(net: NetworkStats): string | null {
  const pct = formatPercent(net.satisfaction);
  if (net.state === 'overload' || net.overloaded) {
    return `Overloaded: the weakest cable carries only ${formatWatts(net.ratingW)}, so machines get ${pct} of what they ask. Lay heavier cable.`;
  }
  if (net.state === 'brownout' || (net.demandW > 0 && net.satisfaction < 0.999)) {
    if (net.satisfaction < 0.25) return `Stalled: only ${pct} of the demand is met - machines stop below 25%. Add generators or batteries.`;
    return `Brown-out: ${pct} of the demand is met, so everything runs slower. Add generators or batteries.`;
  }
  return null;
}

/** What the grid loses, in words: batteries' round trip and demand the weakest cable holds back. Null when nothing is lost. */
export function lossText(net: NetworkStats): string | null {
  const parts: string[] = [];
  if (net.lossW >= 0.5) parts.push(`${formatWatts(net.lossW)} lost charging batteries`);
  if (net.chokedW >= 0.5) parts.push(`${formatWatts(net.chokedW)} held back by the cable`);
  return parts.length === 0 ? null : `Losses: ${parts.join(', ')}.`;
}

export function cableText(net: NetworkStats): string {
  if (!Number.isFinite(net.ratingW)) return 'No cable - no limit';
  return `Cable limit (${net.cables} cable${net.cables === 1 ? '' : 's'})`;
}

/** "+1.2 kW" feeding, "-300 W" drawing. */
export const memberWatts = (watts: number): string =>
  watts > 0 ? `+${formatWatts(watts)}` : watts < 0 ? `-${formatWatts(-watts)}` : '0 W';

/** What the GRID tab says when the furnace is wired to nothing. */
export function lonelyFurnaceText(tier: number): string {
  if (tier < FIRST_HEARTH_TIER) {
    return 'No power yet. Electricity is the work of the Forge Age: build a Blast hearth, then a Dynamo on a shaft line turning 64 rpm or more, and run cable from it.';
  }
  const base = 'This furnace is not wired to anything. Lay copper cable from it to generators, batteries and machines.';
  return tier >= FIRST_ELECTRIC_TIER ? `${base} Once it is on a network with power, it heats itself electrically.` : base;
}

/** The headline figure of a machine: what it makes, uses or holds. */
export function headline(view: MachineView, layout: MachineLayout): { caption: string; reading: string } {
  switch (layout) {
    case 'generator':
    case 'burner':
    case 'fission':
      return { caption: 'Output', reading: formatWatts(view.outW) };
    case 'storage':
      return { caption: 'Stored', reading: formatJoules(view.storedJ) };
    case 'crate':
      return { caption: 'Holds', reading: `${view.slots.filter((s) => s !== null).length} stacks` };
    case 'tank':
      return { caption: 'Holds', reading: `${litres(view.fluids?.stack?.litres ?? view.fluids?.input?.litres ?? 0)} L` };
    case 'boiler':
      return { caption: 'Steam', reading: `${litres(view.fluids?.rateL ?? 0)} L/s` };
    case 'part':
      return { caption: 'Hearth part', reading: '' };
    default:
      if (view.kind === 'grid_monitor') return { caption: 'Supplied', reading: view.network === null ? '--' : formatPercent(view.satisfaction) };
      return { caption: 'Drawing', reading: formatWatts(view.demandW * view.satisfaction) };
  }
}

const litres = (l: number): string => Math.round(l).toLocaleString('en-US');

/** Secondary line under the headline. */
export function subline(view: MachineView, layout: MachineLayout): string {
  switch (layout) {
    case 'generator':
    case 'burner':
    case 'fission':
      return view.availW > 0 ? `of ${formatWatts(view.availW)} available` : 'Nothing available';
    case 'storage':
      return `of ${formatJoules(view.capacityJ)}${view.chargeW > 0 ? ` - charging ${formatWatts(view.chargeW)}` : view.outW > 0 ? ` - feeding ${formatWatts(view.outW)}` : ''}`;
    case 'crate':
      return `${view.slots.length} slots`;
    case 'tank': {
      const stack = view.fluids?.stack;
      if (!stack) return '';
      return `of ${litres(stack.capacityL)} L${stack.tanks > 1 ? ` (${stack.tanks} tanks)` : ''}`;
    }
    case 'boiler':
      return 'from the furnace below - 1 L of water makes 10 L';
    case 'part':
      return '';
    default: {
      if (view.kind === 'grid_monitor') return view.network === null ? 'Not connected to a network' : 'of what this network is asked for';
      const draw = machine(view.kind).drawW ?? 0;
      if (view.demandW <= 0) return `Needs ${formatWatts(draw)} while working`;
      return `${formatPercent(view.satisfaction)} of ${formatWatts(view.demandW)}`;
    }
  }
}

/** "12 min" of fuel, or what is missing. */
export function fuelText(view: MachineView): string {
  if (view.fuelJ <= 0) return 'Empty';
  const left = Number.isFinite(view.fuelLeftS) ? ` - ${formatDuration(view.fuelLeftS)} at this load` : ' - idle';
  return `${formatJoules(view.fuelJ)}${left}`;
}

/** Tone of a machine's status line. */
export function machineTone(view: MachineView): 'good' | 'warn' | 'bad' | 'neutral' | 'power' {
  if (view.problem) return 'bad';
  if (/rising|Meltdown|No cooling/.test(view.status)) return 'bad';
  if (!view.on) return 'neutral';
  if (view.role === 'storage') return /not connected/.test(view.status) ? 'warn' : 'power';
  if (/No |Not enough|full|Waiting|stopped|Stopped|too cold|too hard|not connected|Idle/i.test(view.status)) return 'warn';
  return view.running ? 'power' : 'neutral';
}
