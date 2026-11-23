import { describe, expect, it } from 'vitest';
import { GameState } from '../app/state';
import { createBus } from '../core/context';
import { blockOf } from '../core/registry';
import { FakeWorld } from '../game/fakeWorld';
import { hasPortrait, paintPortrait, PORTRAIT_PX } from '../render/npcs/portraits';
import { opaqueIn, paintNpc, RES, SPRITE_H, SPRITE_W, spriteSize } from '../render/npcs/sprites';
import {
  BOUNTIES, bankSize, clockText, Companion, FIRE_SPOTS, HIRE_COST, layoutBlocks, LinePicker, NPCS, NpcManager, priceOf, stackPrice,
  BASEMENT_DEPTH, TAVERN_D, TAVERN_H, TAVERN_START, TAVERN_TOP, TAVERN_W, YARD_D, type NpcHost,

} from './index';
import { findPath, nearestCell, walkable } from './nav';
import { DANCE_SPOTS, ROUTINES } from './routines';
import { danceFrame, dancePose, danceMoveIndex, LOOP_S, MOVES, SECTION_BEATS, LOOP_BEATS } from './choreo';
import { BEAT_S, notesAt, TUNE } from './jukebox';
import { FACES, faceOf } from './mood';
import { ARTIFICER } from './scripts/artificer';
import { BARKEEP } from './scripts/barkeep';
import { HERMIT } from './scripts/hermit';
import { ORC } from './scripts/orc';
import { WITCH } from './scripts/witch';

describe('the tavern layout', () => {
  const blocks = layoutBlocks();
  const at = (x: number, y: number, z: number): string | undefined => [...blocks].reverse().find((b) => b.x === x && b.y === y && b.z === z)?.block;

  it('fits its box (hall and yard) and uses only common blocks', () => {
    for (const b of blocks) {
      expect(b.x >= 0 && b.x < TAVERN_W && b.y >= -BASEMENT_DEPTH && b.y <= TAVERN_TOP && b.z >= 0 && b.z < TAVERN_D + YARD_D, `${b.block} ${b.x},${b.y},${b.z}`).toBe(true);
    }
    const allowed = ['air', 'plank', 'stone_brick', 'oak_log', 'glass', 'crate', 'torch', 'chopping_block', 'furnace_clay', 'brick', 'workbench', 'dirt', 'wool_bedding', 'fence'];
    for (const k of new Set(blocks.map((b) => b.block))) expect(allowed).toContain(k);
  });

  it('leaves the start cell, both doors and every person free to stand in', () => {
    const [sx, sy, sz] = TAVERN_START;
    for (const [x, y, z] of [[sx, sy, sz], [sx, sy + 1, sz], [6, 1, 0], [6, 2, 0], [6, 1, 1], [1, 1, TAVERN_D - 1], [1, 2, TAVERN_D - 1]]) {
      const b = at(x, y, z);
      expect(b === undefined || b === 'air', `${x},${y},${z} is ${b}`).toBe(true);
    }
    for (const n of NPCS.filter((p) => p.kind === 'person')) {
      for (const dy of [0, 1]) {
        const b = at(n.at[0], n.at[1] + dy, n.at[2]);
        expect(b === undefined || b === 'air', `${n.name} stands in ${b}`).toBe(true);
      }
      const floor = at(n.at[0], n.at[1] - 1, n.at[2]);
      expect(['plank', 'dirt'], `${n.name} has a floor`).toContain(floor);
    }
  });

  it('has a roof, a bar, two fires and windows', () => {
    expect(at(6, TAVERN_H, 4)).toBe('plank');
    expect(at(5, 1, 5)).toBe('plank');
    for (const [x, y, z] of FIRE_SPOTS) expect(at(x, y, z)).toBe('furnace_clay');
    expect(blocks.filter((b) => b.block === 'glass').length).toBeGreaterThanOrEqual(8);
  });

  it('puts the quest board and the clock on the wall by the door, inside the hall', () => {
    for (const id of ['board', 'clock']) {
      const p = NPCS.find((n) => n.id === id)!;
      expect(p.kind).toBe('prop');
      expect(p.at[2]).toBeLessThan(1.5);
      expect(p.at[0]).toBeGreaterThan(1);
      expect(p.at[0]).toBeLessThan(TAVERN_W - 1);
    }
  });
});

describe('the jukebox', () => {
  it('toggles, plays a pitched tune on the beat and makes everyone but Gruk dance', () => {
    const { npcs, by } = rig();
    const bus = (npcs as unknown as { bus: { on: (n: string, f: (e: { pitch?: number }) => void) => void } }).bus;
    const notes: number[] = [];
    bus.on('sfx', (e) => void (e.pitch !== undefined && notes.push(e.pitch)));
    expect(npcs.views().some((v) => v.dancing)).toBe(false);
    npcs.speak(by('jukebox'));
    expect(npcs.jukeboxOn).toBe(true);
    for (let i = 0; i < 40; i++) npcs.tick(0.1);
    expect(notes.length).toBeGreaterThan(8);
    expect(new Set(notes).size).toBeGreaterThan(3);
    const dancers = npcs.views().filter((v) => v.dancing).map((v) => v.id).sort();
    expect(dancers).toEqual(['bram', 'mara', 'orrin', 'rosa']);
    const saved = npcs.toJSON();
    expect(saved.juke).toBe(true);
    npcs.speak(by('jukebox'));
    expect(npcs.views().some((v) => v.dancing)).toBe(false);
  });

  it('has a looping tune with rests and a bass on every fourth beat', () => {
    expect(notesAt(0).some((n) => n.bass)).toBe(true);
    expect(notesAt(1).some((n) => n.bass)).toBe(false);
    expect(notesAt(TUNE.length)).toEqual(notesAt(0));
    expect(notesAt(15)).toEqual([]);
  });
});

