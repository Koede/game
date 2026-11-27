/**
 * The view through the glass (docs/api/optics.md): while a spyglass or telescope is raised, a round eyepiece frame darkens the
 * edge of the screen, a fine reticle marks the middle, and a caption names the landmark in the middle of the view (its
 * distance and direction, and whether it is spotted yet). Driven by the 'optics:view' event; pointer-transparent, so the
 * touch controls under it still work.
 */
import type { GameBus } from '../core/context';

const CSS = `
.hw-optics { position: absolute; inset: 0; display: none; pointer-events: none; z-index: 1; }
.hw-optics--on { display: block; }
.hw-optics-ring { position: absolute; inset: 0;
  background: radial-gradient(circle at 50% 46%, transparent 0, transparent 40vmin, rgba(10,8,6,.55) 43vmin, rgba(6,5,4,.94) 49vmin, #050403 64vmin); }
.hw-optics--telescope .hw-optics-ring {
  background: radial-gradient(circle at 50% 46%, transparent 0, transparent 36vmin, rgba(10,8,6,.6) 39vmin, rgba(6,5,4,.95) 45vmin, #050403 60vmin); }
.hw-optics-cross { position: absolute; left: 50%; top: 46%; width: 22vmin; height: 22vmin; transform: translate(-50%, -50%); }
.hw-optics-cross::before, .hw-optics-cross::after { content: ''; position: absolute; background: rgba(255,236,190,.55); }
.hw-optics-cross::before { left: 0; right: 0; top: 50%; height: 1px; }
.hw-optics-cross::after { top: 0; bottom: 0; left: 50%; width: 1px; }
.hw-optics-label { position: absolute; left: 50%; top: calc(46% + 44vmin); transform: translateX(-50%); max-width: 88vw;
  padding: 5px 12px; border-radius: 9px; background: rgba(24,18,14,.82); border: 1px solid rgba(214,170,90,.45);
  color: #f3e7cf; font: 13px/1.35 system-ui, sans-serif; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hw-optics-label b { color: #ffd98a; font-weight: 600; }
.hw-optics-zoom { color: #d9b46a; margin-right: 6px; }
.hw-optics-spotted { color: #9fe08c; margin-left: 6px; }
`;

type View = { mode: 'none' | 'spyglass' | 'telescope'; zoom: number; target: { name: string; distance: number; direction: string; spotted: boolean } | null };

export class OpticsHud {
  readonly el: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private readonly off: () => void;

  constructor(layer: HTMLElement, bus: GameBus) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.el = document.createElement('div');
    this.el.className = 'hw-optics';
    this.el.setAttribute('aria-live', 'polite');
    const ring = document.createElement('div');
    ring.className = 'hw-optics-ring';
    const cross = document.createElement('div');
    cross.className = 'hw-optics-cross';
    this.label = document.createElement('div');
    this.label.className = 'hw-optics-label';
    this.el.append(ring, cross, this.label);
    layer.prepend(this.el);
    this.off = bus.on('optics:view', (v) => this.show(v));
  }

  show(v: View): void {
    const on = v.mode !== 'none';
    this.el.classList.toggle('hw-optics--on', on);
    this.el.classList.toggle('hw-optics--telescope', v.mode === 'telescope');
    if (!on) return;
    this.label.replaceChildren();
    const zoom = document.createElement('span');
    zoom.className = 'hw-optics-zoom';
    zoom.textContent = `${v.zoom}x`;
    this.label.append(zoom);
    if (v.target) {
      const name = document.createElement('b');
      name.textContent = v.target.name;
      this.label.append(name, ` ${v.target.distance} m ${v.target.direction}`);
      const mark = document.createElement('span');
      mark.className = 'hw-optics-spotted';
      mark.textContent = v.target.spotted ? 'spotted' : 'hold steady...';
      this.label.append(mark);
    } else this.label.append(v.mode === 'telescope' ? 'Sweep the horizon for landmarks. Use again to step back.' : 'Look for landmarks. Use again to lower the glass.');
  }

  dispose(): void {
    this.off();
    this.el.remove();
    this.style.remove();
  }
}
