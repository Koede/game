/**
 * The telegraph office's screen (docs/api/telegraph.md): what the wire says about storms, whether the line reaches the
 * town and the caravan (and an order by wire while it is in), the office's signal mode, the stations on the line and the
 * last telegrams. Buttons are built once; refresh only rewrites text, so a tap on a phone is never lost to a rebuild.
 */
import { itemOrNull } from '../../../core/registry';
import { caravanHere, caravanStock, nextCaravanDay } from '../../../game/caravan';
import { OFFICE_MODES, TOWN_REACH, type OfficeMode, type Telegraph } from '../../../game/telegraph';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h } from '../../kit/dom';
import { Window } from '../../kit/window';

const name = (k: string): string => itemOrNull(k)?.name ?? k;
const KIND_NAME = { office: 'Office', mast: 'Radio mast', pole: 'Pole' } as const;
const compass = (dx: number, dz: number): string => {
  if (Math.abs(dx) < 1 && Math.abs(dz) < 1) return 'here';
  const a = (Math.atan2(dx, -dz) * 180) / Math.PI;
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((a + 360) % 360) / 45) % 8];
};

export function createTelegraphScreen(req: { type: 'telegraph'; x: number; y: number; z: number }, ctx: ScreenContext, tg: Telegraph): GameScreen | null {
  const { x, y, z } = req;
  const mast = tg.node(x, y, z)?.kind === 'mast';
  const storm = h('p', { class: 'hw-telegraph__storm', attrs: { 'data-tg': 'storm', role: 'status' } });
  const reach = h('p', { class: 'hw-telegraph__hint' });
  const town = h('p', { attrs: { 'data-tg': 'town' } });
  const carts = h('p', { class: 'hw-telegraph__hint', attrs: { 'data-tg': 'carts' } });
  const order = h('button', {
    class: 'hw-btn', text: 'Order by wire', attrs: { type: 'button', 'data-tg': 'order' },
    on: { click: () => ctx.bus.emit('ui:open', { screen: { type: 'caravan' } }) },
  });
  const modeText = h('p', { class: 'hw-telegraph__hint' });
  const modeButtons = OFFICE_MODES.map((m) =>
    h('button', {
      class: ['hw-btn', 'hw-jobs__opt'], text: m.name, attrs: { type: 'button', 'data-tg-mode': m.key, 'aria-pressed': 'false' },
      on: { click: () => { tg.setMode(x, y, z, m.key as OfficeMode); ctx.invalidate(); } },
    }),
  );
  const stations = h('div', { class: 'hw-caravan__list', attrs: { 'data-tg': 'stations' } });
  const log = h('div', { class: 'hw-caravan__list', attrs: { 'data-tg': 'log' } });
  const body = h(
    'div',
    { class: 'hw-caravan hw-telegraph' },
    h('h3', { class: 'hw-heading', text: 'The weather wire' }), storm, reach,
    h('h3', { class: 'hw-heading', text: 'Town' }), town, carts, order,
    ...(mast ? [] : [
      h('h3', { class: 'hw-heading', text: 'Signal' }),
      h('div', { class: 'hw-jobs__seg', attrs: { role: 'group', 'aria-label': 'Signal mode' } }, ...modeButtons),
      modeText,
    ]),
    h('h3', { class: 'hw-heading', text: 'On this line' }), stations,
    h('h3', { class: 'hw-heading', text: 'Telegrams' }), log,
  );
  const window = new Window({ title: mast ? 'Radio Mast' : 'Telegraph Office', subtitle: '', size: 'md', fit: 'tall', body });
  return {
    window,
    refresh: () => {
      const v = tg.view(x, y, z);
      if (!v) {
        ctx.close();
        return;
      }
      const parts = [`${v.offices} office${v.offices === 1 ? '' : 's'}`, `${v.poles} pole${v.poles === 1 ? '' : 's'}`];
      if (v.masts > 0) parts.push(`${v.onAir} of ${v.masts} mast${v.masts === 1 ? '' : 's'} on air`);
      window.setSubtitle(mast ? (tg.onAir(x, y, z) ? `On air · ${parts.join(', ')}` : 'Off air: needs 100 W from a cable or generator beside it') : parts.join(', '));
      const due = tg.stormFor(x, y, z);
      storm.textContent = due === null ? 'No storm on the wire.' : due <= 0 ? 'A storm is overhead.' : `Storm due in about ${Math.max(1, Math.round(due / 60))} min.`;
      storm.dataset.storm = due === null ? 'none' : due <= 0 ? 'now' : 'due';
      reach.textContent = v.horizonS > 600 ? 'A radio mast on this line hears storms 20 min ahead.' : 'This line hears storms 10 min ahead; a powered radio mast doubles that.';
      const day = ctx.clock.day;
      if (!v.town) {
        town.textContent = `Not wired to town. Run poles to within ${TOWN_REACH} blocks of the camp.`;
        carts.textContent = '';
        order.hidden = true;
      } else if (caravanHere(day)) {
        town.textContent = 'Wired to town. The caravan is in today.';
        carts.textContent = `On the carts: ${caravanStock(day).map((l) => name(l.item)).join(', ')}.`;
        order.hidden = false;
      } else {
        const next = nextCaravanDay(day);
        town.textContent = `Wired to town. Next caravan: day ${next} (in ${next - day} day${next - day === 1 ? '' : 's'}).`;
        carts.textContent = `The town wires ahead that it carries: ${caravanStock(next).map((l) => name(l.item)).join(', ')}.`;
        order.hidden = true;
      }
      const mode = tg.mode(x, y, z);
      for (const b of modeButtons) {
        const on = b.dataset.tgMode === mode;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      }
      const m = OFFICE_MODES.find((o) => o.key === mode);
      modeText.textContent = m ? `${m.text}${tg.busy(x, y, z) ? ' (lit now)' : ''}` : '';
      stations.replaceChildren(
        ...(v.stations.length === 0
          ? [h('p', { text: 'Nothing else on this line yet. Poles reach 12 blocks each; a radio mast reaches 160.' })]
          : v.stations.slice(0, 8).map((s) => h('div', { class: 'hw-caravan__row' }, h('span', { text: `${KIND_NAME[s.kind]} ${s.dist} blocks ${compass(s.x - x, s.z - z)}` })))),
      );
      const t = tg.telegrams();
      log.replaceChildren(...(t.length === 0 ? [h('p', { text: 'No telegrams yet.' })] : t.map((m2) => h('p', { text: `Day ${m2.day}: ${m2.text}` }))));
    },
    dispose: () => undefined,
  };
}
