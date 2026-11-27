// End-to-end check of menu search: the pause menu (pages + search across pages and How to Play), How to Play's own search,
// and the Field Notebook (three tabs, search, status filters), on desktop and phone portrait.
//
//   node scripts/e2e-menus.mjs [--no-build] [--dist=<dir>] [--device=phonePortrait] [--shots=<dir>]
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
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-menus'));
const dist = e2eDist(root, argv);

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
await ensureBuilt(argv, dist);

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (menus and search)`);
  await runDevice(device);
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);

async function runDevice(device) {
  const session = await openGame({ dir: dist, device });
  const { page } = session;
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
  const win = page.locator('.hw-window');
  const search = (q) => page.fill('.hw-window .hw-search input', q);
  const count = (sel) => page.locator(sel).filter({ visible: true }).count();

  try {
    await step('a new world loads into play', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', 'hearth-menus');
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
    });

    await step('the pause menu lists the pages and shows a search', async () => {
      await d.pause();
      await d.settle(300);
      assert((await count('.hw-menu__pages button[data-page="log"]')) === 1, 'Hearth Log button');
      assert((await count('.hw-menu__pages button[data-page="settings"]')) === 1, 'Settings button');
      assert((await count('.hw-menu__pages button[data-page="howto"]')) === 1, 'How to Play button');
      assert((await count('.hw-menu__pages button[data-page="notebook"]')) === 0, 'Notebook hidden until you carry one');
      await d.shot('01-pause');
    });

    await step('searching finds pages and How to Play lines; no match says so', async () => {
      await search('bellows');
      await d.settle(200);
      assert((await count('.hw-menu__result[data-result="howto-hits"]')) === 1, 'a How to Play hit for bellows');
      assert((await count('.hw-menu__pages')) === 0, 'the page list steps aside while searching');
      await d.shot('02-search-bellows');
      await search('hearth log');
      assert((await count('.hw-menu__result[data-result="log"]')) === 1, 'finds the Hearth Log by name');
      await search('difficulty');
      assert((await count('.hw-menu__result[data-result="settings"]')) === 1, 'finds Settings by what is inside');
      await search('zzzqq');
      assert((await count('.hw-menu__none')) === 1, 'a no-match note');
      await search('');
      assert((await count('.hw-menu__pages')) === 1, 'clearing brings the pages back');
    });

    await step('a How to Play hit opens the guide already filtered', async () => {
      await search('bellows');
      await d.press(page.locator('.hw-menu__result[data-result="howto-hits"]'));
      await d.settle(300);
      const left = await count('.hw-howto__step');
      assert(left >= 1 && left <= 4, `only the matching lines stay (${left})`);
      assert((await page.inputValue('.hw-howto .hw-search input')) === 'bellows', 'the query is in the guide search');
      await d.shot('03-howto-filtered');
      await search('');
      assert((await count('.hw-howto__step')) > 10, 'clearing shows the whole guide');
      await search('zzzqq');
      assert((await count('.hw-howto__none')) === 1, 'guide no-match note');
      await d.press(win.locator('button', { hasText: 'Back' }).first());
    });

    await step('a page result opens that page', async () => {
      await search('forecast');
      await d.press(page.locator('.hw-menu__result[data-result="log"]'));
      await waitFor(page, () => !!document.querySelector('.hw-log'), 'the Hearth Log', { timeout: 5000, interval: 100 });
      await d.shot('04-log-from-search');
      await d.closeScreen();
      await waitFor(page, () => document.querySelectorAll('.hw-window').length === 0, 'closed', { timeout: 5000, interval: 100 });
    });

    await step('the notebook has three tabs, searches research and lore, and filters by status', async () => {
      await d.hw(() => window.__hw.give('field_notebook', 1));
      await d.pause();
      assert((await count('.hw-menu__pages button[data-page="notebook"]')) === 1, 'Notebook shows once carried');
      await d.press(page.locator('.hw-menu__pages button[data-page="notebook"]'));
      await page.waitForSelector('.hw-nb', { timeout: 5000 });
      await d.settle(300);
      const tabs = await page.locator('.hw-window .hw-tabs button').allTextContents();
      assert(tabs.length === 3 && /Research/.test(tabs[0]) && /Lore/.test(tabs[1]) && /Goals/.test(tabs[2]), `tabs: ${tabs.join('|')}`);
      await d.shot('05-notebook');
      const all = await count('.hw-nb__filters button, .hw-nb__agebtn[data-filter]');
      assert(all >= 2, 'status filter chips');
      await d.press(page.locator('.hw-nb__agebtn[data-filter="open"]'));
      await d.settle(200);
      const open = await count('.hw-nb__hit');
      assert(open >= 1, `ready research listed (${open})`);
      await d.shot('06-notebook-ready');
      await d.press(page.locator('.hw-nb__agebtn[data-filter="all"]'));
      await search('a');
      const hits = await count('.hw-nb__hit');
      assert(hits >= 1, `search hits (${hits})`);
      await search('zzzqq');
      assert((await page.locator('.hw-nb__find').innerText()).includes('No research matches'), 'no-match note');
      await search('');
      await d.press(win.locator('.hw-tabs button', { hasText: 'Lore' }));
      await d.settle(200);
      assert((await page.locator('.hw-nb').first().innerText()).toLowerCase().includes('aspects'), 'Lore shows aspects');
      await search('zzzqq');
      assert((await page.locator('.hw-nb').first().innerText()).includes('No known aspect matches'), 'lore no match');
      await search('');
      await d.shot('07-lore');
      await d.press(win.locator('.hw-tabs button', { hasText: 'Goals' }));
      await d.settle(200);
      await search('zzzqq');
      assert((await page.locator('.hw-nb').first().innerText()).includes('No goal matches'), 'goals no match');
      await d.shot('08-goals-search');
    });
  } catch (err) {
    report.failures++;
    console.log(`  FAIL ${err instanceof Error ? err.stack ?? err.message : err}`);
  } finally {
    await session.close();
  }
}
