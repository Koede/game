/**
 * Which chunks around the player are drawn and which need voxel data, as pure functions of the offset
 * (dx, dz) from the player's chunk and the render distance r.
 */

// A chunk is drawn inside a circle of radius r + 0.5 and hidden again only past r + 1.5, so walking along
// the edge of the view does not make chunks flicker in and out.
export const inView = (dx: number, dz: number, r: number): boolean => dx * dx + dz * dz <= r * r + r;
export const shown = (dx: number, dz: number, r: number): boolean => dx * dx + dz * dz <= (r + 1.5) * (r + 1.5);
/** Voxels are needed for every chunk in view and for its 8 neighbours. */
export const inData = (dx: number, dz: number, r: number): boolean =>
  inView(Math.max(Math.abs(dx) - 1, 0), Math.max(Math.abs(dz) - 1, 0), r);

export interface ViewPlan {
  /** (dx, dz) pairs of every chunk whose voxels are needed, nearest first. */
  offsets: Int16Array;
  /** 1 where that chunk is also in view (meshed). */
  view: Uint8Array;
}

export function planFor(r: number): ViewPlan {
  const list: [number, number, number][] = [];
  for (let dz = -r - 1; dz <= r + 1; dz++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) if (inData(dx, dz, r)) list.push([dx, dz, dx * dx + dz * dz]);
  }
  list.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  const offsets = new Int16Array(list.length * 2);
  const view = new Uint8Array(list.length);
  list.forEach(([dx, dz], i) => {
    offsets[i * 2] = dx;
    offsets[i * 2 + 1] = dz;
    view[i] = inView(dx, dz, r) ? 1 : 0;
  });
  return { offsets, view };
}
