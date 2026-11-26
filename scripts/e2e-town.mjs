// Browser check of Gruk's town (headless Chromium, real input where it matters):
//
//   node scripts/e2e-town.mjs --out=<dir-with-a-build>   (build first: node scripts/build.mjs --out=<dir>)
//   node scripts/e2e-town.mjs --device=desktop|phonePortrait --shots=<dir>
//
// A new world. The site is walked to, the build board is placed in the storage bay, and the first bounty is handed in with Use and
// the items in hand. Days are skipped with setDay (window.__hw) and the bounties are handed in again, until the storage bay stands
// and the first cottage frame is up. Then the bay's crate is opened with Use. window.__hw only sets up and reads.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
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
const shots = resolve(flag('shots', join(root, 'test-results/e2e-town')));
mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));

const report = createReporter();
const session = await openGame({ dir, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
const town = () => d.hw(() => window.__hw.town());
const teleport = (p) => d.hw((t) => window.__hw.teleport(t.x, t.y, t.z), p);
const surfaceAt = (x, z) => d.hw((c) => window.__hw.surfaceY(c.x, c.z), { x, z });
/** Counts `block` in a box (inclusive corners), read in the page. */
const countIn = (box, block) => d.hw((b) => {
  let n = 0;
  for (let x = b.x0; x <= b.x1; x++) for (let y = b.y0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) if (window.__hw.getBlock(x, y, z).block === b.block) n++;
  return n;
}, { ...box, block });

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

/**
 * Hands in the first bounty on the board, again and again while the board takes them: the held stack is the bounty's item, Use
 * on the board. Returns what each hand-in did (coin paid, and whether the bounty moved).
 */
async function handInAll(maxRounds = 8) {
  const handed = [];
  for (let i = 0; i < maxRounds; i++) {
    const t = await town();
    const b = t?.board.bounties[0];
    if (!t?.board.placed || !b) break;
    const coinBefore = t.coins;
    await d.hw((x) => window.__hw.give(x.item, x.left), b);
    await d.selectItem(b.item);
    // The walls rise round the board: stand where it can be seen, then aim.
    const stand = await standToUseBoard(t);
    assert(stand, 'a stand inside or at the front of the bay sees the board');
    await d.use();
    await d.settle(600);
    const t2 = await town();
    const after = t2.board.bounties.find((x) => x.id === b.id);
    const moved = !after || after.left < b.left;
    handed.push({ item: b.item, asked: b.left, left: after?.left ?? 0, coin: t2.coins - coinBefore, moved });
    if (!moved) break;
  }
  return handed;
}

/**
 * Stands where the board can be seen and aims at it: the bay's front first, then the cells beside the board inside the bay (the
 * floor-row sill of the front blocks a low view from outside). Returns the stand that worked, or null.
 */
async function standToUseBoard(t) {
  const sp = t.board.spot;
  const stands = [t.front, { x: sp.x - 1, y: sp.y + 1, z: sp.z }, { x: sp.x - 1, y: sp.y + 1, z: sp.z - 1 }, { x: sp.x, y: sp.y + 1, z: sp.z - 1 }].filter(Boolean);
  for (const stand of stands) {
    await teleport(stand);
    await d.settle(400);
    if (await d.aimAt(sp)) return stand;
  }
  // Posts and beams may stand in those lines: ask the driver for any spot whose eye sees the board.
  const seen = await d.standSeeing(sp);
  if (seen) {
    await teleport(seen);
    await d.settle(400);
    if (await d.aimAt(sp)) return seen;
  }
  return null;
}

try {  await step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'hearth-town');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  let site = null;
  await step('the village is planned, and the build board is placed in the storage bay before the bay stands', async () => {
    await waitFor(page, () => window.__hw.town()?.site !== null, 'a site is planned', { timeout: 60_000 });
    const t0 = await town();
    site = t0.site;
    // The bay is raised where its chunks load: walk the player to the site, then wait for the board to be placed.
    await teleport({ x: site[0], y: (await surfaceAt(site[0], site[1])) + 3, z: site[1] });
    await waitFor(page, () => window.__hw.town()?.board.placed === true, 'the board is placed', { timeout: 120_000, interval: 500 });
    const t = await town();
    assert(t.bay, 'the bay has its place once Gruk has started it');
    assert(t.board.spot && t.board.placed, `board placed at ${JSON.stringify(t.board.spot)}`);
    const onBoard = await d.hw((s) => window.__hw.getBlock(s.x, s.y, s.z).block, t.board.spot);
    assert(onBoard === 'quest_board', `the board block is in the world (got ${onBoard})`);
    console.log(`  site ${JSON.stringify(site)}, bay base ${t.bay?.base}, board ${JSON.stringify(t.board.spot)}, bounties ${t.board.bounties.length}`);
  });

  await step('the first bounty is handed in at the board by Use, with the items in hand', async () => {
    await waitFor(page, () => window.__hw.town()?.board.bounties.length > 0, 'a bounty is pinned', { timeout: 60_000, interval: 500 });
    const t = await town();
    const first = t.board.bounties[0];
    const coinBefore = t.coins;
    await d.hw((b) => window.__hw.give(b.item, b.left), first);
    await d.selectItem(first.item);
    const stand = await standToUseBoard(t);
    assert(stand, 'a stand sees the board');
    await d.use();
    await d.settle(600);
    const t2 = await town();
    const after = t2.board.bounties.find((b) => b.id === first.id);
    assert(!after || after.left < first.left, `the bounty for ${first.item} moved (${first.left} asked, ${after?.left ?? 0} left)`);
    assert(t2.coins > coinBefore, `coin was paid (${coinBefore} -> ${t2.coins})`);
    console.log(`  handed in ${first.left} ${first.item}: +${t2.coins - coinBefore} coin, town standing ${t2.rep}`);
    await d.shot('1-first-bounty');
  });

  let bayUp = false;
  let bayDay = null;
  let cottage = null;
  await step('days are skipped and the bounties handed in, until the storage bay stands and the first cottage frame is up', async () => {
    // Runs until the bay stands and twelve days more have passed (or a cottage frame shows, or day 30).
    for (let day = 2; day <= 30 && !(bayUp && cottage) && !(bayDay !== null && day - bayDay >= 12); day++) {
      await d.hw((n) => window.__hw.setDay(n), day);
      await d.settle(300);
      const handed = await handInAll(8);
      const t = await town();
      bayUp = !!t.bay && t.building !== 'storage_bay';
      if (bayUp && bayDay === null) bayDay = day;
      if (bayUp && !cottage) {
        // The next plot after the bay is the lodge or the first cottage: either one's frame shows the builder moved on.
        for (const cot of t.plan.filter((b) => b.template === 'cottage' || b.template === 'lodge')) {
          const sy = await surfaceAt(cot.x + 3, cot.z + 3);
          const n = await countIn({ x0: cot.x, x1: cot.x + 8, y0: sy - 1, y1: sy + 8, z0: cot.z, z1: cot.z + 8 }, 'oak_log');
          if (n >= 8) {
            cottage = { ...cot, logs: n };
            break;
          }
        }
      }
      console.log(`  day ${day}: progress ${JSON.stringify(t.progress)}, stock ${JSON.stringify(t.stock)}, missing ${JSON.stringify(t.missing)}, stage ${t.stage}, rep ${t.rep}`);
      console.log(`  day ${day}: ${handed.length} hand-ins, building ${t.building ?? 'none yet'}, standing ${t.rep}, waiting ${t.waiting ?? '-'}, bounties ${t.board.bounties.map((x) => `${x.left} ${x.item}`).join(', ') || '-'}`);
    }
    assert(bayUp, 'the storage bay is raised (the building in progress moved on from it)');
  });

  await step('the storage bay stands: posts, beams and roof in the world', async () => {
    const t = await town();
    const b = t.bay;
    const logs = await countIn({ x0: b.x, x1: b.x + 6, y0: b.base, y1: b.base + 2, z0: b.z, z1: b.z + 6 }, 'oak_log');
    const planks = await countIn({ x0: b.x, x1: b.x + 6, y0: b.base + 1, y1: b.base + 3, z0: b.z, z1: b.z + 6 }, 'plank');
    assert(logs >= 12, `at least 12 oak log posts and beams (got ${logs})`);
    assert(planks >= 1, `planks in its walls or roof (got ${planks})`);
    console.log(`  bay at ${b.x},${b.base},${b.z} rot ${b.rot}: ${logs} oak logs, ${planks} planks`);
    await teleport({ x: b.x - 4, y: b.base + 3, z: b.z + 2 });
    await d.settle(800);
    await d.shot('2-storage-bay');
  });

  await step('the stock crate in the bay opens with Use, and shows the stock', async () => {
    const t = await town();
    assert(t.crate, 'the bay has a stock crate');
    const around = await d.hw((c) => {
      const out = {};
      for (let y = c.y - 1; y <= c.y + 1; y++) out[y] = [-1, 0, 1].map((dx) => window.__hw.getBlock(c.x + dx, y, c.z).block).join(' ');
      return out;
    }, t.crate);
    console.log(`  crate at ${JSON.stringify(t.crate)}, blocks around (y-1..y+1, x-1..x+1): ${JSON.stringify(around)}, stock crate ${t.stock.crate ?? 0}, skips ${JSON.stringify(t.progress.skips)}`);
    const isCrate = await d.hw((c) => window.__hw.getBlock(c.x, c.y, c.z).block, t.crate);
    assert(isCrate === 'crate', `the crate block is in the world (got ${isCrate})`);
    await teleport({ x: t.crate.x - 1, y: t.crate.y + 2, z: t.crate.z });
    await d.settle(600);
    // Posts and beams may stand in the way: approach finds a stand that sees the crate.
    assert(await d.approach(t.crate), 'aims at the crate');
    await d.use();
    await d.settle(700);
    const open = (await d.state()).ui?.open;
    assert(open === 'crate', `Use opens the crate screen (ui: ${open})`);
    await d.shot('3-crate-open');
    await page.keyboard.press('Escape');
    await d.settle(400);
  });

  await step('a cottage frame is up (the first cottage plot Gruk did not skip), with a shot from the side', async () => {
    const t = await town();
    assert(cottage, `a cottage frame stands (its box holds oak logs); the builder skipped: ${JSON.stringify(t.progress.skips)}`);
    const cot = cottage;
    const sy = await surfaceAt(cot.x + 3, cot.z + 3);
    console.log(`  cottage at ${cot.x},${cot.z} (site ${JSON.stringify(t.site)}), ${cot.logs} oak logs in its frame box; skipped plots: ${JSON.stringify(t.progress.skips)}`);
    await teleport({ x: cot.x - 6, y: sy + 3, z: cot.z + 4 });
    await d.settle(600);
    await d.hw((c) => window.__hw.lookAt(c.x, c.y, c.z), { x: cot.x + 4, y: sy + 3, z: cot.z + 4 });
    await d.settle(800);
    await d.shot('4-cottage-frame');
  });
} finally {
  await session.close();
}
if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures || errors.length ? 1 : 0);
