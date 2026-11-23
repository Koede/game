/**
 * The build chip (docs/api/assist.md): Undo for the last placements, and copy-paste of up to 8x8x8 by aim. Shown while there is
 * something to undo, a copy in progress, or a block in hand. Keys on a keyboard: Z undo, C mark corner, V paste.
 */
import type { GameBus } from '../../core/context';
import { REACH } from '../../core/constants';
import { blockOfItem } from '../../core/registry';
import type { IWorld } from '../../core/types';
import { BuildTools, type BuildResult } from '../../game/buildTools';
import type { PlayerState } from '../../game/playerState';
import { createRayHit, raycast } from '../../player/raycast';
import { h, setAttr, setText } from '../kit/dom';
import { glyph } from '../kit/icons';

export class BuildChip {
  readonly el: HTMLDivElement;
  readonly tools: BuildTools;
  private readonly undoBtn: HTMLButtonElement;
  private readonly more: HTMLButtonElement;
  private readonly menu: HTMLDivElement;
  private readonly markBtn: HTMLButtonElement;
  private readonly pasteBtn: HTMLButtonElement;
  private readonly cancelBtn: HTMLButtonElement;
  private readonly hit = createRayHit();
  private readonly dir = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    private readonly bus: GameBus,
  ) {
    this.tools = new BuildTools(world, player, bus);
    this.undoBtn = h('button', { class: 'hw-quick__main', attrs: { type: 'button', 'data-action': 'undo' } });
    this.more = h('button', { class: 'hw-quick__more', attrs: { type: 'button', 'aria-label': 'Build tools', 'aria-expanded': 'false' } }, glyph('chevron', 12));
    this.markBtn = h('button', { class: 'hw-quick__item', attrs: { type: 'button', 'data-action': 'mark' } });
    this.pasteBtn = h('button', { class: 'hw-quick__item', attrs: { type: 'button', 'data-action': 'paste' }, text: 'Paste at aim (V)' });
    this.cancelBtn = h('button', { class: 'hw-quick__item', attrs: { type: 'button', 'data-action': 'cancel' }, text: 'Cancel copy' });
    this.menu = h('div', { class: 'hw-quick__list' }, this.markBtn, this.pasteBtn, this.cancelBtn);
    this.menu.hidden = true;
    this.el = h('div', { class: 'hw-quick hw-build hw-hud-plate', attrs: { 'data-testid': 'build-chip' } }, h('div', { class: 'hw-quick__bar' }, this.undoBtn, this.more), this.menu);
    this.el.hidden = true;
    this.undoBtn.addEventListener('click', () => this.undo());
    this.more.addEventListener('click', () => this.toggle(this.menu.hidden));
    this.markBtn.addEventListener('click', () => this.mark());
    this.pasteBtn.addEventListener('click', () => this.paste());
    this.cancelBtn.addEventListener('click', () => {
      this.tools.cancelCopy();
      this.update();
    });
    this.update();
  }

  /** The keyboard shortcuts; true when the key was one of ours. */
  key(code: string): boolean {
    if (code === 'KeyZ') this.undo();
    else if (code === 'KeyC') this.mark();
    else if (code === 'KeyV') this.paste();
    else return false;
    return true;
  }

  dispose(): void {
    this.tools.dispose();
  }

  private toggle(open: boolean): void {
    this.menu.hidden = !open;
    setAttr(this.more, 'aria-expanded', String(open));
    this.update();
  }

  private say(r: BuildResult): void {
    this.bus.emit('toast', { text: r.text, kind: r.ok ? 'info' : 'warn' });
    if (!r.ok) this.bus.emit('sfx', { name: 'error' });
    this.update();
  }

  private undo(): void {
    this.say(this.tools.undo());
  }

  /** The block the crosshair rests on, or null. */
  private aim() {
    const p = this.player;
    p.viewDir(this.dir);
    return raycast(this.world, p.position.x, p.eyeY, p.position.z, this.dir.x, this.dir.y, this.dir.z, REACH, false, this.hit);
  }

  private mark(): void {
    const hit = this.aim();
    if (!hit) return this.say({ ok: false, text: 'Aim at a block to mark it' });
    this.say(this.tools.markCorner(hit.x, hit.y, hit.z));
  }

  private paste(): void {
    const hit = this.aim();
    if (!hit) return this.say({ ok: false, text: 'Aim at a block: the paste goes on its face' });
    this.say(this.tools.paste(hit.px, hit.py, hit.pz));
  }

  /** A few times per second. */
  update(): void {
    const t = this.tools;
    const held = this.player.heldStack();
    const building = held !== null && blockOfItem(held.item) !== null;
    const active = t.undoCount > 0 || t.clip !== null || t.pendingCorner !== null;
    this.el.hidden = !active && !building;
    if (this.el.hidden) return;
    setText(this.undoBtn, t.undoCount > 0 ? `Undo ×${t.undoCount}` : 'Build');
    this.undoBtn.disabled = t.undoCount === 0;
    setText(this.markBtn, t.pendingCorner ? 'Mark corner 2 (C)' : 'Mark corner 1 (C)');
    this.pasteBtn.hidden = t.clip === null;
    this.cancelBtn.hidden = t.pendingCorner === null;
  }
}
