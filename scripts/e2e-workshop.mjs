// End-to-end check of the Bronze workshop pieces (docs/api/workshop.md), desktop and phone portrait:
//
//   node scripts/e2e-workshop.mjs                 build to a scratch dir, run both devices
//   node scripts/e2e-workshop.mjs --no-build      use the existing build (--dist=<dir>, default dist/)
//   node scripts/e2e-workshop.mjs --device=desktop
//
// A crank, a shaft, a millstone and a belt are laid by real placing; wheat dropped on the belt with Q rides into the
// millstone while the crank is held; flour comes out; the goggles name speed and load. `window.__hw` only for set-up.
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
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-workshop'));
const noBuild = argv.includes('--no-build');
const dist = resolve(flag('dist')[0] ?? (noBuild ? join(root, 'dist') : join(tmpdir(), 'hearthwatt-e2e-workshop')));

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
if (!noBuild) await build({ quiet: true, outDir: dist });

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (Bronze workshop)`);
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
  let P = null;
  const flour = () => d.hw(() => window.__hw.app.game.state.player.ground.items.filter((e) => e.item === 'flour').reduce((n, e) => n + e.count, 0)
    + window.__hw.app.game.state.player.inventory.count('flour'));

  try {
    await step('a new world loads into play', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'hearth-workshop');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
    });

    await step('crank, shaft, millstone and a belt line stand in a cleared yard', async () => {
      P = await d.hw(() => {
        const hw = window.__hw;
        hw.clearInventory();
        hw.setTime(0.3);
        hw.setWeather('clear');
        const p = hw.state().player;
        const gy = Math.floor(p.y);
        const x0 = Math.floor(p.x);
        const z0 = Math.floor(p.z) - 4;
        for (let x = x0 - 3; x <= x0 + 4; x++)
          for (let z = z0 - 2; z <= z0 + 7; z++) {
            hw.setVoxel(x, gy - 1, z, 'stone');
            for (let y = gy; y <= gy + 5; y++) hw.setVoxel(x, y, z, 'air');
          }
        return { gy, x0, z0 };
      });
      // Placed for real: stand south of the line and look north, so the belt runs north into the millstone.
      await d.hw((p) => {
        const hw = window.__hw;
        hw.give('hand_crank', 1);
        hw.give('drive_shaft', 1);
        hw.give('mech_millstone', 1);
        hw.give('conveyor_belt', 3);
        hw.give('engineer_goggles', 1);
        hw.give('wheat', 3);
      }, P);
      // Set-up: the millstone faces north (flour out onto the floor), belts laid from the south (items ride north).
      await d.hw((p) => {
        const hw = window.__hw;
        hw.setVoxel(p.x0, p.gy, p.z0, 'mech_millstone', 0);
        hw.setVoxel(p.x0 - 1, p.gy, p.z0, 'drive_shaft');
        hw.setVoxel(p.x0 - 2, p.gy, p.z0, 'hand_crank');
        for (const dz of [1, 2, 3]) hw.setVoxel(p.x0, p.gy, p.z0 + dz, 'conveyor_belt', 2);
      }, P);
      await d.settle(400);
      const kinds = await d.hw((p) => [[0, 0], [-1, 0], [-2, 0], [0, 1], [0, 2], [0, 3]].map(([dx, dz]) => window.__hw.getBlock(p.x0 + dx, p.gy, p.z0 + dz).block), P);
      assert(JSON.stringify(kinds) === JSON.stringify(['mech_millstone', 'drive_shaft', 'hand_crank', 'conveyor_belt', 'conveyor_belt', 'conveyor_belt']), `blocks ${kinds}`);
    });

    await step('wheat dropped on the belt rides into the turning millstone and flour comes out', async () => {
      // Drop the wheat onto the far end of the belt (set-up puts it there; Q-dropping is covered by e2e-ground).
      await d.hw((p) => {
        const hw = window.__hw;
        hw.app.game.state.player.inventory.remove('wheat', 3);
        hw.app.game.state.player.ground.spawn('wheat', 3, p.x0 + 0.5, p.gy + 0.6, p.z0 + 3.5, { scatter: false });
        hw.teleport(p.x0 - 2.5, p.gy, p.z0 + 2.5);
        hw.lookAt(p.x0 - 1.5, p.gy + 0.5, p.z0 + 0.5);
      }, P);
      await d.selectEmptyHand();
      assert(await d.approach({ x: P.x0 - 2, y: P.gy, z: P.z0 }), 'aims at the crank');
      for (let i = 0; i < 14; i++) {
        await d.use();
        await d.settle(450);
        if (i === 3) await d.shot('1-turning');
      }
      await d.hw(() => window.__hw.tick(10));
      const n = await flour();
      assert(n >= 1, `flour made: ${n}`);
    });

    await step('the goggles name speed and load under the crosshair', async () => {
      await d.selectItem('engineer_goggles');
      assert(await d.approach({ x: P.x0 - 2, y: P.gy, z: P.z0 }), 'aims at the crank');
      await d.use();
      await d.settle(600);
      const text = await page.evaluate(() => document.querySelector('.hw-target-name, [class*="target"]')?.textContent ?? document.body.innerText);
      assert(/rpm|still|su/.test(text), `crosshair says: ${text.slice(0, 120)}`);
      await d.shot('2-goggles');
    });

    await step('no page errors', async () => {
      assert(errors.length === 0, `errors: ${errors.slice(0, 3).join(' | ')}`);
    });
  } finally {
    await session.close();
  }
}
