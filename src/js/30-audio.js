/* Audio: one AudioContext, a shared "heard time" clock, a lookahead metronome, small sound effects, a simple synth. */
(function () {
  const A = (WS.audio = { ctx: null });

  A.ensure = function () {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      // 'lowest' asks Chrome for its smallest output buffer; 'safe' is a little larger if the sound crackles
      const lat = WS.S().settings.audioLatency === 'safe' ? 'interactive' : 0;
      try { this.ctx = new Ctx({ latencyHint: lat }); } catch (e) { this.ctx = new Ctx({ latencyHint: 'interactive' }); }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      this.metroGain = this.ctx.createGain();
      this.metroGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.synthGain = this.ctx.createGain();
      this.synthGain.gain.value = 0.32;
      this.synthGain.connect(this.master);
      this.applySettings();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  };

  A.applySettings = function () {
    const s = WS.S().settings;
    if (this.metroGain) this.metroGain.gain.value = s.metroVol;
    if (this.sfxGain) this.sfxGain.gain.value = s.sfx ? 0.4 : 0;
  };

  A.outLat = function () {
    const c = this.ctx;
    if (!c) return 0;
    return (c.outputLatency || 0) + (c.baseLatency || 0);
  };

  // Map of the audio clock to the performance clock, refreshed each frame.
  // "Heard time" is the audio-clock time of the sound reaching the speakers right now.
  A._stamp = function () {
    const c = this.ctx;
    if (c && c.getOutputTimestamp) {
      const ts = c.getOutputTimestamp();
      if (ts && ts.performanceTime > 0 && ts.contextTime > 0) return ts;
    }
    return { contextTime: c.currentTime - this.outLat(), performanceTime: performance.now() };
  };
  A.heardNow = function () {
    if (!this.ctx) return 0;
    const ts = this._stamp();
    return ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
  };
  A.perfToHeard = function (perfMs) {
    const ts = this._stamp();
    return ts.contextTime + (perfMs - ts.performanceTime) / 1000;
  };
  A.heardToPerf = function (t) {
    const ts = this._stamp();
    return ts.performanceTime + (t - ts.contextTime) * 1000;
  };

  /* Woodblock-style click */
  A.click = function (t, accent) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = 'triangle';
    o.frequency.setValueAtTime(accent ? 1500 : 1100, t);
    o.frequency.exponentialRampToValueAtTime(accent ? 900 : 700, t + 0.05);
    f.type = 'bandpass';
    f.frequency.value = accent ? 1400 : 1000;
    f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 1.0 : 0.7, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(f).connect(g).connect(this.metroGain);
    o.start(t);
    o.stop(t + 0.09);
  };

  const tone = (freq, t, dur, type, peak, dest) => {
    const c = A.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  };

  A.sfx = function (kind) {
    if (!this.ctx || !WS.S().settings.sfx) return;
    const t = this.ctx.currentTime + 0.005;
    const d = this.sfxGain;
    if (kind === 'perfect') { tone(1568, t, 0.18, 'sine', 0.25, d); tone(2093, t + 0.05, 0.22, 'sine', 0.18, d); }
    else if (kind === 'good') tone(1175, t, 0.14, 'sine', 0.2, d);
    else if (kind === 'miss') { tone(140, t, 0.22, 'sine', 0.5, d); tone(98, t + 0.03, 0.25, 'triangle', 0.3, d); }
    else if (kind === 'silver') [784, 988, 1175].forEach((f, i) => tone(f, t + i * 0.09, 0.35, 'triangle', 0.25, d));
    else if (kind === 'gold') [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.1, 0.6, 'sine', 0.3, d));
  };

  /* Play a note in the app.
     On the Play screen the rig decides (one sound, a split or a layer). Everywhere else it's the grand piano
     once it has loaded, and the simple synth until then. */
  A.playNote = function (n, vel) {
    if (!this.ensure()) return;
    if (WS.rig && WS.rig.active) { if (WS.rig.noteOn(n, vel)) return; this.noteOn(n, vel); return; }
    const P = WS.piano;
    if (P && P.available()) {
      if (P.status === 'idle') P.load();
      if (P.ready() && P.noteOn(n, vel)) return;
    }
    this.noteOn(n, vel);
  };
  A.stopNote = function (n) {
    if (WS.rig) WS.rig.noteOff(n);
    if (WS.piano) WS.piano.noteOff(n);
    this.noteOff(n);
  };
  A.pedal = function (down) {
    if (WS.rig && WS.rig.active) WS.rig.pedal(down);
    else if (WS.piano) WS.piano.pedal(down);
  };

  /* Simple voice for computer-keyboard notes (fallback while the piano loads) */
  const voices = new Map();
  A.noteOn = function (n, vel) {
    const c = this.ensure();
    if (!c) return;
    this.noteOff(n);
    const t = c.currentTime;
    const f = 440 * Math.pow(2, (n - 69) / 12);
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const lp = c.createBiquadFilter();
    const g = c.createGain();
    o1.type = 'triangle'; o1.frequency.value = f;
    o2.type = 'sine'; o2.frequency.value = f * 2; o2.detune.value = 3;
    lp.type = 'lowpass'; lp.frequency.value = 2600;
    const peak = 0.25 + 0.35 * (vel / 127);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.6);
    o1.connect(lp); o2.connect(lp); lp.connect(g).connect(this.synthGain);
    o1.start(t); o2.start(t);
    voices.set(n, { o1, o2, g });
  };
  A.noteOff = function (n) {
    const v = voices.get(n);
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(Math.max(v.g.gain.value, 0.0001), t);
    v.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    v.o1.stop(t + 0.3); v.o2.stop(t + 0.3);
    voices.delete(n);
  };

  /* Lookahead metronome (Chris Wilson's "tale of two clocks" pattern: 25 ms timer, 100 ms horizon). */
  A.Metronome = class {
    start({ t0, spb, beatsPerBar = 4, pattern = 'all', countInBars = 1, endTime = Infinity }) {
      Object.assign(this, { t0, spb, bpb: beatsPerBar, pattern, countIn: countInBars, end: endTime, next: 0 });
      this.timer = setInterval(() => this.tick(), 25);
      this.tick();
    }
    tick() {
      const c = A.ctx;
      const horizon = c.currentTime + 0.1;
      for (;;) {
        const t = this.t0 + this.next * this.spb;
        if (t > horizon || t > this.end) break;
        const beat = this.next % this.bpb;
        const inCount = Math.floor(this.next / this.bpb) < this.countIn;
        let play = true;
        if (!inCount && this.pattern === '24') play = beat === 1 || beat === 3;
        if (!inCount && this.pattern === 'none') play = false;
        if (play && t >= c.currentTime - 0.005) A.click(t, beat === 0 && (inCount || this.pattern === 'all'));
        this.next++;
      }
    }
    stop() { clearInterval(this.timer); this.timer = null; }
  };
})();
