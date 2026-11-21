/** The win screen: the Starhearth ignites. A celebration, the run in numbers, and Keep playing. */
import { OBJECTIVES } from '../../../core/registry';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Button } from '../../kit/controls';
import { h, setText } from '../../kit/dom';
import { formatCount, heatColor } from '../../kit/format';
import { Window } from '../../kit/window';
import { EmberField } from '../../menus/fire';

const sum = (counts: Record<string, number>): number => Object.values(counts).reduce((a, b) => a + b, 0);

export function createWinScreen(ctx: ScreenContext): GameScreen {
  const fire = new EmberField(0x57a2);
  const stats = h('dl', { class: 'hw-win__stats' });
  const statValues = new Map<string, HTMLElement>();
  for (const label of ['Days', 'Things made', 'Blocks placed', 'Blocks mined', 'Goals done', 'Deaths']) {
    const dd = h('dd', { class: 'hw-num' });
    statValues.set(label, dd);
    stats.append(h('div', { class: 'hw-win__stat' }, h('dt', { text: label }), dd));
  }
  const keep = new Button({ label: 'Keep playing', kind: 'primary', size: 'lg', block: true, icon: 'play', onClick: () => ctx.close() });
  const body = h(
    'div',
    { class: 'hw-win' },
    h(
      'div',
      { class: 'hw-win__hero' },
      fire.el,
      h('div', { class: 'hw-win__kicker', text: 'Ignition' }),
      h('div', { class: 'hw-win__title', text: 'A star burns in your hearth' }),
    ),
    h('p', { class: 'hw-win__line', text: 'It began as a heap of clay and a few sticks. Now your furnace holds a star: five thousand degrees, a megawatt, and no fuel ever again.' }),
    stats,
    keep.el,
  );
  const window = new Window({ title: 'The Starhearth is lit', size: 'md', body });
  window.setAccent(heatColor(1500));
  window.frame.classList.add('hw-window--win');
  fire.start();
  return {
    window,
    refresh: () => {
      const s = ctx.player.stats;
      const values: Record<string, string> = {
        Days: String(ctx.clock.day),
        'Things made': formatCount(sum(s.made)),
        'Blocks placed': formatCount(sum(s.placed)),
        'Blocks mined': formatCount(sum(s.broken)),
        'Goals done': `${ctx.objectives.completed.length} / ${OBJECTIVES.length}`,
        Deaths: String(s.deaths),
      };
      for (const [label, el] of statValues) setText(el, values[label] ?? '');
    },
    dispose: () => {
      fire.dispose();
      keep.dispose();
    },
  };
}
