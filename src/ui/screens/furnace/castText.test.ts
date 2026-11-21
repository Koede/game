import { describe, expect, it } from 'vitest';
import { MOLTEN_WINDOW_S } from '../../../core/constants';
import { makeKit } from '../../../sim/testKit';
import { choicesKey, castView } from './castText';

function molten(units: number, ingot = 'bronze_ingot', moulds: string[] = []) {
  const kit = makeKit();
  const e = kit.furnace(0, 1, 0, 'furnace_blast');
  kit.formed(0, 1, 0);
  e.crucibleMelt[0] = { item: ingot, count: units };
  e.crucibleMoltenS[0] = 14.2;
  for (const m of moulds) kit.player.inventory.add(m, 1);
  return { kit, e, view: () => kit.sim.furnaceView(0, 1, 0)!.crucibles[0] };
}

describe('castView', () => {
  it('counts the window down and offers every mould in the pack that takes the metal', () => {
    const { kit, view } = molten(4, 'bronze_ingot', ['ingot_mould', 'pickaxe_mould', 'axe_mould']);
    const v = castView(view(), kit.player.inventory.slots);
    expect(v).toMatchObject({ molten: true, show: true, meterText: '15 s', left: 14.2, window: MOLTEN_WINDOW_S });
    expect(v.meterLabel).toBe('Molten Bronze Ingot x4');
    expect(v.choices.map((c) => [c.key, c.sub, c.enabled])).toEqual([
      ['ingot_mould', '4 x Bronze Ingot', true],
      ['pickaxe_mould', '1 x Bronze Pickaxe Head', true],
      ['axe_mould', '1 x Bronze Axe Head', true],
    ]);
    expect(v.choices[0].label).toBe('Pour into Ingot Mould');
    expect(v.hint).toMatch(/^Pour before it cools/);
  });

  it('disables a mould the pool is too small for and says what is missing', () => {
    const { kit, view } = molten(2, 'bronze_ingot', ['pickaxe_mould']);
    const v = castView(view(), kit.player.inventory.slots);
    expect(v.choices[0]).toMatchObject({ enabled: false, sub: 'Needs 3 molten - there is 2' });
  });

  it('says what to do without a mould, and ignores moulds that do not take the metal', () => {
    const { kit, view } = molten(3, 'copper_ingot', ['pickaxe_mould']);
    const v = castView(view(), kit.player.inventory.slots);
    expect(v.choices).toEqual([]);
    expect(v.hint).toMatch(/No fired mould in your pack takes this/);
  });

  it('shows the alloy pot with add buttons and what is in the pack', () => {
    const { kit, e, view } = molten(1);
    e.crucibleMelt[0] = null;
    e.crucibleIn[0] = { item: 'alloy_pot', count: 1 };
    e.crucibleMix[0] = [2, 0];
    kit.player.inventory.add('copper_ingot', 4);
    const v = castView(view(), kit.player.inventory.slots);
    expect(v).toMatchObject({ molten: false, show: true, meterText: '2/3 copper, 0/1 tin' });
    expect(v.choices.map((c) => [c.key, c.enabled, c.sub])).toEqual([
      ['copper_ingot', true, '4 ingots in your pack'],
      ['tin_ingot', false, 'None in your pack'],
    ]);
  });

  it('has nothing to show for a plain or locked crucible, and the button key changes with the choices', () => {
    const { kit, e, view } = molten(1);
    e.crucibleMelt[0] = null;
    expect(castView(view(), kit.player.inventory.slots).show).toBe(false);
    const a = castView({ ...view(), melt: { item: 'copper_ingot', count: 1 }, moltenS: 5 }, kit.player.inventory.slots);
    kit.player.inventory.add('ingot_mould', 1);
    const b = castView({ ...view(), melt: { item: 'copper_ingot', count: 1 }, moltenS: 5 }, kit.player.inventory.slots);
    expect(choicesKey(a.choices)).not.toBe(choicesKey(b.choices));
  });
});
