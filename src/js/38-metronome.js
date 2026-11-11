/* The Metronome: any meter, per-beat accents (accent / normal / soft / mute), subdivisions, multi-bar
   patterns, tempo trainer, gap trainer, random muting, presets, tap tempo, and a timing check that grades
   your playing against the clicks. Scheduled on the audio clock with a lookahead timer. */
(function () {
  const A = WS.audio;

  /* Subdivisions: where the extra clicks fall inside one beat (0 = the beat itself). */
  const SUBDIVS = [
    { id: 'none', name: 'Beats only', at: [0] },
    { id: '8', name: 'Eighths', at: [0, 1 / 2] },
    { id: 'trip', name: 'Triplets', at: [0, 1 / 3, 2 / 3] },
    { id: '16', name: 'Sixteenths', at: [0, 1 / 4, 2 / 4, 3 / 4] },
    { id: 'swing', name: 'Swing eighths', at: [0, 2 / 3] },
    { id: 'off', name: 'Offbeats only', at: [0, 1 / 2], offOnly: true },
    { id: 'dot', name: 'Dotted eighth + sixteenth', at: [0, 3 / 4] },
    { id: 'snap', name: 'Sixteenth + dotted eighth', at: [0, 1 / 4] },
    { id: 'gallop', name: 'Eighth + two sixteenths', at: [0, 1 / 2, 3 / 4] },
    { id: 'rgallop', name: 'Two sixteenths + eighth', at: [0, 1 / 4, 1 / 2] },
    { id: 'quint', name: 'Quintuplets', at: [0, 1 / 5, 2 / 5, 3 / 5, 4 / 5] },
    { id: 'sext', name: 'Sextuplets', at: [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6] },
    { id: 'sept', name: 'Septuplets', at: [0, 1 / 7, 2 / 7, 3 / 7, 4 / 7, 5 / 7, 6 / 7] },
  ];
  const SUB_BY = Object.fromEntries(SUBDIVS.map((d) => [d.id, d]));

  const SOUNDS = [
    { id: 'wood', name: 'Woodblock' },
    { id: 'click', name: 'Click' },
    { id: 'beep', name: 'Beep' },
    { id: 'cowbell', name: 'Cowbell' },
    { id: 'hat', name: 'Hi-hat' },
    { id: 'rim', name: 'Rimshot' },
    { id: 'clave', name: 'Clave' },
  ];

  // Accent levels: 3 accent, 2 normal, 1 soft, 0 mute
  const LEVEL_GAIN = [0, 0.32, 0.7, 1];

  const bar = (beats, unit, accents, subdiv = 'none') => ({ beats, unit, accents: accents || [3, ...Array(beats - 1).fill(2)], subdiv });

  const DEFAULT_PRESETS = [
    { name: 'Straight 4/4', bpm: 90, seq: [bar(4, 4)] },
    { name: 'Jazz: clicks on 2 and 4', bpm: 100, seq: [bar(4, 4, [0, 2, 0, 2])], sound: 'rim' },
    { name: 'Swing eighths', bpm: 120, seq: [bar(4, 4, [3, 2, 2, 2], 'swing')] },
    { name: 'Waltz 3/4', bpm: 120, seq: [bar(3, 4, [3, 1, 1])] },
    { name: '6/8 in two', bpm: 180, seq: [bar(6, 8, [3, 1, 1, 2, 1, 1])] },
    { name: '5/4 (3 + 2)', bpm: 110, seq: [bar(5, 4, [3, 1, 1, 2, 1])] },
    { name: '7/8 (2 + 2 + 3)', bpm: 200, seq: [bar(7, 8, [3, 1, 2, 1, 2, 1, 1])] },
    { name: '4/4 then 3/4', bpm: 100, seq: [bar(4, 4), bar(3, 4)] },
    { name: 'Clave 3–2 (on 8ths)', bpm: 200, seq: [bar(8, 8, [3, 0, 0, 2, 0, 0, 2, 0]), bar(8, 8, [0, 0, 2, 0, 2, 0, 0, 0])], sound: 'clave' },
  ];

  const M = (WS.metro = { SUBDIVS, SUB_BY, SOUNDS, LEVEL_GAIN, DEFAULT_PRESETS, running: false });

  M.defaults = () => ({
    bpm: 90,
    seq: [bar(4, 4)],
    sound: 'wood',
    vol: 0.8,
    subVol: 0.55,
    countIn: 0,          // bars of count-in before the trainers start
    trainer: { on: false, step: 2, every: 4, max: 140 },
    gap: { on: false, play: 2, mute: 2 },
    randomMute: 0,       // 0..0.8 chance a beat goes silent
    grade: true,         // timing check against your playing
    presets: null,       // null = defaults until the first save
  });

  M.cfg = () => {
    const s = WS.S();
    if (!s.metro) s.metro = M.defaults();
    const d = M.defaults();
    for (const k of Object.keys(d)) if (s.metro[k] === undefined) s.metro[k] = d[k];
    if (!s.metro.presets) s.metro.presets = JSON.parse(JSON.stringify(DEFAULT_PRESETS));
    return s.metro;
  };
  M.bar = bar;

  /* ---------- Sounds ---------- */
  let noiseBuf = null;
  const noise = (c) => {
    if (noiseBuf) return noiseBuf;
    noiseBuf = c.createBuffer(1, c.sampleRate * 0.2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };
  const env = (c, g, t, peak, dur, attack = 0.001) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };
  /* kind: 'accent' | 'beat' | 'sub' */
  M.voice = (t, kind, gain, soundId) => {
    const c = A.ctx;
    const out = M.out;
    if (!c || !out || gain <= 0) return;
    const hi = kind === 'accent';
    const sub = kind === 'sub';
    const g = c.createGain();
    g.connect(out);
    const osc = (type, f, f2, dur) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * 0.7);
      o.connect(g); o.start(t); o.stop(t + dur + 0.02);
      return o;
    };
    switch (soundId) {
      case 'click': {
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = sub ? 3000 : hi ? 2200 : 1600;
        const s = c.createBufferSource(); s.buffer = noise(c); s.connect(f).connect(g);
        env(c, g, t, gain * 0.9, 0.025); s.start(t); s.stop(t + 0.04);
        break;
      }
      case 'beep':
        env(c, g, t, gain * 0.45, 0.06, 0.002);
        osc('sine', sub ? 1320 : hi ? 1760 : 880, null, 0.06);
        break;
      case 'cowbell': {
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = sub ? 1100 : hi ? 900 : 800; bp.Q.value = 2;
        bp.connect(g); g.disconnect(); g.connect(out);
        const o1 = c.createOscillator(); const o2 = c.createOscillator();
        const g2 = c.createGain(); g2.connect(out);
        o1.type = o2.type = 'square';
        const base = sub ? 680 : hi ? 587 : 540;
        o1.frequency.value = base; o2.frequency.value = base * 1.48;
        o1.connect(bp); o2.connect(bp);
        env(c, g, t, gain * 0.5, sub ? 0.08 : 0.25);
        o1.start(t); o2.start(t); o1.stop(t + 0.3); o2.stop(t + 0.3);
        break;
      }
      case 'hat': {
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hi ? 6000 : 8000;
        const s = c.createBufferSource(); s.buffer = noise(c); s.connect(f).connect(g);
        env(c, g, t, gain * (hi ? 0.8 : 0.55), hi ? 0.09 : 0.04); s.start(t); s.stop(t + 0.12);
        break;
      }
      case 'rim': {
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = sub ? 2500 : hi ? 1900 : 1700; f.Q.value = 4;
        const s = c.createBufferSource(); s.buffer = noise(c); s.connect(f).connect(g);
        osc('triangle', hi ? 520 : 440, 300, 0.03);
        env(c, g, t, gain * 1.1, 0.05); s.start(t); s.stop(t + 0.07);
        break;
      }
      case 'clave':
        env(c, g, t, gain * 0.7, 0.07);
        osc('sine', sub ? 3000 : hi ? 2700 : 2500, null, 0.07);
        break;
      default: { // woodblock
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = sub ? 1700 : hi ? 1400 : 1000; f.Q.value = 3;
        g.disconnect(); f.connect(g); g.connect(out);
        const o = c.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(sub ? 1900 : hi ? 1500 : 1100, t);
        o.frequency.exponentialRampToValueAtTime(sub ? 1200 : hi ? 900 : 700, t + 0.05);
        o.connect(f);
        env(c, g, t, gain, 0.07, 0.002);
        o.start(t); o.stop(t + 0.09);
      }
    }
  };

  M.preview = (soundId) => {
    if (!A.ensure()) return;
    M.ensureOut();
    const t = A.ctx.currentTime + 0.03;
    M.voice(t, 'accent', 1, soundId);
    M.voice(t + 0.25, 'beat', LEVEL_GAIN[2], soundId);
  };

  M.ensureOut = () => {
    const c = A.ctx;
    if (!M.out && c) { M.out = c.createGain(); M.out.connect(A.master); }
    if (M.out) M.out.gain.value = M.cfg().vol;
  };

  /* ---------- Scheduler ---------- */
  let timer = null;
  let st = null;        // running state
  const recentClicks = (M._clicks = []); // heard times of sounded beat/sub clicks, for the timing check
  M.listeners = new Set();

  const beatDur = (b, bpm) => 60 / bpm; // the tempo counts the bar's own beat unit (a quarter in 4/4, an eighth in 7/8)

  M.start = () => {
    const c = A.ensure();
    if (!c) return false;
    M.ensureOut();
    const cfg = M.cfg();
    st = {
      t: c.currentTime + 0.08, bpm: cfg.bpm, barIdx: 0, totalBars: 0, beat: 0, sub: 0,
      startedAt: c.currentTime, startedPerf: performance.now(), countIn: cfg.countIn, cyclePos: 0,
    };
    M.running = true;
    timer = setInterval(tick, 25);
    tick();
    M.emit({ type: 'start' });
    WS.bus.emit('metro', { running: true });
    return true;
  };

  M.stop = () => {
    clearInterval(timer); timer = null;
    if (st && A.ctx) {
      const secs = A.ctx.currentTime - st.startedAt;
      WS.bus.emit('metro', { running: false, secs, bars: st.totalBars, bpm: st.bpm, cfg: M.cfg() });
    }
    M.running = false;
    st = null;
    M.emit({ type: 'stop' });
  };
  M.toggle = () => (M.running ? M.stop() : M.start());

  M.emit = (e) => { for (const f of M.listeners) { try { f(e); } catch (err) { console.error(err); } } };

  M.curBpm = () => (st ? st.bpm : M.cfg().bpm);
  M.elapsed = () => (st && A.ctx ? A.ctx.currentTime - st.startedAt : 0);

  /* Change tempo while running: takes effect on the next scheduled click. */
  M.setBpm = (v) => {
    const cfg = M.cfg();
    cfg.bpm = Math.round(WS.clamp(v, 20, 400));
    if (st) st.bpm = cfg.bpm;
    WS.store.save();
    M.emit({ type: 'bpm', bpm: cfg.bpm });
  };

  const tick = () => {
    const c = A.ctx;
    if (!c || !st) return;
    const cfg = M.cfg();
    const horizon = c.currentTime + 0.12;
    let guard = 0;
    while (st.t < horizon && guard++ < 256) {
      const seq = cfg.seq.length ? cfg.seq : [bar(4, 4)];
      if (st.barIdx >= seq.length) st.barIdx = 0;
      const b = seq[st.barIdx];
      if (st.beat >= b.beats) st.beat = 0;
      const sd = SUB_BY[b.subdiv] || SUB_BY.none;
      const dur = beatDur(b, st.bpm);
      const inCount = st.totalBars < st.countIn;
      // Gap trainer: play N bars, then M silent bars (after any count-in)
      let mutedBar = false;
      if (!inCount && cfg.gap.on) {
        const k = (st.totalBars - st.countIn) % (cfg.gap.play + cfg.gap.mute);
        mutedBar = k >= cfg.gap.play;
      }
      const lvl = inCount ? (st.beat === 0 ? 3 : 2) : (b.accents[st.beat] == null ? 2 : b.accents[st.beat]);
      const randMuted = !inCount && cfg.randomMute > 0 && st.beat !== 0 && Math.random() < cfg.randomMute;
      const silent = mutedBar || randMuted;
      sd.at.forEach((frac, i) => {
        const tt = st.t + frac * dur;
        if (i === 0) {
          if (sd.offOnly && !inCount) { /* beat itself silent in offbeat mode */ }
          else if (!silent && lvl > 0) {
            M.voice(tt, lvl === 3 ? 'accent' : 'beat', LEVEL_GAIN[lvl], cfg.sound);
            recentClicks.push(tt);
          }
        } else if (!silent && !inCount && lvl > 0) {
          M.voice(tt, 'sub', cfg.subVol * (lvl === 1 ? 0.6 : 1), cfg.sound);
          recentClicks.push(tt);
        }
      });
      // A beat that has its accent set to mute still keeps time, and the grid still counts it
      if (lvl === 0 && !silent && !inCount) sd.at.forEach((frac) => recentClicks.push(st.t + frac * dur));
      const ev = { type: 'beat', bar: st.barIdx, beat: st.beat, beats: b.beats, level: lvl, muted: silent, count: inCount, totalBars: st.totalBars, bpm: st.bpm };
      const delay = Math.max(0, (st.t - c.currentTime + A.outLat()) * 1000);
      setTimeout(() => M.emit(ev), delay);
      // advance
      st.t += dur;
      st.beat++;
      if (st.beat >= b.beats) {
        st.beat = 0;
        st.barIdx = (st.barIdx + 1) % seq.length;
        st.totalBars++;
        // Tempo trainer: raise the tempo every N bars until the max
        if (cfg.trainer.on && st.totalBars > st.countIn && (st.totalBars - st.countIn) % cfg.trainer.every === 0) {
          const nb = Math.min(cfg.trainer.max, st.bpm + cfg.trainer.step);
          if (nb !== st.bpm) {
            st.bpm = nb;
            setTimeout(() => M.emit({ type: 'bpm', bpm: nb, trainer: true }), Math.max(0, (st.t - c.currentTime) * 1000));
            if (nb >= cfg.trainer.max) setTimeout(() => WS.bus.emit('metro-trainer-done', { bpm: nb }), Math.max(0, (st.t - c.currentTime) * 1000));
          }
        }
      }
    }
    while (recentClicks.length > 64) recentClicks.shift();
  };

  /* ---------- Tap tempo ---------- */
  const taps = [];
  M.tap = () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 6) taps.shift();
    if (taps.length >= 2) {
      const ints = taps.slice(1).map((t, i) => t - taps[i]);
      const avg = ints.reduce((a, b) => a + b, 0) / ints.length;
      M.setBpm(60000 / avg);
    }
    return taps.length;
  };

  /* ---------- Timing check: how your notes land against the clicks ---------- */
  const offs = [];
  M.timing = { offs };
  M.resetTiming = () => { offs.length = 0; };
  WS.bus.on('noteon', (e) => {
    if (!M.running || !st || !M.cfg().grade || !A.ctx || e.src === 'playback') return;
    const cal = (WS.S().settings.calibrationMs || 0) / 1000;
    const t = A.perfToHeard(e.t) - cal;
    // Ignore notes in a chord: only the first note of a cluster counts
    if (M._lastNoteT && Math.abs(e.t - M._lastNoteT) < 35) return;
    M._lastNoteT = e.t;
    let best = null; let bd = 1e9;
    for (const ct of recentClicks) { const d = Math.abs(t - ct); if (d < bd) { bd = d; best = ct; } }
    if (best == null) return;
    const cfg = M.cfg();
    const b = cfg.seq[0] || bar(4, 4);
    const sd = SUB_BY[b.subdiv] || SUB_BY.none;
    const grid = (60 / st.bpm) / Math.max(1, sd.at.length);
    if (bd > grid * 0.45) return; // too far from any click to judge
    const ms = (t - best) * 1000;
    offs.push(ms);
    if (offs.length > 48) offs.shift();
    M.emit({ type: 'hit', ms });
  });
  M.timingSummary = () => {
    if (offs.length < 4) return null;
    const mean = offs.reduce((a, b) => a + b, 0) / offs.length;
    const sd = Math.sqrt(offs.reduce((a, b) => a + (b - mean) ** 2, 0) / offs.length);
    return { n: offs.length, mean, sd };
  };

  /* ---------- Presets ---------- */
  M.snapshot = (name) => {
    const c = M.cfg();
    return { name, bpm: c.bpm, seq: JSON.parse(JSON.stringify(c.seq)), sound: c.sound, subVol: c.subVol, trainer: { ...c.trainer }, gap: { ...c.gap }, randomMute: c.randomMute, countIn: c.countIn };
  };
  M.load = (p) => {
    const c = M.cfg();
    const was = M.running;
    if (was) M.stop();
    c.bpm = p.bpm;
    c.seq = JSON.parse(JSON.stringify(p.seq));
    if (p.sound) c.sound = p.sound;
    if (p.subVol != null) c.subVol = p.subVol;
    c.trainer = p.trainer ? { ...p.trainer } : { ...c.trainer, on: false };
    c.gap = p.gap ? { ...p.gap } : { ...c.gap, on: false };
    c.randomMute = p.randomMute || 0;
    c.countIn = p.countIn || 0;
    WS.store.save();
    if (was) M.start();
  };
  M.meterLabel = (b) => `${b.beats}/${b.unit}`;
  M.patternLabel = (seq) => seq.map(M.meterLabel).join(' · ');
})();
