/** The Hearth Log as a standalone screen (L, a tap on the goal tracker, or the pause menu's Journal / Achievements entries). */
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Window } from '../../kit/window';
import { HearthLogView } from './hearthLog';
import { AchievementsView } from './achievementsView';
import { JournalView } from './journalView';

export function createLogScreen(request: { type: 'log'; section?: 'journal' | 'achievements' }, ctx: ScreenContext): GameScreen {
  const view = new HearthLogView(ctx.objectives, () => ctx.weather);
  const journal = ctx.journal ? new JournalView(ctx.journal, ctx.world, () => ctx.player.position) : null;
  if (journal) view.el.append(journal.el);
  const medals = ctx.achievements ? new AchievementsView(ctx.achievements) : null;
  if (medals) view.el.append(medals.el);
  const window = new Window({ title: 'Hearth Log', subtitle: `Day ${ctx.clock.day}`, size: 'md', fit: 'tall', body: view.el });
  // Asked for one section: scroll it into view once the window is on the page.
  const target = request.section === 'journal' ? journal?.el : request.section === 'achievements' ? medals?.el : undefined;
  let scrolled = !target;
  return {
    window,
    refresh: () => {
      view.refresh();
      journal?.refresh();
      medals?.refresh();
      if (!scrolled && target?.isConnected) {
        scrolled = true;
        target.scrollIntoView?.({ block: 'start' });
      }
      window.setSubtitle(`Day ${ctx.clock.day}`);
    },
    dispose: () => undefined,
  };
}
