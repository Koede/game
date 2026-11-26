// Phone check of the accessibility options: sizes, palettes, reduced motion, persistence and a real tap-to-move.
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';
import { ensureBuilt, e2eDist } from './lib/e2eArgs.mjs';

const root = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-a11y');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);
const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;

try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'a11y');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
    await d.shot('01-default');
  });

  await report.step('text and HUD size follow the sliders', async () => {
    const before = await page.evaluate(() => ({ fs: getComputedStyle(document.querySelector('.hw-root')).getPropertyValue('--hw-fs-md'), w: document.querySelector('.hw-hotbar').getBoundingClientRect().width }));
    await d.hw(() => window.__hw.setSettings({ textScale: 1.4, hudScale: 1.3 }));
    await d.settle(400);
    const after = await page.evaluate(() => ({ fs: getComputedStyle(document.querySelector('.hw-root')).getPropertyValue('--hw-fs-md'), w: document.querySelector('.hw-hotbar').getBoundingClientRect().width, textScale: document.querySelector('.hw-root').style.getPropertyValue('--hw-text-scale'), iw: window.innerWidth, over: document.documentElement.scrollWidth > window.innerWidth }));
    assert(after.textScale === '1.4', `text scale var ${after.textScale}`);
    const vit = await page.evaluate(() => document.querySelector('.hw-vitals').getBoundingClientRect().width);
    assert(vit > 0, 'no vitals');
    assert(after.w <= after.iw, `hotbar wider than the screen: ${after.w}`);
    assert(!after.over, 'horizontal overflow');
    await d.shot('02-big');
    await d.hw(() => window.__hw.setSettings({ textScale: 0.85, hudScale: 0.8 }));
    await d.settle(300);
    await d.shot('03-small');
    await d.hw(() => window.__hw.setSettings({ textScale: 1, hudScale: 1 }));
  });

  await report.step('colour-blind palettes recolour the status colours', async () => {
    const good = () => page.evaluate(() => getComputedStyle(document.querySelector('.hw-root')).getPropertyValue('--hw-good').trim());
    const base = await good();
    await d.hw(() => window.__hw.setSettings({ colorMode: 'red-green' }));
    await d.settle(300);
    const rg = await good();
    await d.shot('04-red-green');
    await d.hw(() => window.__hw.setSettings({ colorMode: 'blue-yellow' }));
    await d.settle(300);
    const by = await good();
    await d.shot('05-blue-yellow');
    assert(new Set([base, rg, by]).size === 3, `good colours ${base} ${rg} ${by}`);
    await d.hw(() => window.__hw.setSettings({ colorMode: 'off' }));
  });

  await report.step('reduce motion switches animations off', async () => {
    await d.hw(() => window.__hw.setSettings({ reduceMotion: true }));
    await d.settle(300);
    const attr = await page.evaluate(() => document.querySelector('.hw-root').hasAttribute('data-reduce-motion'));
    assert(attr, 'no data-reduce-motion');
  });

  await report.step('tap to move walks to a tapped spot with a real touch', async () => {
    await d.hw(() => window.__hw.setSettings({ tapToMove: true }));
    await d.hw(() => {
      const hw = window.__hw;
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y) + 6, pz = Math.floor(p.z);
      for (let dx = -8; dx <= 8; dx++) for (let dz = -14; dz <= 8; dz++) {
        hw.setVoxel(px + dx, py - 1, pz + dz, 'stone');
        for (let dy = 0; dy <= 4; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      hw.teleport(px + 0.5, py, pz + 0.5);
      hw.look(0, -0.25);
    });
    await d.settle(800);
    const start = (await d.state()).player;
    const { width, height } = d.size;
    await d.tapFinger(7, Math.round(width * 0.5), Math.round(height * 0.5));
    await d.settle(250);
    const mark = await page.evaluate(() => { const el = document.querySelector('.hw-tapmark'); return !!el && !el.hidden; });
    assert(mark, 'no destination marker while walking');
    await d.shot('07-marker');
    await d.settle(2500);
    const gone = await page.evaluate(() => document.querySelector('.hw-tapmark').hidden);
    assert(gone, 'marker still showing after arrival');
    const end = (await d.state()).player;
    const moved = Math.hypot(end.x - start.x, end.z - start.z);
    assert(moved > 2, `moved only ${moved.toFixed(2)} blocks`);
    await d.shot('08-after-tap');
  });

  await report.step('the settings screen shows the new controls on a phone', async () => {
    await d.hw(() => window.__hw.setSettings({ reduceMotion: false }));
    await d.press(page.locator('.hw-touch-btn--pause'));
    await d.settle(500);
    const btn = page.locator('button', { hasText: /^Settings/ }).first();
    await d.press(btn);
    await d.settle(500);
    const acc = page.locator('.hw-settings__section', { hasText: 'Accessibility' });
    await acc.scrollIntoViewIfNeeded();
    const text = await acc.innerText();
    for (const w of ['Colour-blind palette', 'Text size', 'HUD and button size', 'Tap to move', 'Reduce motion']) assert(text.includes(w), `missing ${w}`);
    await d.shot('06-settings');
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert(!over, 'settings overflow');
  });

  await report.step('settings persist across a reload', async () => {
    await d.hw(() => window.__hw.setSettings({ colorMode: 'blue-yellow', textScale: 1.25, hudScale: 1.15, tapToMove: true }));
    await d.settle(800);
    await page.reload();
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    const raw = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).join('|'));
    for (const w of ['"colorMode":"blue-yellow"', '"textScale":1.25', '"hudScale":1.15', '"tapToMove":true']) assert(raw.includes(w), `not saved: ${w}`);
    const attr = await page.evaluate(() => document.querySelector('.hw-root').getAttribute('data-color-mode'));
    assert(attr === 'blue-yellow', `title root data-color-mode ${attr}`);
  });

  await report.step('no console errors', async () => {
    assert(errors.length === 0, errors.slice(0, 5).join(' | '));
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
