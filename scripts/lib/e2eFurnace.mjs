// Furnace part of scripts/e2e.mjs: fuel, light, heat, smelt, collect, forge - all through the real furnace screen.
// Setup through window.__hw: the raw materials are given, and simulation time is fast-forwarded with ticks.
import { waitFor } from './browser.mjs';

/** Index of an inventory slot among the backpack panel's slot buttons (27 pack slots first, then the hotbar). */
export const bagIndex = (slot) => (slot >= 9 ? slot - 9 : 27 + slot);

async function furnace(d) {
  const s = await d.state();
  return s.furnaces[0];
}

/** Opens the backpack drawer on screens where it is a drawer (phones); a no-op beside the side column. */
export async function showBag(d, open) {
  const handle = d.page.locator('.hw-window .hw-drawer__handle');
  if (!(await handle.isVisible())) return;
  const isOpen = (await d.page.locator('.hw-window .hw-drawer').getAttribute('data-open')) === 'true';
  if (isOpen !== open) await d.press(handle);
  await d.settle(200);
}

/** Picks the stack of `item` in the backpack panel and sends it with the action bar's "To <group>" button. */
export async function sendFromBag(d, item, groupLabel) {
  await showBag(d, true);
  const slot = (await d.state()).inventory.find((s) => s.item === item)?.slot;
  if (slot === undefined) throw new Error(`no ${item} in the pack`);
  await d.press(d.page.locator('.hw-window .hw-drawer .hw-slot').nth(bagIndex(slot)));
  await d.press(d.page.locator('.hw-window .hw-carry button', { hasText: groupLabel }).first());
  await showBag(d, false);
}

/**
 * The furnace is one page with no tabs. 'smelt' and 'forge' just make sure no sheet covers it (the crucibles and the
 * make list are both on the page); 'structure', 'grid' and 'log' press their floating button on the right edge.
 */
export async function openTab(d, id) {
  const back = d.page.locator('.hw-window .hw-fx__sheet:not([hidden]) button', { hasText: 'Back' });
  if (await back.isVisible()) await d.press(back);
  if (id === 'structure' || id === 'grid' || id === 'log') await d.press(d.page.locator(`.hw-window .hw-fx__float [data-sheet="${id}"]`));
  await d.settle(250);
}

