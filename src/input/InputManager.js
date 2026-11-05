import { Action, KEY_ACTIONS, KEY_MOVE, PAD_ACTIONS, PAD } from './bindings.js';

/**
 * 모든 입력 기기를 '프레임 단위 InputFrame'으로 정규화.
 *   move   : 아날로그 이동 벡터(-1..1) — 키보드/게임패드
 *   aim    : 절대 조준 화면좌표 | null — 마우스(호버), 터치(절대 모드)
 *   drag   : 상대 이동 화면 px — 터치(상대 모드)
 *   pressed: 이번 프레임에 눌린 Action 집합 (edge)
 *   device : 마지막으로 사용된 기기 ('touch'|'mouse'|'keyboard'|'gamepad')
 * 게임 코드는 기기를 모르고 이 프레임만 본다.
 */
export class InputManager {
  constructor(surface) {
    this.surface = surface;
    this.keys = new Set();
    this.queue = new Set();
    this.device = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';
    this.onDeviceChange = null;
    this.touchMode = 'relative';
    this.gameplay = false; // true면 게임 화면에서 방향키/스페이스 기본동작 차단

    this.mouse = { x: 0, y: 0, seen: false };
    this.touch = { id: null, x: 0, y: 0, sx: 0, sy: 0, st: 0, moved: 0, dx: 0, dy: 0 };

    this.padPrev = [];
    this.nav = { dir: null, t: 0, repeating: false };
    this.padIndex = -1;
    this.onPadDisconnect = null;

    this._bind();
  }

  setDevice(d) {
    if (this.device !== d) {
      this.device = d;
      this.onDeviceChange?.(d);
    }
  }

  _bind() {
    addEventListener('keydown', (e) => {
      if (this.gameplay && (KEY_MOVE[e.code] || e.code === 'Space')) e.preventDefault();
      if (e.code === 'Space' && document.activeElement?.tagName === 'BUTTON') e.preventDefault();
      this.setDevice('keyboard');
      if (e.repeat) return;
      this.keys.add(e.code);
      for (const a of KEY_ACTIONS[e.code] || []) this.queue.add(a);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    const el = this.surface;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        this.setDevice('mouse');
        this.mouse = { x: e.clientX, y: e.clientY, seen: true };
        if (e.button === 0) this.queue.add(Action.TWITCH);
        return;
      }
      this.setDevice('touch');
      if (this.touch.id !== null) { this.queue.add(Action.TWITCH); return; } // 두 번째 손가락 = 툭
      el.setPointerCapture?.(e.pointerId);
      Object.assign(this.touch, { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, st: performance.now(), moved: 0 });
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0 || !this.mouse.seen) this.setDevice('mouse');
        this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.seen = true;
        return;
      }
      if (e.pointerId !== this.touch.id) return;
      const dx = e.clientX - this.touch.x, dy = e.clientY - this.touch.y;
      this.touch.dx += dx; this.touch.dy += dy;
      this.touch.moved += Math.abs(dx) + Math.abs(dy);
      this.touch.x = e.clientX; this.touch.y = e.clientY;
    });
    const end = (e) => {
      if (e.pointerId !== this.touch.id) return;
      if (performance.now() - this.touch.st < 220 && this.touch.moved < 14) this.queue.add(Action.TWITCH);
      this.touch.id = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());

    addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === this.padIndex) { this.padIndex = -1; this.onPadDisconnect?.(); }
    });
  }

  _pollPad(dt, frame) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) return;
    this.padIndex = pad.index;
    let used = false;

    const btn = pad.buttons.map((b) => b.pressed || b.value > 0.5);
    btn.forEach((down, i) => {
      if (down && !this.padPrev[i]) {
        used = true;
        for (const a of PAD_ACTIONS[i] || []) frame.pressed.add(a);
      }
    });
    this.padPrev = btn;

    const curve = (x, y) => {
      const m = Math.hypot(x, y);
      if (m < PAD.DEADZONE) return [0, 0];
      const n = Math.min(1, (m - PAD.DEADZONE) / (1 - PAD.DEADZONE));
      const k = Math.pow(n, PAD.CURVE) / m;
      return [x * k, y * k];
    };
    const [lx, ly] = curve(pad.axes[0] || 0, pad.axes[1] || 0);
    const [rx, ry] = curve(pad.axes[2] || 0, pad.axes[3] || 0);
    const mx = lx + rx, my = ly + ry;
    if (mx || my) used = true;
    frame.move.x += mx; frame.move.y += my;

    // 스틱 → UI 내비게이션 (반복 입력)
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    let dir = null;
    if (Math.abs(ax) > PAD.NAV_THRESHOLD || Math.abs(ay) > PAD.NAV_THRESHOLD) {
      dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? Action.RIGHT : Action.LEFT) : (ay > 0 ? Action.DOWN : Action.UP);
    }
    if (dir !== this.nav.dir) {
      this.nav = { dir, t: PAD.NAV_DELAY };
      if (dir) frame.pressed.add(dir);
    } else if (dir) {
      this.nav.t -= dt;
      if (this.nav.t <= 0) { this.nav.t = PAD.NAV_REPEAT; frame.pressed.add(dir); }
    }
    if (used) { this.setDevice('gamepad'); this.activePad = pad; }
  }

  poll(dt) {
    const frame = { move: { x: 0, y: 0 }, aim: null, drag: { x: 0, y: 0 }, pressed: new Set(this.queue), device: this.device };
    this.queue.clear();

    for (const code of this.keys) {
      const v = KEY_MOVE[code];
      if (v) { frame.move.x += v[0]; frame.move.y += v[1]; }
    }
    const km = Math.hypot(frame.move.x, frame.move.y);
    if (km > 1) { frame.move.x /= km; frame.move.y /= km; }

    this._pollPad(dt, frame);
    const m = Math.hypot(frame.move.x, frame.move.y);
    if (m > 1) { frame.move.x /= m; frame.move.y /= m; }

    if (this.device === 'mouse' && this.mouse.seen) frame.aim = { x: this.mouse.x, y: this.mouse.y };
    if (this.device === 'touch' && this.touch.id !== null) {
      if (this.touchMode === 'absolute') frame.aim = { x: this.touch.x, y: this.touch.y, touch: true };
      else { frame.drag.x = this.touch.dx; frame.drag.y = this.touch.dy; }
    }
    this.touch.dx = 0; this.touch.dy = 0;
    frame.device = this.device;
    return frame;
  }
}
