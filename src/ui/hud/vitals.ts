/** Health, warmth (with its trend), food (Hungry / starving), air while under water, and the Well-Warmed / Well-Fed buffs. */
import { MAX_AIR_S, MAX_FOOD, MAX_HEALTH, MAX_WARMTH, WELL_WARMED_AFTER_S } from '../../core/constants';
import type { PlayerState } from '../../game/playerState';
import type { Survival } from '../../game/survival';
import { h, setAttr, setFlag, setText } from '../kit/dom';
import { glyph, type GlyphName } from '../kit/icons';
import { clockTime, hungerState, type HungerState } from '../screens/food';

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

/** A buff pill: glyph, name ("Well-Fed", hidden on narrow phones) and time left. */
class BuffPill {
  readonly el: HTMLDivElement;
  private readonly name: HTMLSpanElement;
  private readonly time: HTMLSpanElement;

  constructor(kind: string, icon: GlyphName) {
    this.name = h('span', { class: 'hw-buff__name' });
    this.time = h('span', { class: 'hw-buff__time hw-num' });
    this.el = h('div', { class: 'hw-buff', attrs: { 'data-kind': kind } }, glyph(icon, 12), this.name, this.time);
    this.el.hidden = true;
  }

  show(name: string, time: string, pending: boolean, title: string): void {
    this.el.hidden = false;
    setFlag(this.el, 'pending', pending);
    setText(this.name, name);
    setText(this.time, time);
    setAttr(this.el, 'title', title);
  }

  hide(): void {
    this.el.hidden = true;
  }
}

const HUNGER_TITLES: Record<HungerState, string | null> = {
  fed: null,
  hungry: 'Hungry: you cannot sprint and do not heal. Eat something.',
  starving: 'Starving: an empty stomach takes your health. Eat something.',
};

export class Vitals {
  readonly el: HTMLDivElement;
  private readonly health = new VitalBar('health', 'heart', 'Health');
  private readonly warmth: VitalBar;
  private readonly food: VitalBar;
  private readonly air = new VitalBar('air', 'air', 'Air');
  private readonly trend: HTMLSpanElement;
  private readonly hungerTag: HTMLSpanElement;
  private readonly warmBuff = new BuffPill('warm', 'flame');
  private readonly fedBuff = new BuffPill('fed', 'bowl');
  private readonly buffs: HTMLDivElement;
  private shownTrend = '';
  private shownHunger: HungerState | '' = '';

  constructor() {
    this.trend = h('span', { class: 'hw-vital__trend' });
    this.warmth = new VitalBar('warmth', 'flame', 'Warmth', this.trend);
    // The fourth column of the food row: a "!" while Hungry, so the state reads without colour too.
    this.hungerTag = h('span', { class: 'hw-vital__trend hw-vital__hunger' });
    this.food = new VitalBar('food', 'bowl', 'Food', this.hungerTag);
    this.air.el.hidden = true;
    this.buffs = h('div', { class: 'hw-buffs' }, this.warmBuff.el, this.fedBuff.el);
    this.buffs.hidden = true;
    this.el = h('div', { class: 'hw-vitals hw-hud-plate' }, this.health.el, this.warmth.el, this.food.el, this.air.el, this.buffs);
  }

  update(player: PlayerState, survival: Survival): void {
    this.health.set(player.health, MAX_HEALTH);
    this.warmth.set(player.warmth, MAX_WARMTH);
    this.food.set(player.food, MAX_FOOD);
    const trend = survival.trend;
    if (trend !== this.shownTrend) {
      this.shownTrend = trend;
      this.trend.replaceChildren(...(trend === 'steady' ? [] : [glyph(trend === 'warming' ? 'up' : 'down', 10)]));
      setAttr(this.trend, 'data-trend', trend);
      setAttr(this.trend, 'title', trend === 'warming' ? 'Warming up' : trend === 'cooling' ? 'Getting colder' : null);
    }
    const hunger = hungerState(player.food);
    if (hunger !== this.shownHunger) {
      this.shownHunger = hunger;
      setAttr(this.food.el, 'data-hunger', hunger === 'fed' ? null : hunger);
      setAttr(this.food.el, 'aria-label', hunger === 'fed' ? 'Food' : hunger === 'hungry' ? 'Food (Hungry)' : 'Food (starving)');
      setAttr(this.food.el, 'title', HUNGER_TITLES[hunger]);
      setText(this.hungerTag, hunger === 'fed' ? '' : '!');
    }
    const underwater = player.headInWater || player.air < MAX_AIR_S - 0.05;
    this.air.el.hidden = !underwater;
    if (underwater) this.air.set(player.air, MAX_AIR_S);

    const left = survival.buffTimeLeftS;
    const warming = survival.warmUpProgress;
    if (left > 0) this.warmBuff.show('Well-Warmed', clockTime(left), false, 'Well-Warmed: you mine a quarter faster');
    else if (warming > 0 && warming < 1) {
      this.warmBuff.show('Warming', `${Math.ceil((1 - warming) * WELL_WARMED_AFTER_S)} s`, true, 'Stay by the fire to become Well-Warmed');
    } else this.warmBuff.hide();

    const fed = survival.hunger.wellFedTimeLeftS;
    if (fed > 0) this.fedBuff.show('Well-Fed', clockTime(fed), false, 'Well-Fed: you heal twice as fast and get hungry half as quickly');
    else this.fedBuff.hide();
    const none = this.warmBuff.el.hidden && this.fedBuff.el.hidden;
    if (this.buffs.hidden !== none) this.buffs.hidden = none;
    // Phones show both pills side by side as glyph + time (hud.css); one alone keeps its name.
    setFlag(this.buffs, 'both', !this.warmBuff.el.hidden && !this.fedBuff.el.hidden);
  }
}
