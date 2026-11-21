/** How a world is played. Chosen once, on the title screen, when the world is created; stored in the save. */
export type GameMode = 'survival' | 'dev';

export const GAME_MODES: readonly GameMode[] = ['survival', 'dev'];

/** Any stored value -> a mode. Missing or unknown values are survival, so old saves load unchanged. */
export function parseGameMode(raw: unknown): GameMode {
  return raw === 'dev' ? 'dev' : 'survival';
}

export const modeLabel = (mode: GameMode): string => (mode === 'dev' ? 'Dev Mode' : 'Survival');
