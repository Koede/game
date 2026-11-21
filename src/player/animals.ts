/**
 * The player's hands on the animals (spec 12.5): which animal is under the crosshair (its box must be hit before
 * any block), Mine on it hits it (damage by the held tool, tool wear 1, the manager's cooldown, knockback and
 * flash), and Use with an item it likes feeds it - decided BEFORE eating and planting, because potatoes and carrots
 * are food too. Any other Use goes on as if no animal were there.
 *
 * The animals are reached through the small AnimalTargets interface (src/mobs' MobManager fits it), so the player
 * module keeps no reference to the manager's internals.
 */
import { REACH } from '../core/constants';
import { CREATURES } from '../core/registry';
import type { PlayerState } from '../game';
import { hitDamage } from '../mobs';
import type { SwingTarget } from './interaction';

/** What the controller needs from the animals. */
export interface AnimalTargets {
  /** Nearest living animal whose box the ray hits within maxDist, or null (the result may be a reused object). */
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): { id: number; distance: number } | null;
  /** Hits an animal for `damage` from (fromX, fromZ); refused (`ok: false`) during its hit cooldown. */
  hit(id: number, damage: number, fromX: number, fromZ: number): { ok: boolean };
  /** Feeds a liked item (the caller takes the item); refused with a reason the player can read. */
  feed(id: number, itemKey: string): { ok: true } | { ok: false; reason: string };
}

/** Advisory toasts, at most once per subject in a while (Interaction.advise). */
export interface Advisor {
  advise(key: string, text: string): void;
}

/** Items some animal likes: Use with one of these on an animal is meant for the animal. */
const LIKED: ReadonlySet<string> = new Set(CREATURES.flatMap((c) => c.likes));
export const likedByAnimals = (itemKey: string): boolean => LIKED.has(itemKey);

export type AnimalUse = 'fed' | 'refused' | 'pass';

export class AnimalHands {
  /** Id of the animal under the crosshair after the last aim(), or null. */
  target: number | null = null;

  constructor(
    private readonly animals: AnimalTargets,
    private readonly player: PlayerState,
    private readonly swing: SwingTarget,
    private readonly advisor: Advisor,
  ) {}

  /**
   * Casts from the eye along `dir` and keeps the animal only when it is nearer than the block the block ray hit
   * (`blockDistance`, Infinity for none). Returns the target id or null.
   */
  aim(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, blockDistance: number): number | null {
    const hit = this.animals.raycast(ox, oy, oz, dx, dy, dz, REACH);
    this.target = hit !== null && hit.distance < blockDistance ? hit.id : null;
    return this.target;
  }

  /** Mine held on the target: one hit whenever the animal's cooldown allows (every 0.4 s while held). */
  strike(): boolean {
    if (this.target === null || this.player.dead) return false;
    const held = this.player.heldStack();
    const p = this.player.position;
    const r = this.animals.hit(this.target, hitDamage(held?.item ?? null), p.x, p.z);
    if (!r.ok) return false;
    this.swing.triggerSwing();
    this.player.wearHeldTool(1);
    return true;
  }

  /**
   * Use on the target. 'fed' (one item taken), 'refused' (an animal food it will not take now: the reason is
   * toasted), or 'pass' when the held item means nothing to animals and Use should act as if none were there.
   */
  use(): AnimalUse {
    if (this.target === null || this.player.dead) return 'pass';
    const held = this.player.heldStack();
    if (!held || !likedByAnimals(held.item)) return 'pass';
    const r = this.animals.feed(this.target, held.item);
    if (r.ok) {
      this.player.consumeHeld(1);
      this.swing.triggerSwing();
      return 'fed';
    }
    // Keyed without numbers: "not ready yet (212 s)" counts down every second.
    this.advisor.advise(`feed:${r.reason.replace(/\d+/g, '')}`, r.reason);
    return 'refused';
  }
}
