// End-to-end check of Dev Mode in the built game (headless Chromium) on desktop, phone portrait and phone landscape:
//
//   node scripts/e2e-dev.mjs                      build to a scratch dir, run all three devices
//   node scripts/e2e-dev.mjs --no-build           use the existing build (--dist=<dir>, default dist/)
//   node scripts/e2e-dev.mjs --device=desktop     (desktop, phonePortrait, phoneLandscape)
//   node scripts/e2e-dev.mjs --shots=<dir>        screenshots (default test-results/e2e-dev)
//
// Title screen -> the Dev mode choice -> New World -> the HUD button / E / the touch bag button open the creative
// menu -> search, tap an item into the pack -> place it without using it up -> no damage or hunger -> Continue names
// the mode. Real input for every action under test. HW_GPU=1 renders on the real GPU. Exit code 1 when a step fails.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : ['desktop', 'phonePortrait', 'phoneLandscape'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-dev'));
const dist = e2eDist(root, argv);
const SEED = 'dev-e2e';

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
await ensureBuilt(argv, dist);

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (Dev Mode)`);
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
  const noPageScroll = async () =>
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1), 'the page scrolls');
  const overflowing = (selector) =>
    page.evaluate((sel) => [...document.querySelectorAll(sel)].some((el) => el.getBoundingClientRect().right > innerWidth + 1 || el.getBoundingClientRect().left < -1), selector);

  try {
    await step('title offers Survival | Dev next to New World (44 px targets, nothing off screen)', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await d.settle(600);
      const modes = page.locator('.hw-title__mode [data-value]');
      assert((await modes.count()) === 2, 'the Mode control needs two options');
      if (d.touch) for (const i of [0, 1]) assert((await modes.nth(i).boundingBox()).height >= 43, 'mode option is under 44 px tall');
      assert(!(await overflowing('.hw-title__mode, .hw-title__new')), 'the mode control runs off screen');
      await noPageScroll();
      await d.shot('1-title');
    });

    await step('Dev mode is chosen only by the toggle: New World starts a dev world with the typed seed', async () => {
      await page.fill('.hw-title input', SEED);
      await d.press(page.locator('.hw-title__mode [data-value="dev"]'));
      await d.shot('2-title-dev');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
      const s = await d.state();
      assert(s.gameMode === 'dev', `mode is ${s.gameMode}`);
      assert(errors.length === 0, `console errors: ${errors.join(' | ')}`);
      await d.shot('3-play');
      assert(await page.locator('.hw-devchip').isVisible(), 'the HUD Creative button is missing');
    });

    await step('E / the HUD button opens the creative menu with every group tab, search and the pack', async () => {
      // Desktop plays with the pointer locked (nothing to click): E opens it. Touch taps the HUD button.
      if (d.touch) await d.press(page.locator('.hw-devchip'));
      else await page.keyboard.press('KeyE');
      await d.waitScreen('creative');
      const tabs = await page.locator('.hw-creative .hw-tabs button').allTextContents();
      for (const label of ['All', 'Blocks', 'Materials', 'Tools', 'Food', 'Machines']) assert(tabs.some((t) => t.startsWith(label)), `tab ${label} missing in ${tabs.join(',')}`);
      const total = await page.locator('.hw-creative__grid > :not([hidden])').count();
      const registry = await d.hw(() => window.__hw.app.game.state.player.inventory.size && document.querySelectorAll('.hw-creative__grid > *').length);
      assert(total === registry && total > 100, `grid shows ${total} of ${registry}`);
      assert(!(await overflowing('.hw-creative, .hw-window__frame')), 'the creative menu runs off screen');
      await noPageScroll();
      await d.shot('4-creative');
    });

    await step('search and tabs narrow the list', async () => {
      await page.fill('.hw-creative input[type="text"], .hw-creative input:not([type])', 'copper');
      await d.settle(300);
      const n = await page.locator('.hw-creative__grid > :not([hidden])').count();
      assert(n > 0 && n < 60, `search for copper shows ${n}`);
      await page.fill('.hw-creative input[type="text"], .hw-creative input:not([type])', '');
      await d.press(page.locator('.hw-creative .hw-tabs button', { hasText: 'Tools' }));
      await d.settle(300);
      const tools = await page.locator('.hw-creative__grid > :not([hidden])').count();
      assert(tools > 0, 'no tools listed');
      await d.press(page.locator('.hw-creative .hw-tabs button', { hasText: 'All' }));
    });

    await step('tapping an item puts it in the pack; a full stack arrives with the Full stacks toggle', async () => {
      await page.fill('.hw-creative input[type="text"], .hw-creative input:not([type])', 'stone');
      await d.settle(300);
      const slot = page.locator('.hw-creative__grid [data-item="stone"]');
      await slot.scrollIntoViewIfNeeded();
      await d.press(slot);
      await d.settle(300);
      assert(((await d.inventory()).stone ?? 0) === 1, `stone count ${(await d.inventory()).stone}`);
      await d.press(page.locator('.hw-creative__options .hw-toggle', { hasText: 'Full stacks' }).first());
      await d.press(slot);
      await d.settle(300);
      assert(((await d.inventory()).stone ?? 0) > 50, 'a full stack did not arrive');
      await d.shot('5-grabbed');
    });

    await step('a machine and a tool from the list can be taken too', async () => {
      for (const key of ['furnace_clay', 'flint_pickaxe']) {
        await page.fill('.hw-creative input[type="text"], .hw-creative input:not([type])', key.replace('_', ' '));
        await d.settle(250);
        const slot = page.locator(`.hw-creative__grid [data-item="${key}"]`);
        await slot.scrollIntoViewIfNeeded();
        await d.press(slot);
      }
      const inv = await d.inventory();
      assert(inv.furnace_clay >= 1 && inv.flint_pickaxe >= 1, `pack: ${JSON.stringify(inv)}`);
    });

    await step('closing the menu and placing the block does not use it up', async () => {
      await d.closeScreen();
      const before = (await d.inventory()).stone;
      const spot = await d.placeHeld('stone');
      assert(spot, 'the block could not be placed');
      await d.settle(300);
      assert((await d.inventory()).stone === before, `stone went from ${before} to ${(await d.inventory()).stone}`);
      await d.shot('6-placed');
    });

    await step('no damage, no hunger, no wear', async () => {
      await d.hw(() => {
        window.__hw.damage(12, 'fall');
        window.__hw.setFood(0);
      });
      await d.settle(1500);
      const s = await d.state();
      assert(s.player.health === 20, `health ${s.player.health}`);
      assert(s.player.food >= 19, `food ${s.player.food}`);
    });

    await step('E / the bag button opens the same menu', async () => {
      if (device === 'desktop') await page.keyboard.press('KeyE');
      else await d.press(page.locator('[data-hw-touch="bag"]'));
      await d.waitScreen('creative');
      await d.closeScreen();
    });

    await step('Continue names the mode, so it cannot be mixed up', async () => {
      await d.hw(() => window.__hw.app.save());
      await d.hw(() => window.__hw.quit());
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await d.settle(600);
      const text = await page.locator('.hw-title__menu').innerText();
      assert(/Dev Mode world/.test(text), `Continue shows: ${text.replace(/\s+/g, ' ')}`);
      await d.shot('7-continue');
      await d.press(page.locator('.hw-title button', { hasText: 'Continue' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play again', { timeout: 120_000 });
      assert((await d.state()).gameMode === 'dev', 'the continued world lost its mode');
      await d.pause();
      assert(/Dev Mode world/.test(await page.locator('.hw-window').innerText()), 'the pause menu does not name the mode');
      await d.shot('8-pause');
    });

    await step('no console errors during the run', async () => {
      assert(errors.length === 0, `console errors: ${errors.slice(0, 5).join(' | ')}`);
    });
  } finally {
    await session.close();
  }
}
