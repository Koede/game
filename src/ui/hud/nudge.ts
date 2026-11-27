/**
 * The "what next" nudge (docs/api/assist.md), under the goal bar: a small "What next?" button; asked, it shows one short hint for the
 * current goal and an arrow pointing at the nearest thing needed (an ore, a station). It hides itself after a while and costs nothing
 * while closed. Key: N.
 */
import type { IWorld } from '../../core/types';
import type { GuideStep } from '../../game/firstHour';
import { findNearestBlock, nudgeFor, stillThere, type Nudge } from '../../game/nextStep';
import type { ObjectiveTracker } from '../../game/objectives';
import type { PlayerState } from '../../game/playerState';
import { h, setAttr, setText } from '../kit/dom';
import { glyph } from '../kit/icons';
import { relativeBearing } from './hudMath';

const DEG = 180 / Math.PI;
/** The hint closes by itself after this long. */
export const NUDGE_SHOW_S = 30;
const REFRESH_S = 1;
/** On the guided first hour, the button starts to pulse when the same step has stood this long: a quiet "stuck? ask me". */
export const NUDGE_IDLE_S = 75;

/** The first sentence of a camp step's text, as the hint (the full text lives on the Town page). */
export function firstSentence(text: string): string {
  const m = /^.*?[.!?](\s|$)/.exec(text);
  return (m ? m[0] : text).trim();
}

interface Spot {
  x: number;
  y: number;
  z: number;
}

export class NudgeBar {
  readonly el: HTMLDivElement;
  private readonly ask: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private readonly needle: HTMLSpanElement;
  private readonly textEl: HTMLSpanElement;
  private readonly distEl: HTMLSpanElement;
  private openS = 0;
  private sinceS = 0;
  private open = false;
  private nudge: Nudge | null = null;
  private spot: Spot | null = null;
  private shownAngle = Number.NaN;
  private stepId = '';
  private stepS = 0;
  private pulsing = false;

  constructor(
    private readonly world: IWorld,
    private readonly player: PlayerState,
    private readonly objectives: ObjectiveTracker,
    private readonly guide: () => GuideStep | null = () => null,
    private readonly campSpot: () => Spot | null = () => null,
  ) {
    this.needle = h('span', { class: 'hw-compass__needle' }, glyph('needle', 16));
    this.textEl = h('span', { class: 'hw-nudge__text' });
    this.distEl = h('span', { class: 'hw-nudge__dist hw-num' });
    this.panel = h('div', { class: 'hw-nudge__panel hw-hud-plate', attrs: { role: 'status' } }, this.needle, h('span', { class: 'hw-nudge__body' }, this.textEl, this.distEl));
    this.panel.hidden = true;
    this.ask = h('button', { class: 'hw-nudge__ask hw-hud-plate', attrs: { type: 'button', 'aria-expanded': 'false' }, text: 'What next?' });
    this.ask.addEventListener('click', () => this.toggle());
    this.el = h('div', { class: 'hw-nudge', attrs: { 'data-testid': 'nudge' } }, this.ask, this.panel);
  }

  toggle(): void {
    this.setPulse(false);
    this.stepS = 0;
    if (this.open) return this.close();
    this.open = true;
    this.openS = 0;
    this.sinceS = REFRESH_S;
    this.spot = null;
    this.nudge = null;
    this.panel.hidden = false;
    setAttr(this.ask, 'aria-expanded', 'true');
    this.refresh();
  }

  private close(): void {
    this.open = false;
    this.panel.hidden = true;
    setAttr(this.ask, 'aria-expanded', 'false');
  }

  /** Every frame while open: the arrow follows the view. */
  aim(): void {
    if (!this.open || !this.spot) return;
    const p = this.player;
    const angle = Math.round(relativeBearing(p.position.x, p.position.z, p.yaw, this.spot.x + 0.5, this.spot.z + 0.5) * DEG);
    if (angle === this.shownAngle) return;
    this.shownAngle = angle;
    this.needle.style.transform = `rotate(${angle}deg)`;
  }

  private setPulse(on: boolean): void {
    if (on === this.pulsing) return;
    this.pulsing = on;
    this.ask.classList.toggle('hw-nudge__ask--pulse', on);
  }

  /** Counts how long the guided step has stood; the button pulses once when it has been a while. */
  private watchStep(dt: number): void {
    const step = this.guide();
    const id = step ? `${step.kind}:${step.id}` : '';
    if (id !== this.stepId) {
      this.stepId = id;
      this.stepS = 0;
      this.setPulse(false);
      return;
    }
    if (!id || this.open) return;
    this.stepS += dt;
    if (this.stepS >= NUDGE_IDLE_S) this.setPulse(true);
  }

  frame(dt: number): void {
    this.watchStep(dt);
    if (!this.open) return;
    this.openS += dt;
    this.sinceS += dt;
    if (this.openS >= NUDGE_SHOW_S) return this.close();
    if (this.sinceS >= REFRESH_S) this.refresh();
    this.aim();
  }

  /** Re-reads the goal (it moves on as the pack changes) and finds the target again only when the step or the spot changed. */
  private refresh(): void {
    this.sinceS = 0;
    const step = this.guide();
    const spot = step?.kind === 'camp' ? this.campSpot() : null;
    const next: Nudge | null = step?.kind === 'camp' ? { text: firstSentence(step.text), target: spot ? { kind: 'pos', ...spot } : null } : nudgeFor(this.player, this.objectives.current);
    const target = next?.target ?? null;
    const sameStep = this.nudge && next && this.nudge.text === next.text;
    this.nudge = next;
    if (!target) this.spot = null;
    else if (target.kind === 'pos') this.spot = { x: target.x, y: target.y, z: target.z };
    else if (!sameStep || !this.spot || !stillThere(this.world, this.spot, target.keys)) {
      const found = findNearestBlock(this.world, this.player.position, target.keys);
      this.spot = found ? { x: found.x, y: found.y, z: found.z } : null;
    }
    this.needle.hidden = this.spot === null;
    this.shownAngle = Number.NaN;
    if (!next) {
      setText(this.textEl, 'All goals done. Build on.');
      setText(this.distEl, '');
      return;
    }
    setText(this.textEl, next.text);
    if (this.spot) {
      const p = this.player.position;
      const flat = Math.round(Math.hypot(this.spot.x + 0.5 - p.x, this.spot.z + 0.5 - p.z));
      const dy = Math.round(this.spot.y - p.y);
      setText(this.distEl, `${flat < 2 && Math.abs(dy) < 2 ? 'here' : `${flat} m`}${Math.abs(dy) >= 3 ? (dy > 0 ? `, ${dy} up` : `, ${-dy} down`) : ''}`);
    } else {
      setText(this.distEl, target ? 'none nearby - explore' : '');
    }
    this.aim();
  }
}
