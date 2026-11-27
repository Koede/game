/**
 * Machine wear and upkeep. A machine that works wears (`MachineEntity.wear`, 0 = as new, 1 = worn out); a worn one runs
 * slower, a broken one stops until it is repaired, and a repaired one that is kept up runs a little faster than new.
 *
 * Saves from before wear have no `wear` field: such a machine reads as 0, so it starts in good condition.
 * Pure rules only; the behaviours call them (machines.ts) and the simulation spends the repair materials.
 */
import type { MachineEntity } from './entities';

/** Seconds of running that wear a machine out completely (it is Worn at about half of this). */
export const WEAR_FULL_RUN_S = 3000;
/** The wear a machine is repaired back to. */
export const REPAIRED_WEAR = 0;
/** Iron ingots a full repair costs; a lighter repair costs proportionally (at least one). */
export const REPAIR_INGOTS_FULL = 3;
export const REPAIR_ITEM = 'iron_ingot';
/** A repaired machine below this wear runs at KEPT_SPEED until it wears past it. */
export const KEPT_BELOW = 0.2;
export const KEPT_SPEED = 1.15;

export type Condition = 'kept' | 'good' | 'worn' | 'failing' | 'broken';

/** Machine kinds that wear while they run: the ones with moving parts. Lamps, batteries, crates, tanks and the like do not. */
const WEARING = new Set([
  'crusher', 'still', 'centrifuge', 'electrolyzer', 'bore_rig', 'drill_rig', 'blower', 'burner_generator', 'combustion_engine',
  'steam_engine', 'wind_turbine', 'water_wheel',
]);

export const wearsOut = (kind: string): boolean => WEARING.has(kind);

export const wearOf = (e: { wear?: number }): number => (typeof e.wear === 'number' && Number.isFinite(e.wear) ? Math.min(1, Math.max(0, e.wear)) : 0);

export function conditionOf(e: Pick<MachineEntity, 'wear' | 'kept'>): Condition {
  const w = wearOf(e);
  if (w >= 1) return 'broken';
  if (w >= 0.8) return 'failing';
  if (w >= 0.5) return 'worn';
  return e.kept === true && w < KEPT_BELOW ? 'kept' : 'good';
}

const SPEED: Record<Condition, number> = { kept: KEPT_SPEED, good: 1, worn: 0.85, failing: 0.6, broken: 0 };

/** How fast a machine works: 1 is the speed it always had. */
export const speedOf = (e: Pick<MachineEntity, 'wear' | 'kept'>): number => SPEED[conditionOf(e)];

export const isBroken = (e: Pick<MachineEntity, 'wear'>): boolean => wearOf(e) >= 1;

export const CONDITION_TEXT: Record<Condition, string> = {
  kept: 'Well kept: runs faster', good: 'Good condition', worn: 'Worn: runs slower', failing: 'Failing: runs much slower', broken: 'Broken: repair it to run',
};

/** Adds the wear of `runS` seconds of work. */
export function addWear(e: MachineEntity, runS: number): void {
  const w = wearOf(e);
  if (w >= 1) return;
  e.wear = Math.min(1, w + runS / WEAR_FULL_RUN_S);
}

/** Iron ingots a repair of this machine costs (0: nothing to repair). */
export function repairCost(e: Pick<MachineEntity, 'wear'>): number {
  const w = wearOf(e);
  return w <= 0.001 ? 0 : Math.max(1, Math.ceil(w * REPAIR_INGOTS_FULL - 1e-9));
}

/** What an NPC with the Upkeep job does in one visit: this much wear is taken off (docs/api/machine-wear.md). */
export const NPC_TEND_WEAR = 0.25;
