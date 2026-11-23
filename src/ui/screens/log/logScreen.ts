/** The Hearth Log as a standalone screen (L, or a tap on the goal tracker). */
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Window } from '../../kit/window';
import { HearthLogView } from './hearthLog';
import { AchievementsView } from './achievementsView';
import { JournalView } from './journalView';

export function createLogScreen(_request: { type: 'log' }, ctx: ScreenContext): GameScreen {
  const view = new HearthLogView(ctx.objectives, () => ctx.weather);
  const journal = ctx.journal ? new JournalView(ctx.journal, ctx.world, () => ctx.player.position) : null;
  if (journal) view.el.append(journal.el);
  const medals = ctx.achievements ? new AchievementsView(ctx.achievements) : null;
  if (medals) view.el.append(medals.el);
  const window = new Window({ title: 'Hearth Log', subtitle: `Day ${ctx.clock.day}`, size: 'md', fit: 'tall', body: view.el });
  return {
    window,
    refresh: () => {
      view.refresh();
      journal?.refresh();
      medals?.refresh();
      window.setSubtitle(`Day ${ctx.clock.day}`);
    },
    dispose: () => undefined,
  };
}
