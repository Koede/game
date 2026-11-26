import { describe, expect, it } from 'vitest';
import { COLOR_MODES } from '../../core/context';
import { luminance } from './format';
import { RAMPS, rampFor, rampGradient, sampleRamp, type RampKind } from './palette';

describe('colour-blind palettes', () => {
  it('has a heat and a power ramp for every mode', () => {
    for (const mode of COLOR_MODES) for (const kind of ['heat', 'power'] as RampKind[]) expect(RAMPS[mode][kind].length).toBeGreaterThanOrEqual(4);
  });

  it('every ramp gets steadily brighter, so more always reads as brighter whatever the hue', () => {
    for (const mode of COLOR_MODES) {
      for (const kind of ['heat', 'power'] as RampKind[]) {
        const lum = RAMPS[mode][kind].map(luminance);
        for (let i = 1; i < lum.length; i++) expect(lum[i], `${mode} ${kind} stop ${i}`).toBeGreaterThan(lum[i - 1]);
      }
    }
  });

  it('the colour-blind ramps differ from the default and from each other', () => {
    expect(rampFor('red-green', 'heat')).not.toEqual(rampFor('off', 'heat'));
    expect(rampFor('blue-yellow', 'heat')).not.toEqual(rampFor('red-green', 'heat'));
    expect(rampFor(undefined, 'power')).toBe(RAMPS.off.power);
  });

  it('samples the ends exactly, mixes in between and clamps', () => {
    const stops = rampFor('off', 'power');
    expect(sampleRamp(stops, 0)).toEqual([...stops[0]]);
    expect(sampleRamp(stops, 1)).toEqual([...stops[stops.length - 1]]);
    expect(sampleRamp(stops, -3)).toEqual(sampleRamp(stops, 0));
    expect(sampleRamp(stops, 9)).toEqual(sampleRamp(stops, 1));
    expect(sampleRamp(stops, NaN)).toEqual(sampleRamp(stops, 0));
    expect(sampleRamp([[0, 0, 0], [200, 100, 50]], 0.5)).toEqual([100, 50, 25]);
  });

  it('writes a gradient with an even stop spread', () => {
    expect(rampGradient([[0, 0, 0], [255, 255, 255]])).toBe('linear-gradient(to right, rgb(0 0 0) 0%, rgb(255 255 255) 100%)');
  });
});
