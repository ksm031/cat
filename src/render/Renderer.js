import { WORLD, clamp, lerp } from '../core/math.js';
import { drawCat, drawCatSprite } from './drawCat.js';
import { sprites, LURE_SPRITE } from './sprites.js';
import { drawRoom } from './drawRoom.js';
import { Fx, heart } from './Fx.js';

const F = WORLD.FLOOR;
const PORTRAIT_VIEW_W = 640; // 세로 화면에선 월드 일부만 보여주고 카메라가 따라감 (고양이가 너무 작아지지 않게)

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.fx = new Fx();
    this.camX = WORLD.W / 2;
    this.shake = 0;
    this.view = { s: 1, ox: 0, oy: 0, vw: WORLD.W };
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = innerWidth, h = innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.dpr = dpr; this.w = w; this.h = h;
    const portrait = h > w * 1.05;
    const vw = portrait ? PORTRAIT_VIEW_W : WORLD.W;
    const s = Math.min(w / vw, h / WORLD.H);
    this.view.s = s;
    this.view.vw = Math.min(WORLD.W, w / s);
    this.view.oy = portrait ? (h - WORLD.H * s) * 0.72 : (h - WORLD.H * s) / 2;
    this.camX = clamp(this.camX, this.view.vw / 2, WORLD.W - this.view.vw / 2);
  }

  get ox() { return this.w / 2 - this.camX * this.view.s; }

  screenToWorld(px, py) {
    return { x: (px - this.ox) / this.view.s, y: (py - this.view.oy) / this.view.s };
  }

  /** 현재 화면에 보이는 월드 x 범위 (조작 가능한 범위 제한용) */
  visibleX(margin = 24) {
    const half = this.view.vw / 2;
    return [Math.max(0, this.camX - half + margin), Math.min(WORLD.W, this.camX + half - margin)];
  }

  updateCamera(session, dt) {
    const half = this.view.vw / 2;
    if (half * 2 >= WORLD.W - 1) { this.camX = WORLD.W / 2; return; }
    const want = clamp((session.cat.pivot.x + session.lure.tx) / 2, half, WORLD.W - half);
    this.camX = lerp(this.camX, want, Math.min(1, dt * 3));
  }

  onEvents(events, session) {
    const fx = this.fx;
    for (const e of events) {
      switch (e.type) {
        case 'catch': {
          const big = e.quality === 'great';
          fx.burst(e.x, e.y, 'heart', big ? 16 : e.quality === 'good' ? 8 : 3, big ? 1.3 : 0.8);
          if (big) fx.burst(e.x, e.y, 'spark', 14, 1.4);
          const label = e.quality === 'great' ? '도파민 폭발!' : e.quality === 'good' ? '잡았다!' : e.easyStreak > 1 ? '또 이거야…?' : '시시해…';
          fx.popup(e.x, e.y - 60, label, { size: big ? 54 : 40, color: e.quality === 'easy' ? '#8a8a8a' : big ? '#ff3d7f' : '#ff7a3d', max: 1.3 });
          fx.popup(e.x, e.y - 10, `+${Math.round(e.gain)}`, { size: 30, color: e.quality === 'easy' ? '#9a9a9a' : '#ff5c8a' });
          this.shake = big ? 14 : 6;
          break;
        }
        case 'nearMiss':
          fx.burst(e.x, e.y, 'spark', 6, 0.7);
          fx.popup(e.x, e.y - 50, e.streak >= 4 ? '또 놓쳤어…' : '아깝다!', { size: 36, color: e.streak >= 4 ? '#8d7fa8' : '#f5a623' });
          break;
        case 'miss':
          fx.burst(e.x, F - 10, 'dust', 6, 0.5);
          fx.popup(e.x, e.y - 50, '너무 멀어…', { size: 34, color: '#7c8ba1' });
          break;
        case 'land': fx.burst(e.x, F - 6, 'dust', 4, 0.35); break;
        case 'engage': fx.popup(e.x, e.y, '!', { size: 64, color: '#ff8a3d', max: 0.8 }); break;
        case 'cue': fx.popup(e.x, e.y, '!!', { size: 58, color: '#ff3d3d', max: 0.45 }); break;
        case 'combo': fx.popup(e.x, e.y, '한 번 더!', { size: 40, color: '#ff3d3d', max: 0.7 }); break;
        case 'bored': fx.popup(e.x, e.y, '흥미 잃음…', { size: 40, color: '#7c8ba1', max: 1.6 }); break;
        case 'clear': {
          const c = session.cat;
          fx.burst(c.pivot.x, F - 80, 'heart', 30, 1.6);
          fx.burst(c.pivot.x, F - 80, 'spark', 24, 1.8);
          break;
        }
      }
    }
  }

  render(session, time, dt) {
    const { ctx } = this;
    const { s, oy } = this.view;
    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 40);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#2b1d14';
    ctx.fillRect(0, 0, this.w, this.h);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    ctx.translate(this.ox + sx, oy + sy);
    ctx.scale(s, s);

    const x0 = -this.ox / s - 50, x1 = (this.w - this.ox) / s + 50;
    const y0 = -oy / s - 50, y1 = (this.h - oy) / s + 50;
    const stage = session.stage;
    drawRoom(ctx, stage.theme, time, x0, x1, y0, y1);

    const { cat, lure } = session;
    // 그림자
    const airborne = F - (cat.pivot.y - cat.pivotLocal.y);
    const shX = cat.state === 'pounce' ? cat.paw.x - cat.facing * 60 * cat.size : cat.pivot.x;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(shX, F + 4, 70 * cat.size * clamp(1 - airborne / 600, 0.4, 1), 12 * cat.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(lure.x, F + 4, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 웅크림 경고 링
    if (cat.state === 'crouch') {
      const ct = cat.cfg.crouchTime;
      const u = clamp(cat.t / ct, 0, 1);
      ctx.strokeStyle = cat.cued ? 'rgba(255,60,60,0.85)' : `rgba(255,140,60,${0.25 + u * 0.4})`;
      ctx.lineWidth = cat.cued ? 6 : 4;
      ctx.setLineDash(cat.cued ? [] : [10, 10]);
      ctx.beginPath();
      ctx.arc(lure.x, lure.y, 60 + (1 - u) * 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const head = cat.headPos;
    const view = {
      lx: clamp(((lure.x - head.x) * cat.facing) / 250, -1, 1),
      ly: clamp((lure.y - head.y) / 250, -1, 1),
    };
    const lureBehind = cat.state === 'hold';
    if (!lureBehind) this.drawRod(ctx, lure, session);
    const set = sprites.forLook(stage.look);
    if (set) drawCatSprite(ctx, cat, set, time);
    else drawCat(ctx, cat, stage.look, time, view); // 아트 미로드 시 벡터 폴백
    if (lureBehind) this.drawRod(ctx, lure, session);

    // 상태 아이콘
    if (cat.state === 'bored' || cat.state === 'sulk') {
      ctx.fillStyle = '#7c8ba1';
      ctx.font = '900 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const zz = Math.floor(time * 2) % 3;
      ctx.fillText('z'.repeat(zz + 1), cat.pivot.x + 40 * cat.facing, F - 120 * cat.size - zz * 8);
    } else if (cat.state === 'happy') {
      heart(ctx, cat.pivot.x + Math.sin(time * 3) * 30, F - 130 - ((time * 60) % 60), 18, '#ff6b9a');
    }

    this.fx.draw(ctx);
  }

  drawRod(ctx, lure, session) {
    const vx1 = this.visibleX(0)[1];
    const handX = vx1 + 40, handY = -40;
    const tipX = lure.tx + (lure.tx - this.camX) * 0.12;
    const tipY = 30 + (lure.ty - 500) * 0.06;
    // 낚싯대
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(handX, handY); ctx.lineTo(lerp(handX, tipX, 0.55), lerp(handY, tipY, 0.55)); ctx.stroke();
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(lerp(handX, tipX, 0.5), lerp(handY, tipY, 0.5)); ctx.lineTo(tipX, tipY); ctx.stroke();
    const ang = clamp(-lure.vx * 0.0012, -1.2, 1.2); // 이동 반대 방향으로 깃털이 끌림
    // 줄 (스프라이트면 고리에 연결)
    let ex = lure.x, ey = lure.y;
    if (sprites.ready) {
      const L = LURE_SPRITE, sc = L.scale;
      const rx = (L.ring[0] - L.anchor[0]) * sc, ry = (L.ring[1] - L.anchor[1]) * sc;
      ex = lure.x + rx * Math.cos(ang) - ry * Math.sin(ang);
      ey = lure.y + rx * Math.sin(ang) + ry * Math.cos(ang);
    }
    ctx.strokeStyle = 'rgba(60,40,30,0.75)';
    ctx.lineWidth = 2;
    const sag = Math.max(0, 80 - Math.hypot(ex - tipX, ey - tipY) * 0.1);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo((tipX + ex) / 2, (tipY + ey) / 2 + sag, ex, ey);
    ctx.stroke();

    if (sprites.ready) {
      const L = LURE_SPRITE, sc = L.scale, img = sprites.lure;
      const flutter = Math.sin(lure.time * 28) * Math.min(1, lure.wiggle) * 0.08;
      ctx.save();
      ctx.translate(lure.x, lure.y);
      ctx.rotate(ang + flutter);
      ctx.drawImage(img, -L.anchor[0] * sc, -L.anchor[1] * sc, img.width * sc, img.height * sc);
      ctx.restore();
      return;
    }

    // 깃털 장난감 (벡터 폴백)
    ctx.save();
    ctx.translate(lure.x, lure.y);
    ctx.rotate(ang);
    const flutter = Math.sin(session.lure.time * 30) * Math.min(1, lure.wiggle) * 0.25;
    const cols = ['#ff5c8a', '#ffd23f', '#3fc1ff', '#9b5de5'];
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(-0.6 + i * 0.4 + flutter * (i % 2 ? 1 : -1));
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.ellipse(0, 26, 8, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, 48); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9a6b12';
    ctx.beginPath(); ctx.arc(0, 3, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
