/**
 * The furnace upgrade: a compact header button (have/need for the next tier, glowing when affordable) and the
 * sheet it opens inside the window - what the next tier brings, every ingredient with have/need, the temperature
 * it must be done at, and a hold-to-upgrade button that explains what is missing.
 */
import type { GameBus } from '../../../core/context';
import { AGES } from '../../../core/registry';
import type { FurnaceTierSpec } from '../../../core/types';
import type { FurnaceView } from '../../../sim';
import { Button } from '../../kit/controls';
import { h, setAttr, setFlag, setText } from '../../kit/dom';
import { formatCount, formatWatts, heatColor } from '../../kit/format';
import { Badge } from '../../kit/gauges';
import { ItemIcon } from '../../kit/icons';
import { nameOf } from './forgeRows';
import { sourceText, upgradeProgress } from './furnaceText';
import { pretty, type ScreenSim } from './simApi';

interface Chip {
  el: HTMLSpanElement;
  icon: ItemIcon;
  qty: HTMLSpanElement;
  name: HTMLSpanElement;
}

const stats = (t: FurnaceTierSpec): [string, string][] => [
  ['Max temperature', `${t.maxTempC} °C`],
  ['Crucibles', String(t.crucibles)],
  ['Fuel slots', String(t.fuelSlots)],
  ['Smelting speed', `×${t.speed}`],
  ['Electric heat', t.electricHeatW > 0 ? formatWatts(t.electricHeatW) : '-'],
  ['Warmth radius', `${t.warmth} blocks`],
];

export class UpgradeControl {
  /** The header button. */
  readonly button: Button;
  /** The sheet (an overlay inside the window body). */
  readonly sheet: HTMLElement;
  private readonly kicker: HTMLParagraphElement;
  private readonly title: HTMLHeadingElement;
  private readonly blurb: HTMLParagraphElement;
  private readonly table: HTMLTableSectionElement;
  private readonly chipHost: HTMLDivElement;
  private readonly where: HTMLUListElement;
  private whereKey = '';
  private readonly temp = new Badge({ text: '', tone: 'heat' });
  private readonly reason: HTMLParagraphElement;
  private readonly go: Button;
  private readonly back: Button;
  private readonly chips: Chip[] = [];
  private tableKey = '';
  private last = false;

  constructor(opts: { sim: ScreenSim; pos: { x: number; y: number; z: number }; bus: GameBus; changed: () => void }) {
    const { sim, pos, bus } = opts;
    this.button = new Button({ label: 'Upgrade', size: 'sm', onClick: () => this.setOpen(true) });
    this.button.el.classList.add('hw-upg-btn');
    this.kicker = h('p', { class: 'hw-upg__kicker' });
    this.title = h('h3', { class: 'hw-upg__title' });
    this.blurb = h('p', { class: 'hw-upg__blurb' });
    this.table = h('tbody');
    this.chipHost = h('div', { class: 'hw-upg__chips' });
    this.where = h('ul', { class: 'hw-upg__where' });
    this.reason = h('p', { class: 'hw-upg__reason' });
    this.go = new Button({
      label: 'Upgrade',
      kind: 'primary',
      size: 'lg',
      holdMs: 700,
      onClick: () => {
        const r = sim.upgrade(pos.x, pos.y, pos.z);
        if (!r.ok) {
          bus.emit('toast', { text: pretty(r.reason), kind: 'warn' });
          bus.emit('sfx', { name: 'error' });
        } else this.setOpen(false);
        opts.changed();
      },
    });
    this.back = new Button({ label: 'Back', kind: 'quiet', onClick: () => this.setOpen(false) });
    this.sheet = h(
      'section',
      { class: 'hw-upg', attrs: { 'aria-label': 'Upgrade the furnace' } },
      h(
        'div',
        { class: 'hw-upg__scroll' },
        this.kicker,
        this.title,
        this.blurb,
        h('table', { class: 'hw-upg__table' }, h('thead', null, h('tr', null, h('th'), h('th', { text: 'Now' }), h('th', { text: 'Next' }))), this.table),
        h('h4', { class: 'hw-heading', text: 'Materials' }),
        this.chipHost,
        this.where,
        h('h4', { class: 'hw-heading', text: 'Heat' }),
        h('div', { class: 'hw-upg__temp' }, this.temp.el),
      ),
      h('div', { class: 'hw-upg__foot' }, this.reason, h('div', { class: 'hw-upg__btns' }, this.back.el, this.go.el)),
    );
    this.sheet.hidden = true;
  }

