import { WORLD } from '../core/math.js';

const F = WORLD.FLOOR;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
  ctx.fill();
}

// 배경은 플레이 영역(0..1000) 밖까지 넉넉히 그려서 어떤 화면비에서도 빈 곳이 없게
export function drawRoom(ctx, theme, time, x0, x1, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, F);
  g.addColorStop(0, theme.wall2);
  g.addColorStop(1, theme.wall);
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, x1 - x0, F - y0);

  // 벽지 무늬
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = Math.floor(x0 / 80) * 80; x < x1; x += 80) {
    for (let y = 40; y < F - 60; y += 90) {
      ctx.beginPath();
      ctx.arc(x + ((y / 90) % 2) * 40, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  decor(ctx, theme, time);

  // 걸레받이 + 바닥
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x0, F - 26, x1 - x0, 26);
  ctx.fillStyle = theme.floor;
  ctx.fillRect(x0, F, x1 - x0, y1 - F);
  ctx.strokeStyle = theme.floor2;
  ctx.lineWidth = 3;
  for (let y = F + 30; y < y1; y += 45) {
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  }
  for (let x = Math.floor(x0 / 220) * 220; x < x1; x += 220) {
    for (let r = 0; F + r * 45 < y1; r++) {
      const ox = (r % 2) * 110;
      ctx.beginPath(); ctx.moveTo(x + ox, F + r * 45 - 15); ctx.lineTo(x + ox, F + r * 45 + 30); ctx.stroke();
    }
  }
  // 러그
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath(); ctx.ellipse(500, F + 40, 380, 40, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(500, F + 40, 340, 30, 0, 0, Math.PI * 2); ctx.stroke();
}

function windowFrame(ctx, x, y, w, h, sky, time) {
  ctx.fillStyle = '#fff';
  rr(ctx, x - 14, y - 14, w + 28, h + 28, 10);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, sky);
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // 구름
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const cx = x + ((time * 8) % (w + 120)) - 60;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 26], [50, 2, 20]]) {
    ctx.beginPath(); ctx.arc(cx + dx, y + h * 0.3 + dy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + w / 2 - 5, y, 10, h);
  ctx.fillRect(x, y + h / 2 - 5, w, 10);
}

function decor(ctx, theme, time) {
  switch (theme.deco) {
    case 'window':
      windowFrame(ctx, 600, 230, 260, 300, theme.sky, time);
      ctx.fillStyle = '#e07a5f'; // 커튼
      rr(ctx, 560, 200, 40, 380, 14); rr(ctx, 860, 200, 40, 380, 14);
      ctx.fillStyle = '#7a5a43'; // 소파
      rr(ctx, 60, 640, 300, 160, 26);
      ctx.fillStyle = '#9b7457';
      rr(ctx, 40, 700, 340, 120, 30);
      break;
    case 'bed':
      windowFrame(ctx, 130, 200, 220, 260, theme.sky, time);
      ctx.fillStyle = '#ffffff';
      rr(ctx, 560, 680, 420, 150, 26);
      ctx.fillStyle = '#9fc3e8';
      rr(ctx, 560, 720, 420, 110, 20);
      ctx.fillStyle = '#7a8fa8';
      rr(ctx, 940, 560, 40, 280, 12);
      ctx.fillStyle = '#fff';
      rr(ctx, 600, 650, 120, 60, 24);
      break;
    case 'balcony':
      windowFrame(ctx, 60, 140, 880, 520, theme.sky, time);
      ctx.fillStyle = '#5d8f4f'; // 화분
      for (const x of [120, 820]) {
        ctx.beginPath(); ctx.arc(x, 740, 60, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c96d4a'; rr(ctx, x - 40, 770, 80, 110, 10); ctx.fillStyle = '#5d8f4f';
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 6;
      for (let x = 60; x <= 940; x += 44) { ctx.beginPath(); ctx.moveTo(x, 560); ctx.lineTo(x, 660); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(60, 560); ctx.lineTo(940, 560); ctx.stroke();
      break;
    case 'bookshelf':
      ctx.fillStyle = '#6b4428';
      rr(ctx, 40, 160, 300, 720, 10);
      for (let r = 0; r < 5; r++) {
        ctx.fillStyle = '#4e301b';
        ctx.fillRect(56, 190 + r * 135, 268, 110);
        const cols = ['#c44536', '#4a7c59', '#e9c46a', '#386fa4', '#8d6cab', '#f4a261'];
        for (let b = 0; b < 9; b++) {
          ctx.fillStyle = cols[(b + r * 2) % cols.length];
          const h = 70 + ((b * 37 + r * 13) % 35);
          ctx.fillRect(62 + b * 29, 300 + r * 135 - h, 24, h);
        }
      }
      ctx.fillStyle = '#ffcf70';
      ctx.beginPath(); ctx.arc(820, 300, 60, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5b3c26'; rr(ctx, 812, 340, 16, 380, 6); rr(ctx, 760, 720, 120, 20, 8);
      break;
    case 'tower':
      windowFrame(ctx, 380, 180, 300, 320, theme.sky, time);
      ctx.fillStyle = '#c9a27a';
      rr(ctx, 80, 300, 40, 580, 10); rr(ctx, 230, 450, 40, 430, 10);
      ctx.fillStyle = '#8c6bb1';
      rr(ctx, 40, 280, 160, 34, 14); rr(ctx, 180, 430, 140, 34, 14); rr(ctx, 30, 620, 200, 34, 14);
      ctx.fillStyle = '#6d4f8f';
      ctx.beginPath(); ctx.arc(120, 250, 46, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(860, 300, 30, 0, Math.PI * 2); ctx.fill();
      break;
  }
}
