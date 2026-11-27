/**
 * Inventory views over the plain slot arrays of block entities, with the accept rules of each machine, so the UI
 * can use the same transfer logic as for the player's inventory. One stable object per entity and group.
 */
import { fuelOf, machine } from '../core/registry';
import { Inventory } from '../game/inventory';
import type { FurnaceEntity, MachineEntity, SimEntity } from './entities';
import { ALLOY_POT } from './casting';
import { crucibleRecipe } from './furnace';
import type { FurnaceStats } from './hearthStats';
import { fuelEnergyJ, isProcessor, machineRecipeFor } from './machines';
import { BIT_SLOT, isDrillBit } from './drillRig';

export interface FurnaceSlots {
  /** Firebox: accepts only fuels. */
  fuel: Inventory;
  /** Crucible inputs: accept only items smeltable at the furnace's effective tier, in working crucibles. */
  crucibleIn: Inventory;
  /** Crucible outputs: take-only. */
  crucibleOut: Inventory;
}

export class SlotAccess {
  private readonly furnaces = new WeakMap<FurnaceEntity, FurnaceSlots>();
  private readonly machines = new WeakMap<MachineEntity, Inventory>();

  /** `stats` gives the numbers a furnace runs at (its effective tier and working crucibles). */
  constructor(private readonly stats: (e: FurnaceEntity) => FurnaceStats) {}

  furnace(e: FurnaceEntity): FurnaceSlots {
    let s = this.furnaces.get(e);
    if (!s) {
      s = {
        fuel: Inventory.over(e.fuel, { accept: (item) => fuelOf(item) !== null }),
        // Only working crucibles take items (locked ones beyond the hearth's count just give theirs back).
        crucibleIn: Inventory.over(e.crucibleIn, {
          accept: (item, slot) => {
            const fs = this.stats(e);
            return slot < fs.crucibles && (item === ALLOY_POT || crucibleRecipe(item, fs) !== null);
          },
        }),
        crucibleOut: Inventory.over(e.crucibleOut, { takeOnly: true }),
      };
      this.furnaces.set(e, s);
    }
    return s;
  }

  /**
   * A machine's slots. Crates accept anything; fuel generators only their fuels; processors only their recipe
   * inputs in slot 0 (slot 1 is the output); the bore rig's buffer is take-only; the drill rig takes only drill bits, in slot 0.
   */
  machine(e: MachineEntity): Inventory {
    let inv = this.machines.get(e);
    if (!inv) {
      const spec = machine(e.kind);
      if (e.kind === 'crate') inv = Inventory.over(e.slots);
      else if (spec.fuels && spec.fuels.length > 0) inv = Inventory.over(e.slots, { accept: (item) => fuelEnergyJ(spec, item) > 0 });
      else if (e.kind === 'drill_rig') inv = Inventory.over(e.slots, { accept: (item, slot) => slot === BIT_SLOT && isDrillBit(item) });
      else if (isProcessor(e.kind)) inv = Inventory.over(e.slots, { accept: (item, slot) => slot === 0 && machineRecipeFor(e.kind, item) !== null });
      else inv = Inventory.over(e.slots, { takeOnly: true });
      this.machines.set(e, inv);
    }
    return inv;
  }

  /** Notifies the listeners of whichever views exist for this entity (the simulation wrote its slots directly). */
  touch(e: SimEntity): void {
    if (e.kind === 'furnace') {
      const s = this.furnaces.get(e as FurnaceEntity);
      if (s) {
        s.fuel.notifyChanged();
        s.crucibleIn.notifyChanged();
        s.crucibleOut.notifyChanged();
      }
    } else {
      this.machines.get(e as MachineEntity)?.notifyChanged();
    }
  }
}
