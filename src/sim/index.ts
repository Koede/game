/** Public surface of the simulation. Other modules import from here. */
export { Simulation } from './simulation';
export type { ActionResult, FurnaceEntity, IgnitionState, MachineEntity, SimEntity } from './entities';
export { isFurnace } from './entities';
export type { CropEntity, CropView } from './cropRules';
export { isCrop } from './cropRules';
export type { ForgeResult } from './furnaceActions';
export { REST_FUEL_S } from './furnaceActions';
export type { FurnaceSlots } from './slots';
export type { CrucibleView, ForgeRow, FurnaceView, SmeltRow, Trend, UpgradeView } from './views';
export type { GridSummary, MachineView, NetworkMember, NetworkStats } from './gridViews';
export type { NetworkState } from './power';
export { HISTORY_SECONDS } from './power';
export { smeltRecipeFor } from './furnace';
export { machineRecipeFor, windAt } from './machines';
export { SimWeather, type SimBiomeLookup } from './weather';
export type { FluidStack } from './entities';
export { isPlant } from './cropRules';
// Multiblock hearths (spec 17) and pipe endpoints (spec 16.2): docs/api/hearth.md.
export type { HearthBrief } from './views';
export type { HearthProblem, HearthProblemCode } from './hearthScan';
export { hearthName } from './hearthScan';
export type { FurnaceStats, HearthSummary } from './hearthStats';
export { buildHint } from './hearthStats';
export type { GhostCell, GhostRole, GhostState, MaterialRow, StructureCheck, StructureTarget, StructureView, TierChoice } from './hearthView';
export { TIER_CHOICES } from './hearthView';
export type { FluidEndpoint, ItemEndpoint } from './endpoints';
