import { describe, expect, it } from 'vitest';
import { furnaceTier } from '../../../core/registry';
import type { UpgradeView } from '../../../sim';
import { crucibleText, upgradeBlock, upgradeStats, upgradeSub } from './upgradeText';

const none = { formed: false, tier: 0, inner: null };

function up(over: Partial<UpgradeView>): UpgradeView {
  return {
    next: furnaceTier(2), requiredC: 700, tempOk: true, structureOk: true, structure: null, ok: false, reason: null,
    ingredients: [
      { item: 'bronze_ingot', need: 4, have: 4, ok: true },
      { item: 'bellows', need: 1, have: 1, ok: true },
    ],
    ...over,
  };
}

describe('upgrade sheet texts', () => {
  it('gives crucibles from the hearth rule, not a fixed number', () => {
    expect(crucibleText(furnaceTier(1), none)).toBe(String(furnaceTier(1).crucibles));
    expect(crucibleText(furnaceTier(3), none)).toBe('2 - up to 6');
    expect(crucibleText(furnaceTier(4), none)).toBe('6 - up to 8');
    expect(crucibleText(furnaceTier(5), none)).toBe('9');
    expect(crucibleText(furnaceTier(3), { formed: true, tier: 3, inner: [2, 2, 1] })).toBe('5 (this hearth)');
  });

  it('lists the crucibles that work now beside the next tier', () => {
    const rows = upgradeStats({ spec: furnaceTier(2), cruciblesActive: 2, hearth: { formed: true, tier: 2, inner: [1, 1, 1] } as never }, furnaceTier(3));
    expect(rows.find((r) => r.label === 'Crucibles')).toEqual({ label: 'Crucibles', now: '2', next: '2 - up to 6' });
  });

  it('names the hearth first when it is what holds the upgrade back', () => {
    expect(upgradeBlock(up({ structureOk: false }))).toBe('Hearth not built');
    expect(upgradeBlock(up({ structureOk: false, tempOk: false }))).toBe('Hearth not built');
    expect(upgradeBlock(up({ ingredients: [{ item: 'bellows', need: 1, have: 0, ok: false }], tempOk: false }))).toBe('Materials missing');
    expect(upgradeBlock(up({ tempOk: false }))).toBe('Too cold');
    expect(upgradeBlock(up({ ok: true }))).toBe('');
    expect(upgradeSub(up({ structureOk: false }))).toBe('Build the hearth');
    expect(upgradeSub(up({ structureOk: false, ingredients: [{ item: 'bellows', need: 1, have: 0, ok: false }] }))).toBe('0/1 materials');
    expect(upgradeSub(up({ ok: true }))).toBe('Ready: Blast Furnace');
  });
});
