// Capture a pre-Bronze save from the CURRENT release build (docs/BRONZE_PLAN.md W0 step 3).
//
// The fixture is the game's own localStorage envelope, not a handwritten document, so a later
// change to the save shape shows up as a real diff. It is not part of `npm run e2e`.
//
// Rerun from the repo root, against a build of the tree you want to record:
//
//   npm run build
//   node scripts/make-save-fixture.mjs
//
// Writes tests/fixtures/save-v-before-bronze.json (pretty-printed `hearthwatt.save`).
// Optional: --dist=<dir> serves a build other than dist/.
//
// What it records (fixed, so a rerun of the same build matches):
//   seed text "bronze-w0" (survival: the world has no `mode` field)
//   render distance 2, so only the chunks around the spawn are loaded (a wider view
//     fills the save with ruin-crate edits and pending water; the file is not trimmed)
//   a Blast Furnace (tier 2) facing south, with the smallest brick Blast hearth and an
//     item hatch, placed through window.__hw (give, then setVoxel) and ticked until formed
//   three stacks left in the pack: 15 brick, 1 furnace_blast, 1 item_hatch
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist } from './lib/e2eArgs.mjs';
import { openGame, waitFor } from './lib/browser.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const dist = e2eDist(root, argv);
const out = join(root, 'tests/fixtures/save-v-before-bronze.json');

/** Typed on the title screen. Numeric seed is whatever this build's seedFrom makes of it. */
const SEED = 'bronze-w0';
/** Settings minimum. Keeps the envelope to the hearth instead of every chunk in view. */
const RENDER_DISTANCE = 2;
const MAX_BYTES = 2 * 1024 * 1024;

const session = await openGame({ dir: dist, device: 'desktop' });
const { page, errors } = session;
try {
  await waitFor(page, () => window.__hw?.state().phase === 'title', 'the title screen', { timeout: 120_000 });
  if (errors.length) throw new Error(`console errors before play: ${errors.join(' | ')}`);

  await page.evaluate(({ seed, renderDistance }) => {
    const app = window.__hw.app;
    app.changeSettings({ ...app.settings, renderDistance }, 'renderDistance');
    window.__hw.newWorld(seed, 'survival');
  }, { seed: SEED, renderDistance: RENDER_DISTANCE });

  await waitFor(page, () => window.__hw.state().phase === 'playing', 'the world to load', { timeout: 180_000 });
  if (errors.length) throw new Error(`console errors while loading: ${errors.join(' | ')}`);

  const built = await page.evaluate(async () => {
    const hw = window.__hw;
    const player = hw.state().player;
    const fx = Math.floor(player.x) + 2;
    const fz = Math.floor(player.z);
    hw.teleport(fx + 0.5, player.y, fz + 0.5);
    const y0 = hw.surfaceY(fx, fz);
    if (y0 < 1) throw new Error(`no ground at ${fx},${fz}`);
    const furnace = { x: fx, y: y0 + 2, z: fz };
    // Same shell as scripts/lib/e2eTech.mjs: 3x3 brick floor, south-facing furnace in the
    // south wall, brick ring, item hatch closing the east side, one empty cell inside.
    const floor = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -2; dz <= 0; dz++) floor.push({ x: fx + dx, y: y0 + 1, z: fz + dz });
    const ring = [[-1, -2], [0, -2], [1, -2], [-1, -1], [-1, 0], [1, 0]].map(([dx, dz]) => ({ x: fx + dx, y: y0 + 2, z: fz + dz }));
    const hatch = { x: fx + 1, y: y0 + 2, z: fz - 1 };

    for (let x = fx - 2; x <= fx + 2; x++) {
      for (let y = y0 + 1; y <= y0 + 4; y++) {
        for (let z = fz - 3; z <= fz + 1; z++) {
          if (!hw.setVoxel(x, y, z, 'air')) throw new Error(`chunk not loaded at ${x},${y},${z}`);
        }
      }
    }
    for (const c of floor) if (!hw.setVoxel(c.x, c.y, c.z, 'brick')) throw new Error(`floor ${c.x},${c.y},${c.z}`);
    // Facing.South = 2: the hearth's inside lies north of the furnace.
    if (!hw.setVoxel(furnace.x, furnace.y, furnace.z, 'furnace_blast', 2)) throw new Error('furnace');
    for (const c of ring) if (!hw.setVoxel(c.x, c.y, c.z, 'brick')) throw new Error(`wall ${c.x},${c.y},${c.z}`);
    if (!hw.setVoxel(hatch.x, hatch.y, hatch.z, 'item_hatch')) throw new Error('hatch');

    const view = () => hw.app.game.state.sim.furnaceView(furnace.x, furnace.y, furnace.z);
    let formed = null;
    for (let i = 0; i < 8 && !formed; i++) {
      hw.tick(20);
      const v = view();
      if (v?.hearth.formed) formed = v;
    }
    if (!formed) {
      const v = view();
      throw new Error(`Blast hearth did not form: ${v ? `${v.hearth.text} (${v.hearth.problem ?? 'no problem'})` : 'no furnace'}`);
    }
    const entity = hw.app.game.state.sim.furnaceAt(furnace.x, furnace.y, furnace.z);

    hw.clearInventory();
    hw.give('brick', 15);
    hw.give('furnace_blast', 1);
    hw.give('item_hatch', 1);
    // On the north wall, so the feet rest on a block we placed and a later frame cannot drop them
    // before the save in this same turn.
    const stand = { x: fx + 0.5, y: y0 + 3, z: fz - 1.5 };
    hw.teleport(stand.x, stand.y, stand.z);
    hw.look(0, 0);
    const saved = hw.save();
    const raw = localStorage.getItem('hearthwatt.save');
    const objectives = hw.app.game.state.objectives;
    const state = hw.state();
    return {
      saved,
      raw,
      stand,
      furnace: { x: furnace.x, y: furnace.y, z: furnace.z, tier: entity.tier, effTier: entity.effTier, hearth: entity.hearth },
      inside,
      seed: state.seed,
      objectiveId: objectives.current?.id ?? null,
      age: objectives.age,
      inventory: state.inventory.filter((s) => s).length,
      edits: hw.app.game.state.world.stats().edits,
    };
  });

  if (!built.saved || !built.raw) throw new Error('save did not reach localStorage');
  if (built.furnace.tier !== 2 || !built.furnace.hearth || built.furnace.hearth.tier !== 2) {
    throw new Error(`expected a tier-2 furnace in a tier-2 hearth, got ${JSON.stringify(built.furnace)}`);
  }
  const envelope = JSON.parse(built.raw);
  const pretty = `${JSON.stringify(envelope, null, 2)}\n`;
  if (Buffer.byteLength(pretty) > MAX_BYTES) {
    throw new Error(`fixture is ${pretty.length} bytes, over ${MAX_BYTES}. Pick another seed or a tighter spot; do not trim the file.`);
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, pretty);
  console.log(`wrote ${out} (${Buffer.byteLength(pretty)} bytes, ${built.edits} edits)`);
  console.log(JSON.stringify({
    seed: built.seed,
    seedText: SEED,
    objectiveId: built.objectiveId,
    age: built.age,
    inventory: built.inventory,
    stand: built.stand,
    furnace: built.furnace,
  }, null, 2));
} finally {
  await session.close();
}
