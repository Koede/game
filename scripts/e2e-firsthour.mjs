// Browser check of the guided first hour (headless Chromium):
//
//   node scripts/e2e-firsthour.mjs --out=<dir-with-a-build> --device=phonePortrait --shots=<dir>
//
// A new world: the goal plate carries ONE path ("First hour: step N of M"), starting with meeting Gruk; the camp chip does not
// repeat it; "What next?" answers for the same step and points at the camp; talking to Gruk moves the plate to the first main goal.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const device = flag('device', 'phonePortrait');
const dir = e2eDist(root, argv);
await ensureBuilt(argv, dir);
const shots = resolve(flag('shots', join(root, 'test-results/e2e-firsthour')));
mkdirSync(shots, { recursive: true });

const report = createReporter();
const session = await openGame({ dir, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
const plate = () => page.locator('.hw-goal:not(.hw-town-chip)').first().innerText().then((t) => t.replace(/\s+/g, ' '));

try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'firsthour-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(2000);
  });

  await report.step('the plate says step 1: meet Gruk, and the camp chip stays out of the way', async () => {
    const t = await plate();
    assert(/first hour: step 1 of \d+/i.test(t) && /meet gruk/i.test(t), `plate: ${t}`);
    assert(await page.locator('[data-testid="town-chip"]').isHidden(), 'the camp chip repeats the plate');
    await d.shot('01-plate');
  });

  await report.step('What next? gives the same step, with an arrow to the camp', async () => {
    await d.press(page.locator('.hw-nudge__ask'));
    await d.settle(400);
    const text = (await page.locator('.hw-nudge__text').textContent()) ?? '';
    assert(/gruk/i.test(text), `hint: ${text}`);
    assert(await page.locator('.hw-nudge .hw-compass__needle').isVisible(), 'no arrow');
    await d.shot('02-what-next');
  });

  await report.step('after Gruk is spoken to, the plate moves on to gathering wood', async () => {
    await d.hw(() => { window.__hw.app.game.state.npcs.spoken.gruk = 1; });
    await waitFor(page, () => /step 2 of/i.test(document.querySelector('.hw-goal:not(.hw-town-chip)')?.textContent ?? ''), 'step 2', { timeout: 8000, interval: 200 });
    const t = await plate();
    assert(/gather wood/i.test(t), `plate: ${t}`);
    await d.press(page.locator('.hw-nudge__ask'));
    await d.press(page.locator('.hw-nudge__ask'));
    await d.settle(400);
    const hint = (await page.locator('.hw-nudge__text').textContent()) ?? '';
    assert(/break|log|mine/i.test(hint), `hint: ${hint}`);
    await d.shot('03-wood');
  });

  await report.step('the plate fits the phone width', async () => {
    const box = await page.locator('.hw-goal:not(.hw-town-chip)').first().boundingBox();
    assert(box && box.x >= 0 && box.x + box.width <= page.viewportSize().width, JSON.stringify(box));
  });

  assert(errors.length === 0, `page errors: ${errors.join(' | ')}`);
} finally {
  await session.close();
}
process.exit(report.failures > 0 ? 1 : 0);
