/** The workshop parts of bridges, lifts and elevators (docs/api/lifts.md): kinetic, they join shaft networks. */
export const LIFT_WINCHES = ['lift_winch', 'elevator_winch'] as const;
export type WinchKind = (typeof LIFT_WINCHES)[number];
export const LIFT_PARTS: readonly string[] = [...LIFT_WINCHES, 'drawbridge'];
export const isWinch = (key: string): key is WinchKind => (LIFT_WINCHES as readonly string[]).includes(key);
