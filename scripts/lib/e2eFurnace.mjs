// Furnace part of scripts/e2e.mjs: fuel, light, heat, smelt, collect, forge - all through the real furnace screen.
// Setup through window.__hw: the raw materials are given, and simulation time is fast-forwarded with ticks.
import { waitFor } from './browser.mjs';

/** Index of an inventory slot among the backpack panel's slot buttons (27 pack slots first, then the hotbar). */
const bagIndex = (slot) => (slot >= 9 ? slot - 9 : 27 + slot);

async function furnace(d) {
  const s = await d.state();
  return s.furnaces[0];
}

/** Opens the backpack drawer on screens where it is a drawer (phones); a no-op beside the side column. */
async function showBag(d, open) {
  const handle = d.page.locator('.hw-window .hw-drawer__handle');
  if (!(await handle.isVisible())) return;
  const isOpen = (await d.page.locator('.hw-window .hw-drawer').getAttribute('data-open')) === 'true';
  if (isOpen !== open) await d.press(handle);
  await d.settle(200);
}

/** Picks the stack of `item` in the backpack panel and sends it with the action bar's "To <group>" button. */
async function sendFromBag(d, item, groupLabel) {
  await showBag(d, true);
  const slot = (await d.state()).inventory.find((s) => s.item === item)?.slot;
  if (slot === undefined) throw new Error(`no ${item} in the pack`);
  await d.press(d.page.locator('.hw-window .hw-drawer .hw-slot').nth(bagIndex(slot)));
  await d.press(d.page.locator('.hw-window .hw-carry button', { hasText: groupLabel }).first());
  await showBag(d, false);
}

async function openTab(d, id) {
  await d.press(d.page.locator(`.hw-window .hw-tab[data-tab="${id}"]`));
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

  await step('smelts copper ore and collects the ingot', async () => {
    await openTab(d, 'smelt');
    await sendFromBag(d, 'copper_ore', 'Crucible');
    let f = await furnace(d);
    assert(f.crucibleIn[0]?.item === 'copper_ore', `crucible holds ${JSON.stringify(f.crucibleIn[0])}`);
    // Fast-forward the fire (copper needs 700 C), a few simulated seconds at a time.
    for (let i = 0; i < 40; i++) {
      f = await furnace(d);
      if (f.crucibleOut[0]?.item === 'copper_ingot' && f.crucibleOut[0].count >= 2) break;
      await hw(() => window.__hw.tick(100));
    }
    assert(f.crucibleOut[0]?.item === 'copper_ingot', `no ingot after smelting: ${JSON.stringify(f.crucibleOut)} at ${f.tempC} C`);
    await d.settle(400);
    await d.shot('08-smelted');
    await showBag(d, false);
    await d.press(page.locator('.hw-window .hw-cru .hw-slot').nth(1));
    await d.press(page.locator('.hw-window .hw-carry button', { hasText: 'Backpack' }).first());
    await waitFor(page, () => window.__hw.state().inventory.some((s) => s.item === 'copper_ingot'), 'the ingot in the pack', { timeout: 5000, interval: 100 });
  });

  await step('forges copper wire at the furnace', async () => {
    await openTab(d, 'forge');
    const before = (await d.inventory()).copper_wire ?? 0;
    await d.make('copper_wire');
    const after = (await d.inventory()).copper_wire ?? 0;
    assert(after >= before + 3, `copper wire ${before} -> ${after}`);
    await d.shot('08b-forged');
    await d.closeScreen();
  });
}
