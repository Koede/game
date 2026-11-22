/** Ghost cells (missing and wrong) and the problem list of the distillery rig screen. DOM-free. */
import { describe, expect, it } from 'vitest';
import { PROCESS_BY_ID } from '../../../content/recipesDistill';
import { makeKit } from '../../../sim/testKit';
import { scanRig } from '../../../sim/distillScan';
import {
  capabilityText,
  cardChoices,
  ghostCells,
  ghostClear,
  ghostEvents,
  ghostPayload,
  ghostStep,
  ghostSummary,
  highlightPayload,
  problemGroups,
  DISTILL_GHOST_KEY,
  DISTILL_HIGHLIGHT_S,
} from './rigLogic';

const pot = PROCESS_BY_ID.get('distil_spirit')!;
const column = PROCESS_BY_ID.get('rectify_spirit')!;

describe('rig ghost cells', () => {
  it('marks every unbuilt block of a pot still as missing, and leaves the base out', () => {
    const kit = makeKit();
    kit.world.put(1, 2, 4, 'still_base');
    const cells = ghostCells(kit.world, { x: 1, y: 2, z: 4 }, pot.rig);
    expect(cells).toEqual([
      { x: 1, y: 3, z: 4, block: 'boiling_flask', state: 'missing' },
      { x: 1, y: 4, z: 4, block: 'condenser_coil', state: 'missing' },
      { x: 2, y: 4, z: 4, block: 'receiver', state: 'missing' },
    ]);
    expect(ghostPayload(cells)).toEqual({ key: 'distill', cells });
    expect(ghostPayload(cells).key).toBe(DISTILL_GHOST_KEY);
    expect(ghostSummary(cells)).toBe('3 missing');
  });

  it('counts a done twin as in place, dirt as wrong, and air as missing', () => {
    const kit = makeKit();
    kit.world.put(0, 2, 0, 'still_base');
    kit.world.put(0, 3, 0, 'boiling_flask_done');
    kit.world.put(0, 4, 0, 'dirt');
    const cells = ghostCells(kit.world, { x: 0, y: 3, z: 0 }, pot.rig);
    expect(cells).toEqual([
      { x: 0, y: 4, z: 0, block: 'condenser_coil', state: 'wrong' },
      { x: 1, y: 4, z: 0, block: 'receiver', state: 'missing' },
    ]);
    expect(ghostSummary(cells)).toBe('1 missing, 1 wrong');
  });

  it('stands a column on the segment the world already matches', () => {
    const kit = makeKit();
    kit.world.put(5, 2, 3, 'still_base');
    kit.world.put(5, 3, 3, 'boiling_flask');
    kit.world.put(5, 4, 3, 'column_segment');
    const cells = ghostCells(kit.world, { x: 5, y: 4, z: 3 }, column.rig);
    expect(cells).toEqual([
      { x: 5, y: 5, z: 3, block: 'column_segment', state: 'missing' },
      { x: 5, y: 6, z: 3, block: 'condenser_coil', state: 'missing' },
      { x: 6, y: 6, z: 3, block: 'receiver', state: 'missing' },
    ]);
  });

  it('emits nothing once every block of the card is the right kind', () => {
    const kit = makeKit();
    kit.world.put(0, 2, 0, 'still_base');
    kit.world.put(0, 3, 0, 'boiling_flask');
    kit.world.put(0, 4, 0, 'condenser_coil');
    kit.world.put(1, 4, 0, 'receiver');
    expect(ghostCells(kit.world, { x: 1, y: 4, z: 0 }, pot.rig)).toEqual([]);
    expect(ghostSummary([])).toBe('Every block of this process is in place.');
  });

  it('stays up when the screen closes, replaces on another card, and clears when the rig is complete', () => {
    const missing = [{ x: 1, y: 3, z: 0, block: 'boiling_flask', state: 'missing' as const }];
    const other = [{ x: 0, y: 4, z: 0, block: 'condenser_coil', state: 'wrong' as const }];
    const held = { cardId: 'distil_spirit', cells: missing };

    expect(ghostStep(held, null)).toEqual({ op: 'stay' });
    expect(ghostEvents(ghostStep(held, null))).toEqual([]);

    const replaced = ghostStep(held, { cardId: 'distil_syrup', cells: other });
    expect(replaced).toEqual({ op: 'replace', cells: other });
    expect(ghostEvents(replaced)).toEqual([
      { type: 'ghost:clear', key: 'distill' },
      { type: 'ghost:show', key: 'distill', cells: other },
    ]);

    expect(ghostStep(held, { cardId: 'distil_spirit', cells: [] })).toEqual({ op: 'clear' });
    expect(ghostEvents({ op: 'clear' })).toEqual([{ type: 'ghost:clear', key: ghostClear().key }]);
    expect(ghostClear()).toEqual({ key: 'distill' });

    expect(ghostStep(null, { cardId: 'distil_spirit', cells: missing }).op).toBe('show');
    expect(ghostEvents(ghostStep(null, { cardId: 'distil_spirit', cells: missing }))).toEqual([
      { type: 'ghost:show', ...ghostPayload(missing) },
    ]);
  });

  it('offers the cards that use the wrenched block', () => {
    expect(cardChoices('boiling_flask').map((c) => c.id)).toEqual([
      'distil_syrup', 'distil_low_wines', 'distil_spirit', 'refine_crude', 'rectify_spirit', 'refine_crude_short',
      'vacuum_residue',
      'essence_spring', 'essence_hearthkept', 'essence_mending', 'essence_swift', 'essence_vigor', 'essence_lasting',
    ]);
    expect(cardChoices('boiling_flask_done').map((c) => c.id)).toContain('distil_spirit');
    expect(cardChoices('reaction_vessel').map((c) => c.id)).toEqual([
      'ferment_wash', 'macerate_tincture', 'mix_asphalt',
      'elixir_spring', 'elixir_hearthkept', 'elixir_mending', 'elixir_swift', 'elixir_vigor', 'elixir_lasting',
    ]);
    expect(cardChoices('cooling_jacket')).toEqual([]);
    const spirit = cardChoices('still_base').find((c) => c.id === 'distil_spirit');
    expect(spirit).toMatchObject({ title: 'Spirit', detail: '92 °C on the still base' });
    expect(cardChoices('airlock_cap')[0]).toMatchObject({ id: 'ferment_wash', detail: 'Sealed vessel' });
  });
});

