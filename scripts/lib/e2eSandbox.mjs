// Hostile-host checks for scripts/e2e.mjs: the page inside a sandboxed frame (storage throws, pointer lock is
// refused, alert does nothing) and a browser without WebGL2.
import { openGame, waitFor } from './browser.mjs';
import { Driver } from './e2eDriver.mjs';

/** Runs in the page before the game: storage access throws, pointer lock is refused, dialogs are counted. */
function sandboxInit() {
  const denied = () => {
    throw new DOMException('The document is sandboxed', 'SecurityError');
  };
  Object.defineProperty(window, 'localStorage', { get: denied, configurable: true });
  Object.defineProperty(window, 'sessionStorage', { get: denied, configurable: true });
  Element.prototype.requestPointerLock = function () {
    return Promise.reject(new DOMException('Pointer lock is not allowed here', 'NotAllowedError'));
  };
  // Every toast text ever shown (the storage warning appears once, on the first save, and fades after 6 s).
  window.__toastTexts = [];
  new MutationObserver(() => {
    for (const el of document.querySelectorAll('.hw-toast')) {
      const text = el.textContent ?? '';
      if (!window.__toastTexts.includes(text)) window.__toastTexts.push(text);
    }
  }).observe(document, { childList: true, subtree: true, characterData: true });
  window.__dialogs = 0;
  window.alert = window.confirm = window.prompt = () => {
    window.__dialogs++;
  };
}

function noWebGL2Init() {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    return type === 'webgl2' ? null : original.call(this, type, ...rest);
  };
}

export async function sandboxChecks({ report, dir, shotDir }) {
  const { assert } = report;
  console.log('\nsandboxed frame (desktop)');
  const session = await openGame({ dir, device: 'desktop', init: sandboxInit });
  const { page, errors } = session;
  const d = new Driver(page, 'desktop', (name) => page.screenshot({ path: `${shotDir}/sandbox-${name}.png` }));
  let ok = true;
  const step = async (name, run) => {
    if (!ok) return console.log(`  skip ${name}`);
    const before = report.failures;
    await report.step(name, run);
    if (report.failures !== before) ok = false;
  };
  try {
    await step('boots and starts a world without storage or pointer lock', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      const s = await d.state();
      assert(s.persistent === false, 'the save slot claims to be persistent');
      assert(s.ui.pointerLocked === false, 'pointer lock was not refused');
    });

    await step('drag-to-look turns the view when the lock is refused', async () => {
      const yaw0 = (await d.state()).player.yaw;
      const { width, height } = d.size;
      await page.mouse.move(width / 2, height / 2);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) {
        await page.mouse.move(width / 2 + i * 25, height / 2);
        await d.settle(40);
      }
      await page.mouse.up();
      await d.settle(300);
      const yaw1 = (await d.state()).player.yaw;
      assert(Math.abs(yaw1 - yaw0) > 0.2, `yaw ${yaw0} -> ${yaw1}`);
    });

    await step('holding the mouse still mines without the lock', async () => {
      // Straight down: the plant the player stands in (wild wheat grows around spawn), else the block underfoot -
      // nothing can stand between the eye and it.
      const target = await d.hw(() => {
        const p = window.__hw.state().player;
        const feet = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) };
        const plant = window.__hw.getBlock(feet.x, feet.y, feet.z);
        if (plant.block !== 'air' && !plant.solid && plant.block !== 'water') return { ...feet, block: plant.block };
        const pos = { ...feet, y: feet.y - 1 };
        const b = window.__hw.getBlock(pos.x, pos.y, pos.z);
        return b.solid && b.block !== 'corestone' ? { ...pos, block: b.block } : null;
      });
      assert(target, 'no soft block in front of the player');
      assert(await d.aimAt(target), 'cannot aim at the block');
      const broke = await d.holdMine(async () => (await d.hw((p) => window.__hw.getBlock(p.x, p.y, p.z).block, target)) !== target.block);
      assert(broke, `${target.block} did not break`);
    });

    await step('save and quit keeps the world in memory; Continue restores it', async () => {
      // The step before may have mined the block underfoot: save only once the player has landed, or the restored
      // player (position AND velocity are saved exactly) just keeps falling and "moves" a few tenths of a block.
      await waitFor(page, () => window.__hw.state().player?.onGround === true, 'the player to stand on the ground', { timeout: 15_000 });
      await d.pause();
      const before = await d.state();
      await d.press(page.locator('.hw-window button', { hasText: 'Save and quit to title' }));
      await page.waitForSelector('.hw-title button:has-text("Continue")', { timeout: 10_000 });
      const toast = (await page.evaluate(() => window.__toastTexts)).filter((t) => t.includes('cannot keep saves')).length;
      await d.shot('title');
      assert(toast > 0, 'no warning that saves do not last');
      await d.press(page.locator('.hw-title button', { hasText: 'Continue' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play after Continue', { timeout: 120_000 });
      const after = await d.state();
      const p0 = before.player;
      const p1 = after.player;
      const drift = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z);
      assert(drift < 0.05, `position not restored from memory (moved ${drift.toFixed(3)}: ${p0.x},${p0.y},${p0.z} -> ${p1.x},${p1.y},${p1.z})`);
      assert(JSON.stringify(after.inventory) === JSON.stringify(before.inventory), 'inventory not restored from memory');
    });

    await step('no dialogs and no console errors', async () => {
      const dialogs = await page.evaluate(() => window.__dialogs);
      assert(dialogs === 0, `${dialogs} alert/confirm/prompt calls`);
      assert(errors.length === 0, `console errors: ${errors.slice(0, 5).join(' | ')}`);
    });
  } finally {
    await session.close();
  }

  console.log('\nno WebGL2 (phonePortrait)');
  const bare = await openGame({ dir, device: 'phonePortrait', init: noWebGL2Init });
  try {
    await report.step('shows the friendly full-screen message', async () => {
      await bare.page.waitForSelector('.hw-notice', { timeout: 30_000 });
      const text = await bare.page.locator('.hw-notice').textContent();
      assert(/WebGL2/.test(text ?? ''), `unexpected notice: ${text}`);
      assert((await bare.page.locator('.hw-title').count()) === 0, 'the title screen is shown anyway');
      await bare.page.screenshot({ path: `${shotDir}/no-webgl2.png` });
      assert(bare.errors.length === 0, `console errors: ${bare.errors.join(' | ')}`);
    });
  } finally {
    await bare.close();
  }
}