describe('faces', () => {
  it('picks a face from the words of a line', () => {
    const face = (t: string): string => FACES[faceOf(t)];
    expect(face('Bet you wonder how I am still a bum with all this coin. Anyways.')).toBe('laughing');
    expect(face('Do not break them on anything good.')).toBe('annoyed');
    expect(face('Whoa, what?')).toBe('surprised');
    expect(face('Heh. That is a fair price.')).toBe('sly');
    expect(face('Welcome back, friend!')).toBe('happy');
    expect(face('The kiln wants more fuel.')).toBe('neutral');
  });

  it('gives every line a valid cell and every shipped person a six-cell sheet', () => {
    for (const bank of [WITCH, BARKEEP, ORC, ARTIFICER, HERMIT]) {
      for (const line of Object.values(bank).flat().flat().filter((l): l is string => typeof l === 'string').slice(0, 200)) {
        const i = faceOf(line);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(FACES.length);
      }
    }
    expect(FACES).toHaveLength(6);
  });
});

describe('the dance', () => {
  it('lasts a minute and loops seamlessly, to the music', () => {
    expect(LOOP_S).toBe(60);
    expect(TUNE.length * BEAT_S * 5).toBe(LOOP_S);
    expect(MOVES.length * SECTION_BEATS).toBe(LOOP_BEATS);
    for (const id of ['mara', 'rosa', 'orrin', 'bram']) {
      for (let t = 0; t < LOOP_S; t += 0.37) {
        const a = dancePose(id, t);
        const b = dancePose(id, t + LOOP_S);
        for (const key of Object.keys(a) as (keyof typeof a)[]) expect(b[key], `${id} ${key} @${t}`).toBeCloseTo(a[key], 6);
        expect(a.squash).toBeGreaterThan(0.8);
        expect(a.hop).toBeGreaterThanOrEqual(0);
        expect(a.hop).toBeLessThan(0.5);
        expect(Math.abs(a.side)).toBeLessThan(0.6);
      }
    }
  });

  it('steps through pose frames on the beat, looping with the dance', () => {
    const seen = new Set<number>();
    for (let t = 0; t < LOOP_S; t += BEAT_S) {
      const f = danceFrame('rosa', t);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(5);
      expect(danceFrame('rosa', t + LOOP_S)).toBe(f);
      seen.add(f);
    }
    expect(seen.size).toBe(5);
  });

  it('runs through fifteen different moves, and the dancers are never all doing the same one', () => {
    const seen = new Set<number>();
    for (let t = 0; t < LOOP_S; t += SECTION_BEATS * BEAT_S) seen.add(danceMoveIndex('mara', t));
    expect(seen.size).toBe(15);
    for (let t = 0; t < LOOP_S; t += SECTION_BEATS * BEAT_S) {
      const at = new Set(['mara', 'rosa', 'orrin', 'bram'].map((id) => danceMoveIndex(id, t)));
      expect(at.size).toBe(4);
    }
  });
});

function rig(opts: { coins?: number; held?: { item: string; count: number } | null; completed?: string[]; goal?: string | null; tod?: number } = {}) {
  const bus = createBus();
  const given: Array<[string, number]> = [];
  const toasts: string[] = [];
  const taken: number[] = [];
  bus.on('toast', (t) => toasts.push(t.text));
  bus.on('npc:say', (e) => toasts.push(`${e.name}, ${e.title.toLowerCase()}: "${e.text}"`));
  let seed = 7;
  const rng = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const npcs = new NpcManager(bus, rng);
  const state = { goal: opts.goal ?? 'gather_logs', done: new Set(opts.completed ?? []), held: opts.held ?? null, tod: opts.tod ?? 0.3, dead: false, hostiles: [] as { id: number; x: number; y: number; z: number }[] };
  const hits: Array<[number, number]> = [];
  const world = new FakeWorld(bus);
  const host: NpcHost = {
    give: (item, n) => (given.push([item, n]), 0),
    currentGoal: () => state.goal,
    completed: () => state.done,
    timeOfDay: () => state.tod,
    day: () => 3,
    held: () => state.held,
    takeHeld: (n) => void taken.push(n),
    advice: (role) => `ADVICE-${role}`,
    companion: {
      world,
      player: () => ({ x: 100, y: 41, z: 100, dead: state.dead }),
      hostiles: () => state.hostiles,
      hit: (id, dmg) => void hits.push([id, dmg]),
    },
  };
  npcs.bind(host);
  npcs.at = [100, 40, 100];
  npcs.coins = opts.coins ?? 0;
  const by = (id: string) => NPCS.find((n) => n.id === id)!;
  return { npcs, given, toasts, taken, state, hits, by };
}

