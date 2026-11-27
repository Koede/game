/** The trade caravan's screen (docs/api/caravan.md): sell surplus from the pack, buy the rare goods on the carts. */
import { itemOrNull } from '../../../core/registry';
import { CURRENCY, nextCaravanDay, type Trend } from '../../../game/caravan';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { Window } from '../../kit/window';

const name = (k: string): string => itemOrNull(k)?.name ?? k;
/** Cheap goods pay a fraction each, so they are quoted per 10. */
const quote = (p: number): string => (p >= 5 ? `${Math.round(p)} each` : p >= 1 ? `${p.toFixed(1)} each` : `${(p * 10).toFixed(1)} per 10`);

const ARROW: Record<Trend, string> = { up: '\u25B2', down: '\u25BC', steady: '\u25AC' };
const TREND_WORD: Record<Trend, string> = { up: 'rising', down: 'falling', steady: 'steady' };
/** A word for how keen the market is on a good, from its demand multiplier and the glut you made. */
const mood = (demand: number, glut: number): string => (glut >= 6 ? 'glutted' : demand >= 1.12 ? 'in demand' : demand <= 0.88 ? 'slow' : '');

export function createCaravanScreen(_request: { type: 'caravan' }, ctx: ScreenContext): GameScreen {
  const { player, bus } = ctx;
  const caravan = player.caravan;
  const sellList = h('div', { class: 'hw-caravan__list' });
  const buyList = h('div', { class: 'hw-caravan__list' });
  const purse = h('p', { class: 'hw-caravan__purse' });
  const news = h('p', { class: 'hw-caravan__news' });
  const body = h(
    'div',
    { class: 'hw-caravan' },
    purse,
    news,
    h('h3', { class: 'hw-heading', text: 'They buy' }),
    sellList,
    h('h3', { class: 'hw-heading', text: 'On the carts' }),
    buyList,
  );
  const window = new Window({ title: 'Trade Caravan', subtitle: '', size: 'md', fit: 'tall', body });
  const report = (r: { ok: boolean; reason?: string; count?: number }): void => {
    if (!r.ok) {
      bus.emit('toast', { text: r.reason ?? 'No deal', kind: 'warn' });
      bus.emit('sfx', { name: 'error' });
    } else {
      player.tally('traded', r.count ?? 1);
      bus.emit('sfx', { name: 'craft' });
    }
    ctx.invalidate();
  };
  const row = (label: string | HTMLElement, buttons: HTMLElement[], item?: string): HTMLElement =>
    h('div', { class: 'hw-caravan__row', attrs: item ? { 'data-item': item } : {} }, typeof label === 'string' ? h('span', { text: label }) : label, ...buttons);
  /** A sell line: name and count, price with a trend arrow, and a wanted / demand tag. */
  const sellLabel = (k: string, n: number): HTMLElement => {
    const t = caravan.trend(k);
    const tags: HTMLElement[] = [];
    if (caravan.wanted().includes(k)) tags.push(h('b', { class: 'hw-caravan__tag hw-caravan__tag--wanted', text: 'Wanted' }));
    const m = mood(caravan.demand(k), caravan.surplusOf(k));
    if (m) tags.push(h('b', { class: `hw-caravan__tag hw-caravan__tag--${m === 'in demand' ? 'hot' : 'cold'}`, text: m }));
    return h(
      'span',
      { class: 'hw-caravan__label' },
      `${name(k)} x${n} - ${quote(caravan.buyPrice(k))} `,
      h('i', { class: `hw-caravan__trend hw-caravan__trend--${t}`, text: ARROW[t], attrs: { title: `Price ${TREND_WORD[t]} since last visit`, 'aria-label': `price ${TREND_WORD[t]}` } }),
      ...tags,
    );
  };
  const btn = (text: string, on: () => void): HTMLElement => h('button', { class: 'hw-btn', text, attrs: { type: 'button' }, on: { click: on } });
  return {
    window,
    refresh: () => {
      caravan.setDay(ctx.clock.day);
      window.setSubtitle(caravan.present() ? `Day ${caravan.day}` : 'The caravan has moved on');
      purse.textContent = `You have ${player.inventory.count(CURRENCY)} ${name(CURRENCY)}.`;
      const wants = caravan.wanted().map(name).join(' and ');
      news.textContent = caravan.present()
        ? `Wanted this visit: ${wants}. What you sell gluts the market; prices recover over the days.`
        : `Next caravan on day ${nextCaravanDay(ctx.clock.day)}. It will want ${wants}.`;
      const counts = new Map<string, number>();
      for (const s of player.inventory.slots) if (s && caravan.buyPrice(s.item) > 0 && s.item !== CURRENCY) counts.set(s.item, (counts.get(s.item) ?? 0) + s.count);
      const wanted = caravan.wanted();
      // goods the caravan asks for come first
      const lines = [...counts].sort((a, b) => Number(wanted.includes(b[0])) - Number(wanted.includes(a[0])));
      sellList.replaceChildren(
        ...lines.map(([k, n]) =>
          row(sellLabel(k, n), [
            btn('Sell 1', () => report(caravan.sell(player.inventory, k, 1))),
            btn('Sell 10', () => report(caravan.sell(player.inventory, k, 10))),
            btn('Sell all', () => report(caravan.sell(player.inventory, k, n))),
          ], k),
        ),
      );
      if (counts.size === 0) sellList.replaceChildren(h('p', { text: 'Nothing in your pack interests them.' }));
      const stock = caravan.stock();
      buyList.replaceChildren(
        ...stock.map((l) => row(
            `${name(l.item)} (${l.left} left) - ${caravan.sellPrice(l.item)} each${caravan.rareDemandOf(l.item) > 0.01 ? ' (dearer: you bought these before)' : ''}`,
            [btn('Buy 1', () => report(caravan.buy(player.inventory, l.item, 1)))],
            l.item,
          )),
      );
      if (stock.length === 0) buyList.replaceChildren(h('p', { text: 'Nothing for sale.' }));
    },
    dispose: () => undefined,
  };
}
