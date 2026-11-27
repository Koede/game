import { describe, expect, it } from 'vitest';
import { machine } from '../core/registry';

describe('burner generator fuels', () => {
  it('takes every distilled fuel that burns; slop is for re-distilling', () => {
    const fuels = machine('burner_generator').fuels ?? [];
    for (const k of ['fuel_ethanol_beaker', 'gasoline_canister', 'kerosene_canister', 'diesel_canister']) expect(fuels, k).toContain(k);
    expect(fuels).not.toContain('slop_canister');
  });
});
