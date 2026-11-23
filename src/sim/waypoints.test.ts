import { describe, expect, it } from 'vitest';
import { WAYPOINT_MAX_FUEL, WAYPOINT_MAX_STONES, WaypointNetwork, travelCost } from './waypoints';

describe('waypoint stones', () => {
  it('places, names and refuses duplicates', () => {
    const n = new WaypointNetwork();
    const a = n.place(0, 10, 0)!;
    expect(a.name).toBe('Waypoint 1');
    expect(n.place(0, 10, 0)).toBeNull();
    expect(n.rename(a.id, '  Home  ')).toBe(true);
    expect(n.at(0, 10, 0)!.name).toBe('Home');
    expect(n.rename(a.id, '  ')).toBe(false);
  });

  it('lists other visited stones nearest first with a fuel price', () => {
    const n = new WaypointNetwork();
    const home = n.place(0, 10, 0)!;
    const far = n.place(300, 10, 0)!;
    const near = n.place(60, 10, 0)!;
    const d = n.destinations(home);
    expect(d.map((x) => x.stone.id)).toEqual([near.id, far.id]);
    expect(d[0].fuel).toBe(1);
    expect(d[1].fuel).toBe(5);
  });

  it('only offers stones the player has visited', () => {
    const n = new WaypointNetwork();
    const a = n.place(0, 5, 0)!;
    const b = n.place(10, 5, 0)!;
    b.visited = false;
    expect(n.destinations(a)).toHaveLength(0);
    n.visit(b.id);
    expect(n.destinations(a)).toHaveLength(1);
  });

  it('caps the price and the number of stones', () => {
    expect(travelCost(1)).toBe(1);
    expect(travelCost(65)).toBe(2);
    expect(travelCost(99999)).toBe(WAYPOINT_MAX_FUEL);
    const n = new WaypointNetwork();
    for (let i = 0; i < WAYPOINT_MAX_STONES; i++) expect(n.place(i, 0, 0)).not.toBeNull();
    expect(n.place(99, 0, 0)).toBeNull();
  });

  it('finds the stone you stand beside and forgets removed ones', () => {
    const n = new WaypointNetwork();
    n.place(10, 10, 10);
    expect(n.nearest(11, 10, 10)).not.toBeNull();
    expect(n.nearest(30, 10, 10)).toBeNull();
    expect(n.remove(10, 10, 10)).toBe(true);
    expect(n.nearest(11, 10, 10)).toBeNull();
  });

  it('round-trips through a save and keeps ids unique', () => {
    const n = new WaypointNetwork();
    n.place(1, 1, 1);
    const b = n.place(2, 2, 2)!;
    n.remove(1, 1, 1);
    const m = WaypointNetwork.fromSave(JSON.parse(JSON.stringify(n.toSave())));
    expect(m.all()).toHaveLength(1);
    expect(m.place(3, 3, 3)!.id).toBeGreaterThan(b.id);
    expect(m.landing(b)).toEqual({ x: 2.5, y: 3, z: 2.5 });
  });
});
