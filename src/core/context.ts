/** Small pieces of state shared by modules that otherwise do not know each other. */
import { EventBus } from './events';
import type { GameEvents } from './gameEvents';

export type GameBus = EventBus<GameEvents>;
export const createBus = (): GameBus => new EventBus<GameEvents>();

export interface Settings {
  /** Chunks drawn in every direction around the player. */
  renderDistance: number;
  /** Vertical field of view in degrees. */
  fov: number;
  /** Mouse look speed multiplier (1 = default). */
  mouseSensitivity: number;
  /** Touch look speed multiplier (1 = default). */
  touchSensitivity: number;
  invertY: boolean;
  /** Master volume 0..1. */
  volume: number;
  /** Sound effects level 0..1, on top of the master volume (1 = as mixed). */
  effectsVolume: number;
  /** Music level 0..1 (the tavern jukebox), on top of the master volume. */
  musicVolume: number;
  /** Ambience level 0..1 (fire, wind, rain, machinery hum), on top of the master volume. */
  ambienceVolume: number;
  /** 'auto' shows on-screen controls when the device has a touch screen. */
  touchControls: 'auto' | 'on' | 'off';
  showFps: boolean;
  /**
   * Spec 19.3: Peaceful (no automatons; objectives that need one complete themselves through FLAG_PEACEFUL), Normal,
   * Hard (HOSTILE_CAP x1.5, HOSTILE_DAMAGE_MULT x1.25). Older saved settings lack it and read as 'normal'.
   */
  difficulty: Difficulty;
  /** 'large' scales the HUD, the touch buttons and their captions up for small phone screens (review ui-10). */
  uiScale: 'normal' | 'large';
  /** Forgiving jumps: coyote time and jump buffering. */
  moveAssist: boolean;
  /** Walk up one-block ledges without jumping (on by default for touch). */
  autoStep: boolean;
  /** No decorative movement: view bob, sprint FOV kick, landing dip, UI flashes, pulses and slides (starts on when the device asks for reduced motion). */
  reduceMotion: boolean;
  /**
   * Accessibility: 'red-green' (protan / deutan) and 'blue-yellow' (tritan) swap the status colours and every grid overlay's
   * ramp (heat, power) for ones that stay apart for that kind of colour blindness (src/ui/kit/palette.ts). Older saves with
   * `colorSafe: true` read as 'red-green'.
   */
  colorMode: ColorMode;
  /** Accessibility: multiplies text everywhere in the UI (0.85..1.6; 1 = default). Stacks with `uiScale`. */
  textScale: number;
  /** Accessibility: multiplies the HUD (vitals, hotbar, compass, goal, feed) and the touch buttons (0.8..1.5; 1 = default). */
  hudScale: number;
  /** Accessibility: a tap on the world walks there (the view turns, the body walks and steps up); any stick or key input cancels it. Taps then no longer press Use - the Use button does. */
  tapToMove: boolean;
  /** Short vibrations on phones for mining, crafting and getting hurt (where the browser can vibrate). */
  haptics: boolean;
  /** Keep the screen awake while playing (the Screen Wake Lock, where the browser has one); paused or hidden it lets go. */
  keepAwake: boolean;
  /** 'Auto-buck felled trees': a tree's log is cut into pieces as soon as it lands (game/fallingTrees.ts). Off: the axe cuts it piece by piece. */
  autoBuck: boolean;
  /** Falling trees hurt what they land on: the player and animals (on by default; off for a relaxed game). Trees still fall. */
  treeDamage: boolean;
  /**
   * 'low' drops water waves, foam and loot beams and closes the fog in; 'high' keeps the fog clearer (src/render/quality.ts).
   * Optional: older saves lack it and read as 'normal'.
   */
  graphics?: 'low' | 'normal' | 'high';
  /** Item magnet: how far dropped items fly to the player (src/game/magnet.ts). Older saved settings lack it and read as 'off'. */
  itemMagnet: 'off' | 'small' | 'large';
  /** Loot filter: 'all' picks up every drop; 'junk' leaves rubble, dirt, seeds, sand and gravel lying (src/game/lootFilter.ts). Older saves read as 'all'. */
  lootFilter: 'all' | 'junk';
  /** One-handed touch layout: the whole control cluster and the joystick sit under the thumb of this side. Older saves read as 'off'. */
  oneHanded: 'off' | 'left' | 'right';
}

