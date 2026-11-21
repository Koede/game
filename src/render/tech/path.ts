/** Polyline helpers for packets travelling along their pipe path (xyz vertex triples). Pure, node-testable. */

/** Cumulative length at each vertex of a polyline (first 0, last = total length). */
export function cumulativeLengths(points: Float32Array): Float32Array {
  const n = Math.floor(points.length / 3);
  const out = new Float32Array(Math.max(1, n));
  for (let i = 1; i < n; i++) {
    const dx = points[i * 3] - points[i * 3 - 3];
    const dy = points[i * 3 + 1] - points[i * 3 - 2];
    const dz = points[i * 3 + 2] - points[i * 3 - 1];
    out[i] = out[i - 1] + Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return out;
}

/**
 * The point `s` along the polyline (clamped to its ends), written into out[0..2]. `hint` is the segment to start
 * looking from (a packet only moves forward); returns the segment the point lies on, to pass as the next hint.
 */
export function pointAlong(points: Float32Array, cum: Float32Array, s: number, out: Float32Array, hint = 0): number {
  const n = cum.length;
  if (n < 2 || points.length < 6) {
    out[0] = points[0] ?? 0;
    out[1] = points[1] ?? 0;
    out[2] = points[2] ?? 0;
    return 0;
  }
  const total = cum[n - 1];
  const d = s <= 0 ? 0 : s >= total ? total : s;
  let i = hint > 0 && hint < n - 1 && cum[hint] <= d ? hint : 0;
  while (i < n - 2 && cum[i + 1] < d) i++;
  const len = cum[i + 1] - cum[i];
  const t = len > 0 ? (d - cum[i]) / len : 0;
  const a = i * 3;
  out[0] = points[a] + (points[a + 3] - points[a]) * t;
  out[1] = points[a + 1] + (points[a + 4] - points[a + 1]) * t;
  out[2] = points[a + 2] + (points[a + 5] - points[a + 2]) * t;
  return i;
}

/**
 * Where a packet is drawn: its last known `along` advanced by `speed` for `since` seconds, clamped to `length`, in
 * the polyline's own length units (`total`; the simulation's `length` may count blocks slightly differently).
 */
export function packetDistance(along: number, speed: number, since: number, length: number, total: number): number {
  const a = Math.min(length, along + Math.max(0, speed) * since);
  return length > 0 ? (a / length) * total : 0;
}
