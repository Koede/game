/**
 * The waypoint picker's rows (docs/api/waypoints.md), DOM-free so they can be tested: one row per visited stone the
 * player can travel to from the stone they are using, nearest first, with the straight-line distance, the compass way
 * from here and the charcoal price (`travelCost`), and whether the charcoal in the pack covers it.
 */
import type { Destination, Waypoint } from '../../../sim/waypoints';
import { compassWord } from '../../../world/treasure';

export interface WaypointRow {
  id: number;
  name: string;
  /** Whole blocks, straight line. */
  distance: number;
  /** 8-way compass word from the stone in use ("north-east"). */
  direction: string;
  fuel: number;
  affordable: boolean;
  /** "130 blocks north-east · 3 charcoal" */
  detail: string;
}

export function waypointRows(from: Waypoint, dests: readonly Destination[], charcoal: number): WaypointRow[] {
  return dests.map((d) => {
    const distance = Math.round(d.distance);
    const direction = compassWord(from.x, from.z, d.stone.x, d.stone.z);
    const affordable = charcoal >= d.fuel;
    return {
      id: d.stone.id,
      name: d.stone.name,
      distance,
      direction,
      fuel: d.fuel,
      affordable,
      detail: `${distance} blocks ${direction} · ${d.fuel} charcoal${affordable ? '' : ` (you have ${charcoal})`}`,
    };
  });
}

/** The picker's subtitle line. */
export function waypointSubtitle(from: Waypoint, charcoal: number): string {
  return `At ${from.name} · ${charcoal} charcoal in your pack`;
}
