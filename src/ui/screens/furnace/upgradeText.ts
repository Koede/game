/** DOM-free texts of the upgrade sheet: the now/next table, the hold button's refusal and the header button's line. */
import { hearthCrucibles } from '../../../core/hearth';
import type { FurnaceTierSpec } from '../../../core/types';
import type { FurnaceView, HearthBrief, UpgradeView } from '../../../sim';
import { formatWatts } from '../../kit/format';
import { upgradeProgress } from './furnaceText';

/**
 * Crucibles a tier gives. A tier with a hearth gets them from the hearth's inside (src/core/hearth.ts), so the sheet
 * says what this hearth gives when one of that tier stands, else the range the smallest to the largest one gives.
 */
export function crucibleText(spec: FurnaceTierSpec, hearth: Pick<HearthBrief, 'formed' | 'tier' | 'inner'>): string {
  const s = spec.structure;
  if (!s) return String(spec.crucibles);
  if (hearth.formed && hearth.tier === spec.tier && hearth.inner) return `${hearthCrucibles(s, hearth.inner)} (this hearth)`;
  const lo = hearthCrucibles(s, s.minInner);
  const hi = hearthCrucibles(s, s.maxInner);
  return lo === hi ? String(lo) : `${lo} - up to ${hi}`;
}

/** The now / next rows. "Now" counts the crucibles that work today. */
export function upgradeStats(view: Pick<FurnaceView, 'spec' | 'cruciblesActive' | 'hearth'>, next: FurnaceTierSpec): { label: string; now: string; next: string }[] {
  const row = (label: string, f: (t: FurnaceTierSpec) => string): { label: string; now: string; next: string } => ({ label, now: f(view.spec), next: f(next) });
  return [
    row('Max temperature', (t) => `${t.maxTempC} °C`),
    { label: 'Crucibles', now: String(view.cruciblesActive), next: crucibleText(next, view.hearth) },
    row('Fuel slots', (t) => String(t.fuelSlots)),
    row('Smelting speed', (t) => `×${t.speed}`),
    row('Electric heat', (t) => (t.electricHeatW > 0 ? formatWatts(t.electricHeatW) : '-')),
    row('Warmth radius', (t) => `${t.warmth} blocks`),
  ];
}

/** Why the hold button refuses, in the order the player has to fix things: the hearth, the materials, the heat. */
export function upgradeBlock(up: Pick<UpgradeView, 'ok' | 'structureOk' | 'ingredients' | 'tempOk'>): string {
  if (up.ok) return '';
  if (up.structureOk === false) return 'Hearth not built';
  if (up.ingredients.some((s) => !s.ok)) return 'Materials missing';
  return up.tempOk ? 'Not ready' : 'Too cold';
}

/** The header button's second line: "Ready: Blast Furnace", "Build the hearth" (materials complete) or "3/5 materials". */
export function upgradeSub(up: UpgradeView): string {
  if (up.ok) return `Ready: ${up.next.name}`;
  const { have, need } = upgradeProgress(up);
  if (up.structureOk === false && have >= need) return 'Build the hearth';
  return `${have}/${need} materials`;
}
