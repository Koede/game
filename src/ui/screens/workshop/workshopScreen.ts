/**
 * The Workshop Guide (docs/api/workshop.md): opened by using Engineer's Goggles on empty air. Parts (what each machine is for and what
 * it costs), Basins (the mixer and press recipes drawn as small flow cards: inputs -> machine -> output) and Rules (rotation, stress,
 * signals). Phone first: 44 px targets, one column. Reads content only.
 */
import { BASIN_RECIPES } from '../../../content/basinWorkshop';
import { PART_DEFS } from '../../../content/itemsWorkshopParts';
import { MECH_TWINS } from '../../../content/itemsWorkshop';
import { BASE_STRESS, CARD_STEPS, type CardStep } from '../../../workshop/kinetics';
import { liveWorkshop, type Workshop } from '../../../workshop/workshop';
import { itemOrNull } from '../../../core/registry';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { h, setText } from '../../kit/dom';
import { Window } from '../../kit/window';

const CSS = `
.hw-ws{display:flex;flex-direction:column;gap:8px;padding:4px 2px 12px}
.hw-ws__part{padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.06);min-height:44px}
.hw-ws__part b{display:block}
.hw-ws__stress{font-size:12px;opacity:.7}
.hw-ws__card{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px;border-radius:8px;background:rgba(255,255,255,.06)}
.hw-ws__chip{min-height:32px;padding:4px 10px;border-radius:16px;border:1px solid rgba(255,255,255,.25);display:inline-flex;align-items:center}
.hw-ws__chip--out{border-color:#5cc060;background:rgba(92,192,96,.18)}
.hw-ws__chip--fluid{border-color:#4a9fe0;background:rgba(74,159,224,.18)}
.hw-ws__arrow{opacity:.7;font-size:12px;text-align:center}
.hw-ws__rule{margin:0;line-height:1.4}
.hw-ws__row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.hw-ws__n{width:1.4em;opacity:.7}
.hw-ws__sec{min-width:3em;text-align:center}
.hw-ws__btn{min-height:44px;min-width:44px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:inherit;font:inherit}
.hw-ws__take{align-self:flex-start}
`;

let injected = false;
function css(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  document.head.appendChild(h('style', { text: CSS }));
}

const nice = (key: string): string => itemOrNull(key)?.name ?? key.replace(/_/g, ' ');

export const RULES: readonly string[] = [
  'A source (crank, clockwork motor, treadwheel, steam rotor, a tractor beside a shaft) turns everything it touches. Parts join on every side. A belt whose exit touches another belt shares that speed, even after a piston moves only one of them.',
  'A sequenced gearshift runs one of three programs, or a punched card of eight steps: ratio, direction (back, off, forward) and seconds. Use the loaded gearshift empty-handed to edit the card.',
  'Speed has a direction. A reverse box flips it, a ratio dial changes it, a governor caps it, a clutch (or a gearshift between steps) hands nothing on. A differential turns at the mean of two shafts.',
  'Every part costs stress units; the sources carry a limit (a crank 8 su). Over the limit the line stops, or a shear pin snaps first. Two routes that turn one part differently jam.',
  'Oil raises the limit: use Heavy Residue (x1.25) or pine resin (x1.10) on any part of the line.',
  'Signals: a lever, push button, plate, timer or metronome lights signal wire; a relay renews it and tap-sets delays; machines that touch a signal cell work only while it is on, a clutch flips, a bell rings.',
  'Items move on belts, through funnels and chutes, by arms (wrench: source, then targets) into depots, basins, vaults and crates. Fluids reach spouts and drains from tanks on the pipe network.',
];

/** Labels for one row of the punched-card grid. */
export function cardButtonText(step: CardStep): { ratio: string; direction: string; seconds: string } {
  return { ratio: `x${step.ratio}`, direction: directionWord(step.direction), seconds: `${step.seconds}s` };
}

function directionWord(direction: -1 | 0 | 1): string {
  switch (direction) {
    case -1: return 'rev';
    case 0: return 'off';
    case 1: return 'fwd';
    default: {
      const neverDir: never = direction;
      return neverDir;
    }
  }
}

export function createWorkshopScreen(ctx: ScreenContext): GameScreen {
  const shop = liveWorkshop();
  if (shop?.editingAt()) return createCardScreen(ctx, shop);
  return createGuideScreen(ctx);
}

