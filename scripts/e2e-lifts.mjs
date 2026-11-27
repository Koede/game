// Browser check of bridges, lifts and elevators (docs/api/lifts.md), headless Chromium, real input:
//
//   node scripts/e2e-lifts.mjs [--no-build] [--device=phonePortrait|desktop] [--shots=<dir>]
//
// Builds a stone block with a 12 deep shaft and a side tunnel, a lift winch and a wound clockwork motor at its lip; then with
// real input taps the cage to ride it down, steps out into the tunnel with Exit, calls it back from the top, rides the
// elevator with Down and Up, and crosses a gap on a drawbridge deck. window.__hw only builds the site and reads state.
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
const shots = resolve(flag('shots', join(root, 'test-results/e2e-lifts')));
mkdirSync(shots, { recursive: true });

const report = createReporter();
const session = await openGame({ dir, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
const touch = device !== 'desktop';
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
const lift = () => d.hw(() => {
  const s = window.__hw.app.game.state;
  const l = s.lifts.all()[0];
  return l ? { floor: l.floor, target: l.target, riding: s.lifts.riding === l, status: s.lifts.status(), sx: l.sx, sz: l.sz } : null;
});
/** Presses a touch button (Up = jump, Down = mine, Exit = use) or the matching key / mouse button. */
const control = async (name) => {
  if (touch) {
    const c = await d.centerOf(`[data-hw-touch="${name}"]`);
    await d.fingerDown(5, c.x, c.y);
    await d.settle(120);
    await d.fingerUp(5);
    return;
  }
  if (name === 'jump') await page.keyboard.press('Space');
  else if (name === 'mine') {
    await page.mouse.down({ button: 'left' });
    await d.settle(120);
    await page.mouse.up({ button: 'left' });
  } else await page.mouse.click(d.size.width / 2, d.size.height / 2, { button: 'right' });
};

let S = null;
try {
  await step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'hearth-lifts');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await step('a stone block with a shaft, a tunnel, a lift winch and a wound motor stands by the player', async () => {
    S = await d.hw(() => {
      const hw = window.__hw;
      hw.clearInventory();
      hw.setTime(0.3);
      hw.setWeather('clear');
      const p = hw.state().player;
      const y0 = Math.floor(p.y) + 16, ox = Math.floor(p.x) - 3, oz = Math.floor(p.z) - 3;
      // A solid block 9 x 9, 15 deep, with clear air above it.
      for (let x = ox - 1; x <= ox + 7; x++) for (let z = oz - 1; z <= oz + 7; z++) {
        for (let y = y0 - 15; y < y0; y++) hw.setVoxel(x, y, z, 'stone');
        for (let y = y0; y <= y0 + 6; y++) hw.setVoxel(x, y, z, 'air');
      }
      const sx = ox + 3, sz = oz + 3;
      for (let y = y0 - 1; y >= y0 - 12; y--) hw.setVoxel(sx, y, sz, 'air');
      // A tunnel east off the shaft at y0 - 6, two high and three long, with a torch.
      for (let x = sx + 1; x <= sx + 3; x++) { hw.setVoxel(x, y0 - 6, sz, 'air'); hw.setVoxel(x, y0 - 5, sz, 'air'); }
      hw.setVoxel(sx + 3, y0 - 6, sz, 'torch');
      hw.setVoxel(sx - 1, y0 - 12, sz, 'air');
      hw.setVoxel(sx - 1, y0 - 11, sz, 'air');
      hw.setVoxel(sx - 1, y0 - 12, sz, 'torch');
      // The winch north of the shaft, placed from the north (front north = 0), the motor west of it.
      hw.setVoxel(sx, y0, sz - 1, 'lift_winch', 0);
      hw.setVoxel(sx - 1, y0, sz - 1, 'clockwork_motor', 0);
      const s = hw.app.game.state;
      for (let i = 0; i < 4; i++) s.workshop.use(sx - 1, y0, sz - 1, null, () => undefined);
      hw.teleport(sx + 0.5, y0, sz + 2.6);
      return { y0, ox, oz, sx, sz };
    });
    await d.settle(800);
    const l = await lift();
    assert(l && l.sx === S.sx && l.sz === S.sz, `cage hangs in the shaft (${JSON.stringify(l)})`);
    assert(l.floor === S.y0, `cage waits at the top (${l?.floor})`);
    const note = await d.hw((p) => window.__hw.app.game.state.workshop.describe(p.sx, p.y0, p.sz - 1), S);
    assert(/3 landings/.test(note ?? ''), `winch goggles line: ${note}`);
    // A wide look at the headframe and cage from the side.
    await d.hw((p) => { window.__hw.teleport(p.sx + 3.5, p.y0, p.sz + 3.5); window.__hw.lookAt(p.sx, p.y0 + 1.0, p.sz); }, S);
    await d.settle(900);
    await d.shot('01-headframe');
  });

  await step('tapping the cage boards it and it carries the player down to the tunnel', async () => {
    await d.hw((p) => { window.__hw.teleport(p.sx + 0.5, p.y0, p.sz + 1.6); }, S);
    await d.settle(300);
    await d.hw((p) => window.__hw.lookAt(p.sx, p.y0 + 0.2, p.sz), S);
    await d.selectEmptyHand();
    await d.use();
    await waitFor(page, () => window.__hw.app.game.state.lifts.riding !== null, 'riding', { timeout: 4000 });
    const captions = await page.evaluate(() => [...document.querySelectorAll('.hw-touch-btn .hw-touch-label')].map((e) => e.textContent));
    if (touch) assert(captions.includes('Up') && captions.includes('Down') && captions.includes('Exit'), `buttons recaptioned: ${captions.join(',')}`);
    await d.settle(700);
    await d.hw((p) => window.__hw.lookAt(p.sx + 1, p.y0 - 7.5, p.sz), S);
    await d.shot('02-going-down');
    await waitFor(page, (y) => { const l = window.__hw.app.game.state.lifts.all()[0]; return l.target === null && Math.abs(l.floor - (y - 6)) < 0.01; }, 'at the tunnel landing', { timeout: 15_000, arg: S.y0 });
    const st = await lift();
    assert(st.riding && st.status.depth === 6 && st.status.landing, `at landing 6 down: ${JSON.stringify(st.status)}`);
    const hud = await page.evaluate(() => document.querySelector('.hw-lift')?.textContent ?? '');
    assert(/Lift 6 down/.test(hud), `HUD: ${hud}`);
    await d.hw((p) => window.__hw.lookAt(p.sx + 3, p.y0 - 5, p.sz), S);
    await d.settle(800);
    await d.shot('03-tunnel-landing');
  });

  await step('Exit steps out into the tunnel', async () => {
    await control('use');
    await waitFor(page, () => window.__hw.app.game.state.lifts.riding === null, 'stepped out', { timeout: 3000 });
    const p = (await d.state()).player;
    assert(Math.floor(p.x) === S.sx + 1 && Math.floor(p.z) === S.sz && Math.round(p.y) === S.y0 - 6, `in the tunnel (${p.x}, ${p.y}, ${p.z})`);
    await d.settle(600);
    const p2 = (await d.state()).player;
    assert(Math.abs(p2.y - p.y) < 0.2, `standing, not falling (${p.y} -> ${p2.y})`);
  });

  await step('Down rides on to the shaft floor and Up comes back to the tunnel', async () => {
    // Back in by walking into the waiting cage.
    await d.hw((p) => { window.__hw.teleport(p.sx + 0.5, p.y0 - 6, p.sz + 0.5); }, S);
    await waitFor(page, () => window.__hw.app.game.state.lifts.riding !== null, 'walked in', { timeout: 3000 });
    await d.settle(700);
    await control('mine');
    await waitFor(page, (y) => { const l = window.__hw.app.game.state.lifts.all()[0]; return l.target === null && Math.abs(l.floor - (y - 12)) < 0.01; }, 'at the bottom', { timeout: 15_000, arg: S.y0 });
    await d.hw((p) => window.__hw.lookAt(p.sx - 1, p.y0 - 11.5, p.sz), S);
    await d.settle(700);
    await d.shot('04-shaft-floor');
    await control('jump');
    await waitFor(page, (y) => { const l = window.__hw.app.game.state.lifts.all()[0]; return l.target === null && Math.abs(l.floor - (y - 6)) < 0.01; }, 'back at the tunnel', { timeout: 15_000, arg: S.y0 });
    await control('use');
    await waitFor(page, () => window.__hw.app.game.state.lifts.riding === null, 'stepped out again', { timeout: 3000 });
  });

  await step('from the top, tapping the rope calls the cage up', async () => {
    await d.hw((p) => { window.__hw.teleport(p.sx + 0.5, p.y0, p.sz + 1.7); }, S);
    await d.settle(500);
    await d.hw((p) => window.__hw.lookAt(p.sx, p.y0 - 1.5, p.sz), S);
    await d.use();
    await waitFor(page, (y) => { const l = window.__hw.app.game.state.lifts.all()[0]; return l.target === y; }, 'called', { timeout: 3000, arg: S.y0 });
    await d.settle(1200);
    await d.shot('05-called-up');
    await waitFor(page, (y) => { const l = window.__hw.app.game.state.lifts.all()[0]; return l.target === null && l.floor === y; }, 'cage at the top', { timeout: 15_000, arg: S.y0 });
    const st = await lift();
    assert(!st.riding, 'calling does not board');
  });

  await step('a drawbridge lays a deck across a gap while its shaft turns, and the player walks across it', async () => {
    const B = await d.hw((p) => {
      const hw = window.__hw;
      const s = hw.app.game.state;
      // A ledge south of the block, a 7 wide gap, and a far ledge.
      const y = p.y0, z0 = p.oz + 8;
      for (let x = p.sx - 1; x <= p.sx + 1; x++) {
        for (let z = z0; z <= z0 + 2; z++) { hw.setVoxel(x, y - 1, z, 'stone'); for (let h = 0; h < 4; h++) hw.setVoxel(x, y + h, z, 'air'); }
        for (let z = z0 + 3; z <= z0 + 9; z++) for (let h = -12; h < 4; h++) hw.setVoxel(x, y + h, z, 'air');
        for (let z = z0 + 10; z <= z0 + 18; z++) { hw.setVoxel(x, y - 1, z, 'stone'); for (let h = 0; h < 4; h++) hw.setVoxel(x, y + h, z, 'air'); }
      }
      // The drawbridge at the ledge's edge, placed from the north (front north): its deck runs south, a motor beside it.
      hw.setVoxel(p.sx, y - 1, z0 + 2, 'drawbridge', 0);
      hw.setVoxel(p.sx - 1, y - 1, z0 + 2, 'clockwork_motor', 0);
      for (let i = 0; i < 4; i++) s.workshop.use(p.sx - 1, y - 1, z0 + 2, null, () => undefined);
      hw.teleport(p.sx + 0.5, y, z0 + 0.5);
      hw.look(Math.PI, -0.35);
      return { y, z0 };
    }, S);
    await d.settle(400);
    await d.shot('06-drawbridge-start');
    const info = (a) => { const w = window.__hw.app.game.state.workshop; return { bridge: w.describe(a.sx, a.y - 1, a.z0 + 2), motor: w.describe(a.sx - 1, a.y - 1, a.z0 + 2), len: w.bridges.length(a.sx, a.y - 1, a.z0 + 2), block: window.__hw.getBlock(a.sx, a.y - 1, a.z0 + 2) }; };
    try {
      await waitFor(page, (a) => window.__hw.app.game.state.workshop.bridges.length(a.sx, a.y - 1, a.z0 + 2) >= 7, 'deck across', { timeout: 15_000, arg: { ...S, ...B } });
    } catch (e) {
      console.log('drawbridge:', JSON.stringify(await d.hw(info, { ...S, ...B })));
      throw e;
    }
    await d.settle(300);
    await d.shot('07-drawbridge-down');
    const deck = await d.hw((a) => window.__hw.getBlock(a.sx, a.y - 1, a.z0 + 6).block, { ...S, ...B });
    assert(deck === 'bridge_deck', `deck over the gap (${deck})`);
    // Walk south across it.
    await d.hw(() => window.__hw.look(Math.PI, 0));
    // Walk in short goes until past the gap (walking speed differs between devices; the far ledge is long).
    for (let i = 0; i < 6; i++) {
      await d.walk(i === 0 ? 2.2 : 0.6);
      if ((await d.state()).player.z > B.z0 + 10.2) break;
    }
    const p = (await d.state()).player;
    assert(p.z > B.z0 + 9 && p.y > B.y - 0.7, `crossed the gap (z ${p.z}, y ${p.y})`);
    await d.hw(() => window.__hw.look(0, -0.3));
    await d.settle(600);
    await d.shot('08-across');
  });
} finally {
  if (ok) await report.step('no console errors', async () => assert(errors.length === 0, errors.slice(0, 5).join(' | ')));
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
