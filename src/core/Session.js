import { rng } from './math.js';
import { Lure } from './Lure.js';
import { Cat } from './Cat.js';

export const READY_TIME = 1.5;

/**
 * 한 스테이지 플레이. 입력은 추상 명령 { target:{x,y}|null, twitch:bool } 만 받는다.
 * (어떤 기기에서 왔는지 모름 → 플랫폼 독립)
 */
export class Session {
  constructor(stage, seed = (Math.random() * 2 ** 32) >>> 0) {
    this.stage = stage;
    this.rand = rng(seed);
    this.lure = new Lure();
    this.cat = new Cat(stage, this.rand);
    this.timeLeft = stage.time;
    this.elapsed = 0;
    this.readyT = READY_TIME;
    this.status = 'ready'; // ready | play | clear | fail
    this.events = [];
    this.stars = 0;
    this.stats = { catches: 0, great: 0, good: 0, easy: 0, nearMisses: 0, misses: 0, bored: 0, bestGain: 0 };
  }

  get goal() { return this.stage.goal; }
  get active() { return this.status === 'ready' || this.status === 'play'; }

  step(dt, cmd) {
    const { lure, cat, events } = this;
    if (this.active && cmd) {
      if (cmd.target) lure.setTarget(cmd.target.x, cmd.target.y);
      if (cmd.twitch) lure.twitch(this.rand);
    }
    lure.update(dt);
    const n0 = events.length;
    cat.update(dt, lure, events);
    lure.twitched = false;

    for (let i = n0; i < events.length; i++) {
      const e = events[i];
      if (e.type === 'catch') {
        this.stats.catches++; this.stats[e.quality]++;
        this.stats.bestGain = Math.max(this.stats.bestGain, e.gain);
      } else if (e.type === 'nearMiss') this.stats.nearMisses++;
      else if (e.type === 'miss') this.stats.misses++;
      else if (e.type === 'bored') this.stats.bored++;
    }

    if (this.status === 'ready') {
      this.readyT -= dt;
      if (this.readyT <= 0) { this.status = 'play'; events.push({ type: 'start' }); }
    } else if (this.status === 'play') {
      this.elapsed += dt;
      this.timeLeft -= dt;
      if (cat.dopamine >= this.goal) {
        cat.dopamine = this.goal;
        this.status = 'clear';
        const r = this.timeLeft / this.stage.time;
        this.stars = r >= this.stage.star3 ? 3 : r >= this.stage.star2 ? 2 : 1;
        cat.set('happy');
        events.push({ type: 'clear', stars: this.stars });
      } else if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.status = 'fail';
        cat.set('sulk');
        events.push({ type: 'fail' });
      }
    }
  }
}
