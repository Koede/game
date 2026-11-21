import { describe, expect, it } from 'vitest';
import { expand, nameOf, pour, total } from '../core/chem';
import { CHEM, STILL_SETPOINTS } from '../core/distill';
import { DT } from '../core/constants';
import { Face } from '../core/types';
import type { ChemEntity } from './distill';
import { chemPortEndpoint } from './distillActions';
import { buildRig, runUntil } from './distillKit';
import { scanRig } from './distillScan';
import { makeKit } from './testKit';

const POT = 'CR/F./B.';
const fill = (e: ChemEntity, fluid: string, litres: number): void => void pour(expand(fluid, litres), e.mix, litres);

describe('rig scan', () => {
  it('finds a pot still: flask on its base, the head condenser on top, the receiver it drips into', () => {
    const r = buildRig(POT);
    const rig = scanRig(r.kit.world, 0, 2, 0)!;
    expect(rig.modules.size).toBe(4);
    expect(rig.problems).toEqual([]);
    expect(rig.stills).toHaveLength(1);
    expect(rig.stills[0]).toMatchObject({ flask: '0,3,0', base: '0,2,0', segments: [], draws: [], head: '0,4,0' });
    expect(rig.edges).toEqual([{ from: '0,4,0', to: '1,4,0', shared: false }]);
  });

  it('reads a column: stack height, side draws by segment, the head on top', () => {
    const r = buildRig('..CR/..|./RC|./..|CR/..F/..B');
    const s = scanRig(r.kit.world, 2, 3, 0)!.stills[0];
    expect(s.segments).toEqual(['2,4,0', '2,5,0', '2,6,0']);
    expect(s.draws).toEqual([{ h: 1, condenser: '3,4,0' }, { h: 2, condenser: '1,5,0' }]);
    expect(s.head).toBe('2,7,0');
  });

  it('reports what is wrong, like the hearth structure tab', () => {
    const codes = (rig: string, x = 0, y = 2): string[] => scanRig(buildRig(rig).kit.world, x, y, 0)!.problems.map((p) => p.code);
    expect(codes('C/F')).toEqual(['no_base', 'drips_nowhere']);
    expect(codes('F/B')).toEqual(['no_condenser']);
    expect(codes('|C/..', 0, 3)).toEqual(['loose_segment']);
    // One condenser between two columns.
    expect(codes('|C|/F.F/B.B')).toContain('shared_condenser');
  });

  it('pours down and sideways, never up; a flask takes from the side only through a tube; tube runs share levels', () => {
    const kit = makeKit();
    for (const [x, y, k] of [[0, 3, 'receiver'], [1, 3, 'glass_tube'], [2, 3, 'glass_tube'], [3, 3, 'boiling_flask'], [0, 2, 'receiver']] as const) kit.world.put(x, y, 0, k);
    const rig = scanRig(kit.world, 0, 3, 0)!;
    const e = rig.edges.map((x) => `${x.from}${x.shared ? '=' : '>'}${x.to}`).sort();
    expect(e).toEqual(['0,3,0=1,3,0', '0,3,0>0,2,0', '1,3,0=2,3,0', '2,3,0>3,3,0'].sort());
  });

  it('seals a vessel under an airlock and cools a condenser beside a jacket', () => {
    const r = buildRig('A./VJ./..');
    expect(scanRig(r.kit.world, 0, 3, 0)!.sealed.has('0,3,0')).toBe(true);
    const k = buildRig('JCR/.F./.B.');
    expect(scanRig(k.kit.world, 1, 2, 0)!.jackets.get('1,4,0')).toEqual(['0,4,0']);
  });
});

