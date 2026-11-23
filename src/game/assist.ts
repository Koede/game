/**
 * Small play-assist state kept with the player (docs/api/assist.md): the pinned recipe, the last hand recipe made,
 * the pickup magnet choice, build undo. Saved in the player snapshot as `assist`; missing in older saves.
 */
import { recipe as recipeById } from '../core/registry';

export interface AssistSnapshot {
  pinned?: string | null;
  lastHand?: string | null;
}

export class PlayAssist {
  /** Recipe id the player pinned in a crafting screen (its missing ingredients stay highlighted), or null. */
  pinned: string | null = null;

  /** Pins a recipe; pinning the one already pinned unpins it. Unknown ids are ignored. Returns the new pin. */
  togglePin(id: string): string | null {
    if (this.pinned === id) this.pinned = null;
    else if (recipeById(id)) this.pinned = id;
    return this.pinned;
  }

  toJSON(): AssistSnapshot {
    return { pinned: this.pinned };
  }

  load(s: AssistSnapshot | undefined): void {
    this.pinned = typeof s?.pinned === 'string' && recipeById(s.pinned) ? s.pinned : null;
  }
}
