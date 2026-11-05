import { clamp, WORLD } from './math.js';

export const LURE_BOUNDS = Object.freeze({ minX: 20, maxX: WORLD.W - 20, minY: 90, maxY: WORLD.FLOOR - 10 });
const WINDOW = 0.45; // 흔들림 측정 구간(초)
const WIGGLE_REF = 950; // 이 정도 왕복 속도면 wiggle = 1

/**
 * 낚싯대 끝 장난감. 플레이어는 target(낚싯대 끝 목표점)만 조작하고
 * 실제 장난감은 스프링으로 따라온다 → 손맛 + 회피에 예측이 필요해짐.
 */
export class Lure {
  constructor() { this.reset(); }

  reset(x = 640, y = 620) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.tx = x; this.ty = y;
    this.held = false; this.wiggle = 0; this.twitched = false; this.time = 0;
    this.samples = [];
  }

  setTarget(x, y) {
    this.tx = clamp(x, LURE_BOUNDS.minX, LURE_BOUNDS.maxX);
    this.ty = clamp(y, LURE_BOUNDS.minY, LURE_BOUNDS.maxY);
  }

  twitch(rand) {
    if (this.held) return;
    this.vx += (rand() - 0.5) * 900;
    this.vy -= 500 + rand() * 500;
    this.twitched = true;
  }

  update(dt) {
    this.time += dt;
    if (this.held) {
      this.samples.length = 0;
      this.wiggle = 0;
      return;
    }
    const k = 170, c = 2 * Math.sqrt(k) * 0.62; // 약간 덜 감쇠 → 살짝 출렁임
    this.vx += (k * (this.tx - this.x) - c * this.vx) * dt;
    this.vy += (k * (this.ty - this.y) - c * this.vy) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y > LURE_BOUNDS.maxY) { this.y = LURE_BOUNDS.maxY; if (this.vy > 0) this.vy *= -0.3; }
    if (this.y < LURE_BOUNDS.minY - 60) { this.y = LURE_BOUNDS.minY - 60; this.vy = Math.max(0, this.vy); }
    this.x = clamp(this.x, LURE_BOUNDS.minX - 10, LURE_BOUNDS.maxX + 10);

    // 흔들기 측정: (이동 경로 길이 - 순변위) = 왕복 성분. 일정한 이동보다 '흔드는' 움직임을 높게 평가.
    // 스프링에 걸러진 장난감 위치가 아니라 플레이어 입력(목표점) 기준 → 기기와 무관하게 '세게 흔들수록' 높게.
    const s = this.samples;
    s.push({ x: this.tx, y: this.ty, t: this.time });
    while (s.length > 2 && this.time - s[0].t > WINDOW) s.shift();
    let path = 0;
    for (let i = 1; i < s.length; i++) path += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
    const net = Math.hypot(s[s.length - 1].x - s[0].x, s[s.length - 1].y - s[0].y);
    const raw = ((path - net) + net * 0.3) / WINDOW;
    const inst = clamp(raw / WIGGLE_REF, 0, 1.5);
    this.wiggle += (inst - this.wiggle) * Math.min(1, dt * 8);
  }
}
