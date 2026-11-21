/**
 * One row of a recipe list: what it makes, what it needs, what the player has, and the buttons to make it.
 * Rows are updated in place and only write to the DOM what changed, so a screen can refresh them many
 * times per second. The scrolling list is in ./recipeList.
 */
import { Button } from './controls';
import { h, setAttr, setFlag, setText } from './dom';
import { formatCount, heatColor } from './format';
import { Badge, type Tone } from './gauges';
import { ItemIcon, glyph } from './icons';

export * from './recipeList';

export interface RecipeIngredient {
  item: string;
  name: string;
  /** How many the player can draw on (inventory plus nearby crates). */
  have: number;
  need: number;
}

export interface RecipeRequirement {
  /** "900 °C", "Tier 2", "8 s", "1 kW"; facts about the product: "+8 food", "Returns the bucket". */
  text: string;
  /** 'food' (what eating the product does) and 'note' (what else the recipe gives) are facts, not requirements. */
  kind?: 'heat' | 'tier' | 'power' | 'time' | 'food' | 'note';
  /** true = satisfied right now, false = not yet, omit for plain facts such as a duration. */
  met?: boolean;
  /** For kind 'heat': the temperature, drawn as a heat-ramp swatch. */
  tempC?: number;
}

export interface RecipeRowView {
  /** Recipe id; identifies the row across updates. */
  id: string;
  /** Output item key (for the icon). */
  item: string;
  name: string;
  /** Items produced per craft. Shown as "x4" when greater than 1. */
  count?: number;
  /** Category id, matched against the list's category chips. */
  category?: string;
  requirements?: readonly RecipeRequirement[];
  ingredients: readonly RecipeIngredient[];
  /** How many times the recipe can be made right now. 0 = it cannot. */
  available: number;
  /** One line saying why it cannot be made ("Needs 800 °C - the fire is at 640 °C"). Shown while unavailable. */
  reason?: string;
  /** Out of reach for now (furnace tier too low): the row is dimmed and offers no buttons. */
  locked?: boolean;
  /** Label of the main button. Default "Make". */
  action?: string;
}

export interface RecipeRowOptions {
  onMake: (id: string, count: number) => void;
  /** Size of the batch button ("x5"). 0 removes the button. Default 5. */
  many?: number;
}

interface IngredientChip {
  el: HTMLSpanElement;
  icon: ItemIcon;
  qty: HTMLSpanElement;
  name: HTMLSpanElement;
}

/** Food and note badges describe the product: they get a line of their own under the name. */
const isFact = (r: RecipeRequirement): boolean => r.kind === 'food' || r.kind === 'note';

const REQUIREMENT_TONE: Record<NonNullable<RecipeRequirement['kind']>, Tone> = {
  heat: 'heat',
  tier: 'neutral',
  power: 'power',
  time: 'neutral',
  food: 'good',
  note: 'neutral',
};

export class RecipeRow {
  readonly el: HTMLElement;
  private readonly icon = new ItemIcon();
  private readonly nameEl: HTMLSpanElement;
  private readonly countEl: HTMLSpanElement;
  private readonly badgeHost: HTMLDivElement;
  private readonly factHost: HTMLDivElement;
  private readonly chipHost: HTMLDivElement;
  private readonly reasonEl: HTMLDivElement;
  private readonly makeBtn: Button;
  private readonly manyBtn: Button | null;
  private readonly many: number;
  private readonly badges: Badge[] = [];
  private readonly facts: Badge[] = [];
  private readonly chips: IngredientChip[] = [];
  private id = '';
  private available = -1;
  private batch = 0;

