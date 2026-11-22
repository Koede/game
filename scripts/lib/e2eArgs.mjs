// Shared e2e argument handling: where the build goes and whether to build.
//   --dist=<dir> | --out=<dir>   build output / existing build (default: <worktree>/.cache/dist-e2e - per worktree, never dist/, never a fixed tmp dir)
//   --no-build                   use what is in that directory
// A lane's e2e therefore never touches the main checkout's dist/ (the owner serves that) nor another lane's build.
import { join, resolve } from 'node:path';
import { build } from '../build.mjs';

const arg = (argv, name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

/** The directory the e2e uses for the built game. */
export function e2eDist(root, argv) {
  return resolve(arg(argv, 'dist') ?? arg(argv, 'out') ?? join(root, '.cache', 'dist-e2e'));
}

/** Builds into `dist` unless --no-build was given. */
export async function ensureBuilt(argv, dist) {
  if (!argv.includes('--no-build')) await build({ quiet: true, outDir: dist });
}
