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
  /** 'auto' shows on-screen controls when the device has a touch screen. */
  touchControls: 'auto' | 'on' | 'off';
  showFps: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  renderDistance: 6,
  fov: 72,
  mouseSensitivity: 1,
  touchSensitivity: 1,
  invertY: false,
  volume: 0.8,
  touchControls: 'auto',
  showFps: false,
};

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