describe('rig problems and capabilities', () => {
  it('lists a bare flask as two problems, both on that block', () => {
    const kit = makeKit();
    kit.world.put(0, 3, 0, 'boiling_flask');
    const groups = problemGroups(scanRig(kit.world, 0, 3, 0)!.problems);
    expect(groups).toEqual([
      { text: 'The Boiling Flask needs a Still Base under it', at: [{ x: 0, y: 3, z: 0 }] },
      { text: 'The vapour has nowhere to go: put a Condenser Coil on top', at: [{ x: 0, y: 3, z: 0 }] },
    ]);
    expect(highlightPayload(groups[0].at[0])).toEqual({ x: 0, y: 3, z: 0, seconds: DISTILL_HIGHLIGHT_S });
    expect(DISTILL_HIGHLIGHT_S).toBe(6);
  });

  it('names the condenser that drips onto nothing', () => {
    const kit = makeKit();
    kit.world.put(0, 2, 0, 'still_base');
    kit.world.put(0, 3, 0, 'boiling_flask');
    kit.world.put(0, 4, 0, 'condenser_coil');
    const rig = scanRig(kit.world, 0, 4, 0)!;
    const drip = problemGroups(rig.problems).find((g) => g.text.startsWith('This condenser drips'));
    expect(drip?.at).toEqual([{ x: 0, y: 4, z: 0 }]);
    expect(capabilityText(rig)).toBe('This rig can: distil, 1 cut.');
  });

  it('folds problems that share a sentence and keeps every block', () => {
    const groups = problemGroups([
      { text: 'A column holds 8 segments at most', cells: ['1,2,3'] },
      { text: 'A column holds 8 segments at most', cells: ['4,5,6', '7,8,-1'] },
      { text: 'A rig holds at most 64 pieces of glassware', cells: ['0,1,0'] },
      { text: 'skipped', cells: ['nope'] },
    ]);
    expect(groups).toEqual([
      { text: 'A column holds 8 segments at most', at: [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: -1 }] },
      { text: 'A rig holds at most 64 pieces of glassware', at: [{ x: 0, y: 1, z: 0 }] },
      { text: 'skipped', at: [] },
    ]);
  });

  it('says distil, the cuts, ferment and cooled from what is standing', () => {
    expect(capabilityText({
      stills: [{ flask: '0,1,0', base: '0,0,0', segments: ['0,2,0', '0,3,0'], draws: [], head: '0,4,0', reflux: null, vacuum: false }],
      sealed: new Set(['1,0,0']),
      jackets: new Map([['0,4,0', ['2,4,0']]]),
    })).toBe('This rig can: distil, 1 cut, ferment, cooled.');
    expect(capabilityText({
      stills: [{ flask: '0,1,0', base: '0,0,0', segments: ['0,2,0', '0,3,0', '0,4,0'], draws: [{ h: 1, condenser: '1,2,0' }], head: '0,5,0', reflux: null, vacuum: false }],
      sealed: new Set(),
      jackets: new Map(),
    })).toBe('This rig can: distil, 2 cuts.');
    expect(capabilityText({
      stills: [{ flask: '0,1,0', base: null, segments: [], draws: [], head: null, reflux: null, vacuum: false }],
      sealed: new Set(),
      jackets: new Map(),
    })).toBe('This rig can: nothing yet.');

    const kit = makeKit();
    kit.world.put(2, 2, 0, 'reaction_vessel');
    kit.world.put(2, 3, 0, 'airlock_cap');
    expect(capabilityText(scanRig(kit.world, 2, 2, 0)!)).toBe('This rig can: ferment.');
  });
});
