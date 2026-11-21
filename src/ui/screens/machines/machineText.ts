/** DOM-free helpers of the machine screens and network panels: which layout a machine gets, alert and readout texts. */
import { machine, recipesAt } from '../../../core/registry';
import type { MachineRole } from '../../../core/types';
import type { MachineView, NetworkStats } from '../../../sim';
import { formatDuration, formatJoules, formatPercent, formatWatts } from '../../kit/format';

export type MachineLayout = 'generator' | 'burner' | 'processor' | 'consumer' | 'storage' | 'bore' | 'fission' | 'crate';

/** The screen layout for a machine kind. */
export function machineLayout(kind: string, role: MachineRole): MachineLayout {
  if (role === 'crate' || kind === 'crate') return 'crate';
  if (kind === 'fission_pile') return 'fission';
  if (kind === 'bore_rig') return 'bore';
  if (role === 'storage') return 'storage';
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

export function cableText(net: NetworkStats): string {
  if (!Number.isFinite(net.ratingW)) return 'No cable - no limit';
  return `Cable limit (${net.cables} cable${net.cables === 1 ? '' : 's'})`;
}

/** "+1.2 kW" feeding, "-300 W" drawing. */
export const memberWatts = (watts: number): string =>
  watts > 0 ? `+${formatWatts(watts)}` : watts < 0 ? `-${formatWatts(-watts)}` : '0 W';

/** What the GRID tab says when the furnace is wired to nothing. */
export function lonelyFurnaceText(tier: number): string {
  if (tier < 2) {
    return 'No power yet. Forge a Thermopile (700 °C) and set it against the furnace: its heat becomes electricity. A Lamp touching it lights up.';
  }
  const base = 'This furnace is not wired to anything. Lay copper cable from it to generators, batteries and machines.';
  return tier >= 3 ? `${base} Once it is on a network with power, it heats itself electrically.` : base;
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
    default:
      return { caption: 'Drawing', reading: formatWatts(view.demandW * view.satisfaction) };
  }
}

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
    default: {
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
  if (/No |Not enough|full|Waiting|stopped|Stopped|too cold|too hard|not connected|Idle/i.test(view.status)) return 'warn';
  return view.running ? 'power' : 'neutral';
}
