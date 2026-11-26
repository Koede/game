/**
 * The energy ledger of the steam age (docs/advice/tech-spine.md K2, K3, 1.2). One power convention and one table of efficiencies,
 * so no arrow of the chain heat -> steam -> shaft -> work can make energy. Tested in energy.test.ts.
 */
/** Shaft power in watts per stress unit per rpm: W = su x |rpm| x 3.125 (the existing 1/50 su per W at 16 rpm). */
export const W_PER_SU_RPM = 3.125;
/** Joules in one litre of steam at 1 bar of its network: 1 kW of heat makes 6 L/s. */
export const STEAM_J_PER_L = 167;
/** Litres of water spent per litre of steam. */
export const WATER_PER_STEAM = 0.1;
/** Every arrow is below 1 and lives here. */
export const ETA = {
  /** Open rotor: weak on purpose. 200 W from the 3.3 kW the steam kettle draws. */
  rotor: 0.061,
  /** Beam engine: .09 at 2 bar rising to .18 from 5.6 bar. */
  beamEngine: (bar: number): number => Math.min(0.18, 0.04 + 0.025 * bar),
  /** Reserved for the Forge and later (planned machines). */
  steamHammer: 0.12,
  compressor: 0.75,
  dynamo: 0.85,
} as const;
/** Heat the steam kettle draws while its rotor works, W. */
export const KETTLE_HEAT_W = 3300;
/** Heat one boiler heat port passes, W. */
export const HEAT_PORT_W = 10_000;
/** The beam engine's steam use at full load, litres per second per bar. */
export const ENGINE_L_PER_BAR = 10;
export const suFromW = (w: number, rpm: number): number => (rpm === 0 ? 0 : w / (Math.abs(rpm) * W_PER_SU_RPM));
export const wFromSu = (su: number, rpm: number): number => su * Math.abs(rpm) * W_PER_SU_RPM;
/** Shaft watts a windmill gives at wind `w` (0..1): 100 + 300 w. */
export const windmillW = (w: number): number => 100 + 300 * w;
