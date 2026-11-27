/**
 * The flight HUD (docs/api/airship.md): while an airship is flown, a panel above the hotbar shows fuel, height, how far
 * the pilot can see and the chart count, and a course button pointing at the next place on the sky chart (tap it, or
 * press R, for the next one). The touch Jump / Mine / Use buttons are recaptioned Up / Down / Exit, which is what they
 * do aboard (vehicles/airshipManager.ts). Nothing shows on foot; captions are restored.
 */
import type { FlightStatus } from '../vehicles/airshipManager';

const CSS = `
.hw-airship { position: absolute; left: 50%; bottom: calc(86px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%);
  display: none; flex-direction: column; align-items: center; gap: 4px; padding: 6px 12px; width: max-content; max-width: min(92vw, 360px);
  background: rgba(18,22,30,.8); border: 1px solid rgba(170,205,255,.35); border-radius: 10px; color: #e6eef8;
  font: 12px/1.3 system-ui, sans-serif; pointer-events: none; text-align: center; }
.hw-airship--on { display: flex; }
/* Phones held upright: the joystick and the action buttons fill the bottom, so the panel sits just above them. */
@media (orientation: portrait) and (max-width: 640px) { .hw-airship { bottom: calc(300px + env(safe-area-inset-bottom, 0px)); } }
.hw-airship-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
.hw-airship-gauge { width: 80px; height: 8px; border-radius: 4px; background: rgba(255,255,255,.14); overflow: hidden; }
.hw-airship-fill { height: 100%; width: 0; background: #e0a52a; transition: width .2s; }
.hw-airship-fill--low { background: #d8481e; }
.hw-airship-stat { color: #cfdcec; white-space: nowrap; }
.hw-airship-course { pointer-events: auto; display: flex; align-items: center; gap: 6px; min-height: 32px; padding: 4px 10px;
  border-radius: 16px; border: 1px solid rgba(170,205,255,.45); background: rgba(60,90,140,.45); color: #f2f7ff; font: inherit; cursor: pointer;
  max-width: 100%; }
.hw-airship-course span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hw-airship-arrow { display: inline-block; width: 14px; text-align: center; font-size: 14px; transition: transform .15s linear; }
.hw-airship-hint { color: #b4c2d4; font-size: 11px; }
.hw-airship-hint--warn { color: #ffcf8a; }
`;

const CAPTIONS: Array<[selector: string, flying: string]> = [
  ['.hw-touch-btn--mine .hw-touch-label', 'Down'],
  ['.hw-touch-btn--use .hw-touch-label', 'Exit'],
  ['.hw-touch-btn--jump .hw-touch-label', 'Up'],
];

export class AirshipHud {
  readonly el: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly stats: HTMLSpanElement;
  private readonly course: HTMLButtonElement;
  private readonly arrow: HTMLSpanElement;
  private readonly courseText: HTMLSpanElement;
  private readonly hint: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private shown = false;
  private readonly saved = new Map<Element, string>();
  private key = '';

  constructor(layer: HTMLElement, private readonly touch: () => boolean, onCourse: () => void) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.el = document.createElement('div');
    this.el.className = 'hw-airship';
    this.el.setAttribute('role', 'status');
    const row = document.createElement('div');
    row.className = 'hw-airship-row';
    const label = document.createElement('span');
    label.textContent = 'Fuel';
    const gauge = document.createElement('div');
    gauge.className = 'hw-airship-gauge';
    this.fill = document.createElement('div');
    this.fill.className = 'hw-airship-fill';
    gauge.appendChild(this.fill);
    this.stats = document.createElement('span');
    this.stats.className = 'hw-airship-stat';
    row.append(label, gauge, this.stats);
    this.course = document.createElement('button');
    this.course.type = 'button';
    this.course.className = 'hw-airship-course';
    this.course.setAttribute('aria-label', 'Next place on the sky chart');
    this.arrow = document.createElement('span');
    this.arrow.className = 'hw-airship-arrow';
    this.arrow.textContent = '↑';
    this.courseText = document.createElement('span');
    this.course.append(this.arrow, this.courseText);
    // Pointer events must not reach the world under the HUD (that would be a stray Use on a phone).
    const stop = (e: Event): void => e.stopPropagation();
    for (const t of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup'] as const) this.course.addEventListener(t, stop);
    this.course.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onCourse();
    });
    this.hint = document.createElement('div');
    this.hint.className = 'hw-airship-hint';
    this.el.append(row, this.course, this.hint);
    layer.appendChild(this.el);
  }

  /** Call every frame with the flight status (null on foot). */
  update(status: FlightStatus | null): void {
    if (!status) {
      if (this.shown) this.hide();
      return;
    }
    if (!this.shown) this.show();
    // The arrow turns every frame (cheap); the text only when something it shows changes.
    if (status.course) this.arrow.style.transform = `rotate(${(-status.course.bearing * 180) / Math.PI}deg)`;
    const pct = Math.round(status.fuel * 100);
    const alt = Math.round(status.altitude);
    const c = status.course;
    const dist = c ? Math.round(c.distance / 10) * 10 : 0;
    const key = `${pct}|${alt}|${status.sight}|${status.charted}|${c?.name ?? ''}|${dist}|${c?.compass ?? ''}|${status.canLand}|${this.touch()}`;
    if (key === this.key) return;
    this.key = key;
    this.fill.style.width = `${pct}%`;
    this.fill.classList.toggle('hw-airship-fill--low', status.fuel < 0.12);
    this.stats.textContent = `Alt ${alt} · ${status.sight > 0 ? `sees ${Math.round(status.sight)} m` : 'too low to spot'} · ${status.charted} charted`;
    this.course.style.display = '';
    this.arrow.style.visibility = c ? 'visible' : 'hidden';
    this.courseText.textContent = c ? `${c.name} · ${dist} m ${c.compass}` : 'Chart empty - climb to spot land';
    const touch = this.touch();
    this.hint.classList.toggle('hw-airship-hint--warn', status.fuel <= 0);
    this.hint.textContent = status.fuel <= 0
      ? 'Out of fuel: sinking. Exit once landed and refuel.'
      : touch
        ? `Stick flies. Up / Down climb and sink. ${status.canLand ? 'Exit: step off.' : 'Sink to land before Exit.'}`
        : `W/S thrust, A/D rudder, Space climb, F sink, R next place, ${status.canLand ? 'Use step off' : 'land to step off'}`;
  }

  private show(): void {
    this.shown = true;
    this.key = '';
    this.el.classList.add('hw-airship--on');
    for (const [sel, text] of CAPTIONS) {
      const el = document.querySelector(sel);
      if (!el) continue;
      this.saved.set(el, el.textContent ?? '');
      el.textContent = text;
    }
  }

  private hide(): void {
    this.shown = false;
    this.el.classList.remove('hw-airship--on');
    for (const [el, text] of this.saved) el.textContent = text;
    this.saved.clear();
  }

  dispose(): void {
    if (this.shown) this.hide();
    this.el.remove();
    this.style.remove();
  }
}
