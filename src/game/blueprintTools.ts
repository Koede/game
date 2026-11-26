/**
 * Blueprint tools (docs/api/blueprint.md): the player's side of blueprints. Mark two corners to save a box as a blueprint
 * (machines included; entity contents are not kept), pick one from the book, aim to see its placement ghost (blue where it can go,
 * red where something is in the way), turn it with `rotate`, then either build it now from the pack or hand it to Gruk, who
 * raises it over time from the pack as he goes. Pure rules over IWorld and the bus; the HUD panel is src/ui/hud/blueprintPanel.ts.
 */
import type { GameBus } from '../core/context';
import { blockOrNull, itemOrNull } from '../core/registry';
import { WORLD_HEIGHT, makeVoxel, type IWorld } from '../core/types';
import { captureBlueprint, checkSite, itemOfCell, materialsOf, rotateBlueprint, type Blueprint, type SiteCell, MAX_BLUEPRINT_SIDE } from './blueprint';
import type { BlueprintBook } from './blueprintBook';
import type { BuildResult } from './buildTools';
import type { PlayerState } from './playerState';

export const GHOST_KEY = 'blueprint';
/** Ghost cells sent to the renderer at most (blocked ones first). */
export const GHOST_SHOWN = 1024;

const nameOf = (item: string): string => itemOrNull(item)?.name ?? item;

export interface Need {
  item: string;
  need: number;
  have: number;
}

