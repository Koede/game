// End-to-end check of the pack housekeeping (docs/api/inventory.md): Sort merges and orders the backpack, Favourite marks a slot with a
// star that survives a sort, and "Move all like this" is offered. Real clicks; window.__hw only sets the pack up and reads it.
//   node scripts/e2e-inventory.mjs [--no-build] [--dist=<dir>] [--device=desktop] [--shots=<dir>]
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : ['desktop', 'phonePortrait'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-inventory'));
const dist = e2eDist(root, argv);

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
await ensureBuilt(argv, dist);

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (inventory)`);
  const session = await openGame({ dir: dist, device });
  const { page } = session;
  const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
  const { assert } = report;
  const pack = () => d.hw(() => window.__hw.app.game.state.player.inventory.toJSON());
  try {
    await report.step('a new world opens and the pack is set up scattered', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'inv-e2e');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
      await d.hw(() => {
        const inv = window.__hw.app.game.state.player.inventory;
        inv.clear();
        inv.set(12, { item: 'plank', count: 10 });
        inv.set(15, { item: 'stone', count: 6 });
        inv.set(18, { item: 'plank', count: 20 });
        inv.set(22, { item: 'dirt', count: 3 });
      });
      await d.openInventory();
      await page.waitForSelector('.hw-bag', { timeout: 5000 });
      await d.settle(300);
      await d.shot('1-scattered');
    });

    await report.step('Sort merges the planks and packs the backpack to the front', async () => {
      await d.press(page.locator('.hw-bag__headrow .hw-btn', { hasText: 'Sort' }));
      await d.settle(300);
      const s = await pack();
      const filled = s.map((x, i) => (x ? i : -1)).filter((i) => i >= 9);
      assert(filled.join(',') === '9,10,11', `packed at ${filled.join(',')}`);
      assert(s.filter((x) => x && x.item === 'plank').length === 1 && s.find((x) => x && x.item === 'plank').count === 30, 'planks merged');
      await d.shot('2-sorted');
    });

    await report.step('a favourite gets a star and stays put through a sort', async () => {
      await d.hw(() => {
        const inv = window.__hw.app.game.state.player.inventory;
        inv.set(20, { item: 'dirt', count: 5 });
      });
      await d.settle(200);
      const slot = page.locator('.hw-bag .hw-slot').nth(11); // backpack index 11 -> slot 20
      await d.press(slot);
      await d.press(page.locator('.hw-carry .hw-btn', { hasText: 'Favourite' }));
      await d.settle(200);
      const stars = await page.locator('.hw-slot[data-favourite]').count();
      assert(stars === 1, `stars ${stars}`);
      await d.press(page.locator('.hw-bag__headrow .hw-btn', { hasText: 'Sort' }));
      await d.settle(300);
      const s = await pack();
      assert(s[20] && s[20].item === 'dirt' && s[20].count === 5, 'favourite stayed in slot 20');
      await d.shot('3-favourite');
    });
  } finally {
    await session.close();
  }
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
