/**
 * Small play-assist state kept with the player (docs/api/assist.md): the pinned recipe, the last hand recipe made,
 * the pickup magnet choice, build undo. Saved in the player snapshot as `assist`; missing in older saves.
 */
import { recipe as recipeById } from '../core/registry';
import type { LootFilter } from './lootFilter';
import type { MagnetMode } from './magnet';

export interface AssistSnapshot {
  pinned?: string | null;
  lastHand?: string | null;
}

export class PlayAssist {
  /** Recipe id the player pinned in a crafting screen (its missing ingredients stay highlighted), or null. */
  pinned: string | null = null;

  /** The last hand recipe made by the player (any route); one tap on the HUD chip repeats it. */
  lastHand: string | null = null;

  /** The item magnet choice (Settings.itemMagnet, copied in by the app; not saved with the world). */
  magnet: MagnetMode = 'off';

  /** The loot filter (Settings.lootFilter, copied in by the app; not saved with the world). */
  lootFilter: LootFilter = 'all';

  /** Pins a recipe; pinning the one already pinned unpins it. Unknown ids are ignored. Returns the new pin. */
  togglePin(id: string): string | null {
    if (this.pinned === id) this.pinned = null;
    else if (recipeById(id)) this.pinned = id;
    return this.pinned;
  }

  toJSON(): AssistSnapshot {
    return { pinned: this.pinned, lastHand: this.lastHand };
  }

  load(s: AssistSnapshot | undefined): void {
    this.lastHand = typeof s?.lastHand === 'string' && recipeById(s.lastHand)?.station === 'hand' ? s.lastHand : null;
    this.pinned = typeof s?.pinned === 'string' && recipeById(s.pinned) ? s.pinned : null;
  }
}
