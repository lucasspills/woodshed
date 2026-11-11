/* Ear games: Degrees (E1), Echo (E2), Bass Detective (E3) and Chord Quality (E4/E5).
   Woodshed plays something; you answer on the keyboard. Every round is 10 questions; 8 passes a level. */
(function () {
  const T = WS.theory;
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const DEG_NAME = { 0: '1', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♯4', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7' };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const KEYS_EASY = [0, 7, 5];             // C, G, F
  const KEYS_ALL = T.KEY_ORDER;

  /* Tonic in a comfortable register: C4..B4 */
  const tonicMidi = (pc) => 60 + pc - (pc > 6 ? 12 : 0);
  /* I–IV–V–I cadence, close voicings around middle C, bass below */
  const cadence = (pc) => {
    const r = tonicMidi(pc);
    const chords = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]].map((iv, i) => {
      const bass = r - 12 + [0, 5, 7, 0][i] - ([0, 5, 7, 0][i] > 5 ? 12 : 0);
      return [bass, ...iv.map((x) => r + x - (i === 2 ? 12 : 0))];
    });
    return chords;
  };

  const GAMES = [
    {
      id: 'degrees', drill: 'E1', name: 'Degrees', short: 'Name the note by its number',
      blurb: 'You hear the key, then one note. Find it on the keyboard. Any octave counts. Woodshed tells you its number.',
      levels: [
        { name: '1, 3 and 5 in C', keys: [0], degs: [0, 4, 7] },
        { name: 'All seven in C', keys: [0], degs: MAJOR },
        { name: 'All seven in C, G and F', keys: KEYS_EASY, degs: MAJOR },
        { name: 'All seven, any key', keys: KEYS_ALL, degs: MAJOR },
        { name: 'Chromatic, any key', keys: KEYS_ALL, degs: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      ],
    },
    {
      id: 'echo', drill: 'E2', name: 'Echo', short: 'Play the melody back',
      blurb: 'A short melody after the key is set. Play it back, same notes in the same order, any octave.',
      levels: [
        { name: '2 notes in C', keys: [0], len: 2, leap: 2 },
        { name: '3 notes in C', keys: [0], len: 3, leap: 2 },
        { name: '4 notes in C, G and F', keys: KEYS_EASY, len: 4, leap: 3 },
        { name: '5 notes, any key', keys: KEYS_ALL, len: 5, leap: 3 },
        { name: '5 notes with leaps, any key', keys: KEYS_ALL, len: 5, leap: 6 },
      ],
    },
    {
      id: 'bass', drill: 'E3', name: 'Bass Detective', short: 'Find the bass line',
      blurb: 'Four chords loop once. Play the four bass notes back in order. The bass tells you the chords: 1, 4 and 5 are major, 6 is minor.',
      levels: [
        { name: '1, 4 and 5 in C', keys: [0], prog: 'basic' },
        { name: '1, 4, 5 and 6 in C', keys: [0], prog: 'pop' },
        { name: 'Pop progressions in C, G, F and D', keys: [0, 7, 5, 2], prog: 'pop' },
        { name: 'Any key, with 2 and 3', keys: KEYS_ALL, prog: 'all' },
      ],
    },
    {
      id: 'quality', drill: 'E4', name: 'Chord Quality', short: 'Hear the chord type',
      blurb: 'One chord. Tap its quality, or play the exact chord back on the keyboard for a bonus.',
      levels: [
        { name: 'Major or minor', qs: ['maj', 'min'] },
        { name: 'All four triads', qs: ['maj', 'min', 'dim', 'aug'] },
        { name: 'maj7, 7 and m7', qs: ['maj7', 'dom7', 'min7'] },
        { name: 'All five sevenths', qs: ['maj7', 'dom7', 'min7', 'hdim7', 'dim7'] },
        { name: 'Triads and 7ths, any inversion', qs: ['maj', 'min', 'maj7', 'dom7', 'min7', 'hdim7'], inv: true },
      ],
    },
  ];
  const BY = Object.fromEntries(GAMES.map((g) => [g.id, g]));

  const PROGS = {
    basic: [[0, 5, 7, 0], [0, 7, 5, 0], [0, 5, 0, 7], [0, 0, 5, 7], [0, 7, 0, 5]],
    pop: [[0, 7, 9, 5], [0, 9, 5, 7], [9, 5, 0, 7], [0, 5, 9, 7], [0, 9, 7, 5], [0, 5, 7, 9], [0, 7, 5, 9]],
    all: [[0, 7, 9, 5], [0, 9, 2, 7], [2, 7, 0, 9], [0, 4, 5, 7], [0, 9, 5, 7], [4, 9, 2, 7], [9, 5, 0, 7], [0, 5, 2, 7], [5, 7, 4, 9]],
  };
  // Chord on each degree of the major key: major on 1 4 5, minor on 2 3 6
  const DIA_Q = { 0: 'maj', 2: 'min', 4: 'min', 5: 'maj', 7: 'maj', 9: 'min', 11: 'dim' };

  const E = (WS.ear = { GAMES, BY, DEG_NAME, ROUND: 10, PASS: 8 });
  E.def = (id) => BY[id];

  E.st = () => {
    const s = WS.S();
    if (!s.ear) s.ear = {};
    if (!s.earItems) s.earItems = {};
    if (!s.earRounds) s.earRounds = [];
    return s;
  };
  E.levelState = (gid, i) => {
    const s = E.st();
    const g = (s.ear[gid] = s.ear[gid] || {});
    return (g[i] = g[i] || { best: 0, plays: 0, passed: null, perfect: null });
  };
  E.isUnlocked = (gid, i) => i === 0 || !!E.levelState(gid, i - 1).passed;
  E.nextLevel = (gid) => {
    const g = BY[gid];
    for (let i = 0; i < g.levels.length; i++) if (!E.levelState(gid, i).passed) return i;
    return g.levels.length - 1;
  };
  /* Which game fits this week of the roadmap */
  E.suggest = () => {
    const week = WS.progress.weekNumber();
    if (week <= 2) return 'degrees';
    if (week <= 4) return 'echo';
    if (week <= 8) return 'bass';
    return 'quality';
  };

  /* ---------- Question generators ---------- */
  E.makeQuestion = (gid, li) => {
    const lv = BY[gid].levels[li];
    if (gid === 'degrees') {
      const key = pick(lv.keys);
      const deg = pick(lv.degs);
      const note = tonicMidi(key) + deg + (Math.random() < 0.3 ? -12 : 0) + (deg > 0 && Math.random() < 0.15 ? 12 : 0);
      return { gid, key, deg, answer: [note % 12], play: { cadence: cadence(key), notes: [note] }, len: 1, label: `That was ${DEG_NAME[deg]} in ${T.KEY_NAME[key]}` };
    }
    if (gid === 'echo') {
      const key = pick(lv.keys);
      const base = tonicMidi(key);
      // Diatonic melody starting on 1, 3 or 5, moving mostly by step, within an octave and a half
      const scale = [];
      for (let o = -1; o <= 1; o++) for (const d of MAJOR) scale.push(base + 12 * o + d);
      let idx = scale.indexOf(base + pick([0, 4, 7]));
      const notes = [scale[idx]];
      while (notes.length < lv.len) {
        let step = Math.random() < 0.65 ? pick([-1, 1]) : pick([-2, 2, -3, 3, -4, 4].filter((x) => Math.abs(x) <= lv.leap));
        if (idx + step < 3 || idx + step > scale.length - 4) step = -step;
        idx += step;
        notes.push(scale[idx]);
      }
      const degs = notes.map((n) => DEG_NAME[((n - base) % 12 + 12) % 12]);
      return { gid, key, answer: notes.map((n) => n % 12), play: { cadence: cadence(key), melody: notes }, len: notes.length, label: `${degs.join(' ')} in ${T.KEY_NAME[key]}` };
    }
    if (gid === 'bass') {
      const key = pick(lv.keys);
      const prog = pick(PROGS[lv.prog]);
      const r = tonicMidi(key);
      const chords = prog.map((d) => {
        const q = DIA_Q[d];
        const root = r + d - (d > 6 ? 12 : 0);
        const ints = T.Q[q].ints;
        return { bass: root - 24 + (root - 24 < 33 ? 12 : 0), upper: ints.map((x) => root + x), deg: d, q };
      });
      const nums = prog.map((d) => DEG_NAME[d]);
      return { gid, key, answer: prog.map((d) => (key + d) % 12), play: { cadence: cadence(key), chords }, len: 4, label: `Bass: ${nums.join(' ')} in ${T.KEY_NAME[key]} (${chords.map((c) => T.chord((key + c.deg) % 12, c.q).sym).join(' ')})` };
    }
    // quality
    const q = pick(lv.qs);
    const rootPc = Math.floor(Math.random() * 12);
    const root = 48 + rootPc + (rootPc < 5 ? 12 : 0);
    let notes = T.Q[q].ints.map((x) => root + x);
    if (lv.inv) { const k = Math.floor(Math.random() * notes.length); for (let i = 0; i < k; i++) notes.push(notes.shift() + 12); }
    return { gid, q, rootPc, answer: [...new Set(notes.map((n) => n % 12))].sort((a, b) => a - b), play: { chord: notes }, len: notes.length, label: `${T.chord(rootPc, q).sym}: ${T.Q[q].name}` };
  };

  /* ---------- Playback (the grand once loaded, the simple synth until then) ---------- */
  const timers = new Set();
  const live = new Set();
  const on = (n, vel = 80) => {
    const A = WS.audio;
    if (!A.ensure()) return;
    const P = WS.piano;
    if (P && P.available()) { if (P.status === 'idle') P.load(); if (P.ready() && P.noteOn(n, vel)) { live.add(n); return; } }
    A.noteOn(n, vel); live.add(n);
  };
  const off = (n) => { if (WS.piano) WS.piano.noteOff(n); WS.audio.noteOff(n); live.delete(n); };
  const later = (ms, f) => { const id = setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); };
  E.stopAudio = () => { timers.forEach(clearTimeout); timers.clear(); [...live].forEach(off); };

  /* Play a question's audio; calls done() when it ends. withCadence false skips the key-setting chords. */
  E.playQuestion = (qn, { withCadence = true, onNote } = {}, done) => {
    E.stopAudio();
    if (WS.piano && WS.piano.available() && WS.piano.status === 'idle') WS.piano.load();
    let t = 60;
    const p = qn.play;
    const hit = (notes, dur, vel = 72) => {
      later(t, () => { notes.forEach((n) => on(n, vel)); if (onNote) onNote(notes, true); });
      later(t + dur, () => { notes.forEach(off); if (onNote) onNote(notes, false); });
    };
    if (withCadence && p.cadence) {
      p.cadence.forEach((c, i) => { hit(c, i === 3 ? 900 : 520, 62); t += i === 3 ? 1100 : 560; });
      t += 250;
    }
    if (p.notes) { hit(p.notes, 1200, 84); t += 1300; }
    if (p.melody) { p.melody.forEach((n) => { hit([n], 520, 84); t += 600; }); }
    if (p.chords) { p.chords.forEach((c) => { hit([c.bass], 1000, 92); hit(c.upper, 1000, 58); t += 1100; }); }
    if (p.chord) { hit(p.chord, 1500, 78); t += 1600; }
    later(t, () => done && done());
    return t;
  };
  /* Play the right answer after a miss */
  E.playAnswer = (qn, onNote, done) => E.playQuestion(qn, { withCadence: false, onNote }, done);

  /* ---------- Grading ---------- */
  E.gradeSeq = (qn, played) => played.length === qn.answer.length && played.every((n, i) => n % 12 === qn.answer[i]);
  E.gradeChord = (qn, held) => {
    const pcs = [...new Set(held.map((n) => n % 12))].sort((a, b) => a - b);
    return pcs.length === qn.answer.length && pcs.every((x, i) => x === qn.answer[i]);
  };
  E.recordItem = (qn, ok) => {
    const s = E.st();
    const keys = [];
    if (qn.gid === 'degrees') keys.push(`deg:${DEG_NAME[qn.deg]}`);
    if (qn.gid === 'quality') keys.push(`q:${qn.q}`);
    if (qn.gid === 'bass') keys.push(...qn.play.chords.map((c) => `bass:${DEG_NAME[c.deg]}`));
    if (qn.gid === 'echo') keys.push(`echo:${qn.len}`);
    for (const k of keys) { const it = (s.earItems[k] = s.earItems[k] || { n: 0, ok: 0 }); it.n++; if (ok) it.ok++; }
  };

  /* End of a round: stars, XP, history */
  E.finishRound = (gid, li, score, n) => {
    const s = E.st();
    const ls = E.levelState(gid, li);
    const today = WS.todayKey();
    const passed = score >= E.PASS;
    const firstPass = passed && !ls.passed;
    const perfect = score === n;
    ls.plays++;
    ls.best = Math.max(ls.best, score);
    if (passed && !ls.passed) ls.passed = today;
    if (perfect && !ls.perfect) ls.perfect = today;
    let xp = score * 3 + (passed ? 15 : 0) + (firstPass ? 25 : 0);
    // Replaying a level you've already aced pays less, same as Chord Runner
    if (ls.perfect && !firstPass && ls.plays > 3 && perfect) xp = Math.round(xp * 0.5);
    s.xp += xp;
    const day = WS.progress.day(today);
    day.xp += xp;
    day.focus = true;
    s.earRounds.push({ day: today, at: new Date(WS.nowMs()).toISOString(), game: gid, level: li, score, n, passed, xp });
    if (s.earRounds.length > 400) s.earRounds.splice(0, s.earRounds.length - 400);
    WS.store.save();
    const out = { passed, firstPass, perfect, xp, unlocked: firstPass && li + 1 < BY[gid].levels.length ? li + 1 : null };
    WS.bus.emit('ear', { gid, li, score, n, ...out });
    WS.bus.emit('progress');
    return out;
  };

  E.accuracy = (prefix) => {
    const s = E.st();
    return Object.entries(s.earItems).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => ({ key: k.slice(prefix.length), n: v.n, acc: v.ok / v.n }));
  };
})();
