/* Chord Runner: the game engine. A chord name rides in on each crate; play it on beat 1 to jump. */
(function () {
  const A = WS.audio;
  const T = WS.theory;

  const COLORS = {
    skyTop: '#121C17', skyBottom: '#344E41', hillFar: '#2A4034', hillNear: '#22362B', pine: '#1A2A21',
    plankTop: '#9B7A52', plank: '#5E4A33', plankDark: '#3F3223', ground: '#121C17',
    crate: '#9A7A4E', crateDark: '#5B4630', label: '#DAD7CD', ink: '#1E2C25',
    paper: '#DAD7CD', moon: '#A3B18A', hit: '#8FC27F', miss: '#E8806E', gold: '#E9C46A',
  };

  /* Draw a chord symbol lead-sheet style: big root, smaller accidental and quality. */
  WS.drawSym = function (ctx, sym, x, y, size, color, align = 'center') {
    const p = T.symParts(sym);
    const fRoot = `700 ${size}px Kalam, "Marker Felt", cursive`;
    const fAcc = `${Math.round(size * 0.62)}px "Apple Symbols", "Segoe UI Symbol", "Noto Music", sans-serif`;
    const fSuf = `700 ${Math.round(size * 0.62)}px Kalam, "Marker Felt", cursive`;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.font = fRoot; const wR = ctx.measureText(p.letter).width;
    ctx.font = fAcc; const wA = p.acc ? ctx.measureText(p.acc).width + size * 0.02 : 0;
    ctx.font = fSuf; const wS = p.suffix ? ctx.measureText(p.suffix).width : 0;
    const total = wR + wA + wS;
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    ctx.fillStyle = color;
    ctx.font = fRoot; ctx.fillText(p.letter, cx, y); cx += wR;
    if (p.acc) { ctx.font = fAcc; ctx.fillText(p.acc, cx + size * 0.01, y - size * 0.3); cx += wA; }
    if (p.suffix) { ctx.font = fSuf; ctx.fillText(p.suffix, cx, y - size * 0.08); }
    ctx.restore();
    return total;
  };
  WS.measureSym = function (ctx, sym, size) {
    const p = T.symParts(sym);
    ctx.save();
    ctx.font = `700 ${size}px Kalam, cursive`; let w = ctx.measureText(p.letter).width;
    ctx.font = `${Math.round(size * 0.62)}px "Apple Symbols", "Segoe UI Symbol", sans-serif`; if (p.acc) w += ctx.measureText(p.acc).width + size * 0.02;
    ctx.font = `700 ${Math.round(size * 0.62)}px Kalam, cursive`; if (p.suffix) w += ctx.measureText(p.suffix).width;
    ctx.restore();
    return w;
  };

  class ChordRunner {
    constructor(opts) {
      Object.assign(this, opts); // plan, hud, onDone, onQuit
      this.canvas = WS.$('#game-canvas');
      this.g = this.canvas.getContext('2d');
      this.prompts = this.plan.prompts;
      this.tempo = this.plan.tempo;
      this.spb = 60 / this.tempo;
      this.bpb = 4;
      this.countIn = 1;
      // Grading windows (seconds): early up to half a beat, late up to a quarter beat, "perfect" within 8% of a beat (min 60 ms)
      this.E = WS.clamp(0.5 * this.spb, 0.25, 0.7);
      this.L = WS.clamp(0.25 * this.spb, 0.15, 0.35);
      this.P = Math.max(0.06, 0.08 * this.spb);
      this.cal = (WS.S().settings.calibrationMs || 0) / 1000;
      const n = this.prompts.length;
      this.results = new Array(n).fill(null);
      this.matches = new Array(n).fill(null);
      this.early = new Array(n).fill(false);
      this.snap = new Array(n).fill(null);
      this.broken = new Array(n).fill(false);
      this.jumps = [];
      this.parts = [];
      this.pops = [];
      this.stumbleAt = -1;
      this.combo = 0;
      this.running = false;
      this.reduced = WS.reducedMotion();
      this.buildScenery();
    }

    buildScenery() {
      const r = WS.rng(7);
      this.starsBg = Array.from({ length: 140 }, () => ({ x: r(), y: r() * 0.62, s: 0.4 + r() * 1.3, p: r() * Math.PI * 2 }));
      this.pines = Array.from({ length: 36 }, (_, i) => ({ x: i * 46 + r() * 20, h: 40 + r() * 70, w: 18 + r() * 16 }));
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.W = w; this.H = h;
      this.groundY = Math.round(h * 0.7);
      this.charX = Math.round(w * 0.24);
      this.pxPerBeat = WS.clamp(w * 0.09, 64, 140);
      this.pxPerSec = this.pxPerBeat / this.spb;
      this.cs = WS.clamp(h * 0.09, 48, 78);
      this.u = WS.clamp(h / 820, 0.75, 1.35);
      this.skyGrad = this.g.createLinearGradient(0, 0, 0, this.groundY);
      this.skyGrad.addColorStop(0, COLORS.skyTop);
      this.skyGrad.addColorStop(1, COLORS.skyBottom);
    }

    start() {
      const c = A.ensure();
      this.t0 = c.currentTime + 0.6;
      this.downbeats = this.prompts.map((_, i) => this.t0 + (this.countIn + i) * this.bpb * this.spb);
      this.lastT = this.downbeats[this.downbeats.length - 1];
      this.endT = this.lastT + this.L + 0.7;
      this.metro = new A.Metronome();
      this.metro.start({ t0: this.t0, spb: this.spb, beatsPerBar: this.bpb, pattern: this.plan.def.metronome || 'all', countInBars: this.countIn, endTime: this.lastT + this.spb * 0.5 });
      this.unsub = [WS.bus.on('noteon', (e) => this.onInput(e)), WS.bus.on('noteoff', (e) => this.onInput(e))];
      this._resize = () => this.resize();
      window.addEventListener('resize', this._resize);
      this.resize();
      this.running = true;
      this.lastFrame = performance.now();
      this.startPerf = performance.now();
      this.hud.setPrompt(0, this);
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }

    stopAll() {
      this.running = false;
      if (this.metro) this.metro.stop();
      (this.unsub || []).forEach((f) => f());
      window.removeEventListener('resize', this._resize);
    }

    quit() {
      this.stopAll();
      this.onQuit && this.onQuit();
    }

    windowIndex(t) {
      for (let i = 0; i < this.downbeats.length; i++) {
        const d = this.downbeats[i];
        if (t >= d - this.E && t <= d + this.L) return i;
        if (t < d - this.E) return -1;
      }
      return -1;
    }

    currentIndex() {
      for (let i = 0; i < this.prompts.length; i++) if (!this.results[i] && !this.matches[i]) return i;
      return this.prompts.length;
    }

    onInput(e) {
      if (!this.running) return;
      const notes = WS.input.notes();
      const t = A.perfToHeard(e.t) - this.cal;
      const i = this.windowIndex(t);
      if (i < 0) {
        const k = this.currentIndex();
        if (k < this.prompts.length && t < this.downbeats[k] - this.E && T.matches(this.prompts[k], notes)) this.early[k] = true;
        return;
      }
      if (this.results[i]) return;
      if (notes.length) this.snap[i] = notes.slice();
      if (this.matches[i] || !T.matches(this.prompts[i], notes)) return;
      const lastStrike = Math.max(...notes.map((n) => WS.input.strikeTime(n)));
      const onset = A.perfToHeard(lastStrike) - this.cal;
      if (onset < this.downbeats[i] - this.E) { this.early[i] = true; return; }
      this.matches[i] = { t: onset };
      this.onMatch(i, onset);
    }

    onMatch(i, onset) {
      const d = this.downbeats[i];
      const off = onset - d;
      const perfect = Math.abs(off) <= this.P;
      const dur = WS.clamp(0.9 * this.spb, 0.38, 0.7);
      let start = d - dur / 2;
      let len = dur;
      const now = A.heardNow();
      if (start < now) { start = now; len = Math.max(0.3, (d + dur / 2) - now); }
      this.jumps.push({ start, dur: len, i });
      this.combo++;
      this.pop(perfect ? 'Perfect' : off < 0 ? 'Good · early' : 'Good · late', perfect ? COLORS.paper : COLORS.hit, i);
      A.sfx(perfect ? 'perfect' : 'good');
      this.hud.setPrompt(this.currentIndex(), this);
      this.hud.setCombo(this.combo);
    }

    judge(i) {
      const m = this.matches[i];
      const d = this.downbeats[i];
      if (m) {
        const off = (m.t - d) * 1000;
        this.results[i] = { hit: true, perfect: Math.abs(off) <= this.P * 1000, offsetMs: Math.round(off) };
      } else {
        const reason = this.reason(i);
        this.results[i] = { hit: false, reason };
        this.broken[i] = true;
        this.combo = 0;
        this.stumbleAt = A.heardNow();
        this.burst(i);
        this.pop(reason, COLORS.miss, i, true);
        A.sfx('miss');
        this.hud.setCombo(0);
        this.hud.setPrompt(this.currentIndex(), this);
      }
      this.hud.setDot(i, this.results[i]);
    }

    reason(i) {
      const p = this.prompts[i];
      const notes = this.snap[i];
      if (!notes || !notes.length) return this.early[i] ? 'Too early: play it on beat 1' : 'No chord played';
      if (p.kind === 'chord') {
        const have = new Set(notes.map((n) => n % 12));
        const missing = p.pcs.filter((pc) => !have.has(pc)).map((pc) => T.pcIn(pc, p));
        const extra = [...have].filter((pc) => !p.pcs.includes(pc)).map((pc) => T.FLAT[pc]);
        const parts = [];
        if (missing.length) parts.push(`Missing ${missing.join(', ')}`);
        if (extra.length) parts.push(`Extra ${extra.join(', ')}`);
        if (parts.length) return parts.join(' · ');
        return this.early[i] ? 'Too early: play it on beat 1' : 'Late';
      }
      if (notes.length !== 2) return `Two keys only: ${p.hint}`;
      const [lo, hi] = notes;
      if (lo % 12 !== p.root) return `Root ${p.rootName} goes on the bottom`;
      if (hi % 12 !== p.guidePc) return `Top note is the ${p.use7 ? '7th' : '3rd'}: ${p.guideName}`;
      if (hi >= 60) return 'Keep it below middle C';
      return this.early[i] ? 'Too early: play it on beat 1' : 'Late';
    }

    pop(text, color, i, big) {
      this.pops.push({ text, color, born: performance.now(), x: this.charX + (big ? 0 : 6), y: this.groundY - this.cs * 2.6, big });
      if (this.pops.length > 6) this.pops.shift();
    }

    burst(i) {
      if (this.reduced) return;
      const x = this.charX + this.cs * 0.55;
      const y = this.groundY - this.cs / 2;
      for (let k = 0; k < 18; k++) {
        const a = Math.PI * (0.2 + Math.random() * 1.1);
        const sp = 120 + Math.random() * 260;
        this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp, life: 0.9, age: 0, size: 3 + Math.random() * 6, color: Math.random() < 0.5 ? COLORS.crate : COLORS.crateDark, rot: Math.random() * 6 });
      }
    }

    sparkle(x, y, color) {
      if (this.reduced) return;
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 120;
        this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.6, age: 0, size: 2 + Math.random() * 2.5, color, star: true });
      }
    }

    frame() {
      if (!this.running) return;
      const nowPerf = performance.now();
      const dt = Math.min(0.05, (nowPerf - this.lastFrame) / 1000);
      this.lastFrame = nowPerf;
      const now = A.heardNow();
      for (let i = 0; i < this.prompts.length; i++) {
        if (this.results[i]) continue;
        if (now > this.downbeats[i] + this.L) this.judge(i);
        else break;
      }
      // Count-in display
      const b = (now - this.t0) / this.spb;
      this.hud.setCount(b >= 0 && b < this.bpb * this.countIn ? Math.floor(b) % this.bpb + 1 : b < 0 ? 0 : null);
      this.draw(now, dt);
      if (now > this.endT) { this.finish(); return; }
      requestAnimationFrame(this.frame);
    }

    finish() {
      this.stopAll();
      const n = this.prompts.length;
      const hits = this.results.filter((r) => r && r.hit).length;
      const perfects = this.results.filter((r) => r && r.perfect).length;
      const offs = this.results.filter((r) => r && r.hit).map((r) => r.offsetMs);
      const meanOffsetMs = offs.length ? Math.round(offs.reduce((a, b) => a + b, 0) / offs.length) : null;
      const misses = this.results.map((r, i) => (r && !r.hit ? { sym: this.prompts[i].sym, hint: this.prompts[i].hint || '', reason: r.reason } : null)).filter(Boolean);
      const durationSec = (performance.now() - this.startPerf) / 1000;
      this.onDone({ n, hits, perfects, results: this.results, misses, meanOffsetMs, durationSec });
    }

    /* ---------------- Drawing ---------------- */
    worldX(t, now) { return this.charX + (t - now) * this.pxPerSec; }

    draw(now, dt) {
      const g = this.g;
      const { W, H } = this;
      const scroll = (now - this.t0) * this.pxPerSec;
      g.fillStyle = this.skyGrad;
      g.fillRect(0, 0, W, this.groundY);

      // Stars
      for (const s of this.starsBg) {
        const tw = this.reduced ? 0.8 : 0.55 + 0.45 * Math.sin(now * 1.3 + s.p);
        g.globalAlpha = 0.35 + 0.5 * tw;
        g.fillStyle = '#E8E6DC';
        g.fillRect(s.x * W, s.y * this.groundY, s.s, s.s);
      }
      g.globalAlpha = 1;

      // Moon, for Clair de Lune
      const mx = W * 0.78, my = H * 0.19, mr = Math.max(26, H * 0.075);
      const glow = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 3.2);
      glow.addColorStop(0, 'rgba(218,215,205,0.26)');
      glow.addColorStop(1, 'rgba(218,215,205,0)');
      g.fillStyle = glow;
      g.fillRect(mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4);
      g.fillStyle = '#EDEBE3';
      g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(163,177,138,0.35)';
      g.beginPath(); g.arc(mx - mr * 0.3, my - mr * 0.15, mr * 0.18, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.12, 0, Math.PI * 2); g.fill();

      // Far hills (slow parallax)
      this.hills(scroll * 0.06, this.groundY - H * 0.18, H * 0.06, COLORS.hillFar, 0.004, 1.7);
      this.hills(scroll * 0.14, this.groundY - H * 0.1, H * 0.05, COLORS.hillNear, 0.007, 0.6);

      // Pines
      const pw = 36 * 46;
      const poff = (scroll * 0.32) % pw;
      g.fillStyle = COLORS.pine;
      for (const rep of [0, 1, 2]) {
        for (const p of this.pines) {
          const x = p.x - poff + rep * pw - pw * 0.2;
          if (x < -60 || x > W + 60) continue;
          const base = this.groundY - 2;
          g.beginPath();
          g.moveTo(x, base - p.h * this.u);
          g.lineTo(x + p.w * this.u * 0.5, base);
          g.lineTo(x - p.w * this.u * 0.5, base);
          g.closePath();
          g.fill();
        }
      }

      // The shed you start from
      this.shed(this.worldX(this.t0 - 2.2 * this.spb, now));

      // Lake under the boardwalk, with the moon's reflection
      const gy = this.groundY;
      const lakeTop = gy + 24;
      const lake = g.createLinearGradient(0, lakeTop, 0, H);
      lake.addColorStop(0, '#1B2B23');
      lake.addColorStop(1, '#0C1410');
      g.fillStyle = lake;
      g.fillRect(0, lakeTop, W, H - lakeTop);
      const rows = Math.floor((H - lakeTop - 10) / 7);
      for (let k = 0; k < rows; k++) {
        const y = lakeTop + 12 + k * 7;
        const wob = this.reduced ? 0 : Math.sin(now * 1.6 + k * 0.9) * 5;
        const w = mr * (0.7 + k * 0.05) * (0.45 + 0.55 * Math.abs(Math.sin(k * 1.7 + (this.reduced ? 0 : now * 0.7))));
        g.globalAlpha = Math.max(0, 0.3 - k * 0.011);
        g.fillStyle = '#DAD7CD';
        g.fillRect(mx - w / 2 + wob, y, w, 2);
      }
      g.globalAlpha = 1;

      // Boardwalk: one plank per beat, a post on every bar line
      g.fillStyle = COLORS.plank;
      g.fillRect(0, gy, W, 24);
      g.fillStyle = COLORS.plankTop;
      g.fillRect(0, gy, W, 4);
      g.fillStyle = COLORS.plankDark;
      g.fillRect(0, gy + 20, W, 4);
      const firstBeat = Math.floor((now - this.t0) / this.spb) - 6;
      const beatsVisible = Math.ceil(W / this.pxPerBeat) + 8;
      for (let k = firstBeat; k < firstBeat + beatsVisible; k++) {
        const x = this.worldX(this.t0 + k * this.spb, now);
        if (x < -10 || x > W + 10) continue;
        const bar = ((k % this.bpb) + this.bpb) % this.bpb === 0;
        g.fillStyle = bar ? '#B8956A' : COLORS.plankDark;
        g.fillRect(Math.round(x) - (bar ? 2 : 1), gy, bar ? 4 : 2, 24);
        if (bar) {
          g.fillStyle = '#4A3A28';
          g.fillRect(Math.round(x) - 3, gy + 24, 6, 18 * this.u);
        }
      }

      // Crates on each downbeat
      for (let i = 0; i < this.prompts.length; i++) {
        if (this.broken[i]) continue;
        const x = this.worldX(this.downbeats[i], now);
        if (x < -this.cs * 2 || x > W + this.cs * 2) continue;
        this.crate(x, gy, this.prompts[i], this.results[i] || (this.matches[i] ? { hit: true } : null));
      }

      // Character
      this.runner(now);

      // Particles
      for (const p of this.parts) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.star ? 200 : 900) * dt;
        const a = Math.max(0, 1 - p.age / p.life);
        g.globalAlpha = a;
        g.fillStyle = p.color;
        if (p.star) { g.beginPath(); g.arc(p.x, p.y, p.size, 0, Math.PI * 2); g.fill(); }
        else { g.save(); g.translate(p.x, p.y); g.rotate(p.rot + p.age * 8); g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); g.restore(); }
      }
      g.globalAlpha = 1;
      this.parts = this.parts.filter((p) => p.age < p.life);

      // Pop-up words
      const pn = performance.now();
      for (const p of this.pops) {
        const age = (pn - p.born) / 1000;
        const life = p.big ? 1.6 : 0.9;
        if (age > life) continue;
        const a = Math.max(0, 1 - age / life);
        g.globalAlpha = a;
        g.fillStyle = p.color;
        g.textAlign = 'center';
        g.font = `700 ${Math.round((p.big ? 20 : 26) * this.u)}px Kalam, "Marker Felt", cursive`;
        g.fillText(p.text, p.x, p.y - age * 36);
      }
      g.globalAlpha = 1;
      g.textAlign = 'left';
    }

    hills(off, baseY, amp, color, freq, phase) {
      const g = this.g;
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, this.groundY);
      for (let x = 0; x <= this.W + 8; x += 8) {
        const X = x + off;
        const y = baseY + Math.sin(X * freq + phase) * amp + Math.sin(X * freq * 2.3 + phase * 2) * amp * 0.4;
        g.lineTo(x, y);
      }
      g.lineTo(this.W, this.groundY);
      g.closePath();
      g.fill();
    }

    shed(x) {
      if (x < -200 || x > this.W + 200) return;
      const g = this.g;
      const u = this.u;
      const w = 120 * u, h = 84 * u, gy = this.groundY;
      g.fillStyle = '#3A5A40';
      g.fillRect(x - w / 2, gy - h, w, h);
      g.fillStyle = '#26392D';
      g.beginPath();
      g.moveTo(x - w / 2 - 10 * u, gy - h);
      g.lineTo(x, gy - h - 46 * u);
      g.lineTo(x + w / 2 + 10 * u, gy - h);
      g.closePath();
      g.fill();
      // planks
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.lineWidth = 1;
      for (let k = 1; k < 6; k++) { g.beginPath(); g.moveTo(x - w / 2 + (k * w) / 6, gy - h); g.lineTo(x - w / 2 + (k * w) / 6, gy); g.stroke(); }
      // lit window
      const wx = x + w * 0.12, wy = gy - h * 0.72, ww = 30 * u, wh = 24 * u;
      const lamp = g.createRadialGradient(wx + ww / 2, wy + wh / 2, 2, wx + ww / 2, wy + wh / 2, 70 * u);
      lamp.addColorStop(0, 'rgba(255,190,110,0.35)');
      lamp.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lamp;
      g.fillRect(wx - 70 * u, wy - 70 * u, ww + 140 * u, wh + 140 * u);
      g.fillStyle = '#E9C46A';
      g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#3A5A40';
      g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      g.fillRect(wx, wy + wh / 2 - 1, ww, 2);
      // door
      g.fillStyle = '#1E2C25';
      g.fillRect(x - w * 0.36, gy - h * 0.62, w * 0.24, h * 0.62);
    }

    crate(x, gy, prompt, res) {
      const g = this.g;
      const s = this.cs;
      const left = x - s / 2, top = gy - s;
      g.fillStyle = COLORS.crate;
      g.fillRect(left, top, s, s);
      g.strokeStyle = COLORS.crateDark;
      g.lineWidth = 3;
      g.strokeRect(left + 1.5, top + 1.5, s - 3, s - 3);
      g.beginPath();
      g.moveTo(left + 4, top + 4); g.lineTo(left + s - 4, top + s - 4);
      g.moveTo(left + s - 4, top + 4); g.lineTo(left + 4, top + s - 4);
      g.lineWidth = 2;
      g.stroke();
      // Paper label with the chord name
      const lw = s * 1.5, lh = s * 0.62;
      const lx = x - lw / 2, ly = top - lh * 0.55;
      g.fillStyle = res && res.hit ? '#D3E4C6' : COLORS.label;
      g.beginPath();
      if (g.roundRect) g.roundRect(lx, ly, lw, lh, 6); else g.rect(lx, ly, lw, lh);
      g.fill();
      g.strokeStyle = 'rgba(30,44,37,0.25)';
      g.lineWidth = 1;
      g.stroke();
      let size = lh * 0.78;
      const w = WS.measureSym(g, prompt.sym, size);
      if (w > lw * 0.86) size *= (lw * 0.86) / w;
      WS.drawSym(g, prompt.sym, x, ly + lh * 0.76, size, COLORS.ink);
    }

    runner(now) {
      const g = this.g;
      const u = this.u * 1.15;
      const x = this.charX;
      let lift = 0;
      let airborne = false;
      for (const j of this.jumps) {
        const p = (now - j.start) / j.dur;
        if (p >= 0 && p <= 1) {
          lift = Math.max(lift, 4 * p * (1 - p) * this.cs * 1.55);
          airborne = true;
          if (!j.sparked && p > 0.45) {
            j.sparked = true;
            const m = this.matches[j.i];
            const perfect = m && Math.abs(m.t - this.downbeats[j.i]) <= this.P;
            this.sparkle(x, this.groundY - this.cs - lift, perfect ? '#EDEBE3' : COLORS.hit);
          }
        }
      }
      const running = now >= this.t0;
      const phase = running ? ((now - this.t0) / this.spb) % 1 : 0;
      const stumbling = this.stumbleAt > 0 && now - this.stumbleAt < 0.35;
      const bob = running && !airborne ? Math.abs(Math.sin(phase * Math.PI)) * 3 * u : 0;
      const footY = this.groundY - lift;
      const hipY = footY - 16 * u - bob;
      g.save();
      if (stumbling) { g.translate(x, footY); g.rotate(-0.35); g.translate(-x, -footY); }
      // legs: step on each beat
      g.strokeStyle = '#1E2C25';
      g.lineWidth = 4.5 * u;
      g.lineCap = 'round';
      const swing = airborne ? 0.9 : running ? Math.sin(phase * Math.PI * 2) * 0.6 : 0;
      for (const sgn of [1, -1]) {
        const a = sgn * swing;
        g.beginPath();
        g.moveTo(x, hipY);
        g.lineTo(x + Math.sin(a) * 14 * u, hipY + (airborne ? 9 : 16) * u * Math.cos(a * 0.5));
        g.stroke();
      }
      // body
      const bw = 34 * u, bh = 38 * u;
      g.fillStyle = stumbling ? '#FFD9D3' : COLORS.paper;
      g.beginPath();
      if (g.roundRect) g.roundRect(x - bw / 2, hipY - bh, bw, bh, 12 * u); else g.rect(x - bw / 2, hipY - bh, bw, bh);
      g.fill();
      // scarf
      g.fillStyle = COLORS.moon;
      g.fillRect(x - bw / 2, hipY - bh * 0.58, bw, 6 * u);
      const flutter = this.reduced ? 0 : Math.sin(now * 12) * 3 * u;
      g.beginPath();
      g.moveTo(x - bw / 2 + 2 * u, hipY - bh * 0.58);
      g.quadraticCurveTo(x - bw / 2 - 14 * u, hipY - bh * 0.52 + flutter, x - bw / 2 - 22 * u, hipY - bh * 0.4 + flutter);
      g.lineTo(x - bw / 2 - 18 * u, hipY - bh * 0.32 + flutter);
      g.quadraticCurveTo(x - bw / 2 - 8 * u, hipY - bh * 0.42, x - bw / 2 + 2 * u, hipY - bh * 0.48);
      g.closePath();
      g.fill();
      // eye
      g.fillStyle = '#1E2C25';
      g.beginPath(); g.arc(x + bw * 0.18, hipY - bh * 0.78, 4.2 * u, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#FFFFFF';
      g.beginPath(); g.arc(x + bw * 0.18 + 1.4 * u, hipY - bh * 0.8, 1.4 * u, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }

  WS.ChordRunner = ChordRunner;
})();
