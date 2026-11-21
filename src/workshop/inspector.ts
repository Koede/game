/**
 * Engineer's Goggles (docs/api/workshop.md): carried in the pack, they turn the crosshair name into a reading of what is
 * aimed at: a workshop part's speed and load, a furnace's heat and fire, a machine's state and watts. Structural probes
 * only, so the app can feed it from the simulation without this file importing it.
 */
export const GOGGLES = 'engineer_goggles';

export interface InspectProbe {
  workshop(x: number, y: number, z: number): string | null;
  furnace(x: number, y: number, z: number): { name: string; tempC: number; burning: boolean; burnTimeLeftS: number } | null;
  machine(x: number, y: number, z: number): { name: string; status: string; outW: number; demandW: number; satisfaction: number } | null;
}

export function inspect(probe: InspectProbe, x: number, y: number, z: number): string | null {
  const part = probe.workshop(x, y, z);
  if (part) return part;
  const f = probe.furnace(x, y, z);
  if (f) return `${f.name} - ${Math.round(f.tempC)} °C, ${f.burning ? `fire ${Math.ceil(f.burnTimeLeftS)} s` : 'no fire'}`;
  const m = probe.machine(x, y, z);
  if (m) {
    const watts = m.outW > 0 ? `makes ${Math.round(m.outW)} W` : m.demandW > 0 ? `needs ${Math.round(m.demandW)} W (${Math.round(m.satisfaction * 100)}% met)` : '';
    return [`${m.name} - ${m.status}`, watts].filter(Boolean).join(', ');
  }
  return null;
}
