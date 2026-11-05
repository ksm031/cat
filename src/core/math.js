// 순수 수학/월드 상수 — 플랫폼 독립 (DOM 의존 없음)
export const WORLD = Object.freeze({ W: 1000, H: 1000, FLOOR: 880 });

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// 결정적 난수 (밸런스 테스트/리플레이 재현용)
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
