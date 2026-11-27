/**
 * window.__hw: a debug handle for tests and the browser console. A read-only summary of the running game plus
 * helpers that SET UP states quickly (give items, teleport, set the time, place a voxel, open a screen, run ticks,
 * save, reset). Tests use it to get somewhere fast, never to fake the thing they are testing.
 */
import type { Difficulty, Settings } from '../core/context';
import type { DamageCause, ScreenRequest } from '../core/gameEvents';
import { blockId, blockOf, creature, itemOrNull } from '../core/registry';
import { makeVoxel, voxelActive, voxelFacing, type Facing, type WeatherKind, type WeatherState } from '../core/types';
import { makeEnchantedStack } from '../game/inventory';
import { isFurnace } from '../sim';
import type { App } from './app';

import type { NpcManager, TownDebug } from '../npcs/manager';
import type { TownPage } from '../npcs/townPage';
import { checkRoom } from '../npcs/housing';
import { LODGE_BED } from '../npcs/lodge';

export interface DebugSummary {
  phase: string;
  ready: boolean;
  hasSave: boolean;
  /** 'dev' or 'survival' while a world runs, else null. */
  gameMode: string | null;
  persistent: boolean;
  lastSave: App['lastSave'];
  frames: number;
  ticks: number;
  seed: number | null;
  player: {
    x: number; y: number; z: number; yaw: number; pitch: number;
    health: number; warmth: number; food: number; dead: boolean; onGround: boolean; selectedSlot: number;
    home: { x: number; y: number; z: number } | null;
  } | null;
  inventory: { slot: number; item: string; count: number; durability?: number; enchants?: Record<string, number> }[];
  time: { timeOfDay: number; day: number; phase: string } | null;
  objective: { id: string | null; completed: string[]; age: number } | null;
  furnaces: { x: number; y: number; z: number; tier: number; tempC: number; lit: boolean; draft: number; ignited: boolean;
    fuel: unknown[]; crucibleIn: unknown[]; crucibleOut: unknown[]; crucibleMelt: unknown[]; crucibleMoltenS: number[] }[];
  ui: { open: string | null; uiOpen: boolean; paused: boolean; touch: boolean; pointerLocked: boolean } | null;
  target: { x: number; y: number; z: number; block: string; mining: number } | null;
  /** The animal under the crosshair (spec 12.5), or null. */
  targetAnimal: { id: number; name: string } | null;
  /** Living animals in loaded columns, nearest first. */
  mobs: { id: number; species: string; x: number; y: number; z: number; health: number; baby: boolean; state: string; d: number }[];
  render: { drawCalls: number; triangles: number; chunks: number; precipitation: number; particles: number } | null;
  world: { loaded: number; meshed: number; mode: string } | null;
  /** The sky (spec 15), with `forced` true while setWeather holds it. */
  weather: (WeatherState & { forced: boolean }) | null;
  /** Automatons simulated in the last tick (spec 19), nearest first (broken ones while their debris fades included). */
  hostiles: { id: number; species: string; x: number; y: number; z: number; health: number; mode: string; role: string;
    dormant: boolean; dying: boolean; d: number }[];
  /** Ember bolts in flight. */
  projectiles: number;
  /** The player's side of combat (spec 19.4) and the session's difficulty. */
  combat: { difficulty: Difficulty; burning: boolean; lastAttacker: string | null; killedBy: string | null; deathCause: string | null } | null;
}

