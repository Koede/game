/** The STRUCTURE tab's DOM-free logic and the ghost keeper, against real simulation views (src/sim/testKit). */
import { describe, expect, it } from 'vitest';
import type { GameEvents } from '../../../core/gameEvents';
import { makeKit, type Kit } from '../../../sim/testKit';
import { HearthGhost } from './hearthGhost';
import {
  checkText, effectText, ghostCells, groupProblems, ghostKey, hearthIntro, innerBounds, materialTexts, statusTone, structureBadge, tierRules,
  tierShort, wallSource,
} from './structureText';

/** A furnace at 0, 1, 0 facing north (its hearth lies towards +z). */
function kitWith(block = 'furnace_clay'): Kit {
  const kit = makeKit();
  kit.furnace(0, 1, 0, block);
  return kit;
}

const flush = (): Promise<void> => Promise.resolve();

describe('structure text', () => {
  it('turns the ghost cells into the overlay payload: missing and wrong only', () => {
    const kit = kitWith();
    const fresh = kit.sim.structureView(0, 1, 0)!;
    const cells = ghostCells(fresh);
    expect(cells).toHaveLength(16);
    expect(cells.every((c) => c.block === 'brick' && c.state === 'missing')).toBe(true);
    kit.formed(0, 1, 0, { tier: 3 });
    kit.world.put(1, 1, 1, 'dirt');
    kit.world.put(0, 1, 1, 'torch');
    const view = kit.sim.structureView(0, 1, 0, { tier: 3 })!;
    expect(ghostCells(view)).toEqual([
      { x: 1, y: 1, z: 1, block: 'brick', state: 'wrong' },
      { x: 0, y: 1, z: 1, block: 'air', state: 'wrong' },
    ]);
    expect(ghostKey(0, 1, 0)).toBe('hearth:0,1,0');
  });

  it('words the checklist, the tier picker and the materials', () => {
    expect(checkText({ key: 'floor', label: 'Floor', have: 8, need: 9, ok: false })).toBe('Floor 8/9');
    expect(checkText({ key: 'interior', label: 'Inside empty', have: 1, need: 1, ok: true })).toBe('Inside empty');
    expect(checkText({ key: 'interior', label: 'Inside empty', have: 1, need: 3, ok: false })).toBe('Inside: 2 blocks in the way');
    expect(checkText({ key: 'ports', label: 'Power ports', have: 0, need: 2, ok: false })).toBe('Power ports 0/2');
    const tiers = kitWith().sim.structureView(0, 1, 0)!.tiers;
    expect(tiers.map(tierShort)).toEqual(['Blast', 'Arc', 'Plasma', 'Star']);
    expect(tierRules(tiers[0])).toBe('Brick walls, inside 1x1x1 to 3x3x3, open top allowed');
    expect(tierRules(tiers[2])).toBe('Plasma Casing walls, inside 2x2x2 to 5x5x4, a ceiling, 2 Power Ports in the walls');
    expect(tierRules(tiers[1])).toContain('1 Arc Electrode in the ceiling');
    expect(materialTexts({ item: 'brick', need: 16, placed: 14, missing: 2, have: 8, ok: true })).toEqual({ placed: '14/16 placed', have: 'Have 8 / need 2' });
    expect(materialTexts({ item: 'brick', need: 16, placed: 16, missing: 0, have: 0, ok: true }).have).toBe('All placed');
  });

  it('bounds the inside steppers by the tier', () => {
    const plasma = kitWith('furnace_plasma').sim.structureView(0, 1, 0)!.tiers[2];
    expect(innerBounds(plasma, 0)).toEqual([2, 5]);
    expect(innerBounds(plasma, 2)).toEqual([2, 4]);
    expect(innerBounds(plasma, 1)).toEqual([2, 5]);
  });

  it('says what the hearth means for the furnace', () => {
    const clay = kitWith();
    const lone = clay.sim.structureView(0, 1, 0)!;
    expect(statusTone(lone)).toBe('neutral');
    expect(effectText(lone)).toBe('A Clay Furnace stands alone. Upgrade it to a Bronze Furnace first (header button): a hearth comes with the Blast Furnace after it.');
    const bronze = kitWith('furnace_bronze');
    expect(effectText(bronze.sim.structureView(0, 1, 0)!)).toBe('The Bronze Furnace stands alone. Build a hearth around it to upgrade it.');
    bronze.formed(0, 1, 0, { tier: 3 });
    const ready = bronze.sim.structureView(0, 1, 0)!;
    expect(effectText(ready)).toBe('The Blast hearth stands: the furnace can now be upgraded (header button).');

    const blast = kitWith('furnace_blast');
    const bare = blast.sim.structureView(0, 1, 0)!;
    expect(statusTone(bare)).toBe('warn');
    expect(effectText(bare)).toBe('Until its Blast hearth forms, the Blast Furnace runs like a Bronze Furnace: 1100 °C at most.');
    expect(structureBadge(blast.sim.furnaceView(0, 1, 0)!)).toBe('!');
    blast.formed(0, 1, 0);
    const formed = blast.sim.structureView(0, 1, 0)!;
    expect(statusTone(formed)).toBe('good');
    expect(effectText(formed)).toBe('Runs at full strength as the Blast Furnace: up to 1500 °C.');
    expect(structureBadge(blast.sim.furnaceView(0, 1, 0)!)).toBeNull();

    const arc = kitWith('furnace_arc');
    arc.formed(0, 1, 0, { tier: 3 });
    const held = arc.sim.structureView(0, 1, 0)!;
    expect(statusTone(held)).toBe('warn');
    expect(effectText(held)).toBe('The Blast hearth holds it back: the Arc Furnace runs like a Blast Furnace (1500 °C at most) until its Arc hearth forms.');
  });

  it('folds problems with the same words into one row with every block', () => {
    const kit = kitWith('furnace_blast');
    kit.formed(0, 1, 0, { tier: 3, inner: [3, 3, 2] });
    const view = kit.sim.structureView(0, 1, 0, { tier: 5 })!;
    expect(view.problems.length).toBe(8);
    const groups = groupProblems(view.problems);
    expect(groups.length).toBeLessThan(view.problems.length);
    const walls = groups.find((g) => g.text === 'Wall is not Plasma Casing')!;
    expect(walls.at.length).toBe(view.problems.filter((p) => p.text === walls.text).length);
    expect(groups.reduce((n, g) => n + g.at.length, 0)).toBe(8);
  });

  it('introduces the hearth at tier 1 with the real brick recipe', () => {
    expect(wallSource('brick')).toBe('Forge Brick here at 400 °C from 4 Firebrick.');
    const intro = hearthIntro();
    expect(intro.lines.join(' ')).toContain('brick walls around the furnace');
    expect(intro.lines).toContain(wallSource('brick'));
  });
});

