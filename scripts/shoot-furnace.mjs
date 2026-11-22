// Ad-hoc: screenshots of the furnace screen in a Bronze Furnace world. node scripts/shoot-furnace.mjs <dist> <outDir> [tab...]
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { openGame, waitFor } from './lib/browser.mjs';
const [dist, out, ...tabs] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const wanted = tabs.length ? tabs : ['smelt', 'forge', 'upgrade'];
for (const device of ['phonePortrait', 'phoneLandscape', 'desktop']) {
  const s = await openGame({ dir: resolve(dist), device });
  const { page } = s;
  await page.waitForSelector('.hw-title', { timeout: 30000 });
  await page.fill('.hw-title input', 'shoot');
  await page.locator('.hw-title button', { hasText: 'New World' }).click();
  await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120000 });
  await page.waitForTimeout(1200);
  const pos = await page.evaluate(() => {
    const hw = window.__hw; const p = hw.state().player;
    const x = Math.floor(p.x) + 2, z = Math.floor(p.z), y = hw.surfaceY(x, z);
    hw.setVoxel(x, y, z, 'furnace_bronze', 0, false);
    for (const [k, n] of [['charcoal', 20], ['coal', 10], ['copper_ore', 6], ['tin_ore', 4], ['iron_ore', 6], ['bronze_ingot', 12], ['firebrick', 8], ['bellows', 1], ['ingot_mould', 2], ['clay', 6], ['iron_ingot', 6], ['plank', 20], ['stick', 10], ['cobblestone', 20], ['oak_log', 10], ['raw_mutton', 4], ['potato', 4]]) { try { hw.give(k, n); } catch {} }
    return { x, y, z };
  });
  await page.evaluate((c) => window.__hw.open({ type: 'furnace', ...c }), pos);
  await page.waitForTimeout(600);
  // fuel + light + heat + smelt copper
  await page.evaluate((c) => {
    const g = window.__hw.app.game; const sim = g.state.sim;
    const slots = sim.furnaceSlots(c.x, c.y, c.z);
    slots.fuel.add('charcoal', 8); slots.crucibleIn.add('copper_ore', 2);
    sim.light(c.x, c.y, c.z);
  }, pos);
  for (let i = 0; i < 60; i++) await page.evaluate(() => window.__hw.tick(100));
  await page.evaluate((c) => { const sim = window.__hw.app.game.state.sim; sim.furnaceSlots(c.x, c.y, c.z).crucibleIn.add('copper_ore', 2); window.__hw.tick(60); }, pos);
  await page.waitForTimeout(800);
  const count = await page.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && !el.closest('[hidden]'); };
    const q = (sel) => [...document.querySelectorAll('.hw-window ' + sel)].filter(vis).length;
    return { controls: q('button'), badges: q('.hw-badge, .hw-tab__badge, .hw-chip__count'), chips: q('.hw-ingr'), slots: q('.hw-slot') };
  });
  console.log(device, JSON.stringify(count));
  const shot = (n) => page.screenshot({ path: join(out, `${device}-${n}.png`) });
  for (const t of wanted) {
    if (t === 'upgrade') { await page.locator('.hw-window .hw-upg-btn').click(); await page.waitForTimeout(700); await shot('upgrade'); await page.keyboard.press('Escape'); await page.waitForTimeout(300); continue; }
    if (t === 'page') { await shot('page'); continue; }
    if (t === 'all') { await page.locator('.hw-window .hw-recipes__mode .hw-chip', { hasText: 'Everything' }).click(); await page.waitForTimeout(400); await shot('all'); continue; }
    await page.locator(`.hw-window .hw-fx__float [data-sheet="${t}"]`).click().catch(() => {});
    await page.waitForTimeout(600);
    await shot(t);
    await page.locator('.hw-window .hw-fx__sheet:not([hidden]) button', { hasText: 'Back' }).click().catch(() => {});
  }
  await s.close();
}
