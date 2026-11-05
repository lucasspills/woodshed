/* Sampled instruments, and the shared path every sound in Play goes through.

   Each instrument is a set of recordings: one file per sampled note and velocity band, made by
   tools/make_sounds.py and listed in WS.ZONES (inlined by build.py). Files load on demand from sounds/<id>/,
   and the service worker keeps them on this Mac after the first time.

   Velocity: the touch curve maps key velocity to 0..1, which picks two neighbouring bands and blends them
   with an equal-power crossfade, plus a little gain inside a band.

   Latency choices (unchanged from 0.2):
   - Play has its own path straight to the speakers. It skips the shared compressor, which looks ahead a few
     milliseconds; a zero-latency soft clipper keeps loud chords from distorting instead.
   - Every sample starts at its real attack: the near-silence before the hammer is trimmed at decode time.
   - Notes start at currentTime: nothing is scheduled ahead. */
(function () {
  const A = WS.audio;
  const CURVES = { light: 0.7, normal: 1, heavy: 1.45 };

  /* ---------- The shared output: dry + reverb, volume, soft clipper ---------- */
  const O = (WS.out = { bus: null, preset: null });

  const softClip = (c) => {
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      // linear up to 0.6, then a smooth knee into 1.0
      const ax = Math.abs(x);
      const y = ax < 0.6 ? ax : 0.6 + 0.4 * Math.tanh((ax - 0.6) / 0.4);
      curve[i] = Math.sign(x) * y;
    }
    const ws = c.createWaveShaper();
    ws.curve = curve;
    ws.oversample = 'none';
    return ws;
  };

  /* Generated impulse responses. Room: a small studio, short and fairly bright. Hall: a concert hall,
     longer, darker, with a short gap before the reverb so the attack stays clear. */
  const ROOMS = {
    room: { seconds: 1.3, decay: 4.6, early: [0.009, 0.015, 0.023, 0.031], predelay: 0, dark: 0.45, wet: 0.6 },
    hall: { seconds: 3.4, decay: 1.9, early: [0.019, 0.031, 0.047, 0.063, 0.081], predelay: 0.022, dark: 0.5, wet: 0.42 },
  };
  O.ROOMS = ROOMS;
  const impulses = {};
  const impulse = (c, name) => {
    if (impulses[name]) return impulses[name];
    const p = ROOMS[name];
    const len = Math.round(c.sampleRate * p.seconds);
    const ir = c.createBuffer(2, len, c.sampleRate);
    const rnd = WS.rng(name === 'hall' ? 1977 : 42);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / c.sampleRate;
        // a few early reflections, then a darkening exponential tail
        const early = p.early.some((e) => Math.abs(t - e - ch * 0.003) < 0.0004) ? 0.5 : 0;
        const noise = rnd() * 2 - 1;
        lp += (noise - lp) * Math.max(0.04, 0.55 - p.dark * Math.min(1, t / p.seconds));
        const tt = Math.max(0, t - p.predelay);
        const tail = t < p.predelay ? 0 : lp * Math.exp(-tt * p.decay);
        d[i] = (tail + early) * (tt < 0.008 ? tt / 0.008 : 1);
      }
    }
    impulses[name] = ir;
    return ir;
  };

  O.ensure = function () {
    const c = A.ensure();
    if (!c) return null;
    if (O.bus) return c;
    O.bus = c.createGain();
    O.out = c.createGain();
    O.dry = c.createGain();
    O.wet = c.createGain();
    O.verb = c.createConvolver();
    O.clip = softClip(c);
    O.bus.connect(O.dry).connect(O.out);
    O.bus.connect(O.verb).connect(O.wet).connect(O.out);
    O.out.connect(O.clip).connect(c.destination);
    O.apply();
    return c;
  };

  O.apply = function () {
    if (!O.bus) return;
    const s = WS.S().settings;
    const t = A.ctx.currentTime;
    O.out.gain.setTargetAtTime(s.pianoVol, t, 0.02);
    // The dry signal stays at full level so the attack never softens
    O.dry.gain.setTargetAtTime(1, t, 0.02);
    const room = ROOMS[s.reverb] ? s.reverb : null;
    if (room && O.preset !== room) { O.verb.buffer = impulse(A.ctx, room); O.preset = room; }
    O.wet.gain.setTargetAtTime(room ? s.pianoRoom * ROOMS[room].wet : 0, t, 0.02);
  };

  /* ---------- Loading helpers ---------- */
  const attackOffset = (buf) => {
    const ch = buf.getChannelData(0);
    const ch2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch;
    const lim = Math.min(ch.length, Math.round(buf.sampleRate * 0.08));
    let peak = 0;
    for (let i = 0; i < lim; i++) peak = Math.max(peak, Math.abs(ch[i]), Math.abs(ch2[i]));
    const thr = peak * 0.02;
    for (let i = 0; i < lim; i++) {
      if (Math.abs(ch[i]) > thr || Math.abs(ch2[i]) > thr) return Math.max(0, (i - Math.round(buf.sampleRate * 0.0015)) / buf.sampleRate);
    }
    return 0;
  };
  WS.soundUrl = (id, file) => `sounds/${id}/${file}?v=${(WS.SOUND_VERSION || {})[id] || '1'}`;

  /* ---------- A sampled instrument ---------- */
  class Sampler {
    constructor(def) {
      this.def = def;
      this.id = def.id;
      this.zones = (WS.ZONES || {})[def.id] || null;
      this.bands = this.zones ? this.zones.bands : 0;
      this.status = 'idle';     // idle | loading | ready | error
      this.loaded = 0;
      this.total = 0;
      this.layersReady = [];    // bands decoded so far
      this.pedalDown = false;
      this._bufs = {};          // band -> root midi -> { buf, off, tune }
      this.roots = {};          // band -> sorted roots
      this.voices = new Map();  // midi -> [voice]
      this.all = [];            // every live voice, oldest first
      this.bytes = 0;           // decoded size, for the memory budget
      this.out = null;
    }

    available() { return !!(this.zones && Object.keys(this.zones.files).length); }
    ready() { return this.status === 'ready'; }

    connect() {
      const c = O.ensure();
      if (!c) return null;
      if (!this.out) {
        this.out = c.createGain();
        this.out.gain.value = Math.pow(10, (this.def.trim || 0) / 20);
        this.out.connect(O.bus);
      }
      return c;
    }

    load() {
      if (this.status === 'loading' || this.status === 'ready') return this._loading;
      if (!this.available()) { this.status = 'error'; WS.bus.emit('sound', this); return Promise.resolve(); }
      const c = this.connect();
      if (!c) { this.status = 'error'; WS.bus.emit('sound', this); return Promise.resolve(); }
      this.status = 'loading';
      const files = this.zones.files;
      const bands = Object.keys(files).map(Number).sort((a, b) => a - b);
      // Middle band first, so the whole keyboard plays as soon as possible; then the rest, softest first
      const mid = bands[Math.floor((bands.length - 1) / 2)];
      const order = [mid, ...bands.filter((b) => b !== mid)];
      const jobs = [];
      for (const b of order) for (const [root, z] of Object.entries(files[b])) jobs.push({ b, root: Number(root), z });
      this.total = jobs.length;
      this.loaded = 0;
      WS.bus.emit('sound', this);
      const decoded = new Map();   // the same file can serve two bands
      const getBuf = (f) => {
        if (!decoded.has(f)) {
          decoded.set(f, fetch(WS.soundUrl(this.id, f))
            .then((r) => { if (!r.ok) throw new Error(`${r.status} for ${f}`); return r.arrayBuffer(); })
            .then((ab) => c.decodeAudioData(ab))
            .then((buf) => { this.bytes += buf.length * buf.numberOfChannels * 4; return { buf, off: attackOffset(buf) }; }));
        }
        return decoded.get(f);
      };
      this._loading = (async () => {
        try {
          for (const b of order) {
            const mine = jobs.filter((j) => j.b === b);
            for (let i = 0; i < mine.length; i += 6) {
              await Promise.all(mine.slice(i, i + 6).map(async (j) => {
                const s = await getBuf(j.z.f);
                (this._bufs[b] = this._bufs[b] || {})[j.root] = { buf: s.buf, off: s.off, tune: j.z.tune || 0 };
                this.loaded++;
              }));
              WS.bus.emit('sound', this);
            }
            this.layersReady.push(b);
            this.roots[b] = Object.keys(this._bufs[b]).map(Number).sort((x, y) => x - y);
            if (b === order[0]) { this.status = 'ready'; WS.bus.emit('sound', this); }
          }
          WS.bus.emit('sound', this);
        } catch (err) {
          console.error(`${this.def.name} failed to load`, err);
          if (!this.layersReady.length) this.status = 'error';
          this.failed = true;
          WS.bus.emit('sound', this);
        }
      })();
      return this._loading;
    }

    /* Free the decoded audio (the files stay cached on disk). */
    unload() {
      this.allOff();
      this._bufs = {};
      this.roots = {};
      this.layersReady = [];
      this.status = 'idle';
      this.loaded = 0;
      this.bytes = 0;
      this._loading = null;
    }

    /* ---------- Velocity ---------- */
    touch(vel) {
      const k = CURVES[WS.S().settings.pianoTouch] || 1;
      return Math.pow(WS.clamp(vel, 1, 127) / 127, k);
    }
    // Which bands to blend, and how much of each (equal-power crossfade)
    layerMix(x) {
      const have = this.layersReady.slice().sort((a, b) => a - b);
      if (!have.length) return [];
      if (have.length === 1 || this.bands === 1) return [[have[0], 1]];
      const pos = x * (this.bands - 1);
      const lo = Math.floor(pos);
      const hi = Math.min(this.bands - 1, lo + 1);
      const f = pos - lo;
      const pick = (i) => (have.includes(i) ? i : have.reduce((b, l) => (Math.abs(l - i) < Math.abs(b - i) ? l : b), have[0]));
      const a = pick(lo), b = pick(hi);
      if (a === b || f < 0.02) return [[a, 1]];
      return [[a, Math.cos(f * Math.PI / 2)], [b, Math.sin(f * Math.PI / 2)]];
    }

    nearestRoot(band, n) {
      const roots = this.roots[band] || [];
      let best = roots[0];
      for (const r of roots) if (Math.abs(r - n) < Math.abs(best - n)) best = r;
      return best;
    }

    /* ---------- Voices ---------- */
    fadeVoice(v, tau, t) {
      if (v.dead) return;
      v.dead = true;
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setValueAtTime(v.g.gain.value, t);
      v.g.gain.setTargetAtTime(0, t, tau);
      for (const s of v.srcs) { try { s.stop(t + tau * 8); } catch (e) { /* already stopped */ } }
    }
    drop(v) {
      this.all = this.all.filter((x) => x !== v);
      const list = this.voices.get(v.n);
      if (list) {
        const rest = list.filter((x) => x !== v);
        if (rest.length) this.voices.set(v.n, rest); else this.voices.delete(v.n);
      }
    }

    noteOn(n, vel, level = 1) {
      if (!this.ready()) return false;
      const d = this.def;
      if (d.range && (n < d.range[0] || n > d.range[1])) return false;
      const c = A.ctx;
      if (c.state === 'suspended') c.resume();
      const t = c.currentTime;
      // Re-striking a key damps the string that's still ringing
      for (const old of this.voices.get(n) || []) this.fadeVoice(old, 0.06, t);
      // Voice stealing: release the oldest notes first
      while (this.all.length >= (d.maxVoices || 72)) { const v = this.all[0]; this.fadeVoice(v, 0.03, t); this.drop(v); }

      const x = this.touch(vel);
      const g = c.createGain();
      // The bands carry most of the dynamics; this adds the rest within a band
      const minG = d.minGain == null ? 0.42 : d.minGain;
      g.gain.value = (minG + (1 - minG) * x) * level;
      g.connect(this.out);
      const srcs = [];
      for (const [band, w] of this.layerMix(x)) {
        const root = this.nearestRoot(band, n);
        const s = this._bufs[band] && this._bufs[band][root];
        if (!s) continue;
        const src = c.createBufferSource();
        src.buffer = s.buf;
        src.playbackRate.value = Math.pow(2, (n - root + s.tune / 100) / 12);
        let dest = g;
        if (w < 0.999) { const wg = c.createGain(); wg.gain.value = w; wg.connect(g); dest = wg; }
        src.connect(dest);
        src.start(t, s.off);
        srcs.push(src);
      }
      if (!srcs.length) { g.disconnect(); return false; }
      const v = { n, g, srcs, held: true, dead: false, born: t };
      srcs[0].onended = () => { this.drop(v); try { g.disconnect(); } catch (e) { /* ok */ } };
      this.all.push(v);
      this.voices.set(n, [...(this.voices.get(n) || []).filter((o) => !o.dead), v]);
      return true;
    }

    release(v, t) {
      const from = this.def.noDamperFrom;
      if (from && v.n >= from) return;             // undamped strings ring out on their own
      this.fadeVoice(v, this.def.releaseTau || 0.09, t); // a felt damper: quick but not a click
    }

    noteOff(n) {
      const list = this.voices.get(n);
      if (!list || !A.ctx) return;
      const t = A.ctx.currentTime;
      for (const v of list) {
        v.held = false;
        if (!this.pedalDown) this.release(v, t);
      }
    }

    pedal(down) {
      if (this.def.pedal === false) return;
      this.pedalDown = down;
      if (down || !A.ctx) return;
      const t = A.ctx.currentTime;
      for (const v of this.all) if (!v.held && !v.dead) this.release(v, t);
    }

    allOff() {
      if (!A.ctx) return;
      const t = A.ctx.currentTime;
      for (const v of this.all) this.fadeVoice(v, 0.05, t);
      this.pedalDown = false;
    }

    voiceCount() { return this.all.filter((v) => !v.dead).length; }
    sustainedNotes() {
      const from = this.def.noDamperFrom || 999;
      return [...new Set(this.all.filter((v) => !v.dead && !v.held && v.n < from).map((v) => v.n))];
    }
  }

  WS.Sampler = Sampler;

  /* Latency the browser reports for the audio path, in ms. */
  WS.audioLatency = function () {
    const c = A.ctx;
    if (!c) return null;
    const base = (c.baseLatency || 0) * 1000;
    const out = (c.outputLatency || 0) * 1000;
    return { base, out, total: base + out, rate: c.sampleRate };
  };
})();
