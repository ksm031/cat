// 액션 정의 + 기기별 바인딩 테이블.
// 새 플랫폼(콘솔 SDK 등) 포팅 시: 이 테이블과 InputManager의 device 어댑터만 추가/교체하면 된다.
export const Action = Object.freeze({
  CONFIRM: 'confirm',
  BACK: 'back',
  PAUSE: 'pause',
  TWITCH: 'twitch', // 낚싯대 '툭' 튕기기 (흔들기 보조)
  UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right', // UI 내비게이션
});

const A = Action;

export const KEY_ACTIONS = {
  Enter: [A.CONFIRM], NumpadEnter: [A.CONFIRM],
  Space: [A.CONFIRM, A.TWITCH], KeyJ: [A.TWITCH], KeyZ: [A.TWITCH],
  Escape: [A.BACK, A.PAUSE], KeyP: [A.PAUSE], Backspace: [A.BACK],
  ArrowUp: [A.UP], KeyW: [A.UP], ArrowDown: [A.DOWN], KeyS: [A.DOWN],
  ArrowLeft: [A.LEFT], KeyA: [A.LEFT], ArrowRight: [A.RIGHT], KeyD: [A.RIGHT],
};

export const KEY_MOVE = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};

// W3C Gamepad "standard" 매핑 기준 (Xbox/PS/Switch Pro/Steam Deck 공통 레이아웃)
export const PAD_ACTIONS = {
  0: [A.CONFIRM, A.TWITCH], // A / ✕
  1: [A.BACK],              // B / ○
  2: [A.TWITCH],            // X / □
  5: [A.TWITCH],            // RB / R1
  7: [A.TWITCH],            // RT / R2
  8: [A.BACK],              // View / Share
  9: [A.PAUSE],             // Menu / Options
  12: [A.UP], 13: [A.DOWN], 14: [A.LEFT], 15: [A.RIGHT],
};

export const PAD = Object.freeze({ DEADZONE: 0.18, CURVE: 1.6, NAV_THRESHOLD: 0.6, NAV_DELAY: 0.35, NAV_REPEAT: 0.14 });

// 기기별 안내 문구 (UI가 마지막 사용 기기에 맞춰 표시)
export const GLYPHS = {
  touch:    { move: '화면 드래그', twitch: '탭', shake: '좌우로 빠르게 문지르기', pause: 'Ⅱ 버튼', confirm: '탭' },
  mouse:    { move: '마우스 이동', twitch: '클릭', shake: '마우스를 빠르게 흔들기', pause: 'Esc', confirm: '클릭' },
  keyboard: { move: 'WASD / 방향키', twitch: 'Space', shake: '좌우 키 연타 + Space', pause: 'Esc', confirm: 'Enter' },
  gamepad:  { move: 'L 스틱', twitch: 'Ⓐ / RT', shake: '스틱을 빠르게 흔들기', pause: '≡ 메뉴', confirm: 'Ⓐ' },
};
