/**
 * A power network at a glance: generation / demand / stored, the 60 s history, the cable limit, the alert state
 * and (unless compact) every member with its status. The furnace's GRID tab and every machine screen use it.
 */
import { FURNACE_TIERS, itemOrNull } from '../../../core/registry';
import type { NetworkMember, NetworkStats } from '../../../sim';
import { h, setAttr, setText } from '../../kit/dom';
import { formatJoules, formatPercent, formatWatts } from '../../kit/format';
import { Meter, Sparkline, StatFigure } from '../../kit/gauges';
import { ItemIcon } from '../../kit/icons';
import { coverText } from '../../../sim';
import { alertText, cableText, memberWatts } from './machineText';

interface MemberRow {
  el: HTMLLIElement;
  icon: ItemIcon;
  name: HTMLSpanElement;
  status: HTMLSpanElement;
  watts: HTMLSpanElement;
}

const MAX_MEMBERS = 40;

export class NetworkPanel {
  readonly el: HTMLElement;
  private readonly alert: HTMLParagraphElement;
  private readonly gen = new StatFigure({ caption: 'Generation', tone: 'power' });
  private readonly demand = new StatFigure({ caption: 'Demand' });
  private readonly stored = new StatFigure({ caption: 'Stored', tone: 'power' });
  private readonly spark: Sparkline;
  private readonly supply: Meter;
  private readonly cable: Meter;
  private readonly members: HTMLOListElement | null;
  private readonly membersHead: HTMLHeadingElement | null;
  private readonly empty: HTMLParagraphElement;
  private readonly body: HTMLDivElement;
  private rows: MemberRow[] = [];
  private memberKey = '';

  constructor(opts: { compact?: boolean; emptyText?: string } = {}) {
    this.alert = h('p', { class: 'hw-net__alert', attrs: { role: 'status' } });
    this.spark = new Sparkline({
      label: 'Generation and use over the last minute',
      a: { label: 'Generation', tone: 'power' },
      b: { label: 'Used', tone: 'heat' },
    });
    this.supply = new Meter({ label: 'Supplied', tone: 'power', value: 0, max: 1 });
    this.cable = new Meter({ label: 'Cable load', tone: 'neutral', value: 0, max: 1 });
    this.empty = h('p', { class: 'hw-net__empty', text: opts.emptyText ?? 'Not connected to anything that makes or stores power.' });
    this.members = opts.compact ? null : h('ol', { class: 'hw-net__members', attrs: { 'aria-label': 'Connected machines' } });
    this.membersHead = opts.compact ? null : h('h3', { class: 'hw-heading', text: 'On this network' });
    this.body = h(
      'div',
      { class: 'hw-net__body' },
      this.alert,
      h('div', { class: 'hw-net__figures' }, this.gen.el, this.demand.el, this.stored.el),
      h('div', { class: 'hw-net__chart' }, this.spark.el),
      h('div', { class: 'hw-net__meters' }, this.supply.el, this.cable.el),
      this.membersHead,
      this.members,
    );
    this.el = h('section', { class: ['hw-net', opts.compact && 'hw-net--compact'], attrs: { 'aria-label': 'Power network' } }, this.empty, this.body);
  }

  setEmptyText(text: string): void {
    setText(this.empty, text);
  }

  /** null, or a network with nothing but the viewed machine on it, shows the empty explanation. */
  update(net: NetworkStats | null, alone = false): void {
    const show = net !== null && !alone;
    this.empty.hidden = show;
    this.body.hidden = !show;
    if (!net || !show) return;
    setAttr(this.el, 'data-state', net.state);
    const alert = alertText(net);
    this.alert.hidden = alert === null;
    setText(this.alert, alert ?? '');
    setAttr(this.alert, 'data-tone', net.state === 'overload' ? 'bad' : 'warn');
    this.gen.set(formatWatts(net.generationW));
    this.gen.setNote(net.dischargeW > 0 ? `+${formatWatts(net.dischargeW)} from storage` : '');
    this.demand.set(formatWatts(net.demandW));
    this.demand.setTone(net.satisfaction < 0.999 && net.demandW > 0 ? 'warn' : 'neutral');
    this.demand.setNote(net.demandW > 0 ? `${formatPercent(net.satisfaction)} supplied` : 'Nothing asks for power');
    this.stored.set(net.capacityJ > 0 ? formatJoules(net.storedJ) : '--');
    const cover = coverText(net);
    const base = net.capacityJ > 0 ? `of ${formatJoules(net.capacityJ)}${net.chargeW > 0 ? ` - charging ${formatWatts(net.chargeW)}` : ''}` : 'No batteries';
    this.stored.setNote(cover ? `${base} - ${cover}` : base);
    this.spark.set(net.historyG, net.historyUsed);
    this.supply.set(net.satisfaction, 1, net.demandW > 0 ? `${formatWatts(net.deliveredW)} of ${formatWatts(net.demandW)}` : 'Idle');
    this.supply.setTone(net.satisfaction < 0.999 && net.demandW > 0 ? 'warn' : 'power');
    const rated = Number.isFinite(net.ratingW);
    this.cable.setLabel(cableText(net));
    this.cable.set(rated ? Math.min(net.generationW + net.dischargeW, net.ratingW) : 0, rated ? net.ratingW : 1, rated ? formatWatts(net.ratingW) : 'No limit');
    this.cable.setTone(net.overloaded ? 'bad' : 'neutral');
    if (this.members) this.updateMembers(net.members);
  }

  dispose(): void {
    this.spark.dispose();
  }

  private updateMembers(members: readonly NetworkMember[]): void {
    const list = members.slice(0, MAX_MEMBERS);
    const key = list.map((m) => `${m.kind}@${m.x},${m.y},${m.z}`).join('|');
    if (key !== this.memberKey) {
      this.memberKey = key;
      this.rows = list.map(() => {
        const icon = new ItemIcon();
        const name = h('span', { class: 'hw-net__mname' });
        const status = h('span', { class: 'hw-net__mstatus' });
        const watts = h('span', { class: 'hw-net__mwatts hw-num' });
        const el = h('li', { class: 'hw-net__member' }, icon.el, h('span', { class: 'hw-net__mtext' }, name, status), watts);
        return { el, icon, name, status, watts };
      });
      this.members?.replaceChildren(...this.rows.map((r) => r.el));
    }
    list.forEach((m, i) => {
      const row = this.rows[i];
      row.icon.set(itemOrNull(m.kind) ? m.kind : blockItem(m));
      setText(row.name, m.name);
      setText(row.status, m.status);
      setText(row.watts, memberWatts(m.watts));
      setAttr(row.el, 'data-flow', m.watts > 0 ? 'out' : m.watts < 0 ? 'in' : 'idle');
    });
  }
}

/** Furnaces share the kind 'furnace': their icon is the block item of their tier (by name). */
function blockItem(m: NetworkMember): string {
  return m.kind === 'furnace' ? furnaceItemByName(m.name) : m.kind;
}

const furnaceItemByName = (name: string): string => FURNACE_TIERS.find((t) => t.name === name)?.block ?? 'furnace_clay';