  constructor(view: RecipeRowView, opts: RecipeRowOptions) {
    this.many = opts.many ?? 5;
    this.nameEl = h('span', { class: 'hw-recipe__name' });
    this.countEl = h('span', { class: 'hw-recipe__count hw-num' });
    this.badgeHost = h('div', { class: 'hw-recipe__badges' });
    this.factHost = h('div', { class: 'hw-recipe__facts hw-recipe__badges' });
    this.chipHost = h('div', { class: 'hw-recipe__chips' });
    this.reasonEl = h('div', { class: 'hw-recipe__reason' });
    this.makeBtn = new Button({ label: 'Make', kind: 'primary', size: 'sm', onClick: () => opts.onMake(this.id, 1) });
    this.manyBtn =
      this.many > 1 ? new Button({ label: `×${this.many}`, kind: 'quiet', size: 'sm', onClick: () => opts.onMake(this.id, this.batch) }) : null;
    const lock = h('span', { class: 'hw-recipe__lock' }, glyph('lock', 12));
    this.el = h(
      'article',
      { class: 'hw-recipe', attrs: { role: 'listitem' } },
      h('div', { class: 'hw-recipe__icon' }, this.icon.el, lock),
      h('div', { class: 'hw-recipe__head' }, h('div', { class: 'hw-recipe__title' }, this.nameEl, this.countEl), this.badgeHost),
      this.factHost,
      this.chipHost,
      h('div', { class: 'hw-recipe__actions' }, this.manyBtn?.el, this.makeBtn.el),
      this.reasonEl,
    );
    this.update(view);
  }

  /** Applies a new view of the same (or another) recipe, touching only what changed. */
  update(view: RecipeRowView): void {
    this.id = view.id;
    setAttr(this.el, 'data-id', view.id);
    this.icon.set(view.item);
    setText(this.nameEl, view.name);
    const count = view.count ?? 1;
    setText(this.countEl, count > 1 ? `×${count}` : '');
    const locked = view.locked ?? false;
    const ready = !locked && view.available > 0;
    setAttr(this.el, 'data-state', locked ? 'locked' : ready ? 'ready' : 'short');
    const all = view.requirements ?? [];
    this.updateBadges(this.badges, this.badgeHost, all.filter((r) => !isFact(r)));
    this.updateBadges(this.facts, this.factHost, all.filter(isFact));
    this.updateChips(view.ingredients);
    const reason = ready ? '' : view.reason ?? '';
    setText(this.reasonEl, reason);
    this.reasonEl.hidden = reason === '';
    this.makeBtn.setLabel(view.action ?? 'Make');
    const available = ready ? view.available : 0;
    if (available !== this.available) {
      this.available = available;
      this.makeBtn.setDisabled(!ready);
      if (this.manyBtn) {
        this.batch = ready ? Math.min(this.many, Math.max(2, available)) : this.many;
        this.manyBtn.setLabel(`×${this.batch}`);
        this.manyBtn.setDisabled(available < 2);
      }
    }
  }

  dispose(): void {
    this.makeBtn.dispose();
    this.manyBtn?.dispose();
  }

  private updateBadges(badges: Badge[], host: HTMLElement, requirements: readonly RecipeRequirement[]): void {
    while (badges.length > requirements.length) badges.pop()?.el.remove();
    requirements.forEach((req, i) => {
      const opts = {
        text: req.text,
        tone: REQUIREMENT_TONE[req.kind ?? 'tier'],
        met: req.met ?? null,
        swatch: req.kind === 'heat' && req.tempC !== undefined ? heatColor(req.tempC) : null,
      };
      let badge = badges[i];
      if (badge) badge.update(opts);
      else {
        badge = new Badge(opts);
        badges.push(badge);
        host.appendChild(badge.el);
      }
      setAttr(badge.el, 'data-kind', req.kind ?? null);
    });
  }

  private updateChips(ingredients: readonly RecipeIngredient[]): void {
    while (this.chips.length > ingredients.length) this.chips.pop()?.el.remove();
    ingredients.forEach((ing, i) => {
      let chip = this.chips[i];
      if (!chip) {
        const icon = new ItemIcon();
        const qty = h('span', { class: 'hw-ingr__qty hw-num' });
        const name = h('span', { class: 'hw-ingr__name' });
        chip = { el: h('span', { class: 'hw-ingr' }, icon.el, qty, name), icon, qty, name };
        this.chips.push(chip);
        this.chipHost.appendChild(chip.el);
      }
      const enough = ing.have >= ing.need;
      chip.icon.set(ing.item);
      setText(chip.qty, `${formatCount(ing.have)}/${formatCount(ing.need)}`);
      setText(chip.name, ing.name);
      setFlag(chip.el, 'short', !enough);
      setAttr(chip.el, 'title', `${ing.name}: have ${ing.have}, need ${ing.need}${enough ? '' : ' (not enough)'}`);
    });
  }
}
