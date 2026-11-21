/** The view of a hand station: the aiming line and the work bar (docs/api/handwork.md). */
import type { HandNode } from './handWork';
import type { HandRecipe, HandRules, HandState, HandView } from './handTypes';

export function buildView(n: HandNode, rules: HandRules, r: HandRecipe | null, wait: string | null): HandView {
  const { e, def } = n;
  const [input, output] = [e.slots[0], e.slots[1]];
  const timed = def.timed;
  const needed = r ? (timed ? r.timeS : r.strokes) : 0;
  const hot = def.hot && e.hotS > 0;
  const name = (item: string): string => rules.itemName(item).toLowerCase();
  let state: HandState;
  let label: string;
  if (output) {
    state = 'ready';
    label = `${def.name} - ${name(output.item)} ready`;
  } else if (!input) {
    state = 'empty';
    label = `${def.name} - empty`;
  } else if (!r) {
    state = 'loaded';
    label = `${def.name} - ${name(input.item)}: nothing to work`;
  } else if (r && input.count < r.inputs[0].count) {
    state = 'loaded';
    label = `${def.name} - ${name(input.item)}: needs ${r.inputs[0].count}`;
  } else if (timed) {
    state = wait ? 'waiting' : 'working';
    const shown = `${Math.floor(e.progress)}/${r.timeS} s`;
    label = `${def.name} - ${name(input.item)} ${shown}${wait ? ` (${wait.toLowerCase()})` : ''}`;
  } else {
    state = e.progress > 0 ? 'working' : 'loaded';
    label = `${def.name} - ${name(input.item)} ${Math.floor(e.progress)}/${r.strokes} strokes${hot ? ' (hot)' : ''}`;
  }
  return {
    x: e.x, y: e.y, z: e.z, station: def.key, name: def.name, label, state, waitReason: timed && input ? wait : null,
    input, output, recipe: r && input && !output ? r.id : null, progress: e.progress, needed,
    fraction: needed > 0 ? Math.min(1, e.progress / needed) : 0, timed, hot, strokesPerS: def.strokesPerS, tool: def.tool,
  };
}
