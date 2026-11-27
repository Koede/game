/**
 * What the furnace and machine screens need from the simulation. `Simulation` (src/sim) satisfies it as is;
 * harnesses and tests may pass anything shaped like it. Types only: the UI never constructs simulation objects.
 */
import type { Inventory } from '../../../game/inventory';
import type { Chest } from '../../../game/storage';
import type { Face } from '../../../core/types';
import type {
  ActionResult, ForgeResult, FurnaceSlots, FurnaceView, MachineView, NetworkStats, PipeView, PortChange, StructureTarget, StructureView,
} from '../../../sim';

export interface ScreenSim {
  furnaceView(x: number, y: number, z: number): FurnaceView | null;
  furnaceSlots(x: number, y: number, z: number): FurnaceSlots | null;
  light(x: number, y: number, z: number): ActionResult;
  douse(x: number, y: number, z: number): ActionResult;
  pump(x: number, y: number, z: number): ActionResult;
  /** Pours a crucible's molten metal into the fired mould `heldKey`, or an ingot of copper or tin into the alloy pot in it. */
  pourCrucible(x: number, y: number, z: number, slot: number, heldKey: string | null): ActionResult;
  setElectric(x: number, y: number, z: number, on: boolean): ActionResult;
  forge(x: number, y: number, z: number, recipeId: string, times?: number): ForgeResult;
  upgrade(x: number, y: number, z: number): ActionResult;
  startIgnition(x: number, y: number, z: number): ActionResult;
  rest(x: number, y: number, z: number): ActionResult;
  networkAt(x: number, y: number, z: number): NetworkStats | null;
  machineView(x: number, y: number, z: number): MachineView | null;
  machineSlots(x: number, y: number, z: number): Inventory | null;
  setMachineOn(x: number, y: number, z: number, on: boolean): ActionResult;
  /** Repairs a worn machine with iron ingots (src/sim/wear.ts). */
  repairMachine(x: number, y: number, z: number): ActionResult;
  stationSources(x: number, y: number, z: number): Inventory[];
  /** The storage network around a chest (docs/api/storage.md): chests within range, and a chest's label. */
  storageNetwork(x: number, y: number, z: number): Chest[];
  crateLabel(x: number, y: number, z: number): string;
  setCrateLabel(x: number, y: number, z: number, label: string): ActionResult;
  /** The STRUCTURE tab and the hearth ghost preview (spec 17.4). */
  structureView(x: number, y: number, z: number, target?: StructureTarget): StructureView | null;
  /** The pipe screen (spec 16.3). */
  pipeView(x: number, y: number, z: number): PipeView | null;
  setPort(x: number, y: number, z: number, dir: Face, change: PortChange): ActionResult;
}

/** The simulation writes temperatures as "700 C"; the UI shows "700 °C". */
export const pretty = (text: string): string => text.replace(/(\d) C\b/g, '$1 °C');