describe('talking', () => {
  it('finds a person under the crosshair and nobody out of reach or behind', () => {
    const { npcs } = rig();
    const mara = npcs.views().find((v) => v.id === 'mara')!;
    expect(npcs.raycast(mara.x, mara.y + 1.5, mara.z - 3, 0, 0, 1)?.npc.id).toBe('mara');
    expect(npcs.raycast(mara.x, mara.y + 1.5, mara.z - 3, 0, 0, -1)).toBeNull();
    expect(npcs.raycast(mara.x, mara.y + 1.5, mara.z - 8, 0, 0, 1)).toBeNull();
    // Someone standing inside the player (walking through) is not aimed at.
    expect(npcs.raycast(mara.x, mara.y + 1.5, mara.z, 0, 1, 0)).toBeNull();
  });

  it('does not read the whole script while Use is held', () => {
    const { npcs, toasts } = rig();
    const mara = npcs.views().find((v) => v.id === 'mara')!;
    for (let i = 0; i < 5; i++) expect(npcs.talk(mara.x, mara.y + 1.5, mara.z - 3, 0, 0, 1)).toBe(true);
    expect(toasts).toHaveLength(1);
    npcs.tick(1);
    npcs.talk(mara.x, mara.y + 1.5, mara.z - 3, 0, 0, 1);
    expect(toasts).toHaveLength(2);
  });

  it('gives each welcome gift once, then goal hints, specialist advice and banter', () => {
    const r = rig();
    const rosa = r.by('rosa');
    r.npcs.speak(rosa);
    expect(r.given).toEqual([['hearth_stew', 1]]);
    r.npcs.speak(rosa); // odd visit: no hint for gather_logs, so the barkeep's advice
    expect(r.toasts[1]).toContain('ADVICE-barkeep');
    r.npcs.speak(rosa); // even: banter
    expect(r.toasts[2]).not.toContain('ADVICE');
    r.state.goal = 'get_warm';
    r.npcs.speak(rosa); // odd: the goal's hint, once
    expect(r.toasts[3]).toContain('Warmth sticks');
    r.npcs.speak(rosa);
    r.npcs.speak(rosa);
    expect(r.toasts[5]).toContain('ADVICE-barkeep');
    expect(r.given).toHaveLength(1);
  });

  it('gives the artificer\'s wrench and the witch\'s notebook', () => {
    const r = rig({ goal: 'nothing' });
    r.npcs.speak(r.by('orrin'));
    r.npcs.speak(r.by('mara'));
    expect(r.given).toEqual([['wrench', 1], ['field_notebook', 1]]);
    r.npcs.speak(r.by('orrin'));
    r.npcs.speak(r.by('mara'));
    expect(r.toasts.slice(-2).every((t) => t.includes('ADVICE'))).toBe(true);
  });

  it('greets, then round-trips through the save', () => {
    const r = rig({ coins: 12 });
    r.npcs.greet();
    r.npcs.greet();
    expect(r.toasts.filter((t) => t.includes('Hearth & Anvil'))).toHaveLength(1);
    r.npcs.speak(NPCS[0]);
    const back = rig().npcs;
    back.load(JSON.parse(JSON.stringify(r.npcs.toJSON())));
    expect(back.at).toEqual([100, 40, 100]);
    expect(back.greeted).toBe(true);
    expect(back.coins).toBe(12);
    expect(back.toJSON().gifted).toEqual(['mara']);
    back.load({ at: 'bad', gifted: 5, spoken: { x: 'y' }, coins: 'many' });
    expect(back.at).toBeNull();
    expect(back.coins).toBe(0);
  });
});

describe('the quest board', () => {
  it('pays a bounty for each finished goal, only at the board, and only once', () => {
    const r = rig({ completed: ['gather_logs', 'place_chopping_block', 'make_planks'] });
    const board = r.by('board');
    expect(r.npcs.pendingBounties().map((b) => b.id)).toEqual(['gather_logs', 'place_chopping_block', 'make_planks']);
    expect(r.npcs.coins).toBe(0); // nothing is paid until the board is used
    r.npcs.speak(board);
    const total = BOUNTIES.filter((b) => ['gather_logs', 'place_chopping_block', 'make_planks'].includes(b.id)).reduce((s, b) => s + b.coin, 0);
    expect(r.npcs.coins).toBe(total);
    expect(r.toasts[0]).toContain(`+${total} coin`);
    expect(r.toasts[1]).toContain('Open bounties');
    r.npcs.speak(board);
    expect(r.npcs.coins).toBe(total);
    expect(r.toasts.at(-2)).toContain('no bounty to redeem');
    r.state.done.add('place_workbench');
    r.npcs.speak(board);
    expect(r.npcs.coins).toBeGreaterThan(total);
  });

  it('has a bounty for every goal and pays more in later ages and for furnace milestones', () => {
    expect(BOUNTIES.length).toBeGreaterThan(70);
    const by = (id: string) => BOUNTIES.find((b) => b.id === id)!.coin;
    expect(by('bronze_furnace')).toBeGreaterThan(by('gather_logs'));
    expect(by('starhearth')).toBeGreaterThan(by('blast_furnace'));
    expect(BOUNTIES.every((b) => b.coin >= 8)).toBe(true);
  });

  it('keeps claimed bounties in the save', () => {
    const r = rig({ completed: ['gather_logs'] });
    r.npcs.speak(r.by('board'));
    const back = rig({ completed: ['gather_logs'] }).npcs;
    back.load(JSON.parse(JSON.stringify(r.npcs.toJSON())));
    expect(back.pendingBounties()).toEqual([]);
    expect(back.coins).toBe(r.npcs.coins);
  });
});

