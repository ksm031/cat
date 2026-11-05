import { clamp, lerp, WORLD } from './math.js';

const FLOOR = WORLD.FLOOR;
// 점프 시 앞발 위치 / 잡았을 때 장난감 위치 (고양이 로컬 좌표, 오른쪽을 바라볼 때, size 1 기준)
// 아트(render/sprites.js)의 기준점과 맞춰둔 값 — 아트 교체 시 함께 조정
const PAW_LOCAL = { x: 76, y: -118 };
const HOLD_LOCAL = { x: 77, y: -119 };
const FALL_TIME = 0.28;
const HOLD_LAND = 0.22;

/**
 * 고양이 = 상태머신 + 마음(흥미/흥분도/도파민).
 *  idle → stalk → crouch(예고) → pounce → (catch→hold | miss→fall) → land → stalk ...
 *  흥미가 0이 되면 bored(삐짐): 일정 시간 흔들어도 반응 없음.
 */
export class Cat {
  constructor(stage, rand) {
    this.cfg = stage.cat;
    this.sc = stage.score;
    this.size = stage.look.size;
    this.rand = rand;

    this.x = 280; this.facing = 1;
    this.state = 'idle'; this.t = 0;

    this.interest = 20;   // 흥미 0..100 — 0이 되면 삐짐
    this.tension = 0;     // 흥분도 0..1 — 아깝게 놓칠수록 상승, 잡으면 소모
    this.dopamine = 0;    // 목표치까지 채우면 클리어
    this.missStreak = 0;  // 연속으로 놓친 횟수 — 높을수록 흔들기 반응 저하
    this.frustT = 0;
    this.easyStreak = 0;  // 연속 '시시한' 포획 — 높을수록 질려서 도파민/흥미 감소

    this.engagedOnce = false;
    this.readyTimer = -1;
    this.combo = false;
    this.twitchCd = 0;
    this.moving = false;
    this.walkPhase = 0;

    this.aim = { x: 0, y: 0 };
    this.p0 = { x: 0, y: 0 };
    this.paw = { x: 0, y: 0 };
    this.pawV = { x: 0, y: 0 };
    this.minDist = Infinity;
    this.fallFrom = { x: 0, y: 0 };
    this.landX = this.x;

    // 렌더용 변환(코어가 계산, 렌더러는 그리기만)
    this.pivot = { x: this.x, y: FLOOR };
    this.pivotLocal = { x: 0, y: 0 };
    this.angle = 0;
  }

  get pawLocal() { return { x: PAW_LOCAL.x * this.size, y: PAW_LOCAL.y * this.size }; }
  get holdPoint() { return { x: this.x + this.facing * HOLD_LOCAL.x * this.size, y: FLOOR + HOLD_LOCAL.y * this.size }; }
  get headPos() { return { x: this.x + this.facing * 60 * this.size, y: FLOOR - 105 * this.size }; }

  set(s) { this.state = s; this.t = 0; this.cued = false; }
  get freezing() { return this.state === 'crouch' && this.cued; }

  canReach(lure) {
    return Math.abs(lure.x - this.x) <= this.cfg.reachX && FLOOR - lure.y <= this.cfg.reachY;
  }

