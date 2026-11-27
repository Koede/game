/**
 * The Grid Meter and Grid Monitor, on the player's side (docs/api/grid-overlay.md): when the power grid overlay shows, and
 * what Use with the meter reads out. DOM-free; the app wires `gridOverlayFor` to the renderer and `meterUse` to beforeUse.
 */
import type { GameBus } from '../core/context';
import { coverText, type GridCell, type NetworkStats } from '../sim';
import { BROWNOUT_STALL } from '../core/constants';
import { formatWatts } from './objectives';

export const GRID_METER = 'grid_meter';
export const GRID_MONITOR = 'grid_monitor';
/** Blocks round the player in which a held meter lights the grid, and in which a monitor lights its own network. */
export const METER_RANGE = 24;
export const MONITOR_RANGE = 12;

/** The simulation's side of the overlay and the reading. */
export interface GridSim {
  networkAt(x: number, y: number, z: number): NetworkStats | null;
  gridOverlay(px: number, py: number, pz: number, range: number, only?: number | null): { tick: number; cells: GridCell[] };
  monitorNear(px: number, py: number, pz: number, range: number): number | null;
}

/**
 * What the overlay should draw this frame: every grid near a held meter, or the one network of a monitor close by;
 * null when neither applies (the overlay is then off).
 */
export function gridOverlayFor(sim: GridSim, held: string | null, x: number, y: number, z: number): { tick: number; cells: GridCell[] } | null {
  if (held === GRID_METER) return sim.gridOverlay(x, y, z, METER_RANGE, null);
  const near = sim.monitorNear(x, y, z, MONITOR_RANGE);
  return near === null ? null : sim.gridOverlay(x, y, z, MONITOR_RANGE, near);
}

const pct = (f: number): string => `${Math.floor(f * 100)}%`;

/** One or two sentences about a network: what it makes, wants and loses, and how the machines on it are doing. */
export function meterReading(net: NetworkStats): string {
  const made = formatWatts(net.generationW + net.dischargeW);
  const lost = net.lossW + net.chokedW;
  const cover = coverText(net);
  const tail = (lost >= 0.5 ? ` ${formatWatts(lost)} lost.` : '') + (cover ? ` ${cover}.` : '');
  if (net.overloaded || net.state === 'overload') return `Overload: cable carries ${formatWatts(net.ratingW)}, ${pct(net.satisfaction)} supplied.${tail}`;
  if (net.demandW > 0 && net.satisfaction < BROWNOUT_STALL) return `Stalled: ${made} of ${formatWatts(net.demandW)}, ${pct(net.satisfaction)}.${tail}`;
  if (net.demandW > 0 && net.satisfaction < 0.999) return `Brown-out: ${made} of ${formatWatts(net.demandW)}, ${pct(net.satisfaction)}.${tail}`;
  if (net.demandW <= 0) return `Idle: ${made} made, nothing asks for power.${tail}`;
  return `Steady: ${made} for ${formatWatts(net.demandW)}, all at full power.${tail}`;
}

/** Use with a meter in hand: reads the network of the cable or machine aimed at. Null when no meter is held. */
export function meterUse(sim: GridSim, bus: GameBus, held: string | null, hit: { x: number; y: number; z: number; block: { power: string | null } } | null): 'worked' | 'refused' | null {
  if (held !== GRID_METER || hit === null) return null;
  const net = hit.block.power === null ? null : sim.networkAt(hit.x, hit.y, hit.z);
  if (net === null) {
    bus.emit('toast', { text: hit.block.power === null ? 'Aim the meter at a cable or a machine.' : 'That one is not wired to anything yet.', kind: 'info' });
    return 'refused';
  }
  bus.emit('toast', { text: meterReading(net), kind: net.state === 'ok' ? 'good' : net.state === 'overload' ? 'bad' : 'warn' });
  return 'worked';
}
