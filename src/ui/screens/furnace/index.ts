/**
 * The furnace and machine screens (7.4b). main.ts calls registerStationScreens(gameUI, sim) once both exist;
 * GameUI then opens them on 'ui:open' { type: 'furnace' | 'machine' | 'crate' }.
 */
import type { GameUI } from '../../gameUI';
import { createCrateScreen, createMachineScreen } from '../machines/machineScreen';
import { createFurnaceScreen } from './furnaceScreen';
import type { ScreenSim } from './simApi';

export { createFurnaceScreen } from './furnaceScreen';
export type { ScreenSim } from './simApi';

export function registerStationScreens(ui: Pick<GameUI, 'registerScreen'>, sim: ScreenSim): void {
  ui.registerScreen('furnace', (req, ctx) => createFurnaceScreen(req, ctx, sim));
  ui.registerScreen('machine', (req, ctx) => createMachineScreen(req, ctx, sim));
  ui.registerScreen('crate', (req, ctx) => createCrateScreen(req, ctx, sim));
}
