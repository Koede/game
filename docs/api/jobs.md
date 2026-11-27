# Settlement jobs (src/npcs/jobs.ts, src/ui/screens/jobs)

A resident who lives here can be given work: they carry items between two blocks you pick, all day, while you do something else.
This is how the settlement feeds your machines. Old saves load unchanged (`jobs` is an optional field of the npcs snapshot).

## What a job is
- `haul`: take a kind of item from a pickup (a crate, depot or vault) and set it down at a drop-off. Gruk hauling ore is this.
- `feed` ("Run a station"): the same walk, but the drop-off is a machine (furnace, hearth, quern...), so the person keeps it
  supplied. It only lifts what the machine will accept (`Workshop.canOffer` asks without moving anything), so nothing is wasted.
- `tend` ("Tend machines"): needs one stop, the workshop to look after. Every few seconds the person asks `port.worn` for machines
  within `TEND_RADIUS` (24) blocks, walks to the worst, and `port.tend` takes wear off for free (the calls from
  `docs/api/machine-wear.md`: `sim.wornMachines`, `sim.tendMachine`). The host looks for those on the simulation, so the job
  works whether or not the wear work is merged: without it the status says "No machine wear in this game".
- Filter: `ore` (`*_ore`, `crushed_*`), `fuel` (anything with a burn value) or `any`.
- Both stops are set, at most `JOB_SPAN` (48) blocks apart and different. A stop that is not loaded waits.

## Who and when
- `NpcManager.canWork(id)`: lives here (`isPresent`), is a person (not a prop, not the visiting trader), and the world has a workshop.
- Gruk carries 16 a trip and walks a little faster; the rest carry 8 (Orrin 6). `aptitudeOf`, `APTITUDES`.
- They work by day only and rest at night. Hired Gruk (the companion) is busy.
- A trip: load (0.8 s), walk the straight line at 1.6 blocks a second, unload, walk back. `NpcManager.views()` puts the person on
  that line, so you see them going. If the drop-off filled up on the way, the rest goes back to the pickup (or onto the ground there).
- Changing or clearing a job puts what the worker carried back at the pickup.

## The player's side (phone first)
1. Talk to a resident. The dialogue box has a **Give work** button (`npc:say` carries `work: true`).
2. The Jobs screen (`{ type: 'jobs', person }`) has Off / Haul / Run a station, Ore / Fuel / Anything, and **Collect from** and
   **Deliver to** buttons. Tapping a stop button closes the screen; aim at the block and Use. The block is set, a toast says so
   and the screen opens again. Use on air drops the pick.
3. The screen shows the status in words ("Waiting for ore at the pickup", "The machine is full or does not take it", "Resting for
   the night") and how much was carried.

## Code
- `JobBoard` (pure): `assign`, `setStop`, `setFilter`, `clear`, `get`, `all`, `tick(dt, port)`, `pose(id)`, `toJSON`, `load`.
  `JobsPort` is the narrow world interface (`peek`, `take`, `canOffer`, `offer`, `loaded`, `spill`, `working`, `busy`, `pace`).
- `NpcHost.jobs` (host.ts) wires the port to the Workshop's `peek` / `take` / `offer` / `canOffer`, the same calls clay servants use.
- `NpcManager`: `canWork`, `workers`, `setJob`, `startPick`, `jobPick`, `pickingStop`, `stopBlock`, `jobs`. The game's `beforeUse`
  hands a Use to `jobPick` while a stop is being picked.
- Debug: `window.__hw.jobs()` and `window.__hw.setJob(id, kind, from, to, filter)`.

## Tests
`npx vitest run src/npcs/jobs.test.ts src/npcs/jobsManager.test.ts`; `node scripts/e2e-jobs.mjs --out=<build> --device=phonePortrait`
(real taps: talk, Give work, Haul, Ore, pick both stops by aiming, a day passes, 30 ore arrive).

## Open
- Newcomers arrive now (`NpcManager` calls `moveIn`); in a brand-new world Gruk is the one who can be put to work in a
  new world; the others can once they live here. Contentment (`pace`) is not applied yet; the port has the hook.
- The walk is a straight line for show; a person does not path round walls.
