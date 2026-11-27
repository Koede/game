# Drill rig

An electric mining rig for the Forge age (`src/sim/drillRig.ts`). It sits on the ground and drills out the 3 by 3
shaft beneath it, one layer at a time, so you can sink a mine and leave it running.

**Build.** `drill_rig` is forged at a tier 3 furnace from 1 chassis, 2 iron plates, 1 copper coil and 2 iron axles.
Bits: 2 iron drill bits from 3 iron ingots and 1 flint; a steel drill bit from 2 steel ingots and 1 iron ingot.

**Run it.**
- Power: 1.5 kW from the grid (a burner generator is enough). Below 25% supply it stalls, like every machine.
- A drill bit in its bit slot (slot 0). Only drill bits go there, by hand or by item pipe.
- Room in its 9-slot buffer. Finds go to a crate touching it once a second, or out through an item pipe (pipe ends
  start pulling).

**Bits.** A bit cuts what a pickaxe of its metal can: iron (tier 3) or steel (tier 4). Each block cut takes one use
off the bit (iron 64, steel 200, the item's `wear`). Steel cuts 1.5 times as fast. A blunt bit is used up; the rig
then takes a fresh one from a touching crate, so a crate of spares keeps it going.

**Where it stops.** Within a layer, cells it cannot cut (liquid, too hard for the bit, a machine) are left
standing. It stops for good when the centre column reaches one of those, corestone, or the bottom of the world.
The status line says which.

**Upkeep.** It wears like the other machines with moving parts (`src/sim/wear.ts`): repair it with iron ingots, or
give it to a resident with the Upkeep job. Its face shows starved (no power or no bit), full and worn.

**Screen.** The machine screen shows the bit slot and its sharpness, the depth it is working, the current block and
the buffer. Phone check: `node scripts/e2e-drill.mjs`.
