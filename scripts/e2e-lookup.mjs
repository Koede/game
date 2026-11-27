// End-to-end check of the "What is this for?" page (pause menu -> search an item -> recipes, uses, finds), phone portrait by default.
//
//   node scripts/e2e-lookup.mjs [--no-build] [--dist=<dir>] [--device=phonePortrait] [--shots=<dir>]
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const device = flag('device')[0] ?? 'phonePortrait';
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-lookup'));
const dist = e2eDist(root, argv);
mkdirSync(shots, { recursive: true });
await ensureBuilt(argv, dist);

const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'hearth-lookup');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });
  await report.step('the pause menu opens the lookup page and finds copper ingots', async () => {
    await d.pause();
    await d.settle(300);
    await d.press(page.locator('.hw-menu__pages button[data-page="lookup"]'));
    await waitFor(page, () => !!document.querySelector('.hw-lookup'), 'the lookup page', { timeout: 5000, interval: 100 });
    await page.fill('.hw-lookup .hw-search input', 'copper ingot');
    await d.settle(200);
    await d.press(page.locator('.hw-lookup__item[data-item="copper_ingot"]'));
    await d.settle(200);
    const text = await page.locator('.hw-lookup__detail').innerText();
    assert(/How to make it/.test(text), 'a how-to-make section');
    assert(/What it is used for/.test(text), 'a used-for section');
    await d.shot('01-copper-ingot');
  });
  await report.step('a found-only item says where it is found', async () => {
    await page.fill('.hw-lookup .hw-search input', 'perch');
    await d.press(page.locator('.hw-lookup__item[data-item="raw_perch"]'));
    await d.settle(200);
    assert(/Fishing/.test(await page.locator('.hw-lookup__detail').innerText()), 'fishing source');
    await d.shot('02-perch');
  });
} finally {
  await session.close?.();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
