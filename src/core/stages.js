// 스테이지 데이터 — 밸런스는 tools/balance.mjs 봇 시뮬레이션으로 검증
// cat.*   : 고양이 행동 / score.* : 도파민 계산
const base = {
  cat: {
    walkSpeed: 160, reachX: 330, reachY: 330,
    engageAt: 25, pounceAt: 55, pounceDelay: [0.5, 1.3],
    crouchTime: 0.85, cueTime: 0.24, pounceTime: 0.5, lead: 0, homing: 0,
    catchRadius: 46, interestDecay: 5, shakeGain: 42, twitchGain: 5,
    missDrain: 6, frustRecover: 3.5, boredTime: 3, comboChance: 0, recover: 0.7, holdTime: 1.1,
  },
  score: {
    catchBase: 24, minMult: 0.2, easyPenalty: 0.2, easyInterestLoss: 14, nearMissDopa: 1.5,
    tensionNear: 0.4, tensionFar: 0.15, tensionDecay: 0.03,
    catchInterest: 30, nearBonus: 6, boredDopaDecay: 0,
  },
};

const mk = (o) => ({
  ...o,
  cat: { ...base.cat, ...o.cat },
  score: { ...base.score, ...o.score },
});

export const STAGES = [
  mk({
    id: 1, title: '거실의 오후', catName: '보리', breed: '치즈 아기냥',
    desc: '호기심 많은 아기 고양이. 느리고 서툴러서 피하기 쉬워요.',
    time: 65, goal: 100, star3: 0.3, star2: 0.12, hints: true,
    look: { size: 0.82, body: '#f2a65a', belly: '#fff1dc', stripe: '#d9803a', eye: '#8cc63f', pattern: 'tabby' },
    theme: { wall: '#f7e6cf', wall2: '#efd6b6', floor: '#c99b6a', floor2: '#b88a5a', deco: 'window', sky: '#bfe3ff' },
    cat: { walkSpeed: 150, crouchTime: 0.95, pounceTime: 0.52, catchRadius: 44 },
    score: { catchBase: 27 },
  }),
  mk({
    id: 2, title: '햇살 드는 침실', catName: '모찌', breed: '게으른 뚱냥이',
    desc: '금방 질려요. 쉬지 말고 흔들어서 흥미를 붙잡아 두세요.',
    time: 58, goal: 100, star3: 0.28, star2: 0.1, hints: true,
    look: { size: 1.08, body: '#f4f1ec', belly: '#ffffff', stripe: '#d8cfc4', eye: '#5aa9e6', pattern: 'white' },
    theme: { wall: '#e3ecf7', wall2: '#cfdcee', floor: '#d6b48c', floor2: '#c4a078', deco: 'bed', sky: '#ffe6b8' },
    cat: { walkSpeed: 95, reachX: 290, reachY: 270, interestDecay: 8.5, shakeGain: 36, crouchTime: 1.0, pounceTime: 0.55, boredTime: 3.5, catchRadius: 50 },
    score: { catchBase: 27 },
  }),
  mk({
    id: 3, title: '베란다 사냥터', catName: '고등어', breed: '고등어태비 사냥꾼',
    desc: '빠르고 움직임을 예측해요. 덮치는 순간 반 박자 일찍 빼세요.',
    time: 54, goal: 100, star3: 0.2, star2: 0.08,
    look: { size: 0.95, body: '#8d8a80', belly: '#e9e4d8', stripe: '#4c4a44', eye: '#c9d84a', pattern: 'tabby' },
    theme: { wall: '#dfe8d8', wall2: '#cbd9c1', floor: '#a7a39a', floor2: '#96928a', deco: 'balcony', sky: '#9fd6ff' },
    cat: { walkSpeed: 220, reachX: 380, reachY: 390, crouchTime: 0.62, pounceTime: 0.4, lead: 0.08, catchRadius: 50, pounceDelay: [0.35, 0.9] },
    score: { catchBase: 20, nearMissDopa: 1.2 },
  }),
  mk({
    id: 4, title: '까칠한 서재', catName: '까미', breed: '턱시도 까칠냥',
    desc: '시시한 사냥은 질색. 쉽게 잡혀주면 도파민이 거의 안 올라요.',
    time: 57, goal: 100, star3: 0.16, star2: 0.06,
    look: { size: 0.95, body: '#2b2b33', belly: '#f4f4f4', stripe: '#1c1c22', eye: '#f2c94c', pattern: 'tuxedo' },
    theme: { wall: '#e9dccb', wall2: '#d8c5ad', floor: '#8a5d3b', floor2: '#7a5033', deco: 'bookshelf', sky: '#ffd29a' },
    cat: { walkSpeed: 190, reachX: 360, reachY: 360, crouchTime: 0.7, pounceTime: 0.44, lead: 0.05, homing: 1.4, missDrain: 8.5, catchRadius: 48 },
    score: { catchBase: 23, nearMissDopa: 1.2, minMult: 0.12, tensionNear: 0.36, boredDopaDecay: 1.5 },
  }),
  mk({
    id: 5, title: '캣타워 정상', catName: '대장', breed: '노르웨이숲 보스',
    desc: '연속 덮치기와 공중 추적. 진짜 사냥꾼의 도파민을 채워라!',
    time: 52, goal: 100, star3: 0.19, star2: 0.06,
    look: { size: 1.18, body: '#9aa0a8', belly: '#eef0f2', stripe: '#6c727a', eye: '#e8a33c', pattern: 'fluffy' },
    theme: { wall: '#e8def0', wall2: '#d6c8e3', floor: '#b08e6e', floor2: '#9f7d5e', deco: 'tower', sky: '#c9b8ff' },
    cat: { walkSpeed: 230, reachX: 420, reachY: 440, crouchTime: 0.55, pounceTime: 0.38, lead: 0.1, homing: 2.2, comboChance: 0.45, cueTime: 0.2, missDrain: 7, catchRadius: 56, pounceDelay: [0.3, 0.8] },
    score: { catchBase: 15, nearMissDopa: 0.9, minMult: 0.18, boredDopaDecay: 1.0 },
  }),
];
