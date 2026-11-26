# Machine status looks

A machine shows its state on its own face, not in an icon. Six looks: running (the voxel active flag and the block's `*_on` texture), idle (the plain off face), and four stopped states stored in voxel bits 13-15: `starved` (no fuel, power, water), `full` (output has no room), `worn`, `broken`.

**Adding a machine**
1. Give the block `textures: { ..., front, frontActive, status: true }` (the `machine()` and `furnace()` factories already do).
2. In its behaviour, pass the status with the active flag: `ctx.setActive(node, running, MachineStatus.Starved)`. The status only shows while stopped, and it is applied once it has held for a second so a flickering brown-out does not remesh a chunk.
3. Nothing to paint: `<base>_stat_<key>` textures are derived from the off texture (`src/render/textures/status.ts`) for the faces that change when the block runs (else the front).

**Budget.** Derived textures are not counted against `SPEC.maxTextures` (they come from the faces they derive from). Cost is 4 layers per opted-in face, 1 KB each. A block with no `status` ignores bits 13-15 (doors, water level), so other users of the variant bits are unaffected.

**Wear and batteries.** `MachineStatus.Worn` and `Broken` are set the same way by the wear system. A charge-lit face can be a normal `frontActive`-style pair or a new derived key added to `STATUS_KEYS` and `paintStatus`.
