// End-to-end check of the built game in headless Chromium, on desktop and on both phone orientations.
//
//   node scripts/e2e.mjs                       build, then run every device
//   node scripts/e2e.mjs --no-build            use the existing dist/
//   node scripts/e2e.mjs --device=phonePortrait [--device=...]   (desktop, phonePortrait, phoneLandscape, sandbox)
//   node scripts/e2e.mjs --shots=<dir>         screenshots (default test-results/e2e)
//
// Every step drives the game through real input (keys, mouse, touch, the real UI). window.__hw is only used to
// set up states quickly (give items, teleport, aim, run ticks) and to read state back - never to perform the
// thing a step is testing. Exit code 1 when any step fails.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor, VIEWPORTS } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';
import { furnaceSteps } from './lib/e2eFurnace.mjs';
import { sandboxChecks } from './lib/e2eSandbox.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : [...Object.keys(VIEWPORTS), 'sandbox'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e'));
const dist = e2eDist(root, argv);
const SEED = 'hearth-e2e';

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
await ensureBuilt(argv, dist);

const report = createReporter();
for (const device of devices) {
  if (device === 'sandbox') {
    await sandboxChecks({ report, dir: dist, shotDir: shots });
    continue;
  }
  console.log(`\n${device}`);
  await runDevice(device);
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);

