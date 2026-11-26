import { describe, expect, it } from 'vitest';
import { WaypointNetwork } from '../../../sim/waypoints';
import { waypointRows, waypointSubtitle } from './waypointList';

describe('waypointRows', () => {
  const net = new WaypointNetwork();
  const home = net.place(0, 10, 0, 'Home')!;
  net.place(0, 10, -100, 'North Camp');
  net.place(200, 10, 200, 'Far Ruin');
  net.place(30, 10, 0, 'Barn');

  it('lists every other visited stone, nearest first, with distance, compass way and fare', () => {
    const rows = waypointRows(home, net.destinations(home), 3);
    expect(rows.map((r) => r.name)).toEqual(['Barn', 'North Camp', 'Far Ruin']);
    expect(rows[0]).toMatchObject({ distance: 30, direction: 'east', fuel: 1, affordable: true });
    expect(rows[1]).toMatchObject({ distance: 100, direction: 'north', fuel: 2, affordable: true });
    expect(rows[2]).toMatchObject({ distance: 283, direction: 'south-east', fuel: 5, affordable: false });
    expect(rows[0].detail).toBe('30 blocks east · 1 charcoal');
    expect(rows[2].detail).toBe('283 blocks south-east · 5 charcoal (you have 3)');
  });

  it('leaves out unvisited stones and the stone in use', () => {
    const n = WaypointNetwork.fromSave({ next: 3, stones: [
      { id: 1, x: 0, y: 0, z: 0, name: 'A', visited: true },
      { id: 2, x: 10, y: 0, z: 0, name: 'B', visited: false },
    ] });
    const a = n.at(0, 0, 0)!;
    expect(waypointRows(a, n.destinations(a), 9)).toEqual([]);
    expect(waypointSubtitle(a, 9)).toBe('At A · 9 charcoal in your pack');
  });
});
