/**
 * The waypoint screen (docs/api/waypoints.md): Use on a standing stone opens it. It lists every other visited stone with its
 * direction, distance and charcoal price, and a Travel button that is greyed when the pack is short. The stone's name can be
 * changed here. Rows are built once per change of shape; refresh only rewrites text and the buttons' disabled state.
 */
import type { Exploration } from '../../../game/exploration';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h, setAttr, setText } from '../../kit/dom';
import { Window } from '../../kit/window';

export function createWaypointScreen(ctx: ScreenContext, ex: Exploration, stoneId: number): GameScreen | null {
  if (!ex.waypointView(stoneId)) return null;
  const status = h('p', { class: 'hw-way__status', attrs: { 'aria-live': 'polite' } });
  const charcoal = h('p', { class: 'hw-way__charcoal' });
  const list = h('div', { class: 'hw-way__list' });
  const name = h('input', { class: 'hw-way__name', attrs: { type: 'text', maxlength: 24, 'aria-label': 'Stone name', 'data-way': 'name' } });
  const window = new Window({ title: 'Waypoint', subtitle: '', size: 'sm', fit: 'content', body: h('div', { class: 'hw-way' }, h('div', { class: 'hw-way__rename' }, name, h('button', {
    class: 'hw-btn', attrs: { type: 'button', 'data-way': 'rename' }, text: 'Rename',
    on: { click: () => { const ok = ex.renameStone(stoneId, name.value); setText(status, ok ? 'Renamed.' : 'Give the stone a name.'); ctx.invalidate(); } },
  })), charcoal, list, status) });
  let shape = '';
  let named = false;
  let lastCharcoal = -1;
  const buttons = new Map<number, { btn: HTMLButtonElement; fuel: number }>();

  return {
    window,
    refresh: () => {
      const v = ex.waypointView(stoneId);
      if (!v) { ctx.close(); return; }
      if (!named) { named = true; name.value = v.stone.name; }
      window.setSubtitle(v.stone.name);
      if (v.charcoal !== lastCharcoal) { if (lastCharcoal >= 0) setText(status, ''); lastCharcoal = v.charcoal; }
      setText(charcoal, `Charcoal in your pack: ${v.charcoal}`);
      const sig = v.destinations.map((d) => `${d.stone.id}|${d.stone.name}|${d.fuel}|${Math.round(d.distance)}|${d.compass}`).join(';');
      if (sig !== shape) {
        shape = sig;
        buttons.clear();
        if (v.destinations.length === 0) { list.replaceChildren(h('p', { class: 'hw-way__empty', text: 'No other stone is known yet. Place another waypoint stone elsewhere and use it once.' })); return; }
        list.replaceChildren(...v.destinations.map((d) => {
          const btn = h('button', {
            class: 'hw-btn hw-way__go', attrs: { type: 'button', 'data-travel': d.stone.id },
            on: { click: () => { const err = ex.travel(stoneId, d.stone.id); if (err) setText(status, err); else ctx.close(); } },
          }, `Travel · ${d.fuel} charcoal`);
          buttons.set(d.stone.id, { btn, fuel: d.fuel });
          return h('section', { class: 'hw-way__row', attrs: { 'data-stone': d.stone.id } },
            h('div', { class: 'hw-way__info' }, h('b', { text: d.stone.name }), h('span', { text: `${Math.round(d.distance)} blocks ${d.compass}` })), btn);
        }));
      }
      for (const { btn, fuel } of buttons.values()) setAttr(btn, 'aria-disabled', v.charcoal < fuel ? 'true' : null);
    },
    dispose: () => undefined,
  };
}
