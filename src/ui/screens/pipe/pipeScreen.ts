/**
 * The PIPE screen (spec 16.3; ScreenRequest { type: 'pipe', x, y, z }): the line the pipe belongs to - what it holds
 * or carries, its warnings - and one row per end (port) nearest first, each with Push / Pull / Off, its status and
 * its settings. Refreshes about four times a second, and at once after a change. A phone-first sheet.
 */
import { fluid } from '../../../core/registry';
import type { Face, FluidKey } from '../../../core/types';
import type { PipeView, PortChange, PortView } from '../../../sim';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Button } from '../../kit/controls';
import { h, setAttr, setText } from '../../kit/dom';
import { Meter } from '../../kit/gauges';
import { Window } from '../../kit/window';
import { injectStationCss } from '../furnace/styles';
import { pretty, type ScreenSim } from '../furnace/simApi';
import { contentText, lineSummary, nearPorts, portKey } from './pipeText';
import { PortRow } from './portRow';

const REFRESH_MS = 240;
/** Seconds an end's block pulses after tapping its name. */
const LOCATE_S = 6;

const colourOf = (key: FluidKey): string => `#${fluid(key).colour.toString(16).padStart(6, '0')}`;

export function createPipeScreen(request: { x: number; y: number; z: number }, ctx: ScreenContext, sim: ScreenSim): GameScreen | null {
  const { x, y, z } = request;
  const first = sim.pipeView(x, y, z);
  if (!first) return null;
  injectStationCss();
  const family = first.family;
  const { bus } = ctx;

  const content = h('p', { class: 'hw-pipe__content hw-num' });
  const level = new Meter({ label: 'In the pipes', tone: 'neutral' });
  level.el.classList.add('hw-pipe__level');
  level.el.hidden = family !== 'fluid';
  const warnings = h('ul', { class: 'hw-pipe__warnings' });
  let warnKey = '';
  const portsHead = h('h3', { class: 'hw-heading' });
  const list = h('div', { class: 'hw-pipe__ports' });
  const empty = h('p', { class: 'hw-pipe__empty', text: 'No ends yet. A pipe that touches a crate, a machine, a furnace hatch or a tank becomes an end you can set here.' });
  let showAll = false;
  const moreBtn = new Button({ label: 'Show more', kind: 'quiet', size: 'sm', block: true, onClick: () => {
    showAll = true;
    force();
  } });
  const rows = new Map<string, PortRow>();
  const expanded = new Set<string>();
  let at = -Infinity;

  const change = (port: PortView, c: PortChange): void => {
    const r = sim.setPort(port.x, port.y, port.z, port.dir as Face, c);
    if (r.ok) bus.emit('sfx', { name: 'pipe_clunk', x: port.x, y: port.y, z: port.z });
    else {
      bus.emit('toast', { text: pretty(r.reason), kind: 'warn' });
      bus.emit('sfx', { name: 'error' });
    }
    force();
  };
  const deps = {
    family,
    pack: () => ctx.player.inventory.slots,
    change,
    locate: (port: PortView) => {
      bus.emit('highlight:block', { x: port.ex, y: port.ey, z: port.ez, seconds: LOCATE_S });
      bus.emit('sfx', { name: 'ui_click' });
    },
  };

  const body = h(
    'div',
    { class: 'hw-pipe', attrs: { 'data-family': family } },
    h('section', { class: 'hw-pipe__line hw-panel' }, content, level.el, warnings),
    portsHead,
    list,
    empty,
    moreBtn.el,
  );
  const window = new Window({
    title: first.name,
    subtitle: lineSummary(first.network),
    size: 'md',
    fit: 'tall',
    body,
    footer: 'Push: the pipe delivers into the block. Pull: it takes out. Tap a block\'s name to find it.',
  });
  window.frame.classList.add('hw-pipe-window');
  window.setAccent(family === 'fluid' ? 'var(--hw-power)' : 'var(--hw-heat)');

  function render(view: PipeView): void {
    const net = view.network;
    window.setTitle(view.name);
    window.setSubtitle(lineSummary(net));
    setText(content, contentText(net));
    if (family === 'fluid') {
      level.set(net.litres, Math.max(1, net.capacityL), `${Math.round(net.fill * 100)}%`);
      const colour = net.fluid ? colourOf(net.fluid) : 'var(--hw-iron-2)';
      if (level.el.style.getPropertyValue('--hw-pipe-fluid') !== colour) level.el.style.setProperty('--hw-pipe-fluid', colour);
      setText(level.el.querySelector('.hw-meter__label') as HTMLElement, net.fluidName ? `${net.fluidName} in the pipes` : 'In the pipes');
    }
    const warn = [...net.warnings, ...view.joints.map((j) => j.text)];
    const key = warn.join('|');
    if (key !== warnKey) {
      warnKey = key;
      warnings.replaceChildren(...[...new Set(warn)].map((w) => h('li', { text: w })));
    }
    warnings.hidden = warn.length === 0;

    const { shown, more } = nearPorts(view.ports, showAll);
    setText(portsHead, view.ports.length === 0 ? 'Ends' : `Ends (${view.ports.length})${more > 0 ? ` - nearest ${shown.length}` : ''}`);
    empty.hidden = view.ports.length > 0;
    moreBtn.el.hidden = more === 0;
    moreBtn.setLabel(`Show ${more} more end${more === 1 ? '' : 's'}`);
    const keep = new Set<string>();
    let prev: Element | null = null;
    for (const port of shown) {
      const k = portKey(port);
      keep.add(k);
      let row = rows.get(k);
      if (!row) {
        row = new PortRow(port, deps, expanded.has(k), (open) => (open ? expanded.add(k) : expanded.delete(k)));
        rows.set(k, row);
      } else row.update(port);
      // Keep DOM order = distance order, moving only what is out of place.
      const want: Element | null = prev ? prev.nextElementSibling : list.firstElementChild;
      if (want !== row.el) list.insertBefore(row.el, want);
      prev = row.el;
    }
    for (const [k, row] of rows) {
      if (keep.has(k)) continue;
      row.el.remove();
      row.dispose();
      rows.delete(k);
    }
    setAttr(body, 'data-ports', String(view.ports.length));
  }

  function refresh(): void {
    const now = performance.now();
    if (now - at < REFRESH_MS) return;
    at = now;
    const view = sim.pipeView(x, y, z);
    if (!view || view.family !== family) {
      ctx.close();
      return;
    }
    render(view);
  }
  function force(): void {
    at = -Infinity;
    refresh();
  }

  return {
    window,
    refresh,
    dispose: () => {
      for (const row of rows.values()) row.dispose();
      rows.clear();
      moreBtn.dispose();
    },
  };
}