describe('the clock', () => {
  it('reads the day clock: dawn is 06:00', () => {
    expect(clockText(0)).toBe('06:00');
    expect(clockText(0.5)).toBe('18:00');
    expect(clockText(0.75)).toBe('00:00');
    const r = rig({ tod: 0.5 });
    r.npcs.speak(r.by('clock'));
    expect(r.toasts[0]).toBe('Wall clock: It is 18:00, day 3.');
    expect(r.npcs.views().find((v) => v.id === 'clock')!.extra).toBe(18 * 60);
  });

  it('draws different hands for different times', () => {
    expect(paintNpc('clock', 0).data).not.toEqual(paintNpc('clock', 180).data);
    expect(paintNpc('clock', 180).data).not.toEqual(paintNpc('clock', 190).data);
  });
});

describe('Old Bram the hermit', () => {
  it('buys the held stack at a mood-dependent price and never runs out of coin', () => {
    const r = rig({ held: { item: 'flint', count: 12 } });
    r.npcs.speak(r.by('bram'));
    expect(r.taken).toEqual([12]);
    expect(r.npcs.coins).toBeGreaterThan(0);
    const first = r.npcs.coins;
    r.npcs.tick(1);
    r.npcs.speak(r.by('bram'));
    expect(r.npcs.coins).toBeGreaterThan(first);
    expect(r.toasts[0]).toMatch(/12 flint/);
  });

  it('asks you to hold something when your hand is empty', () => {
    const r = rig({ held: null });
    r.npcs.speak(r.by('bram'));
    expect(r.taken).toEqual([]);
    expect(r.toasts).toHaveLength(1);
  });

  it('prices tools and machines above raw materials, later ages above earlier', () => {
    expect(priceOf('bronze_pickaxe')).toBeGreaterThan(priceOf('flint'));
    expect(priceOf('hand_crank')).toBeGreaterThan(priceOf('copper_ingot'));
    expect(stackPrice('flint', 10)).toBe(priceOf('flint') * 10);
    expect(priceOf('not_an_item')).toBe(0);
  });

  it('has the running joke in his rare lines', () => {
    expect(HERMIT.rare.filter((l) => l.startsWith("Bet you wonder how I'm still a bum with all this coin.... Anyways...")).length).toBeGreaterThanOrEqual(2);
  });
});

describe('Gruk for hire', () => {
  it('offers, takes coin on the second Use, and follows and fights', () => {
    const r = rig({ coins: HIRE_COST + 5 });
    const gruk = r.by('gruk');
    r.npcs.speak(gruk); // gift
    r.npcs.speak(gruk); // talk + offer
    expect(r.toasts.at(-1)).toMatch(/40 coin/);
    r.npcs.speak(gruk); // yes
    expect(r.npcs.coins).toBe(5);
    expect(r.npcs.companion.active).toBe(true);
    expect(r.npcs.views().find((v) => v.id === 'gruk')!.hired).toBe(true);
    r.state.hostiles = [{ id: 9, x: 102, y: 41, z: 100 }];
    for (let i = 0; i < 40; i++) r.npcs.tick(0.1);
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits[0][0]).toBe(9);
  });

  it('refuses without coin and lets the offer lapse', () => {
    const r = rig({ coins: 3 });
    const gruk = r.by('gruk');
    r.npcs.speak(gruk);
    r.npcs.speak(gruk);
    expect(r.toasts.at(-1)).toMatch(/40 coin|Coin first|Not enough/);
    expect(r.npcs.companion.active).toBe(false);
  });

  it('leaves when the time is up or the player dies', () => {
    const r = rig({ coins: 100 });
    r.npcs.speak(r.by('gruk'));
    r.npcs.speak(r.by('gruk'));
    r.npcs.speak(r.by('gruk'));
    expect(r.npcs.companion.active).toBe(true);
    r.state.dead = true;
    r.npcs.tick(0.1);
    expect(r.npcs.companion.active).toBe(false);
    const c = new Companion();
    c.hire(1, 1, 1);
    c.hiredS = 0.05;
    c.update(0.1, { world: new FakeWorld(createBus()), player: () => ({ x: 1, y: 1, z: 1, dead: false }), hostiles: () => [], hit: () => undefined });
    expect(c.active).toBe(false);
  });

  it('is big and is saved with his hire', () => {
    expect(NPCS.find((n) => n.id === 'gruk')!.scale).toBeGreaterThan(1.2);
    const r = rig({ coins: 100 });
    r.npcs.speak(r.by('gruk'));
    r.npcs.speak(r.by('gruk'));
    r.npcs.speak(r.by('gruk'));
    const back = rig().npcs;
    back.load(JSON.parse(JSON.stringify(r.npcs.toJSON())));
    expect(back.companion.active).toBe(true);
  });
});

