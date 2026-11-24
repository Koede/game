/** Connects the NpcManager to the running game (docs/api/npcs.md): goals, clock, pack, magic notebook, mobs and hearths. */
import type { GameClock } from '../game/clock';
import type { ObjectiveTracker } from '../game/objectives';
import type { PlayerState } from '../game/playerState';
import type { Magic } from '../magic/magic';
import type { MobManager } from '../mobs';
import type { IWorld } from '../core/types';
import { OBJECTIVES } from '../core/registry';
import type { Simulation } from '../sim';
import { alchemyAdvice } from './alchemy';
import type { NpcHost } from './manager';

export interface NpcHostDeps {
  player: PlayerState;
  objectives: ObjectiveTracker;
  clock: GameClock;
  magic: Magic;
  mobs: MobManager;
  world: IWorld;
  sim: Simulation;
}

/** The first sentence or two of a text, at most `max` characters. */
export function brief(text: string, max = 200): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return stop > 60 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}...`;
}

const BREW_GOALS = ['boil_bucket', 'first_brew', 'six_cups'];

export function makeNpcHost(d: NpcHostDeps): NpcHost {
  const goal = (id: string) => OBJECTIVES.find((o) => o.id === id);
  return {
    give: (item, n) => d.player.give(item, n),
    currentGoal: () => d.objectives.current?.id ?? null,
    completed: () => new Set(d.objectives.completed.map((o) => o.id)),
    timeOfDay: () => d.clock.timeOfDay,
    day: () => d.clock.day,
    held: () => {
      const s = d.player.heldStack();
      return s ? { item: s.item, count: s.count } : null;
    },
    takeHeld: (n) => void d.player.consumeHeld(n),
    caravanPresent: () => {
      d.player.caravan.setDay(d.clock.day);
      return d.player.caravan.present();
    },
    openCaravan: () => d.player.bus.emit('ui:open', { screen: { type: 'caravan' } }),
    advice: (role) => {
      if (role === 'witch') {
        const entries = d.magic.notebook().entries();
        const open = entries.find((e) => e.status === 'open');
        if (open) return `Your notebook has "${open.title}" open. ${brief(open.text, 170)}`;
        if (entries.every((e) => e.status === 'done')) return 'You have read everything I can show you. Go and find wellsprings; the world has more entries than I do.';
        return 'Finish what is open in your notebook first. The rest unlocks as you note more of the world.';
      }
      if (role === 'barkeep') {
        const next = BREW_GOALS.map(goal).find((o) => o && !d.objectives.isComplete(o.id));
        if (next) return `For the kitchen: "${next.title}". ${brief(next.text, 170)}`;
        return 'You have tasted all six cups; there is nothing left I can teach about tea and coffee. Now try cheese.';
      }
      if (role === 'alchemist') return alchemyAdvice((item) => d.player.inventory.count(item) > 0);
      const cur = d.objectives.current;
      return cur ? `Your next job: "${cur.title}". ${brief(cur.text, 180)}` : 'You have done everything on the ladder. Go and build something I have not thought of.';
    },
    sleepToDawn: (bed) => {
      if (bed) {
        d.player.position.x = bed.x;
        d.player.position.y = bed.y;
        d.player.position.z = bed.z;
        d.player.velocity.x = d.player.velocity.y = d.player.velocity.z = 0;
      }
      d.clock.skipToDawn();
      d.player.bus.emit('flag', { flag: 'rested' });
    },
    grantBuff: (buff, s) => {
      const b = d.player.buffs;
      if (buff === 'well_warmed') b.wellWarmedS = Math.max(b.wellWarmedS, s);
      else if (buff === 'strength') b.grantStrength(1, s);
      else b.grant(buff, s);
      if (buff !== 'strength') d.player.bus.emit('buff:gained', { buff, durationS: s });
    },
    tendFire: (x, y, z) => {
      const e = d.sim.furnaceAt(x, y, z);
      if (!e) return;
      const slots = d.sim.furnaceSlots(x, y, z);
      if (slots && e.fuel.every((s) => s === null) && !e.burnItem) slots.fuel.add('oak_log', 12);
      if (!e.lit) d.sim.light(x, y, z);
    },
    companion: {
      world: d.world,
      player: () => ({ x: d.player.position.x, y: d.player.position.y, z: d.player.position.z, dead: d.player.dead }),
      hostiles: () => d.mobs.all.filter((m) => m.spec.hostile && m.health > 0).map((m) => ({ id: m.id, x: m.x, y: m.y, z: m.z })),
      hit: (id, dmg, fx, fz) => void d.mobs.hit(id, dmg, fx, fz),
    },
  };
}
