/** Every one-shot the game can request, by name. A missing SfxName here is a compile error. */
import type { SfxName } from '../core/gameEvents';
import type { Patch } from './patch';
import { CUE_SFX } from './sfxCues';
import { HEARTH_SFX } from './sfxHearth';
import { WORLD_SFX } from './sfxWorld';

export const SFX: Readonly<Record<SfxName, Patch>> = { ...WORLD_SFX, ...HEARTH_SFX, ...CUE_SFX };

export const SFX_NAMES = Object.keys(SFX) as SfxName[];
