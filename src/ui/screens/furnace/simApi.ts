/**
 * What the furnace and machine screens need from the simulation. `Simulation` (src/sim) satisfies it as is;
 * harnesses and tests may pass anything shaped like it. Types only: the UI never constructs simulation objects.
 */
import type { Inventory } from '../../../game/inventory';
import type { ActionResult, ForgeResult, FurnaceSlots, FurnaceView, MachineView, NetworkStats } from '../../../sim';

export interface ScreenSim {
  furnaceView(x: number, y: number, z: number): FurnaceView | null;
  furnaceSlots(x: number, y: number, z: number): FurnaceSlots | null;
  light(x: number, y: number, z: number): ActionResult;
  douse(x: number, y: number, z: number): ActionResult;
  pump(x: number, y: number, z: number): ActionResult;
  setElectric(x: number, y: number, z: number, on: boolean): ActionResult;
  forge(x: number, y: number, z: number, recipeId: string, times?: number): ForgeResult;
  upgrade(x: number, y: number, z: number): ActionResult;
  startIgnition(x: number, y: number, z: number): ActionResult;
  rest(x: number, y: number, z: number): ActionResult;
  networkAt(x: number, y: number, z: number): NetworkStats | null;
  machineView(x: number, y: number, z: number): MachineView | null;
  machineSlots(x: number, y: number, z: number): Inventory | null;
  setMachineOn(x: number, y: number, z: number, on: boolean): ActionResult;
  stationSources(x: number, y: number, z: number): Inventory[];
}

/** The simulation writes temperatures as "700 C"; the UI shows "700 °C". */
export const pretty = (text: string): string => text.replace(/(\d) C\b/g, '$1 °C');
