/**
 * The HUD's Emberbound cues (spec 19.5): a red pulse at the screen edge towards whatever just hit the player
 * ('player:attacked'), an ember arrow at the edge towards an automaton winding up an attack out of view
 * ('hostile:windup' until it is released), and a flicker of flame at the edges while the player burns.
 * Everything here ignores input and costs nothing while idle.
 */
import { creatureOrNull } from '../../core/registry';
import type { HostileAttack } from '../../core/types';
import { h, setFlag } from '../kit/dom';
import { glyph } from '../kit/icons';
import {
  Dangers, edgePoint, HIT_PULSE_S, hitStrength, inView, MAX_DANGERS, MAX_HIT_PULSES, pulseDegrees, pulseOpacity, screenAngle,
  type EdgeRect, type HitPulse, type ViewPose,
} from './combatMath';

/** What the cues read every frame: where the player looks from. */
export interface CuePlayer {
  readonly position: { x: number; y: number; z: number };
  readonly eyeY: number;
  readonly yaw: number;
  readonly pitch: number;
}

/** Arrows keep this far inside the free part of the screen (px). */
const EDGE_INSET = 30;
/** The touch overlay's buttons and stick own the lower part of a phone screen (px above the bottom edge). */
const TOUCH_RESERVE_PORTRAIT = 270;
const TOUCH_RESERVE_LANDSCAPE = 176;
const MEASURE_S = 0.5;

const ATTACK_WORDS: Record<HostileAttack, string> = {
  melee: 'winds up a blow',
  slam: 'raises its arms',
  dash: 'crouches to charge',
  bolt: 'aims an ember bolt',
  zap: 'crackles',
};

interface Arrow {
  el: HTMLDivElement;
  pointer: HTMLDivElement;
  id: number;
}

