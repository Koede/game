/**
 * Old plans (docs/api/old-plans.md): the playable layer. Use a plan item (src/content/oldPlans.ts) to read it: the plan joins
 * the player's collection (saved with the world) and a rare drawing is kept in the pack if already known. Each known plan is a
 * Blueprint (src/game/blueprint.ts) the blueprint tools can list and the builders raise. DOM-free; the app's `beforeUse` hook calls `use`.
 */
import type { GameBus } from '../core/context';
import { planById, planOfItem, OLD_PLANS, type OldPlanSpec } from '../content/oldPlans';
import type { ItemStack } from '../core/types';
import type { Blueprint, BlueprintCell } from './blueprint';
import type { PlayerState } from './playerState';

/** The Blueprint a plan draws: one cell per non-air letter of its layout, origin at the north-west bottom corner. */
export function planBlueprint(spec: OldPlanSpec): Blueprint {
  const cells: BlueprintCell[] = [];
  let w = 0;
  let d = 0;
  spec.layers.forEach((rows, dy) => {
    d = Math.max(d, rows.length);
    rows.forEach((row, dz) => {
      w = Math.max(w, row.length);
      [...row].forEach((ch, dx) => {
        if (ch === '.') return;
        const block = spec.legend[ch];
        if (!block) throw new Error(`plan ${spec.id}: "${ch}" is not in its legend`);
        cells.push({ dx, dy, dz, block, facing: 0 });
      });
    });
  });
  return { name: spec.title.replace(/^Plan of an? /, ''), size: [w, spec.layers.length, d], cells };
}

export class OldPlans {
  private known = new Set<string>();

  constructor(private readonly bus: GameBus, private readonly player: PlayerState) {}

  has(id: string): boolean { return this.known.has(id); }

  /** The plans the player has read, in the order of the plan table. */
  list(): OldPlanSpec[] { return OLD_PLANS.filter((p) => this.known.has(p.id)); }

  /** The known plans as Blueprints (the hook the blueprint screen reads). */
  blueprints(): Blueprint[] { return this.list().map(planBlueprint); }

  blueprintOf(id: string): Blueprint | null {
    const spec = planById(id);
    return spec && this.known.has(id) ? planBlueprint(spec) : null;
  }

  /** Teaches a plan directly (tests, rewards). True when it was new. */
  learn(id: string): boolean {
    if (!planById(id) || this.known.has(id)) return false;
    this.known.add(id);
    return true;
  }

  use(held: ItemStack | null): 'worked' | 'refused' | null {
    const spec = planOfItem(held?.item);
    if (!spec) return null;
    if (this.known.has(spec.id)) {
      this.bus.emit('toast', { text: `You already hold the ${spec.title.toLowerCase()}. This copy is spare.`, kind: 'warn' });
      return 'refused';
    }
    this.known.add(spec.id);
    this.player.consumeHeld(1);
    this.bus.emit('sfx', { name: 'age' });
    const bp = planBlueprint(spec);
    this.bus.emit('toast', { text: `${spec.title}. ${spec.text} (${bp.size[0]}x${bp.size[2]}, ${bp.size[1]} high, ${bp.cells.length} blocks.)`, kind: 'good' });
    return 'worked';
  }

  toJSON(): string[] { return [...this.known]; }

  load(raw: unknown): void {
    this.known = new Set(Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string' && planById(r) !== null) : []);
  }
}
