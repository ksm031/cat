// 스프라이트 아트 로더 + 스테이지별 털색 변환.
// 원본은 치즈냥 1종 → 런타임에 '주황 털' 픽셀만 골라 스테이지 색으로 바꾼다
// (흰 털·코·눈·외곽선 유지). 아트를 교체해도 이 파일의 기준점만 맞추면 된다.
// 로드 실패 시 렌더러는 절차적(벡터) 고양이로 자동 대체.

export const CAT_PX = 0.28; // 스프라이트 1px = 월드 0.24 단위 (size 1 기준)

// anchor: 발밑 기준점(px). jump는 '앞발' 기준(덮치기 판정점과 일치). paw: 잡았을 때 장난감 위치
export const CAT_SPRITES = {
  sit: { src: 'assets/cat_sit.webp', anchor: [200, 630] },
  crouch: { src: 'assets/cat_crouch.webp', anchor: [300, 622] },
  jump: { src: 'assets/cat_jump.webp', anchor: [470, 100] },
  swat: { src: 'assets/cat_swat.webp', anchor: [200, 605], paw: [475, 180] },
};
export const LURE_SPRITE = { src: 'assets/lure.webp', anchor: [105, 150], ring: [105, 14], scale: 0.26 };

const loadImg = (src) => new Promise((res, rej) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = () => rej(new Error('load fail ' + src));
  im.src = src;
});

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}

function hsvToRgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/** 주황 털 → look.body 계열, 초록 눈 → look.eye 색상 */
function recolor(img, look, refLum) {
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  if (!look.recolor) return cv;
  const d = cx.getImageData(0, 0, cv.width, cv.height);
  const p = d.data;
  const body = hexRgb(look.body);
  const eyeHue = rgbToHsv(...hexRgb(look.eye))[0];
  const con = look.stripeContrast ?? 1;
  const K = 0.55, kHi = (1 - (1 - K) * con) / K;
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] === 0) continue;
    const r = p[i], g = p[i + 1], b = p[i + 2];
    const [h, s, v] = rgbToHsv(r, g, b);
    if (h >= 12 && h <= 48) {
      // 털: 채도 높을수록 강하게 치환 (흰 털과의 경계는 부드럽게)
      const w = smooth(0.16, 0.42, s);
      if (w <= 0) continue;
      let t = lum(r, g, b) / refLum;
      t = t >= K ? 1 - (1 - t) * con : t * kHi; // 외곽선(어두운 쪽)은 유지, 줄무늬 대비만 조절
      p[i] = r + (Math.min(255, body[0] * t) - r) * w;
      p[i + 1] = g + (Math.min(255, body[1] * t) - g) * w;
      p[i + 2] = b + (Math.min(255, body[2] * t) - b) * w;
    } else if (h >= 65 && h <= 150 && s > 0.3 && v > 0.15) {
      const [nr, ng, nb] = hsvToRgb(eyeHue, s, v);
      p[i] = nr; p[i + 1] = ng; p[i + 2] = nb;
    }
  }
  cx.putImageData(d, 0, 0);
  return cv;
}

class SpriteBank {
  constructor() {
    this.ready = false;
    this.base = null;
    this.lure = null;
    this.cache = new Map();
    this.refLum = 160;
  }

  async load() {
    try {
      const keys = Object.keys(CAT_SPRITES);
      const imgs = await Promise.all([...keys.map((k) => loadImg(CAT_SPRITES[k].src)), loadImg(LURE_SPRITE.src)]);
      this.base = Object.fromEntries(keys.map((k, i) => [k, imgs[i]]));
      this.lure = imgs[imgs.length - 1];
      this.refLum = this.measureRef(this.base.sit);
      this.ready = true;
    } catch (e) {
      console.warn('[sprites] 아트 로드 실패 → 벡터 고양이 사용', e);
    }
    return this.ready;
  }

  // 기준 털 밝기: 밝은 주황 픽셀들의 평균 (줄무늬 제외)
  measureRef(img) {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const p = cx.getImageData(0, 0, cv.width, cv.height).data;
    let sum = 0, n = 0;
    for (let i = 0; i < p.length; i += 16) {
      if (p[i + 3] < 250) continue;
      const [h, s, v] = rgbToHsv(p[i], p[i + 1], p[i + 2]);
      if (h >= 20 && h <= 40 && s > 0.55 && v > 0.85) { sum += lum(p[i], p[i + 1], p[i + 2]); n++; }
    }
    return n ? sum / n : 160;
  }

  /** 스테이지 외형별 스프라이트 세트 (캐시) */
  forLook(look) {
    if (!this.ready) return null;
    const key = `${look.body}|${look.eye}|${look.recolor}|${look.stripeContrast}`;
    if (!this.cache.has(key)) {
      const set = {};
      for (const k of Object.keys(this.base)) set[k] = recolor(this.base[k], look, this.refLum);
      this.cache.set(key, set);
    }
    return this.cache.get(key);
  }
}

export const sprites = new SpriteBank();
