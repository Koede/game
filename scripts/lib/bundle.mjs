// Bundles TypeScript source from this repository into a temporary ES module and imports it,
// so node scripts can call game code (worldgen, texture painters, ...) directly.
import * as esbuild from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** `source` is TypeScript that may import from 'src/...' (resolved against the repository root). */
export async function importSource(source) {
  const dir = mkdtempSync(join(tmpdir(), 'hw-bundle-'));
  try {
    const outfile = join(dir, 'bundle.mjs');
    await esbuild.build({
      stdin: { contents: source, resolveDir: root, loader: 'ts', sourcefile: 'script-entry.ts' },
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'node20',
      outfile,
      logLevel: 'warning',
      alias: { src: join(root, 'src') },
    });
    return await import(pathToFileURL(outfile).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
