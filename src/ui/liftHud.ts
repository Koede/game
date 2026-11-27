/**
 * The lift HUD (docs/api/lifts.md): while the player rides a lift or elevator cage, a small panel above the hotbar shows the
 * depth, the landings above and below and whether the winch has power, and the touch Mine / Use / Jump buttons are
 * recaptioned Down / Exit / Up (they ARE those controls while riding, see workshop/lifts.ts). Uses the driving HUD's
 * look (src/ui/vehicleHud.ts, whose CSS is in the page whenever the game runs). Nothing is shown on foot.
 */
import type { LiftStatus } from '../workshop/lifts';

const CAPTIONS: Array<[selector: string, riding: string]> = [
  ['.hw-touch-btn--mine .hw-touch-label', 'Down'],
  ['.hw-touch-btn--use .hw-touch-label', 'Exit'],
  ['.hw-touch-btn--jump .hw-touch-label', 'Up'],
];

export class LiftHud {
  readonly el: HTMLDivElement;
  private readonly line: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private shown = false;
  private readonly saved = new Map<Element, string>();
  private key = '';

  constructor(layer: HTMLElement, private readonly touch: () => boolean) {
    this.el = document.createElement('div');
    this.el.className = 'hw-vehicle hw-lift';
    this.el.setAttribute('role', 'status');
    this.line = document.createElement('div');
    this.line.className = 'hw-vehicle-row';
    this.hint = document.createElement('div');
    this.hint.className = 'hw-vehicle-hint';
    this.el.append(this.line, this.hint);
    layer.appendChild(this.el);
  }

  /** Call every frame with the ride status (null on foot). */
  update(status: LiftStatus | null): void {
    if (!status) {
      if (this.shown) this.hide();
      return;
    }
    if (!this.shown) this.show();
    const key = `${status.name}|${status.depth}|${status.moving}|${status.powered}|${status.landing}|${status.above}|${status.below}|${this.touch()}`;
    if (key === this.key) return;
    this.key = key;
    const where = status.depth === 0 ? 'at the top' : `${status.depth} down`;
    const arrow = status.moving > 0 ? ' ▲' : status.moving < 0 ? ' ▼' : '';
    const name = status.name[0].toUpperCase() + status.name.slice(1);
    this.line.textContent = `${name} ${where}${arrow} · ${status.above} up, ${status.below} down${status.powered ? '' : ' · no power'}`;
    const exit = status.landing ? (this.touch() ? 'Exit: step out.' : 'Use: step out.') : 'No way out here.';
    this.hint.textContent = this.touch() ? `Up / Down: next landing. ${exit}` : `Space or W: up a landing. Click or S: down. ${exit}`;
  }

  private show(): void {
    this.shown = true;
    this.key = '';
    this.el.classList.add('hw-vehicle--on');
    for (const [sel, text] of CAPTIONS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      this.saved.set(el, el.textContent ?? '');
      el.textContent = text;
    }
  }

  private hide(): void {
    this.shown = false;
    this.el.classList.remove('hw-vehicle--on');
    for (const [el, text] of this.saved) el.textContent = text;
    this.saved.clear();
  }

  dispose(): void {
    if (this.shown) this.hide();
    this.el.remove();
  }
}
