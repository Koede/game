/**
 * Town templates (docs/plans/orrin-builds-a-town.md): the presaved buildings Gruk raises, drawn into a recording canvas and split
 * into stages (clearing, frame, walls, roof, finish). Pure and DOM-free.
 *
 * Local coordinates: x in [0, w), z in [0, d), y = 0 is the lowest course, sitting on the base row (the first block above the lowest
 * ground under the footprint). y = -1 is the row under it (a doorstep, outside the footprint). Templates never assume flat ground: the
 * builder (townBuilder.ts) adds stilts and footings from the base row down to the ground under each column, and digs out bumps above it.
 *
 * Only blocks that exist in the registry are used (src/content/blocks.ts). Frame cells are only oak logs and stone brick.
 */
import { Facing } from '../core/types';
import { lodgeTemplateFor } from './lodge';

export const TOWN_STAGES = ['clearing', 'frame', 'walls', 'roof', 'finish'] as const;
export type TownStage = (typeof TOWN_STAGES)[number];

export interface TownCell {
  x: number;
  y: number;
  z: number;
  /** A block key; 'air' means the space must be clear (movable things in it are dug out into the storage bay). */
  block: string;
  facing: number;
  stage: TownStage;
}

export interface TownTemplate {
  key: string;
  name: string;
  w: number;
  d: number;
  /** The door cell on the footprint's edge, and the way it faces (before rotation). */
  door: { x: number; z: number; facing: number };
  /** Every cell, stage by stage (clearing first), bottom-up within a stage. */
  cells: TownCell[];
}

/** A canvas that records cells instead of drawing into a chunk; the same helper names as structureDefs.ts Canvas. */
class TownCanvas {
  private readonly map = new Map<string, TownCell>();
  stage: TownStage = 'clearing';

  constructor(readonly w: number, readonly d: number) {}

  set(x: number, y: number, z: number, block: string, facing: number = Facing.North): void {
    // Footprint only, except the doorstep row (y = -1), which lies outside it.
    if (y >= 0 && (x < 0 || z < 0 || x >= this.w || z >= this.d)) return;
    this.map.set(`${x},${y},${z}`, { x, y, z, block, facing, stage: this.stage });
  }

  /** Forgets a cell set earlier (a doorway left open, a footing left out). */
  unset(x: number, y: number, z: number): void {
    this.map.delete(`${x},${y},${z}`);
  }

  /** A solid box, inclusive corners. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: string): void {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, block);
  }

  /** The perimeter of a rectangle at height y; `corners` false leaves the four corners out. */
  perimeter(x0: number, z0: number, x1: number, z1: number, y: number, block: string, corners = true): void {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
        const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
        if (corner && !corners) continue;
        this.set(x, y, z, block);
      }
    }
  }

  /** A layer at height y over x0..x1, z0..z1: pick(x, z) gives the block, or '' to leave the cell alone. */
  fill(x0: number, z0: number, x1: number, z1: number, y: number, pick: (x: number, z: number) => string): void {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const b = pick(x, z);
      if (b) this.set(x, y, z, b);
    }
  }

  /** Cells in stage order, then bottom-up (y, z, x). */
  cells(): TownCell[] {
    const order = new Map(TOWN_STAGES.map((s, i) => [s, i]));
    return [...this.map.values()].sort((a, b) => order.get(a.stage)! - order.get(b.stage)! || a.y - b.y || a.z - b.z || a.x - b.x);
  }
}

type Draw = (c: TownCanvas) => void;

function template(key: string, name: string, w: number, d: number, door: { x: number; z: number; facing: number }, draw: Draw): TownTemplate {
  const c = new TownCanvas(w, d);
  draw(c);
  return { key, name, w, d, door, cells: c.cells() };
}

/**
 * A plain hall: a stone footing, oak posts and beams, plank walls with a door and windows, and a roof. The doorway is cleared
 * (clearing stage) and its doorstep filled from the bay; the footing and walls leave the doorway open.
 */
