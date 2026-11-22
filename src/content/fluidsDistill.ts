/**
 * Fluids of the glass distillery (docs/DISTILLERY_PLAN.md 5.4): every grade a mixture can be bottled as, plus slop.
 * Colours are for pipe windows, tanks and the UI and are picked to read apart from every other fluid (techContent
 * test); the glass itself shows the live mixture colour (src/core/chem.ts colourOf). Fuels and residue ride in canisters (1000 L, like a bucket), so tanks, pumps and
 * pipes can fill and drain them; beaker fluids (250 L) are poured by the distillery alone (src/core/distill.ts).
 */
import type { FluidKey, FluidSpec } from '../core/types';

const CAN = 'empty_canister';
const f = (key: FluidKey, name: string, colour: number, canister?: string): FluidSpec => ({
  key, name, colour, hot: false, glow: false, ...(canister ? { bucket: { full: canister, empty: CAN } } : {}),
});

export const DISTILL_FLUIDS: FluidSpec[] = [
  f('sap', 'Pine Sap', 0x90e050),
  f('syrup', 'Pine Syrup', 0x9a4a10),
  f('sugar_wash', 'Sugar Wash', 0xc9a87c),
  f('low_wines', 'Low Wines', 0x8fa8a0),
  f('spirit', 'Spirit', 0x9ad0ff),
  f('fuel_ethanol', 'Fuel Ethanol', 0xd8f0a0),
  f('gasoline', 'Gasoline', 0xffe800, 'gasoline_canister'),
  f('kerosene', 'Kerosene', 0x6fa8e0, 'kerosene_canister'),
  f('diesel', 'Diesel', 0xb88a2e, 'diesel_canister'),
  f('residue', 'Heavy Residue', 0x5a4a40, 'residue_canister'),
  { key: 'slop', name: 'Slop', colour: 0x7a8a50, hot: false, glow: false },
  f('lube_base', 'Lube Base', 0x6020a0, 'lube_base_canister'),
  f('bitumen', 'Bitumen', 0x103060, 'bitumen_canister'),
  f('lubricant', 'Lubricant', 0x20ff80, 'lubricant_canister'),
  f('tincture', 'Tincture', 0xc02080),
  f('clear_tincture', 'Clear Tincture', 0x66ffcc),
];
