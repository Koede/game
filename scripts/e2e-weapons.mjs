// Phone check of modular tools: assemble an iron pickaxe on a pine handle with resin at the workbench, then hold it.
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';
import { ensureBuilt, e2eDist } from './lib/e2eArgs.mjs';

const root = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-weapons');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);
const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
try {
  await report.step('a new world loads', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'weapons-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });
  let spot;
  await report.step('a workbench is placed', async () => {
    await d.hw(() => { window.__hw.clearInventory(); window.__hw.give('workbench', 1); });
    spot = await d.placeHeld('workbench');
    assert(spot, 'workbench not placed');
  });
  await report.step('the Tool Builder builds a sword and a spear', async () => {
    await d.hw(() => { const hw = window.__hw; hw.give('iron_sword_head', 1); hw.give('flint_spear_head', 1); hw.give('pine_handle', 2); hw.give('stick', 4); hw.give('pine_resin', 1); hw.give('cord', 1); });
    await d.useBlock(spot);
    await d.settle(500);
    await page.locator('.hw-tb summary').evaluate((e) => e.click());
    await page.selectOption('.hw-tb select[aria-label="Tool"] >> nth=0', 'sword');
    await page.selectOption('.hw-tb select[aria-label="Head"]', 'iron');
    await page.selectOption('.hw-tb select[aria-label="Handle"]', 'pine');
    await page.selectOption('.hw-tb select[aria-label="Binding"]', 'resin');
    await d.settle(300);
    await page.locator('.hw-tb').evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await d.shot('01-sword-builder');
    await page.locator('.hw-tb .hw-btn >> text=Build').evaluate((e) => e.click());
    await waitFor(page, () => window.__hw.state().inventory.some((s) => s.item === 'iron_pine_resin_sword'), 'built sword', { timeout: 5000, interval: 100 });
    await page.selectOption('.hw-tb select[aria-label="Tool"] >> nth=0', 'spear');
    await page.selectOption('.hw-tb select[aria-label="Head"]', 'flint');
    await page.selectOption('.hw-tb select[aria-label="Handle"]', 'oak');
    await page.selectOption('.hw-tb select[aria-label="Binding"]', 'cord');
    await d.settle(300);
    await d.shot('02-spear-builder');
    await page.locator('.hw-tb .hw-btn >> text=Build').evaluate((e) => e.click());
    await waitFor(page, () => window.__hw.state().inventory.some((s) => s.item === 'flint_spear'), 'built spear', { timeout: 5000, interval: 100 });
    await d.closeScreen();
  });
  await report.step('no console errors', async () => { assert(errors.length === 0, errors.slice(0, 5).join(' | ')); });
} finally { await session.close(); }
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
