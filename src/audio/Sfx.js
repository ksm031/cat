// WebAudio 합성 효과음 (에셋 없음). 첫 사용자 입력 시 unlock() 필요(모바일 정책).
export class Sfx {
  constructor() { this.ac = null; this.enabled = true; this.lastBell = 0; }

  unlock() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') this.ac.resume();
  }

  tone(freq, dur, { type = 'sine', vol = 0.3, to = null, delay = 0 } = {}) {
    if (!this.enabled || !this.ac) return;
    const t0 = this.ac.currentTime + delay;
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noise(dur, { vol = 0.2, freq = 1200, to = 400 } = {}) {
    if (!this.enabled || !this.ac) return;
    const t0 = this.ac.currentTime;
    const len = Math.floor(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ac.createBufferSource();
    src.buffer = buf;
    const f = this.ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  play(name, e = {}) {
    switch (name) {
      case 'bell': {
        const now = performance.now();
        if (now - this.lastBell < 90) return;
        this.lastBell = now;
        this.tone(2400 + Math.random() * 300, 0.25, { vol: 0.08 });
        this.tone(3600, 0.18, { vol: 0.04 });
        break;
      }
      case 'cue': this.tone(520, 0.12, { type: 'square', vol: 0.05, to: 700 }); break;
      case 'pounce': this.noise(0.25, { vol: 0.25, freq: 600, to: 2400 }); break;
      case 'catch':
        if (e.quality === 'easy') this.tone(330, 0.25, { type: 'triangle', vol: 0.15, to: 260 });
        else {
          this.tone(500, 0.22, { type: 'sawtooth', vol: 0.06, to: 900 });
          this.tone(880, 0.15, { type: 'sine', vol: 0.15, delay: 0.05 });
          if (e.quality === 'great') { this.tone(1175, 0.18, { vol: 0.15, delay: 0.12 }); this.tone(1568, 0.3, { vol: 0.15, delay: 0.2 }); }
        }
        break;
      case 'nearMiss': this.noise(0.18, { vol: 0.15, freq: 2000, to: 500 }); this.tone(700, 0.1, { type: 'triangle', vol: 0.08, to: 500 }); break;
      case 'miss': this.tone(300, 0.3, { type: 'triangle', vol: 0.12, to: 180 }); break;
      case 'bored': this.tone(400, 0.6, { type: 'sine', vol: 0.12, to: 200 }); break;
      case 'engage': this.tone(660, 0.1, { vol: 0.1, to: 990 }); break;
      case 'clear': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.15, delay: i * 0.11 })); break;
      case 'fail': [392, 330, 262].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.12, delay: i * 0.16 })); break;
      case 'ui': this.tone(880, 0.06, { type: 'triangle', vol: 0.06 }); break;
      case 'tick': this.tone(1200, 0.05, { type: 'square', vol: 0.03 }); break;
    }
  }
}