describe('stills', () => {
  it('distils wash into low wines in the receiver, and the flask shows the run done on its block', () => {
    const r = buildRig(POT);
    const flask = r.first('F');
    const recv = r.first('R');
    fill(flask, 'sugar_wash', 4000);
    expect(r.kit.sim.distill.shows(0, 3, 0)).toEqual({ key: 'boiling_flask', active: false });
    runUntil(r, 900, () => flask.state === 'working', 5);
    expect(r.kit.sim.distill.shows(0, 3, 0)).toEqual({ key: 'boiling_flask', active: true });
    expect(r.kit.sim.distill.shows(0, 2, 0).active).toBe(true); // the base is firing
    const toasts = r.kit.record('toast');
    runUntil(r, 900, () => flask.state === 'done', 400);
    expect(flask.state).toBe('done');
    expect(r.kit.sim.distill.shows(0, 3, 0)).toEqual({ key: 'boiling_flask_done', active: false });
    r.kit.run(3);
    expect(nameOf(recv.mix)).toBe('low_wines');
    expect(r.kit.sim.distill.shows(1, 4, 0)).toEqual({ key: 'receiver_done', active: false });
    expect(toasts.some((t) => /finished/.test(t.text))).toBe(true);
  });

  it('only boils with a hot furnace under the base, and draws heat from it', () => {
    const r = buildRig(POT);
    fill(r.first('F'), 'sugar_wash', 1000);
    runUntil(r, 20, () => false, 2);
    expect(r.first('F').state).toBe('idle');
    r.furnaces[0].tempC = 900;
    r.kit.sim.distill.step(0.25);
    expect(r.furnaces[0].extractW).toBeGreaterThan(0);
  });

  it('turns red (blocked) when the receiver is full, and goes on once it is emptied', () => {
    const r = buildRig(POT);
    const flask = r.first('F');
    const recv = r.first('R');
    fill(flask, 'sugar_wash', 2000);
    fill(recv, 'water', 2000);
    runUntil(r, 900, () => flask.state === 'blocked', 30);
    expect(flask.state).toBe('blocked');
    expect(r.kit.sim.distill.shows(0, 3, 0)).toEqual({ key: 'boiling_flask_done', active: true });
    recv.mix = {};
    runUntil(r, 900, () => flask.state === 'working', 5);
    expect(flask.state).toBe('working');
  });

  it('a 3-segment column cuts crude oil into diesel, kerosene and gasoline, leaving the residue', () => {
    const r = buildRig('..CR/..|./RC|./..|CR/..F/..B');
    const flask = r.first('F');
    fill(flask, 'crude_oil', 4000);
    r.first('B').setC = 350;
    runUntil(r, 900, () => flask.state === 'done', 900);
    r.kit.run(5);
    const names = r.every('R').map((x) => nameOf(x.mix));
    expect(names.sort()).toEqual(['diesel', 'gasoline', 'kerosene']);
    expect(nameOf(flask.mix)).toBe('residue');
  });
});

describe('vessels', () => {
  it('ferments syrup and water under an airlock, refuses syrup alone, and lets the wash go when done', () => {
    const r = buildRig('A./VT./..');
    const v = r.first('V');
    fill(v, 'syrup', 250);
    r.kit.run(2);
    expect(v.state).toBe('blocked'); // too sweet
    fill(v, 'water', 1000);
    expect(total(r.first('T').mix)).toBe(0);
    runUntil(r, 20, () => v.state === 'done', 300);
    expect(nameOf(v.mix) ?? nameOf(r.first('T').mix)).toBe('sugar_wash');
    r.kit.run(2);
    expect(total(r.first('T').mix)).toBeGreaterThan(0);
  });
});

