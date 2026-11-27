// Build script: bundles the game into dist/.
//
//   dist/game.js        the whole game (three.js included, chunk worker inlined as a string)
//   dist/index.html     standalone page - open it from any static web server
//   dist/artifact.html  the same page as a body fragment for hosts that supply their own <html> shell
//
// Flags: --watch (rebuild on change)  --serve (static server on http://localhost:5173)  --dev (no minify)
//        --entry=<file.ts> --out=<dir>   bundle another entry point with the same pipeline (test harnesses)
//
// Also importable:  import { build, serve } from './scripts/build.mjs'
import * as esbuild from 'esbuild';
import { generate } from './gen-indexes.mjs';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, watch } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
generate(); // folder-registration indexes (gitignored), so a fresh checkout or worktree builds
const argv = process.argv.slice(2);
const args = new Set(argv);
const argValue = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const dev = args.has('--dev') || args.has('--watch');
// Lanes (HW_LANE=A..F|U): own build dir and dev port, so nothing collides with the main checkout's dist/ on 5173.
const lane = process.env.HW_LANE ?? '';
const LANE_PORT = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, U: 6 };
const devPort = Number(process.env.HW_PORT ?? (lane ? 5180 + (LANE_PORT[lane.toUpperCase()] ?? 7) : 5173));
const dist = resolve(argValue('out') ?? (lane ? join(root, '.cache', 'dist') : join(root, 'dist')));
const mainEntry = resolve(argValue('entry') ?? join(root, 'src/main.ts'));
const WORKER_ENTRY = join(root, 'src/world/worker.ts');

/** Bundles the chunk worker and exposes its source as the default export of `virtual:worker`. */
const workerPlugin = {
  name: 'inline-worker',
  setup(build) {
    build.onResolve({ filter: /^virtual:worker$/ }, (a) => ({ path: a.path, namespace: 'inline-worker' }));
    build.onLoad({ filter: /.*/, namespace: 'inline-worker' }, async () => {
      if (!existsSync(WORKER_ENTRY)) return { contents: 'export default "";', loader: 'js' };
      const result = await esbuild.build({
        entryPoints: [WORKER_ENTRY],
        bundle: true,
        write: false,
        format: 'iife',
        target: 'es2020',
        minify: !dev,
        logLevel: 'warning',
      });
      return {
        contents: `export default ${JSON.stringify(result.outputFiles[0].text)};`,
        loader: 'js',
        watchDirs: [join(root, 'src')],
      };
    });
  },
};

function page(kind) {
  const template = readFileSync(join(root, 'src/page.html'), 'utf8');
  const cssPath = join(root, 'src/ui/styles.css');
  const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : '';
  const [head, body] = template.replace('/*__GAME_CSS__*/', () => css).split('<!--BODY-->');
  // Hosts that wrap the page in their own document get one fragment: head content first, then the body.
  if (kind === 'artifact') return `${head.trim()}\n${body.trim()}\n`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
${head.trim()}
</head>
<body>
${body.trim()}
</body>
</html>
`;
}

/**
 * Bundles `entry` into `outDir/game.js` and writes the page shell next to it.
 * Defaults build the real game into dist/.
 */
export async function build({ entry = mainEntry, outDir = dist, minify = !dev, quiet = false } = {}) {
  const started = Date.now();
  mkdirSync(outDir, { recursive: true });
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: join(outDir, 'game.js'),
    format: 'iife',
    target: 'es2020',
    minify,
    sourcemap: minify ? false : 'inline',
    loader: { '.css': 'text', '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.webp': 'dataurl' },
    plugins: [workerPlugin],
    logLevel: 'warning',
    absWorkingDir: root,
    nodePaths: [join(root, 'node_modules')],
    define: { __DEV__: JSON.stringify(!minify) },
  });
  writeFileSync(join(outDir, 'index.html'), page('standalone'));
  writeFileSync(join(outDir, 'artifact.html'), page('artifact'));
  if (!quiet) console.log(`built ${outDir} in ${Date.now() - started} ms`);
}
const buildOnce = () => build();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

/** Serves a directory (default dist/) over http. Port 0 picks a free port: read it from server.address().port. */
export function serve(port = 5173, dir = dist) {
  const base = resolve(dir);
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const file = resolve(base, rel);
    if (!file.startsWith(base) || !existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await buildOnce();
  if (args.has('--serve')) {
    await serve(devPort);
    console.log(`serving ${dist} on http://localhost:${devPort}`);
  }
  if (args.has('--watch')) {
    let timer = null;
    watch(join(root, 'src'), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => buildOnce().catch((e) => console.error(e.message)), 120);
    });
    console.log('watching src/ ...');
  }
}
