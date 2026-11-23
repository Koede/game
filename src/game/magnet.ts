/**
 * Item magnet (docs/api/assist.md): a setting (off / small / large) that pulls dropped items to the player from further than the
 * plain pickup radius, like a built-in weak collector. Off is the game's normal pickup.
 */
import type { ActiveCollector } from './groundItems';

export type MagnetMode = 'off' | 'small' | 'large';
export const MAGNET_MODES: readonly MagnetMode[] = ['off', 'small', 'large'];

/** Pull radius (blocks around the body) and speed (blocks/s) per mode. The plain pickup radius is 1.4 and its flight speed 9. */
const MAGNET: Record<Exclude<MagnetMode, 'off'>, ActiveCollector> = {
  small: { radius: 3, pull: 8 },
  large: { radius: 6, pull: 10 },
};

export const magnetCollector = (mode: MagnetMode): ActiveCollector | null => (mode === 'off' ? null : MAGNET[mode] ?? null);

export const isMagnetMode = (v: unknown): v is MagnetMode => typeof v === 'string' && (MAGNET_MODES as readonly string[]).includes(v);
