import { describe, expect, it } from 'vitest';
import { JobBoard, JOB_SPAN, aptitudeOf, matches, type JobsPort, type Stop } from './jobs';

const key = (s: Stop): string => `${s.x},${s.y},${s.z}`;

/** A fake world: containers hold items; machines take a fixed list up to a room limit. */
function fakePort(over: Partial<JobsPort> = {}) {
  const stores = new Map<string, Record<string, number>>();
  const room = new Map<string, number>();
  const spilled: { stop: Stop; item: string; count: number }[] = [];
  const port: JobsPort = {
    peek: (s) => Object.entries(stores.get(key(s)) ?? {}).filter(([, n]) => n > 0).map(([item, count]) => ({ item, count })),
    take: (s, item, max) => {
      const st = stores.get(key(s));
      const have = st?.[item] ?? 0;
      if (!st || have <= 0) return null;
      const n = Math.min(max, have);
      st[item] = have - n;
      return { item, count: n };
    },
    canOffer: (s, _item, n) => Math.min(n, room.get(key(s)) ?? 0),
    offer: (s, item, n) => {
      const t = Math.min(n, room.get(key(s)) ?? 0);
      room.set(key(s), (room.get(key(s)) ?? 0) - t);
      const st = stores.get(key(s)) ?? {};
      st[item] = (st[item] ?? 0) + t;
      stores.set(key(s), st);
      return t;
    },
    loaded: () => true,
    spill: (stop, item, count) => void spilled.push({ stop, item, count }),
    working: () => true,
    busy: () => false,
    ...over,
  };
  return { port, stores, room, spilled };
}

const A: Stop = { x: 0, y: 5, z: 0 };
const B: Stop = { x: 10, y: 5, z: 0 };

function run(board: JobBoard, port: JobsPort, seconds: number, dt = 0.25): void {
  for (let t = 0; t < seconds; t += dt) board.tick(dt, port);
}

describe('job filters', () => {
  it('matches ore, fuel and anything', () => {
    expect(matches('copper_ore', 'ore')).toBe(true);
    expect(matches('crushed_tin', 'ore')).toBe(true);
    expect(matches('coal', 'ore')).toBe(false);
    expect(matches('coal', 'fuel')).toBe(true);
    expect(matches('copper_ore', 'fuel')).toBe(false);
    expect(matches('stick', 'any')).toBe(true);
  });
});

