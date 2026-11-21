// Build script: bundles the game into dist/.
//
//   dist/game.js        the whole game (three.js included, chunk worker inlined as a string)
//   dist/index.html     standalone page - open it from any static web server
//   dist/artifact.html  the same page as a body fragment for hosts that supply their own <html> shell
//
// Flags: --watch (rebuild on change)  --serve (static server on http://localhost:5173)  --dev (no minify)
import * as esbuild from 'esbuild';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, watch } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const dev = args.has('--dev') || args.has('--watch');
const dist = join(root, 'dist');
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
  const body = template.replace('/*__GAME_CSS__*/', () => css);
  if (kind === 'artifact') return body;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
</head>
<body>
${body}
</body>
</html>
`;
}

async function buildOnce() {
  const started = Date.now();
  mkdirSync(dist, { recursive: true });
  await esbuild.build({
    entryPoints: [join(root, 'src/main.ts')],
    bundle: true,
    outfile: join(dist, 'game.js'),
    format: 'iife',
    target: 'es2020',
    minify: !dev,
    sourcemap: dev ? 'inline' : false,
    loader: { '.css': 'text' },
    plugins: [workerPlugin],
    logLevel: 'warning',
    define: { __DEV__: JSON.stringify(dev) },
  });
  writeFileSync(join(dist, 'index.html'), page('standalone'));
  writeFileSync(join(dist, 'artifact.html'), page('artifact'));
  console.log(`built dist/ in ${Date.now() - started} ms`);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

export function serve(port = 5173) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const file = resolve(dist, rel);
    if (!file.startsWith(dist) || !existsSync(file)) {
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
    await serve(5173);
    console.log('serving dist/ on http://localhost:5173');
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
