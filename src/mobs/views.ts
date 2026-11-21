/** Interpolated, render-ready views of the animals and automatons (reused objects, no allocation once warm). */
import { MOB_BABY_SCALE, MOB_DEATH_S } from '../core/constants';
import { angleDiff } from './brain';
import { CORPSE_FADE_S, FLASH_S } from './constants';
import type { Mob, MobView } from './types';

/** Leg swing reaches its full stride at this fraction of the species speed. */
const FULL_STRIDE = 0.9;

function blankView(m: Mob): MobView {
  return {
    id: 0, spec: m.spec, x: 0, y: 0, z: 0, yaw: 0, scale: 1, walk: 0, stride: 0, head: 0, flash: 0, tip: 0, fade: 0,
    onGround: true, eager: false, glow: 0, flare: 0, attack: null, dormant: false,
  };
}

function fill(v: MobView, m: Mob, t: number): void {
  v.id = m.id;
  v.spec = m.spec;
  v.x = m.px + (m.x - m.px) * t;
  v.y = m.py + (m.y - m.py) * t;
  v.z = m.pz + (m.z - m.pz) * t;
  v.yaw = m.pyaw + angleDiff(m.pyaw, m.yaw) * t;
  v.scale = m.baby ? MOB_BABY_SCALE : 1;
  v.walk = m.pwalk + (m.walk - m.pwalk) * t;
  v.stride = m.spec.speed > 0 ? Math.min(1, m.speed / (m.spec.speed * FULL_STRIDE)) : 0;
  v.head = m.phead + (m.head - m.phead) * t;
  v.flash = m.hurtS / FLASH_S;
  v.tip = m.state === 'dying' ? Math.min(1, m.deadS / MOB_DEATH_S) : 0;
  v.fade = m.state === 'dying' ? Math.max(0, Math.min(1, (m.deadS - MOB_DEATH_S) / CORPSE_FADE_S)) : 0;
  v.onGround = m.onGround;
  v.eager = m.eagerS > 0;
  const h = m.hostile;
  if (h === null) {
    v.glow = 0;
    v.flare = 0;
    v.attack = null;
    v.dormant = false;
    return;
  }
  v.glow = m.state === 'dying' ? 0 : h.pglow + (h.glow - h.pglow) * t;
  const windup = m.spec.hostile?.windupS ?? 1;
  v.flare = h.mode === 'windup' ? Math.min(1, h.windS / windup) : h.mode === 'dash' ? 1 : 0;
  v.attack = h.mode === 'windup' || h.mode === 'dash' ? (m.spec.hostile?.attack ?? null) : null;
  v.dormant = h.mode === 'dormant';
}

/**
 * Fills `list` (cleared first) with the views of `animals` then `hostiles`, from `pool` (grown when needed);
 * `alpha` (0..1) is how far between the previous tick and the latest. Returns `list`.
 */
export function fillViews(animals: readonly Mob[], hostiles: readonly Mob[], alpha: number, pool: MobView[], list: MobView[]): MobView[] {
  const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  list.length = 0;
  let n = 0;
  for (const group of [animals, hostiles]) {
    for (let i = 0; i < group.length; i++, n++) {
      const m = group[i];
      if (pool.length <= n) pool.push(blankView(m));
      fill(pool[n], m, t);
      list.push(pool[n]);
    }
  }
  return list;
}
