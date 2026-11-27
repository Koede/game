// Browser check of the airship (docs/api/airship.md): moor, refuel, board, climb, fly, spot onto the sky chart, cycle
// the course, refuse to step off in mid-air, sink, land and step off; the ship and chart are in the save.
//   node scripts/e2e-airship.mjs [--device=phonePortrait] [--out=<dir>] [--shots=<dir>] [--no-build]
// Real input: taps, the joystick and the touch buttons on phones (keys on desktop). __hw only sets up (give, voxels, look).
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const arg = (n, d) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const device = arg('device', 'phonePortrait');
const out = e2eDist(root, argv);
const shots = resolve(arg('shots', join(root, 'test-results/e2e-airship')));
mkdirSync(shots, { recursive: true });
await ensureBuilt(argv, out);

const report = createReporter();
const { assert } = report;
const session = await openGame({ dir: out, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
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
const slotOf = (item) => page.evaluate((i) => window.__hw.state().inventory.find((s) => s.item === i)?.slot, item);
const select = async (item) => page.evaluate((s) => window.__hw.selectSlot(s), await slotOf(item));
const ship = () => page.evaluate(() => {
  const a = window.__hw.app.game.airships;
  const s = a.flying ?? [...a.ships.values()][0];
  return s ? { x: s.x, y: s.y, z: s.z, yaw: s.yaw, fuel: s.fuel, flying: a.flying !== null, charted: a.chart.size, course: a.chart.course } : null;
});
const status = () => page.evaluate(() => window.__hw.app.game.airships.status());

/** Holds a touch button (or a key on desktop) for `ms`, or until `until()` is true. */
async function hold(button, key, ms, until = null) {
  const started = Date.now();
  if (d.touch) {
    const c = await d.centerOf(`[data-hw-touch="${button}"]`);
    await d.fingerDown(5, c.x, c.y);
  } else await page.keyboard.down(key);
  while (Date.now() - started < ms) {
    await sleep(250);
    if (until && (await until())) break;
  }
  if (d.touch) await d.fingerUp(5);
  else await page.keyboard.up(key);
}

/** Pushes the joystick up (or holds W) for `ms`. */
async function thrust(ms) {
  if (!d.touch) {
    await page.keyboard.down('KeyW');
    await sleep(ms);
    await page.keyboard.up('KeyW');
    return;
  }
  const { height } = d.size;
  const x = 90;
  const y = device === 'phonePortrait' ? height - 170 : height - 70;
  await d.fingerDown(1, x, y);
  for (let i = 1; i <= 6; i++) {
    await d.fingerMove(1, x, y - i * 12);
    await sleep(30);
  }
  await sleep(ms);
  await d.fingerUp(1);
}

/** The Use control as a button (a world tap is a stray tap aboard). */
async function useButton() {
  if (!d.touch) return d.use();
  const btn = page.locator('[data-hw-touch="use"]');
  if (await btn.isVisible()) {
    const c = await d.centerOf('[data-hw-touch="use"]');
    await d.tapFinger(6, c.x, c.y);
  } else await d.use();
}

const PX = 0;
const PZ = 0;
const FLOOR = 70;

try {
  await step('a new world loads into play and a mooring field is built', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'airship-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
    await page.evaluate(([x, z, y]) => {
      window.__hw.app.game.state.world.ensureLoadedAround(x, z, 2);
      for (let dz = -16; dz <= 16; dz++) for (let dx = -16; dx <= 16; dx++) {
        window.__hw.setVoxel(x + dx, y, z + dz, 'grass');
        for (let h = 1; h <= 8; h++) window.__hw.setVoxel(x + dx, y + h, z + dz, 'air');
      }
      window.__hw.clearInventory();
      window.__hw.setTime(0.5);
      window.__hw.teleport(x + 0.5, y + 1, z + 9.5);
    }, [PX, PZ, FLOOR]);
    await d.settle(800);
  });

  await step('the airship item moors a ship on open ground', async () => {
    await page.evaluate(() => {
      window.__hw.give('airship', 1);
      window.__hw.give('fuel_canister', 4);
      window.__hw.look(0, -0.75);
    });
    await select('airship');
    await d.use();
    await d.settle(700);
    const s = await ship();
    assert(s !== null, 'ship moored');
    assert((await d.inventory()).airship === undefined, 'item used up');
    await page.evaluate(() => {
      const s = [...window.__hw.app.game.airships.ships.values()][0];
      window.__hw.teleport(s.x + 6.5, s.y, s.z + 6.5);
      window.__hw.lookAt(Math.floor(s.x), Math.floor(s.y + 2.5), Math.floor(s.z));
    });
    await d.settle(900);
    await d.shot('01-moored');
  });

  await step('fuel canisters refuel it and an empty hand climbs aboard; the flight HUD shows', async () => {
    await page.evaluate(() => {
      const s = [...window.__hw.app.game.airships.ships.values()][0];
      window.__hw.teleport(s.x + 0.5, s.y, s.z + 3.6);
      window.__hw.lookAt(Math.floor(s.x), Math.floor(s.y + 1), Math.floor(s.z));
    });
    await d.settle(400);
    await select('fuel_canister');
    for (let i = 0; i < 4; i++) {
      await d.use();
      await sleep(800);
    }
    const s = await ship();
    assert(s.fuel >= 600, `fuel ${s.fuel}`);
    assert(((await d.inventory()).fuel_canister ?? 0) === 0, 'canisters used');
    await d.use();
    await d.settle(800);
    assert((await ship()).flying, 'aboard');
    assert(await page.locator('.hw-airship--on').count(), 'flight HUD visible');
    if (d.touch) {
      const jump = await page.locator('[data-hw-touch="jump"] .hw-touch-label').textContent().catch(() => null);
      if (jump !== null) assert(jump === 'Up', `jump button reads ${jump}`);
    }
    await d.shot('02-aboard');
  });

  await step('Up climbs; from up high new places go on the sky chart with toasts', async () => {
    const y0 = (await ship()).y;
    await page.evaluate(() => window.__hw.look(0, 0.1));
    await hold('jump', 'Space', 12_000, async () => (await ship()).y > 104);
    const s = await ship();
    assert(s.y > y0 + 15, `climbed ${y0.toFixed(1)} -> ${s.y.toFixed(1)}`);
    await waitFor(page, () => window.__hw.app.game.airships.chart.size > 0, 'something on the chart', { timeout: 6000 });
    const st = await status();
    assert(st.sight > 100, `sees ${st.sight}`);
    assert(st.course !== null, 'a course is set');
    const flags = await page.evaluate(() => window.__hw.app.game.state.objectives.toJSON().flags);
    assert(flags.includes('flew_airship'), 'flight flag raised');
    await page.evaluate(() => window.__hw.look(0, -0.35));
    await d.settle(600);
    await d.shot('03-aloft');
  });

  await step('the stick flies it forward and the course button steers for the next place', async () => {
    const a = await ship();
    await thrust(3500);
    const b = await ship();
    assert(Math.hypot(b.x - a.x, b.z - a.z) > 8, `flew ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(1)} m`);
    assert(b.fuel < a.fuel, 'burnt fuel');
    const before = (await ship()).course;
    const charted = (await ship()).charted;
    await page.locator('.hw-airship-course').click();
    await sleep(400);
    const after = (await ship()).course;
    if (charted > 1) assert(after !== before, `course moved on (${before} -> ${after})`);
    const text = await page.locator('.hw-airship-course').textContent();
    assert(/ m [NESW]{1,2}$/.test(text.trim()), `course text "${text}"`);
    await page.evaluate(() => window.__hw.look(0.6, 0.05));
    await d.settle(600);
    await d.shot('04-course');
  });

  await step('Exit is refused up high; Down sinks it to the ground and Exit then steps off', async () => {
    await useButton();
    await sleep(500);
    assert((await ship()).flying, 'still aboard in mid-air');
    await sleep(700);
    await hold('mine', 'KeyF', 45_000, async () => (await status())?.canLand === true);
    const st = await status();
    assert(st.canLand, `near the ground (clearance ${st.clearance.toFixed(2)})`);
    await sleep(700);
    await useButton();
    await d.settle(800);
    const s = await ship();
    assert(!s.flying, 'stepped off');
    const p = (await d.state()).player;
    assert(Math.abs(p.y - s.y) < 3, `player near the ship's feet (${p.y.toFixed(1)} vs ${s.y.toFixed(1)})`);
    // Step back for a look at the ship where it came down (the set-up teleport only frames the picture).
    await page.evaluate(() => {
      const s = [...window.__hw.app.game.airships.ships.values()][0];
      const w = window.__hw.app.game.state.world;
      const x = Math.floor(s.x + 7);
      const z = Math.floor(s.z + 7);
      window.__hw.teleport(x + 0.5, w.surfaceY(x, z) + 1, z + 0.5);
      window.__hw.lookAt(Math.floor(s.x), Math.floor(s.y + 2.5), Math.floor(s.z));
    });
    await d.settle(900);
    await d.shot('05-landed');
  });

  await step('the ship and the chart are in the save document', async () => {
    const extras = await page.evaluate(() => JSON.parse(window.__hw.app.game.toSaveJson()).world.extras.airships);
    assert(extras.ships.length === 1, `ships saved: ${extras.ships.length}`);
    assert(extras.chart.entries.length > 0, `chart saved: ${extras.chart.entries.length}`);
  });

  await step('no console errors during the run', async () => {
    assert(errors.length === 0, `console errors: ${errors.slice(0, 5).join(' | ')}`);
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
