/** Entry point: mounts Hearthwatt into #app. Everything else starts in src/app/app.ts. */
import { App } from './app/app';

function boot(): void {
  const host = document.getElementById('app');
  if (!host) throw new Error('Hearthwatt: the page has no #app element');
  new App(host);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
