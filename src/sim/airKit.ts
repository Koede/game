/** Test fixture: a Blast furnace with a brick shell and no nozzle, and an air network beside it. Imported by path from tests only. */
import type { FurnaceEntity } from './entities';
import { makeKit } from './testKit';

export function hearthKitAir() {
  const kit = makeKit();
  kit.furnace(0, 1, 0, 'furnace_blast');
  kit.formed(0, 1, 0, { parts: {} });
  return { kit, furnace: () => kit.sim.furnaceAt(0, 1, 0) as FurnaceEntity };
}
