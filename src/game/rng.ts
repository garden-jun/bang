/**
 * 시드 기반 결정적 RNG (mulberry32).
 * 상태 카운터를 GameState에 저장해 같은 seed+counter면 같은 결과가 나오게 한다.
 */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number): number {
  let t = (a += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [0, n) 정수 */
  int(n: number): number;
  shuffle<T>(arr: T[]): T[];
  pick<T>(arr: T[]): T;
}

/** state 객체의 rngState를 진행시키는 RNG를 만든다. */
export function makeRng(seed: string, holder: { rngState: number }): Rng {
  const base = hashSeed(seed);
  const next = () => {
    holder.rngState += 1;
    return mulberry32((base + holder.rngState * 0x9e3779b9) >>> 0);
  };
  const int = (n: number) => Math.floor(next() * n);
  return {
    next,
    int,
    shuffle<T>(arr: T[]) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    pick<T>(arr: T[]) {
      return arr[int(arr.length)];
    },
  };
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
