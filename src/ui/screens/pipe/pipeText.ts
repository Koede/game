/**
 * DOM-free helpers of the pipe screen (spec 16.3): row keys, status tones, the window's summary lines, filter edits,
 * the filter picker's choices, priority text, and which ports to list.
 */
import { PIPE_FILTER_SLOTS, PIPE_PRIORITY_MAX, PIPE_PRIORITY_MIN } from '../../../core/constants';
import { FLUIDS, fluidOrNull, itemOrNull } from '../../../core/registry';
import type { Slot } from '../../../core/types';
import type { PipeNetView, PipeView, PortView } from '../../../sim';

export type Family = PipeView['family'];
export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'power';

/** The first ports listed (nearest first); the rest wait behind "Show N more". */
export const NEAR_PORTS = 8;

/** A port's identity across refreshes: its pipe and the side it faces. */
export const portKey = (p: Pick<PortView, 'x' | 'y' | 'z' | 'dir'>): string => `${p.x},${p.y},${p.z},${p.dir}`;

/** Tone of a port's status line: moving is good, idle-but-fine is neutral, a reason to act is warn, stuck is bad. */
export function portTone(p: Pick<PortView, 'status' | 'mode' | 'inert' | 'blocked' | 'moving'>): Tone {
  if (p.inert || p.blocked > 0 || /^(Blocked|Too hot|Network too long)/.test(p.status)) return 'bad';
  if (p.mode === 'off') return 'neutral';
  if (/^(Moving|Receiving)/.test(p.status)) return 'good';
  if (/^(Ready|Waiting|Nothing to pull)/.test(p.status)) return 'neutral';
  return 'warn';
}

/** Name of an item or fluid key. */
export function keyName(family: Family, key: string): string {
  return family === 'fluid' ? fluidOrNull(key)?.name ?? key : itemOrNull(key)?.name ?? key;
}

/** "Everything", "Only Copper Ore and Tin Ore", "All but Coal". */
export function filterSummary(family: Family, p: Pick<PortView, 'filter' | 'filterMode'>): string {
  if (p.filter.length === 0) return 'Everything';
  const names = p.filter.map((k) => keyName(family, k));
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return p.filterMode === 'allow' ? `Only ${list}` : `All but ${list}`;
}

/** The filter with `key` written into slot `index` (a copy of it elsewhere goes), or that slot emptied with null. */
export function setFilterSlot(filter: readonly string[], index: number, key: string | null): string[] {
  if (key === null) return filter.filter((_, i) => i !== index);
  if (index < filter.length) {
    const out = [...filter];
    out[index] = key;
    return out.filter((k, i) => k !== key || i === index);
  }
  return filter.includes(key) ? [...filter] : [...filter, key].slice(0, PIPE_FILTER_SLOTS);
}

/** What the filter picker offers: fluids for a fluid line, else the distinct items in the pack (in pack order). */
export function filterChoices(family: Family, pack: readonly Slot[]): string[] {
  if (family === 'fluid') return FLUIDS.map((f) => f.key);
  const seen = new Set<string>();
  for (const s of pack) if (s && !seen.has(s.item)) seen.add(s.item);
  return [...seen];
}

export const clampPriority = (p: number): number => Math.max(PIPE_PRIORITY_MIN, Math.min(PIPE_PRIORITY_MAX, Math.round(p)));

/** "+2", "0", "-1" */
export const priorityText = (p: number): string => (p > 0 ? `+${p}` : String(p));

/** What the priority means, one line. */
export function priorityNote(p: number): string {
  if (p > 0) return 'Filled before ends with a lower priority';
  if (p < 0) return 'Filled only when higher ends are full';
  return 'Higher numbers are filled first';
}

const litres = (l: number): string => `${Math.round(l).toLocaleString('en-US')} L`;

/** The window subtitle: "Item line - 12 pipes, 3 ends" / "Fluid line - 9 pipes, 2 ends". */
export function lineSummary(net: Pick<PipeNetView, 'family' | 'pipes' | 'ports' | 'hot'>): string {
  const kind = net.family === 'fluid' ? (net.hot ? 'Hot fluid line' : 'Fluid line') : 'Item line';
  return `${kind} - ${net.pipes} pipe${net.pipes === 1 ? '' : 's'}, ${net.ports} end${net.ports === 1 ? '' : 's'}`;
}

/** The line's contents: "Water - 1,210 of 3,000 L", "Empty", "3 bundles moving (12 items)", "Nothing moving". */
export function contentText(net: Pick<PipeNetView, 'family' | 'fluidName' | 'litres' | 'capacityL' | 'packets' | 'items'>): string {
  if (net.family === 'fluid') {
    if (!net.fluidName) return `Empty - holds up to ${litres(net.capacityL)}`;
    if (net.litres < 1) return `${net.fluidName} flowing through - none held (room for ${litres(net.capacityL)})`;
    return `${net.fluidName} - ${Math.round(net.litres).toLocaleString('en-US')} of ${litres(net.capacityL)}`;
  }
  if (net.packets === 0) return 'Nothing moving';
  return `${net.packets} bundle${net.packets === 1 ? '' : 's'} moving (${net.items} item${net.items === 1 ? '' : 's'})`;
}

/** What each mode does, for the row's accessible description and the empty state. */
export const MODE_HELP: Readonly<Record<PortView['mode'], string>> = {
  push: 'Push: the pipe delivers into this block',
  pull: 'Pull: the pipe takes out of this block',
  off: 'Off: this end does nothing',
};

/** The ports to list: the nearest `limit` unless all are wanted, plus how many more there are. */
export function nearPorts(ports: readonly PortView[], all: boolean, limit = NEAR_PORTS): { shown: PortView[]; more: number } {
  if (all || ports.length <= limit) return { shown: [...ports], more: 0 };
  return { shown: ports.slice(0, limit), more: ports.length - limit };
}

/** "At this pipe", "1 block away", "3 blocks away" (from the pipe the screen was opened on). */
export function distanceText(d: number): string {
  const n = Math.round(d);
  return n <= 0 ? 'At this pipe' : n === 1 ? '1 block away' : `${n} blocks away`;
}
