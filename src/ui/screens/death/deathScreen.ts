/** The death screen: what happened, what was kept, where the player wakes, and the Respawn button. */
import type { DamageCause } from '../../../core/gameEvents';
import { blockOf } from '../../../core/registry';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Button } from '../../kit/controls';
import { h, setText } from '../../kit/dom';
import { Window } from '../../kit/window';

const CAUSES: Record<DamageCause, { title: string; line: string }> = {
  cold: { title: 'The cold took you', line: 'Nights drain warmth. Stay near a fire, a torch or your furnace after dark.' },
  fall: { title: 'You fell too far', line: 'Anything past three blocks hurts. Dig steps down instead of jumping.' },
  lava: { title: 'Lost to the lava', line: 'Lava burns fast. Watch the glow in deep caves and keep a block in hand to seal it.' },
  drown: { title: 'You drowned', line: 'Fifteen seconds of breath under water. Watch the air bar and surface early.' },
  radiation: { title: 'Radiation sickness', line: 'Pitchblende and hot piles poison slowly. A shield suit cuts the dose tenfold.' },
  explosion: { title: 'Caught in the blast', line: 'A fission pile without water melts down. Keep two water blocks beside it.' },
  burn: { title: 'You burned', line: 'Something hot was too close for too long.' },
};

export function wakeText(ctx: ScreenContext): string {
  const home = ctx.player.home;
  const furnace = home ? ctx.world.getEntity(home.x, home.y, home.z) : undefined;
  if (!home || furnace?.kind !== 'furnace') return 'You will wake where you first arrived in this world. Build a furnace to make a home.';
  const name = blockOf(ctx.world.getVoxel(home.x, home.y, home.z)).name;
  return ctx.survival.homeIsHot()
    ? `You will wake beside your ${name}. Its fire is burning: full health.`
    : `You will wake beside your ${name}. It has gone cold: half health. Light it again.`;
}

export function createDeathScreen(ctx: ScreenContext, respawn: () => void): GameScreen {
  const cause = CAUSES[ctx.player.deathCause ?? 'burn'];
  const wake = h('p', { class: 'hw-death__wake' });
  const deaths = h('p', { class: 'hw-death__count hw-num' });
  const button = new Button({
    label: 'Respawn',
    kind: 'primary',
    size: 'lg',
    block: true,
    icon: 'play',
    onClick: () => {
      respawn();
      ctx.close();
    },
  });
  const body = h(
    'div',
    { class: 'hw-death' },
    h('p', { class: 'hw-death__line', text: cause.line }),
    h('p', { class: 'hw-death__kept', text: 'Your pack is safe: everything you carried is still with you.' }),
    wake,
    button.el,
    deaths,
  );
  const window = new Window({ title: cause.title, size: 'sm', closable: false, body });
  window.frame.classList.add('hw-window--death');
  window.setAccent('var(--hw-bad)');
  return {
    window,
    refresh: () => {
      setText(wake, wakeText(ctx));
      const n = ctx.player.stats.deaths;
      setText(deaths, n > 1 ? `Deaths so far: ${n}` : '');
      deaths.hidden = n <= 1;
    },
    dispose: () => button.dispose(),
  };
}
