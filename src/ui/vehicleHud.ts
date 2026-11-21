/**
 * The driving HUD (docs/api/tractor.md): while a tractor is driven, a small panel above the hotbar shows the fuel gauge,
 * the fitted attachment and the keys, and the touch Mine / Use / Jump buttons are recaptioned Work / Exit / Swap (they
 * ARE those controls while driving, see vehicles/manager.ts). Nothing is shown on foot; captions are restored.
 */
import type { DriveStatus } from '../vehicles/manager';

const CSS = `
.hw-vehicle { position: absolute; left: 50%; bottom: calc(86px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%);
  display: none; flex-direction: column; align-items: center; gap: 4px; padding: 6px 12px; max-width: 92vw;
  background: rgba(24,18,14,.78); border: 1px solid rgba(255,200,120,.35); border-radius: 10px; color: #f1e6d6;
  font: 12px/1.3 system-ui, sans-serif; pointer-events: none; text-align: center; }
.hw-vehicle--on { display: flex; }
.hw-vehicle-row { display: flex; align-items: center; gap: 8px; }
.hw-vehicle-gauge { width: 110px; height: 8px; border-radius: 4px; background: rgba(255,255,255,.14); overflow: hidden; }
.hw-vehicle-fill { height: 100%; width: 0; background: #e0a52a; transition: width .2s; }
.hw-vehicle-fill--low { background: #d8481e; }
.hw-vehicle-hint { color: #cdbfae; font-size: 11px; }
`;

const CAPTIONS: Array<[selector: string, driving: string]> = [
  ['.hw-touch-btn--mine .hw-touch-label', 'Work'],
  ['.hw-touch-btn--use .hw-touch-label', 'Exit'],
  ['.hw-touch-btn--jump .hw-touch-label', 'Swap'],
];

export class VehicleHud {
  readonly el: HTMLDivElement;
  private readonly fill: HTMLDivElement;
  private readonly tool: HTMLSpanElement;
  private readonly hint: HTMLDivElement;
  private readonly style: HTMLStyleElement;
  private shown = false;
  private saved = new Map<Element, string>();
  private key = '';

  constructor(layer: HTMLElement, private readonly touch: () => boolean) {
    this.style = document.createElement('style');
    this.style.textContent = CSS;
    document.head.appendChild(this.style);
    this.el = document.createElement('div');
    this.el.className = 'hw-vehicle';
    this.el.setAttribute('role', 'status');
    const row = document.createElement('div');
    row.className = 'hw-vehicle-row';
    const label = document.createElement('span');
    label.textContent = 'Fuel';
    const gauge = document.createElement('div');
    gauge.className = 'hw-vehicle-gauge';
    this.fill = document.createElement('div');
    this.fill.className = 'hw-vehicle-fill';
    gauge.appendChild(this.fill);
    this.tool = document.createElement('span');
    row.append(label, gauge, this.tool);
    this.hint = document.createElement('div');
    this.hint.className = 'hw-vehicle-hint';
    this.el.append(row, this.hint);
    layer.appendChild(this.el);
  }

  /** Call every frame with the drive status (null on foot). */
  update(status: DriveStatus | null): void {
    if (!status) {
      if (this.shown) this.hide();
      return;
    }
    if (!this.shown) this.show();
    const pct = Math.round(status.fuel * 100);
    const tool = status.attachment === 'tiller' ? 'Tiller' : status.attachment === 'harvester' ? 'Harvester' : 'no tool';
    const verb = status.attachment === 'harvester' ? 'harvest' : 'till';
    const key = `${pct}|${tool}|${this.touch()}`;
    if (key === this.key) return;
    this.key = key;
    this.fill.style.width = `${pct}%`;
    this.fill.classList.toggle('hw-vehicle-fill--low', status.fuel < 0.12);
    this.tool.textContent = tool;
    this.hint.textContent = this.touch()
      ? status.attachment ? `Stick drives. Work: ${verb}. Swap: change tool. Exit: get off.` : 'Stick drives. Swap: fit a tool. Exit: get off.'
      : status.attachment ? `W/S drive, A/D steer, F ${verb}, R swap tool, Use get off` : 'W/S drive, A/D steer, R fit a tool, Use get off';
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
    this.style.remove();
  }
}
