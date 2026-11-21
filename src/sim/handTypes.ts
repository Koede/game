/**
 * Types of the hand stations (docs/api/handwork.md): the saved entity, the rules the sim reads (an adapter over the
 * content contract, handRules.ts), the stroke result and the view the HUD shows.
 */
import type { SfxName } from '../core/gameEvents';
import type { BlockEntity, ItemAmount, Slot, ToolKind } from '../core/types';

/**
 * The saved state of one station block (plain JSON). `kind` is always 'hand' (the station is the block at x,y,z); `slots` is
 * [input, output].
 */
export interface HandEntity extends BlockEntity {
  kind: 'hand';
  slots: Slot[];
  /** Strokes done (stroke stations) or seconds done (timed stations). */
  progress: number;
  recipe: string | null;
  /** Seconds left of the hot-work window (0: cold). */
  hotS: number;
  /** Id of the recipe whose output waits in the output slot (for 'item:made' at the take); absent on older saves. */
  made?: string | null;
}

export interface HandStationDef {
  key: string;
  name: string;
  strokesPerS: number;
  /** The tool kind that makes strokes count double. */
  tool: ToolKind | null;
  /** The sfx played on a stroke and its pitch. */
  sound: SfxName | null;
  pitch: number;
  /** Strokes count double inside the hot-work window. */
  hot: boolean;
  /** No strokes: the work runs by itself (drying rack, tanning trough). */
  timed: boolean;
  /** Timed stations: items taken in at once (stroke stations: 0, the stack limit applies). */
  batch: number;
  /** Timed stations: runs only under open sky by day. */
  needsSky: boolean;
  /** Timed stations: rain falling on it zeroes the progress. */
  rainResets: boolean;
}

export interface HandRecipe {
  id: string;
  station: string;
  inputs: ItemAmount[];
  output: ItemAmount;
  toolOutput: ItemAmount | null;
  bonus: (ItemAmount & { chance: number }) | null;
  /** Strokes to finish; 0 for a timed recipe. */
  strokes: number;
  /** Seconds to finish (timed recipes). */
  timeS: number;
}

/** Everything the sim needs from the content, so tests can run on a small fake set. */
export interface HandRules {
  /** The station a block is, or null for any other block. */
  station(blockKey: string): HandStationDef | null;
  recipes(station: string): readonly HandRecipe[];
  /** Tool kind of an item, null for anything else. */
  toolKind(item: string): ToolKind | null;
  itemName(item: string): string;
  /** Stack size limit of an item. */
  stackLimit(item: string): number;
}

export type StrokeResult =
  | { ok: true; did: 'insert' | 'stroke' | 'take' | 'done' | 'return'; done?: boolean }
  | { ok: false; reason: string };

export type HandState = 'empty' | 'loaded' | 'working' | 'waiting' | 'ready';

export interface HandView {
  x: number;
  y: number;
  z: number;
  station: string;
  name: string;
  label: string;
  state: HandState;
  waitReason: string | null;
  input: Slot;
  output: Slot;
  recipe: string | null;
  progress: number;
  needed: number;
  fraction: number;
  timed: boolean;
  hot: boolean;
  strokesPerS: number;
  tool: ToolKind | null;
}

/** Stations within this many blocks of a point get the hot-work window `openHotWindow` opens. */
export const HOT_WINDOW_RADIUS = 6;
