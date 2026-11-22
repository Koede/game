// node scripts/with-lock.mjs <label> -- <command...>   runs the command while holding the machine-wide heavy lock.
import { spawnSync } from 'node:child_process';
import { withHeavyLock } from './lib/lock.mjs';

const argv = process.argv.slice(2);
const i = argv.indexOf('--');
const label = argv[0] && i !== 0 ? argv[0] : 'job';
const cmd = argv.slice(i + 1);
if (i < 0 || cmd.length === 0) { console.error('usage: with-lock.mjs <label> -- <command...>'); process.exit(2); }
const code = await withHeavyLock(() => spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', env: { ...process.env, HW_LOCK_HELD: '1' }, shell: process.platform === 'win32' && !cmd[0].includes('/') && cmd[0] !== 'node' && cmd[0] !== 'bash' }).status ?? 1, { label });
process.exit(code);
