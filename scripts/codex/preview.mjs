// Opens the built Codex in headless Chromium at 1280x800 and 390x844 and screenshots each tab.
// Usage: node scripts/codex/preview.mjs <outDir> [codexDir]   (codexDir defaults to dist-codex, built first if missing)
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { openGame } from '../lib/browser.mjs';
import { buildCodex } from './build.mjs';

const out = resolve(process.argv[2] ?? 'codex-shots');
const dir = resolve(process.argv[3] ?? 'dist-codex');
if (!existsSync(resolve(dir, 'index.html'))) await buildCodex(dir);
mkdirSync(out, { recursive: true });

const TABS = ['crafting', 'blocks', 'progression', 'items', 'essentia'];
let bad = 0;
for (const device of ['desktop', 'phonePortrait']) {
  const g = await openGame({ dir, device });
  for (const tab of TABS) {
    await g.page.evaluate((h) => { location.hash = h; scrollTo(0, 0); }, tab);
    await g.page.waitForTimeout(700);
    await g.page.screenshot({ path: `${out}/${device}-${tab}.png`, fullPage: false });
    const m = await g.page.evaluate((t) => ({
      scrollW: document.documentElement.scrollWidth, w: innerWidth,
      shown: !document.querySelector('#view-' + t).hidden,
      count: document.querySelectorAll('#view-' + t + ' :is(.recipe,.block,.node,.chip)').length,
    }), tab);
    const overflow = m.scrollW > m.w;
    if (overflow || !m.shown || !m.count) bad++;
    console.log(`${device} #${tab}: shown=${m.shown} entries=${m.count} width ${m.scrollW}/${m.w}${overflow ? ' HORIZONTAL OVERFLOW' : ''}`);
  }
  if (g.errors.length) { bad += g.errors.length; console.log(`${device} console errors:\n  ${g.errors.join('\n  ')}`); }
  await g.close();
}
console.log(bad ? `preview: ${bad} problem(s)` : 'preview: clean');
process.exitCode = bad ? 1 : 0;
