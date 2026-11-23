import { describe, expect, it } from 'vitest';
import { AUTOMATONS, creature } from '../../core/registry';
import { automatonPose, HAMMER_RAISE, newPose, newPoseMemory, poseStyle, SLAM_RAISE, SWING_S, swingAngle, turnBetween, type PoseView } from './poses';

const view = (extra: Partial<PoseView> = {}): PoseView => ({ id: 1, yaw: 0.4, stride: 0, glow: 1, flare: 0, attack: null, dormant: false, ...extra });
const run = (style: ReturnType<typeof poseStyle>, v: PoseView, mem = newPoseMemory(), frames = 40) => {
  const out = newPose();
  for (let i = 0; i < frames; i++) automatonPose(style, v, mem, 0, i * 0.016, 0.016, out);
  return out;
};

describe('pose styles', () => {
  it('maps each of the six automatons to its own way of moving', () => {
    const styles = Object.fromEntries(AUTOMATONS.map((s) => [s.key, poseStyle(s)]));
    expect(styles).toEqual({
      cinder_mite: 'bite', forge_warden: 'hammer', kiln_sentry: 'turret', bellows_hound: 'dash', arc_drone: 'hover', slag_colossus: 'slam',
      // The feral servants of the five biomes (src/content/biomeMobs.ts).
      barkwright: 'hammer', glass_scarab: 'dash', rime_husk: 'hammer', magma_crawler: 'bite', bog_lantern: 'hover',
    });
  });
});

describe('swing curve', () => {
  it('comes down fast, holds, then settles back to rest within SWING_S', () => {
    expect(swingAngle(0, HAMMER_RAISE, 1)).toBeCloseTo(HAMMER_RAISE, 5);
    expect(swingAngle(0.1, HAMMER_RAISE, 1)).toBeCloseTo(1, 5);
    expect(swingAngle(0.2, HAMMER_RAISE, 1)).toBeCloseTo(1, 5);
    expect(swingAngle(SWING_S, HAMMER_RAISE, 1)).toBeCloseTo(0, 5);
    let prev = swingAngle(0.28, HAMMER_RAISE, 1);
    for (let t = 0.3; t <= SWING_S; t += 0.02) {
      const a = swingAngle(t, HAMMER_RAISE, 1);
      expect(a).toBeLessThanOrEqual(prev + 1e-9);
      prev = a;
    }
  });

  it('turnBetween takes the short way round', () => {
    expect(turnBetween(0.1, 0.3)).toBeCloseTo(0.2, 6);
    expect(turnBetween(3, -3)).toBeCloseTo(2 * Math.PI - 6, 6);
    expect(turnBetween(-3, 3)).toBeCloseTo(6 - 2 * Math.PI, 6);
  });
});

describe('automaton pose', () => {
  it('raises the warden hammer arm through a wind-up and keeps the shield low', () => {
    const idle = run('hammer', view());
    const mid = run('hammer', view({ attack: 'melee', flare: 0.5 }));
    const full = run('hammer', view({ attack: 'melee', flare: 1 }));
    expect(idle.armR).toBeCloseTo(0, 2);
    expect(mid.armR).toBeGreaterThan(0.8);
    expect(full.armR).toBeGreaterThan(HAMMER_RAISE - 0.05);
    expect(full.armL).toBeLessThan(0.6);
    expect(full.flare).toBe(1);
  });

  it('swings the hammer down after the release and lets it settle', () => {
    const mem = newPoseMemory();
    mem.armR = HAMMER_RAISE;
    mem.sinceAttack = 0;
    const out = newPose();
    for (let i = 0; i < 10; i++) automatonPose('hammer', view(), mem, 0, 0, 0.016, out);
    expect(out.armR).toBeLessThan(HAMMER_RAISE - 0.6);
    expect(out.flare).toBeGreaterThan(0.5); // the flash of the blow
    for (let i = 0; i < 80; i++) automatonPose('hammer', view(), mem, 0, 0, 0.016, out);
    expect(out.armR).toBeCloseTo(0, 1);
    expect(out.flare).toBe(0);
  });

  it('raises both colossus fists and squashes it on impact', () => {
    const up = run('slam', view({ attack: 'slam', flare: 1 }));
    expect(up.armL).toBeGreaterThan(SLAM_RAISE - 0.05);
    expect(up.armR).toBeGreaterThan(SLAM_RAISE - 0.05);
    const mem = newPoseMemory();
    mem.sinceAttack = 0.12;
    const out = automatonPose('slam', view(), mem, 0, 0, 0.016, newPose());
    expect(out.squash).toBeLessThan(1);
  });

  it('crouches the hound while it winds up standing still, and not once it runs', () => {
    const crouch = run('dash', view({ attack: 'dash', flare: 1, stride: 0 }));
    const run1 = run('dash', view({ attack: 'dash', flare: 1, stride: 1 }));
    expect(crouch.squash).toBeLessThan(0.85);
    expect(crouch.headPitch).toBeLessThan(0);
    expect(run1.squash).toBeCloseTo(1, 5);
  });

  it('keeps a sentry on its tripod and turns only the kiln', () => {
    const mem = newPoseMemory();
    automatonPose('turret', view({ yaw: 1 }), mem, 0, 0, 0.016, newPose());
    const out = automatonPose('turret', view({ yaw: 1.7 }), mem, 0, 0, 0.016, newPose());
    expect(out.yaw).toBe(1);
    expect(out.headTurn).toBeCloseTo(0.7, 6);
  });

  it('bobs a hovering drone within a few hundredths of a block and spins its coil faster when winding up', () => {
    const mem = newPoseMemory();
    const out = newPose();
    let lo = 1;
    let hi = -1;
    for (let i = 0; i < 400; i++) {
      automatonPose('hover', view(), mem, 0, i * 0.016, 0.016, out);
      lo = Math.min(lo, out.lift);
      hi = Math.max(hi, out.lift);
    }
    expect(hi).toBeLessThanOrEqual(0.07 + 1e-9);
    expect(lo).toBeGreaterThanOrEqual(-0.07 - 1e-9);
    expect(hi - lo).toBeGreaterThan(0.1);
    const slow = newPoseMemory();
    const fast = newPoseMemory();
    automatonPose('hover', view(), slow, 0, 0, 0.1, newPose());
    automatonPose('hover', view({ attack: 'zap', flare: 1 }), fast, 0, 0, 0.1, newPose());
    expect(fast.spin).toBeGreaterThan(slow.spin * 5);
  });

  it('slumps and goes dark when dormant, and does not move on its own', () => {
    const out = run('hammer', view({ glow: 0, dormant: true }));
    expect(out.ember).toBe(0);
    expect(out.headPitch).toBeLessThan(-0.2);
    const hover = run('hover', view({ glow: 0, dormant: true }));
    expect(hover.lift).toBe(0);
  });

  it('does not ease or age anything while paused (dt = 0)', () => {
    const mem = newPoseMemory();
    mem.sinceAttack = 0.2;
    const out = newPose();
    automatonPose('hammer', view({ attack: 'melee', flare: 1 }), mem, 0, 1, 0, out);
    expect(mem.sinceAttack).toBe(0.2);
    expect(mem.armR).toBe(0);
  });

  it('every automaton species has a style that produces finite numbers', () => {
    for (const s of AUTOMATONS) {
      const o = run(poseStyle(creature(s.key)), view({ attack: s.hostile!.attack, flare: 0.7, stride: 0.5 }));
      for (const k of Object.keys(o) as (keyof typeof o)[]) expect(Number.isFinite(o[k])).toBe(true);
    }
  });
});
