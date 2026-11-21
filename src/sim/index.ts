/** Public surface of the simulation. Other modules import from here. */
export { Simulation } from './simulation';
export type { ActionResult, FurnaceEntity, IgnitionState, MachineEntity, SimEntity } from './entities';
export { isFurnace } from './entities';
export type { ForgeResult } from './furnaceActions';
export { REST_FUEL_S } from './furnaceActions';
export type { FurnaceSlots } from './slots';
export type {
  CrucibleView, ForgeRow, FurnaceView, MachineView, NetworkMember, NetworkStats, Trend, UpgradeView,
} from './views';
export type { NetworkState } from './power';
export { HISTORY_SECONDS } from './power';
export { smeltRecipeFor } from './furnace';
export { machineRecipeFor, windAt } from './machines';
