/** The Hearth Log as a standalone screen (L, or a tap on the goal tracker). */
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Window } from '../../kit/window';
import { HearthLogView } from './hearthLog';

export function createLogScreen(_request: { type: 'log' }, ctx: ScreenContext): GameScreen {
  const view = new HearthLogView(ctx.objectives);
  const window = new Window({ title: 'Hearth Log', subtitle: `Day ${ctx.clock.day}`, size: 'md', fit: 'tall', body: view.el });
  return {
    window,
    refresh: () => {
      view.refresh();
      window.setSubtitle(`Day ${ctx.clock.day}`);
    },
    dispose: () => undefined,
  };
}
