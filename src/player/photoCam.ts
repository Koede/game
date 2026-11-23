/**
 * Photo mode's free camera: a detached eye that flies where you look while the player stands still, plus the layout of the framed shot.
 * DOM-free (the canvas work is in src/app/photo.ts).
 */
export const PHOTO_SPEED = 6;
export const PHOTO_FAST = 3;
const PITCH_LIMIT = Math.PI / 2 - 0.02;

export interface PhotoInput {
  /** Strafe right (+) / left (-) and forward (+) / back (-), -1..1. */
  moveX: number;
  moveZ: number;
  /** Rise while true. */
  up: boolean;
  fast: boolean;
  /** Look deltas in radians, as in the controller's intent (yaw is subtracted, as the player's is). */
  lookYaw: number;
  lookPitch: number;
}

export class PhotoCamera {
  active = false;
  x = 0;
  y = 0;
  z = 0;
  yaw = 0;
  pitch = 0;

  /** Starts at the player's eye, looking the way they look. */
  enter(x: number, y: number, z: number, yaw: number, pitch: number): void {
    this.active = true;
    this.x = x;
    this.y = y;
    this.z = z;
    this.yaw = yaw;
    this.pitch = pitch;
  }

  exit(): void {
    this.active = false;
  }

  update(dt: number, i: PhotoInput): void {
    if (!this.active) return;
    this.yaw -= i.lookYaw;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + i.lookPitch));
    const speed = PHOTO_SPEED * (i.fast ? PHOTO_FAST : 1) * dt;
    // Same convention as the player: yaw 0 looks down -z, the view direction is (-sin yaw, 0, -cos yaw).
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const cp = Math.cos(this.pitch);
    this.x += (fx * cp * i.moveZ + Math.cos(this.yaw) * i.moveX) * speed;
    this.z += (fz * cp * i.moveZ - Math.sin(this.yaw) * i.moveX) * speed;
    this.y += (Math.sin(this.pitch) * i.moveZ + (i.up ? 1 : 0)) * speed;
  }
}

export interface ShotLayout {
  width: number;
  height: number;
  /** The picture's rectangle inside the frame. */
  picture: { x: number; y: number; w: number; h: number };
  /** Baseline of the caption. */
  captionY: number;
  captionSize: number;
}

/** A photograph with a thin border and a wider strip at the bottom for the caption. */
export function shotLayout(srcW: number, srcH: number): ShotLayout {
  const border = Math.max(8, Math.round(Math.min(srcW, srcH) * 0.03));
  const strip = Math.round(border * 3.2);
  return {
    width: srcW + border * 2,
    height: srcH + border + strip,
    picture: { x: border, y: border, w: srcW, h: srcH },
    captionY: srcH + border + Math.round(strip * 0.62),
    captionSize: Math.round(strip * 0.4),
  };
}

/** "Hearthwatt - Day 12, evening" style caption and a file name that sorts by time. */
export function shotCaption(day: number, phase: string): string {
  return `Hearthwatt - Day ${day}, ${phase}`;
}

export function shotFileName(day: number, stamp: number): string {
  return `hearthwatt-day${day}-${stamp}.png`;
}
