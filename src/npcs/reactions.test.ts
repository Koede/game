import { describe, expect, it } from 'vitest';
import { PEOPLE } from './contentment';
import { lifeRig } from './life.rig';
import { AGE_TALK, DISASTER_SHOUTS, ageTalk, disasterShout, weatherTalk } from './reactions';

describe('age talk', () => {
  it('gives every person a line for every age 1..5', () => {
    for (const p of PEOPLE) for (let a = 1; a <= 5; a++) expect(AGE_TALK[p][a]?.length, `${p} ${a}`).toBeGreaterThan(20);
  });
  it('falls back to the nearest earlier age and is null before bronze', () => {
    expect(ageTalk('orrin', 9)?.age).toBe(5);
    expect(ageTalk('orrin', 0)).toBeNull();
  });
  it('is said once per age on an odd visit, after the goal hint', () => {
    const r = lifeRig();
    r.state.goal = null;
    r.state.age = 3;
    const orrin = r.by('orrin');
    r.npcs.speak(orrin); // the gift
    const first = r.npcs.speak(orrin);
    expect(first).toBe(AGE_TALK.orrin[3]);
    r.npcs.speak(orrin);
    const third = r.npcs.speak(orrin);
    expect(third).not.toBe(AGE_TALK.orrin[3]);
  });
});

describe('disasters and weather', () => {
  it('shouts at warning and imminent, stays quiet on a watch', () => {
    expect(disasterShout('boiler', 'watch', Math.random)).toBeNull();
    for (const k of Object.keys(DISASTER_SHOUTS) as Array<keyof typeof DISASTER_SHOUTS>) expect(disasterShout(k, 'warning', () => 0)).toBeTruthy();
    expect(weatherTalk('clear', Math.random)).toBeNull();
    expect(weatherTalk('storm', Math.random)).toBeTruthy();
  });
  it('a resident calls out on disaster:warn, once per level per day', () => {
    const r = lifeRig();
    r.bus.emit('disaster:warn', { kind: 'boiler', level: 'imminent', x: 0, y: 0, z: 0 });
    r.bus.emit('disaster:warn', { kind: 'boiler', level: 'imminent', x: 0, y: 0, z: 0 });
    expect(r.toasts.filter((t) => t.includes('"'))).toHaveLength(1);
    r.state.day++;
    r.bus.emit('disaster:warn', { kind: 'boiler', level: 'imminent', x: 0, y: 0, z: 0 });
    expect(r.toasts.filter((t) => t.includes('"'))).toHaveLength(2);
  });
  it('someone mentions a storm rolling in', () => {
    const r = lifeRig();
    r.bus.emit('weather:changed', { kind: 'storm', previous: 'rain' });
    expect(r.toasts).toHaveLength(1);
  });
});

describe("Veyra's tonic offer", () => {
  it('closes after its window instead of staying open for days', () => {
    const r = lifeRig({ coins: 100, pack: { glass_vial: 5 } });
    const veyra = r.by('veyra');
    for (let i = 0; i < 6 && r.npcs.serviceMenu('veyra').open === null; i++) r.npcs.speak(veyra);
    const menu = r.npcs.serviceMenu('veyra');
    expect(menu.open).not.toBeNull();
    r.npcs.tick(30);
    expect(menu.open).toBeNull();
  });
});
