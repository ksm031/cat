import { CAT_SPRITES, CAT_PX } from './sprites.js';

// 절차적 고양이 그리기. 로컬 좌표: 발밑 중심 원점, 오른쪽을 바라봄, y는 위로 음수.
const TAU = Math.PI * 2;

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  ctx.fill();
}

function limb(ctx, x1, y1, x2, y2, w, color, pawColor) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.fillStyle = pawColor;
  ell(ctx, x2, y2, w * 0.62, w * 0.5);
}

function poseOf(cat) {
  switch (cat.state) {
    case 'idle': return cat.interest < 12 ? 'sit' : 'stand';
    case 'stalk': return cat.moving ? 'walk' : 'stand';
    case 'crouch': return 'crouch';
    case 'pounce': return 'pounce';
    case 'fall': return cat.t < 0.16 ? 'pounce' : 'stand';
    case 'land': return 'stand';
    case 'hold': return cat.t < 0.15 ? 'pounce' : 'hold';
    case 'bored': case 'sulk': return 'lie';
    case 'happy': return 'happy';
    default: return 'stand';
  }
}

function tail(ctx, bx, by, mode, t, freq, color, tip, w) {
  let mx, my, tx, ty;
  const sw = Math.sin(t * freq);
  switch (mode) {
    case 'up': mx = bx - 42; my = by - 30; tx = bx - 28 + sw * 22; ty = by - 92; break;
    case 'low': mx = bx - 50; my = by + 4; tx = bx - 95; ty = by + 14 + Math.sin(t * freq * 2.2) * 9; break;
    case 'back': mx = bx - 40; my = by - 6; tx = bx - 88; ty = by - 22 + sw * 6; break;
    case 'curl': mx = bx - 25; my = by + 30; tx = bx + 40 + sw * 4; ty = by + 26; break;
    case 'floor': mx = bx - 30; my = by + 40; tx = bx + 45 + sw * 6; ty = by + 44; break;
    default: mx = bx - 45; my = by - 25; tx = bx - 60 + sw * 25; ty = by - 70;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(mx, my, tx, ty);
  ctx.stroke();
  if (tip) {
    ctx.fillStyle = tip;
    ell(ctx, tx, ty, w * 0.55, w * 0.55);
  }
}

function head(ctx, hx, hy, r, L, o) {
  const { body, belly, stripe, eye, pattern } = L;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(o.tilt || 0);
  // 귀
  const earUp = o.earsBack ? 0.75 : 1;
  for (const s of [-1, 1]) {
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(s * r * 0.92, -r * 0.35);
    ctx.lineTo(s * r * 0.78 + s * (o.earsBack ? r * 0.35 : 0), -r * 1.32 * earUp);
    ctx.lineTo(s * r * 0.1, -r * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4a7b4';
    ctx.beginPath();
    ctx.moveTo(s * r * 0.78, -r * 0.5);
    ctx.lineTo(s * r * 0.72 + s * (o.earsBack ? r * 0.3 : 0), -r * 1.12 * earUp);
    ctx.lineTo(s * r * 0.28, -r * 0.82);
    ctx.closePath();
    ctx.fill();
  }
  // 얼굴
  ctx.fillStyle = body;
  ell(ctx, 0, 0, r * 1.1, r * 0.98);
  if (pattern === 'fluffy') {
    for (const s of [-1, 1]) ell(ctx, s * r * 0.95, r * 0.35, r * 0.4, r * 0.3, s * 0.6);
  }
  if (pattern === 'tuxedo' || pattern === 'white') {
    ctx.fillStyle = belly;
    ell(ctx, r * 0.12, r * 0.42, r * 0.62, r * 0.46);
  }
  if (pattern === 'tabby' || pattern === 'fluffy') {
    ctx.strokeStyle = stripe;
    ctx.lineWidth = r * 0.09;
    ctx.lineCap = 'round';
    for (const dx of [-0.25, 0, 0.25]) {
      ctx.beginPath();
      ctx.moveTo(r * (dx + 0.08), -r * 0.88);
      ctx.lineTo(r * (dx * 0.7 + 0.08), -r * 0.55);
      ctx.stroke();
    }
  }
  const fx = r * 0.14; // 3/4 시점: 이목구비를 바라보는 쪽으로
  // 볼터치 (도파민)
  if (o.blush > 0.05) {
    ctx.fillStyle = `rgba(255,120,150,${0.45 * o.blush})`;
    ell(ctx, fx - r * 0.62, r * 0.3, r * 0.22, r * 0.13);
    ell(ctx, fx + r * 0.62, r * 0.3, r * 0.22, r * 0.13);
  }
  // 눈
  const ex = r * 0.4, ey = -r * 0.06;
  for (const s of [-1, 1]) {
    const cx = fx + s * ex;
    if (o.closed) {
      ctx.strokeStyle = '#2a1b14';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      if (o.happy) ctx.arc(cx, ey + r * 0.06, r * 0.18, Math.PI * 1.1, Math.PI * 1.9);
      else ctx.arc(cx, ey - r * 0.04, r * 0.18, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#fff';
    ell(ctx, cx, ey, r * 0.25, r * 0.28);
    ctx.fillStyle = o.flash ? '#fff7a8' : eye;
    ell(ctx, cx + o.lx * r * 0.05, ey + o.ly * r * 0.05, r * 0.22, r * 0.25);
    ctx.fillStyle = '#16100c';
    const pw = r * 0.22 * (0.22 + 0.7 * o.dilate);
    ell(ctx, cx + o.lx * r * 0.08, ey + o.ly * r * 0.07, pw, r * 0.23);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ell(ctx, cx + r * 0.07, ey - r * 0.1, r * 0.06, r * 0.06);
  }
  // 코/입
  ctx.fillStyle = '#f08ca0';
  ctx.beginPath();
  ctx.moveTo(fx - r * 0.1, r * 0.17);
  ctx.lineTo(fx + r * 0.1, r * 0.17);
  ctx.lineTo(fx, r * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4a2f25';
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  if (o.mouthOpen) {
    ctx.fillStyle = '#b8455c';
    ell(ctx, fx, r * 0.42, r * 0.14, r * 0.12 * o.mouthOpen);
  } else {
    ctx.arc(fx - r * 0.09, r * 0.3, r * 0.09, 0, Math.PI);
    ctx.moveTo(fx + r * 0.18, r * 0.3);
    ctx.arc(fx + r * 0.09, r * 0.3, r * 0.09, 0, Math.PI);
    ctx.stroke();
  }
  // 수염
  ctx.strokeStyle = 'rgba(60,40,30,0.55)';
  ctx.lineWidth = r * 0.03;
  for (const s of [-1, 1]) for (const k of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(fx + s * r * 0.35, r * 0.28 + k * r * 0.06);
    ctx.lineTo(fx + s * r * 1.15, r * 0.2 + k * r * 0.14);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * @param look  stage.look
 * @param view  { lx, ly } 시선(-1..1)
 */
export function drawCat(ctx, cat, look, time, view) {
  const pose = poseOf(cat);
  const k = cat.size;
  const t = time;
  const excite = Math.min(1, cat.interest / 100 * 0.6 + cat.tension * 0.6);
  const freq = 1.6 + cat.interest / 22 + cat.tension * 6;
  const dark = look.stripe;
  const belly = look.belly;
  const body = look.body;
  const pawC = look.pattern === 'tuxedo' ? belly : body;
  const tailW = look.pattern === 'fluffy' ? 20 : 13;

  ctx.save();
  ctx.translate(cat.pivot.x, cat.pivot.y);
  ctx.scale(cat.facing, 1);
  ctx.rotate(cat.angle);
  ctx.translate(-cat.pivotLocal.x, -cat.pivotLocal.y);
  ctx.scale(k, k);

  const face = {
    lx: view.lx, ly: view.ly, dilate: excite, blush: Math.min(1, cat.dopamine / 100),
    closed: false, happy: false, mouthOpen: 0, tilt: 0, earsBack: false, flash: false,
  };

  let B, H, legsF, legsB, tailBase, tailMode;
  const walk = Math.sin(cat.walkPhase);
  switch (pose) {
    case 'sit':
      B = [-8, -58, 44, 42, -0.45]; H = [26, -112, 32];
      legsF = [[18, -42, 22, 0], [8, -42, 10, 0]]; legsB = [];
      tailBase = [-40, -18]; tailMode = 'floor'; break;
    case 'walk':
      B = [0, -62 + Math.abs(walk) * 2, 58, 30, 0]; H = [60, -98, 32];
      legsF = [[36, -50, 38 + walk * 14, 0], [22, -50, 22 - walk * 14, 0]];
      legsB = [[-32, -50, -32 - walk * 14, 0], [-46, -50, -46 + walk * 14, 0]];
      tailBase = [-54, -70]; tailMode = 'up'; break;
    case 'crouch': {
      const wig = cat.cued ? 0 : Math.sin(t * 30) * 4;
      B = [-6 + wig, -36, 66, 25, 0.12]; H = [62, -46, 31];
      legsF = [[40, -24, 54, 0], [30, -24, 42, 0]];
      legsB = [[-36 + wig, -40, -26 + wig, 0], [-50 + wig, -40, -40 + wig, 0]];
      tailBase = [-64 + wig, -46]; tailMode = 'low';
      face.earsBack = true; face.flash = cat.cued && (t * 20) % 2 < 1;
      face.dilate = 1; break;
    }
    case 'pounce':
      B = [0, -50, 74, 25, 0]; H = [44, -78, 30];
      legsF = [[38, -52, 70, -40], [30, -46, 66, -30]];
      legsB = [[-46, -44, -98, -22], [-56, -40, -104, -12]];
      tailBase = [-70, -54]; tailMode = 'back';
      face.dilate = 1; face.mouthOpen = 0.8; break;
    case 'hold':
      B = [-4, -40, 60, 32, 0.05]; H = [44, -62, 31];
      legsF = [[36, -40, 58, -30], [28, -36, 52, -22]];
      legsB = [[-30, -30, -8 + Math.sin(t * 26) * 16, -12], [-40, -28, -14 + Math.cos(t * 26) * 16, -6]];
      tailBase = [-60, -44]; tailMode = 'back';
      face.tilt = 0.35; face.mouthOpen = 0.5 + Math.sin(t * 18) * 0.3; face.dilate = 1; break;
    case 'lie':
      B = [0, -28, 68, 26, 0]; H = [62, -40, 30];
      legsF = [[50, -14, 86, -6]]; legsB = [];
      tailBase = [-62, -22]; tailMode = 'curl';
      face.closed = true; face.tilt = 0.25; face.blush = 0; break;
    case 'happy':
      B = [0, -30, 66, 28, Math.sin(t * 3) * 0.08]; H = [62, -44 + Math.sin(t * 6) * 2, 31];
      legsF = [[44, -22, 70, -40 + Math.sin(t * 8) * 6], [34, -22, 60, -46 + Math.cos(t * 8) * 6]];
      legsB = [[-40, -22, -60, -40], [-50, -22, -72, -34]];
      tailBase = [-62, -26]; tailMode = 'up';
      face.closed = true; face.happy = true; face.blush = 1; face.tilt = -0.2; break;
    default: // stand
      B = [0, -62, 58, 31, 0]; H = [60, -100, 33];
      legsF = [[36, -52, 38, 0], [22, -52, 22, 0]];
      legsB = [[-32, -52, -34, 0], [-46, -52, -46, 0]];
      tailBase = [-54, -72]; tailMode = 'up';
  }

  // 뒤쪽 다리(어둡게)
  const shade = 'rgba(0,0,0,0.16)';
  const farLeg = (L) => {
    limb(ctx, L[0], L[1], L[2], L[3], 15, body, pawC);
    limb(ctx, L[0], L[1], L[2], L[3], 15, shade, shade);
  };
  tail(ctx, tailBase[0], tailBase[1], tailMode, t, freq, body, look.pattern === 'tabby' || look.pattern === 'fluffy' ? dark : null, tailW);
  if (legsB[1]) farLeg(legsB[1]);
  if (legsF[1]) farLeg(legsF[1]);

  // 몸통
  ctx.fillStyle = body;
  ell(ctx, B[0], B[1], B[2], B[3], B[4]);
  if (look.pattern === 'fluffy') {
    for (let i = -2; i <= 2; i++) ell(ctx, B[0] + i * B[2] * 0.35, B[1] + B[3] * 0.75, B[2] * 0.22, B[3] * 0.32, 0);
  }
  ctx.fillStyle = belly;
  if (look.pattern !== 'white') ell(ctx, B[0] + B[2] * 0.45, B[1] + B[3] * 0.25, B[2] * 0.42, B[3] * 0.62, B[4]);
  if (look.pattern === 'tabby' || look.pattern === 'fluffy') {
    ctx.save();
    ctx.translate(B[0], B[1]);
    ctx.rotate(B[4]);
    ctx.strokeStyle = dark;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const sx of [-0.55, -0.2, 0.15]) {
      ctx.beginPath();
      ctx.moveTo(B[2] * sx, -B[3] * 0.95);
      ctx.quadraticCurveTo(B[2] * (sx - 0.08), -B[3] * 0.4, B[2] * (sx + 0.02), -B[3] * 0.1);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (look.pattern === 'white') {
    ctx.fillStyle = '#e8c49a';
    ell(ctx, B[0] - B[2] * 0.4, B[1] - B[3] * 0.4, B[2] * 0.28, B[3] * 0.35, 0.3);
  }

  // 앞쪽 다리
  if (legsB[0]) limb(ctx, legsB[0][0], legsB[0][1], legsB[0][2], legsB[0][3], 16, body, pawC);
  if (legsF[0]) limb(ctx, legsF[0][0], legsF[0][1], legsF[0][2], legsF[0][3], 16, body, pawC);

  head(ctx, H[0], H[1], H[2], look, face);
  ctx.restore();
}


function blit(ctx, img, def, sx = 1, sy = 1) {
  const w = img.width * CAT_PX, h = img.height * CAT_PX;
  ctx.save();
  ctx.scale(sx, sy);
  ctx.drawImage(img, -def.anchor[0] * CAT_PX, -def.anchor[1] * CAT_PX, w, h);
  ctx.restore();
}

/** 스프라이트 아트로 고양이 그리기 (로직이 계산한 pivot/angle 변환을 그대로 사용) */
export function drawCatSprite(ctx, cat, set, time) {
  const pose = poseOf(cat);
  const t = time;
  ctx.save();
  ctx.translate(cat.pivot.x, cat.pivot.y);
  ctx.scale(cat.facing, 1);
  ctx.rotate(cat.angle);
  ctx.translate(-cat.pivotLocal.x, -cat.pivotLocal.y);
  ctx.scale(cat.size, cat.size);

  switch (pose) {
    case 'pounce': {
      // 앞발 기준점에 맞춰 그리고, 진행 방향으로 몸을 눕힘
      ctx.translate(cat.pivotLocal.x / cat.size, cat.pivotLocal.y / cat.size);
      ctx.rotate(0.8);
      blit(ctx, set.jump, CAT_SPRITES.jump);
      break;
    }
    case 'hold':
      ctx.translate(Math.sin(t * 40) * 1.5, 0);
      blit(ctx, set.swat, CAT_SPRITES.swat, 1, 1 + Math.sin(t * 20) * 0.015);
      break;
    case 'happy':
      ctx.translate(0, -Math.abs(Math.sin(t * 6)) * 14);
      blit(ctx, set.swat, CAT_SPRITES.swat);
      break;
    case 'sit':
      blit(ctx, set.sit, CAT_SPRITES.sit, 1, 1 + Math.sin(t * 2) * 0.012);
      break;
    case 'lie': // 삐짐: 등을 돌리고 앉음
      ctx.globalAlpha = 0.92;
      blit(ctx, set.sit, CAT_SPRITES.sit, -1, 0.97);
      break;
    case 'crouch': {
      const wig = cat.cued ? 0 : Math.sin(t * 30) * 4;
      ctx.translate(wig, 0);
      blit(ctx, set.crouch, CAT_SPRITES.crouch, 1.03, cat.cued ? 0.86 : 0.93);
      break;
    }
    case 'walk':
      ctx.translate(0, -Math.abs(Math.sin(cat.walkPhase)) * 6);
      blit(ctx, set.crouch, CAT_SPRITES.crouch, 1, 1 + Math.sin(cat.walkPhase * 2) * 0.02);
      break;
    default: { // stand / land
      const squash = cat.state === 'land' && cat.t < 0.12 ? 0.9 : 1;
      blit(ctx, set.crouch, CAT_SPRITES.crouch, 1, squash);
    }
  }
  ctx.restore();
}
