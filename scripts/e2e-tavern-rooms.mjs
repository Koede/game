// Screenshots of the tavern's upper floor (balcony over the hall, a bedroom) and the cellar and vault (docs/api/npcs.md).
//   node scripts/e2e-tavern-rooms.mjs [--no-build] [--dist=<dir>] [--device=desktop] [--shots=<dir>]
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : ['desktop'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-tavern-rooms'));
const dist = e2eDist(root, argv);
mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
await ensureBuilt(argv, dist);
const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (tavern rooms)`);
  const session = await openGame({ dir: dist, device });
  const { page } = session;
  const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
  // Stands at tavern-local (x, y, z) and looks at tavern-local (lx, ly, lz).
  const view = (p, l) => d.hw(([a, b]) => {
    const at = window.__hw.app.game.state.npcs.at;
    window.__hw.teleport(at[0] + a[0] + 0.5, at[1] + a[1], at[2] + a[2] + 0.5);
    window.__hw.lookAt(at[0] + b[0] + 0.5, at[1] + b[1], at[2] + b[2] + 0.5);
  }, [p, l]);
  try {
    await report.step('a new world opens in the tavern', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'rooms-e2e');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      // A new world starts at the camp; the tavern tests build the full tavern first (window.__hw.settle).
      if (!(await d.hw(() => window.__hw.settle()))) throw new Error('could not settle the camp into the tavern');
      await d.settle(2500);
    });
    const spots = [
      ['1-hall-from-door', [6, 1, 1], [6, 1, 7]],
      ['2-balcony-looking-down', [6, 6, 4], [6, 1, 0]],
      ['2b-balcony-over-hall', [4, 6, 4], [8, 2, 1]],
      ['2c-hall-looking-up', [6, 1, 4], [6, 7, 1]],
      ['3-balcony-along', [4, 6, 4], [10, 6, 4]],
      ['4-bedroom', [3, 6, 6], [1, 6, 6]],
      ['5-cellar', [6, -3, 6], [6, -3, 1]],
      ['6-cellar-false-wall', [6, -3, 6], [6, -2, 8]],
      ['7-stairwell-from-yard', [11, 1, 13], [11, -3, 9]],
      ['8-stairs-up', [1, 1, 7], [1, 6, 1]],
      ['9-yard-eave', [6, 1, 9], [6, 3, 10]],
      ['9b-yard-eave-side', [1, 1, 11], [6, 3, 10]],
    ];
    for (const [name, p, l] of spots) {
      await report.step(name, async () => {
        await view(p, l);
        await d.settle(700);
        await d.shot(name);
      });
    }
  } finally {
    await session.close();
  }
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
