/** The workbench: its own recipes (the first furnace above all), every hand recipe, and the inventory. */
import { BENCH_RECIPES } from '../../../game/crafting';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { ExperimentPanel } from '../experimentPanel';
import { createCraftingScreen } from '../inventory/craftingScreen';

export function createWorkbenchScreen(request: { type: 'workbench'; x: number; y: number; z: number }, ctx: ScreenContext): GameScreen {
  const { x, y, z } = request;
  const experiment = new ExperimentPanel({ player: ctx.player, bus: ctx.bus, station: 'workbench', changed: () => ctx.invalidate() });
  return createCraftingScreen(ctx, {
    extra: experiment,
    title: 'Workbench',
    subtitle: 'Wood and stone work - and your first furnace',
    listTitle: 'Make at the bench',
    recipes: BENCH_RECIPES,
    crates: () => ctx.sim.stationSources(x, y, z).filter((inv) => inv !== ctx.player.inventory),
    note: (n) => (n > 0 ? `${n} crate${n === 1 ? '' : 's'} nearby lend${n === 1 ? 's' : ''} ingredients.` : ''),
  });
}
