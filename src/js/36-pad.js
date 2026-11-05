/* Synth Pad: a warm analog-style pad generated live with Web Audio, so there's nothing to download.
   Per voice: two detuned saws and a sine an octave down, through a low-pass filter that opens with
   velocity, and a slow attack and long release. A shared slow LFO drifts the detune for a chorus feel.
   Same interface as WS.Sampler, so the rig treats it like any other instrument. */
(function () {
  const A = WS.audio;
  const CURVES = { light: 0.7, normal: 1, heavy: 1.45 };

  class PadSynth {
    constructor(def) {
      this.def = def;
      this.id = def.id;
      this.status = 'idle';
      this.loaded = 0;
      this.total = 0;
      this.layersReady = [0];
      this.bands = 1;
      this.pedalDown = false;
      this.voices = new Map();
      this.all = [];
      this.bytes = 0;
      this.out = null;
    }

    available() { return true; }
    ready() { return this.status === 'ready'; }

    load() {
      const c = WS.out.ensure();
      if (!c) { this.status = 'error'; WS.bus.emit('sound', this); return Promise.resolve(); }
      if (!this.out) {
        this.out = c.createGain();
        this.out.gain.value = Math.pow(10, (this.def.trim || 0) / 20);
        // Gentle low shelf cut and high cut, so it sits under a piano instead of on top of it
        const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
        const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = 0.5;
        this.out.connect(hp).connect(tone).connect(WS.out.bus);
        this.lfo = c.createOscillator();
        this.lfo.frequency.value = 0.23;
        this.lfoDepth = c.createGain();
        this.lfoDepth.gain.value = 6;            // cents
        this.lfo.connect(this.lfoDepth);
        this.lfo.start();
      }
      this.status = 'ready';
      WS.bus.emit('sound', this);
      return Promise.resolve();
    }
    unload() { this.allOff(); }

    touch(vel) {
      const k = CURVES[WS.S().settings.pianoTouch] || 1;
      return Math.pow(WS.clamp(vel, 1, 127) / 127, k);
    }

    kill(v, tau, t) {
      if (v.dead) return;
      v.dead = true;
      v.amp.gain.cancelScheduledValues(t);
      v.amp.gain.setValueAtTime(Math.max(v.amp.gain.value, 0.0001), t);
      v.amp.gain.setTargetAtTime(0, t, tau);
      for (const o of v.oscs) { try { o.stop(t + tau * 8); } catch (e) { /* ok */ } }
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
      const c = A.ctx;
      const t = c.currentTime;
      for (const old of this.voices.get(n) || []) this.kill(old, 0.08, t);
      while (this.all.length >= (this.def.maxVoices || 24)) { const v = this.all[0]; this.kill(v, 0.05, t); this.drop(v); }
      const x = this.touch(vel);
      const f = 440 * Math.pow(2, (n - 69) / 12);
      const mk = (type, freq, detune, gain) => {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        this.lfoDepth.connect(o.detune);
        const g = c.createGain();
        g.gain.value = gain;
        o.connect(g);
        return { o, g };
      };
      const parts = [mk('sawtooth', f, -7, 0.5), mk('sawtooth', f, 7, 0.5), mk('sine', f / 2, 0, 0.55)];
      const filt = c.createBiquadFilter();
      filt.type = 'lowpass';
      filt.Q.value = 0.8;
      // The filter opens with velocity and blooms a little over the attack
      const cut = Math.min(9000, 380 + 2600 * x + f * 1.5);
      filt.frequency.setValueAtTime(cut * 0.45, t);
      filt.frequency.linearRampToValueAtTime(cut, t + 0.6);
      filt.frequency.setTargetAtTime(cut * 0.8, t + 0.6, 1.5);
      const amp = c.createGain();
      const peak = (0.05 + 0.42 * x) * level;
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.linearRampToValueAtTime(peak, t + 0.16);
      amp.gain.setTargetAtTime(peak * 0.85, t + 0.16, 0.8);
      for (const p of parts) p.g.connect(filt);
      filt.connect(amp).connect(this.out);
      for (const p of parts) p.o.start(t);
      const v = { n, amp, oscs: parts.map((p) => p.o), held: true, dead: false };
      v.oscs[0].onended = () => {
        this.drop(v);
        for (const o of v.oscs) { try { this.lfoDepth.disconnect(o.detune); } catch (e) { /* ok */ } }
        try { amp.disconnect(); } catch (e) { /* ok */ }
      };
      this.all.push(v);
      this.voices.set(n, [...(this.voices.get(n) || []).filter((o) => !o.dead), v]);
      return true;
    }

    noteOff(n) {
      const list = this.voices.get(n);
      if (!list || !A.ctx) return;
      const t = A.ctx.currentTime;
      for (const v of list) {
        v.held = false;
        if (!this.pedalDown) this.kill(v, 0.45, t);
      }
    }
    pedal(down) {
      this.pedalDown = down;
      if (down || !A.ctx) return;
      const t = A.ctx.currentTime;
      for (const v of this.all) if (!v.held && !v.dead) this.kill(v, 0.45, t);
    }
    allOff() {
      if (!A.ctx) return;
      const t = A.ctx.currentTime;
      for (const v of this.all) this.kill(v, 0.05, t);
      this.pedalDown = false;
    }
    voiceCount() { return this.all.filter((v) => !v.dead).length; }
    sustainedNotes() { return [...new Set(this.all.filter((v) => !v.dead && !v.held).map((v) => v.n))]; }
  }

  WS.PadSynth = PadSynth;
})();
