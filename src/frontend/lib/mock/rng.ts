/**
 * Deterministic pseudo-random source. Every mock dataset is generated from a
 * fixed seed and a fixed `NOW`, so the server render and the client hydration
 * produce byte-identical output. Nothing here uses Date.now() or Math.random().
 */

/** The reference instant every mock timestamp is derived from. */
export const NOW = new Date("2026-08-05T14:30:00.000Z");

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: number) {
  const r = mulberry32(seed);
  return {
    next: r,
    int: (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(r() * arr.length)],
    weighted: <T,>(entries: readonly [T, number][]): T => {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let roll = r() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return value;
      }
      return entries[entries.length - 1][0];
    },
    bool: (probability = 0.5) => r() < probability,
    /** Minutes before NOW, as an ISO string. */
    ago: (minMinutes: number, maxMinutes: number) =>
      new Date(NOW.getTime() - (Math.floor(r() * (maxMinutes - minMinutes + 1)) + minMinutes) * 60_000).toISOString(),
  };
}

export function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

export function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

export function daysAhead(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

/** Hours ahead of NOW. A schedule's next run is a matter of hours, not days. */
export function hoursAhead(hours: number): string {
  return new Date(NOW.getTime() + hours * 3_600_000).toISOString();
}
