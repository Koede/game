/** Every one-shot the game can request, by name. A missing SfxName here is a compile error. */
import type { SfxName } from '../core/gameEvents';
import type { Patch } from './patch';
import { BREW_SFX } from './sfxBrew';
import { CUE_SFX } from './sfxCues';
import { EMBER_SFX } from './sfxEmber';
import { FARM_SFX } from './sfxFarm';
import { HAND_SFX } from './sfxHand';
import { HEARTH_SFX } from './sfxHearth';
import { TRANSPORT_SFX } from './sfxTransport';
import { WEATHER_SFX } from './sfxWeather';
import { WORLD_SFX } from './sfxWorld';

export const SFX: Readonly<Record<SfxName, Patch>> = { ...WORLD_SFX, ...HEARTH_SFX, ...CUE_SFX, ...FARM_SFX, ...WEATHER_SFX, ...TRANSPORT_SFX, ...EMBER_SFX, ...BREW_SFX, ...HAND_SFX };

export const SFX_NAMES = Object.keys(SFX) as SfxName[];