describe('a hauling job', () => {
  it('carries ore from the pickup to the drop-off, one load at a time, and counts it', () => {
    const w = fakePort();
    w.stores.set(key(A), { copper_ore: 40, stick: 5 });
    w.room.set(key(B), 1000);
    const board = new JobBoard();
    board.assign('gruk', 'haul', 'ore');
    board.setStop('gruk', 'from', A);
    board.setStop('gruk', 'to', B);
    run(board, w.port, 400);
    expect(w.stores.get(key(A))!.copper_ore).toBe(0);
    expect(w.stores.get(key(B))!.copper_ore).toBe(40);
    expect(w.stores.get(key(A))!.stick).toBe(5);
    expect(board.get('gruk')!.moved).toBe(40);
    expect(board.get('gruk')!.trips).toBe(3);
  });

  it('Gruk carries more than the rest', () => {
    expect(aptitudeOf('gruk').carry).toBeGreaterThan(aptitudeOf('rosa').carry);
    const w = fakePort();
    w.stores.set(key(A), { copper_ore: 100 });
    w.room.set(key(B), 1000);
    const board = new JobBoard();
    board.assign('gruk', 'haul', 'ore');
    board.setStop('gruk', 'from', A);
    board.setStop('gruk', 'to', B);
    board.tick(0.25, w.port);
    expect(board.get('gruk')!.carrying).toEqual({ item: 'copper_ore', count: 16 });
  });

  it('takes only what the drop-off will accept, and says so when it is full', () => {
    const w = fakePort();
    w.stores.set(key(A), { copper_ore: 20 });
    w.room.set(key(B), 5);
    const board = new JobBoard();
    board.assign('rosa', 'haul', 'ore');
    board.setStop('rosa', 'from', A);
    board.setStop('rosa', 'to', B);
    run(board, w.port, 60);
    expect(w.stores.get(key(B))!.copper_ore).toBe(5);
    expect(w.stores.get(key(A))!.copper_ore).toBe(15);
    expect(board.get('rosa')!.status).toMatch(/full/);
  });

  it('waits at an empty pickup and says what for', () => {
    const w = fakePort();
    w.room.set(key(B), 99);
    const board = new JobBoard();
    board.assign('gruk', 'haul', 'ore');
    board.setStop('gruk', 'from', A);
    board.setStop('gruk', 'to', B);
    run(board, w.port, 10);
    expect(board.get('gruk')!.status).toMatch(/Waiting for ore/);
    w.stores.set(key(A), { tin_ore: 3 });
    run(board, w.port, 30);
    expect(w.stores.get(key(B))!.tin_ore).toBe(3);
  });

  it('rests at night and when busy', () => {
    const w = fakePort({ working: () => false });
    w.stores.set(key(A), { copper_ore: 5 });
    w.room.set(key(B), 99);
    const board = new JobBoard();
    board.assign('gruk', 'haul', 'ore');
    board.setStop('gruk', 'from', A);
    board.setStop('gruk', 'to', B);
    run(board, w.port, 30);
    expect(w.stores.get(key(A))!.copper_ore).toBe(5);
    expect(board.get('gruk')!.status).toMatch(/Resting/);
    const b = fakePort({ busy: () => true });
    b.stores.set(key(A), { copper_ore: 5 });
    b.room.set(key(B), 99);
    run(board, b.port, 30);
    expect(b.stores.get(key(A))!.copper_ore).toBe(5);
  });

  it('puts back what the drop-off could not take after the walk', () => {
    const w = fakePort();
    w.stores.set(key(A), { copper_ore: 8 });
    w.room.set(key(B), 8);
    const board = new JobBoard();
    board.assign('rosa', 'haul', 'ore');
    board.setStop('rosa', 'from', A);
    board.setStop('rosa', 'to', B);
    board.tick(0.25, w.port);
    w.room.set(key(B), 3); // someone else filled it on the way
    w.room.set(key(A), 99);
    run(board, w.port, 12);
    expect(w.stores.get(key(B))!.copper_ore).toBe(3);
    expect(w.stores.get(key(A))!.copper_ore).toBeGreaterThanOrEqual(0);
    expect((w.stores.get(key(A))!.copper_ore) + (w.stores.get(key(B))!.copper_ore)).toBe(8);
  });
});

describe('a station job', () => {
  it('feeds fuel to a machine and ignores items it does not take', () => {
    const w = fakePort({ canOffer: (s, item, n) => (key(s) === key(B) && item === 'coal' ? n : 0) });
    w.stores.set(key(A), { copper_ore: 9, coal: 4 });
    const board = new JobBoard();
    board.assign('rosa', 'feed', 'fuel');
    board.setStop('rosa', 'from', A);
    board.setStop('rosa', 'to', B);
    w.room.set(key(B), 10);
    run(board, w.port, 40);
    expect(w.stores.get(key(B))!.coal).toBe(4);
    expect(w.stores.get(key(A))!.copper_ore).toBe(9);
  });
});

