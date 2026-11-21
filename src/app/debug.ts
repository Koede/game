/**
 * window.__hw: a debug handle for tests and the browser console. A read-only summary of the running game plus
 * helpers that SET UP states quickly (give items, teleport, set the time, place a voxel, open a screen, run ticks,
 * save, reset). Tests use it to get somewhere fast, never to fake the thing they are testing.
 */
import { DT } from '../core/constants';
import type { DamageCause, ScreenRequest } from '../core/gameEvents';
import { blockId, blockOf, itemOrNull } from '../core/registry';
import { makeVoxel, voxelActive, voxelFacing, type Facing, type WeatherKind, type WeatherState } from '../core/types';
import { isFurnace } from '../sim';
import type { App } from './app';

export interface DebugSummary {
  phase: string;
  ready: boolean;
  hasSave: boolean;
  persistent: boolean;
  lastSave: App['lastSave'];
  frames: number;
  ticks: number;
  seed: number | null;
  player: {
    x: number; y: number; z: number; yaw: number; pitch: number;
    health: number; warmth: number; dead: boolean; onGround: boolean; selectedSlot: number;
    home: { x: number; y: number; z: number } | null;
  } | null;
  inventory: { slot: number; item: string; count: number; durability?: number }[];
  time: { timeOfDay: number; day: number; phase: string } | null;
  objective: { id: string | null; completed: string[]; age: number } | null;
  furnaces: { x: number; y: number; z: number; tier: number; tempC: number; lit: boolean; draft: number; ignited: boolean;
    fuel: unknown[]; crucibleIn: unknown[]; crucibleOut: unknown[] }[];
  ui: { open: string | null; uiOpen: boolean; paused: boolean; touch: boolean; pointerLocked: boolean } | null;
  target: { x: number; y: number; z: number; block: string; mining: number } | null;
  render: { drawCalls: number; triangles: number; chunks: number } | null;
  world: { loaded: number; meshed: number; mode: string } | null;
  /** The sky (spec 15), with `forced` true while setWeather holds it. */
  weather: (WeatherState & { forced: boolean }) | null;
}

export interface DebugHandle {
  readonly app: App;
  state(): DebugSummary;
  give(item: string, count?: number): number;
  teleport(x: number, y: number, z: number): void;
  look(yaw: number, pitch: number): void;
  /** Turns the view to the centre of block (x, y, z). */
  lookAt(x: number, y: number, z: number): void;
  setTime(timeOfDay: number): void;
  /** Sets the clock's day (1-based; the moon follows: day 1 full, day 5 new). */
  setDay(day: number): void;
  /**
   * Turns the weather to `kind` (at once unless `instant` is false: then over a few seconds) and holds it for a
   * long while; 'auto' hands the sky back to the seed's timetable.
   */
  setWeather(kind: WeatherKind | 'auto', instant?: boolean): void;
  /** Hurts the player (the real damage rules: events, sounds, death at 0). */
  damage(amount: number, cause?: DamageCause): void;
  setVoxel(x: number, y: number, z: number, block: string, facing?: number, active?: boolean): boolean;
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
  newWorld(seed?: string | null): void;
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
      return {
        phase: app.phase,
        ready: g?.ready ?? false,
        hasSave: app.hasSave,
        persistent: app.slot.persistent,
        lastSave: app.lastSave,
        frames: g?.frames ?? 0,
        ticks: s?.ticks ?? 0,
        seed: s ? s.world.seed : null,
        player: p
          ? {
              x: round(p.position.x), y: round(p.position.y), z: round(p.position.z), yaw: round(p.yaw), pitch: round(p.pitch),
              health: p.health, warmth: round(p.warmth, 1), dead: p.dead, onGround: p.onGround, selectedSlot: p.selectedSlot,
              home: p.home ? { ...p.home } : null,
            }
          : null,
        inventory: p
          ? p.inventory.slots.flatMap((st, slot) => (st ? [{ slot, item: st.item, count: st.count, ...(st.durability !== undefined ? { durability: st.durability } : {}) }] : []))
          : [],
        time: s ? { timeOfDay: round(s.clock.timeOfDay, 4), day: s.clock.day, phase: s.clock.phase } : null,
        objective: s ? { id: s.objectives.current?.id ?? null, completed: s.objectives.completed.map((o) => o.id), age: s.objectives.age } : null,
        furnaces: s
          ? [...s.world.entities()].filter(isFurnace).map((f) => ({
              x: f.x, y: f.y, z: f.z, tier: f.tier, tempC: round(f.tempC, 2), lit: f.lit, draft: round(f.draft), ignited: f.ignited,
              fuel: JSON.parse(JSON.stringify(f.fuel)), crucibleIn: JSON.parse(JSON.stringify(f.crucibleIn)), crucibleOut: JSON.parse(JSON.stringify(f.crucibleOut)),
            }))
          : [],
        ui: g ? { open: g.ui.current?.type ?? (g.ui.isOpen ? 'modal' : null), uiOpen: g.input.uiOpen, paused: g.input.paused, touch: g.input.touch, pointerLocked: g.input.pointerLocked } : null,
        target: g?.controller.target
          ? { x: g.controller.target.x, y: g.controller.target.y, z: g.controller.target.z, block: g.controller.target.block.key, mining: round(g.controller.miningProgress) }
          : null,
        render: g ? { drawCalls: g.renderer.stats.drawCalls, triangles: g.renderer.stats.triangles, chunks: g.renderer.stats.chunks } : null,
        world: s ? (({ loaded, meshed, mode }) => ({ loaded, meshed, mode }))(s.world.stats()) : null,
        weather: s ? { ...s.weather.state, blend: round(s.weather.state.blend), intensity: round(s.weather.state.intensity), cloudCover: round(s.weather.state.cloudCover), nextInS: round(s.weather.state.nextInS, 1), forced: s.weather.override !== null } : null,
      };
    },
    give(item, count = 1) {
      if (!itemOrNull(item)) throw new Error(`unknown item "${item}"`);
      return count - game().state.player.give(item, count);
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
    damage(amount, cause = 'fall') {
      game().state.player.damage(amount, cause);
    },
    setVoxel(x, y, z, block, facing = 0, active = false) {
      return game().state.world.setVoxel(x, y, z, makeVoxel(blockId(block), facing as Facing, active), 'sim');
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
      const py = Math.floor(player.position.y);
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
      const g = game();
      for (let i = 0; i < n; i++) g.state.tick(DT);
    },
    save: () => app.save(),
    newWorld: (seed = null) => app.newWorld(seed),
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
