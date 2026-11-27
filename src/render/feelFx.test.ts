import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { FeelFx, FX_MAX } from './feelFx';
import { createWorldUniforms } from './materials';
import { Particles } from './particles';

function setup(reduced = false) {
  const bus = createBus();
  const particles = new Particles(createWorldUniforms(null), 4096);
  const fx = new FeelFx(bus, particles, () => reduced);
  return { bus, particles, fx };
}

describe('feel fx', () => {
  it('draws a burst for the bus event, and caps what one event can make', () => {
    const { bus, particles } = setup();
    bus.emit('fx:burst', { kind: 'splash', x: 0, y: 5, z: 0 });
    expect(particles.count).toBeGreaterThan(5);
    const before = particles.count;
    bus.emit('fx:burst', { kind: 'dust', x: 0, y: 5, z: 0, count: 500 });
    expect(particles.count - before).toBe(FX_MAX);
  });

  it('draws every kind of burst', () => {
    const { bus, particles } = setup();
    for (const kind of ['splash', 'dust', 'snow', 'hearts', 'sparkle', 'steam', 'poof', 'hit', 'glow', 'bobber', 'bobber_dip', 'ripple'] as const) {
      const n = particles.count;
      bus.emit('fx:burst', { kind, x: 0, y: 5, z: 0 });
      expect(particles.count, kind).toBeGreaterThan(n);
    }
  });

  it('keeps only a token few under reduced motion, but still the bobber', () => {
    const { bus, particles } = setup(true);
    bus.emit('fx:burst', { kind: 'splash', x: 0, y: 5, z: 0 });
    expect(particles.count).toBe(2);
    bus.emit('fx:burst', { kind: 'bobber', x: 0, y: 5, z: 0 });
    expect(particles.count).toBe(3);
  });

  it('stops listening when disposed', () => {
    const { bus, particles, fx } = setup();
    fx.dispose();
    bus.emit('fx:burst', { kind: 'splash', x: 0, y: 5, z: 0 });
    expect(particles.count).toBe(0);
  });
});