function hall(c: TownCanvas, o: { h: number; doorX: number; windows: [number, number, number][]; roof: 'hip' | 'flat' }): void {
  const X = c.w - 1;
  const Z = c.d - 1;
  // Frame: a stone footing (not in the doorway), corner posts, and oak beams round the top.
  c.stage = 'frame';
  c.perimeter(0, 0, X, Z, 0, 'stone_brick', false);
  c.unset(o.doorX, 0, Z);
  for (const [x, z] of [[0, 0], [X, 0], [0, Z], [X, Z]] as const) c.box(x, 0, z, x, o.h - 1, z, 'oak_log');
  c.perimeter(0, 0, X, Z, o.h - 1, 'oak_log', false);
  // Walls: planks between the beams, a doorway and windows of glass.
  c.stage = 'walls';
  for (let y = 1; y < o.h - 1; y++) c.perimeter(0, 0, X, Z, y, 'plank', false);
  c.unset(o.doorX, 1, Z);
  for (const [x, z, y] of o.windows) c.set(x, y, z, 'glass');
  // Roof: a flat deck, or stepped layers up to a peak.
  c.stage = 'roof';
  if (o.roof === 'flat') c.box(0, o.h, 0, X, o.h, Z, 'plank');
  else for (let k = 0; k <= Math.floor((Math.min(c.w, c.d) - 1) / 2); k++) c.box(k, o.h + k, k, X - k, o.h + k, Z - k, 'plank');
  // Clearing (set last, so no later stage overwrites it): the doorway's floor cell is clear, its doorstep is filled.
  c.stage = 'clearing';
  c.set(o.doorX, 0, Z, 'air');
  c.set(o.doorX, -1, Z + 1, 'dirt');
  // Finish: a floor inside.
  c.stage = 'finish';
  c.box(1, 0, 1, X - 1, 0, Z - 1, 'plank');
}

/** The storage bay (the first building): an open-fronted shed of posts and a roof over crates, which hold Gruk's materials. */
const STORAGE_BAY = template('storage_bay', 'Storage Bay', 7, 5, { x: 3, z: 4, facing: Facing.South }, (c) => {
  c.stage = 'frame';
  c.perimeter(0, 0, 6, 4, 0, 'stone_brick', false);
  c.unset(3, 0, 4);
  for (const [x, z] of [[0, 0], [6, 0], [0, 4], [6, 4]] as const) c.box(x, 0, z, x, 2, z, 'oak_log');
  c.perimeter(0, 0, 6, 4, 2, 'oak_log', false);
  c.stage = 'walls';
  c.box(1, 1, 0, 5, 1, 0, 'plank');
  c.box(0, 1, 1, 0, 1, 3, 'plank');
  c.box(6, 1, 1, 6, 1, 3, 'plank');
  c.stage = 'roof';
  c.box(0, 3, 0, 6, 3, 4, 'plank');
  c.stage = 'clearing';
  c.set(3, 0, 4, 'air');
  c.set(3, -1, 5, 'dirt');
  c.stage = 'finish';
  // The one stock crate (buildBoard.ts BAY_CRATE): the bay's stock lives in it, and the player can open it.
  c.set(3, 0, 1, 'crate');
  c.set(3, 2, 1, 'torch');
});

const COTTAGE = template('cottage', 'Cottage', 7, 7, { x: 3, z: 6, facing: Facing.South }, (c) => {
  hall(c, { h: 4, doorX: 3, windows: [[0, 3, 1], [0, 3, 2], [6, 3, 1], [6, 3, 2], [3, 0, 1], [3, 0, 2]], roof: 'hip' });
  c.stage = 'finish';
  c.set(1, 1, 1, 'torch');
  c.set(5, 1, 5, 'torch');
  c.set(5, 1, 1, 'workbench');
  c.set(1, 1, 5, 'crate');
});