  update(dt, lure, ev) {
    const c = this.cfg, s = this.sc;
    this.t += dt;
    this.twitchCd -= dt;
    const dx = lure.x - this.x, adx = Math.abs(dx);
    const h = FLOOR - lure.y;
    const reachable = adx <= c.reachX && h <= c.reachY;
    const st = this.state;

    // ── 흥미 변화: 흔들면 오르고, 가만히 두면 떨어짐. 연속 실패가 쌓이면 흔들어도 덜 반응
    const receptive = st === 'idle' || st === 'stalk' || st === 'crouch' || st === 'land';
    if (receptive) {
      const frust = Math.max(0.2, 1 - 0.16 * this.missStreak);
      const prox = adx < 650 ? 1 : 0.5;
      this.interest += c.shakeGain * Math.min(1.3, lure.wiggle) * frust * prox * dt;
      if (lure.twitched && this.twitchCd <= 0) {
        this.interest += c.twitchGain * frust;
        this.twitchCd = 0.12;
      }
      this.interest -= c.interestDecay * dt * (h > c.reachY ? 1.6 : 1);
    }
    this.interest = clamp(this.interest, 0, 100);
    if (st !== 'pounce' && st !== 'fall' && st !== 'hold') {
      this.tension = Math.max(0, this.tension - s.tensionDecay * dt);
      // 연속 실패로 시큰둥해진 상태는 시간이 지나면 조금씩 풀림 (교착 방지)
      if (this.missStreak > 0) {
        this.frustT += dt;
        if (this.frustT >= c.frustRecover) { this.frustT = 0; this.missStreak--; }
      }
    }
    if ((st === 'idle' || st === 'stalk' || st === 'land') && this.engagedOnce && this.interest <= 0) {
      this.set('bored');
      this.tension = 0;
      this.missStreak = 0;
      this.readyTimer = -1;
      ev.push({ type: 'bored', x: this.x, y: FLOOR - 130 * this.size });
    }

    switch (this.state) {
      case 'idle': {
        this.moving = false;
        if (this.interest > 8 && adx > 20) this.facing = Math.sign(dx);
        if (this.interest >= c.engageAt) {
          this.set('stalk');
          this.engagedOnce = true;
          ev.push({ type: 'engage', x: this.x, y: FLOOR - 150 * this.size });
        }
        break;
      }
      case 'stalk': {
        if (this.interest < c.engageAt * 0.5) { this.set('idle'); break; }
        if (adx > 15) this.facing = Math.sign(dx);
        let v = 0;
        if (adx > c.reachX * 0.8) v = Math.sign(dx) * c.walkSpeed * (this.interest >= c.pounceAt ? 1.3 : 1);
        else if (adx < 70) v = -Math.sign(dx || 1) * c.walkSpeed * 0.5;
        const nx = clamp(this.x + v * dt, 70, WORLD.W - 70);
        this.moving = nx !== this.x;
        if (this.moving) this.walkPhase += (dt * Math.abs(v)) / 14;
        this.x = nx;
        if (this.interest >= c.pounceAt && reachable && adx > 50) {
          if (this.readyTimer < 0) this.readyTimer = lerp(c.pounceDelay[0], c.pounceDelay[1], this.rand());
          this.readyTimer -= dt * (1 + lure.wiggle * 0.8);
          if (this.readyTimer <= 0) {
            this.readyTimer = -1;
            this.set('crouch');
            ev.push({ type: 'crouch', x: this.x, y: FLOOR });
          }
        } else this.readyTimer = -1;
        break;
      }
      case 'crouch': {
        this.moving = false;
        if (adx > 15) this.facing = Math.sign(dx);
        // 웅크림(엉덩이 씰룩) → 마지막 cueTime 동안 정지(점프 직전 예고) → 발사
        const ct = this.combo ? Math.max(c.crouchTime * 0.45, c.cueTime + 0.05) : c.crouchTime;
        if (!this.cued && this.t >= ct - c.cueTime) {
          this.cued = true;
          ev.push({ type: 'cue', x: this.x, y: FLOOR - 150 * this.size });
        }
        if (this.t >= ct) this.launch(lure, ev);
        break;
      }
      case 'pounce': {
        const u = Math.min(1, this.t / c.pounceTime);
        if (c.homing > 0) {
          const k = Math.min(1, c.homing * dt);
          this.aim.x += (clamp(lure.x, this.x - c.reachX * 1.1, this.x + c.reachX * 1.1) - this.aim.x) * k;
          this.aim.y += (clamp(lure.y, FLOOR - c.reachY * 1.1, FLOOR - 12) - this.aim.y) * k;
        }
        const e = u * (1.25 - 0.25 * u); // 거의 선형: 위협이 끝에 도달 → 반응할 여지
        const arc = Math.sin(Math.PI * u) * (30 + 0.12 * Math.abs(this.aim.x - this.p0.x));
        const px = lerp(this.p0.x, this.aim.x, e);
        const py = lerp(this.p0.y, this.aim.y, e) - arc;
        this.pawV.x = (px - this.paw.x) / dt;
        this.pawV.y = (py - this.paw.y) / dt;
        this.paw.x = px; this.paw.y = py;
        if (u > 0.25) {
          const d = Math.hypot(lure.x - px, lure.y - py);
          if (d < this.minDist) this.minDist = d;
          if (d < c.catchRadius) { this.onCatch(lure, ev); break; }
        }
        if (u >= 1) this.onMiss(ev);
        break;
      }
      case 'fall': {
        if (this.t >= FALL_TIME) {
          this.x = this.landX;
          this.set('land');
          ev.push({ type: 'land', x: this.x, y: FLOOR });
        }
        break;
      }
      case 'land': {
        this.moving = false;
        if (this.combo && this.t > 0.12 && this.interest > 0) {
          this.set('crouch');
          ev.push({ type: 'combo', x: this.x, y: FLOOR - 150 * this.size });
          break;
        }
        if (this.t >= c.recover) {
          this.combo = false;
          this.set(this.interest >= c.engageAt * 0.5 ? 'stalk' : 'idle');
        }
        break;
      }
      case 'hold': {
        const hp = this.holdPoint;
        if (this.t < HOLD_LAND) {
          const u = this.t / HOLD_LAND;
          lure.x = lerp(this.fallFrom.x, hp.x, u);
          lure.y = lerp(this.fallFrom.y, hp.y, u);
        } else {
          lure.x = hp.x + Math.sin(this.t * 30) * 4;
          lure.y = hp.y + Math.cos(this.t * 23) * 3;
        }
        lure.vx = 0; lure.vy = 0;
        if (this.t >= c.holdTime) {
          lure.held = false;
          lure.vx = -this.facing * 250;
          lure.vy = -650;
          this.set('land');
          this.t = Math.max(0, c.recover - 0.6);
          ev.push({ type: 'release', x: lure.x, y: lure.y });
        }
        break;
      }
      case 'bored': {
        this.moving = false;
        this.dopamine = Math.max(0, this.dopamine - s.boredDopaDecay * dt);
        if (this.t >= c.boredTime) {
          this.interest = 12;
          this.set('idle');
          ev.push({ type: 'unbored', x: this.x, y: FLOOR - 130 * this.size });
        }
        break;
      }
      default: // 'happy' | 'sulk' — 스테이지 종료 연출
        this.moving = false;
        if (lure.held) { lure.held = false; lure.vy = -500; }
        break;
    }

    this.updatePivot();
  }

