// 플랫폼 서비스 추상화: 저장소 / 진동 / 화면 — 콘솔·앱 포팅 시 이 파일만 교체
const KEY = 'cat-teaser-save-v1';

export const storage = {
  load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  },
  save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 프라이빗 모드 등 — 무시 */ }
  },
};

export const haptics = {
  enabled: true,
  pulse(strength = 0.5, ms = 60, pad = null) {
    if (!this.enabled) return;
    try {
      const act = pad?.vibrationActuator;
      if (act?.playEffect) {
        act.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 });
        return;
      }
      navigator.vibrate?.(ms);
    } catch { /* 미지원 */ }
  },
};
