/* Input: Web MIDI (with permission and hot-plug) plus a computer-keyboard fallback. Emits noteon/noteoff/pedal on WS.bus. */
(function () {
  const I = (WS.input = {
    held: new Map(),       // midi note -> { vel, t, src }
    pedal: false,
    access: null,
    status: 'idle',        // idle | unsupported | denied | no-device | connected | error
    devices: [],
    qwertyWanted: false,   // set by screens that accept notes (game, keyboard, play)
    qwertySustain: false,  // Play mode: the space bar works as a sustain pedal
    lastVel: 0,
  });

  /* ---------- MIDI ---------- */
  I.midiSupported = () => typeof navigator.requestMIDIAccess === 'function';

  I.connectMidi = async function () {
    if (!I.midiSupported()) {
      I.setStatus('unsupported');
      return false;
    }
    try {
      I.access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      const blocked = err && (err.name === 'SecurityError' || err.name === 'NotAllowedError');
      I.setStatus(blocked ? (location.protocol === 'file:' ? 'denied-file' : 'denied') : 'error');
      return false;
    }
    I.access.onstatechange = () => I.attach();
    I.attach();
    return true;
  };

  /* If permission was granted before, connect without a prompt. */
  I.autoConnect = async function () {
    if (!I.midiSupported() || !navigator.permissions) return;
    try {
      const p = await navigator.permissions.query({ name: 'midi', sysex: false });
      if (p.state === 'granted') await I.connectMidi();
    } catch (e) { /* some browsers don't expose the midi permission */ }
  };

  I.attach = function () {
    if (!I.access) return;
    I.devices = [];
    for (const input of I.access.inputs.values()) {
      if (input.state === 'disconnected') continue;
      input.onmidimessage = I.onMidi;
      I.devices.push({ id: input.id, name: input.name || 'MIDI keyboard', manufacturer: input.manufacturer || '' });
    }
    if (!I.devices.length) I.releaseAll();
    I.setStatus(I.devices.length ? 'connected' : 'no-device');
  };

  I.setStatus = function (s) {
    I.status = s;
    WS.bus.emit('inputstatus', s);
  };

  I.onMidi = function (e) {
    const [st, d1, d2] = e.data;
    const cmd = st & 0xf0;
    const t = e.timeStamp || performance.now();
    if (cmd === 0x90 && d2 > 0) I.noteOn(d1, d2, t, 'midi');
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) I.noteOff(d1, t, 'midi');
    else if (cmd === 0xb0 && d1 === 64) I.setPedal(d2 >= 64, t);
  };

  /* ---------- Shared note handling ---------- */
  I.noteOn = function (n, vel, t, src) {
    I.held.set(n, { vel, t, src });
    I.lastVel = vel;
    // A screen can claim the next key (Play uses this to set the split point); it isn't sounded or graded
    if (I.captureNext) { const f = I.captureNext; I.captureNext = null; f(n); I.held.delete(n); return; }
    if (I.shouldSound(src)) WS.audio.playNote(n, vel);
    WS.bus.emit('noteon', { n, vel, t, src });
  };
  I.noteOff = function (n, t, src) {
    if (!I.held.has(n)) return;
    I.held.delete(n);
    WS.audio.stopNote(n);
    WS.bus.emit('noteoff', { n, t, src });
  };
  /* Whether the app should make a sound for a note. Play mode always does; elsewhere it follows the setting. */
  I.forceSound = false;
  I.shouldSound = function (src) {
    if (I.forceSound) return true;
    const synth = WS.S().settings.synth;
    return (src === 'qwerty' && synth !== 'off') || (src !== 'qwerty' && synth === 'on');
  };
  I.setPedal = function (down, t) {
    I.pedal = down;
    WS.audio.pedal(down);
    WS.bus.emit('pedal', { down, t });
  };
  I.releaseAll = function () {
    const t = performance.now();
    for (const n of [...I.held.keys()]) I.noteOff(n, t, 'release');
  };
  I.notes = () => [...I.held.keys()].sort((a, b) => a - b);
  I.strikeTime = (n) => (I.held.get(n) || { t: 0 }).t;

  /* ---------- Computer keyboard ---------- */
  // Bottom row: C3 upward. Top row: C4 upward. Number keys are the black keys.
  const MAP = {
    KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8, KeyN: 9, KeyJ: 10, KeyM: 11,
    Comma: 12, KeyL: 13, Period: 14, Semicolon: 15, Slash: 16,
    KeyQ: 12, Digit2: 13, KeyW: 14, Digit3: 15, KeyE: 16, KeyR: 17, Digit5: 18, KeyT: 19, Digit6: 20, KeyY: 21,
    Digit7: 22, KeyU: 23, KeyI: 24, Digit9: 25, KeyO: 26, Digit0: 27, KeyP: 28,
  };
  I.QWERTY_MAP = MAP;
  const down = new Map(); // code -> note

  I.qwertyActive = function () {
    const mode = WS.S().settings.inputMode;
    if (!I.qwertyWanted || mode === 'midi') return false;
    if (mode === 'qwerty') return true;
    return I.status !== 'connected';
  };
  I.qwertyBase = () => 48 + 12 * (WS.S().settings.octave || 0);

  const isTyping = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
    if (!I.qwertyActive()) return;
    if (e.code === 'Minus' || e.code === 'Equal') {
      const s = WS.S().settings;
      s.octave = WS.clamp((s.octave || 0) + (e.code === 'Equal' ? 1 : -1), -2, 2);
      WS.store.save();
      WS.bus.emit('octave', s.octave);
      e.preventDefault();
      return;
    }
    if (e.code === 'Space' && I.qwertySustain) { if (!I.pedal) I.setPedal(true, e.timeStamp || performance.now()); e.preventDefault(); return; }
    if (!(e.code in MAP) || down.has(e.code)) return;
    const n = I.qwertyBase() + MAP[e.code];
    down.set(e.code, n);
    I.noteOn(n, 90, e.timeStamp || performance.now(), 'qwerty');
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && I.qwertySustain && I.pedal) { I.setPedal(false, e.timeStamp || performance.now()); return; }
    if (!down.has(e.code)) return;
    const n = down.get(e.code);
    down.delete(e.code);
    I.noteOff(n, e.timeStamp || performance.now(), 'qwerty');
  });
  window.addEventListener('blur', () => {
    for (const [code, n] of down) I.noteOff(n, performance.now(), 'qwerty');
    down.clear();
  });

  /* Debug/test injection (used only with ?debug) */
  I.inject = function (n, on, t, vel = 90) {
    if (on) I.noteOn(n, vel, t, 'midi'); else I.noteOff(n, t, 'midi');
  };
})();
