/**
 * Finds the rooms the player built: every bed near the town whose air passes the room check (housing.ts). Pure over IWorld; the
 * manager runs it once a night while someone is waiting to move in. Beds inside the lodge's own footprint are the lodge's rooms
 * (valid by default, settlement.ts) and are skipped here.
 */
import { WORLD_HEIGHT, type IWorld } from '../core/types';
import { BED_KEYS, checkRoom } from './housing';
import type { RoomInput } from './housingView';
import { BED_ROOM, HOUSE_ROOM } from './settlement';

/** How far from the town's centre beds are looked for (blocks), and the height band around its floor. */
export const SCAN_RADIUS = 40;
export const SCAN_BELOW = 4;
export const SCAN_ABOVE = 20;
/** Most beds checked in one scan (a bed farm does not stall the night). */
export const SCAN_MAX_BEDS = 24;

export interface ScanArea {
  /** The centre column and the floor height. */
  x: number;
  y: number;
  z: number;
  /** The lodge's footprint (world x, z, width, depth), whose beds are not scanned. */
  lodge?: { x: number; z: number; w: number; d: number };
}

export const bedRoomId = (x: number, y: number, z: number): string => `${BED_ROOM}${x},${y},${z}`;

/** Parses "bed:x,y,z" or "house:x,y,z" (the cell the resident sleeps at), or null. */
export function bedOfRoom(id: string): { x: number; y: number; z: number } | null {
  const prefix = id.startsWith(BED_ROOM) ? BED_ROOM : id.startsWith(HOUSE_ROOM) ? HOUSE_ROOM : null;
  if (!prefix) return null;
  const p = id.slice(prefix.length).split(',').map(Number);
  return p.length === 3 && p.every(Number.isFinite) ? { x: p[0], y: p[1], z: p[2] } : null;
}

export function scanRooms(world: IWorld, area: ScanArea): RoomInput[] {
  const out: RoomInput[] = [];
  const y0 = Math.max(0, area.y - SCAN_BELOW);
  const y1 = Math.min(WORLD_HEIGHT - 1, area.y + SCAN_ABOVE);
  const inLodge = (x: number, z: number): boolean => !!area.lodge && x >= area.lodge.x && x < area.lodge.x + area.lodge.w && z >= area.lodge.z && z < area.lodge.z + area.lodge.d;
  for (let x = area.x - SCAN_RADIUS; x <= area.x + SCAN_RADIUS; x++) {
    for (let z = area.z - SCAN_RADIUS; z <= area.z + SCAN_RADIUS; z++) {
      if (!world.isLoaded(x, z) || inLodge(x, z)) continue;
      for (let y = y0; y <= y1; y++) {
        if (!BED_KEYS.has(world.getBlock(x, y, z).key)) continue;
        out.push({ id: bedRoomId(x, y, z), check: checkRoom(world, x, y, z) });
        if (out.length >= SCAN_MAX_BEDS) return out;
      }
    }
  }
  return out;
}
