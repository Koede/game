/** The trade caravan's screen (docs/api/caravan.md): sell surplus from the pack, buy the rare goods on the carts. */
import { itemOrNull } from '../../../core/registry';
import { CURRENCY } from '../../../game/caravan';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { Window } from '../../kit/window';

const name = (k: string): string => itemOrNull(k)?.name ?? k;

export function createCaravanScreen(_request: { type: 'caravan' }, ctx: ScreenContext): GameScreen {
  const { player, bus } = ctx;
  const caravan = player.caravan;
  const sellList = h('div', { class: 'hw-caravan__list' });
  const buyList = h('div', { class: 'hw-caravan__list' });
  const purse = h('p', { class: 'hw-caravan__purse' });
  const body = h(
    'div',
    { class: 'hw-caravan' },
    purse,
    h('h3', { class: 'hw-heading', text: 'They buy' }),
    sellList,
    h('h3', { class: 'hw-heading', text: 'On the carts' }),
    buyList,
  );
  const window = new Window({ title: 'Trade Caravan', subtitle: '', size: 'md', fit: 'tall', body });
  const report = (r: { ok: boolean; reason?: string }): void => {
    if (!r.ok) {
      bus.emit('toast', { text: r.reason ?? 'No deal', kind: 'warn' });
      bus.emit('sfx', { name: 'error' });
    } else bus.emit('sfx', { name: 'craft' });
    ctx.invalidate();
  };
  const row = (label: string, buttons: HTMLElement[]): HTMLElement => h('div', { class: 'hw-caravan__row' }, h('span', { text: label }), ...buttons);
  const btn = (text: string, on: () => void): HTMLElement => h('button', { class: 'hw-btn', text, attrs: { type: 'button' }, on: { click: on } });
  return {
    window,
    refresh: () => {
      caravan.setDay(ctx.clock.day);
      window.setSubtitle(caravan.present() ? `Day ${caravan.day}` : 'The caravan has moved on');
      purse.textContent = `You have ${player.inventory.count(CURRENCY)} ${name(CURRENCY)}.`;
      const counts = new Map<string, number>();
      for (const s of player.inventory.slots) if (s && caravan.buyPrice(s.item) > 0 && s.item !== CURRENCY) counts.set(s.item, (counts.get(s.item) ?? 0) + s.count);
      sellList.replaceChildren(
        ...[...counts].map(([k, n]) =>
          row(`${name(k)} x${n} - ${caravan.buyPrice(k)} each`, [
            btn('Sell 1', () => report(caravan.sell(player.inventory, k, 1))),
            btn('Sell all', () => report(caravan.sell(player.inventory, k, n))),
          ]),
        ),
      );
      if (counts.size === 0) sellList.replaceChildren(h('p', { text: 'Nothing in your pack interests them.' }));
      const stock = caravan.stock();
      buyList.replaceChildren(
        ...stock.map((l) => row(`${name(l.item)} (${l.left} left) - ${caravan.sellPrice(l.item)} each`, [btn('Buy 1', () => report(caravan.buy(player.inventory, l.item, 1)))])),
      );
      if (stock.length === 0) buyList.replaceChildren(h('p', { text: 'Nothing for sale.' }));
    },
    dispose: () => undefined,
  };
}
