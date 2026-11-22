/** The home compass: a needle towards the home furnace relative to the view, its distance, and whether it is hot. */
import { FURNACE_HOT_C } from '../../core/constants';
import { MAX_FURNACE_TIER, furnaceTier } from '../../core/registry';
import type { PlayerState } from '../../game/playerState';
import { h, setAttr, setFlag, setText } from '../kit/dom';
import { heatColor, heatTextColor } from '../kit/format';
import { glyph } from '../kit/icons';
import { relativeBearing } from './hudMath';
import type { UIFurnaceState } from './query';

const DEG = 180 / Math.PI;

export class Compass {
  readonly el: HTMLDivElement;
  private readonly needle: HTMLSpanElement;
  private readonly distEl: HTMLSpanElement;
  private readonly tempEl: HTMLSpanElement;
  private shownAngle = Number.NaN;
  private shownTemp = '';

  constructor() {
    this.needle = h('span', { class: 'hw-compass__needle' }, glyph('needle', 16));
    this.distEl = h('span', { class: 'hw-compass__dist hw-num' });
    this.tempEl = h('span', { class: 'hw-compass__temp hw-num' });
    this.el = h(
      'div',
      { class: 'hw-compass hw-hud-plate', attrs: { role: 'img', 'aria-label': 'Home furnace' } },
      h('span', { class: 'hw-compass__dial' }, this.needle, h('span', { class: 'hw-compass__home' }, glyph('home', 9))),
      h('span', { class: 'hw-compass__text' }, this.distEl, this.tempEl),
    );
    this.el.hidden = true;
  }

  /** Every frame: the needle follows the view. */
  aim(player: PlayerState): void {
    const home = player.home;
    if (!home || this.el.hidden) return;
    const angle = Math.round(relativeBearing(player.position.x, player.position.z, player.yaw, home.x + 0.5, home.z + 0.5) * DEG);
    if (angle === this.shownAngle) return;
    this.shownAngle = angle;
    this.needle.style.transform = `rotate(${angle}deg)`;
  }

  /** A few times per second: distance and the furnace's state. */
  update(player: PlayerState, furnace: UIFurnaceState | null): void {
    const home = player.home;
    this.el.hidden = home === null;
    if (!home) return;
    const dx = home.x + 0.5 - player.position.x;
    const dz = home.z + 0.5 - player.position.z;
    const dist = Math.round(Math.hypot(dx, dz));
    setText(this.distEl, dist < 2 ? 'here' : `${dist} m`);
    const hot = furnace !== null && (furnace.ignited || furnace.tempC >= FURNACE_HOT_C);
    const tempText = furnace === null ? 'gone' : hot ? `${Math.round(furnace.tempC)}°` : 'cold';
    if (tempText !== this.shownTemp) {
      this.shownTemp = tempText;
      setText(this.tempEl, tempText);
      this.tempEl.style.color = hot && furnace ? heatTextColor(furnace.tempC) : '';
      this.el.style.setProperty('--hw-home-heat', hot && furnace ? heatColor(Math.max(500, furnace.tempC)) : 'var(--hw-iron-3)');
    }
    const name = furnace ? furnaceTier(Math.min(MAX_FURNACE_TIER, Math.max(1, furnace.tier))).name : 'Furnace';
    setAttr(this.el, 'aria-label', `Home: ${name}, ${dist} m away, ${furnace === null ? 'missing' : hot ? `${Math.round(furnace.tempC)} °C` : 'cold'}`);
    setFlag(this.el, 'hot', hot);
    this.aim(player);
  }
}
