// Browser check of the camp a new world starts in (headless Chromium, real input):
//
//   node scripts/e2e-camp.mjs --out=<dir-with-a-build>   (build first: node scripts/build.mjs --out=<dir>)
//   node scripts/e2e-camp.mjs --device=desktop|phonePortrait --shots=<dir>
//
// A new world opens at the camp by the spawn: Gruk is there and talkable (Use gives the wooden tools), nobody else exists, and
// there is no tavern. Screenshots of the camp. window.__hw only sets up and reads.
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
const shots = resolve(flag('shots', join(root, 'test-results/e2e-camp')));
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
// The people and camp as the game sees them right now.
const camp = () => d.hw(() => {
  const s = window.__hw.app.game.state;
  return {
    at: s.npcs.at, camp: s.npcs.camp, hasTavern: s.npcs.hasTavern,
    views: s.npcs.views().map((v) => ({ name: v.name, x: v.x, y: v.y, z: v.z })),
    pos: { x: s.player.position.x, y: s.player.position.y, z: s.player.position.z },
  };
});

try {
  await step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'camp-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(2000);
  });

  let c = null;
  await step('the world opens at the camp, with Gruk only and no tavern', async () => {
    c = await camp();
    assert(c.at, 'a camp was built');
    assert(c.camp === true && c.hasTavern === false, `camp ${c.camp}, tavern ${c.hasTavern}`);
    const names = c.views.map((v) => v.name);
    assert(names.length === 1 && names[0] === 'Gruk', `only Gruk is here (got ${names.join(', ') || 'nobody'})`);
    const dx = c.pos.x - c.at[0];
    const dz = c.pos.z - c.at[2];
    assert(dx >= 0 && dx < 9 && dz >= 0 && dz < 5, `the player stands on the camp (${dx.toFixed(1)}, ${dz.toFixed(1)})`);
    await d.shot('1-camp-start');
  });

  await step('Gruk is talkable: Use gives the wooden tools', async () => {
    const g = c.views.find((v) => v.name === 'Gruk');
    await d.hw((p) => window.__hw.teleport(p.x, p.y, p.z - 2), { x: g.x, y: g.y, z: g.z });
    await d.hw((p) => window.__hw.lookAt(p.x, p.y + 1.2, p.z), { x: g.x, y: g.y, z: g.z });
    await d.settle(400);
    await d.selectEmptyHand();
    await d.use();
    await waitFor(page, () => window.__hw.app.game.state.player.inventory.count('wooden_pickaxe') >= 1, 'wooden pickaxe in the pack', { timeout: 5000, interval: 100 });
    await d.shot('2-gruk-talk');
  });

  await step('the camp is a place to stand: the fire is lit and Gruk is by it', async () => {
    await d.settle(1500);
    const c2 = await camp();
    const fire = await d.hw((o) => window.__hw.getBlock(o.x + 5, o.y + 1, o.z + 2), { x: c2.at[0], y: c2.at[1], z: c2.at[2] });
    assert(fire.block === 'furnace_clay', `the campfire stands (got ${fire.block})`);
    // Back and up from the camp, so the cart, the fire and the bedrolls all show.
    await d.hw((o) => window.__hw.teleport(o.x + 4.5, o.y + 1, o.z - 3), { x: c2.at[0], y: c2.at[1], z: c2.at[2] });
    await d.hw((o) => window.__hw.lookAt(o.x + 4.5, o.y + 1.3, o.z + 2.5), { x: c2.at[0], y: c2.at[1], z: c2.at[2] });
    await d.settle(1200);
    await d.hw((o) => window.__hw.lookAt(o.x + 4.5, o.y + 1.3, o.z + 2.5), { x: c2.at[0], y: c2.at[1], z: c2.at[2] });
    await d.settle(800);
    await d.shot('3-camp-overview');
  });
} finally {
  await session.close();
}
if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures || errors.length ? 1 : 0);
