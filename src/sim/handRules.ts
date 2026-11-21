/** The one adapter between the handwork content (blocks with `handStation`, recipes with `strokes`/`timeS`) and the sim. */
import type { SfxName } from '../core/gameEvents';
import { blockOrNull, itemOrNull, machine, recipesAt } from '../core/registry';
import { stackLimit } from '../game/inventory';
import type { HandRecipe, HandRules, HandStationDef } from './handTypes';

/** Stroke sound and pitch per station kind (docs/api/handwork-content.md section 3). */
const SOUNDS: Record<string, [SfxName, number]> = {
  chopping_block: ['chop', 1], hand_quern: ['grind', 1], mortar: ['grind', 0.7], stone_anvil: ['hammer', 1],
  clay_table: ['scrape', 1], loom: ['loom', 1],
};

const stations = new Map<string, HandStationDef | null>();
const recipeLists = new Map<string, HandRecipe[]>();

function stationOf(key: string): HandStationDef | null {
  const hit = stations.get(key);
  if (hit !== undefined) return hit;
  const def = blockOrNull(key);
  const spec = def?.machine ? machine(def.machine) : null;
  let out: HandStationDef | null = null;
  // Mine: stroke stations (handStation) and the timed ones (a batch size). The casting bench and alloy pot are role 'hand' too
  // but belong to casting.
  if (def && spec && spec.role === 'hand' && (def.handStation || spec.params?.batch !== undefined)) {
    const params = spec.params ?? {};
    const [sound, pitch] = SOUNDS[spec.kind] ?? [null, 1];
    out = {
      key: spec.kind, name: def.name, strokesPerS: def.handStation?.strokesPerS ?? 0, tool: def.handStation?.tool ?? null,
      sound, pitch, hot: spec.kind === 'stone_anvil', timed: !def.handStation, batch: params.batch ?? 0,
      needsSky: (params.needsSky ?? 0) > 0, rainResets: (params.rainResets ?? 0) > 0,
    };
  }
  stations.set(key, out);
  return out;
}

export const contentRules: HandRules = {
  station: stationOf,
  recipes(station) {
    let list = recipeLists.get(station);
    if (!list) {
      list = recipesAt(station).map((r) => ({
        id: r.id, station, inputs: r.inputs, output: r.output, toolOutput: r.toolOutput ?? null, bonus: r.bonus ?? null,
        strokes: r.strokes ?? 0, timeS: r.timeS,
      }));
      recipeLists.set(station, list);
    }
    return list;
  },
  toolKind: (item) => itemOrNull(item)?.tool?.kind ?? null,
  itemName: (item) => itemOrNull(item)?.name ?? item,
  stackLimit,
};
