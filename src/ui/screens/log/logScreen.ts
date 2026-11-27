/** The Hearth Log as a standalone screen (L, or a tap on the goal tracker). */
import type { GameScreen, ScreenContext } from '../../gameUI';
import { keepsakeOf } from '../../../game/dailyGoals';
import { Window } from '../../kit/window';
import { HearthLogView } from './hearthLog';
import { AchievementsView } from './achievementsView';
import { DailyGoalsView } from './dailyGoalsView';
import { JournalView } from './journalView';
import { LegendsView } from './legendsView';

/** "Day 12", with the worn keepsake after it. */
function dayLine(ctx: ScreenContext): string {
  const worn = ctx.dailyGoals?.worn;
  const name = worn ? keepsakeOf(worn)?.name : undefined;
  return name ? `Day ${ctx.clock.day} \u00b7 ${name}` : `Day ${ctx.clock.day}`;
}

export function createLogScreen(request: { type: 'log'; focus?: 'journal' | 'achievements' | 'goals' }, ctx: ScreenContext): GameScreen {
  const view = new HearthLogView(ctx.objectives, () => ctx.weather);
  const dg = ctx.dailyGoals ? new DailyGoalsView(ctx.dailyGoals) : null;
  if (dg) view.el.append(dg.el);
  const journal = ctx.journal ? new JournalView(ctx.journal, ctx.world, () => ctx.player.position) : null;
  if (journal) view.el.append(journal.el);
  const legends = ctx.journal ? new LegendsView(ctx.journal) : null;
  if (legends) view.el.append(legends.el);
  const medals = ctx.achievements ? new AchievementsView(ctx.achievements) : null;
  if (medals) view.el.append(medals.el);
  const window = new Window({ title: 'Hearth Log', subtitle: dayLine(ctx), size: 'md', fit: 'tall', body: view.el });
  const target = request.focus === 'journal' ? journal?.el : request.focus === 'achievements' ? medals?.el : request.focus === 'goals' ? dg?.el : null;
  if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  return {
    window,
    refresh: () => {
      view.refresh();
      dg?.refresh();
      journal?.refresh();
      legends?.refresh();
      medals?.refresh();
      window.setSubtitle(dayLine(ctx));
    },
    dispose: () => undefined,
  };
}