describe('the scripts', () => {
  const banks = { witch: WITCH, barkeep: BARKEEP, orc: ORC, artificer: ARTIFICER, hermit: HERMIT };
  const every = (b: typeof WITCH): string[] => [...b.greet, ...b.idle, ...b.morning, ...b.evening, ...b.night, ...b.rare, ...b.farewell, ...Object.values(b.hints)];

  it('hold hundreds of different phrases, none repeated within a person', () => {
    let total = 0;
    for (const [name, b] of Object.entries(banks)) {
      const all = every(b);
      const dupes = all.length - new Set(all).size;
      expect(dupes, `${name} repeats ${dupes} lines`).toBeLessThanOrEqual(name === 'hermit' ? 3 : 0); // the hermit's joke is repeated on purpose
      expect(bankSize(b), name).toBe(all.length);
      total += new Set(all).size;
    }
    expect(total).toBeGreaterThan(400);
    for (const b of Object.values(banks)) expect(b.idle.length).toBeGreaterThanOrEqual(50);
  });

  it('keep the voice: no empty lines, sensible length, no placeholders left in the plain banks', () => {
    for (const [name, b] of Object.entries(banks)) {
      for (const l of every(b)) {
        expect(l.trim().length, `${name}: "${l}"`).toBeGreaterThan(10);
        expect(l.length, `${name}: "${l}"`).toBeLessThan(260);
        expect(l, name).not.toMatch(/[{}]/);
      }
    }
  });

  it('are drawn from without repeating lately, by time of day, and rarely rare', () => {
    let seed = 3;
    const rng = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const picker = new LinePicker(rng);
    const said: string[] = [];
    for (let i = 0; i < 40; i++) said.push(picker.pick('mara', WITCH, 'day'));
    for (let i = 14; i < said.length; i++) expect(said.slice(i - 14, i), `line ${i}`).not.toContain(said[i]);
    expect(new Set(said).size).toBeGreaterThan(25);
    const night = Array.from({ length: 200 }, () => new LinePicker(rng).pick('x', WITCH, 'night')).filter((l) => WITCH.night.includes(l)).length;
    expect(night).toBeGreaterThan(50);
  });

  it('give the guidance roles real advice', () => {
    for (const [role, id] of [['witch', 'mara'], ['barkeep', 'rosa'], ['artificer', 'orrin']] as const) {
      const r = rig({ goal: 'nothing' });
      r.npcs.speak(r.by(id));
      r.npcs.speak(r.by(id));
      expect(r.toasts[1]).toContain(`ADVICE-${role}`);
    }
  });
});

describe('the sprites', () => {
  it('draw an outlined, mostly transparent figure for each person and prop', () => {
    for (const kind of ['witch', 'barkeep', 'orc', 'artificer', 'hermit', 'board', 'clock'] as const) {
      const img = paintNpc(kind);
      const size = spriteSize(kind);
      expect([img.w, img.h, img.data.length]).toEqual([size.w, size.h, size.w * size.h * 4]);
      let opaque = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0) opaque++;
      expect(opaque / (RES * RES), kind).toBeGreaterThan(120);
      expect(opaque, kind).toBeLessThanOrEqual(img.w * img.h * (kind === 'board' || kind === 'clock' ? 1 : 0.8));
    }
    expect([SPRITE_W, SPRITE_H, RES]).toEqual([24, 40, 3]);
    expect(spriteSize('witch')).toEqual({ w: 72, h: 120 });
    expect(paintNpc('witch').data).not.toEqual(paintNpc('orc').data);
  });

  it('give the women a narrower waist than hips, and the orc broad shoulders', () => {
    const rows = (img: ReturnType<typeof paintNpc>, y: number): number => opaqueIn(img, y, y + 1);
    for (const k of ['witch', 'barkeep'] as const) {
      const img = paintNpc(k);
      expect(rows(img, 25), `${k} waist`).toBeLessThan(rows(img, k === 'witch' ? 34 : 35));
    }
    const o = paintNpc('orc');
    expect(rows(o, 24)).toBeGreaterThan(rows(paintNpc('witch'), 24) + 6);
  });
});

