/** Health, warmth (with its trend), air while under water, and the Well-Warmed buff. */
import { MAX_AIR_S, MAX_HEALTH, MAX_WARMTH, WELL_WARMED_AFTER_S } from '../../core/constants';
import type { PlayerState } from '../../game/playerState';
import type { Survival } from '../../game/survival';
import { h, setAttr, setFlag, setText } from '../kit/dom';
import { glyph, type GlyphName } from '../kit/icons';

/** 252 -> "4:12". */
const clockTime = (seconds: number): string => {
  const s = Math.ceil(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

class VitalBar {
  readonly el: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly value: HTMLSpanElement;
  private shown = '';
  private shownFill = -1;

  constructor(kind: string, icon: GlyphName, label: string, extra?: HTMLElement) {
    this.fill = h('div', { class: 'hw-vital__fill' });
    this.value = h('span', { class: 'hw-vital__value hw-num' });
    this.el = h(
      'div',
      { class: 'hw-vital', attrs: { 'data-kind': kind, role: 'meter', 'aria-label': label, 'aria-valuemin': 0 } },
      h('span', { class: 'hw-vital__icon' }, glyph(icon, 14)),
      h('div', { class: 'hw-vital__track' }, this.fill),
      this.value,
      extra,
    );
  }

  set(value: number, max: number): void {
    const fraction = Math.min(1, Math.max(0, value / max));
    const rounded = Math.round(fraction * 200) / 200;
    if (rounded !== this.shownFill) {
      this.shownFill = rounded;
      this.fill.style.transform = `scaleX(${rounded})`;
    }
    const text = String(Math.ceil(Math.max(0, value)));
    if (text !== this.shown) {
      this.shown = text;
      setText(this.value, text);
      setAttr(this.el, 'aria-valuenow', text);
      setAttr(this.el, 'aria-valuemax', max);
    }
    setFlag(this.el, 'low', fraction <= 0.25);
  }
}

export class Vitals {
  readonly el: HTMLDivElement;
  private readonly health = new VitalBar('health', 'heart', 'Health');
  private readonly warmth: VitalBar;
  private readonly air = new VitalBar('air', 'air', 'Air');
  private readonly trend: HTMLSpanElement;
  private readonly buff: HTMLDivElement;
  private readonly buffText: HTMLSpanElement;
  private shownTrend = '';

  constructor() {
    this.trend = h('span', { class: 'hw-vital__trend' });
    this.warmth = new VitalBar('warmth', 'flame', 'Warmth', this.trend);
    this.buffText = h('span', { class: 'hw-buff__text hw-num' });
    this.buff = h('div', { class: 'hw-buff' }, glyph('flame', 12), this.buffText);
    this.buff.hidden = true;
    this.air.el.hidden = true;
    this.el = h('div', { class: 'hw-vitals hw-hud-plate' }, this.health.el, this.warmth.el, this.air.el, this.buff);
  }

  update(player: PlayerState, survival: Survival): void {
    this.health.set(player.health, MAX_HEALTH);
    this.warmth.set(player.warmth, MAX_WARMTH);
    const trend = survival.trend;
    if (trend !== this.shownTrend) {
      this.shownTrend = trend;
      this.trend.replaceChildren(...(trend === 'steady' ? [] : [glyph(trend === 'warming' ? 'up' : 'down', 10)]));
      setAttr(this.trend, 'data-trend', trend);
      setAttr(this.trend, 'title', trend === 'warming' ? 'Warming up' : trend === 'cooling' ? 'Getting colder' : null);
    }
    const underwater = player.headInWater || player.air < MAX_AIR_S - 0.05;
    this.air.el.hidden = !underwater;
    if (underwater) this.air.set(player.air, MAX_AIR_S);

    const left = survival.buffTimeLeftS;
    const warming = survival.warmUpProgress;
    if (left > 0) {
      this.buff.hidden = false;
      setFlag(this.buff, 'pending', false);
      setText(this.buffText, `Well-Warmed ${clockTime(left)}`);
    } else if (warming > 0 && warming < 1) {
      this.buff.hidden = false;
      setFlag(this.buff, 'pending', true);
      setText(this.buffText, `Warming ${Math.ceil((1 - warming) * WELL_WARMED_AFTER_S)} s`);
    } else this.buff.hidden = true;
  }
}
