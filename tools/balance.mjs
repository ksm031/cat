// 헤드리스 밸런스 검증: 플레이 스타일별 봇으로 각 스테이지를 시뮬레이션
// node tools/balance.mjs [runs]
import { Session } from '../src/core/Session.js';
import { STAGES } from '../src/core/stages.js';
import { WORLD, clamp, rng } from '../src/core/math.js';

const DT = 1 / 120;
const FLOOR = WORLD.FLOOR;

const STYLES = {
  skilled:  (cat) => (cat.tension >= 0.6 ? 'catch' : 'near'),     // 아깝게 2~3번 → 잡혀주기
  sloppy:   (cat, r) => (r() < 0.25 ? 'far' : cat.tension >= 0.6 ? 'catch' : r() < 0.2 ? 'catch' : 'near'), // 실수 섞인 사람
  pushover: () => 'catch',   // 항상 잡혀줌 (너무 쉬움)
  dodger:   () => 'far',     // 항상 크게 피함 (너무 안 잡힘)
  nearOnly: () => 'near',    // 계속 아깝게만
};

function runBot(stage, style, seed) {
  const s = new Session(stage, seed);
  const r = rng(seed ^ 0x9e3779b9);
  let prevState = false, plan = null, planT = 0, t = 0;
  const react = 0.18 + r() * 0.07; // 사람 반응속도 수준
  while (s.active && t < 200) {
    const cat = s.cat, lure = s.lure, c = stage.cat;
    const side = lure.x >= cat.x ? 1 : -1;
    let hx = cat.x + side * c.reachX * 0.55;
    if (hx < 60 || hx > WORLD.W - 60) hx = cat.x - side * c.reachX * 0.55;
    const hy = FLOOR - Math.min(c.reachY * 0.5, 200);
    // 사람처럼: 정지 예고(cue)를 보고 반응 시작
    const cueNow = cat.freezing;
    if (cueNow && !prevState) { plan = STYLES[style](cat, r); planT = 0; }
    prevState = cueNow || cat.state === 'pounce';
    if (plan && cat.state !== 'crouch' && cat.state !== 'pounce') plan = null;

    let target;
    if ((cat.state === 'pounce' || cat.freezing) && plan) {
      planT += DT;
      target = { x: lure.tx, y: lure.ty };
      if (planT >= react && cat.state === 'pounce') {
        // 매 프레임 현재 조준점 기준으로 재배치 (공중 추적 대응)
        const D = plan === 'far' ? 380 : c.catchRadius * (1.75 + c.homing * 0.25);
        if (plan === 'catch') target = { x: lure.x, y: lure.y };
        else {
          // 앞발에서 멀어지는 방향으로, 조준점 기준 D만큼
          let ux = lure.x - cat.paw.x, uy = lure.y - cat.paw.y;
          const L = Math.hypot(ux, uy) || 1; ux /= L; uy /= L;
          if (uy > 0.3) uy = -0.3; // 바닥 쪽으론 못 피함 → 위로 보정
          target = { x: cat.aim.x + ux * D, y: cat.aim.y + uy * D };
        }
      }
    } else if (cat.state === 'crouch') {
      target = { x: lure.tx + Math.sin(t * 40) * 6, y: lure.ty };
    } else if (cat.state === 'hold' || cat.state === 'fall') {
      target = { x: hx, y: hy };
    } else {
      target = { x: hx + Math.sin(t * Math.PI * 6) * 130, y: hy + Math.cos(t * Math.PI * 4.6) * 25 };
    }
    s.step(DT, { target, twitch: false });
    t += DT;
    if (process.env.TRACE) {
      for (const e of s.events) console.log(t.toFixed(2), e.type, e.quality || '', 'plan', plan, 'int', cat.interest.toFixed(0), 'ten', cat.tension.toFixed(2), 'reach', s.cat.canReach(lure), 'lure', lure.x.toFixed(0), lure.y.toFixed(0), 'cat', cat.x.toFixed(0));
    }
    s.events.length = 0;
  }
  return s;
}

if (process.env.TRACE) { const [si, style] = process.env.TRACE.split(':'); runBot(STAGES[+si], style, 1000); process.exit(0); }
const runs = Number(process.argv[2] || 20);
for (const stage of STAGES) {
  console.log(`\n■ Stage ${stage.id} ${stage.catName} (time ${stage.time}s, goal ${stage.goal})`);
  for (const style of Object.keys(STYLES)) {
    let clears = 0, timeLeft = 0, dopa = 0, stars = [0, 0, 0, 0], st = { catches: 0, nearMisses: 0, misses: 0, bored: 0, great: 0, easy: 0 };
    for (let i = 0; i < runs; i++) {
      const s = runBot(stage, style, 1000 + i * 7919);
      if (s.status === 'clear') { clears++; timeLeft += s.timeLeft; stars[s.stars]++; }
      dopa += s.cat.dopamine;
      for (const k in st) st[k] += s.stats[k];
    }
    const f = (k) => (st[k] / runs).toFixed(1);
    console.log(
      `  ${style.padEnd(9)} clear ${String(clears).padStart(2)}/${runs}` +
      `  avgDopa ${(dopa / runs).toFixed(0).padStart(3)}  avgLeft ${clears ? (timeLeft / clears).toFixed(1) : '-'}s` +
      `  ★${stars[1]}/${stars[2]}/${stars[3]}  catch ${f('catches')}(great ${f('great')} easy ${f('easy')}) near ${f('nearMisses')} miss ${f('misses')} bored ${f('bored')}`
    );
  }
}