describe('the portraits', () => {
  it('paint a distinct 128 px bust for every person, none for the props', () => {
    const roles = ['witch', 'barkeep', 'orc', 'artificer', 'hermit'] as const;
    const imgs = roles.map((r) => paintPortrait(r));
    for (const img of imgs) {
      expect([img.w, img.h, img.data.length]).toEqual([PORTRAIT_PX, PORTRAIT_PX, PORTRAIT_PX * PORTRAIT_PX * 4]);
      let opaque = 0;
      for (let i = 3; i < img.data.length; i += 4) if (img.data[i] === 255) opaque++;
      expect(opaque).toBe(PORTRAIT_PX * PORTRAIT_PX); // the backdrop fills the card
    }
    for (let i = 0; i < imgs.length; i++) for (let j = i + 1; j < imgs.length; j++) expect(imgs[i].data).not.toEqual(imgs[j].data);
    expect(roles.every(hasPortrait)).toBe(true);
    expect(hasPortrait('board')).toBe(false);
    expect(hasPortrait('clock')).toBe(false);
  });

  it('give the witch green eyes and the orc green skin', () => {
    const at = (img: ReturnType<typeof paintPortrait>, gx: number, gy: number): number[] => {
      const x = Math.round(gx * 2);
      const y = Math.round(gy * 2);
      const i = (y * img.w + x) * 4;
      return [img.data[i], img.data[i + 1], img.data[i + 2]];
    };
    const iris = at(paintPortrait('witch'), 27.6, 30.2);
    expect(iris[1]).toBeGreaterThan(iris[0]);
    const skin = at(paintPortrait('orc'), 32, 21);
    expect(skin[1]).toBeGreaterThan(skin[0]);
    expect(skin[1]).toBeGreaterThan(skin[2]);
  });
});

describe('a new world opens in the tavern', () => {
  it('builds the hall and yard round the spawn, stands the player inside facing the bar, and saves it', () => {
    const state = GameState.create(21, 'tavern');
    const o = state.npcs.at!;
    expect(o).not.toBeNull();
    const p = state.player.position;
    expect([Math.floor(p.x) - o[0], Math.floor(p.z) - o[2]]).toEqual([TAVERN_START[0], TAVERN_START[2]]);
    expect(blockOf(state.world.getVoxel(o[0] + 6, o[1], o[2] + 4)).key).toBe('plank');
    expect(blockOf(state.world.getVoxel(o[0] + 5, o[1] + 1, o[2] + 5)).key).toBe('plank');
    expect(blockOf(state.world.getVoxel(o[0] + 6, o[1] + 1, o[2] + 2)).key).toBe('air');
    expect(blockOf(state.world.getVoxel(o[0] + 6, o[1] + TAVERN_H, o[2] + 4)).key).toBe('plank');
    expect(blockOf(state.world.getVoxel(o[0] + 6, o[1] + 1, o[2] + 13)).key).toBe('furnace_clay'); // the hermit's fire
    expect(state.npcs.views().map((v) => v.name)).toEqual(['Mara', 'Rosa', 'Gruk', 'Orrin', 'Old Bram', 'Quest board', 'Wall clock', 'Jukebox']);
    const save = state.toSave();
    expect((save.world.extras as { npcs?: { at: number[] } }).npcs?.at).toEqual(o);
    const again = GameState.restore(JSON.parse(JSON.stringify(save)));
    expect(again.npcs.at).toEqual(o);
    again.dispose();
    state.dispose();
  });

  it('keeps both hearths lit', () => {
    const state = GameState.create(22, 'fires');
    for (let i = 0; i < 200; i++) state.tick();
    const o = state.npcs.at!;
    for (const [x, y, z] of FIRE_SPOTS) {
      const e = state.sim.furnaceAt(o[0] + x, o[1] + y, o[2] + z);
      expect(e?.lit, `fire at ${x},${y},${z}`).toBe(true);
    }
    expect(state.npcs.pendingBounties()).toEqual([]);
    state.dispose();
  });
});

describe('routines', () => {
  const blocks = layoutBlocks();
  const at = (x: number, y: number, z: number): string | undefined => [...blocks].reverse().find((b) => b.x === x && b.y === y && b.z === z)?.block;

  it('every routine spot is free to stand in, on a floor', () => {
    for (const [id, phases] of Object.entries(ROUTINES)) {
      for (const [phase, [x, y, z]] of Object.entries(phases)) {
        for (const dy of [0, 1]) {
          const b = at(x, y + dy, z);
          expect(b === undefined || b === 'air', `${id} ${phase} stands in ${b}`).toBe(true);
        }
        expect(['plank', 'dirt'], `${id} ${phase} has a floor`).toContain(at(x, y - 1, z));
      }
    }
  });

  it('dancers gather in front of the jukebox, free floor, and Gruk stays out', () => {
    for (const [id, [x, y, z]] of Object.entries(DANCE_SPOTS)) {
      const b = at(x, y, z);
      expect(b === undefined || b === 'air', `${id} dances in ${b}`).toBe(true);
      expect(at(x, y - 1, z), id).toBe('plank');
    }
    expect(DANCE_SPOTS.gruk).toBeUndefined();
    const { npcs } = rig();
    npcs.jukeboxOn = true;
    for (let i = 0; i < 80; i++) npcs.tick(0.5);
    for (const [id, [x, , z]] of Object.entries(DANCE_SPOTS)) {
      const v = npcs.views().find((n) => n.id === id)!;
      expect([v.x - 100 - 0.5, v.z - 100 - 0.5], id).toEqual([x, z]);
    }
  });

  it('people walk to the spot for the part of the day, and stop there', () => {
    const { npcs, state, by } = rig();
    state.tod = 0.3; // day
    const rosa = by('rosa');
    const first = npcs.views().find((v) => v.id === 'rosa')!;
    state.tod = 0.9; // night
    const goal = npcs.target(rosa);
    expect(goal).not.toEqual([first.x - 100 - 0.5, first.z - 100 - 0.5]);
    for (let i = 0; i < 100; i++) npcs.tick(0.5);
    const v = npcs.views().find((x) => x.id === 'rosa')!;
    expect(v.x - 100).toBeCloseTo(goal[0] + 0.5, 3);
    expect(v.z - 100).toBeCloseTo(goal[1] + 0.5, 3);
  });
});

