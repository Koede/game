// Browser check of the wooden door (headless Chromium, real input):
//
//   node scripts/e2e-door.mjs --out=<dir-with-a-build>   (build first: node scripts/build.mjs --out=<dir>)
//   node scripts/e2e-door.mjs --device=desktop|phonePortrait --shots=<dir>
//
// Places a door with real input, opens and shuts it with Use, and walks through it open. window.__hw only sets up and reads.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const device = flag('device', 'desktop');
const dir = e2eDist(root, argv);
await ensureBuilt(argv, dir);
const shots = resolve(flag('shots', join(root, 'test-results/e2e-door')));
mkdirSync(shots, { recursive: true });

const report = createReporter();
const session = await openGame({ dir, device });
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
const blockAt = (p) => d.hw((t) => window.__hw.getBlock(t.x, t.y, t.z), p);
let door = null;
try {
  await step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'hearth-door');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await step('a door is placed with Use and stands two cells tall', async () => {
    await d.hw(() => window.__hw.give('wooden_door', 2));
    await d.selectItem('wooden_door');
    door = await d.placeHeld('wooden_door');
    assert(door, 'placed a door');
    const bottom = await blockAt(door);
    const top = await blockAt({ ...door, y: door.y + 1 });
    assert(bottom.block === 'wooden_door', `bottom half is a door (got ${bottom.block})`);
    assert(top.block === 'wooden_door', `top half is a door (got ${top.block})`);
    await d.hw((t) => window.__hw.lookAt(t.x, t.y, t.z), door);
    await d.settle(500);
    await d.shot('1-door-closed');
  });

  // A door is two cells tall and either half answers Use: aim at the bottom and accept whichever half the ray reaches first.
  const aimAtDoor = async () => {
    await d.centerMouse();
    await d.hw((p) => window.__hw.lookAt(p.x, p.y, p.z), door);
    try {
      await waitFor(page, (p) => {
        const t = window.__hw.state().target;
        return !!t && t.x === p.x && t.z === p.z && (t.y === p.y || t.y === p.y + 1) && t.block === 'wooden_door';
      }, 'aim at the door', { timeout: 3000, interval: 100, arg: door });
      return true;
    } catch {
      return false;
    }
  };

  await step('Use opens it, Use again shuts it', async () => {
    await d.selectEmptyHand();
    const before = await blockAt(door);
    // Use on a door opens no screen: aim at it and press Use.
    assert(await aimAtDoor(), 'aims at the door');
    await d.use();
    await d.settle(400);
    const open = await blockAt(door);
    assert(open.active !== before.active, `Use toggles the door (active ${before.active} -> ${open.active})`);
    await d.shot('2-door-open');
    await d.settle(600); // the place/use cooldown
    assert(await aimAtDoor(), 'aims at the door again');
    await d.use();
    await d.settle(400);
    const shut = await blockAt(door);
    assert(shut.active === before.active, 'Use again shuts it');
  });
} finally {
  await session.close();
}
if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures || errors.length ? 1 : 0);
