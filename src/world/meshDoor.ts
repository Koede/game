/**
 * The door shape (docs/api/door.md): a thin panel across the facing axis, drawn with the plank tile. Closed, the bottom
 * half carries a small handle on the front; open, the panel lies against the cell edge. Both halves draw the same panel.
 */
import { voxelActive, voxelFacing, voxelVariant, type Voxel } from '../core/types';
import { doorHandle, doorPanel, DOOR_TOP } from '../core/doorShape';
import { box, type Builder } from './meshQuads';

export function door(b: Builder, slot: number, v: Voxel, p: number, x: number, y: number, z: number): void {
  const open = voxelActive(v);
  const facing = voxelFacing(v);
  const panel = doorPanel(facing, open);
  box(b, slot, p, x, y, z, panel.lo, panel.hi, 0, 0);
  if (!open && voxelVariant(v) !== DOOR_TOP) {
    const h = doorHandle(facing);
    box(b, slot, p, x, y, z, h.lo, h.hi, 0, 0);
  }
}