export class CombatCues {
  readonly el: HTMLDivElement;
  private readonly burn: HTMLDivElement;
  private readonly pulseEls: HTMLDivElement[] = [];
  private readonly pulses: HitPulse[] = [];
  private readonly arrows: Arrow[] = [];
  private readonly dangers = new Dangers();
  private readonly pose: ViewPose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fovDeg: 72, aspect: 1 };
  private readonly rect: EdgeRect = { left: 0, top: 0, right: 0, bottom: 0 };
  private readonly point = { x: 0, y: 0 };
  private now = 0;
  private measuredAt = -Infinity;
  private burning = false;

  /**
   * `top` and `bottom` are the HUD rows the arrows stay between (measured, not assumed); `touch` says whether the
   * touch overlay's buttons hold the lower part of the screen.
   */
  constructor(private readonly top: HTMLElement, private readonly bottom: HTMLElement, private readonly touch: () => boolean) {
    for (let i = 0; i < MAX_HIT_PULSES; i++) {
      const el = h('div', { class: 'hw-hitdir' });
      el.hidden = true;
      this.pulseEls.push(el);
    }
    for (let i = 0; i < MAX_DANGERS; i++) {
      const pointer = h('div', { class: 'hw-danger__pointer' });
      const el = h('div', { class: 'hw-danger', attrs: { role: 'img' } }, pointer, h('div', { class: 'hw-danger__mark' }, glyph('automaton', 16)));
      el.hidden = true;
      this.arrows.push({ el, pointer, id: -1 });
    }
    this.burn = h('div', { class: 'hw-burnfx' });
    this.burn.hidden = true;
    this.el = h('div', { class: 'hw-cues', attrs: { 'aria-hidden': 'true' } }, this.burn, ...this.pulseEls, ...this.arrows.map((a) => a.el));
  }

  /** 'player:attacked': a pulse towards x,z (the automaton or the bolt), stronger for bigger hits. */
  hit(x: number, z: number, amount: number): void {
    if (this.pulses.length >= MAX_HIT_PULSES) this.pulses.shift();
    this.pulses.push({ x, z, at: this.now, strength: hitStrength(amount) });
  }

  /** 'hostile:windup'. */
  windup(id: number, species: string, attack: HostileAttack, x: number, y: number, z: number, durationS: number): void {
    this.dangers.windup(id, species, attack, x, y, z, durationS, this.now);
    this.measuredAt = -Infinity;
  }

  /** 'hostile:attack': the warning fades out shortly. */
  release(id: number): void {
    this.dangers.release(id, this.now);
  }

  /** 'mob:died' (or despawned): drop its warning. */
  forget(id: number): void {
    this.dangers.remove(id);
  }

  /** Death, respawn, a new session: nothing pending. */
  clear(): void {
    this.dangers.clear();
    this.pulses.length = 0;
    for (const el of this.pulseEls) el.hidden = true;
    for (const a of this.arrows) a.el.hidden = true;
  }

  /** The player burns (PlayerCombat.burning): flames lick at the screen edges. */
  setBurning(on: boolean): void {
    if (on === this.burning) return;
    this.burning = on;
    this.burn.hidden = !on;
  }

  /** Every frame. `fovDeg` is Settings.fov (vertical). */
  frame(dt: number, player: CuePlayer, fovDeg: number): void {
    this.now += dt;
    if (this.pulses.length === 0 && this.dangers.list.length === 0) {
      if (!this.pulseEls[0].hidden || this.arrows.some((a) => !a.el.hidden)) this.clearShown();
      return;
    }
    this.updatePulses(player);
    this.updateArrows(player, fovDeg);
  }

  private clearShown(): void {
    for (const el of this.pulseEls) el.hidden = true;
    for (const a of this.arrows) a.el.hidden = true;
  }

  private updatePulses(player: CuePlayer): void {
    for (let i = this.pulses.length - 1; i >= 0; i--) if (this.now - this.pulses[i].at >= HIT_PULSE_S) this.pulses.splice(i, 1);
    this.pulseEls.forEach((el, i) => {
      const p = this.pulses[i];
      if (!p) {
        el.hidden = true;
        return;
      }
      el.hidden = false;
      el.style.setProperty('--hw-dir', `${pulseDegrees(player.position.x, player.position.z, player.yaw, p.x, p.z).toFixed(1)}deg`);
      el.style.opacity = pulseOpacity(p.strength, this.now - p.at).toFixed(3);
    });
  }

  private updateArrows(player: CuePlayer, fovDeg: number): void {
    this.dangers.prune(this.now);
    const list = this.dangers.list;
    if (list.length === 0) {
      for (const a of this.arrows) a.el.hidden = true;
      return;
    }
    if (this.now - this.measuredAt >= MEASURE_S) this.measure();
    const pose = this.pose;
    pose.x = player.position.x;
    pose.y = player.eyeY;
    pose.z = player.position.z;
    pose.yaw = player.yaw;
    pose.pitch = player.pitch;
    pose.fovDeg = fovDeg;
    pose.aspect = Math.max(0.2, innerWidth / Math.max(1, innerHeight));
    this.arrows.forEach((a, i) => {
      const d = list[i];
      // Aim at the automaton's chest, not its feet.
      if (!d || inView(pose, d.x, d.y + 1, d.z)) {
        a.el.hidden = true;
        a.id = -1;
        return;
      }
      const angle = screenAngle(pose, d.x, d.y + 1, d.z);
      const at = edgePoint(angle, this.rect, this.point);
      a.el.hidden = false;
      a.el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
      a.pointer.style.transform = `rotate(${((angle * 180) / Math.PI).toFixed(1)}deg)`;
      setFlag(a.el, 'released', d.released);
      if (a.id !== d.id) {
        a.id = d.id;
        const name = creatureOrNull(d.species)?.name ?? 'An automaton';
        a.el.setAttribute('aria-label', `${name} ${ATTACK_WORDS[d.attack]} out of view`);
        // Restart the pulse animation for a new warning.
        a.el.classList.remove('hw-danger--new');
        void a.el.offsetWidth;
        a.el.classList.add('hw-danger--new');
      }
    });
  }

  /** The free band between the HUD's top row and the hotbar (and above the touch buttons on a phone). */
  private measure(): void {
    this.measuredAt = this.now;
    const w = innerWidth;
    const hgt = innerHeight;
    const top = this.top.getBoundingClientRect().bottom;
    let bottom = this.bottom.getBoundingClientRect().top;
    if (this.touch()) bottom = Math.min(bottom, hgt - (w > hgt ? TOUCH_RESERVE_LANDSCAPE : TOUCH_RESERVE_PORTRAIT));
    const r = this.rect;
    r.left = EDGE_INSET;
    r.right = w - EDGE_INSET;
    r.top = Math.min(top + EDGE_INSET, hgt / 2 - 40);
    r.bottom = Math.max(bottom - EDGE_INSET, hgt / 2 + 40);
  }
}
