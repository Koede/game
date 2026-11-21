/** The single overlay that holds all UI, stacked in fixed layers above the game canvas. */
import { h } from './dom';
import { Banner, Toasts, Tooltip } from './feedback';

/** Bottom to top. `menu` holds full-screen menus (the title screen); windows open above it. */
export const LAYER_ORDER = ['hud', 'touch', 'menu', 'windows', 'toasts', 'tooltip'] as const;
export type LayerName = (typeof LAYER_ORDER)[number];

/**
 * Creates `<div class="hw-root">` inside the app element. Layers ignore pointer input by themselves
 * (the game canvas underneath keeps receiving it); whatever is put into a layer opts back in with
 * `pointer-events: auto`. Kit widgets that need it (windows, menus, the title screen) already do.
 */
export class UIRoot {
  readonly el: HTMLDivElement;
  readonly layers: Readonly<Record<LayerName, HTMLDivElement>>;
  /** Shared feedback widgets, already mounted in their layers. */
  readonly toasts: Toasts;
  readonly banner: Banner;
  readonly tooltip: Tooltip;

  constructor(app: HTMLElement) {
    this.el = h('div', { class: 'hw-root' });
    const layers = {} as Record<LayerName, HTMLDivElement>;
    for (const name of LAYER_ORDER) {
      layers[name] = h('div', { class: 'hw-layer', attrs: { 'data-layer': name } });
      this.el.appendChild(layers[name]);
    }
    this.layers = layers;
    this.toasts = new Toasts(layers.toasts);
    this.banner = new Banner(layers.toasts);
    this.tooltip = new Tooltip(layers.tooltip);
    app.appendChild(this.el);
  }

  dispose(): void {
    this.toasts.dispose();
    this.banner.dispose();
    this.tooltip.dispose();
    this.el.remove();
  }
}