  get open(): boolean {
    return !this.sheet.hidden;
  }

  setOpen(open: boolean): void {
    if (open && this.last) return;
    this.sheet.hidden = !open;
    if (open) this.back.el.focus({ preventScroll: true });
  }

  update(view: FurnaceView): void {
    const up = view.upgrade;
    this.last = up === null;
    if (!up) {
      this.button.setLabel('Final tier');
      this.button.setDisabled(true, view.ignited ? 'Ignited' : 'Starhearth');
      setFlag(this.button.el, 'ready', false);
      this.sheet.hidden = true;
      return;
    }
    const { have, need } = upgradeProgress(up);
    this.button.setLabel('Upgrade');
    this.button.setKind(up.ok ? 'primary' : 'default');
    this.button.setDisabled(false);
    this.setSub(up.ok ? `Ready: ${up.next.name}` : `${have}/${need} materials`);
    setFlag(this.button.el, 'ready', up.ok);
    if (this.sheet.hidden) return;

    setText(this.kicker, `Next: ${AGES[up.next.age]?.name ?? ''} - tier ${up.next.tier}`);
    setText(this.title, up.next.name);
    setText(this.blurb, up.next.blurb);
    const key = `${view.tier}`;
    if (key !== this.tableKey) {
      this.tableKey = key;
      const now = stats(view.spec);
      this.table.replaceChildren(
        ...stats(up.next).map(([label, next], i) =>
          h('tr', { attrs: { 'data-better': next !== now[i][1] } }, h('th', { text: label }), h('td', { class: 'hw-num', text: now[i][1] }), h('td', { class: 'hw-num', text: next })),
        ),
      );
    }
    this.updateChips(up.ingredients);
    const missing = up.ingredients.filter((s) => !s.ok);
    const whereKey = missing.map((s) => s.item).join(',');
    if (whereKey !== this.whereKey) {
      this.whereKey = whereKey;
      this.where.replaceChildren(
        ...missing.map((s) => h('li', null, h('strong', { text: nameOf(s.item) }), `: ${sourceText(s.item)}`)),
      );
    }
    this.temp.update({
      text: `Upgrade at ${up.requiredC} °C - now ${Math.floor(view.tempC)} °C`,
      tone: 'heat',
      met: up.tempOk,
      swatch: heatColor(up.requiredC),
    });
    setText(this.reason, up.reason ? pretty(up.reason) : `Everything is ready. Hold to rebuild it as the ${up.next.name}.`);
    setAttr(this.reason, 'data-tone', up.ok ? 'good' : 'warn');
    this.go.setLabel(`Upgrade to the ${up.next.name}`);
    this.go.setDisabled(!up.ok, up.ok ? '' : up.tempOk ? 'Materials missing' : 'Too cold');
  }

  dispose(): void {
    this.button.dispose();
    this.go.dispose();
    this.back.dispose();
  }

  private setSub(text: string): void {
    const sub = this.button.el.querySelector('.hw-btn__sub');
    if (sub instanceof HTMLElement) {
      setText(sub, text);
      sub.hidden = text === '';
    }
  }

  private updateChips(list: readonly { item: string; need: number; have: number; ok: boolean }[]): void {
    while (this.chips.length > list.length) this.chips.pop()?.el.remove();
    list.forEach((s, i) => {
      let chip = this.chips[i];
      if (!chip) {
        const icon = new ItemIcon();
        const qty = h('span', { class: 'hw-ingr__qty hw-num' });
        const name = h('span', { class: 'hw-ingr__name' });
        chip = { el: h('span', { class: 'hw-ingr' }, icon.el, qty, name), icon, qty, name };
        this.chips.push(chip);
        this.chipHost.appendChild(chip.el);
      }
      chip.icon.set(s.item);
      setText(chip.qty, `${formatCount(s.have)}/${formatCount(s.need)}`);
      setText(chip.name, nameOf(s.item));
      setFlag(chip.el, 'short', !s.ok);
    });
  }
}
