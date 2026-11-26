/** Test fixture: builds hearth shells around a furnace in the fake world. Imported by path from tests only. */
import { block, blockId } from '../core/registry';
import { Facing, makeVoxel, type IWorld } from '../core/types';
import { CellRole, boxX, boxZ, cellRole, frameOf, structureOf, type HearthBox } from './hearthScan';

export interface ShellOptions {
  /** Tier whose wall block, ceiling rule, electrodes and ports to use. */
  tier: number;
  /** [across, deep, high] of the inside (default the tier's smallest). */
  inner?: [number, number, number];
  /** Wall block (default the tier's own). */
  wall?: string;
  /** Build a ceiling (default: when the tier requires one). */
  closed?: boolean;
  /** Facing of the furnace (default North, as FakeWorld.put places blocks). */
  facing?: Facing;
  /** Electrodes in the ceiling and power ports in the back wall (default: what the tier needs). */
  electrodes?: number;
  ports?: number;
  /** Parts the tier requires, set in the back wall by block key (default: its `requiredParts`; `{}` builds a hearth without them). */
  parts?: Record<string, number>;
  /** Lowest interior layer relative to the furnace (default 0: the furnace sits at the bottom of the inside). */
  dy?: number;
}

/** The box a shell of these options takes around a furnace at x, y, z (inside centred across the furnace). */
export function shellBox(x: number, y: number, z: number, o: ShellOptions): HearthBox {
  const s = structureOf(o.tier);
  const [across, deep, high] = o.inner ?? s.minInner;
  const u0 = -Math.floor((across - 1) / 2);
  const y0 = y + (o.dy ?? 0);
  return {
    cx: x, cy: y, cz: z, ...frameOf(o.facing ?? Facing.North), u0, u1: u0 + across - 1, depth: deep, y0, y1: y0 + high - 1,
    closed: o.closed ?? s.ceiling === 'required',
  };
}

/** Every cell of a box with its role (controller included), in scan order. */
export function boxCells(b: HearthBox): Array<{ x: number; y: number; z: number; u: number; v: number; role: number }> {
  const out: Array<{ x: number; y: number; z: number; u: number; v: number; role: number }> = [];
  for (let y = b.y0 - 1; y <= b.y1 + (b.closed ? 1 : 0); y++) {
    for (let v = 0; v <= b.depth + 1; v++) {
      for (let u = b.u0 - 1; u <= b.u1 + 1; u++) out.push({ x: boxX(b, u, v), y, z: boxZ(b, u, v), u, v, role: cellRole(b, u, v, y) });
    }
  }
  return out;
}

/**
 * Builds the shell (and clears the inside) around the furnace already standing at x, y, z: walls, floor, ceiling,
 * electrodes in the middle of the ceiling, power ports in the back wall. Returns the box.
 */
export function buildHearth(world: IWorld, x: number, y: number, z: number, o: ShellOptions): HearthBox {
  const s = structureOf(o.tier);
  const b = shellBox(x, y, z, o);
  const wall = blockId(o.wall ?? s.wall[0]);
  let electrodes = o.electrodes ?? s.electrodes ?? 0;
  let ports = o.ports ?? s.powerPorts ?? 0;
  const parts = Object.entries(o.parts ?? s.requiredParts ?? {}).flatMap(([key, n]) => Array.from({ length: n }, () => key));
  const cells = boxCells(b);
  const midU = (b.u0 + b.u1) / 2;
  const midV = (b.depth + 1) / 2;
  const ceiling = cells.filter((c) => c.role === CellRole.CeilingFace).sort((p, q) => Math.abs(p.u - midU) + Math.abs(p.v - midV) - Math.abs(q.u - midU) - Math.abs(q.v - midV));
  const electrodeAt = new Set(ceiling.slice(0, electrodes).map((c) => `${c.x},${c.y},${c.z}`));
  for (const c of cells) {
    if (c.role === CellRole.Controller) continue;
    let id = c.role === CellRole.Interior ? 0 : wall;
    if (electrodes > 0 && electrodeAt.has(`${c.x},${c.y},${c.z}`)) {
      id = block('electrode').id;
      electrodes--;
    } else if (ports > 0 && c.role === CellRole.WallFace && c.v === b.depth + 1) {
      id = block('power_port').id;
      ports--;
    } else if (parts.length > 0 && c.role === CellRole.WallFace && c.v === b.depth + 1) {
      id = block(parts.shift() as string).id;
    }
    world.setVoxel(c.x, c.y, c.z, makeVoxel(id), 'player');
  }
  return b;
}
