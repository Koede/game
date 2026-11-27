/**
 * The build chip (docs/api/assist.md): Undo for the last placements, and copy-paste of up to 8x8x8 by aim. Shown while there is
 * something to undo, a copy in progress, a block in hand, or a blueprint to use. Keys on a keyboard: Z undo, C mark corner, V paste,
 * B mark a blueprint corner, K open the blueprints (docs/api/blueprint.md). With a blueprint picked, a bar under the chip shows
 * its placement ghost at the aim with Build here / Gruk builds / Turn / Cancel.
 */
import type { GameBus } from '../../core/context';
import { REACH } from '../../core/constants';
import { blockOfItem } from '../../core/registry';
import type { IWorld } from '../../core/types';
import { BlueprintTools } from '../../game/blueprintTools';
import { BuildTools, type BuildResult } from '../../game/buildTools';
import type { PlayerState } from '../../game/playerState';
import { createRayHit, raycast } from '../../player/raycast';
import { h, setAttr, setText } from '../kit/dom';
import { glyph } from '../kit/icons';
import { BlueprintPanel, placementLine } from './blueprintPanel';

export class BuildChip {
  readonly el: HTMLDivElement;
  readonly tools: BuildTools;
  readonly blueprints: BlueprintTools;
  readonly panel: BlueprintPanel;
  private readonly bpMarkBtn: HTMLButtonElement;
  private readonly bpOpenBtn: HTMLButtonElement;
  private readonly bpBar: HTMLDivElement;
  private readonly bpLine: HTMLSpanElement;
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
    this.blueprints = new BlueprintTools(world, player, bus);
    this.panel = new BlueprintPanel(this.blueprints, () => this.update());
    this.undoBtn = h('button', { class: 'hw-quick__main', attrs: { type: 'button', 'data-action': 'undo' } });
    this.more = h('button', { class: 'hw-quick__more', attrs: { type: 'button', 'aria-label': 'Build tools', 'aria-expanded': 'false' } }, glyph('chevron', 12));
    this.markBtn = h('button', { class: 'hw-quick__item', attrs: { type: 'button', 'data-action': 'mark' } });
    this.pasteBtn = h('button', { class: 'hw-quick__item', attrs: { type: 'button', 'data-action': 'paste' }, text: 'Paste at aim (V)' });
    this.cancelBtn = h('button', { class: 'hw-quick__item', attrs: { type: 'button', 'data-action': 'cancel' }, text: 'Cancel copy' });
    this.bpMarkBtn = h('button', { class: 'hw-quick__item', attrs: { type: 'button', 'data-action': 'bp-mark' } });
    this.bpOpenBtn = h('button', { class: 'hw-quick__item', attrs: { type: 'button', 'data-action': 'bp-open' } });
    this.menu = h('div', { class: 'hw-quick__list' }, this.markBtn, this.pasteBtn, this.cancelBtn, this.bpMarkBtn, this.bpOpenBtn);
    this.bpLine = h('span', { class: 'hw-bp__line' });
    const bpBtn = (label: string, action: string, fn: () => void): HTMLButtonElement => {
      const b = h('button', { class: 'hw-quick__item hw-bp__act', attrs: { type: 'button', 'data-action': action }, text: label });
      b.addEventListener('click', fn);
      return b;
    };
    this.bpBar = h(
      'div',
      { class: 'hw-bp__bar', attrs: { 'data-testid': 'blueprint-bar' } },
      this.bpLine,
      h(
        'div',
        { class: 'hw-bp__bar-acts' },
        bpBtn('Gruk builds', 'bp-gruk', () => this.bpPlace(true)),
        bpBtn('Build here', 'bp-here', () => this.bpPlace(false)),
        bpBtn('Turn', 'bp-turn', () => {
          this.blueprints.rotate();
          this.update();
        }),
        bpBtn('Cancel', 'bp-cancel', () => {
          this.blueprints.select(null);
          this.update();
        }),
      ),
    );
    this.bpBar.hidden = true;
    this.menu.hidden = true;
    this.el = h('div', { class: 'hw-quick hw-build hw-hud-plate', attrs: { 'data-testid': 'build-chip' } }, h('div', { class: 'hw-quick__bar' }, this.undoBtn, this.more), this.menu, this.bpBar, this.panel.el);
    this.el.hidden = true;
    this.undoBtn.addEventListener('click', () => this.undo());
    this.more.addEventListener('click', () => this.toggle(this.menu.hidden));
    this.markBtn.addEventListener('click', () => this.mark());
    this.pasteBtn.addEventListener('click', () => this.paste());
    this.cancelBtn.addEventListener('click', () => {
      this.tools.cancelCopy();
      this.blueprints.cancelMark();
      this.update();
    });
    this.bpMarkBtn.addEventListener('click', () => this.bpMark());
    this.bpOpenBtn.addEventListener('click', () => {
      this.toggle(false);
      this.panel.toggle();
    });
    this.update();
  }

  /** The keyboard shortcuts; true when the key was one of ours. */
  key(code: string): boolean {
    if (code === 'KeyZ') this.undo();
    else if (code === 'KeyC') this.mark();
    else if (code === 'KeyV') this.paste();
    else if (code === 'KeyB') this.bpMark();
    else if (code === 'KeyK') this.panel.toggle();
    else return false;
    return true;
  }

  dispose(): void {
    this.blueprints.clearGhost();
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

  private bpMark(): void {
    const hit = this.aim();
    if (!hit) return this.say({ ok: false, text: 'Aim at a block to mark it' });
    this.say(this.blueprints.markCorner(hit.x, hit.y, hit.z));
    this.panel.render();
  }

  private bpPlace(gruk: boolean): void {
    const hit = this.aim();
    if (!hit) return this.say({ ok: false, text: 'Aim at a block: the blueprint goes on its face' });
    const r = gruk ? this.blueprints.commission(hit.px, hit.py, hit.pz) : this.blueprints.placeNow(hit.px, hit.py, hit.pz);
    if (r.ok && !gruk) this.blueprints.select(null);
    this.say(r);
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
    const bp = this.blueprints;
    const active = t.undoCount > 0 || t.clip !== null || t.pendingCorner !== null || bp.pendingCorner !== null || bp.selected !== null;
    this.el.hidden = !active && !building && bp.book.entries.length === 0 && bp.book.jobs.length === 0 && !this.panel.open;
    this.updateBlueprint();
    if (this.el.hidden) return;
    setText(this.undoBtn, t.undoCount > 0 ? `Undo ×${t.undoCount}` : 'Build');
    this.undoBtn.disabled = t.undoCount === 0;
    setText(this.markBtn, t.pendingCorner ? 'Mark corner 2 (C)' : 'Mark corner 1 (C)');
    this.pasteBtn.hidden = t.clip === null;
    this.cancelBtn.hidden = t.pendingCorner === null && bp.pendingCorner === null;
  }

  /** The placement ghost follows the aim; the bar says what a build here would meet. */
  private updateBlueprint(): void {
    const bp = this.blueprints;
    setText(this.bpMarkBtn, bp.pendingCorner ? 'Blueprint corner 2 (B)' : 'Save blueprint: corner 1 (B)');
    const n = bp.book.entries.length;
    setText(this.bpOpenBtn, n > 0 || bp.book.jobs.length > 0 ? `Blueprints (${n}) (K)` : 'Blueprints (K)');
    this.panel.render();
    const cur = bp.current();
    this.bpBar.hidden = cur === null;
    if (!cur) return;
    const hit = this.aim();
    if (!hit) {
      bp.clearGhost();
      setText(this.bpLine, `${cur.name} - aim at a block`);
      return;
    }
    const site = bp.showGhost(hit.px, hit.py, hit.pz) ?? [];
    const free = this.player.dev && this.player.devFreePlace;
    const short = free ? 0 : bp.needs(cur).filter((x) => x.have < x.need).length;
    setText(this.bpLine, placementLine(cur.name, site.filter((c) => c.state === 'blocked').length, site.filter((c) => c.state === 'free').length, short));
  }
}
