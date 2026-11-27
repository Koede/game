// End-to-end check of the town clock tower (src/workshop/clockTower.ts), phone portrait by default:
//
//   node scripts/e2e-clocktower.mjs                 build to a scratch dir, run phone portrait
//   node scripts/e2e-clocktower.mjs --no-build      use the existing build (--dist=<dir>, default dist/)
//   node scripts/e2e-clocktower.mjs --device=desktop
//
// A tower clock is placed from the hand, a wire and a lamp beside it: the lamp lights while the tower strikes the hour. A tap
// on the tower changes the town's hours (toast), which shifts the camp's day. A signal timer next to it gains clock settings.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : ['phonePortrait'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-clocktower'));
const dist = e2eDist(root, argv);

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
await ensureBuilt(argv, dist);

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (clock tower)`);
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
  // A tap on a block that opens no screen (aim with the real camera, then Use).
  const tap = async (pos) => {
    if (!(await d.aimAt(pos))) {
      const stand = await d.standBeside(pos);
      if (stand) await d.hw((s) => window.__hw.teleport(s.x, s.y, s.z), stand);
      if (!(await d.aimAt(pos))) throw new Error(`cannot aim at ${JSON.stringify(pos)}`);
    }
    await d.use();
    await d.settle(250);
  };
  const toasts = () => page.evaluate(() => document.querySelector('.hw-toasts')?.textContent ?? '');

  try {
    await step('a new world loads into play', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'hearth-clocktower');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
    });

    await step('a tower clock placed from the hand stands in a cleared yard', async () => {
      P = await d.hw(() => {
        const hw = window.__hw;
        hw.clearInventory();
        hw.setTime(0.3);
        hw.setWeather('clear');
        const p = hw.state().player;
        const gy = Math.floor(p.y);
        const x0 = Math.floor(p.x);
        const z0 = Math.floor(p.z) - 3;
        for (let x = x0 - 3; x <= x0 + 3; x++)
          for (let z = z0 - 2; z <= z0 + 5; z++) {
            hw.setVoxel(x, gy - 1, z, 'stone');
            for (let y = gy; y <= gy + 5; y++) hw.setVoxel(x, y, z, 'air');
          }
        hw.give('clock_tower', 1);
        return { gy, x0, z0 };
      });
      const placed = await d.placeHeld('clock_tower');
      assert(placed, 'placed the tower clock');
      const at = await d.hw((p) => {
        const hw = window.__hw;
        for (let dz = -2; dz <= 4; dz++) for (let dx = -3; dx <= 3; dx++) for (let dy = 0; dy <= 2; dy++)
          if (hw.getBlock(p.x0 + dx, p.gy + dy, p.z0 + dz).block === 'clock_tower') return { x: p.x0 + dx, y: p.gy + dy, z: p.z0 + dz };
        return null;
      }, P);
      assert(at, 'the tower clock is in the world');
      P.t = at;
    });

    await step('it strikes the hour: a lamp on its wire lights, then goes out', async () => {
      await d.hw((p) => {
        const hw = window.__hw;
        hw.setVoxel(p.t.x + 1, p.t.y, p.t.z, 'signal_wire');
        hw.setVoxel(p.t.x + 2, p.t.y, p.t.z, 'signal_lamp');
        hw.setTime(4 / 24 + 0.0001); // ten o'clock, the strike begins
      }, P);
      await d.settle(500);
      const on = await d.hw((p) => window.__hw.app.game.workshop.describe(p.t.x + 2, p.t.y, p.t.z), P);
      assert(/on/.test(on), `lamp while striking: ${on}`);
      await d.hw((p) => window.__hw.lookAt(p.t.x + 1, p.t.y + 0.5, p.t.z + 0.5), P);
      await d.settle(300);
      await d.shot('01-striking');
      await d.hw(() => window.__hw.setTime(4.5 / 24));
      await d.settle(500);
      const off = await d.hw((p) => window.__hw.app.game.workshop.describe(p.t.x + 2, p.t.y, p.t.z), P);
      assert(/off/.test(off), `lamp after the strike: ${off}`);
    });

    await step('a tap on the tower sets the town hours and the camp keeps them', async () => {
      const camp = await d.hw(() => window.__hw.app.game.state.npcs.at);
      assert(camp, 'the world has a camp');
      const before = await d.hw(() => window.__hw.app.game.state.npcs.townClock.tower);
      assert(before, `the camp sees the tower (camp at ${camp})`);
      await d.selectEmptyHand();
      await tap(P.t);
      await d.settle(400);
      const text = await toasts();
      assert(/Early risers/.test(text), `toast: ${text}`);
      await d.shot('02-early-risers');
      // At 05:30 the sun says night; the early town is already up.
      const phase = await d.hw(() => {
        const hw = window.__hw;
        hw.setTime(1 - 0.5 / 24);
        hw.tick(0.2);
        return hw.app.game.state.npcs.phase();
      });
      assert(phase === 'morning', `town phase at 05:30 with early risers: ${phase}`);
      const desc = await d.hw((p) => window.__hw.app.game.workshop.describe(p.t.x, p.t.y, p.t.z), P);
      assert(/Early risers/.test(desc), `describe: ${desc}`);
    });

    await step('a signal timer beside the tower gains clock settings', async () => {
      await d.hw((p) => {
        const hw = window.__hw;
        hw.setTime(0.3);
        hw.setVoxel(p.t.x - 1, p.t.y, p.t.z, 'signal_timer');
      }, P);
      await d.settle(300);
      for (let i = 0; i < 7; i++) {
        await tap({ x: P.t.x - 1, y: P.t.y, z: P.t.z });
        await d.settle(250);
      }
      const desc = await d.hw((p) => window.__hw.app.game.workshop.describe(p.t.x - 1, p.t.y, p.t.z), P);
      assert(/sunrise to sunset/.test(desc), `timer: ${desc}`);
      await d.shot('03-timer');
    });

    await step('close-up: the dial by day, and glowing while it strikes at night', async () => {
      await d.hw((p) => {
        const hw = window.__hw;
        hw.setVoxel(p.t.x - 1, p.t.y, p.t.z, 'air');
        hw.setVoxel(p.t.x + 1, p.t.y, p.t.z, 'air');
        hw.setVoxel(p.t.x + 2, p.t.y, p.t.z, 'air');
        hw.setTime(0.3);
        // Stand in front of the dial (its facing: 0 north, 1 east, 2 south, 3 west), a little back, and look at it.
        const f = hw.getBlock(p.t.x, p.t.y, p.t.z).facing;
        const [dx, dz] = [[0, -1], [1, 0], [0, 1], [-1, 0]][f];
        hw.teleport(p.t.x + 0.5 + dx * 3.2, p.t.y, p.t.z + 0.5 + dz * 3.2);
        hw.lookAt(p.t.x + 0.5, p.t.y + 0.5, p.t.z + 0.5);
      }, P);
      await d.settle(800);
      await d.shot('04-dial-day');
      await d.hw(() => window.__hw.setTime(17 / 24 + 0.0001)); // eleven at night, striking
      await d.settle(600);
      const lit = await d.hw((p) => window.__hw.getBlock(p.t.x, p.t.y, p.t.z).active, P);
      assert(lit, 'the dial is lit while it strikes');
      await d.shot('05-dial-striking-night');
    });

    await step('no page errors', async () => {
      assert(errors.length === 0, `errors: ${errors.slice(0, 3).join(' | ')}`);
    });
  } finally {
    await session.close();
  }
}
