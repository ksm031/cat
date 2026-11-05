import { Session } from './core/Session.js';
import { STAGES } from './core/stages.js';
import { WORLD } from './core/math.js';
import { InputManager } from './input/InputManager.js';
import { Action } from './input/bindings.js';
import { Renderer } from './render/Renderer.js';
import { UI } from './ui/UI.js';
import { Sfx } from './audio/Sfx.js';
import { storage, haptics } from './platform/platform.js';
import { sprites } from './render/sprites.js';

const SIM_DT = 1 / 120;
const KEY_SPEED = 900;       // 키보드/스틱 낚싯대 속도 (월드 단위/초)
const TOUCH_SENS = 1.35;     // 상대 드래그 감도
const TOUCH_ABS_OFFSET = 70; // 절대 터치 모드: 손가락에 가려지지 않게 위로 띄움(px)

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.input = new InputManager(this.canvas);
    this.sfx = new Sfx();
    this.ui = new UI((act, el) => this.onAct(act, el));

    const save = storage.load() || {};
    this.progress = { unlocked: 0, stars: [], ...save.progress };
    this.settings = { touchMode: 'relative', sound: true, ...save.settings };
    this.applySettings();

    this.mode = 'menu'; // menu | play | pause | result
    this.stageIndex = 0;
    this.session = new Session(STAGES[0], 7); // 메뉴 배경용 데모
    this.session.cat.interest = 40;
    this.acc = 0;
    this.time = 0;
    this.resultT = 0;

    this.input.onDeviceChange = (d) => this.ui.setDevice(d);
    this.input.onPadDisconnect = () => { if (this.mode === 'play') this.pause(); };
    this.ui.setDevice(this.input.device);

    const unlock = () => this.sfx.unlock();
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.mode === 'play') this.pause(); });

    sprites.load(); // 비동기: 로드 전/실패 시엔 벡터 고양이로 표시
    this.ui.show('title');
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  persist() { storage.save({ progress: this.progress, settings: this.settings }); }

  applySettings() {
    this.input.touchMode = this.settings.touchMode;
    this.sfx.enabled = this.settings.sound;
    document.getElementById('lbl-touch').textContent = this.settings.touchMode === 'relative' ? '드래그(상대)' : '손가락 위치(절대)';
    document.getElementById('lbl-sound').textContent = this.settings.sound ? '켜짐' : '꺼짐';
  }

  onAct(act, el) {
    this.sfx.unlock();
    if (act !== 'nav') this.sfx.play('ui'); else { this.sfx.play('tick'); return; }
    switch (act) {
      case 'play':
      case 'stages':
        this.mode = 'menu';
        this.ui.showHud(false);
        this.input.gameplay = false;
        this.ui.renderStages(STAGES, this.progress);
        this.ui.show('stages');
        { const btns = this.ui.focusables(); this.ui.setFocus(btns[Math.min(this.progress.unlocked, btns.length - 2)] || btns[0]); }
        break;
      case 'howto': this.returnTo = this.ui.current; this.ui.show('howto'); break;
      case 'touchmode':
        this.settings.touchMode = this.settings.touchMode === 'relative' ? 'absolute' : 'relative';
        this.applySettings(); this.persist(); break;
      case 'sound':
        this.settings.sound = !this.settings.sound;
        this.applySettings(); this.persist(); break;
      case 'stage': this.start(Number(el.dataset.index)); break;
      case 'pause': if (this.mode === 'play') this.pause(); break;
      case 'resume': this.resume(); break;
      case 'retry': this.start(this.stageIndex); break;
      case 'next': this.start(Math.min(this.stageIndex + 1, STAGES.length - 1)); break;
      case 'back':
        if (this.ui.current === 'howto') this.ui.show(this.returnTo || 'title');
        else if (this.ui.current === 'stages') this.ui.show('title');
        else if (this.ui.current === 'pause') this.resume();
        else if (this.ui.current === 'result') this.onAct('stages');
        break;
    }
  }

  start(i) {
    this.stageIndex = i;
    this.session = new Session(STAGES[i]);
    this.renderer.camX = WORLD.W / 2;
    this.renderer.resize();
    this.mode = 'play';
    this.input.gameplay = true;
    this.acc = 0;
    this.ui.show(null);
    this.ui.showHud(true, this.session);
    this.ui.showBanner(`STAGE ${STAGES[i].id}`, 1.4);
  }

  pause() {
    this.mode = 'pause';
    this.input.gameplay = false;
    this.ui.show('pause');
  }

  resume() {
    this.mode = 'play';
    this.input.gameplay = true;
    this.ui.show(null);
    this.last = performance.now();
  }

  buildCommand(inp, dt) {
    const s = this.session;
    const r = this.renderer;
    const lure = s.lure;
    let tx = lure.tx, ty = lure.ty;
    if (inp.aim) {
      const off = inp.aim.touch ? TOUCH_ABS_OFFSET : 0;
      const w = r.screenToWorld(inp.aim.x, inp.aim.y - off);
      tx = w.x; ty = w.y;
    }
    tx += (inp.drag.x / r.view.s) * TOUCH_SENS + inp.move.x * KEY_SPEED * dt;
    ty += (inp.drag.y / r.view.s) * TOUCH_SENS + inp.move.y * KEY_SPEED * dt;
    const [minX, maxX] = r.visibleX(30);
    tx = Math.min(maxX, Math.max(minX, tx));
    return { target: { x: tx, y: ty }, twitch: inp.pressed.has(Action.TWITCH) };
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    const inp = this.input.poll(dt);

    if (this.mode === 'play') {
      if (inp.pressed.has(Action.PAUSE)) this.pause();
      else {
        let cmd = this.buildCommand(inp, dt);
        if (cmd.twitch || (this.session.lure.wiggle > 0.7 && Math.random() < dt * 6)) this.sfx.play('bell');
        this.acc += dt;
        while (this.acc >= SIM_DT) {
          this.session.step(SIM_DT, cmd);
          cmd = { target: cmd.target, twitch: false };
          this.acc -= SIM_DT;
        }
        this.handleEvents();
        if (!this.session.active) {
          this.resultT += dt;
          if (this.resultT > 1.8) this.finish();
        }
      }
    } else {
      this.ui.handleNav(inp.pressed);
      if (this.mode === 'menu' || this.mode === 'result') this.demo(dt);
    }

    this.renderer.updateCamera(this.session, dt);
    this.renderer.render(this.session, this.time, dt);
    if (this.mode === 'play' || this.mode === 'pause') this.ui.updateHud(this.session, dt);
    requestAnimationFrame((t) => this.frame(t));
  }

  // 메뉴 뒤에서 고양이가 혼자 장난감을 바라보는 데모
  demo(dt) {
    const s = this.session;
    if (s.stage !== STAGES[0] && this.mode === 'menu') { this.session = new Session(STAGES[0], 7); }
    const t = this.time;
    const cmd = { target: { x: 620 + Math.sin(t * 1.3) * 120, y: 600 + Math.sin(t * 2.1) * 80 } };
    this.acc += dt;
    while (this.acc >= SIM_DT) {
      this.session.cat.interest = Math.min(this.session.cat.interest, 45);
      this.session.step(SIM_DT, this.mode === 'menu' ? cmd : null);
      if (this.session.timeLeft < 5) this.session.timeLeft = 60;
      this.acc -= SIM_DT;
    }
    this.session.events.length = 0;
  }

  handleEvents() {
    const s = this.session;
    const ev = s.events;
    if (!ev.length) return;
    this.renderer.onEvents(ev, s);
    const pad = this.input.activePad;
    for (const e of ev) {
      switch (e.type) {
        case 'pounce': this.sfx.play('pounce'); break;
        case 'cue': this.sfx.play('cue'); haptics.pulse(0.2, 40, pad); break;
        case 'catch': this.sfx.play('catch', e); haptics.pulse(e.quality === 'great' ? 0.9 : 0.4, e.quality === 'great' ? 160 : 60, pad); break;
        case 'nearMiss': this.sfx.play('nearMiss'); break;
        case 'miss': this.sfx.play('miss'); break;
        case 'bored': this.sfx.play('bored'); break;
        case 'engage': this.sfx.play('engage'); break;
        case 'start': this.ui.showBanner('시작!', 0.8); break;
        case 'clear': this.sfx.play('clear'); this.ui.showBanner('도파민 MAX!', 1.8); this.resultT = 0; break;
        case 'fail': this.sfx.play('fail'); this.ui.showBanner('시간 초과', 1.8); this.resultT = 0; break;
      }
    }
    ev.length = 0;
  }

  finish() {
    const s = this.session;
    this.mode = 'result';
    this.input.gameplay = false;
    this.resultT = 0;
    if (s.status === 'clear') {
      const i = this.stageIndex;
      this.progress.stars[i] = Math.max(this.progress.stars[i] || 0, s.stars);
      this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(STAGES.length - 1, i + 1));
      this.persist();
    }
    this.ui.showResult(s, this.stageIndex < STAGES.length - 1);
  }
}

window.__app = new App();
