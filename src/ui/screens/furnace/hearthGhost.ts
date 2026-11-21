/**
 * The hearth ghost preview (spec 17.4) outlives the furnace screen: once the player turns it on it stays in the world
 * while they build, follows every block they place or break inside the planned shell, and goes away when the hearth
 * forms at the target tier, when every block is in place, when the furnace is gone, or when the player turns it off.
 * The UI only asks ('ghost:show' / 'ghost:clear'); the renderer draws. DOM-free.
 */
import type { GameBus } from '../../../core/context';
import type { StructureTarget, StructureView } from '../../../sim';
import { ghostCells, ghostKey } from './structureText';

export interface StructureSource {
  structureView(x: number, y: number, z: number, target?: StructureTarget): StructureView | null;
}

interface Preview {
  x: number;
  y: number;
  z: number;
  key: string;
  target: StructureTarget;
  min: [number, number, number];
  max: [number, number, number];
}

const posKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export class HearthGhost {
  private readonly previews = new Map<string, Preview>();
  /** The target the player last chose per furnace (kept for the session, so the tab reopens on it). */
  private readonly targets = new Map<string, StructureTarget>();
  private readonly offs: (() => void)[] = [];
  private readonly dirty = new Set<string>();
  private flushQueued = false;

  constructor(private readonly bus: GameBus, private readonly sim: StructureSource) {
    this.offs.push(
      bus.on('block:changed', ({ x, y, z }) => this.onChange(x, y, z)),
      bus.on('hearth:formed', ({ x, y, z, tier }) => {
        const p = this.previews.get(posKey(x, y, z));
        if (p && tier >= p.target.tier) this.hide(x, y, z);
      }),
      bus.on('machine:removed', ({ entity }) => {
        if (entity.kind === 'furnace') {
          this.hide(entity.x, entity.y, entity.z);
          this.targets.delete(posKey(entity.x, entity.y, entity.z));
        }
      }),
    );
  }

  /** The preview of this furnace is on. */
  isShown(x: number, y: number, z: number): boolean {
    return this.previews.has(posKey(x, y, z));
  }

  /** The target the player chose for this furnace, if any. */
  target(x: number, y: number, z: number): StructureTarget | undefined {
    const t = this.targets.get(posKey(x, y, z));
    return t ? { tier: t.tier, inner: t.inner ? [...t.inner] : undefined } : undefined;
  }

  /** Remembers the player's choice; a preview that is on follows it (cleared, then shown for the new target). */
  choose(x: number, y: number, z: number, target: StructureTarget): void {
    const k = posKey(x, y, z);
    this.targets.set(k, { tier: target.tier, inner: target.inner ? [...target.inner] : undefined });
    const p = this.previews.get(k);
    if (!p) return;
    this.bus.emit('ghost:clear', { key: p.key });
    p.target = this.targets.get(k) as StructureTarget;
    this.emit(p);
  }

  /** Turns the preview on for this target. False when there is nothing to show (no furnace, or every block in place). */
  show(x: number, y: number, z: number, target: StructureTarget): boolean {
    const k = posKey(x, y, z);
    this.targets.set(k, { tier: target.tier, inner: target.inner ? [...target.inner] : undefined });
    const p: Preview = { x, y, z, key: ghostKey(x, y, z), target: this.targets.get(k) as StructureTarget, min: [0, 0, 0], max: [0, 0, 0] };
    this.previews.set(k, p);
    return this.emit(p);
  }

  /** Turns the preview off ('ghost:clear'). */
  hide(x: number, y: number, z: number): void {
    const p = this.previews.get(posKey(x, y, z));
    if (!p) return;
    this.previews.delete(posKey(x, y, z));
    this.bus.emit('ghost:clear', { key: p.key });
  }

  dispose(): void {
    for (const p of [...this.previews.values()]) this.hide(p.x, p.y, p.z);
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  /** Recomputes the cells and shows them; hides the preview when nothing is left to place or break. */
  private emit(p: Preview): boolean {
    const view = this.sim.structureView(p.x, p.y, p.z, p.target);
    if (!view) {
      this.hide(p.x, p.y, p.z);
      return false;
    }
    // Keep the size the sim fitted, so the preview does not jump as the scanned box changes under construction.
    p.target = { tier: view.target.tier, inner: [...view.target.inner] };
    p.min = view.target.min;
    p.max = view.target.max;
    const cells = ghostCells(view);
    if (cells.length === 0) {
      this.hide(p.x, p.y, p.z);
      return false;
    }
    this.bus.emit('ghost:show', { key: p.key, cells });
    return true;
  }

  private onChange(x: number, y: number, z: number): void {
    for (const [k, p] of this.previews) {
      if (x < p.min[0] || x > p.max[0] || y < p.min[1] || y > p.max[1] || z < p.min[2] || z > p.max[2]) continue;
      this.dirty.add(k);
    }
    if (this.dirty.size === 0 || this.flushQueued) return;
    // After every other listener (the simulation marks its scans due on the same event): one update per burst.
    this.flushQueued = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.flushQueued = false;
    const keys = [...this.dirty];
    this.dirty.clear();
    for (const k of keys) {
      const p = this.previews.get(k);
      if (p) this.emit(p);
    }
  }
}

const keepers = new WeakMap<GameBus, HearthGhost>();

/** The one keeper of a game (bus): created by the first furnace screen, it then lives as long as the game. */
export function ghostFor(bus: GameBus, sim: StructureSource): HearthGhost {
  let g = keepers.get(bus);
  if (!g) {
    g = new HearthGhost(bus, sim);
    keepers.set(bus, g);
  }
  return g;
}
