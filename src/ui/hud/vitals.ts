/**
 * Health, warmth (with its trend), food (Hungry / starving), air while under water, the Burning / Well-Warmed /
 * Well-Fed and drink (tea, coffee) pills, and one short visible line saying why warmth falls or that food is low (titles never show on touch).
 */
import { MAX_AIR_S, MAX_FOOD, MAX_HEALTH, MAX_WARMTH, WELL_WARMED_AFTER_S } from '../../core/constants';
import { feelOf } from '../../game/thermal';
import { survivalNote, type SurvivalNoteTone } from '../../game/cold';
import type { PlayerState } from '../../game/playerState';
import type { Survival } from '../../game/survival';
import { h, setAttr, setFlag, setText } from '../kit/dom';
import { glyph, type GlyphName } from '../kit/icons';
import { DRINK_GLYPHS, chipDensity, drinkChips } from './drinkBuffs';
import { DRINK_BUFF_KEYS } from '../../core/brewing';
import type { DrinkBuff } from '../../core/types';
import { isVitalCalm } from './hudMath';
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
    setFlag(this.el, 'calm', isVitalCalm(fraction));
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

  show(name: string, time: string, pending: boolean, title: string, family?: string): void {
    this.el.hidden = false;
    if (family) this.el.dataset.family = family;
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

const NOTE_COLOURS: Record<SurvivalNoteTone, string> = { cold: '#8fc4ff', warn: 'var(--hw-warn)', bad: 'var(--hw-bad-hi)' };

/** The temperature chip under the bars: a button, so it works by tap on a phone as well as with the H key. */
const HEAT_STYLE: Readonly<Record<string, string>> = {
  font: '600 11px / 1.2 var(--hw-font-display)',
  'letter-spacing': '0.02em',
  'pointer-events': 'auto',
  cursor: 'pointer',
  'min-height': '28px',
  padding: '2px 8px',
  margin: '2px 0 0 18px',
  color: 'inherit',
  background: 'transparent',
  border: '1px solid var(--hw-plate-edge)',
  'border-radius': '6px',
  'text-align': 'left',
};
const HEAT_COLOURS: Readonly<Record<string, string>> = {
  freezing: '#8fb8ff', cold: '#9ec9ff', cool: '#bcd9e8', comfortable: '#cfe8c0', warm: '#ffc27a', hot: '#ff9a6a',
};

/** Styled inline: the line is this module's alone and hud.css belongs to the HUD as a whole. */
const NOTE_STYLE: Readonly<Record<string, string>> = {
  font: '600 11px / 1.2 var(--hw-font-display)',
  'letter-spacing': '0.02em',
  'padding-left': '20px',
  'margin-top': '-1px',
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
  private readonly sugarBuff = new BuffPill('sugar', 'hourglass');
  /** Spec 19: an ember bolt's burning (PlayerCombat.burning), first in the row. */
  private readonly burnBuff = new BuffPill('burn', 'flame');
  /** The six drink buffs (BREWING_PLAN 11.1): a pill each, shown while it runs. */
  private readonly drinkPills = new Map<DrinkBuff, BuffPill>();
  private readonly buffs: HTMLDivElement;
  private readonly note: HTMLDivElement;
  /** The temperature chip: tap (or H) toggles the heat view. */
  private readonly heat: HTMLButtonElement;
  private shownHeat = '';
  /** Set by the game: toggles the heat view. */
  onHeatToggle: (() => void) | null = null;
  /** Whether the heat view is on (shown on the chip). */
  heatOn = false;
  private shownNote = '';
  private shownTrend = '';
  private shownHunger: HungerState | '' = '';

  constructor() {
    this.trend = h('span', { class: 'hw-vital__trend' });
    this.warmth = new VitalBar('warmth', 'flame', 'Warmth', this.trend);
    // The fourth column of the food row: a "!" while Hungry, so the state reads without colour too.
    this.hungerTag = h('span', { class: 'hw-vital__trend hw-vital__hunger' });
    this.food = new VitalBar('food', 'bowl', 'Food', this.hungerTag);
    this.air.el.hidden = true;
    for (const key of DRINK_BUFF_KEYS) this.drinkPills.set(key, new BuffPill(key, DRINK_GLYPHS[key]));
    this.buffs = h('div', { class: 'hw-buffs' }, this.burnBuff.el, this.warmBuff.el, this.fedBuff.el, this.sugarBuff.el, ...[...this.drinkPills.values()].map((p) => p.el));
    this.buffs.hidden = true;
    this.note = h('div', { class: 'hw-vitals__note', style: NOTE_STYLE, attrs: { role: 'status' } });
    this.note.hidden = true;
    this.heat = h('button', { class: 'hw-vitals__heat', style: HEAT_STYLE, attrs: { type: 'button', 'aria-label': 'Air temperature. Tap for the heat view', 'data-testid': 'heat-chip' } });
    this.heat.hidden = true;
    this.heat.addEventListener('click', () => this.onHeatToggle?.());
    this.el = h('div', { class: 'hw-vitals hw-hud-plate' }, this.health.el, this.warmth.el, this.food.el, this.air.el, this.note, this.heat, this.buffs);
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
    const note = survivalNote(survival.coldCause, player.warmth, player.food);
    const noteKey = note ? `${note.tone}|${note.text}` : '';
    if (noteKey !== this.shownNote) {
      this.shownNote = noteKey;
      this.note.hidden = note === null;
      if (note) {
        setText(this.note, note.text);
        this.note.style.color = NOTE_COLOURS[note.tone];
      }
    }
    const tc = survival.temperatureC;
    const heatKey = tc === null ? '' : `${Math.round(tc)}|${this.heatOn ? 1 : 0}`;
    if (heatKey !== this.shownHeat) {
      this.shownHeat = heatKey;
      this.heat.hidden = tc === null;
      if (tc !== null) {
        const feel = feelOf(tc);
        setText(this.heat, `${Math.round(tc)}\u00b0C ${feel}${this.heatOn ? ' \u00b7 heat view' : ''}`);
        this.heat.style.color = HEAT_COLOURS[feel];
        setAttr(this.heat, 'aria-pressed', this.heatOn ? 'true' : 'false');
      }
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
    const sugar = player.buffs.sugarS;
    if (sugar > 0) this.sugarBuff.show('Sugar Rush', clockTime(sugar), false, 'Sugar Rush: you move faster, but Well-Fed wears off quicker');
    else this.sugarBuff.hide();
    const combat = player.combat;
    if (combat.burning) this.burnBuff.show('Burning', `${Math.max(1, Math.ceil(combat.burnTimeLeftS))} s`, false, 'Burning: water puts it out');
    else this.burnBuff.hide();
    let shown = Number(!this.warmBuff.el.hidden) + Number(!this.fedBuff.el.hidden) + Number(!this.sugarBuff.el.hidden) + Number(!this.burnBuff.el.hidden);
    const running = drinkChips(player.buffs);
    for (const [key, pill] of this.drinkPills) {
      const chip = running.find((c) => c.buff === key);
      if (chip) pill.show(chip.name, chip.time, false, chip.title, chip.family);
      else pill.hide();
    }
    shown += running.length;
    const none = shown === 0;
    if (this.buffs.hidden !== none) this.buffs.hidden = none;
    // Two pills or more show as glyph + time side by side (hud.css); four or more are tighter still; one alone keeps its name.
    const density = chipDensity(shown);
    setFlag(this.buffs, 'both', density !== 'full');
    setFlag(this.buffs, 'tight', density === 'tight');
  }
}
