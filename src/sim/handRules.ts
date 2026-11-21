/** The one adapter between the handwork content (blocks with `handStation`, recipes with `strokes`/`timeS`) and the sim. */
import type { SfxName } from '../core/gameEvents';
import { blockOrNull, itemOrNull, recipesAt } from '../core/registry';
import { stackLimit } from '../game/inventory';
import type { HandRecipe, HandRules, HandStationDef } from './handTypes';

/** Stroke pitch per station (the mortar grinds lower than the quern, with the same sound). */
const PITCH: Record<string, number> = { mortar: 0.7 };
/** Items a timed station takes in at once. */
const TIMED_BATCH = 8;

const stations = new Map<string, HandStationDef | null>();
const recipeLists = new Map<string, HandRecipe[]>();

function recipesOf(station: string): HandRecipe[] {
  let list = recipeLists.get(station);
  if (!list) {
    list = recipesAt(station).map((r) => ({
      id: r.id, station, inputs: r.inputs, output: r.output, toolOutput: r.toolOutput ?? null, bonus: r.bonus ?? null,
      strokes: r.strokes ?? 0, timeS: r.strokes === undefined ? r.timeS : 0,
    }));
    recipeLists.set(station, list);
  }
  return list;
}

function stationOf(key: string): HandStationDef | null {
  const hit = stations.get(key);
  if (hit !== undefined) return hit;
  const def = blockOrNull(key);
  const hs = def?.handStation;
  let out: HandStationDef | null = null;
  if (def && hs && def.machine === 'hand') {
    // A station whose recipes carry no strokes works by itself (rack, trough).
    const timed = recipesOf(key).every((r) => r.strokes === 0);
    out = {
      key, name: def.name, strokesPerS: hs.strokesPerS, tool: hs.tool ?? null, sound: (hs.strokeSound ?? null) as SfxName | null,
      pitch: PITCH[key] ?? 1, hot: hs.hot === true, timed, batch: timed ? TIMED_BATCH : 0,
      needsSky: timed && hs.sky === true, rainResets: timed && hs.sky === true,
    };
  }
  stations.set(key, out);
  return out;
}

export const contentRules: HandRules = {
  station: stationOf,
  recipes: recipesOf,
  toolKind: (item) => itemOrNull(item)?.tool?.kind ?? null,
  itemName: (item) => itemOrNull(item)?.name ?? item,
  stackLimit,
};
