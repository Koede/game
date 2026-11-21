/**
 * The FORGE tab: the game's tech tree as a recipe list. Category chips, requirement badges, have/need chips,
 * Forge and x5; higher-tier rows are shown locked with the furnace that unlocks them. The row the player last
 * touched is "selected": the thermometer marks its temperature.
 */
import { FORGE_CHILL_C, STATION_CRATE_RADIUS } from '../../../core/constants';
import type { GameBus } from '../../../core/context';
import { recipe as recipeById } from '../../../core/registry';
import type { RecipeDef } from '../../../core/types';
import type { ForgeRow, FurnaceView } from '../../../sim';
import { h } from '../../kit/dom';
import { RecipeList } from '../../kit/recipe';
import { FORGE_BATCH, FORGE_CATEGORIES, forgeRowViews, forgeShortfall } from './forgeRows';
import { pretty, type ScreenSim } from './simApi';

export class ForgeTab {
  readonly el: HTMLElement;
  /** The recipe the player last touched, or null. */
  selected: RecipeDef | null = null;
  private readonly list: RecipeList;
  private readonly note: HTMLParagraphElement;
  private rows: readonly ForgeRow[] = [];

  constructor(opts: { sim: ScreenSim; pos: { x: number; y: number; z: number }; bus: GameBus; changed: () => void }) {
    const { sim, pos, bus } = opts;
    this.list = new RecipeList({
      label: 'Forge',
      categories: FORGE_CATEGORIES,
      many: FORGE_BATCH,
      emptyText: 'Nothing to forge.',
      onMake: (id, count) => {
        this.selected = recipeById(id);
        const result = sim.forge(pos.x, pos.y, pos.z, id, count);
        if (!result.ok) {
          bus.emit('toast', { text: pretty(result.reason), kind: 'warn' });
          bus.emit('sfx', { name: 'error' });
        } else {
          const short = forgeShortfall(result.made, count, this.selected?.output.item ?? id);
          if (short) bus.emit('toast', { text: short, kind: 'info' });
        }
        opts.changed();
      },
    });
    this.note = h('p', { class: 'hw-forge__note' });
    this.el = h('div', { class: 'hw-forge' }, this.note, this.list.el);
    const pick = (ev: Event): void => {
      const row = ev.target instanceof Element ? ev.target.closest<HTMLElement>('.hw-recipe[data-id]') : null;
      const id = row?.dataset.id;
      if (!id || id === this.selected?.id) return;
      this.selected = recipeById(id);
      opts.changed();
    };
    this.list.el.addEventListener('pointerdown', pick);
    this.list.el.addEventListener('focusin', pick);
  }

  /** How many rows can be forged right now. */
  get ready(): number {
    return this.rows.reduce((n, r) => n + (r.canMake ? 1 : 0), 0);
  }

  update(view: FurnaceView, crates: number): void {
    this.rows = view.forge;
    this.list.setRows(forgeRowViews(view.forge));
    const text =
      crates > 0
        ? `Forging takes ingredients from your pack, then from the ${crates} crate${crates === 1 ? '' : 's'} nearby. Each forge cools the furnace by ${FORGE_CHILL_C} °C.`
        : `Forging takes ingredients from your pack (and crates within ${STATION_CRATE_RADIUS} blocks). Each forge cools the furnace by ${FORGE_CHILL_C} °C.`;
    if (this.note.textContent !== text) this.note.textContent = text;
  }

  dispose(): void {
    this.list.dispose();
  }
}
