/**
 * Rooms to rent (docs/api/npcs.md): Rosa lets the upstairs beds for coin. Pay in the evening or at night and you sleep until dawn
 * (the clock jumps, you wake rested and warm), and Rosa reads you a short note the regulars left while you slept. A friend of
 * Rosa pays less.
 */
import type { Service } from './services';

export const ROOM_COST = 14;
export const ROOM_FRIEND_COST = 10;
/** Trust in Rosa from which the bed is cheaper. */
export const ROOM_FRIEND_TRUST = 20;

export const roomCost = (rosaTrust: number): number => (rosaTrust >= ROOM_FRIEND_TRUST ? ROOM_FRIEND_COST : ROOM_COST);

/** One line from each regular, left on the bar while you sleep. `{day}` is the day just ended. */
export const NOTES: Readonly<Record<string, readonly string[]>> = {
  mara: [
    'Mara: The tea leaves said you would sleep well. They are rarely wrong about small things.',
    'Mara: I read until the candle gave up. Your notebook is still on the shelf, unharmed.',
    'Mara: A cold front came through the valley after midnight. I warmed the chimney for you.',
  ],
  gruk: [
    'Gruk: You snore like a bellows. Gruk approves.',
    'Gruk: Anvil was loud. You did not wake. Gruk is impressed.',
    'Gruk: Left coal by your door. Do not make a thing of it.',
  ],
  orrin: [
    'Orrin: Sketched a better door latch while you slept. It is not better. Still, it is a sketch.',
    'Orrin: The bench hums at night. I think it has opinions about your last design.',
    'Orrin: Borrowed your wrench for an hour. Returned it. Mostly.',
  ],
  bram: [
    'Bram: The owl came by again. It looked at your window, then at me. Nothing else.',
    'Bram: Frost on the north moss. A hard day tomorrow, or a gentle one. I forget which.',
    'Bram: Counted the stars from the yard. One more than last week. Do not ask me which.',
  ],
};

/** Three notes from three different regulars, deterministic for a given rng. */
export function wakeNotes(rng: () => number): string[] {
  const who = Object.keys(NOTES);
  const out: string[] = [];
  while (out.length < 3 && who.length > 0) {
    const w = who.splice(Math.min(who.length - 1, Math.floor(rng() * who.length)), 1)[0];
    const lines = NOTES[w];
    out.push(lines[Math.min(lines.length - 1, Math.floor(rng() * lines.length))]);
  }
  return out;
}

export const ROOM_SERVICE: Service = {
  id: 'room',
  cost: (p) => roomCost(p.trust('rosa')),
  pitch: (p) => {
    const ph = p.phase();
    if (ph !== 'evening' && ph !== 'night') return null;
    const c = roomCost(p.trust('rosa'));
    return `A bed upstairs for the night is ${c} coin, clean sheets and a fire in the wall. Use me again to take it.`;
  },
  accept: (p) => {
    const ph = p.phase();
    if (ph !== 'evening' && ph !== 'night') return 'Beds are for the night, love. Come back at dusk.';
    const c = roomCost(p.trust('rosa'));
    if (p.coins() < c) return `${c} coin for the bed, and you carry ${p.coins()}. A bench by the fire is free.`;
    if (!p.host?.sleepToDawn) return 'The rooms are being aired. Another night.';
    p.spend(c);
    p.host.sleepToDawn(p.bed(p.day()) ?? undefined);
    p.addTrust('rosa', 1);
    p.toast(`You slept in a bed upstairs until dawn (-${c} coin, ${p.coins()} left)`);
    for (const n of wakeNotes(p.rng)) p.toast(n);
    return 'Sleep well. I will keep the fire in.';
  },
};