  launch(lure, ev) {
    const c = this.cfg;
    this.combo = false;
    let ax = lure.x + lure.vx * c.lead;
    let ay = lure.y + lure.vy * c.lead;
    ax = clamp(ax, this.x - c.reachX * 1.05, this.x + c.reachX * 1.05);
    ay = clamp(ay, FLOOR - c.reachY * 1.05, FLOOR - 12);
    this.facing = ax >= this.x ? 1 : -1;
    const pl = this.pawLocal;
    this.p0 = { x: this.x + this.facing * pl.x * 0.6, y: FLOOR + pl.y * 1.2 }; // 점프 시작 앞발 높이 (아트 뒷발이 바닥을 뚫지 않게)
    this.aim = { x: ax, y: ay };
    this.paw = { ...this.p0 };
    this.pawV = { x: 0, y: 0 };
    this.minDist = Infinity;
    this.set('pounce');
    ev.push({ type: 'pounce', x: this.p0.x, y: this.p0.y });
  }

  beginFall() {
    this.fallFrom = { x: this.paw.x, y: this.paw.y };
    this.landX = clamp(this.paw.x - this.facing * this.pawLocal.x, 70, WORLD.W - 70);
  }

  onCatch(lure, ev) {
    const s = this.sc;
    const tq = this.tension;
    const quality = tq < 0.3 ? 'easy' : tq < 0.8 ? 'good' : 'great';
    this.easyStreak = quality === 'easy' ? this.easyStreak + 1 : 0;
    // 너무 쉽게 잡히면: 흥분도 배율 낮음 + 연속일수록 더 질림
    const bore = Math.max(0.35, 1 - s.easyPenalty * Math.max(0, this.easyStreak - 1));
    const mult = (s.minMult + (1 - s.minMult) * tq) * bore;
    const gain = s.catchBase * mult;
    this.dopamine += gain;
    this.interest = clamp(
      this.interest + s.catchInterest * (0.35 + 0.65 * tq) - s.easyInterestLoss * Math.max(0, this.easyStreak - 1),
      0, 100);
    this.tension = 0;
    this.missStreak = 0;
    lure.held = true;
    this.beginFall();
    this.x = this.landX;
    this.set('hold');
    ev.push({ type: 'catch', x: this.paw.x, y: this.paw.y, gain, quality, mult, easyStreak: this.easyStreak });
  }

