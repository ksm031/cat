import { Action, GLYPHS } from '../input/bindings.js';

const $ = (s, r = document) => r.querySelector(s);

/**
 * DOM 기반 UI. 포인터는 click, 키보드/게임패드는 Action(UP/DOWN/LEFT/RIGHT/CONFIRM/BACK)으로
 * 동일한 버튼을 조작 → 콘솔에서도 같은 화면 사용 가능.
 */
export class UI {
  constructor(onAct) {
    this.onAct = onAct;
    this.current = null;
    this.focused = null;
    this.device = 'mouse';
    this.hud = {
      root: $('#hud'), stage: $('#hud-stage'), cat: $('#hud-cat'), time: $('#hud-time'),
      dopa: $('#bar-dopa'), dopaTxt: $('#txt-dopa'), interest: $('#bar-interest'), tension: $('#bar-tension'),
      mark: $('#mark-pounce'), mood: $('#hud-mood'),
    };
    this.hint = $('#hint');
    this.banner = $('#banner');
    this.bannerT = 0;
    this.lastTimeInt = -1;

    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      this.onAct(b.dataset.act, b);
    });
    $('#btn-pause').addEventListener('click', () => this.onAct('pause'));
  }

  show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.dataset.screen === name));
    this.current = name;
    this.setFocus(name ? this.focusables()[0] : null);
  }

  focusables() {
    if (!this.current) return [];
    const scr = document.querySelector(`.screen[data-screen="${this.current}"]`);
    return [...scr.querySelectorAll('button:not([disabled])')].filter((b) => b.offsetParent !== null);
  }

  setFocus(el) {
    this.focused?.classList.remove('focused');
    this.focused = el || null;
    if (!el) return;
    if (this.device === 'keyboard' || this.device === 'gamepad') el.classList.add('focused');
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest' });
  }

  setDevice(d) {
    this.device = d;
    if (this.focused) this.focused.classList.toggle('focused', d === 'keyboard' || d === 'gamepad');
    const g = GLYPHS[d];
    $('#device-hint').textContent = `현재 입력: ${{ touch: '터치', mouse: '마우스', keyboard: '키보드', gamepad: '게임패드' }[d]} · 이동 ${g.move} · 툭 ${g.twitch}`;
    document.querySelectorAll('[data-touch-only]').forEach((el) => el.classList.toggle('hidden', d !== 'touch'));
  }

  /** 메뉴 화면에서의 Action 처리. 처리했으면 true */
  handleNav(pressed) {
    if (!this.current) return false;
    const dirs = { [Action.UP]: [0, -1], [Action.DOWN]: [0, 1], [Action.LEFT]: [-1, 0], [Action.RIGHT]: [1, 0] };
    for (const [a, v] of Object.entries(dirs)) {
      if (pressed.has(a)) { this.move(v[0], v[1]); return true; }
    }
    if (pressed.has(Action.CONFIRM) && this.focused) { this.focused.click(); return true; }
    if (pressed.has(Action.BACK)) { this.onAct('back'); return true; }
    return false;
  }

  move(dx, dy) {
    const list = this.focusables();
    if (!list.length) return;
    if (!this.focused || !list.includes(this.focused)) { this.setFocus(list[0]); return; }
    const r0 = this.focused.getBoundingClientRect();
    const c0 = { x: r0.left + r0.width / 2, y: r0.top + r0.height / 2 };
    let best = null, bestScore = Infinity;
    for (const el of list) {
      if (el === this.focused) continue;
      const r = el.getBoundingClientRect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const along = (c.x - c0.x) * dx + (c.y - c0.y) * dy;
      if (along <= 4) continue;
      const across = Math.abs((c.x - c0.x) * dy) + Math.abs((c.y - c0.y) * dx);
      const score = along + across * 2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (!best && dy) best = dy > 0 ? list[0] : list[list.length - 1]; // 세로 순환
    if (best) { this.setFocus(best); this.onAct('nav'); }
  }

  renderStages(stages, progress) {
    const box = $('#stage-list');
    box.innerHTML = '';
    stages.forEach((s, i) => {
      const locked = i > progress.unlocked;
      const stars = progress.stars[i] || 0;
      const b = document.createElement('button');
      b.className = 'stage' + (locked ? ' locked' : '');
      b.dataset.act = 'stage';
      b.dataset.index = i;
      if (locked) b.disabled = true;
      b.innerHTML = `
        <span class="no" style="background:${s.look.body === '#f4f1ec' ? '#c9b8a6' : s.look.body}">${s.id}</span>
        <span class="info"><b>${s.title} · ${s.catName}</b><small>${locked ? '🔒 이전 스테이지를 클리어하세요' : `${s.breed} — ${s.desc}`}</small></span>
        <span class="st">${'★'.repeat(stars)}<span style="color:#e3d4c4">${'★'.repeat(3 - stars)}</span></span>`;
      box.appendChild(b);
    });
  }

  showHud(on, session) {
    this.hud.root.classList.toggle('hidden', !on);
    if (!on) { this.hint.classList.add('hidden'); this.banner.classList.add('hidden'); return; }
    const st = session.stage;
    this.hud.stage.textContent = `STAGE ${st.id} · ${st.title}`;
    this.hud.cat.textContent = `${st.catName} (${st.breed})`;
    this.hud.mark.style.left = `${st.cat.pounceAt}%`;
  }

  showBanner(text, dur = 1.2) {
    this.banner.textContent = text;
    this.banner.classList.remove('hidden');
    this.banner.style.animation = 'none';
    void this.banner.offsetWidth;
    this.banner.style.animation = '';
    this.bannerT = dur;
  }

  updateHud(session, dt) {
    const { cat, stage } = session;
    const h = this.hud;
    const tl = Math.ceil(session.timeLeft);
    if (tl !== this.lastTimeInt) {
      h.time.textContent = tl;
      h.time.classList.toggle('warn', session.status === 'play' && tl <= 10);
      this.lastTimeInt = tl;
    }
    const dp = Math.min(100, (cat.dopamine / session.goal) * 100);
    h.dopa.style.width = dp + '%';
    h.dopaTxt.textContent = Math.floor(dp) + '%';
    h.interest.style.width = cat.interest + '%';
    h.tension.style.width = cat.tension * 100 + '%';
    h.tension.classList.toggle('max', cat.tension >= 0.8);

    let mood = '';
    if (cat.state === 'bored') mood = '😾 삐짐';
    else if (cat.easyStreak >= 2) mood = '😒 시시해함';
    else if (cat.missStreak >= 3) mood = '😿 시큰둥';
    else if (cat.tension >= 0.8) mood = '😼 흥분 MAX';
    else if (cat.state === 'crouch') mood = '🐾 노리는 중';
    h.mood.textContent = mood;

    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.banner.classList.add('hidden');
    }

    // 상황별 힌트 (초반 스테이지 위주)
    const g = GLYPHS[this.device];
    let hint = '';
    if (session.status === 'ready') hint = `이동: ${g.move} · 흔들기: ${g.shake}`;
    else if (session.status === 'play') {
      const lure = session.lure;
      const tooHigh = 880 - lure.y > stage.cat.reachY && cat.state !== 'hold';
      if (cat.state === 'bored') hint = '고양이가 삐졌어요… 잠시 후 다시 흔들어 주세요';
      else if (stage.hints || cat.missStreak >= 3 || cat.easyStreak >= 2 || tooHigh) {
        if (cat.state === 'crouch') hint = cat.cued ? '지금! 살짝 빼거나, 잡혀주거나!' : '웅크렸다! 멈칫(!!)하면 덮쳐요';
        else if (cat.easyStreak >= 2) hint = '너무 쉽게 잡혀서 시시해해요. 아깝게 몇 번 피해 보세요';
        else if (cat.missStreak >= 3) hint = '너무 안 잡혀서 시큰둥해요. 이번엔 잡혀주세요';
        else if (tooHigh && cat.interest > 10) hint = '너무 높아요! 고양이가 닿을 높이로 내려주세요';
        else if (cat.tension >= 0.6) hint = '흥분도 높음! 지금 잡혀주면 도파민 대량!';
        else if (cat.interest < stage.cat.pounceAt && (cat.state === 'idle' || cat.state === 'stalk')) hint = `흔들어서 흥미를 표시선(│)까지 올려요 · 툭: ${g.twitch}`;
      }
    }
    this.hint.textContent = hint;
    this.hint.classList.toggle('hidden', !hint);
  }

  showResult(session, hasNext) {
    const clear = session.status === 'clear';
    $('#res-title').textContent = clear ? `${session.stage.catName}의 도파민 MAX! 🎉` : '시간 초과… 😿';
    $('#res-stars').innerHTML = [1, 2, 3].map((i) => `<span class="${i <= session.stars ? '' : 'off'}">★</span>`).join('');
    const s = session.stats;
    $('#res-msg').textContent = clear
      ? `남은 시간 ${session.timeLeft.toFixed(1)}초`
      : s.easy > s.great + s.good ? '너무 쉽게 잡혀줬어요. 아깝게 몇 번 피한 뒤 잡혀주세요!'
      : s.misses + s.bored > 2 ? '너무 안 잡혀서 흥미를 잃었어요. 적당히 잡혀주세요!'
      : '흥분도가 높을 때 잡혀주는 타이밍을 노려보세요!';
    $('#res-stats').innerHTML = `
      <li>잡힘<b>${s.catches}</b></li>
      <li>흥분 MAX 포획<b>${s.great}</b></li>
      <li>아깝게 피함<b>${s.nearMisses}</b></li>
      <li>크게 빗나감<b>${s.misses}</b></li>`;
    $('#btn-next').classList.toggle('hidden', !(clear && hasNext));
    this.show('result');
  }
}
