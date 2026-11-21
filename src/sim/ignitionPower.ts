/**
 * Whether the Starhearth's network can carry its 90 s ignition (spec 3.1): the power it needs on top of everything else
 * the network feeds, what generation and storage can give, how long the storage covers the shortfall, and whether the
 * weakest cable can carry it at all. The ignition panel shows each; a cable too weak refuses the start (it can never
 * succeed), a short supply only warns - failing is part of the game.
 */
import { BLOCKS } from '../core/registry';
import type { BlockDef } from '../core/types';
import { formatWatts } from '../game/objectives';
import type { FurnaceEntity, MachineEntity, SimNode } from './entities';
import { IGNITION_MIN_F, IGNITION_POWER, IGNITION_TIME_S } from './furnace';

export interface IgnitionPower {
  /** What the network must deliver during ignition: its other consumers, this furnace's heating and the ignition. */
  needW: number;
  /** The least of that which keeps ignition going (it needs IGNITION_MIN_F of its demand met). */
  minW: number;
  generationW: number;
  /** Most the storage on the network can give at once (batteries that are on and hold anything). */
  dischargeW: number;
  storedJ: number;
  /** Weakest cable on the network (Infinity without cables). */
  ratingW: number;
  /** Generation short of `minW` (0: generation alone carries it). */
  shortfallW: number;
  /** Seconds the storage covers the shortfall (Infinity without one). */
  lastsS: number;
  cableOk: boolean;
  supplyOk: boolean;
  storageOk: boolean;
}

const CABLES: readonly BlockDef[] = BLOCKS.filter((b) => b.cableRatingW > 0).sort((a, b) => a.cableRatingW - b.cableRatingW);

/** The weakest cable block that carries `watts`, or null when none does. */
export const cableFor = (watts: number): BlockDef | null => CABLES.find((c) => c.cableRatingW >= watts) ?? null;

/** The ignition numbers of a furnace's network, or null without a network. */
export function ignitionPower(e: FurnaceEntity, node: SimNode): IgnitionPower | null {
  const net = node.net;
  if (!net) return null;
  const needW = Math.max(0, net.demandW - e.demandW) + e.heatDemandW + IGNITION_POWER;
  const minW = needW * IGNITION_MIN_F;
  let dischargeW = 0;
  for (const s of net.storage) {
    const m = s.e as MachineEntity;
    if (m.on && m.storedJ > 0) dischargeW += s.spec.rateW ?? 0;
  }
  const generationW = net.generationW;
  const shortfallW = Math.max(0, minW - generationW);
  const lastsS = shortfallW > 0 ? net.storedJ / shortfallW : Infinity;
  return {
    needW, minW, generationW, dischargeW, storedJ: net.storedJ, ratingW: net.ratingW, shortfallW, lastsS,
    cableOk: net.ratingW >= minW,
    supplyOk: generationW + dischargeW >= minW,
    storageOk: lastsS >= IGNITION_TIME_S,
  };
}

/** Why a network's cables can never carry the ignition, or null when they can. */
export function cableRefusal(p: IgnitionPower): string | null {
  if (p.cableOk) return null;
  const better = cableFor(p.minW);
  const fix = better ? `: lay ${better.name.toLowerCase()}` : '';
  return `Cable limit ${formatWatts(p.ratingW)} - needs ${formatWatts(p.needW)}${fix}`;
}