export class BlueprintTools {
  private cornerA: { x: number; y: number; z: number } | null = null;
  private selectedId: string | null = null;
  private turns = 0;
  private lastKey = '';

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    private readonly bus: GameBus,
  ) {}

  get book(): BlueprintBook {
    return this.player.blueprints;
  }

  get pendingCorner(): { x: number; y: number; z: number } | null {
    return this.cornerA;
  }

  get selected(): string | null {
    return this.selectedId;
  }

  get rotation(): number {
    return this.turns;
  }

  /** The selected blueprint in its current turn, or null. */
  current(): Blueprint | null {
    const e = this.selectedId ? this.book.get(this.selectedId) : null;
    return e ? rotateBlueprint(e.bp, this.turns) : null;
  }

  /** Marks a corner: the first call starts, the second saves the box between them as a new blueprint. */
  markCorner(x: number, y: number, z: number): BuildResult {
    if (!this.cornerA) {
      this.cornerA = { x, y, z };
      return { ok: true, text: 'Corner 1 set - aim at the opposite corner and mark again' };
    }
    const a = this.cornerA;
    this.cornerA = null;
    const size = { x: Math.abs(x - a.x) + 1, y: Math.abs(y - a.y) + 1, z: Math.abs(z - a.z) + 1 };
    if (size.x > MAX_BLUEPRINT_SIDE || size.y > MAX_BLUEPRINT_SIDE || size.z > MAX_BLUEPRINT_SIDE) {
      return { ok: false, text: `Too big: ${size.x}x${size.y}x${size.z} (the most is ${MAX_BLUEPRINT_SIDE} on a side)` };
    }
    const name = `Layout ${this.book.entries.length + 1}`;
    const bp = captureBlueprint(this.world, [a.x, a.y, a.z], [x, y, z], name);
    if (!bp) return { ok: false, text: size.x * size.y * size.z > 4096 ? 'Too many blocks for one blueprint' : 'Nothing to save there' };
    const entry = this.book.add(bp);
    if (!entry) return { ok: false, text: 'The blueprint book is full - delete one first' };
    return { ok: true, text: `Saved "${name}": ${bp.cells.length} blocks (${bp.size.join('x')})` };
  }

  cancelMark(): void {
    this.cornerA = null;
  }

  /** Picks the blueprint to place (null puts it away) and turns it back to its first facing. */
  select(id: string | null): void {
    this.selectedId = id && this.book.get(id) ? id : null;
    this.turns = 0;
    if (!this.selectedId) this.clearGhost();
    else this.lastKey = '';
  }

  rotate(): void {
    this.turns = (this.turns + 1) & 3;
    this.lastKey = '';
  }

  /** The materials of the selected blueprint against the pack (Dev Mode free placing needs none). */
  needs(bp: Blueprint | null = this.current()): Need[] {
    if (!bp) return [];
    return materialsOf(bp).map((m) => ({ item: m.item, need: m.count, have: this.player.inventory.count(m.item) }));
  }

  /** The low corner of a placement whose first free cell sits at the aimed cell (the cell next to the aimed face). */
  originAt(px: number, py: number, pz: number): [number, number, number] {
    return [px, py, pz];
  }

  /**
   * Shows (or moves) the placement ghost at the aimed cell. Call a few times a second; it re-sends only when something changed.
   * Returns the site cells, or null with nothing selected.
   */
  showGhost(px: number, py: number, pz: number): SiteCell[] | null {
    const bp = this.current();
    if (!bp) return null;
    const site = checkSite(this.world, bp, this.originAt(px, py, pz));
    const shown = site.filter((c) => c.state === 'blocked').concat(site.filter((c) => c.state === 'free')).slice(0, GHOST_SHOWN);
    const key = `${px},${py},${pz},${this.turns},${this.selectedId},${shown.map((c) => (c.state === 'blocked' ? 1 : 0)).join('')}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.bus.emit('ghost:show', { key: GHOST_KEY, cells: shown.map((c) => ({ x: c.x, y: c.y, z: c.z, block: c.block, state: c.state === 'blocked' ? 'wrong' : 'missing' })) });
    }
    return site;
  }

  clearGhost(): void {
    if (this.lastKey !== '') this.bus.emit('ghost:clear', { key: GHOST_KEY });
    this.lastKey = '';
  }

  /** Why the placement at `origin` cannot start, or null. Cells already right are fine; blocked cells are skipped by the build. */
  private refusal(bp: Blueprint, origin: readonly [number, number, number]): string | null {
    if (origin[1] < 0 || origin[1] + bp.size[1] > WORLD_HEIGHT) return 'That does not fit under the sky there';
    for (const c of [{ x: origin[0], z: origin[2] }, { x: origin[0] + bp.size[0] - 1, z: origin[2] + bp.size[2] - 1 }]) {
      if (!this.world.isLoaded(c.x, c.z)) return 'That ground is not loaded yet';
    }
    return null;
  }

  /** Builds the selected blueprint at once from the pack: each free cell costs one item; what cannot be paid for is skipped. */
  placeNow(px: number, py: number, pz: number): BuildResult {
    const bp = this.current();
    if (!bp) return { ok: false, text: 'Pick a blueprint first' };
    const origin = this.originAt(px, py, pz);
    const why = this.refusal(bp, origin);
    if (why) return { ok: false, text: why };
    const free = this.player.dev && this.player.devFreePlace;
    const byKey = new Map(bp.cells.map((c) => [`${c.dx},${c.dy},${c.dz}`, c]));
    let placed = 0;
    let blocked = 0;
    const short = new Map<string, number>();
    for (const s of checkSite(this.world, bp, origin).sort((a, b) => a.y - b.y)) {
      if (s.state === 'right') continue;
      if (s.state === 'blocked') {
        blocked++;
        continue;
      }
      const c = byKey.get(`${s.x - origin[0]},${s.y - origin[1]},${s.z - origin[2]}`);
      if (!c) continue;
      const item = itemOfCell(c);
      if (!free && this.player.inventory.count(item) < 1) {
        short.set(item, (short.get(item) ?? 0) + 1);
        continue;
      }
      const voxel = blockVoxel(c.block, c.facing);
      if (voxel < 0 || !this.world.setVoxel(s.x, s.y, s.z, voxel, 'player')) {
        blocked++;
        continue;
      }
      if (!free) this.player.inventory.remove(item, 1);
      placed++;
    }
    if (placed > 0) this.bus.emit('sfx', { name: 'place', x: origin[0] + 0.5, y: origin[1] + 0.5, z: origin[2] + 0.5 });
    const parts = [`Built ${placed} of ${bp.cells.length} blocks`];
    if (short.size > 0) parts.push(`missing ${[...short].map(([i, n]) => `${n} ${nameOf(i)}`).join(', ')}`);
    if (blocked > 0) parts.push(`${blocked} spots blocked`);
    return { ok: placed > 0, text: parts.join(', ') };
  }

  /** Hands the selected blueprint to Gruk: he raises it with his low corner at the aimed cell, drawing from the pack as he goes. */
  commission(px: number, py: number, pz: number): BuildResult {
    const bp = this.current();
    if (!bp) return { ok: false, text: 'Pick a blueprint first' };
    const origin = this.originAt(px, py, pz);
    const why = this.refusal(bp, origin);
    if (why) return { ok: false, text: why };
    const job = this.book.commission(bp, origin);
    if (!job) return { ok: false, text: 'Gruk has his hands full - cancel a build first' };
    this.clearGhost();
    this.selectedId = null;
    return { ok: true, text: `Gruk takes on the ${bp.name}. Keep the materials in your pack and stay close` };
  }
}

/** The voxel for a block key and facing, or -1 for an unknown block. */
function blockVoxel(key: string, facing: number): number {
  const def = blockOrNull(key);
  return def ? makeVoxel(def.id, facing as never) : -1;
}
