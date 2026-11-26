/**
 * The waypoint picker (docs/api/waypoints.md): opened by Use on a waypoint stone that has somewhere to go. One big
 * button per visited stone (name, distance, compass way, charcoal price), nearest first; a tap pays and travels through
 * `Exploration.travelTo`, which re-checks the rules. Buttons are full-width `lg` (52px) so they suit a thumb.
 */
import type { Exploration } from '../../../game/exploration';
import { WAYPOINT_FUEL_ITEM } from '../../../sim/waypoints';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Button } from '../../kit/controls';
import { h } from '../../kit/dom';
import { Window } from '../../kit/window';
import { waypointRows, waypointSubtitle } from './waypointList';

export function createWaypointScreen(request: { type: 'waypoint'; x: number; y: number; z: number }, ctx: ScreenContext, exploration: Exploration): GameScreen | null {
  const net = exploration.waypoints;
  if (!net.at(request.x, request.y, request.z)) return null;
  const list = h('div', { class: 'hw-waypoints', attrs: { role: 'list' }, style: { display: 'flex', 'flex-direction': 'column', gap: '8px' } });
  const empty = h('p', { text: 'No other stone you have visited is still standing.' });
  const window = new Window({ title: 'Waypoint Stone', subtitle: '', size: 'sm', fit: 'content', body: h('div', {}, list, empty) });
  const buttons = new Map<number, Button>();
  let shownKey = '';

  const go = (fromId: number, toId: number): void => {
    if (exploration.travelTo(fromId, toId) === 'worked') ctx.close();
    else {
      ctx.bus.emit('sfx', { name: 'error' });
      ctx.invalidate();
    }
  };

  const refresh = (): void => {
    const from = net.at(request.x, request.y, request.z);
    if (!from) { ctx.close(); return; }
    const charcoal = ctx.player.inventory.count(WAYPOINT_FUEL_ITEM);
    const rows = waypointRows(from, net.destinations(from), charcoal);
    window.setSubtitle(waypointSubtitle(from, charcoal));
    empty.hidden = rows.length > 0;
    const key = rows.map((r) => r.id).join(',');
    if (key !== shownKey) {
      shownKey = key;
      for (const b of buttons.values()) b.dispose();
      buttons.clear();
      list.replaceChildren(
        ...rows.map((r) => {
          const b = new Button({ label: r.name, size: 'lg', block: true, hint: r.detail, onClick: () => go(from.id, r.id) });
          b.el.setAttribute('role', 'listitem');
          buttons.set(r.id, b);
          return b.el;
        }),
      );
    }
    for (const r of rows) {
      const b = buttons.get(r.id);
      if (!b) continue;
      b.setLabel(r.name);
      b.setHint(r.detail);
      b.setDisabled(!r.affordable, r.affordable ? '' : r.detail);
    }
  };

  return {
    window,
    refresh,
    dispose: () => {
      for (const b of buttons.values()) b.dispose();
      buttons.clear();
    },
  };
}