const WORKSHOP = template('workshop', 'Workshop', 9, 7, { x: 4, z: 6, facing: Facing.South }, (c) => {
  hall(c, { h: 4, doorX: 4, windows: [[0, 3, 1], [0, 3, 2], [8, 3, 1], [8, 3, 2]], roof: 'flat' });
  c.stage = 'frame';
  c.box(4, 0, 0, 4, 3, 0, 'oak_log');
  c.stage = 'finish';
  c.set(7, 1, 3, 'furnace_clay', Facing.West);
  c.set(1, 1, 1, 'torch');
  c.set(7, 1, 5, 'torch');
  c.set(2, 1, 5, 'workbench');
  c.set(1, 1, 3, 'crate');
});

const WELL_PLAZA = template('well_plaza', 'Well and Plaza', 9, 9, { x: 4, z: 8, facing: Facing.South }, (c) => {
  c.stage = 'frame';
  c.perimeter(3, 3, 5, 5, 0, 'stone_brick');
  for (const [x, z] of [[3, 3], [5, 3], [3, 5], [5, 5]] as const) c.box(x, 1, z, x, 2, z, 'oak_log');
  c.stage = 'walls';
  c.fill(0, 0, 8, 8, 0, (x, z) => (x >= 3 && x <= 5 && z >= 3 && z <= 5 ? '' : 'gravel'));
  c.perimeter(3, 3, 5, 5, 1, 'stone_brick', false);
  c.stage = 'roof';
  c.box(3, 3, 3, 5, 3, 5, 'plank');
  c.stage = 'clearing';
  c.set(4, 0, 4, 'air'); // the well shaft
  c.stage = 'finish';
  for (const [x, z] of [[1, 1], [7, 1], [1, 7], [7, 7]] as const) c.set(x, 1, z, 'torch');
  c.box(1, 1, 4, 2, 1, 4, 'plank');
  c.box(6, 1, 4, 7, 1, 4, 'plank');
});

const LAMP_POST = template('lamp_post', 'Lamp Post', 1, 1, { x: 0, z: 0, facing: Facing.South }, (c) => {
  c.stage = 'frame';
  c.set(0, 0, 0, 'stone_brick');
  c.box(0, 1, 0, 0, 3, 0, 'oak_log');
  c.stage = 'walls';
  c.set(0, 4, 0, 'glass');
  c.stage = 'roof';
  c.set(0, 5, 0, 'plank');
  c.stage = 'clearing';
  c.set(0, -1, 1, 'dirt');
  c.stage = 'finish';
  c.set(0, 6, 0, 'torch');
});

/** The presaved library, by key. */
export const TOWN_TEMPLATES: Readonly<Record<string, TownTemplate>> = {
  [STORAGE_BAY.key]: STORAGE_BAY,
  [COTTAGE.key]: COTTAGE,
  [WORKSHOP.key]: WORKSHOP,
  [WELL_PLAZA.key]: WELL_PLAZA,
  [LAMP_POST.key]: LAMP_POST,
};

/** The template with `key`, or null. */
export function townTemplate(key: string): TownTemplate | null {
  if (Object.prototype.hasOwnProperty.call(TOWN_TEMPLATES, key)) return TOWN_TEMPLATES[key];
  // The lodge and its upgrade stages (lodge.ts) are built on the same plots; they are not in the 9 x 9 library.
  return lodgeTemplateFor(key);
}

/**
 * A footprint cell turned `rot` quarter turns clockwise (0..3) inside a w x d template. Returns the new cell and facing.
 * Cells and facings turn together, so a door stays on its door.
 */
export function rotateCell(x: number, z: number, w: number, d: number, rot: number, facing: number): { x: number; z: number; facing: number } {
  const r = ((rot % 4) + 4) % 4;
  const f = (facing + r) & 3;
  if (r === 1) return { x: d - 1 - z, z: x, facing: f };
  if (r === 2) return { x: w - 1 - x, z: d - 1 - z, facing: f };
  if (r === 3) return { x: z, z: w - 1 - x, facing: f };
  return { x, z, facing: f };
}

/** The footprint of a template after `rot` quarter turns. */
export function footprintOf(t: TownTemplate, rot: number): { w: number; d: number } {
  return rot % 2 === 1 || rot % 2 === -1 ? { w: t.d, d: t.w } : { w: t.w, d: t.d };
}
