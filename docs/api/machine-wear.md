# Machine wear and repair

Machines that work wear out (`src/sim/wear.ts`). Wear is `MachineEntity.wear`, 0 as new to 1 worn out; `kept` marks a machine that was repaired.

- **Wears:** crusher, still, centrifuge, electrolyzer, bore rig, blower, burner generator, combustion engine, steam engine, wind turbine, water wheel. Lamps, batteries, crates, tanks, pipes and the rest do not.
- **When:** only while the machine runs (its voxel active bit), `1 / WEAR_FULL_RUN_S` (3000 s) per second.
- **Condition and speed:** `kept` (repaired, wear < 0.2) x1.15, `good` x1, `worn` (>= 0.5) x0.85, `failing` (>= 0.8) x0.6, `broken` (1) stops: no power made or drawn, "A Crusher broke down" toast once. Processors and the bore rig scale their progress; generators scale `availW`.
- **Repair:** `sim.repairMachine(x, y, z)` takes `ceil(wear * 3)` iron ingots from the pack or crates near the machine (`REPAIR_ITEM`), sets wear 0 and `kept`. The machine screen shows a Condition meter and a Repair button.
- **Old saves:** no `wear` field reads as 0, so every machine starts in good condition (not "kept", so speeds do not change). `sanitizeEntity` only resets a bad value.
- **View:** `MachineView.wear / condition / repairCost` (`wear` is null for machines that do not wear).

## NPC upkeep (stub for the settlement-jobs work)

- `sim.wornMachines(minWear = 0.25, near?)` lists machines an NPC could tend, worst first.
- `sim.tendMachine(x, y, z)` takes `NPC_TEND_WEAR` (0.25) off for free, returns the wear removed, and marks the machine `kept` once it is below `KEPT_BELOW`.

The job system decides who walks where and when; nothing in the sim calls these yet.