export interface DebugHandle {
  readonly app: App;
  state(): DebugSummary;
  /** `enchants` (e.g. { veinseeker: 2 }) gives one enchanted stack; tests only. */
  give(item: string, count?: number, enchants?: Record<string, number>): number;
  teleport(x: number, y: number, z: number): void;
  /** Items lying in the world (drops waiting to be picked up), for the e2e driver. */
  groundItems(): { item: string; count: number; x: number; y: number; z: number }[];
  /** Gruk's town (npcs/manager.ts townDebug): the building in progress, the build board, the storage bay and its crate. Null before a world runs. */
  town(): TownDebug | null;
  /** The settlement (npcs/manager.ts settlementDebug): the move-in line, the rooms, who lives where, contentment, camp goals. */
  settlement(): ReturnType<NpcManager['settlementDebug']> | null;
  /** The Town page's data (npcs/townPage.ts). */
  townPage(): TownPage | null;
  /** Runs `n` nights of the move-in roll at once and returns who arrived (e2e). */
  skipNights(n: number): string[];
  /** Settlement jobs (npcs/jobs.ts): what each resident is set to carry. */
  jobs(): { id: string; kind: string; filter: string; from: { x: number; y: number; z: number } | null; to: { x: number; y: number; z: number } | null; status: string; moved: number; carrying: { item: string; count: number } | null }[];
  /** Dev skip for the jobs e2e: gives `id` a job between two stops (the same calls the Jobs screen makes). False when they cannot work. */
  setJob(id: string, kind: 'haul' | 'feed' | null, from?: { x: number; y: number; z: number }, to?: { x: number; y: number; z: number }, filter?: 'ore' | 'fuel' | 'any'): boolean;
  /** Fallen logs (game/fallenLogs.ts): length, and the rod's bottom end and angle, so a test can aim at the tip. */
  fallenLogs(): { id: number; length: number; ox: number; oy: number; oz: number; dx: number; dz: number; theta: number }[];
  look(yaw: number, pitch: number): void;
  /** Turns the view to the centre of block (x, y, z). */
  lookAt(x: number, y: number, z: number): void;
  /**
   * Dev skip for tests and e2e of the tavern: builds the full tavern at the camp, everyone moves in and the player goes to the hall.
   * False when the world has no camp to settle (it has its tavern already, or is not running).
   */
  settle(): boolean;
  /** The lodge (npcs/lodge.ts): the tavern level (0 camp, 1..4 stages in, 5 the full tavern), the origin, the spawn and the bedroom's check reasons. */
  lodge(): { level: number; origin: number[] | null; hasTavern: boolean; spawn: { x: number; y: number; z: number } | null; bedroom: string[] | null };
  /** Dev skip for the lodge's e2e: puts `n` of every block the lodge's stages use into the storage bay's stock. Returns `n`. */
  supplyLodge(n: number): number;
  setTime(timeOfDay: number): void;
  /** Sets the clock's day (1-based; the moon follows: day 1 full, day 5 new). */
  setDay(day: number): void;
  /**
   * Turns the weather to `kind` (at once unless `instant` is false: then over a few seconds) and holds it for a
   * long while; 'auto' hands the sky back to the seed's timetable.
   */
  setWeather(kind: WeatherKind | 'auto', instant?: boolean): void;
  /** Announces that age `age` began (the postcard and story directors react), without touching the furnace. */
  advanceAge(age: number): void;
  /** Sets the food bar (0..20), e.g. to make room for a meal. */
  setFood(food: number): void;
  /** Empties the pack and the hotbar (to start a check with known items). */
  clearInventory(): void;
  /** Hurts the player (the real damage rules: events, sounds, death at 0). */
  damage(amount: number, cause?: DamageCause): void;
  setVoxel(x: number, y: number, z: number, block: string, facing?: number, active?: boolean): boolean;
  /** Puts an animal of `species` with its feet at (x, y, z); returns its id. */
  /** Air temperature in C at a cell (src/game/thermal.ts). */
  temperatureAt(x: number, y: number, z: number): number;
  /** Makes the world a hard-winter one or not (docs/api/winter.md), for checks of frozen fields and greenhouses. */
  setHardWinter(on: boolean): void;
  /** What the crop at a cell is doing: shelter, air temperature, rate (docs/api/greenhouse.md); null when there is none. */
  cropView(x: number, y: number, z: number): { shelter?: string; tempC?: number; rate: number; exposed: boolean; status: string } | null;
  /** Turns the heat view on or off (same as the H key). */
  setHeatView(on: boolean): void;
  spawnMob(species: string, x: number, y: number, z: number, baby?: boolean): number;
  /** Changes Settings.difficulty the way the settings panel does (saved, applied to the running world at once). */
  setDifficulty(d: Difficulty): void;
  /** Changes settings the way the settings panel does (merged over the current ones, saved, applied at once). */
  setSettings(patch: Partial<Settings>): void;
  /** Whether (x, y, z) lies in a safe zone (a hot furnace's warm zone or a powered ward beacon's radius). */
  isSafe(x: number, y: number, z: number): boolean;
  /** Sets the wear (0..1) of the machine at a cell (set-up for the wear checks). */
  setMachineWear(x: number, y: number, z: number, wear: number): boolean;
  /** Pneumatic tube checks: a crate's stacks (null when there is no crate), filling one, and setting a network's pressure. */
  crate(x: number, y: number, z: number): Array<{ item: string; count: number }> | null;
  fillCrate(x: number, y: number, z: number, item: string, count: number): boolean;
  setAirBar(x: number, y: number, z: number, bar: number): boolean;
  getBlock(x: number, y: number, z: number): { block: string; facing: number; active: boolean; solid: boolean; replaceable: boolean };
  /** Draws a frame and reads it back from the GPU: how many distinct colours and how bright (0..255) it is. */
  sampleFrame(): { width: number; height: number; distinctColors: number; brightness: number };
  /** Nearest loaded blocks of a kind around the player (Chebyshev radius), nearest first. */
  findBlocks(block: string, radius?: number, limit?: number): { x: number; y: number; z: number; d: number }[];
  surfaceY(x: number, z: number): number;
  open(screen: ScreenRequest): void;
  close(): void;
  selectSlot(slot: number): void;
  tick(n: number): void;
  save(): boolean;
  newWorld(seed?: string | null, mode?: 'survival' | 'dev'): void;
  continueWorld(): void;
  quit(): void;
  /** Stops the running world without saving and deletes the save. */
  reset(): void;
}

