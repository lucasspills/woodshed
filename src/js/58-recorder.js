/* Recordings: capture what you play (notes, velocity, pedal) as MIDI, play it back through any sound,
   and export a standard .mid file you can open in GarageBand, Logic or MuseScore. */
(function () {
  const RC = (WS.recorder = { recording: false, playing: null, playHeld: new Set() });
  const MAX_KEEP = 300;

  RC.list = () => { const s = WS.S(); if (!s.recordings) s.recordings = []; return s.recordings; };
  RC.get = (id) => RC.list().find((r) => r.id === id);

  /* ---------- Capture ---------- */
  let cur = null;
  let unsub = [];
  RC.start = () => {
    if (RC.recording) return;
    if (RC.playing) RC.stopPlayback();
    cur = { t0: null, ev: [] };
    RC.recording = true;
    RC.startedAt = performance.now();
    // Keys already held when recording starts are captured as starting at 0
    const rel = (t) => { if (cur.t0 == null) cur.t0 = t; return Math.max(0, Math.round(t - cur.t0)); };
    unsub = [
      WS.bus.on('noteon', (e) => { if (e.src === 'playback') return; cur.ev.push([rel(e.t || performance.now()), 1, e.n, e.vel]); }),
      WS.bus.on('noteoff', (e) => { if (e.src === 'playback') return; if (cur.t0 != null) cur.ev.push([rel(e.t || performance.now()), 0, e.n, 0]); }),
      WS.bus.on('pedal', (e) => { if (e.src === 'playback') return; if (cur.t0 != null) cur.ev.push([rel(e.t || performance.now()), 2, 64, e.down ? 127 : 0]); }),
    ];
    WS.bus.emit('recorder', { recording: true });
  };

  /* Stop and save. Returns the saved recording, or null if nothing was played. */
  RC.stop = (meta = {}) => {
    if (!RC.recording) return null;
    unsub.forEach((f) => f()); unsub = [];
    RC.recording = false;
    const ev = cur.ev;
    cur = null;
    WS.bus.emit('recorder', { recording: false });
    if (!ev.some((e) => e[1] === 1)) return null;
    // Close any notes still held at the end
    const end = ev[ev.length - 1][0] + 400;
    const open = new Set();
    for (const e of ev) { if (e[1] === 1) open.add(e[2]); else if (e[1] === 0) open.delete(e[2]); }
    open.forEach((n) => ev.push([end, 0, n, 0]));
    const st = WS.S().settings;
    const now = new Date(WS.nowMs());
    const rec = {
      id: `r${Date.now().toString(36)}`,
      day: WS.todayKey(),
      at: now.toISOString(),
      name: meta.name || `Take, ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
      tag: meta.tag || 'free',
      dur: Math.round(end / 100) / 10,
      notes: ev.filter((e) => e[1] === 1).length,
      sound: st.soundMode === 'single' ? st.sound : st.soundMode,
      ev,
    };
    const list = RC.list();
    list.push(rec);
    if (list.length > MAX_KEEP) list.splice(0, list.length - MAX_KEEP);
    WS.store.save();
    WS.bus.emit('record', rec);
    return rec;
  };
  RC.elapsed = () => (RC.recording ? (performance.now() - RC.startedAt) / 1000 : 0);

  RC.rename = (id, name) => { const r = RC.get(id); if (r) { r.name = name; WS.store.save(); } };
  RC.setTag = (id, tag) => { const r = RC.get(id); if (r) { r.tag = tag; WS.store.save(); } };
  RC.remove = (id) => { const s = WS.S(); s.recordings = RC.list().filter((r) => r.id !== id); WS.store.save(); };

  /* ---------- Playback (through the Play rig when on the Play screen, the grand elsewhere) ---------- */
  let ptimer = null;
  RC.play = (id, onEnd) => {
    const rec = RC.get(id);
    if (!rec) return;
    RC.stopPlayback();
    if (!WS.audio.ensure()) return;
    if (WS.rig && WS.rig.active) WS.rig.configure();
    const t0 = performance.now() + 120;
    let i = 0;
    RC.playing = { id, t0, dur: rec.dur, onEnd };
    const send = (e) => {
      const [, kind, n, v] = e;
      if (kind === 1) { WS.audio.playNote(n, v); RC.playHeld.add(n); WS.bus.emit('noteon', { n, vel: v, t: performance.now(), src: 'playback' }); }
      else if (kind === 0) { WS.audio.stopNote(n); RC.playHeld.delete(n); WS.bus.emit('noteoff', { n, t: performance.now(), src: 'playback' }); }
      else WS.audio.pedal(v >= 64);
    };
    ptimer = setInterval(() => {
      const now = performance.now() - t0;
      while (i < rec.ev.length && rec.ev[i][0] <= now) send(rec.ev[i++]);
      WS.bus.emit('playback', { id, pos: Math.max(0, now / 1000), dur: rec.dur });
      if (i >= rec.ev.length) { const f = RC.playing && RC.playing.onEnd; RC.stopPlayback(); if (f) f(); }
    }, 4);
  };
  RC.stopPlayback = () => {
    clearInterval(ptimer); ptimer = null;
    if (RC.playHeld.size) { [...RC.playHeld].forEach((n) => { WS.audio.stopNote(n); WS.bus.emit('noteoff', { n, t: performance.now(), src: 'playback' }); }); RC.playHeld.clear(); }
    if (RC.playing) WS.audio.pedal(false);
    RC.playing = null;
    WS.bus.emit('playback', { id: null });
  };

  /* ---------- Standard MIDI file (type 0, 480 ticks per quarter at 120 BPM, so 1 ms = 0.96 ticks) ---------- */
  const vlq = (n) => {
    const bytes = [n & 0x7f];
    while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
    return bytes;
  };
  RC.toMidi = (rec) => {
    const PPQ = 480;
    const tpm = PPQ * 2 / 1000; // ticks per ms at 120 BPM
    const track = [];
    track.push(0, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20); // tempo 500000 us/qn
    const name = Array.from(new TextEncoder().encode(rec.name.slice(0, 60)));
    track.push(0, 0xff, 0x03, ...vlq(name.length), ...name);
    let last = 0;
    for (const [ms, kind, n, v] of rec.ev) {
      const tick = Math.round(ms * tpm);
      track.push(...vlq(tick - last));
      last = tick;
      if (kind === 1) track.push(0x90, n & 0x7f, Math.max(1, v & 0x7f));
      else if (kind === 0) track.push(0x80, n & 0x7f, 64);
      else track.push(0xb0, 64, v & 0x7f);
    }
    track.push(0, 0xff, 0x2f, 0x00);
    const len = track.length;
    const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
    const th = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff];
    return new Uint8Array([...head, ...th, ...track]);
  };
  RC.download = (id) => {
    const rec = RC.get(id);
    if (!rec) return;
    const blob = new Blob([RC.toMidi(rec)], { type: 'audio/midi' });
    const safe = rec.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 50) || 'woodshed-take';
    const a = WS.h('a', { href: URL.createObjectURL(blob), download: `${safe}.mid` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
})();