/** Colour-blind palette: off, red-green (protanopia, deuteranopia) or blue-yellow (tritanopia). */
export type ColorMode = 'off' | 'red-green' | 'blue-yellow';
export const COLOR_MODES: readonly ColorMode[] = ['off', 'red-green', 'blue-yellow'];

/** Spec 19.3. */
export type Difficulty = 'peaceful' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['peaceful', 'normal', 'hard'];

/** Render distance by default: phones draw less (about 30% fewer chunks, draw calls and frame time than at 6). */
export const PHONE_RENDER_DISTANCE = 4;
export const DESKTOP_RENDER_DISTANCE = 6;
/** The most a touch-first device may ask for (the settings slider stops here and saved values are clamped): 625 chunks at 12 is too much for a phone. */
export const PHONE_MAX_RENDER_DISTANCE = 6;

/** A touch-first device (phone, tablet): a coarse primary pointer on a touch screen. False outside a browser. */
export const isTouchFirst = (): boolean =>
  typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0 &&
  typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** The defaults for a touch-first device or not. Saved choices are merged over them (src/save). */
/** The device asks for less motion (the OS accessibility switch). False outside a browser. */
export const prefersReducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const defaultSettings = (touchFirst: boolean, reduceMotion = false): Settings => ({
  renderDistance: touchFirst ? PHONE_RENDER_DISTANCE : DESKTOP_RENDER_DISTANCE,
  fov: 72,
  mouseSensitivity: 1,
  touchSensitivity: 1,
  invertY: false,
  volume: 0.8,
  effectsVolume: 1,
  musicVolume: 1,
  ambienceVolume: 1,
  touchControls: 'auto',
  showFps: false,
  difficulty: 'normal',
  uiScale: 'normal',
  moveAssist: true,
  autoStep: touchFirst,
  reduceMotion,
  colorMode: 'off',
  textScale: 1,
  hudScale: 1,
  tapToMove: false,
  haptics: true,
  keepAwake: true,
  autoBuck: false,
  treeDamage: true,
  graphics: 'normal',
  itemMagnet: 'off',
  lootFilter: 'all',
  oneHanded: 'off',
});

/** This device's defaults, fixed when the module loads (in node: the desktop ones). */
export const DEFAULT_SETTINGS: Settings = defaultSettings(isTouchFirst(), prefersReducedMotion());

/** Who currently owns the player's attention. Written by the UI and the controls, read by everybody. */
export interface InputState {
  /** A modal screen (inventory, furnace, pause...) is open: gameplay input must be ignored. */
  uiOpen: boolean;
  /** The mouse is captured for looking around. */
  pointerLocked: boolean;
  /** On-screen touch controls are active. */
  touch: boolean;
  /** The simulation is paused (pause menu, title screen). */
  paused: boolean;
}

export const createInputState = (): InputState => ({ uiOpen: false, pointerLocked: false, touch: false, paused: false });

/**
 * What the player controller needs from whatever draws the world. src/render's Renderer implements it;
 * tests and harnesses can pass a stub.
 */
export interface IView {
  /** Places the camera: eye position, yaw (radians, 0 = north/-Z, positive turns left) and pitch (positive looks up). */
  setView(x: number, y: number, z: number, yaw: number, pitch: number): void;
  /** Vertical field of view in degrees. */
  setFov(degrees: number): void;
  /** Outlines the targeted block (null = none). `mining` is the mining progress 0..1, or -1 when not mining. */
  setTarget(target: { x: number; y: number; z: number } | null, mining: number): void;
  /** Shows this item in the player's hand (null = empty hand). */
  setHeldItem(itemKey: string | null): void;
  /** Plays the hand swing once (mining hit, placing, using). */
  triggerSwing(): void;
}