function createCardScreen(ctx: ScreenContext, shop: Workshop): GameScreen {
  css();
  const body = h('div', { class: 'hw-ws', attrs: { 'data-screen': 'punched-card' } });
  const ratioBtns: HTMLElement[] = [];
  const dirBtns: HTMLElement[] = [];
  const secLabels: HTMLElement[] = [];
  const rows: HTMLElement[] = [];
  for (let i = 0; i < CARD_STEPS; i++) {
    const ratio = h('button', {
      class: 'hw-ws__btn',
      attrs: { type: 'button', 'data-act': 'ratio', 'data-row': String(i) },
      on: { click: () => { shop.cycleRatio(i); paint(); } },
    });
    const dir = h('button', {
      class: 'hw-ws__btn',
      attrs: { type: 'button', 'data-act': 'direction', 'data-row': String(i) },
      on: { click: () => { shop.cycleDirection(i); paint(); } },
    });
    const minus = h('button', {
      class: 'hw-ws__btn', text: '−',
      attrs: { type: 'button', 'data-act': 'seconds-down', 'data-row': String(i) },
      on: { click: () => { shop.stepSeconds(i, -1); paint(); } },
    });
    const plus = h('button', {
      class: 'hw-ws__btn', text: '+',
      attrs: { type: 'button', 'data-act': 'seconds-up', 'data-row': String(i) },
      on: { click: () => { shop.stepSeconds(i, 1); paint(); } },
    });
    const sec = h('span', { class: 'hw-ws__sec', attrs: { 'data-act': 'seconds', 'data-row': String(i) } });
    const row = h('div', { class: 'hw-ws__row', attrs: { 'data-row': String(i) } }, [
      h('span', { class: 'hw-ws__n', text: String(i + 1) }),
      ratio, dir, minus, sec, plus,
    ]);
    ratioBtns.push(ratio);
    dirBtns.push(dir);
    secLabels.push(sec);
    rows.push(row);
    body.appendChild(row);
  }
  const take = h('button', {
    class: 'hw-ws__btn hw-ws__take', text: 'Take card',
    attrs: { type: 'button', 'data-act': 'take-card' },
    on: { click: () => { if (shop.takeCard()) ctx.close(); } },
  });
  body.appendChild(take);
  const empty = h('p', { class: 'hw-ws__rule', text: 'This gearshift has no punched card.' });
  empty.hidden = true;
  body.appendChild(empty);

  function paint(): void {
    const steps = shop.cardSteps();
    const on = steps !== null && steps.length === CARD_STEPS;
    for (const row of rows) row.hidden = !on;
    take.hidden = !on;
    empty.hidden = on;
    if (!steps) return;
    for (let i = 0; i < steps.length; i++) {
      const label = cardButtonText(steps[i]);
      setText(ratioBtns[i], label.ratio);
      setText(dirBtns[i], label.direction);
      setText(secLabels[i], label.seconds);
    }
  }
  paint();

  const window = new Window({
    title: 'Punched card', size: 'sm', fit: 'content', body,
    onClose: () => shop.clearEditing(),
  });
  return { window, refresh: paint, dispose: () => shop.clearEditing() };
}

function createGuideScreen(ctx: ScreenContext): GameScreen {
  void ctx;
  css();
  const body = h('div', { class: 'hw-ws' });
  type Tab = 'parts' | 'basins' | 'rules';
  let tab: Tab = 'parts';
  const window = new Window({
    title: 'Workshop Guide', size: 'md', fit: 'tall', body,
    tabs: [{ id: 'parts', label: 'Parts' }, { id: 'basins', label: 'Basins' }, { id: 'rules', label: 'Rules' }],
    activeTab: 'parts',
    onTab: (id) => {
      tab = id as Tab;
      render();
    },
  });

  function chip(text: string, cls = ''): HTMLElement {
    return h('span', { class: `hw-ws__chip ${cls}`.trim(), text });
  }

  function render(): void {
    body.replaceChildren();
    if (tab === 'parts') {
      const rows = [...MECH_TWINS.map((t) => ({ key: t.block, name: t.name, desc: t.desc })), ...PART_DEFS];
      for (const p of rows) {
        const stress = BASE_STRESS[p.key];
        body.appendChild(h('div', { class: 'hw-ws__part', attrs: { 'data-part': p.key } }, [
          h('b', { text: p.name }),
          h('span', { text: p.desc }),
          ...(stress ? [h('span', { class: 'hw-ws__stress', text: `Load ${stress} su at 16 rpm` })] : []),
        ]));
      }
    } else if (tab === 'basins') {
      body.appendChild(h('p', { class: 'hw-ws__rule', text: 'Put the items and water in a basin, a mixer or press over it, and turn it fast enough.' }));
      for (const r of BASIN_RECIPES) {
        const card = h('div', { class: 'hw-ws__card', attrs: { 'data-recipe': r.id } });
        for (const [i, n] of Object.entries(r.items)) card.appendChild(chip(`${n} ${nice(i)}`));
        if (r.fluid) card.appendChild(chip(`${r.fluid.litres} L ${r.fluid.key}`, 'hw-ws__chip--fluid'));
        card.appendChild(h('span', { class: 'hw-ws__arrow', text: `> ${nice(r.machine)} ${r.minRpm} rpm, ${r.seconds} s >` }));
        card.appendChild(chip(`${r.output.count} ${nice(r.output.item)}`, 'hw-ws__chip--out'));
        body.appendChild(card);
      }
    } else {
      for (const r of RULES) body.appendChild(h('p', { class: 'hw-ws__rule', text: r }));
    }
  }
  render();

  return { window, refresh: () => undefined, dispose: () => undefined };
}