async function runDevice(device) {
  const session = await openGame({ dir: dist, device });
  const { page, errors } = session;
  const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
  const { assert } = report;
  const hw = (fn, arg) => page.evaluate(fn, arg);
  let ok = true;
  const step = async (name, run) => {
    if (!ok) return console.log(`  skip ${name}`);
    const before = report.failures;
    await report.step(name, run);
    if (report.failures !== before) {
      ok = false;
      const trail = await page.evaluate(() => (window.__e2eLog ?? []).slice(-25)).catch(() => []);
      if (trail.length) console.log(`       recent events: ${trail.join(' | ')}`);
      await d.shot(`FAILED-${name.replace(/\W+/g, '-')}`).catch(() => undefined);
    }
  };

  try {
    await step('title screen appears without errors', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.waitForTimeout(600);
      await d.shot('01-title');
      assert(errors.length === 0, `console errors: ${errors.join(' | ')}`);
    });

    await step('New World (typed seed) loads into play', async () => {
      await page.fill('.hw-title input', SEED);
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'loading' || window.__hw.state().phase === 'playing', 'loading screen', { timeout: 10_000 });
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      // A trail of UI events, printed when a step fails.
      await page.evaluate(() => {
        const log = (window.__e2eLog = []);
        const bus = window.__hw.app.game.bus;
        const t0 = performance.now();
        for (const type of ['ui:open', 'ui:opened', 'ui:close', 'ui:closed', 'game:paused', 'player:death', 'block:placed']) {
          bus.on(type, (e) => log.push(`${((performance.now() - t0) / 1000).toFixed(2)} ${type} ${JSON.stringify(e)}`));
        }
        window.addEventListener('popstate', () => log.push(`${((performance.now() - t0) / 1000).toFixed(2)} popstate`));
      });
      await d.settle(1500);
    });

    await step('chunks render', async () => {
      const s = await hw(() => window.__hw.state());
      assert(s.render.chunks >= 20, `only ${s.render.chunks} chunk meshes`);
      assert(s.render.triangles > 10_000, `only ${s.render.triangles} triangles drawn`);
      const frame = await hw(() => window.__hw.sampleFrame());
      assert(frame.distinctColors > 40, `the frame looks flat (${frame.distinctColors} colours)`);
      assert(frame.brightness > 25, `the frame is too dark (${frame.brightness})`);
      await d.shot('02-world');
    });

    await step(d.touch ? 'touch joystick walks' : 'W key walks', async () => {
      const a = (await hw(() => window.__hw.state())).player;
      await d.walk(1.4);
      const b = (await hw(() => window.__hw.state())).player;
      const moved = Math.hypot(b.x - a.x, b.z - a.z);
      assert(moved > 1.5, `moved only ${moved.toFixed(2)} blocks`);
    });

    await step('mines four logs by holding Mine', async () => {
      const mined = await d.mineLogs(4);
      assert(mined >= 4, `mined ${mined} logs`);
      const inv = await d.inventory();
      const logs = (inv.oak_log ?? 0) + (inv.pine_log ?? 0);
      assert(logs >= 4, `the pack holds ${logs} logs`);
      await d.shot('03-mined');
    });

    // Ember age: planks are split at a Chopping Block (hand recipe from a log; Use loads the logs, three bare-handed
    // strokes split one, one more Use takes the planks), no longer made straight from the inventory screen.
    await step('crafts a chopping block, places it and splits logs into planks', async () => {
      await d.openInventory();
      await d.shot('04-inventory');
      await d.make('chopping_block');
      await d.closeScreen();
      const spot = await d.placeHeld('chopping_block');
      assert(spot, 'the chopping block was not placed');
      d.places.chopping_block = spot;
      await d.selectItem('oak_log');
      assert(await d.approach(spot), 'cannot aim at the chopping block');
      await d.use(); // loads the logs in hand onto the block
      await d.selectEmptyHand();
      const taps = await d.workStation(spot, async () => ((await d.inventory()).plank ?? 0) >= 8);
      const inv = await d.inventory();
      assert((inv.plank ?? 0) >= 8, `only ${inv.plank ?? 0} planks after ${taps} taps`);
      await d.shot('04b-chopped');
    });

    await step('crafts a workbench in the inventory screen', async () => {
      await d.openInventory();
      let inv = await d.inventory();
      await d.make('workbench');
      inv = await d.inventory();
      assert(inv.workbench === 1, 'no workbench in the pack');
      await d.closeScreen();
    });

    await step('places the workbench', async () => {
      const spot = await d.placeHeld('workbench');
      assert(spot, 'the workbench was not placed');
      d.places.workbench = spot;
    });

    await step('crafts sticks, cord and a flint pickaxe by hand', async () => {
      await hw(() => {
        window.__hw.give('flint', 3);
        window.__hw.give('fiber', 3);
      });
      await waitFor(page, () => window.__hw.state().objective.completed.includes('find_flint'), 'the flint goal', { timeout: 10_000 });
      // Sticks are split from a plank at the Chopping Block now (two strokes make four), not made in the inventory.
      const block = d.places.chopping_block;
      await d.emptyStation(block); // the logs of the last job may still be loaded
      await d.selectItem('plank');
      assert(await d.approach(block), 'cannot aim at the chopping block');
      await d.use(); // loads the planks in hand
      await d.selectEmptyHand();
      await d.workStation(block, async () => ((await d.inventory()).stick ?? 0) >= 2, 12);
      await d.openInventory();
      await d.make('cord');
      await d.make('flint_pickaxe');
      assert((await d.inventory()).flint_pickaxe === 1, 'no flint pickaxe in the pack');
      await d.closeScreen();
    });

    await step('builds a clay furnace at the workbench and places it', async () => {
      await hw(() => {
        window.__hw.give('rubble', 12);
        window.__hw.give('clay', 6);
      });
      // 'Have 12 rubble' and 'have 6 clay' are goals of their own: let the tracker see them before the bench uses them.
      await waitFor(page, () => window.__hw.state().objective.completed.includes('collect_clay'), 'the rubble and clay goals', { timeout: 10_000 });
      await d.useBlock(d.places.workbench);
      await page.waitForSelector('.hw-window .hw-recipe[data-id="furnace_clay"]', { timeout: 10_000 });
      await d.shot('05-workbench');
      await d.make('furnace_clay');
      assert((await d.inventory()).furnace_clay === 1, 'no clay furnace in the pack');
      await d.closeScreen();
      const spot = await d.placeHeld('furnace_clay', d.places.workbench);
      assert(spot, 'the furnace was not placed');
      d.places.furnace = spot;
      const s = await hw(() => window.__hw.state());
      assert(s.furnaces.length === 1, 'the simulation has no furnace entity');
      assert(s.player.home && s.player.home.x === spot.x && s.player.home.z === spot.z, 'the new furnace did not become home');
    });

    await furnaceSteps({ d, step, assert, hw, page });

    await step('death screen, Respawn wakes the player at the home furnace', async () => {
      const home = d.places.furnace;
      await hw(() => window.__hw.teleport(window.__hw.state().player.x + 6, window.__hw.state().player.y + 0.01, window.__hw.state().player.z));
      await hw(() => window.__hw.damage(40, 'cold'));
      const respawn = page.locator('.hw-window button', { hasText: 'Respawn' });
      await respawn.waitFor({ state: 'visible', timeout: 10_000 });
      await d.settle(300);
      await d.shot('08c-death');
      await d.press(respawn);
      await waitFor(page, () => !window.__hw.state().player.dead && !window.__hw.state().ui.uiOpen, 'respawn', { timeout: 10_000 });
      const p = (await hw(() => window.__hw.state())).player;
      assert(Math.hypot(p.x - (home.x + 0.5), p.z - (home.z + 0.5)) < 3.5, `woke at ${p.x}, ${p.z}, not beside the furnace at ${home.x}, ${home.z}`);
      assert(p.health === 20, `woke with ${p.health} health beside a hot furnace`);
    });

    await step('objectives advanced', async () => {
      const s = await hw(() => window.__hw.state());
      const ids = ['gather_logs', 'make_planks', 'place_workbench', 'find_flint', 'make_pickaxe', 'collect_rubble', 'collect_clay', 'place_furnace', 'light_furnace'];
      for (const id of ids) {
        assert(s.objective.completed.includes(id), `objective ${id} not completed (completed: ${s.objective.completed.join(', ')})`);
      }
      const goal = await page.locator('.hw-goal__title').first().textContent();
      assert(goal && /charcoal/i.test(goal), `the goal tracker does not show the next goal: ${goal}`);
      await d.shot('09-goals');
    });

    let before = null;
    await step('save and quit through the pause menu', async () => {
      await d.pause();
      await page.waitForSelector('.hw-window button:has-text("Save and quit to title")', { timeout: 10_000 });
      await d.shot('10-pause');
      before = await hw(() => window.__hw.state());
      await d.press(page.locator('.hw-window button', { hasText: 'Save and quit to title' }));
      await page.waitForSelector('.hw-title button:has-text("Continue")', { timeout: 10_000 });
      const after = await hw(() => window.__hw.state());
      assert(after.phase === 'title' && after.hasSave, 'not back on the title with a save');
      assert(after.lastSave && after.lastSave.ok, `the save did not reach storage: ${JSON.stringify(after.lastSave)}`);
    });

    await step('reload -> Continue restores position, inventory and furnace', async () => {
      await page.reload();
      await page.waitForSelector('.hw-title button:has-text("Continue")', { timeout: 30_000 });
      await d.shot('11-title-continue');
      await d.press(page.locator('.hw-title button', { hasText: 'Continue' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play after Continue', { timeout: 120_000 });
      const now = await hw(() => window.__hw.state());
      const p0 = before.player;
      const p1 = now.player;
      assert(Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z) < 0.05, `position ${JSON.stringify(p1)} != ${JSON.stringify(p0)}`);
      assert(Math.abs(p1.yaw - p0.yaw) < 1e-3 && Math.abs(p1.pitch - p0.pitch) < 1e-3, `view direction not restored: ${p1.yaw},${p1.pitch} vs ${p0.yaw},${p0.pitch}`);
      assert(JSON.stringify(now.inventory) === JSON.stringify(before.inventory), 'inventory differs after Continue');
      assert(now.furnaces.length === 1, 'furnace entity missing after Continue');
      const f0 = before.furnaces[0];
      const f1 = now.furnaces[0];
      for (const key of ['x', 'y', 'z', 'tier', 'lit']) assert(f1[key] === f0[key], `furnace ${key}: ${f1[key]} != ${f0[key]}`);
      assert(JSON.stringify(f1.crucibleOut) === JSON.stringify(f0.crucibleOut), 'crucible output differs');
      assert(Math.abs(f1.tempC - f0.tempC) < 25, `furnace temperature ${f1.tempC} vs ${f0.tempC}`);
      assert(JSON.stringify(now.objective.completed) === JSON.stringify(before.objective.completed), 'objectives differ');
      assert(Math.abs(now.time.timeOfDay - before.time.timeOfDay) < 0.002, 'clock differs');
      await d.settle(800);
      await d.shot('12-continued');
    });

    await step('no console errors during the run', async () => {
      assert(errors.length === 0, `console errors: ${errors.slice(0, 5).join(' | ')}`);
    });
  } finally {
    await session.close();
  }
}