describe('hearth ghost keeper', () => {
  function keeper(kit: Kit): { ghost: HearthGhost; shows: GameEvents['ghost:show'][]; clears: GameEvents['ghost:clear'][] } {
    const shows = kit.record('ghost:show');
    const clears = kit.record('ghost:clear');
    return { ghost: new HearthGhost(kit.bus, kit.sim), shows, clears };
  }

  it('shows the cells, follows each block placed inside the plan, and clears when the hearth forms', async () => {
    const kit = kitWith();
    const { ghost, shows, clears } = keeper(kit);
    expect(ghost.show(0, 1, 0, { tier: 3 })).toBe(true);
    expect(ghost.isShown(0, 1, 0)).toBe(true);
    expect(shows).toHaveLength(1);
    expect(shows[0].key).toBe('hearth:0,1,0');
    expect(shows[0].cells).toHaveLength(16);
    kit.world.put(0, 0, 1, 'brick');
    kit.world.put(0, 0, 2, 'brick');
    await flush();
    expect(shows).toHaveLength(2); // one update for the burst
    expect(shows[1].cells).toHaveLength(14);
    kit.world.put(20, 1, 20, 'brick'); // far away: nothing
    await flush();
    expect(shows).toHaveLength(2);
    const plan = kit.sim.structureView(0, 1, 0, { tier: 3 })!;
    for (const c of plan.target.cells) if (c.state !== 'ok') kit.world.put(c.x, c.y, c.z, c.want);
    kit.sim.validateHearths();
    await flush();
    expect(ghost.isShown(0, 1, 0)).toBe(false);
    expect(clears.at(-1)).toEqual({ key: 'hearth:0,1,0' });
  });

  it('follows a new target while shown, remembers the choice, and clears when turned off or the furnace goes', () => {
    const kit = kitWith('furnace_plasma');
    const { ghost, shows, clears } = keeper(kit);
    ghost.show(0, 1, 0, { tier: 5 });
    const small = shows[0].cells.length;
    ghost.choose(0, 1, 0, { tier: 5, inner: [3, 3, 3] });
    expect(clears).toEqual([{ key: 'hearth:0,1,0' }]);
    expect(shows).toHaveLength(2);
    expect(shows[1].cells.length).toBeGreaterThan(small);
    expect(ghost.target(0, 1, 0)).toEqual({ tier: 5, inner: [3, 3, 3] });
    ghost.hide(0, 1, 0);
    expect(clears).toHaveLength(2);
    ghost.choose(0, 1, 0, { tier: 3 });
    expect(shows).toHaveLength(2); // not shown: choosing only remembers
    ghost.show(0, 1, 0, { tier: 3 });
    kit.world.put(0, 1, 0, 'air');
    expect(ghost.isShown(0, 1, 0)).toBe(false);
    expect(ghost.target(0, 1, 0)).toBeUndefined();
    expect(clears.at(-1)).toEqual({ key: 'hearth:0,1,0' });
  });

  it('shows nothing for a hearth that already stands, or without a furnace', () => {
    const kit = kitWith('furnace_blast');
    kit.formed(0, 1, 0);
    const { ghost, shows } = keeper(kit);
    expect(ghost.show(0, 1, 0, { tier: 3 })).toBe(false);
    expect(ghost.show(9, 1, 9, { tier: 3 })).toBe(false);
    expect(shows).toHaveLength(0);
    expect(ghost.isShown(0, 1, 0)).toBe(false);
  });
});
