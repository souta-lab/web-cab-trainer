// Seeded PRNG: mulberry32 + xmur3 string hash.
// Algorithm is frozen: same seed -> same sequence (review/tests/bug reports rely on it).
// Do not change the arithmetic below.

export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** A `[value, weight]` pair. Weights must be finite and >= 0. */
export type WeightedEntry<T> = readonly [T, number];

export type RngErrorCode = 'empty-weights' | 'invalid-weight';

/** Typed error for invalid weighted-sampling input (never thrown for valid tables). */
export class RngError extends Error {
  readonly code: RngErrorCode;

  constructor(code: RngErrorCode, message: string) {
    super(message);
    this.name = 'RngError';
    this.code = code;
  }
}

/**
 * Deterministic weighted sampler. Consumes exactly one `rng.next()` draw.
 * Zero-weight entries are never picked. Empty tables / bad weights throw RngError.
 */
export function pickWeighted<T>(rng: Rng, entries: readonly WeightedEntry<T>[]): T {
  if (entries.length === 0) {
    throw new RngError('empty-weights', 'pickWeighted: entries must not be empty');
  }
  let total = 0;
  for (const [, weight] of entries) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new RngError('invalid-weight', `pickWeighted: invalid weight ${weight}`);
    }
    total += weight;
  }
  if (total <= 0) {
    throw new RngError('invalid-weight', 'pickWeighted: weights sum to zero');
  }
  let remaining = rng.next() * total;
  for (const [value, weight] of entries) {
    remaining -= weight;
    if (remaining < 0) return value;
  }
  // Only reachable on floating-point drift; total weight is positive.
  return entries[entries.length - 1][0];
}

export class Rng {
  private s: number;

  constructor(seed: number | string) {
    this.s = (typeof seed === 'string' ? hashSeed(seed) : seed) >>> 0;
    if (this.s === 0) this.s = 0x9e3779b9;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Uniform element. Caller must guarantee a non-empty array. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Fisher-Yates on a copy; input is never mutated. */
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Method form of `pickWeighted` (same semantics, uses this instance). */
  pickWeighted<T>(entries: readonly WeightedEntry<T>[]): T {
    return pickWeighted(this, entries);
  }
}

/** Non-deterministic seed source for new sessions. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
