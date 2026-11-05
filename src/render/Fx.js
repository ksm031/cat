// 이펙트(파티클/팝업 텍스트) — 렌더 전용, 게임 로직에 영향 없음
export class Fx {
  constructor() { this.parts = []; this.pops = []; }

  burst(x, y, kind, n, spread = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (120 + Math.random() * 260) * spread;
      this.parts.push({
        kind, x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'heart' ? 160 : 60),
        life: 0, max: 0.7 + Math.random() * 0.6,
        size: kind === 'heart' ? 12 + Math.random() * 10 : 5 + Math.random() * 6,
        rot: Math.random() * 6, hue: Math.random(),
      });
    }
  }

  popup(x, y, text, style = {}) {
    this.pops.push({ x, y, text, life: 0, max: style.max || 1.1, size: style.size || 34, color: style.color || '#ff5c8a', vy: -70 });
  }

  update(dt) {
    for (const p of this.parts) {
      p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.kind === 'heart' ? -40 : 500) * dt;
      p.vx *= 1 - dt * 2;
    }
    this.parts = this.parts.filter((p) => p.life < p.max);
    for (const p of this.pops) { p.life += dt; p.y += p.vy * dt; p.vy *= 1 - dt * 2.5; }
    this.pops = this.pops.filter((p) => p.life < p.max);
  }

  draw(ctx) {
    for (const p of this.parts) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a;
      if (p.kind === 'heart') heart(ctx, p.x, p.y, p.size, '#ff6b9a');
      else if (p.kind === 'spark') star(ctx, p.x, p.y, p.size, p.rot + p.life * 4, `hsl(${40 + p.hue * 30},100%,65%)`);
      else { ctx.fillStyle = 'rgba(120,100,80,0.6)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.pops) {
      const u = p.life / p.max;
      const sc = u < 0.15 ? 0.6 + u / 0.15 * 0.5 : 1.1 - Math.min(0.1, (u - 0.15));
      ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      ctx.font = `900 ${p.size * sc}px system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#fff';
      ctx.lineJoin = 'round';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}

export function heart(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  ctx.fill();
}

function star(ctx, x, y, s, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? s * 0.35 : s;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
