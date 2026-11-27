// Phone check of the Saves section in the title's Settings: back up the world to a file, lose the browser's storage,
// restore the file, and continue the same world.
import { join, resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { ensureBuilt, e2eDist } from './lib/e2eArgs.mjs';

const root = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-saves');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);
const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const { assert } = report;
const shot = (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) });
const openSavesSettings = async () => {
  await page.locator('.hw-title button', { hasText: 'Settings' }).click();
  await page.waitForSelector('.hw-settings');
  await page.locator('.hw-saves__status').scrollIntoViewIfNeeded();
};

try {
  await report.step('a world is played and saved', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'backup');
    await page.locator('.hw-title button', { hasText: 'New World' }).click({ delay: 50 });
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => { const p = window.__hw.state().player; window.__hw.setVoxel(Math.floor(p.x) + 3, Math.floor(p.y) + 9, Math.floor(p.z), 'stone'); });
    await page.keyboard.press('Escape');
    await page.locator('button', { hasText: 'Save and quit' }).click();
    await page.waitForSelector('.hw-title');
  });

  let file;
  await report.step('Settings > Saves downloads a backup file', async () => {
    await openSavesSettings();
    await shot('01-saves');
    const over = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert(!over, 'horizontal overflow');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.hw-settings button', { hasText: 'Download a file' }).click()]);
    file = join(shots, 'backup.json');
    await download.saveAs(file);
    const text = readFileSync(file, 'utf8');
    assert(JSON.parse(text).d.world.seedText === 'backup', 'file does not hold the world');
    assert((await page.locator('.hw-saves__status').innerText()).includes('downloads'), 'no status line');
  });

  await report.step('after the storage is wiped the file restores the world', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.hw-title');
    const buttons = await page.$$eval('.hw-title button', (b) => b.map((x) => x.textContent.trim()));
    assert(!buttons.some((t) => t.startsWith('Continue')), 'a wiped browser still offers Continue');
    await openSavesSettings();
    await page.locator('.hw-settings input[type=file]').setInputFiles(file);
    await page.waitForFunction(() => document.querySelector('.hw-saves__status')?.textContent.includes('Restored'), null, { timeout: 5000 });
    await shot('02-restored');
    await page.locator('.hw-window button[aria-label="Close"], .hw-window .hw-window__close').first().click().catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(300);
    const buttons2 = await page.$$eval('.hw-title button', (b) => b.map((x) => x.textContent.trim()));
    assert(buttons2.some((t) => t.startsWith('Continue')), `Continue missing after restore: ${buttons2}`);
  });

  await report.step('where downloads are blocked, the backup is text that can be pasted back', async () => {
    if (!(await page.locator('.hw-settings').count())) await openSavesSettings();
    await page.locator('.hw-settings button', { hasText: 'Show it as text' }).click();
    const text = await page.locator('textarea[aria-label="Backup text"]').inputValue();
    assert(JSON.parse(text).d.world.seedText === 'backup', 'the shown text is not the save');
    await shot('02b-text');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('.hw-title');
    await openSavesSettings();
    await page.locator('.hw-settings button', { hasText: 'Restore from pasted text' }).click();
    await page.locator('textarea[aria-label="Backup text to restore"]').fill('not a save');
    await page.locator('.hw-settings button', { hasText: 'Restore this text' }).click();
    assert(/not a save/.test(await page.locator('.hw-saves__status').innerText()), 'junk text was not refused');
    await page.locator('textarea[aria-label="Backup text to restore"]').fill(text);
    await page.locator('.hw-settings button', { hasText: 'Restore this text' }).click();
    await page.waitForFunction(() => document.querySelector('.hw-saves__status')?.textContent.includes('Restored'), null, { timeout: 5000 });
    await shot('02c-pasted');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  await report.step('the restored world continues with its edit', async () => {
    await page.locator('.hw-title button', { hasText: 'Continue' }).click({ delay: 50 });
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await page.waitForTimeout(800);
    const block = await page.evaluate(() => { const p = window.__hw.state().player; return window.__hw.getBlock(Math.floor(p.x) + 3, Math.floor(p.y) + 9, Math.floor(p.z)).block; });
    assert(block === 'stone', `the edit is missing after the restore: ${block}`);
  });

  await report.step('a bad file is refused and the world stays', async () => {
    await page.keyboard.press('Escape');
    await page.locator('button', { hasText: 'Save and quit' }).click();
    await page.waitForSelector('.hw-title');
    await openSavesSettings();
    const bad = join(shots, 'bad.json');
    (await import('node:fs')).writeFileSync(bad, '{"not":"a save"}');
    await page.locator('.hw-settings input[type=file]').setInputFiles(bad);
    await page.waitForFunction(() => /not a save|no saved world/.test(document.querySelector('.hw-saves__status')?.textContent ?? ''), null, { timeout: 5000 });
    await shot('03-refused');
  });

  await report.step('restoring over a world keeps the old one as the earlier save', async () => {
    await page.locator('.hw-settings input[type=file]').setInputFiles(join(shots, 'backup.json'));
    await page.waitForFunction(() => document.querySelector('.hw-saves__status')?.textContent.includes('Restored'), null, { timeout: 5000 });
    const has = await page.$$eval('.hw-settings .hw-setting__label', (l) => l.map((x) => x.textContent));
    assert(has.includes('Earlier save'), `no Earlier save row yet: ${has}`);
    await page.locator('.hw-saves__status').scrollIntoViewIfNeeded();
    await shot('04-earlier');
  });

  assert(errors.length === 0, `console errors: ${errors.join(' | ')}`);
} finally {
  await session.close();
}
if (report.failures > 0) process.exit(1);