describe('friendship', () => {
  it('a liked gift raises trust once a day, pays tier rewards, and is saved', () => {
    const { npcs, state, by, given, taken } = rig();
    npcs.speak(by('rosa')); // her first-visit gift
    given.length = 0;
    state.held = { item: 'bread', count: 5 };
    npcs.speak(by('rosa'));
    expect(npcs.trustOf('rosa')).toBe(8);
    expect(taken).toEqual([1]);
    npcs.speak(by('rosa')); // same day
    expect(npcs.trustOf('rosa')).toBe(8);
    expect(taken).toEqual([1]);
    state.held = { item: 'iron_ingot', count: 1 }; // not liked by Rosa
    npcs.speak(by('rosa'));
    expect(taken).toEqual([1]);
    // Tier 1 at 20 trust.
    (npcs as unknown as { trust: Record<string, number> }).trust.rosa = 16;
    (npcs as unknown as { giftDay: Record<string, number> }).giftDay.rosa = 1;
    state.held = { item: 'apple', count: 1 };
    npcs.speak(by('rosa'));
    expect(npcs.trustOf('rosa')).toBe(24);
    expect(given).toContainEqual(['hearth_stew', 2]);
    const snap = JSON.parse(JSON.stringify(npcs.toJSON()));
    const { npcs: other } = rig();
    other.load(snap);
    expect(other.trustOf('rosa')).toBe(24);
  });

  it('a close friend of Gruk hires him for a quarter less', () => {
    const { npcs } = rig();
    expect(npcs.hireCost()).toBe(HIRE_COST);
    (npcs as unknown as { trust: Record<string, number> }).trust.gruk = 50;
    expect(npcs.hireCost()).toBe(Math.round(HIRE_COST * 0.75));
  });
});

describe('buying back from Bram', () => {
  it('names the last sale, then sells it back at the price he paid; saved', () => {
    const { npcs, state, by, given, taken } = rig({ coins: 0 });
    state.held = { item: 'iron_ingot', count: 3 };
    npcs.speak(by('bram'));
    const got = npcs.coins;
    expect(got).toBeGreaterThan(0);
    expect(taken).toEqual([3]);
    state.held = null;
    given.length = 0;
    const offer = npcs.speak(by('bram'));
    expect(offer).toMatch(/3 iron ingot/);
    expect(given).toEqual([]);
    const snap = JSON.parse(JSON.stringify(npcs.toJSON()));
    npcs.speak(by('bram')); // confirm
    expect(given).toEqual([['iron_ingot', 3]]);
    expect(npcs.coins).toBe(0);
    npcs.speak(by('bram')); // shelf empty: ordinary talk, no purchase
    expect(given.length).toBe(1);
    const { npcs: other } = rig();
    other.load(snap);
    expect(other.toJSON().shelf).toEqual([['iron_ingot', 3, got]]);
  });

  it('refuses when you cannot pay, and a confirmation needs the second Use in time', () => {
    const { npcs, state, by, given } = rig({ coins: 0 });
    state.held = { item: 'iron_ingot', count: 2 };
    npcs.speak(by('bram'));
    npcs.coins = 0;
    state.held = null;
    npcs.speak(by('bram'));
    expect(npcs.speak(by('bram'))).toMatch(/Come back/);
    expect(given).toEqual([]);
    npcs.speak(by('bram')); // offer again
    npcs.tick(11);
    npcs.coins = 999;
    npcs.speak(by('bram')); // too late: a fresh offer, no sale yet
    expect(given).toEqual([]);
  });
});

describe('walking routes', () => {
  it('finds a way through the bar gap and the back door, never through walls', () => {
    expect(walkable(6, 5)).toBe(false); // the bar
    const bar = findPath([10, 6], [10, 3])!;
    expect(bar.some(([x, z]) => x === 11 && z === 5)).toBe(true); // round the end of the bar
    const yard = findPath([7, 11], [6, 3])!;
    expect(yard.some(([x, z]) => x === 1 && z === 8)).toBe(true); // the back door
    for (const [x, z] of [...bar, ...yard]) expect(walkable(x, z), `${x},${z}`).toBe(true);
    expect(findPath([6, 0], [6, 3])).not.toBeNull(); // the front door
  });

  it('a walker only ever stands on free floor on the way to the jukebox', () => {
    const { npcs } = rig();
    for (let i = 0; i < 400; i++) npcs.tick(0.1); // settle at the day spots
    npcs.jukeboxOn = true;
    for (let i = 0; i < 400; i++) {
      npcs.tick(0.1);
      for (const v of npcs.views().filter((x) => x.kind === 'person')) {
        const near = nearestCell(v.x - 100 - 0.5, v.z - 100 - 0.5)!;
        // Between two cells of a legal segment the nearest cell is one of the two ends: always free.
        expect(walkable(near[0], near[1]), `${v.id} at ${v.x - 100},${v.z - 100}`).toBe(true);
      }
    }
    for (const [id, [x, , z]] of Object.entries(DANCE_SPOTS)) {
      const v = npcs.views().find((n) => n.id === id)!;
      expect([v.x - 100 - 0.5, v.z - 100 - 0.5], id).toEqual([x, z]);
    }
  });
});

