/**
 * Where a moving structure block is drawn this frame (docs/WHATS_LEFT.md §2). The voxel stays in `from` until the
 * step commits; the mesh slides from that cell to `to`, or, for a bearing, yaws about the pivot by `yaw`.
 */
import type { StructureMotion } from '../../workshop/contraption';

export interface StructurePose {
  /** World position of the block's centre. */
  x: number;
  y: number;
  z: number;
  /** Radians about +Y (0 for a slide). Positive yaw carries +X toward +Z, matching a right-turning bearing. */
  yaw: number;
}

/** Centre of a cell. */
const centre = (c: readonly [number, number, number]): [number, number, number] => [c[0] + 0.5, c[1] + 0.5, c[2] + 0.5];

/**
 * Pose of one block along its step. A slide lerps the cell centre. A bearing (`pivot` set) rotates the block
 * about the pivot's vertical axis by `yaw` instead of cutting the chord between the two cells.
 */
export function structurePose(m: StructureMotion): StructurePose {
  const [fx, fy, fz] = centre(m.from);
  const [tx, ty, tz] = centre(m.to);
  const t = m.t;
  if (m.pivot) {
    const px = m.pivot[0] + 0.5;
    const pz = m.pivot[2] + 0.5;
    const rx = fx - px;
    const rz = fz - pz;
    const c = Math.cos(m.yaw);
    const s = Math.sin(m.yaw);
    return {
      x: px + rx * c - rz * s,
      y: fy + (ty - fy) * t,
      z: pz + rx * s + rz * c,
      yaw: m.yaw,
    };
  }
  return {
    x: fx + (tx - fx) * t,
    y: fy + (ty - fy) * t,
    z: fz + (tz - fz) * t,
    yaw: 0,
  };
}
