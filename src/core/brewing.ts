/**
 * Brewing's shared tables (BREWING_PLAN 2, 8, 11): the one cup stage <-> block table sim, player and UI agree on,
 * the containers that can be set on a furnace top, and the words for the six drink buffs. Pure data, no imports
 * from the registry (registry.ts validates these tables against the content, see brewValidation.ts).
 */
import {
  HEARTHKEPT_DRAIN_MULT, LASTING_DRAIN_MULT, MENDING_REGEN_MULT, SPRING_JUMP_MULT, SWIFT_SPEED_MULT, VIGOR_MINING_MULT,
} from './constants';
import type { DrinkBuff, DrinkFamily } from './types';

/** Machine kinds of brewing (all MachineRole 'brew'). */
export const BREW_CUP_MACHINE = 'brew_cup';
export const BOIL_BUCKET_MACHINE = 'boil_bucket';
export const KETTLE_MACHINE = 'kettle';

/**
 * The state of a cup setup. The block id is the source of truth for the look; the entity of kind 'brew_cup' holds
 * the timers, the ingredient or drink key and (while loaded or later) the drink it makes.
 *   cup      - a clay cup standing alone
 *   cone     - a drip cone on the cup
 *   loaded   - an ingredient (an item with `brews`) sits in the cone
 *   brewing  - boiling water is dripping through
 *   done     - the cup holds the drink, the cone stays on top
 */
export type CupStage = 'cup' | 'cone' | 'loaded' | 'brewing' | 'done';
export const CUP_STAGES: readonly CupStage[] = ['cup', 'cone', 'loaded', 'brewing', 'done'];

/** The single stage -> block table. Every block here belongs to machine BREW_CUP_MACHINE. */
export const CUP_BLOCK: Readonly<Record<CupStage, string>> = {
  cup: 'clay_cup',
  cone: 'cup_cone',
  loaded: 'cup_cone_loaded',
  brewing: 'cup_brewing',
  done: 'cup_full',
};

const STAGE_OF_BLOCK: ReadonlyMap<string, CupStage> = new Map(CUP_STAGES.map((s) => [CUP_BLOCK[s], s]));
/** The stage a block key stands for, or null when it is not a cup block. */
export const cupStageOfBlock = (blockKey: string): CupStage | null => STAGE_OF_BLOCK.get(blockKey) ?? null;

/** What a cup setup gives back when it is broken (plus its ingredient or drink, which the entity knows). */
export const CUP_PARTS: Readonly<Record<CupStage, readonly string[]>> = {
  cup: ['clay_cup'],
  cone: ['clay_cup', 'drip_cone'],
  loaded: ['clay_cup', 'drip_cone'],
  brewing: ['clay_cup', 'drip_cone'],
  done: ['clay_cup', 'drip_cone'],
};
/** The item that sets the cone on a cup. */
export const CONE_ITEM = 'drip_cone';
/** The cup item (also what drinking returns). */
export const CUP_ITEM = 'clay_cup';

/** The blocks a container turns into when set on a furnace top, cold and boiling. Keyed by the container's item key. */
export interface ContainerBlocks {
  cold: string;
  boiling: string;
}
export const CONTAINER_BLOCKS: Readonly<Record<string, ContainerBlocks>> = {
  water_pail: { cold: 'furnace_bucket', boiling: 'furnace_bucket_boiling' },
  // Glassware (src/content/itemsGlass.ts): water in a beaker or vial, and pine sap cooking down to resin.
  water_beaker: { cold: 'furnace_beaker', boiling: 'furnace_beaker_boiling' },
  water_vial: { cold: 'furnace_vial', boiling: 'furnace_vial_boiling' },
  pine_sap: { cold: 'furnace_sap', boiling: 'furnace_sap_resin' },
};

/** The kettle pot block (its machine kind is KETTLE_MACHINE; the active bit of its voxel is set while it boils). */
export const KETTLE_BLOCK = 'kettle_pot';
/** The Copper Steam Kettle: the same kettle machine, and it gives open steam to a steam rotor standing on it. */
export const STEAM_KETTLE_BLOCK = 'steam_kettle';

/** How the HUD, tooltips and recipe rows name a drink buff. */
export interface DrinkBuffText {
  /** "Spring". */
  name: string;
  family: DrinkFamily;
  /** The effect in plain words, with its number. */
  effect: string;
}

const pct = (mult: number): string => `${Math.round(Math.abs(mult - 1) * 100)}%`;

export const DRINK_BUFFS: Readonly<Record<DrinkBuff, DrinkBuffText>> = {
  spring: { name: 'Spring', family: 'tea', effect: `Jump ${pct(SPRING_JUMP_MULT)} higher` },
  hearthkept: { name: 'Hearthkept', family: 'tea', effect: `The cold drains your warmth ${pct(HEARTHKEPT_DRAIN_MULT)} slower` },
  mending: { name: 'Mending', family: 'tea', effect: `Heal ${MENDING_REGEN_MULT} times as fast` },
  swift: { name: 'Swift', family: 'coffee', effect: `Walk, sprint and swim ${pct(SWIFT_SPEED_MULT)} faster` },
  vigor: { name: 'Vigor', family: 'coffee', effect: `Mine ${pct(VIGOR_MINING_MULT)} faster` },
  lasting: { name: 'Lasting', family: 'coffee', effect: `Hunger comes ${pct(LASTING_DRAIN_MULT)} slower` },
};
export const DRINK_BUFF_KEYS: readonly DrinkBuff[] = ['spring', 'hearthkept', 'mending', 'swift', 'vigor', 'lasting'];
