/**
 * Waypoint stones (docs/api/waypoints.md): craftable markers the player places and later fast travels between.
 * Pure state + rules, no world access: the caller feeds in placements and removals, asks for the destinations open
 * from a stone and pays `travelCost` before teleporting. Nothing here is needed to finish the game.
 *
 * A stone is "visited" once the player has used it (placing counts: you obviously stood there). Travel is only
 * ever between visited stones, from a stone you are standing at (within WAYPOINT_USE_RADIUS).
 */

/** How close the player must be to a stone to use it. */
export const WAYPOINT_USE_RADIUS = 4;
/** Charcoal per started 64 blocks of straight-line distance, at least one. */
export const WAYPOINT_FUEL_ITEM = 'charcoal';
export const WAYPOINT_BLOCKS_PER_FUEL = 64;
/** A hard cap so a far stone never costs a whole stack. */
export const WAYPOINT_MAX_FUEL = 8;
/** Most stones one world keeps (the list screen stays short on a phone). */
export const WAYPOINT_MAX_STONES = 24;

export interface Waypoint { id: number; x: number; y: number; z: number; name: string; visited: boolean }
export interface WaypointSave { next: number; stones: Waypoint[] }
export interface Destination { stone: Waypoint; distance: number; fuel: number }

type P3 = { x: number; y: number; z: number };
const dist = (a: P3, b: P3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Fuel to pay for a trip of `distance` blocks. */
export function travelCost(distance: number): number {
  return Math.min(WAYPOINT_MAX_FUEL, Math.max(1, Math.ceil(distance / WAYPOINT_BLOCKS_PER_FUEL)));
}

export class WaypointNetwork {
  private stones = new Map<number, Waypoint>();
  private next = 1;

  /** Place a stone. Returns null when the world is full or a stone already stands in that cell. */
  place(x: number, y: number, z: number, name?: string): Waypoint | null {
    if (this.stones.size >= WAYPOINT_MAX_STONES || this.at(x, y, z)) return null;
    const id = this.next++;
    const stone: Waypoint = { id, x, y, z, name: name?.trim() || `Waypoint ${id}`, visited: true };
    this.stones.set(id, stone);
    return stone;
  }

  at(x: number, y: number, z: number): Waypoint | null {
    for (const s of this.stones.values()) if (s.x === x && s.y === y && s.z === z) return s;
    return null;
  }

  remove(x: number, y: number, z: number): boolean {
    const s = this.at(x, y, z);
    return s ? this.stones.delete(s.id) : false;
  }

  rename(id: number, name: string): boolean {
    const s = this.stones.get(id);
    const n = name.trim().slice(0, 24);
    if (!s || !n) return false;
    s.name = n;
    return true;
  }

  /** The nearest stone within use range of the player, or null. */
  nearest(px: number, py: number, pz: number): Waypoint | null {
    let best: Waypoint | null = null;
    let bd = WAYPOINT_USE_RADIUS;
    for (const s of this.stones.values()) {
      const d = dist(s, { x: px, y: py, z: pz });
      if (d <= bd) { best = s; bd = d; }
    }
    return best;
  }

  /** Using a stone marks it visited. */
  visit(id: number): void {
    const s = this.stones.get(id);
    if (s) s.visited = true;
  }

  /** Every other visited stone, nearest first, with its fuel price. */
  destinations(from: Waypoint): Destination[] {
    const out: Destination[] = [];
    for (const s of this.stones.values()) {
      if (s.id === from.id || !s.visited) continue;
      const distance = dist(from, s);
      out.push({ stone: s, distance, fuel: travelCost(distance) });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }

  /** Where the player lands: one block above the stone, so a stone in a wall never traps. */
  landing(s: Waypoint): P3 { return { x: s.x + 0.5, y: s.y + 1, z: s.z + 0.5 }; }

  all(): Waypoint[] { return [...this.stones.values()]; }

  toSave(): WaypointSave { return { next: this.next, stones: this.all().map((s) => ({ ...s })) }; }

  static fromSave(save: WaypointSave | null | undefined): WaypointNetwork {
    const n = new WaypointNetwork();
    if (!save) return n;
    for (const s of save.stones ?? []) n.stones.set(s.id, { ...s });
    n.next = Math.max(save.next ?? 1, ...[...n.stones.keys()].map((k) => k + 1), 1);
    return n;
  }
}
