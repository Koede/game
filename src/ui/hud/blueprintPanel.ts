/**
 * The blueprint part of the build chip (docs/api/blueprint.md): shown while the Builder's Square is in hand or a build is under
 * way. Capture: tap two corners (Use), the box is outlined with a ghost and its materials listed, Save confirms. Place: pick
 * a saved blueprint, tap the spot, the ghost shows the copy, Raise starts a builder on it. Works the same with touch and mouse
 * (the buttons are ordinary buttons; corners come from Use). The rules are src/game/blueprints.ts; the app binds them here.
 */
import type { GameBus } from '../../core/context';
import { itemOrNull } from '../../core/registry';
import type { IWorld } from '../../core/types';
import { BLUEPRINT_TOOL, Blueprints, edgeCells, materialsText, siteGhost, type BlueprintResult } from '../../game/blueprints';
import type { PlayerState } from '../../game/playerState';
import { h, setText } from '../kit/dom';

const GHOST_KEY = 'blueprint';

let bound: Blueprints | null = null;
/** The app hands the session's Blueprints in (null on dispose). */
export function bindBlueprints(b: Blueprints | null): void {
  bound = b;
}

export class BlueprintPanel {
  readonly el: HTMLDivElement;
  private readonly status: HTMLParagraphElement;
  private readonly mats: HTMLParagraphElement;
  private readonly modeBtn: HTMLButtonElement;
  private readonly pickBtn: HTMLButtonElement;
  private readonly confirmBtn: HTMLButtonElement;
  private readonly cancelBtn: HTMLButtonElement;
  private readonly sitesEl: HTMLParagraphElement;
  private shownRev = -1;
  private ghostUp = false;

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    private readonly bus: GameBus,
  ) {
    const btn = (action: string, fn: () => void): HTMLButtonElement => {
      const b = h('button', { class: 'hw-quick__item', attrs: { type: 'button', 'data-action': action } });
      b.addEventListener('click', fn);
      return b;
    };
    this.status = h('p', { class: 'hw-bp__line', attrs: { 'data-testid': 'blueprint-status' } });
    this.mats = h('p', { class: 'hw-bp__line hw-bp__mats', attrs: { 'data-testid': 'blueprint-materials' } });
    this.sitesEl = h('p', { class: 'hw-bp__line hw-bp__sites' });
    this.modeBtn = btn('bp-mode', () => this.with((b) => b.setMode(b.mode === 'capture' ? 'place' : 'capture')));
    this.pickBtn = btn('bp-pick', () => this.with((b) => b.cycle()));
    this.confirmBtn = btn('bp-confirm', () => this.with((b) => this.say(b.confirm(this.world))));
    this.cancelBtn = btn('bp-cancel', () => this.with((b) => b.cancel()));
    setText(this.cancelBtn, 'Cancel');
    this.el = h('div', { class: 'hw-bp', attrs: { 'data-testid': 'blueprint-panel' } }, this.status, this.mats, this.confirmBtn, this.cancelBtn, this.pickBtn, this.modeBtn, this.sitesEl);
    this.el.hidden = true;
  }

  private with(fn: (b: Blueprints) => void): void {
    if (!bound) return;
    fn(bound);
    this.shownRev = -1;
    this.update();
  }

  private say(r: BlueprintResult): void {
    this.bus.emit('toast', { text: r.text, kind: r.ok ? 'good' : 'warn' });
    this.bus.emit('sfx', { name: r.ok ? 'place' : 'error' });
  }

  /** True while the panel shows (the chip stays up for it). */
  get active(): boolean {
    return !this.el.hidden;
  }

  /** A few times per second. */
  update(): void {
    const b = bound;
    const holding = this.player.heldStack()?.item === BLUEPRINT_TOOL;
    const show = b !== null && (holding || b.sites.length > 0);
    this.el.hidden = !show;
    if (!b || !holding) this.clearGhost();
    if (!b || !show) return;
    // Sites change every few ticks; the rest only when the revision moves.
    const sites = b.sites.map((s) => {
      const j = s.job;
      return j.state === 'waiting' ? `${j.bp.name}: waiting for ${itemOrNull(j.missing ?? '')?.name ?? j.missing}` : `${j.bp.name}: ${Math.round(j.progress * 100)}%`;
    });
    setText(this.sitesEl, sites.length > 0 ? `Building - ${sites.join('; ')}` : '');
    this.sitesEl.hidden = sites.length === 0;
    for (const el of [this.status, this.mats, this.modeBtn, this.pickBtn, this.confirmBtn, this.cancelBtn]) el.hidden = !holding;
    if (!holding || b.revision === this.shownRev) return;
    this.shownRev = b.revision;
    const bp = b.current;
    setText(this.modeBtn, b.mode === 'capture' ? (b.saved.length > 0 ? 'Place a blueprint' : 'Capture mode') : 'Capture a new one');
    this.modeBtn.disabled = b.mode === 'capture' && b.saved.length === 0;
    this.pickBtn.hidden = b.mode !== 'place' || b.saved.length < 2;
    setText(this.pickBtn, `Next blueprint (${b.selected + 1}/${b.saved.length})`);
    if (b.mode === 'capture') {
      const size = b.boxSize();
      setText(this.status, !b.cornerA ? 'Tap a block: corner 1' : !b.cornerB ? 'Tap the opposite corner' : `Box ${size?.join('x')}`);
      const list = b.cornerB ? b.materials(this.world) : [];
      setText(this.mats, b.cornerB ? (list.length > 0 ? `Needs ${materialsText(list, 6)}` : 'Nothing to save in this box') : '');
      setText(this.confirmBtn, 'Save blueprint');
      this.confirmBtn.hidden = !b.cornerB;
      this.cancelBtn.hidden = !b.cornerA;
    } else {
      setText(this.status, bp ? (b.origin ? `${bp.name} (${bp.size.join('x')}) here?` : `${bp.name}: tap where it goes`) : 'No blueprint saved yet');
      setText(this.mats, bp ? `Needs ${materialsText(b.materials(this.world), 6)} from the chests near the site` : '');
      setText(this.confirmBtn, 'Raise it here');
      this.confirmBtn.hidden = !b.origin;
      this.cancelBtn.hidden = !b.origin;
    }
    this.mats.hidden = this.mats.textContent === '';
    this.showGhost(b);
  }

  private showGhost(b: Blueprints): void {
    const box = b.outline();
    const bp = b.current;
    const cells = !box ? [] : b.mode === 'place' && bp && b.origin ? siteGhost(this.world, bp, b.origin) : edgeCells(box.lo, box.hi, 'glass');
    if (cells.length === 0) return this.clearGhost();
    this.bus.emit('ghost:show', { key: GHOST_KEY, cells });
    this.ghostUp = true;
  }

  private clearGhost(): void {
    if (!this.ghostUp) return;
    this.ghostUp = false;
    this.shownRev = -1;
    this.bus.emit('ghost:clear', { key: GHOST_KEY });
  }

  dispose(): void {
    this.clearGhost();
  }
}
