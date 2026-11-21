// End-to-end check of Essentia & Research (docs/api/magic.md) in the built game, desktop and phone portrait:
//
//   node scripts/e2e-magic.mjs                    build to a scratch dir, run both devices
//   node scripts/e2e-magic.mjs --no-build         use the existing build (--dist=<dir>, default dist/)
//   node scripts/e2e-magic.mjs --device=desktop   (desktop, phonePortrait)
//   node scripts/e2e-magic.mjs --shots=<dir>      screenshots (default test-results/e2e-magic)
//
// Scan blocks with the field notebook (real Use) -> open the notebook at the sky -> the vial recipe is refused ->
// solve the "Vessels of Essence" board by tapping cells and aspect chips -> the furnace forges glass vials -> the
// gathering rod fills a vial from the land -> the vial pours into an essentia jar. `window.__hw` only for set-up.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : ['desktop', 'phonePortrait'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-magic'));
const noBuild = argv.includes('--no-build');
const dist = resolve(flag('dist')[0] ?? (noBuild ? join(root, 'dist') : join(tmpdir(), 'hearthwatt-e2e-magic')));

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
if (!noBuild) await build({ quiet: true, outDir: dist });

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (Essentia & Research)`);
  await runDevice(device);
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);

async function runDevice(device) {
  const session = await openGame({ dir: dist, device });
  const { page, errors } = session;
  const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
  const { assert } = report;
  let ok = true;
  const step = async (name, run) => {
    if (!ok) return console.log(`  skip ${name}`);
    const before = report.failures;
    await report.step(name, run);
    if (report.failures !== before) {
      ok = false;
      await d.shot(`FAILED-${name.replace(/\W+/g, '-')}`).catch(() => undefined);
    }
  };
  const magic = (fn, arg) => d.hw(fn, arg);
  let P = null;

  try {
    await step('a new world loads into play', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'hearth-magic');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
    });

    await step('the notebook notes three blocks with real Use and learns their aspects', async () => {
      P = await d.hw(() => {
        const hw = window.__hw;
        hw.clearInventory();
        hw.setTime(0.3);
        hw.setWeather('clear');
        const p = hw.state().player;
        const gy = Math.floor(p.y);
        const x0 = Math.floor(p.x);
        const z0 = Math.floor(p.z) - 3;
        for (let x = x0 - 3; x <= x0 + 4; x++)
          for (let z = z0 - 2; z <= z0 + 5; z++) {
            hw.setVoxel(x, gy - 1, z, 'stone');
            for (let y = gy; y <= gy + 6; y++) hw.setVoxel(x, y, z, 'air');
          }
        hw.setVoxel(x0 - 1, gy, z0, 'copper_ore');
        hw.setVoxel(x0, gy, z0, 'glass');
        hw.setVoxel(x0 + 1, gy, z0, 'workbench');
        hw.setVoxel(x0 + 3, gy, z0, 'furnace_clay');
        hw.teleport(x0 + 0.5, gy, z0 + 3.5);
        hw.give('field_notebook', 1);
        return { gy, x0, z0 };
      });
      await d.selectItem('field_notebook');
      for (const dx of [-1, 0, 1]) {
        assert(await d.approach({ x: P.x0 + dx, y: P.gy, z: P.z0 }), `aims at block ${dx}`);
        await d.use();
        await d.settle(400);
      }
      const r = await magic(() => window.__hw.app.game.magic.research);
      assert(r.scanned.length === 3, `scanned ${JSON.stringify(r.scanned)}`);
      for (const a of ['vein', 'clarity', 'rune']) assert(r.known.includes(a), `knows ${a}: ${r.known}`);
      await d.shot('1-scanned');
    });

    await step('the vial recipe is refused before the research', async () => {
      const res = await d.hw((p) => {
        const hw = window.__hw;
        const sim = hw.app.game.state.sim;
        const f = sim.furnaceAt(p.x0 + 3, p.gy, p.z0);
        f.fuel[0] = { item: 'coal', count: 32 };
        sim.light(p.x0 + 3, p.gy, p.z0);
        hw.tick(1200);
        hw.give('glass', 2);
        return sim.forge(p.x0 + 3, p.gy, p.z0, 'glass_vial', 1);
      }, P);
      assert(!res.ok && /Research/.test(res.reason ?? ''), `refused: ${JSON.stringify(res)}`);
    });

    await step('Use at the sky opens the notebook', async () => {
      await d.hw((p) => window.__hw.lookAt(p.x0 + 0.5, p.gy + 40, p.z0 + 3.6), P);
      await d.settle(300);
      await d.use();
      await page.waitForSelector('.hw-nb', { timeout: 5000 });
      await d.settle(300);
      await d.shot('2-notebook');
    });

    await step('the board is solved by tapping cells and aspect chips', async () => {
      // Lore is set-up: three scans do not always give enough of every aspect the solution wants.
      await d.hw(() => {
        const r = window.__hw.app.game.magic.research;
        for (const a of ['clarity', 'rune', 'craft', 'cinder', 'brook']) r.lore[a] = (r.lore[a] ?? 0) + 4;
        if (!r.known.includes('cinder')) r.known.push('cinder');
      });
      await d.press(page.locator('.hw-nb__entry[data-entry="glassware"]'));
      for (let i = 0; i < 10; i++) {
        const hint = await d.hw(() => window.__hw.app.game.magic.notebook().hint('glassware'));
        if (!hint) break;
        await d.press(page.locator(`.hw-nb__cell[data-cell="${hint.cell}"]`));
        await d.press(page.locator(`.hw-nb__chip[data-aspect="${hint.aspect}"]`));
        await d.settle(150);
        if (await d.hw(() => window.__hw.app.game.magic.research.entries.glassware?.done === true)) break;
      }
      assert(await d.hw(() => window.__hw.app.game.magic.research.entries.glassware?.done === true), 'glassware done');
      const fits = await page.evaluate(() => [...document.querySelectorAll('.hw-nb__cell')].every((el) => el.getBoundingClientRect().right <= innerWidth + 1));
      assert(fits, 'the board fits the screen');
      await d.shot('3-board-solved');
      await page.keyboard.press('Escape');
      await d.settle(300);
    });

    await step('the furnace now forges glass vials', async () => {
      const res = await d.hw((p) => window.__hw.app.game.state.sim.forge(p.x0 + 3, p.gy, p.z0, 'glass_vial', 1), P);
      assert(res.ok, `forged: ${JSON.stringify(res)}`);
      assert(await d.hw(() => window.__hw.state().inventory?.some?.((s) => s?.item === 'glass_vial') ?? window.__hw.app.game.state.player.inventory.count('glass_vial') > 0), 'vials in the pack');
    });

    await step('the gathering rod fills a vial from the land', async () => {
      await d.hw(() => {
        const hw = window.__hw;
        hw.give('vis_rod', 1);
      });
      await d.selectItem('vis_rod');
      for (let i = 0; i < 6; i++) {
        await d.use();
        await d.settle(300);
      }
      const filled = await d.hw(() => window.__hw.app.game.state.player.inventory.toJSON().filter((s) => s && s.item.startsWith('vial_')).map((s) => s.item));
      assert(filled.length > 0, `filled vials ${JSON.stringify(filled)}`);
      P.vial = filled[0];
      await d.shot('4-rod');
    });

    await step('a filled vial pours into an essentia jar', async () => {
      await d.hw((p) => window.__hw.setVoxel(p.x0 + 1, p.gy, p.z0 + 1, 'essentia_jar'), P);
      await d.settle(300);
      await d.selectItem(P.vial);
      assert(await d.approach({ x: P.x0 + 1, y: P.gy, z: P.z0 + 1 }), 'aims at the jar');
      await d.use();
      await d.settle(400);
      const text = await d.hw((p) => window.__hw.app.game.magic.jarText(p.x0 + 1, p.gy, p.z0 + 1), P);
      assert(/\d+\/32/.test(text ?? ''), `jar: ${text}`);
      await d.shot('5-jar');
    });

    await step('a vial of water set on the furnace top boils on its own and comes back boiling', async () => {
      await d.hw(() => window.__hw.give('water_vial', 1));
      await d.selectItem('water_vial');
      const top = { x: P.x0 + 3, y: P.gy + 1, z: P.z0 };
      await d.hw((p) => window.__hw.teleport(p.x + 0.5, p.y - 1, p.z + 2.5), top);
      await d.settle(300);
      await d.centerMouse();
      // lookAt adds half a block: this is the point just above the middle of the furnace's top face.
      await d.hw((p) => window.__hw.lookAt(p.x, p.y - 0.48, p.z + 0.1), top);
      await d.settle(400);
      const aimed = await d.hw(() => window.__hw.state().target);
      assert(aimed && aimed.block === 'furnace_clay', `aims at the furnace: ${JSON.stringify(aimed)}`);
      await d.use();
      await d.settle(300);
      assert((await d.hw((p) => window.__hw.getBlock(p.x, p.y, p.z).block, top)) === 'furnace_vial', 'the vial stands on the furnace');
      await d.hw(() => window.__hw.tick(400));
      await d.settle(500);
      assert((await d.hw((p) => window.__hw.getBlock(p.x, p.y, p.z).block, top)) === 'furnace_vial_boiling', 'the vial boils');
      await d.shot('6-vial-boiling');
      await d.selectEmptyHand();
      await d.use();
      await d.settle(300);
      assert(await d.hw(() => window.__hw.app.game.state.player.inventory.count('boiling_vial') === 1), 'a boiling vial in the pack');
    });

    // ---- the second slice: desk, altar, foci, wellsprings, servants (research done by set-up) ----------------------
    const M = (fn, arg) => d.hw(fn, arg);
    await step('set-up: every research done, a clear yard', async () => {
      await M((p) => {
        const hw = window.__hw;
        const m = hw.app.game.magic;
        for (const e of m.notebook().entries()) m.research.entries[e.key] = { done: true, tokens: {} };
        hw.clearInventory();
        for (let x = p.x0 - 3; x <= p.x0 + 6; x++)
          for (let z = p.z0 + 5; z <= p.z0 + 14; z++) {
            hw.setVoxel(x, p.gy - 1, z, 'stone');
            for (let y = p.gy; y <= p.gy + 4; y++) hw.setVoxel(x, y, z, 'air');
          }
      }, P);
      P.yard = { x: P.x0 + 1, z: P.z0 + 9 };
    });

    await step('the rune desk screen makes a bronze rod from ingredients and carried vials', async () => {
      const desk = { x: P.yard.x, y: P.gy, z: P.yard.z - 3 };
      await M((p) => {
        const hw = window.__hw;
        hw.setVoxel(p.x, p.y, p.z, 'rune_desk');
        for (const [k, n] of [['vis_rod', 1], ['bronze_ingot', 2], ['vial_gale', 1], ['vial_loam', 1], ['vial_rune', 1]]) hw.give(k, n);
      }, desk);
      await d.selectEmptyHand();
      assert(await d.approach(desk), 'aims at the desk');
      await d.use();
      await page.waitForSelector('.hw-nb__recipe[data-recipe="bronze_rod"]', { timeout: 5000 });
      await d.settle(300);
      await d.shot('7-rune-desk');
      await d.press(page.locator('[data-make="bronze_rod"]'));
      await d.settle(300);
      assert(await M(() => window.__hw.app.game.state.player.inventory.count('bronze_rod') === 1), 'a bronze rod in the pack');
      await page.keyboard.press('Escape');
      await d.settle(300);
    });

    await step('an infusion on the altar makes a Scrying Lens from pedestals and jars', async () => {
      const A = { x: P.yard.x, y: P.gy, z: P.yard.z + 1 };
      await M((a) => {
        const hw = window.__hw;
        const m = hw.app.game.magic;
        hw.setVoxel(a.x, a.y, a.z, 'infusion_altar');
        hw.setVoxel(a.x + 2, a.y, a.z, 'arcane_pedestal');
        hw.setVoxel(a.x - 2, a.y, a.z, 'arcane_pedestal');
        [['vein', 0, -2], ['mind', 2, 2], ['clarity', -2, 2]].forEach(([asp, dx, dz]) => {
          hw.setVoxel(a.x + dx, a.y, a.z + dz, 'essentia_jar');
          m.setJar(a.x + dx, a.y, a.z + dz, asp, 16);
        });
        hw.give('glass', 1);
        hw.give('copper_ingot', 2);
      }, A);
      await d.settle(300);
      const useWith = async (item, pos) => {
        if (item) await d.selectItem(item);
        else await d.selectEmptyHand();
        assert(await d.approach(pos), `aims at ${JSON.stringify(pos)}`);
        await d.use();
        await d.settle(350);
      };
      await useWith('glass', A);
      await useWith('copper_ingot', { x: A.x + 2, y: A.y, z: A.z });
      await useWith('copper_ingot', { x: A.x - 2, y: A.y, z: A.z });
      await useWith('bronze_rod', A);
      assert(await M((a) => window.__hw.app.game.magic.infusionAt(a.x, a.y, a.z) !== null, A), 'the infusion started');
      await M(() => window.__hw.tick(60));
      await d.hw((a) => window.__hw.teleport(a.x + 0.5, a.y, a.z + 4.5), A);
      await d.settle(300);
      await d.hw((a) => window.__hw.lookAt(a.x, a.y, a.z), A);
      await d.settle(600);
      await d.shot('8-infusing');
      await M(() => window.__hw.tick(600));
      const text = await M((a) => window.__hw.app.game.magic.altarText(a.x, a.y, a.z), A);
      assert(/Scrying Lens/.test(text ?? ''), `altar says ${text}`);
      await useWith(null, A);
      assert(await M(() => window.__hw.app.game.state.player.inventory.count('vein_lens') === 1), 'the lens in the pack');
    });

    await step('a charged rod and the Light Focus set a floating light', async () => {
      await M(() => {
        const hw = window.__hw;
        hw.give('focus_light', 1);
        hw.app.game.magic.charge = 16;
      });
      await d.selectItem('focus_light');
      const floor = { x: P.yard.x + 3, y: P.gy - 1, z: P.yard.z + 4 };
      assert(await d.approach(floor), 'aims at the floor');
      await d.use();
      await d.settle(300);
      assert((await M((f) => window.__hw.getBlock(f.x, f.y + 1, f.z).block, floor)) === 'magic_light', 'a light stands there');
    });

    await step('a wellspring floats near by and a held rod reads it', async () => {
      const node = await M(() => {
        const hw = window.__hw;
        const p = hw.state().player;
        const n = hw.app.game.magic.nodesAround(p.x, p.z, 4)[0];
        return n ? { x: n.x, y: n.y, z: n.z, aspect: n.aspect } : null;
      });
      assert(node !== null, 'a wellspring within four chunks');
      // Stand on the ground four blocks south of it, in a cleared patch, and look at it.
      await d.hw((n) => {
        const hw = window.__hw;
        const gy = Math.round(n.y - 2.5);
        for (let x = n.x - 2; x <= n.x + 2; x++)
          for (let z = n.z - 1; z <= n.z + 6; z++) for (let y = gy; y <= gy + 6; y++) hw.setVoxel(x, y, z, 'air');
        hw.teleport(n.x + 0.5, gy, n.z + 4.5);
      }, node);
      await d.settle(500);
      await d.hw((n) => window.__hw.lookAt(n.x, n.y - 0.5, n.z), node);
      await d.selectItem('bronze_rod');
      await d.settle(800);
      assert(await M(() => window.__hw.app.game.magicRenderer.stats.nodes > 0), 'the crystal is drawn');
      await d.shot('9-wellspring');
    });

    await step('a clay servant fed Spring turns a hand crank', async () => {
      const S = { x: P.yard.x + 4, y: P.gy, z: P.yard.z };
      await M((s) => {
        const hw = window.__hw;
        hw.teleport(s.x - 2.5, s.y, s.z + 3.5);
        hw.setVoxel(s.x, s.y, s.z, 'clay_servant', 2);
        hw.setVoxel(s.x + 1, s.y, s.z, 'hand_crank');
        hw.setVoxel(s.x, s.y, s.z - 1, 'essentia_jar');
        hw.app.game.magic.setJar(s.x, s.y, s.z - 1, 'spring', 8);
        hw.tick(80);
      }, S);
      await d.settle(300);
      await d.hw((s) => window.__hw.lookAt(s.x, s.y, s.z), S);
      await d.settle(600);
      const said = await M((s) => window.__hw.app.game.magic.servantText(s.x, s.y, s.z), S);
      assert(/cranking/.test(said ?? ''), `servant: ${said}`);
      const crank = await M((s) => window.__hw.app.game.workshop.describe(s.x + 1, s.y, s.z), S);
      assert(/rpm/.test(crank ?? ''), `crank: ${crank}`);
      await d.shot('10-servant');
    });

    await step('no page errors', async () => {
      assert(errors.length === 0, `errors: ${errors.slice(0, 3).join(' | ')}`);
    });
  } finally {
    await session.close();
  }
}