export async function furnaceSteps({ d, step, assert, hw, page }) {
  await step('opens the furnace and loads fuel into the firebox', async () => {
    await hw(() => {
      window.__hw.give('charcoal', 8);
      window.__hw.give('copper_ore', 2);
    });
    await d.useBlock(d.places.furnace);
    await d.waitScreen('furnace');
    await d.shot('06-furnace-cold');
    await sendFromBag(d, 'charcoal', 'Firebox');
    const f = await furnace(d);
    const fuel = f.fuel.reduce((n, s) => n + (s?.item === 'charcoal' ? s.count : 0), 0);
    assert(fuel === 8, `the firebox holds ${fuel} charcoal`);
  });

  await step('lights it and the temperature rises', async () => {
    await d.press(page.locator('.hw-window .hw-fbx__btns button', { hasText: 'Light' }));
    await waitFor(page, () => window.__hw.state().furnaces[0].lit, 'the fire to catch', { timeout: 5000, interval: 100 });
    const t0 = (await furnace(d)).tempC;
    await d.settle(3000);
    const t1 = (await furnace(d)).tempC;
    assert(t1 > t0 + 5, `temperature went from ${t0} to ${t1} C in 3 s`);
    await d.press(page.locator('.hw-window .hw-fbx__btns button', { hasText: 'Pump' }));
    await d.settle(600);
    await d.shot('07-furnace-lit');
  });

  await step('smelts copper ore into molten metal and pours it into a mould', async () => {
    await hw(() => window.__hw.give('ingot_mould', 1));
    await openTab(d, 'smelt');
    await sendFromBag(d, 'copper_ore', 'Crucible');
    let f = await furnace(d);
    assert(f.crucibleIn[0]?.item === 'copper_ore', `crucible holds ${JSON.stringify(f.crucibleIn[0])}`);
    // Fast-forward the fire (copper needs 700 C), a few simulated seconds at a time; stop with both ingots molten.
    for (let i = 0; i < 40; i++) {
      f = await furnace(d);
      if (f.crucibleMelt[0]?.item === 'copper_ingot' && f.crucibleMelt[0].count >= 2) break;
      await hw(() => window.__hw.tick(100));
    }
    assert(f.crucibleMelt[0]?.item === 'copper_ingot', `no molten copper: ${JSON.stringify(f.crucibleMelt)} at ${f.tempC} C`);
    assert(f.crucibleOut[0] === null, 'the metal is molten, not an ingot in the output slot');
    await d.settle(400);
    await d.shot('08-molten');
    const pour = page.locator('.hw-window .hw-cru__pour button', { hasText: 'Pour into Ingot Mould' });
    assert(await pour.isVisible(), 'the pour button is shown');
    await d.press(pour);
    await waitFor(page, () => window.__hw.state().inventory.some((s) => s.item === 'copper_ingot' && s.count >= 2), 'the cast ingots in the pack', { timeout: 5000, interval: 100 });
    await d.settle(300);
    await d.shot('08c-poured');
  });

  await step('metal left unpoured cools into a bloom', async () => {
    await hw(() => window.__hw.give('copper_ore', 1));
    await sendFromBag(d, 'copper_ore', 'Crucible');
    for (let i = 0; i < 40; i++) {
      const f = await furnace(d);
      if (f.crucibleMelt[0]) break;
      await hw(() => window.__hw.tick(100));
    }
    await hw(() => window.__hw.tick(420));
    await d.settle(400);
    const f = await furnace(d);
    assert(f.crucibleOut[0]?.item === 'copper_bloom', `the output is ${JSON.stringify(f.crucibleOut[0])}`);
    await d.shot('08d-bloom');
  });

  await step('forges a mortar at the furnace', async () => {
    await hw(() => window.__hw.give('clay', 1));
    await openTab(d, 'forge');
    const before = (await d.inventory()).mortar ?? 0;
    await d.make('mortar');
    const after = (await d.inventory()).mortar ?? 0;
    assert(after >= before + 1, `mortar ${before} -> ${after}`);
    await d.shot('08b-forged');
    await d.closeScreen();
  });

  // BRONZE_PLAN W0: the Clay Furnace is rebuilt as the single-block Bronze Furnace through the real upgrade sheet (no hearth needed).
  await step('the upgrade sheet offers the Bronze Furnace and holding its button rebuilds the furnace in place', async () => {
    await hw(() => {
      window.__hw.give('bronze_ingot', 8);
      window.__hw.give('firebrick', 4);
      window.__hw.give('bellows', 1);
      window.__hw.give('charcoal', 6);
    });
    await d.useBlock(d.places.furnace);
    await d.waitScreen('furnace');
    await sendFromBag(d, 'charcoal', 'Firebox');
    if (!(await furnace(d)).lit) await d.press(page.locator('.hw-window .hw-fbx__btns button', { hasText: 'Light' }));
    for (let i = 0; i < 60 && (await furnace(d)).tempC < 760; i++) await hw(() => window.__hw.tick(100));
    const t = (await furnace(d)).tempC;
    assert(t >= 700, `the furnace is only ${t} C`);
    await d.press(page.locator('.hw-window .hw-upg-btn'));
    // The sheet fills on the next UI refresh after it opens, so wait for its text instead of reading it the instant after the tap.
    await waitFor(page, () => (document.querySelector('.hw-window .hw-upg__kicker')?.textContent ?? '').trim().length > 0, 'the upgrade sheet to fill', { timeout: 5000, interval: 50 });
    const kicker = await page.locator('.hw-window .hw-upg__kicker').textContent();
    assert(/Bronze Age - tier 2/.test(kicker), `the upgrade sheet says "${kicker}"`);
    const rows = await page.locator('.hw-window .hw-upg__table tbody tr').allTextContents();
    assert(rows.some((r) => /Max temperature/.test(r) && /1100/.test(r)), `the table: ${rows.join(' | ')}`);
    await d.shot('08e-bronze-upgrade');
    const go = page.locator('.hw-window .hw-upg__btns button', { hasText: 'Upgrade to the Bronze Furnace' });
    const box = await go.boundingBox();
    assert(box, 'no Upgrade to the Bronze Furnace button');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await d.settle(1100);
    await page.mouse.up();
    await waitFor(page, () => window.__hw.state().furnaces[0].tier === 2, 'the furnace to become tier 2', { timeout: 6000, interval: 100 });
    const block = await d.hw((c) => window.__hw.getBlock(c.x, c.y, c.z).block, d.places.furnace);
    assert(block === 'furnace_bronze', `the block is ${block}`);
    await d.settle(400);
    await d.shot('08f-bronze-furnace');
    await d.closeScreen();
  });
}
