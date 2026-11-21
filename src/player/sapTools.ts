/**
 * Tapping pine resin (docs/api/sugar.md): Use with a Glass Beaker in hand on a pine log catches its sap and swaps the
 * empty beaker for a Pine Sap. A tapped log weeps again after TAP_COOLDOWN_S seconds (kept per cell, not saved: a
 * reloaded world has every log ready, which is harmless). Decided BEFORE placing and screens so a beaker aimed at a
 * log never tries to be placed. DOM-free: talks to the player and the bus through a small host.
 */
import type { GameBus } from '../core/context';
import type { PlayerState } from '../game';
import type { RayHit } from './raycast';

/** Seconds before the same log gives sap again. */
export const TAP_COOLDOWN_S = 120;
/** The conifer logs that weep sap. */
export const SAP_LOGS: ReadonlySet<string> = new Set(['pine_log']);
export const EMPTY_BEAKER = 'glass_beaker';
export const SAP_ITEM = 'pine_sap';

export interface SapToolsHost {
  readonly player: PlayerState;
  readonly bus: GameBus;
  advise(key: string, text: string): void;
  swing(): void;
  stopMining(): void;
}

export type SapOutcome = 'tapped' | 'refused';

export class SapTools {
  private clock = 0;
  private readonly tappedAt = new Map<string, number>();

  constructor(private readonly host: SapToolsHost) {}

  /** Advances the weeping clock; call every frame. */
  update(dt: number): void {
    this.clock += dt;
    if (this.tappedAt.size > 256) {
      for (const [cell, at] of this.tappedAt) if (this.clock - at >= TAP_COOLDOWN_S) this.tappedAt.delete(cell);
    }
  }

  /** Seconds until the log at x, y, z weeps again (0 = ready). */
  waitS(x: number, y: number, z: number): number {
    const at = this.tappedAt.get(`${x},${y},${z}`);
    return at === undefined ? 0 : Math.max(0, TAP_COOLDOWN_S - (this.clock - at));
  }

  /** Use on a pine log with an empty beaker held; null when this is not that situation (the tap carries on as before). */
  use(hit: RayHit): SapOutcome | null {
    const { player } = this.host;
    if (hit.block.liquid !== null || !SAP_LOGS.has(hit.block.key)) return null;
    // A glass vial works as well as a beaker (src/content/itemsGlass.ts); the sap comes back as a beaker of sap.
    const held = player.heldStack()?.item;
    if (held !== EMPTY_BEAKER && held !== 'glass_vial') return null;
    const cell = `${hit.x},${hit.y},${hit.z}`;
    const wait = this.waitS(hit.x, hit.y, hit.z);
    this.host.stopMining();
    if (wait > 0) {
      this.host.advise(`sap-${cell}`, `This log is still weeping: give it ${Math.ceil(wait / 10) * 10} s`);
      return 'refused';
    }
    player.inventory.removeAt(player.selectedSlot, 1);
    if (player.give(SAP_ITEM, 1) > 0) {
      // No room for the sap: put the glass back and leave the log alone.
      player.give(held, 1);
      this.host.advise(`sap-full-${cell}`, 'Your pack is full');
      return 'refused';
    }
    this.tappedAt.set(cell, this.clock);
    this.host.bus.emit('sfx', { name: 'sip', x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 });
    this.host.bus.emit('toast', { text: 'You catch a beaker of sticky sap', kind: 'good', item: SAP_ITEM });
    this.host.swing();
    return 'tapped';
  }
}