describe('the upper floor, the cellar and the secret rooms', () => {
  const grid = new Map<string, string>();
  for (const b of layoutBlocks()) grid.set(`${b.x},${b.y},${b.z}`, b.block); // later placements win
  const solid = (x: number, y: number, z: number, g: Map<string, string> = grid): boolean => {
    const k = g.get(`${x},${y},${z}`);
    return k !== undefined && k !== 'air' && k !== 'torch';
  };
  /** Every cell reachable on foot from `from`: floor underfoot, two free blocks, steps up of one block, drops of up to two. */
  function reach(from: readonly [number, number, number], g = grid): Set<string> {
    const ok = (x: number, y: number, z: number): boolean => solid(x, y - 1, z, g) && !solid(x, y, z, g) && !solid(x, y + 1, z, g);
    const seen = new Set<string>([from.join(',')]);
    const queue: [number, number, number][] = [[...from]];
    while (queue.length) {
      const [x, y, z] = queue.pop()!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        for (const dy of [1, 0, -1, -2]) {
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;
          if (nx < 0 || nx >= TAVERN_W || nz < 0 || nz >= TAVERN_D + YARD_D || seen.has(`${nx},${ny},${nz}`)) continue;
          // Stepping up needs the head room above the start cell too; drops need the cell above the landing clear.
          if (dy === 1 && solid(x, y + 2, z, g)) continue;
          if (dy < 0 && solid(nx, y + 1, nz, g)) continue;
          if (ok(nx, ny, nz)) {
            seen.add(`${nx},${ny},${nz}`);
            queue.push([nx, ny, nz]);
          }
        }
      }
    }
    return seen;
  }
  const start = reach([6, 1, 2]);

  it('the stairs lead to the corridor and both bedrooms upstairs', () => {
    for (const cell of ['2,6,1', '2,6,4', '6,6,4', '10,6,4', '3,6,6', '9,6,6']) expect(start.has(cell), cell).toBe(true);
  });

  it('the balcony overlooks the hall: open air from its rail down to the floor, with a railing along the edge', () => {
    for (const [x, z] of [[4, 1], [6, 2], [10, 2]] as const) {
      for (let y = 1; y <= 8; y++) expect(solid(x, y, z), `${x},${y},${z}`).toBe(false); // the rafters are at y 9
    }
    for (let x = 3; x <= 10; x++) expect(grid.get(`${x},6,3`), `rail ${x}`).toBe('fence');
    expect(start.has('5,6,4'), 'you can stand at the rail').toBe(true);
    expect(start.has('5,6,1'), 'but not out over the void').toBe(false);
  });

  it('has fence rafters under the roof and across the hall, clear of the stairs', () => {
    for (const x of [1, 6, 11]) expect(grid.get(`${x},9,4`), `roof rafter ${x}`).toBe('fence');
    for (const x of [3, 7, 11]) expect(grid.get(`${x},4,3`), `hall rafter ${x}`).toBe('fence');
    for (const z of [1, 2, 3, 4]) expect(grid.get(`1,4,${z}`), `stairs ${z}`).not.toBe('fence');
  });

  it('has a bed in each bedroom', () => {
    const beds = [...grid].filter(([, b]) => b === 'wool_bedding').map(([k]) => k.split(',').map(Number));
    expect(beds.length).toBeGreaterThanOrEqual(4);
    expect(beds.some(([x]) => x < 6)).toBe(true);
    expect(beds.some(([x]) => x > 6)).toBe(true);
  });

  it('the cellar is reached from the yard, down the stairwell, and its vault only through the false wall', () => {
    expect(start.has('11,-3,7'), 'the cellar floor').toBe(true);
    expect(start.has('11,-3,9'), 'the bottom of the stairwell').toBe(true);
    expect(start.has('5,-3,10'), 'the vault is hidden').toBe(false);
    // Mine out the two brick blocks and the vault opens.
    const open = new Map(grid);
    open.set(`6,${-BASEMENT_DEPTH + 1},${TAVERN_D - 1}`, 'air');
    open.set(`6,${-BASEMENT_DEPTH + 2},${TAVERN_D - 1}`, 'air');
    expect(reach([6, 1, 2], open).has('5,-3,10')).toBe(true);
  });

  it('the closet between the bedrooms is sealed by brick until it is mined', () => {
    expect(start.has('6,6,6')).toBe(false);
    const open = new Map(grid);
    open.set('6,6,5', 'air');
    open.set('6,7,5', 'air');
    expect(reach([6, 1, 2], open).has('6,6,6')).toBe(true);
  });

  it('the ground floor routes are still walkable for the regulars', () => {
    for (const [id, phases] of Object.entries(ROUTINES)) {
      for (const [phase, [x, y, z]] of Object.entries(phases)) expect(start.has(`${x},${y},${z}`), `${id} ${phase}`).toBe(true);
    }
  });
});
