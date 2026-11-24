/** The death screen: what happened, what was kept, where the player wakes, and the Respawn button. */
import type { DamageCause } from '../../../core/gameEvents';
import { blockOf } from '../../../core/registry';
import type { ColdCause } from '../../../game/cold';
import type { GameScreen, ScreenContext } from '../../gameUI';
import { Button } from '../../kit/controls';
import { h, setText } from '../../kit/dom';
import { Window } from '../../kit/window';
import { hungerNote } from '../food';
import { AUTOMATON_GEAR_LINE, automatonDeath } from './deathText';

/** A cold death says what chilled the player (PlayerState.coldCause) and the remedy for that. */
const COLD_DEATHS: Record<ColdCause, { title: string; line: string }> = {
  night: { title: 'The cold took you', line: 'Nights drain warmth. Stay near a fire, a torch or your furnace after dark.' },
  rain: {
    title: 'The rain chilled you',
    line: 'Rain under open sky drains warmth fast. Any roof overhead keeps it off; a fire, a torch or your furnace warms you back up.',
  },
  snow: {
    title: 'The snow froze you',
    line: 'Falling snow soaks you through. Get under a roof and stand by a fire, a torch or your furnace.',
  },
  frost: {
    title: 'The frostfell froze you',
    line: 'The frostfell is cold even by day and bitter at night. Carry torches, build a fire, or wear a padded coat.',
  },
  water: { title: 'The cold water took you', line: 'Cold water drains warmth faster than anything. Get out, and dry off by a fire.' },
};

const CAUSES: Record<DamageCause, { title: string; line: string }> = {
  cold: COLD_DEATHS.night,
  fall: { title: 'You fell too far', line: 'Anything past three blocks hurts. Dig steps down instead of jumping.' },
  lava: { title: 'Lost to the lava', line: 'Lava burns fast. Watch the glow in deep caves and keep a block in hand to seal it.' },
  drown: { title: 'You drowned', line: 'Fifteen seconds of breath under water. Watch the air bar and surface early.' },
  radiation: { title: 'Radiation sickness', line: 'Pitchblende and hot piles poison slowly. A shield suit cuts the dose tenfold.' },
  explosion: { title: 'Caught in the blast', line: 'A fission pile without water melts down. Keep two water blocks beside it.' },
  burn: { title: 'You burned', line: 'Something hot was too close for too long.' },
  // Spec 19: used only when the attacker is unknown; otherwise automatonDeath names it ("Felled by a Forge Warden").
  automaton: { title: 'Felled by an automaton', line: 'Every attack is telegraphed: when the embers flare, step out of reach. Your hot furnace is safe ground.' },
  felled: { title: 'Crushed by a felled tree', line: 'Trees fall where you last struck them. Step out of the strike zone before the crown comes down.' },
  ember: { title: 'The embers caught you', line: 'An ember bolt sets you burning for a moment. Keep walls between you and a kiln sentry.' },
  hunger: {
    title: 'Hunger wore you down',
    line: 'An empty stomach drains your health. Cook meat or bake bread in the furnace, then hold it and press Use to eat.',
  },
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
  const { deathCause, coldCause, killedBy } = ctx.player;
  const killed = automatonDeath(deathCause, killedBy);
  const cause = killed ?? (deathCause === 'cold' && coldCause ? COLD_DEATHS[coldCause] : CAUSES[deathCause ?? 'burn']);
  const fought = deathCause === 'automaton' || deathCause === 'ember';
  const starving = hungerNote(ctx.player.deathCause, ctx.player.food);
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
    fought ? h('p', { class: 'hw-death__line', text: AUTOMATON_GEAR_LINE }) : null,
    starving ? h('p', { class: 'hw-death__line hw-death__hunger', text: starving }) : null,
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