describe('stops and saving', () => {
  it('needs both stops, close and different', () => {
    const board = new JobBoard();
    board.assign('gruk', 'haul', 'ore');
    expect(board.get('gruk')!.status).toMatch(/collect/);
    board.setStop('gruk', 'from', A);
    expect(JobBoard.problem(board.get('gruk')!.job)).toMatch(/deliver/);
    board.setStop('gruk', 'to', A);
    expect(JobBoard.problem(board.get('gruk')!.job)).toMatch(/same/);
    board.setStop('gruk', 'to', { x: JOB_SPAN + 5, y: 5, z: 0 });
    expect(JobBoard.problem(board.get('gruk')!.job)).toMatch(/apart/);
  });

  it('round-trips, drops unknown people and bad data, and old saves load empty', () => {
    const board = new JobBoard();
    board.assign('gruk', 'haul', 'ore');
    board.setStop('gruk', 'from', A);
    board.setStop('gruk', 'to', B);
    board.assign('rosa', 'feed', 'fuel');
    const raw = JSON.parse(JSON.stringify(board.toJSON()));
    raw.nobody = { kind: 'haul', filter: 'ore', from: A, to: B };
    raw.mara = { kind: 'dance', filter: 'ore' };
    const again = new JobBoard();
    again.load(raw, (id) => id === 'gruk' || id === 'rosa' || id === 'mara');
    expect(again.size).toBe(2);
    expect(again.get('gruk')!.job).toEqual({ kind: 'haul', filter: 'ore', from: A, to: B });
    expect(again.get('rosa')!.job.from).toBeNull();
    const none = new JobBoard();
    none.load(undefined, () => true);
    expect(none.size).toBe(0);
  });

  it('clearing a job sets what the worker carried back at the pickup', () => {
    const w = fakePort();
    w.stores.set(key(A), { copper_ore: 10 });
    w.room.set(key(B), 99);
    const board = new JobBoard();
    board.assign('rosa', 'haul', 'ore');
    board.setStop('rosa', 'from', A);
    board.setStop('rosa', 'to', B);
    board.tick(0.25, w.port);
    expect(board.get('rosa')!.carrying).not.toBeNull();
    w.room.set(key(A), 99);
    board.assign('rosa', 'haul', 'fuel'); // change of work
    board.tick(0.25, w.port);
    expect(w.stores.get(key(A))!.copper_ore).toBe(10);
  });

  it('the pose walks from the pickup to the drop-off and back', () => {
    const w = fakePort();
    w.stores.set(key(A), { copper_ore: 10 });
    w.room.set(key(B), 99);
    const board = new JobBoard();
    board.assign('gruk', 'haul', 'ore');
    board.setStop('gruk', 'from', A);
    board.setStop('gruk', 'to', B);
    expect(board.pose('gruk')).toBeNull();
    board.tick(0.25, w.port);
    let last = -1;
    for (let i = 0; i < 12; i++) {
      board.tick(0.5, w.port);
      const p = board.pose('gruk');
      if (!p) continue;
      expect(p.x).toBeGreaterThanOrEqual(last - 1e-9);
      last = p.x;
    }
    expect(last).toBeGreaterThan(2);
  });
});

describe('a tending job', () => {
  const machines = [{ x: 3, y: 5, z: 0, kind: 'crusher', wear: 0.9 }, { x: 5, y: 5, z: 2, kind: 'still', wear: 0.3 }];
  const wearPort = () => {
    const w = fakePort();
    const tended: string[] = [];
    w.port.worn = () => machines.filter((m) => m.wear >= 0.25).sort((a, b) => b.wear - a.wear);
    w.port.tend = (x, y, z) => {
      const m = machines.find((q) => q.x === x && q.y === y && q.z === z)!;
      tended.push(m.kind);
      const d = Math.min(0.25, m.wear);
      m.wear -= d;
      return d;
    };
    return { w, tended };
  };

  it('needs only the workshop stop, and tends the worst machine first until all are in order', () => {
    machines[0].wear = 0.9;
    machines[1].wear = 0.3;
    const { w, tended } = wearPort();
    const board = new JobBoard();
    board.assign('rosa', 'tend');
    expect(JobBoard.problem(board.get('rosa')!.job)).toMatch(/workshop/);
    board.setStop('rosa', 'from', A);
    expect(JobBoard.problem(board.get('rosa')!.job)).toBeNull();
    run(board, w.port, 120);
    expect(tended[0]).toBe('crusher');
    expect(tended).toContain('still');
    expect(machines.every((m) => m.wear < 0.25)).toBe(true);
    expect(board.get('rosa')!.status).toMatch(/good order/);
    expect(board.get('rosa')!.moved).toBe(tended.length);
  });

  it('says so when the game has no machine wear', () => {
    const w = fakePort();
    const board = new JobBoard();
    board.assign('rosa', 'tend');
    board.setStop('rosa', 'from', A);
    run(board, w.port, 10);
    expect(board.get('rosa')!.status).toMatch(/No machine wear/);
  });
});