  onMiss(ev) {
    const c = this.cfg, s = this.sc;
    const near = this.minDist < c.catchRadius * 2.6;
    this.missStreak++;
    this.frustT = 0;
    if (near) {
      this.tension = Math.min(1, this.tension + s.tensionNear);
      const gain = s.nearMissDopa * (1 + this.tension);
      this.dopamine += gain;
      this.interest = clamp(this.interest + s.nearBonus - c.missDrain * this.missStreak * 0.8, 0, 100);
      ev.push({ type: 'nearMiss', x: this.paw.x, y: this.paw.y, gain, streak: this.missStreak });
      if (this.rand() < c.comboChance && this.interest > 0) this.combo = true;
    } else {
      this.tension = Math.min(1, this.tension + s.tensionFar);
      this.interest = clamp(this.interest - c.missDrain * this.missStreak - 6, 0, 100);
      ev.push({ type: 'miss', x: this.paw.x, y: this.paw.y, streak: this.missStreak });
    }
    this.beginFall();
    this.set('fall');
  }

  updatePivot() {
    const st = this.state;
    if (st === 'pounce') {
      this.pivot.x = this.paw.x; this.pivot.y = this.paw.y;
      const pl = this.pawLocal;
      this.pivotLocal.x = pl.x; this.pivotLocal.y = pl.y;
      const a = Math.atan2(this.pawV.y, this.facing * this.pawV.x || 1);
      this.angle = clamp(a, -0.9, 0.9);
    } else if (st === 'fall' || (st === 'hold' && this.t < HOLD_LAND)) {
      const u = Math.min(1, this.t / (st === 'fall' ? FALL_TIME : HOLD_LAND));
      const pl = this.pawLocal;
      // 피벗을 앞발 → 발밑으로 보간 (landX = 앞발x - 앞발 오프셋 → 몸이 수평으로 튀지 않음)
      this.pivot.x = lerp(this.fallFrom.x, this.landX, u);
      this.pivot.y = lerp(this.fallFrom.y, FLOOR, u);
      this.pivotLocal.x = lerp(pl.x, 0, u);
      this.pivotLocal.y = lerp(pl.y, 0, u);
      this.angle = lerp(this.angle, 0, Math.min(1, u * 1.5));
    } else {
      this.pivot.x = this.x; this.pivot.y = FLOOR;
      this.pivotLocal.x = 0; this.pivotLocal.y = 0;
      this.angle = 0;
    }
  }
}
