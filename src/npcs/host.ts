/** Connects the NpcManager to the running game (docs/api/npcs.md): goals, clock, pack, magic notebook, mobs and hearths. */
import type { GameClock } from '../game/clock';
import type { ObjectiveTracker } from '../game/objectives';
import type { PlayerState } from '../game/playerState';
import type { Magic } from '../magic/magic';
import type { MobManager } from '../mobs';
import { Facing, makeVoxel, voxelActive, voxelId, withActive, type IWorld, type Slot } from '../core/types';
import { OBJECTIVES, blockId } from '../core/registry';
import { Inventory } from '../game/inventory';
import { emptyCrateEntity } from '../world/ruinCrates';
import type { Simulation } from '../sim';
import type { Workshop } from '../workshop/workshop';
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
  /** The Bronze workshop: its containers and machines are what a resident's job carries between. */
  workshop?: Workshop;
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
  // Optional machine wear calls, present once the wear work is merged.
  const sim = d.sim as Simulation & {
    wornMachines?(minWear?: number, near?: { x: number; z: number; radius: number }): { x: number; y: number; z: number; kind: string; wear: number }[];
    tendMachine?(x: number, y: number, z: number): number;
  };
  const goal = (id: string) => OBJECTIVES.find((o) => o.id === id);
  return {
    setBlockActive: (x, y, z, on) => {
      if (!d.world.isLoaded(x, z)) return false;
      const v = d.world.getVoxel(x, y, z);
      if (voxelId(v) !== blockId('jukebox') && voxelId(v) !== blockId('party_button')) return false;
      if (voxelActive(v) !== on) d.world.setVoxel(x, y, z, withActive(v, on), 'sim');
      return true;
    },
    townSurface: (x, z) => {
      if (!d.world.isLoaded(x, z)) return null;
      // The ground, not what grows on it: look down through loose growth (grass, crops, flowers) and tree leaves to the first
      // solid block. A trunk is solid, so a column with a tree in it still reads as a log (unbuildable).
      let y = d.world.surfaceY(x, z);
      for (let n = 0; n < 32 && y > 0; n++, y--) {
        const b = d.world.getBlock(x, y, z);
        if (b.solid && !b.key.endsWith('_leaves')) break;
        if (b.liquid !== null) break;
      }
      return y < 0 ? null : { y, key: d.world.getBlock(x, y, z).key };
    },
    townBlock: (x, y, z) => (d.world.isLoaded(x, z) ? d.world.getBlock(x, y, z).key : null),
    townEdited: (x, y, z) => d.world.wasEdited?.(x, y, z) ?? false,
    townPlace: (x, y, z, block, facing) => d.world.isLoaded(x, z) && d.world.setVoxel(x, y, z, makeVoxel(blockId(block), facing as Facing), 'town'),
    townCrate: (x, y, z) => {
      if (!d.world.isLoaded(x, z)) return null;
      let e = d.world.getEntity(x, y, z);
      // A crate the builder placed has no entity yet: it gets an empty one, so the stock has somewhere to live.
      if (!e && d.world.getBlock(x, y, z).key === 'crate') {
        e = emptyCrateEntity(x, y, z);
        d.world.setEntity(e);
      }
      return e && e.kind === 'crate' ? new Inventory(e.slots as Slot[]) : null;
    },
    give: (item, n) => d.player.give(item, n),
    currentGoal: () => d.objectives.current?.id ?? null,
    completed: () => new Set(d.objectives.completed.map((o) => o.id)),
    timeOfDay: () => d.clock.timeOfDay,
    day: () => d.clock.day,
    worldSeed: () => d.world.seed,
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
    jobs: d.workshop
      ? {
          peek: (s) => (d.world.isLoaded(s.x, s.z) ? d.workshop!.peek(s.x, s.y, s.z) : []),
          take: (s, item, max) => d.workshop!.take(s.x, s.y, s.z, item, max),
          canOffer: (s, item, n) => d.workshop!.canOffer(s.x, s.y, s.z, item, n),
          offer: (s, item, n) => d.workshop!.offer(s.x, s.y, s.z, item, n),
          loaded: (s) => d.world.isLoaded(s.x, s.z),
          spill: (s, item, n) => d.player.ground.spawn(item, n, s.x + 0.5, s.y + 1.1, s.z + 0.5),
          // Machine wear (docs/api/machine-wear.md) may not be in this build: the job then says so.
          worn: typeof sim.wornMachines === 'function' ? (near) => sim.wornMachines!(0.25, near) : undefined,
          tend: typeof sim.tendMachine === 'function' ? (x, y, z) => sim.tendMachine!(x, y, z) : undefined,
          blockAt: (s) => (d.world.isLoaded(s.x, s.z) ? d.world.getBlock(s.x, s.y, s.z).key : null),
        }
      : undefined,
    companion: {
      world: d.world,
      player: () => ({ x: d.player.position.x, y: d.player.position.y, z: d.player.position.z, dead: d.player.dead }),
      hostiles: () => d.mobs.all.filter((m) => m.spec.hostile && m.health > 0).map((m) => ({ id: m.id, x: m.x, y: m.y, z: m.z })),
      hit: (id, dmg, fx, fz) => void d.mobs.hit(id, dmg, fx, fz),
    },
  };
}