const round = (n: number, places = 3): number => Math.round(n * 10 ** places) / 10 ** places;

export function createDebugHandle(app: App): DebugHandle {
  const game = () => {
    if (!app.game) throw new Error('no world is running');
    return app.game;
  };
  return {
    app,
    state(): DebugSummary {
      const g = app.game;
      const s = g?.state;
      const p = s?.player;
      const dist2 = (e: { x: number; y: number; z: number }): number => (p ? (e.x + 0.5 - p.position.x) ** 2 + (e.y - p.position.y) ** 2 + (e.z + 0.5 - p.position.z) ** 2 : 0);
      return {
        phase: app.phase,
        ready: g?.ready ?? false,
        hasSave: app.hasSave,
        gameMode: s?.mode ?? null,
        persistent: app.slot.persistent,
        lastSave: app.lastSave,
        frames: g?.frames ?? 0,
        ticks: s?.ticks ?? 0,
        seed: s ? s.world.seed : null,
        player: p
          ? {
              x: round(p.position.x), y: round(p.position.y), z: round(p.position.z), yaw: round(p.yaw), pitch: round(p.pitch),
              health: p.health, warmth: round(p.warmth, 1), food: round(p.food, 2), dead: p.dead, onGround: p.onGround, selectedSlot: p.selectedSlot,
              home: p.home ? { ...p.home } : null,
            }
          : null,
        inventory: p
          ? p.inventory.slots.flatMap((st, slot) => (st ? [{ slot, item: st.item, count: st.count, ...(st.durability !== undefined ? { durability: st.durability } : {}), ...(st.enchants ? { enchants: st.enchants } : {}) }] : []))
          : [],
        time: s ? { timeOfDay: round(s.clock.timeOfDay, 4), day: s.clock.day, phase: s.clock.phase } : null,
        objective: s ? { id: s.objectives.current?.id ?? null, completed: s.objectives.completed.map((o) => o.id), age: s.objectives.age } : null,
        furnaces: s
          // Nearest to the player first: a world can hold furnaces of its own (settlements), and a script means the one it is using.
          ? [...s.world.entities()].filter(isFurnace).sort((a, b) => dist2(a) - dist2(b)).map((f) => ({
              x: f.x, y: f.y, z: f.z, tier: f.tier, tempC: round(f.tempC, 2), lit: f.lit, draft: round(f.draft), ignited: f.ignited,
              fuel: JSON.parse(JSON.stringify(f.fuel)), crucibleIn: JSON.parse(JSON.stringify(f.crucibleIn)), crucibleOut: JSON.parse(JSON.stringify(f.crucibleOut)),
              crucibleMelt: JSON.parse(JSON.stringify(f.crucibleMelt)), crucibleMoltenS: f.crucibleMoltenS.map((v) => round(v, 2)),
            }))
          : [],
        ui: g ? { open: g.ui.current?.type ?? (g.ui.isOpen ? 'modal' : null), uiOpen: g.input.uiOpen, paused: g.input.paused, touch: g.input.touch, pointerLocked: g.input.pointerLocked } : null,
        target: g?.controller.target
          ? { x: g.controller.target.x, y: g.controller.target.y, z: g.controller.target.z, block: g.controller.target.block.key, mining: round(g.controller.miningProgress) }
          : null,
        targetAnimal: g && g.controller.targetAnimal !== null
          ? { id: g.controller.targetAnimal, name: s!.mobs.describe(g.controller.targetAnimal) }
          : null,
        mobs: s && p
          ? s.mobs.loaded.filter((m) => m.state !== 'dying').map((m) => ({
              id: m.id, species: m.spec.key, x: round(m.x), y: round(m.y), z: round(m.z), health: m.health, baby: m.baby, state: m.state,
              d: round(Math.hypot(m.x - p.position.x, m.z - p.position.z), 2),
            })).sort((a, b) => a.d - b.d)
          : [],
        render: g
          ? { drawCalls: g.renderer.stats.drawCalls, triangles: g.renderer.stats.triangles, chunks: g.renderer.stats.chunks, precipitation: g.renderer.stats.precipitation, particles: g.renderer.stats.particles }
          : null,
        world: s ? (({ loaded, meshed, mode }) => ({ loaded, meshed, mode }))(s.world.stats()) : null,
        hostiles: s && p
          ? s.mobs.hostiles.active.map((m) => ({
              id: m.id, species: m.spec.key, x: round(m.x), y: round(m.y), z: round(m.z), health: m.health,
              mode: m.hostile?.mode ?? '', role: m.hostile?.role ?? '', dormant: m.hostile?.mode === 'dormant', dying: m.state === 'dying',
              d: round(Math.hypot(m.x - p.position.x, m.z - p.position.z), 2),
            })).sort((a, b) => a.d - b.d)
          : [],
        projectiles: s ? s.mobs.hostiles.projectiles.views(1).length : 0,
        combat: s && p
          ? { difficulty: s.difficulty, burning: p.combat.burning, lastAttacker: p.combat.lastAttacker, killedBy: p.killedBy, deathCause: p.deathCause }
          : null,
        weather: s ? { ...s.weather.state, blend: round(s.weather.state.blend), intensity: round(s.weather.state.intensity), cloudCover: round(s.weather.state.cloudCover), nextInS: round(s.weather.state.nextInS, 1), forced: s.weather.override !== null } : null,
      };
    },
    give(item, count = 1, enchants) {
      if (!itemOrNull(item)) throw new Error(`unknown item "${item}"`);
      if (enchants) {
        const s = makeEnchantedStack(item, enchants, 1);
        return 1 - game().state.player.give(item, 1, s.durability, s.enchants);
      }
      return count - game().state.player.give(item, count);
    },
    jobs() {
      return game().state.npcs.jobs.all().map((v) => ({ id: v.id, kind: v.job.kind, filter: v.job.filter, from: v.job.from, to: v.job.to, status: v.status, moved: v.moved, carrying: v.carrying }));
    },
    setJob(id, kind, from, to, filter) {
      const npcs = game().state.npcs;
      if (!npcs.canWork(id)) return false;
      npcs.setJob(id, kind);
      if (kind === null) return true;
      if (filter) npcs.jobs.setFilter(id, filter);
      if (from) npcs.jobs.setStop(id, 'from', from);
      if (to) npcs.jobs.setStop(id, 'to', to);
      return true;
    },
    /** Fallen logs (game/fallenLogs.ts): length, and the rod's bottom end and angle, so a test can aim at the tip. */
    fallenLogs() {
      return game().trees.logs().map((l) => ({ id: l.id, length: l.length, ox: l.ox, oy: l.oy, oz: l.oz, dx: l.dx, dz: l.dz, theta: l.theta }));
    },
    groundItems() {
      return game().state.player.ground.items.map((g) => ({ item: g.item, count: g.count, x: g.x, y: g.y, z: g.z }));
    },
    town() {
      return game().state.npcs.townDebug();
    },
    settlement() {
      return game().state.npcs.settlementDebug();
    },
    townPage() {
      return game().state.npcs.townPage();
    },
    skipNights(n: number) {
      return game().state.npcs.skipNights(n);
    },
    lodge() {
      const s = game().state;
      const o = s.npcs.at;
      const bed = o ? { x: o[0] + LODGE_BED[0], y: o[1] + LODGE_BED[1], z: o[2] + LODGE_BED[2] } : null;
      return {
        level: s.npcs.tavernLevel,
        origin: o ? [...o] : null,
        hasTavern: s.npcs.hasTavern,
        spawn: s.npcs.bedSpawn(),
        // The first bedroom as the world holds it right now (null before the lodge stands).
        bedroom: bed && s.npcs.tavernLevel >= 1 && s.npcs.tavernLevel < 4 ? checkRoom(s.world, bed.x, bed.y, bed.z).reasons : null,
      };
    },
    supplyLodge(n) {
      return game().state.npcs.supplyLodge(n);
    },
    settle() {
      return game().state.settleNpcs();
    },
    teleport(x, y, z) {
      game().teleport(x, y, z);
    },
    look(yaw, pitch) {
      const p = game().state.player;
      p.yaw = yaw;
      p.pitch = pitch;
    },
    lookAt(x, y, z) {
      const p = game().state.player;
      const dx = x + 0.5 - p.position.x;
      const dy = y + 0.5 - p.eyeY;
      const dz = z + 0.5 - p.position.z;
      p.yaw = Math.atan2(-dx, -dz);
      p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    },
    advanceAge(age) {
      game().state.bus.emit('age:advanced', { age });
    },
    setTime(t) {
      game().state.clock.setTimeOfDay(t);
    },
    setDay(day) {
      const s = game().state;
      s.clock.day = Math.max(1, Math.floor(day));
      s.weather.update(0, s.clock.worldTimeS, s.clock.day, s.player.position);
    },
    setWeather(kind, instant = true) {
      const s = game().state;
      if (kind === 'auto') s.weather.release();
      else if (['clear', 'cloudy', 'rain', 'storm'].includes(kind)) s.weather.force(kind, s.clock.worldTimeS, instant);
      else throw new Error(`unknown weather "${kind}"`);
      s.weather.update(0, s.clock.worldTimeS, s.clock.day, s.player.position);
    },
    setFood(food) {
      game().state.player.food = Math.max(0, Math.min(20, food));
    },
    clearInventory() {
      game().state.player.inventory.clear();
    },
    damage(amount, cause = 'fall') {
      game().state.player.damage(amount, cause);
    },
    setVoxel(x, y, z, block, facing = 0, active = false) {
      return game().state.world.setVoxel(x, y, z, makeVoxel(blockId(block), facing as Facing, active), 'sim');
    },
    temperatureAt(x, y, z) {
      return game().state.thermal.temperatureAt(x, y, z);
    },
    setHardWinter(on) {
      const s = game().state;
      s.winter.hard = on;
      s.sim.hardWinter = on;
    },
    cropView(x, y, z) {
      const v = game().state.sim.cropView(x, y, z);
      return v && { shelter: v.shelter, tempC: v.tempC, rate: v.rate, exposed: v.exposed, status: v.status };
    },
    setHeatView(on) {
      const g = game() as unknown as { heatOn: boolean; toggleHeatView(): void };
      if (g.heatOn !== on) g.toggleHeatView();
    },
    spawnMob(species, x, y, z, baby = false) {
      const s = game().state;
      return s.mobs.add(creature(species), { x, y, z, yaw: 0 }, baby).id;
    },
    setDifficulty(d) {
      if (!['peaceful', 'normal', 'hard'].includes(d)) throw new Error(`unknown difficulty "${d}"`);
      app.changeSettings({ ...app.settings, difficulty: d }, 'difficulty');
    },
    setSettings(patch) {
      app.changeSettings({ ...app.settings, ...patch }, Object.keys(patch)[0] as keyof Settings);
    },
    isSafe(x, y, z) {
      return game().state.sim.isSafe(x, y, z);
    },
    setMachineWear(x, y, z, wear) {
      const e = game().state.sim.machineAt(x, y, z);
      if (!e) return false;
      e.wear = Math.max(0, Math.min(1, wear));
      return true;
    },
    crate(x, y, z) {
      const e = game().state.sim.machineAt(x, y, z);
      if (!e || e.kind !== 'crate') return null;
      return e.slots.filter((s) => s !== null).map((s) => ({ item: s!.item, count: s!.count }));
    },
    fillCrate(x, y, z, item, count) {
      const e = game().state.sim.machineAt(x, y, z);
      if (!e || e.kind !== 'crate') return false;
      const i = e.slots.indexOf(null);
      if (i < 0) return false;
      e.slots[i] = { item, count };
      game().state.sim.touch(e);
      return true;
    },
    setAirBar(x, y, z, bar) {
      const net = game().state.sim.air.netAt(x, y, z);
      if (!net) return false;
      net.airL = net.volumeL * bar;
      return true;
    },
    getBlock(x, y, z) {
      const v = game().state.world.getVoxel(x, y, z);
      const def = blockOf(v);
      return { block: def.key, facing: voxelFacing(v), active: voxelActive(v), solid: def.solid, replaceable: def.replaceable };
    },
    sampleFrame() {
      const g = game();
      g.renderer.render(0);
      const gl = g.renderer.gl.getContext();
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const px = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const colors = new Set<number>();
      let sum = 0;
      let n = 0;
      for (let i = 0; i < px.length; i += 4 * 37) {
        colors.add(((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3));
        sum += (px[i] + px[i + 1] + px[i + 2]) / 3;
        n++;
      }
      return { width, height, distinctColors: colors.size, brightness: Math.round(sum / Math.max(1, n)) };
    },
    findBlocks(block, radius = 24, limit = 16) {
      const { world, player } = game().state;
      const id = blockId(block);
      const px = Math.floor(player.position.x);
      const pz = Math.floor(player.position.z);
      const found: { x: number; y: number; z: number; d: number }[] = [];
      for (let x = px - radius; x <= px + radius; x++) {
        for (let z = pz - radius; z <= pz + radius; z++) {
          if (!world.isLoaded(x, z)) continue;
          for (let y = 0; y < 96; y++) {
            if ((world.getVoxel(x, y, z) & 0x3ff) !== id) continue;
            found.push({ x, y, z, d: round(Math.hypot(x + 0.5 - player.position.x, y + 0.5 - player.eyeY, z + 0.5 - player.position.z), 2) });
          }
        }
      }
      return found.sort((a, b) => a.d - b.d).slice(0, limit);
    },
    surfaceY(x, z) {
      return game().state.world.surfaceY(x, z);
    },
    open(screen) {
      game().bus.emit('ui:open', { screen });
    },
    close() {
      game().bus.emit('ui:close', {});
    },
    selectSlot(slot) {
      game().state.player.selectSlot(slot);
    },
    tick(n) {
      game().tick(n);
    },
    save: () => app.save(),
    newWorld: (seed = null, mode = 'survival') => app.newWorld(seed, mode),
    continueWorld: () => app.continueWorld(),
    quit: () => app.saveAndQuit(),
    reset() {
      app.stopGame();
      app.deleteSave();
      app.showTitle();
    },
  };
}

declare global {
  interface Window {
    __hw?: DebugHandle;
  }
}

export function installDebugHandle(app: App): void {
  window.__hw = createDebugHandle(app);
}
