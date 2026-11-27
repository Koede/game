/**
 * Ruined old-age machines (docs/api/restoration.md): a rusted machine stands in the Old Factory and the Chem Lab. Use it
 * with the right parts in your pack and it is repaired (the block becomes `repaired_machine`): you learn, at once and
 * without the research, how to build one recipe the notebook would otherwise gate. Each machine's job is a pure function
 * of the world seed and its position. Optional: every recipe stays reachable through research.
 */
import type { GameBus } from '../core/context';
import { hash32 } from '../core/math';
import { block as blockByKey, itemOrNull } from '../core/registry';
import { makeVoxel, type IWorld } from '../core/types';
import type { PlayerState } from './playerState';

export const RUINED_BLOCK = 'ruined_machine';
export const REPAIRED_BLOCK = 'repaired_machine';

export interface RepairJob { recipe: string; name: string; parts: ReadonlyArray<readonly [string, number]> }

/** Every job, from the Ember-adjacent to the Forge age: the recipe it unlocks must be gated by research (tests check). */
export const REPAIR_JOBS: readonly RepairJob[] = [
  { recipe: 'vis_rod', name: 'old vis press', parts: [['copper_ingot', 2], ['glass', 1]] },
  { recipe: 'essentia_tube', name: 'old glass drawer', parts: [['bronze_plate', 2], ['glass', 2]] },
  { recipe: 'arcane_workbench', name: 'old bench engine', parts: [['bronze_plate', 3], ['leather', 1], ['glass', 1]] },
  { recipe: 'rune_desk', name: 'old rune engraver', parts: [['bronze_plate', 4], ['copper_coil', 1]] },
  { recipe: 'iron_rod', name: 'old rod forge', parts: [['iron_plate', 4], ['copper_coil', 2]] },
  { recipe: 'infusion_altar', name: 'old infusion rig', parts: [['iron_plate', 6], ['copper_coil', 2], ['glass', 2]] },
];

/** The job of the machine at a position (stable for a world). */
export const jobAt = (seed: number, x: number, y: number, z: number): RepairJob => REPAIR_JOBS[hash32(seed ^ 0x4e9a, x, y, z) % REPAIR_JOBS.length];

const nameOf = (item: string): string => itemOrNull(item)?.name ?? item;

export class Restoration {
  private done = new Set<string>();

  constructor(private readonly world: IWorld, private readonly bus: GameBus, private readonly player: PlayerState) {}

  /** True when a repaired machine has taught this recipe. */
  unlocked(recipeId: string): boolean { return this.done.has(recipeId); }

  /** The CraftGate to install: a repaired machine overrides the research gate. */
  gate(inner: (id: string) => string | null): (id: string) => string | null {
    return (id) => (this.done.has(id) ? null : inner(id));
  }

  use(aim: { x: number; y: number; z: number; block: { key: string } } | null): 'worked' | 'refused' | null {
    if (!aim || aim.block.key !== RUINED_BLOCK) return null;
    const job = jobAt(this.world.seed, aim.x, aim.y, aim.z);
    const inv = this.player.inventory;
    const missing = job.parts.filter(([item, n]) => inv.count(item) < n);
    const toast = (text: string, kind: 'info' | 'good' | 'warn' = 'info'): void => this.bus.emit('toast', { text, kind });
    const target = nameOf(job.recipe);
    if (missing.length > 0) {
      const list = job.parts.map(([item, n]) => `${n} ${nameOf(item)}`).join(', ');
      toast(`An ${job.name}. Bring ${list} to repair it; it would teach you the ${target}.`);
      return 'refused';
    }
    if (this.done.has(job.recipe)) {
      toast(`The ${job.name} is beyond help: you already know the ${target}.`, 'warn');
      return 'refused';
    }
    for (const [item, n] of job.parts) inv.remove(item, n);
    this.world.setVoxel(aim.x, aim.y, aim.z, makeVoxel(blockByKey(REPAIRED_BLOCK).id));
    this.done.add(job.recipe);
    this.bus.emit('sfx', { name: 'age' });
    toast(`The ${job.name} shudders awake. You now know how to build the ${target}.`, 'good');
    return 'worked';
  }

  toJSON(): string[] { return [...this.done]; }

  load(raw: unknown): void {
    this.done = new Set(Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string') : []);
  }
}