describe('conservation and saving', () => {
  it('never makes or loses a litre in random rigs (fuzz)', () => {
    const kinds = [CHEM.base, CHEM.flask, CHEM.vessel, CHEM.segment, CHEM.condenser, CHEM.jacket, CHEM.receiver, CHEM.tube, CHEM.airlock];
    const fluids = ['sugar_wash', 'crude_oil', 'sap', 'water', 'syrup', 'low_wines'];
    let seed = 7;
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % n;
    };
    for (let trial = 0; trial < 60; trial++) {
      const kit = makeKit();
      for (let x = 0; x < 3; x++) kit.furnace(x, 1, 0);
      for (let i = 0; i < 12; i++) kit.world.put(rnd(3), 2 + rnd(4), rnd(3), kinds[rnd(kinds.length)]);
      for (const e of kit.sim.distill.all()) {
        if (e.kind === CHEM.base) e.setC = STILL_SETPOINTS[rnd(STILL_SETPOINTS.length)];
        const cap = { boiling_flask: 4000, reaction_vessel: 4000, receiver: 2000, glass_tube: 50, cooling_jacket: 1000 }[e.kind as string];
        if (cap) fill(e, e.kind === CHEM.jacket ? 'water' : fluids[rnd(fluids.length)], rnd(cap));
      }
      const before = kit.sim.distill.litres();
      for (let s = 0; s < 400; s++) {
        for (let x = 0; x < 3; x++) kit.sim.furnaceAt(x, 1, 0)!.tempC = 900;
        kit.sim.tick(DT * 5);
      }
      for (const e of kit.sim.distill.all()) for (const v of Object.values(e.mix)) expect(v! >= 0 && Number.isFinite(v!)).toBe(true);
      expect(kit.sim.distill.litres(), `trial ${trial}`).toBeCloseTo(before, 5);
    }
  });

  it('a saved rig loads and runs on exactly as before', () => {
    const run = (r: ReturnType<typeof buildRig>, s: number): void => void runUntil(r, 900, () => false, s);
    const a = buildRig(POT);
    fill(a.first('F'), 'sugar_wash', 3000);
    a.first('B').setC = 97;
    run(a, 10);
    const saved = JSON.parse(JSON.stringify([...a.kit.world.entities()].filter((e) => e.kind !== 'furnace')));
    const b = buildRig(POT);
    for (const e of saved) b.kit.world.setEntity(e);
    b.kit.sim.resync();
    b.furnaces[0].tempC = a.furnaces[0].tempC;
    run(a, 10);
    run(b, 10);
    for (const ch of ['F', 'R', 'C']) {
      expect(total(b.first(ch).mix), ch).toBeCloseTo(total(a.first(ch).mix), 6);
    }
    expect(b.first('B').setC).toBe(97);
  });
});

describe('player and pipes', () => {
  it('pours a container in, takes the named fluid out, and says why not', () => {
    const r = buildRig(POT);
    const sim = r.kit.sim;
    expect(sim.chemUse(0, 3, 0, 'pine_sap')).toMatchObject({ ok: true, consume: true, give: 'glass_beaker' });
    expect(nameOf(r.first('F').mix)).toBe('sap');
    expect(sim.chemUse(0, 3, 0, 'glass_beaker')).toMatchObject({ ok: true, give: 'pine_sap' });
    expect(sim.chemUse(0, 3, 0, 'glass_beaker')).toMatchObject({ ok: false, reason: expect.stringMatching(/empty/) });
    fill(r.first('R'), 'diesel', 300);
    expect(sim.chemUse(1, 4, 0, 'glass_beaker')).toMatchObject({ ok: false, reason: expect.stringMatching(/cannot hold Diesel/) });
    expect(sim.chemUse(1, 4, 0, 'empty_canister')).toMatchObject({ ok: false, reason: expect.stringMatching(/Only 300 L/) });
    expect(sim.chemUse(0, 2, 0, null)).toMatchObject({ ok: true, toast: 'Still Base set to 130 C' });
    expect(sim.chemUse(0, 3, 0, 'apple')).toBeNull();
    expect(sim.brewView(0, 3, 0)?.text).toMatch(/^Boiling Flask - empty/);
  });

  it('a chemistry port fills the flask from a pipe and gives the receiver out', () => {
    const kit = makeKit();
    for (const [x, y, k] of [[0, 2, 'boiling_flask'], [1, 2, 'chem_port'], [3, 2, 'receiver'], [4, 2, 'chem_port']] as const) kit.world.put(x, y, 0, k);
    const inlet = kit.sim.fluidEndpoint(1, 2, 0, Face.PX)!;
    expect(inlet.fill('crude_oil', 1500)).toBe(1500);
    expect(nameOf(kit.sim.distill.entityAt(0, 2, 0)!.mix)).toBe('crude_oil');
    fill(kit.sim.distill.entityAt(3, 2, 0)!, 'gasoline', 800);
    const outlet = chemPortEndpoint(kit.sim.distill, 4, 2, 0)!;
    expect(outlet.offer()).toEqual({ fluid: 'gasoline', litres: 800 });
    expect(outlet.drain('gasoline', 500)).toBeCloseTo(500, 9);
    expect(outlet.drain('diesel', 100)).toBe(0);
  });
});
