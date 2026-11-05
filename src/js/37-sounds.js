/* The instrument catalog, loading and memory, and the Play rig (one sound, a split, or a layer). */
(function () {
  const INSTRUMENTS = [
    { id: 'salamander', name: 'Salamander Grand', family: 'Pianos', blurb: 'Yamaha C5 concert grand. Warm and even: the one you know.',
      credit: 'Salamander Grand Piano V3 by Alexander Holm (CC BY 3.0)', noDamperFrom: 89 },
    { id: 'steinway', name: 'Steinway Grand', family: 'Pianos', blurb: 'Darker and rounder, with four velocity layers instead of three.',
      credit: 'Splendid Grand Piano (Steinway), sfzinstruments (public domain)', noDamperFrom: 89 },
    { id: 'kawai', name: 'Kawai Grand', family: 'Pianos', blurb: 'Clear and modern, a little brighter than the other two grands.',
      credit: 'Versilian Community Sample Library, Kawai grand (CC0)', noDamperFrom: 89, trim: 4 },
    { id: 'upright', name: 'Upright Piano', family: 'Pianos', blurb: 'Smaller and boxier. The cozy living-room piano, great for pop and songwriting.',
      credit: 'Versilian Community Sample Library, Knight upright (CC0)', noDamperFrom: 89, minGain: 0.32 },
    { id: 'honkytonk', name: 'Honky-Tonk', family: 'Pianos', blurb: 'An old, slightly out-of-tune saloon piano. Blues and ragtime.',
      credit: 'Old Piano by Francis Bacon, freepats (CC0)', noDamperFrom: 89, minGain: 0.18 },
    { id: 'rhodes', name: 'Rhodes', family: 'Electric pianos', blurb: '1977 Rhodes Mark I. Warm and bell-like; dig in and it barks. Neo-soul, R&B, jazz.',
      credit: 'jRhodes3d by Jeff Learman (CC0)', releaseTau: 0.12 },
    { id: 'wurlitzer', name: 'Wurlitzer', family: 'Electric pianos', blurb: 'Wurlitzer EP200. Reedy and gritty, the classic 60s and 70s pop and soul keys.',
      credit: 'Greg Sullivan’s E-Pianos, Wurlitzer EP200 (CC BY 3.0)', releaseTau: 0.1 },
    { id: 'bass', name: 'Bass', family: 'Bass and synth', blurb: 'Electric Jazz Bass. It sounds an octave below the keys, like a real bass. Best on the left of a split.',
      credit: 'Growly Bass by D. Smolken (CC0)', pedal: false, releaseTau: 0.06, minGain: 0.4, range: [21, 84] },
    { id: 'pad', name: 'Synth Pad', family: 'Bass and synth', blurb: 'A warm, slow pad made live in the browser, so there’s nothing to load. Lovely under held chords.',
      credit: 'Made in Woodshed', synth: true, maxVoices: 24, trim: 2 },
  ];
  const BY_ID = Object.fromEntries(INSTRUMENTS.map((d) => [d.id, d]));

  /* ---------- Engines and memory ---------- */
  // Decoded audio is big (a grand is ~100-200 MB in memory), so only the most recently used instruments stay decoded.
  const BUDGET = 700e6;
  const engines = new Map();
  let clock = 0;

  const S = (WS.sounds = { INSTRUMENTS, BY_ID });
  S.def = (id) => BY_ID[id] || BY_ID.salamander;
  S.engine = (id) => {
    const d = S.def(id);
    if (!engines.has(d.id)) engines.set(d.id, d.synth ? new WS.PadSynth(d) : new WS.Sampler(d));
    const e = engines.get(d.id);
    e.used = ++clock;
    return e;
  };
  S.loaded = () => [...engines.values()].filter((e) => e.status !== 'idle');
  S.trim = (keep = []) => {
    const list = [...engines.values()].filter((e) => e.bytes > 0).sort((a, b) => a.used - b.used);
    let total = list.reduce((s, e) => s + e.bytes, 0);
    for (const e of list) {
      if (total <= BUDGET) break;
      if (keep.includes(e.id) || e.status === 'loading') continue;
      total -= e.bytes;
      e.unload();
    }
  };
  S.load = (id, keep) => {
    const e = S.engine(id);
    const p = e.load();
    Promise.resolve(p).then(() => S.trim(keep || [id]));
    return e;
  };

  /* The grand that lessons and drills use, whatever Play is set to. */
  WS.piano = S.engine('salamander');
  WS.piano.applySettings = () => WS.out.apply();
  WS.piano.latency = () => WS.audioLatency();

  /* ---------- The Play rig ---------- */
  const R = (WS.rig = { active: false, held: new Map() });

  /* Which instruments the current setup uses, with each one's level (layer mix) and key range. */
  R.parts = () => {
    const s = WS.S().settings;
    if (s.soundMode === 'split') {
      return [
        { id: S.def(s.splitLo).id, level: 1, lo: 0, hi: s.splitPoint - 1, side: 'left' },
        { id: S.def(s.splitHi).id, level: 1, lo: s.splitPoint, hi: 127, side: 'right' },
      ];
    }
    if (s.soundMode === 'layer') {
      const m = WS.clamp(s.layerMix, 0, 1);
      const a = S.def(s.layerA).id, b = S.def(s.layerB).id;
      if (a === b) return [{ id: a, level: 1, lo: 0, hi: 127 }];
      return [
        { id: a, level: Math.cos(m * Math.PI / 2), lo: 0, hi: 127 },
        { id: b, level: Math.sin(m * Math.PI / 2), lo: 0, hi: 127 },
      ];
    }
    return [{ id: S.def(s.sound).id, level: 1, lo: 0, hi: 127 }];
  };

  /* Load what the setup needs and quiet anything it no longer uses. */
  R.configure = () => {
    const parts = R.parts();
    const ids = parts.map((p) => p.id);
    for (const e of S.loaded()) if (!ids.includes(e.id)) e.allOff();
    for (const id of ids) S.load(id, ids);
    WS.out.ensure();
    WS.bus.emit('rig', parts);
    return parts;
  };

  R.engines = () => R.parts().map((p) => S.engine(p.id));
  R.status = () => {
    const es = R.engines();
    const total = es.reduce((s, e) => s + (e.total || 0), 0);
    const loaded = es.reduce((s, e) => s + (e.loaded || 0), 0);
    return {
      ready: es.every((e) => e.ready()),
      anyReady: es.some((e) => e.ready()),
      complete: es.every((e) => e.status === 'ready' && e.loaded >= e.total),
      error: es.some((e) => e.status === 'error'),
      loading: es.filter((e) => e.status === 'loading' || (e.ready() && e.loaded < e.total)),
      pct: total ? Math.round((loaded / total) * 100) : 100,
      engines: es,
    };
  };

  R.noteOn = (n, vel) => {
    const used = [];
    for (const p of R.parts()) {
      if (n < p.lo || n > p.hi) continue;
      const e = S.engine(p.id);
      if (e.status === 'idle') S.load(p.id);
      if (e.noteOn(n, vel, p.level)) used.push(e);
    }
    R.held.set(n, used);
    return used.length > 0;
  };
  R.noteOff = (n) => {
    const used = R.held.get(n);
    if (!used) return;
    for (const e of used) e.noteOff(n);
    R.held.delete(n);
  };
  R.pedal = (down) => {
    R.pedalDown = down;
    for (const e of S.loaded()) e.pedal(down);
  };
  R.allOff = () => { for (const e of S.loaded()) e.allOff(); R.held.clear(); };
  R.voiceCount = () => S.loaded().reduce((s, e) => s + e.voiceCount(), 0);
  R.sustainedNotes = () => [...new Set(S.loaded().flatMap((e) => e.sustainedNotes()))];
})();
