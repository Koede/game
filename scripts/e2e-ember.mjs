// End-to-end check of the Emberbound (spec 19: hostile automatons, combat, warm zones, difficulty, death screen) in
// the built game (headless Chromium), on desktop and phone portrait:
//
//   node scripts/e2e-ember.mjs                    build, then run desktop and phonePortrait
//   node scripts/e2e-ember.mjs --no-build         use the existing dist/
//   node scripts/e2e-ember.mjs --device=desktop   (desktop, phonePortrait, phoneLandscape)
//   node scripts/e2e-ember.mjs --shots=<dir>      screenshots (default test-results/e2e-ember)
//
// Every action under test uses real input (mouse / keys on desktop, taps and press-and-hold on the phone, the real
// screens). window.__hw only sets things up (give, teleport, aim, time, a level strip, the automaton placed, ticks) and reads state.
// Exit code 1 when any step fails. `npm run e2e` runs this after scripts/e2e-tech.mjs.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';
import { emberSteps } from './lib/e2eEmber.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name) => argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const devices = flag('device').length ? flag('device') : ['desktop', 'phonePortrait'];
const shots = resolve(flag('shots')[0] ?? join(root, 'test-results/e2e-ember'));
const SEED = 'hearth-e2e';

mkdirSync(shots, { recursive: true });
for (const file of readdirSync(shots)) if (file.endsWith('.png')) rmSync(join(shots, file));
if (!argv.includes('--no-build')) await build({ quiet: true });

const report = createReporter();
for (const device of devices) {
  console.log(`\n${device} (ember)`);
  await runDevice(device);
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);

async function runDevice(device) {
  const session = await openGame({ dir: join(root, 'dist'), device });
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

  try {
    await step('a new world loads into play', async () => {
      await page.waitForSelector('.hw-title', { timeout: 30_000 });
      await page.fill('.hw-title input', SEED);
      await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
      await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
      await d.settle(1500);
      assert(errors.length === 0, `console errors: ${errors.join(' | ')}`);
    });

    await emberSteps({ d, step, assert, page });

    await step('no console errors during the run', async () => {
      assert(errors.length === 0, `console errors: ${errors.slice(0, 5).join(' | ')}`);
    });
  } finally {
    await session.close();
  }
}
