/* Daily core, weekly goal, streak with freezes, ranks, and tonight's plan from the Piano Roadmap. */
(function () {
  const P = (WS.progress = {});
  P.WEEK_GOAL = 5;
  P.MAX_FREEZES = 2;
  P.RANKS = [
    { name: 'Busker', xp: 0 },
    { name: 'Session player', xp: 1500 },
    { name: 'Soloist', xp: 6000 },
    { name: 'Virtuoso', xp: 20000 },
  ];

  P.day = (k) => {
    const s = WS.S();
    if (!s.days[k]) s.days[k] = { sight: false, score: false, focus: false, core: false, freeze: false, rounds: 0, minutes: 0, xp: 0 };
    return s.days[k];
  };

  /* Tick or untick sight-reading / score piece / focus. Core = sight-reading + score piece. */
  P.setTask = (k, field, val) => {
    const s = WS.S();
    const d = P.day(k);
    const was = d.core;
    d[field] = val;
    d.core = d.sight && d.score;
    if (d.core && !was) {
      s.xp += 30; d.xp += 30;
      s.freezeProgress++;
      if (s.freezeProgress >= 7) {
        s.freezeProgress = 0;
        if (s.freezes < P.MAX_FREEZES) { s.freezes++; WS.toast('Seven core days: you earned a streak freeze.'); }
      }
      P.checkWeek(k);
    } else if (!d.core && was) {
      s.xp = Math.max(0, s.xp - 30); d.xp = Math.max(0, d.xp - 30);
      s.freezeProgress = Math.max(0, s.freezeProgress - 1);
    }
    WS.store.save();
    WS.bus.emit('progress');
  };

  P.weekCount = (k) => {
    const mon = WS.mondayOf(k);
    let n = 0;
    for (let i = 0; i < 7; i++) { const d = WS.S().days[WS.addDays(mon, i)]; if (d && d.core) n++; }
    return n;
  };

  P.checkWeek = (k) => {
    const s = WS.S();
    const mon = WS.mondayOf(k);
    if (P.weekCount(k) >= P.WEEK_GOAL && !s.weeksAwarded[mon]) {
      s.weeksAwarded[mon] = true;
      s.xp += 100;
      WS.toast('Weekly goal reached: 5 core days. +100 XP');
    }
  };

  /* Bridge missed days with freezes, but only if the freezes cover the whole gap. */
  P.applyFreezes = () => {
    const s = WS.S();
    const today = WS.todayKey();
    const missed = [];
    let k = WS.addDays(today, -1);
    for (let i = 0; i < 90; i++) {
      const d = s.days[k];
      if (d && (d.core || d.freeze)) break;
      missed.push(k);
      k = WS.addDays(k, -1);
    }
    const anchor = s.days[k];
    if (anchor && (anchor.core || anchor.freeze) && missed.length > 0 && missed.length <= s.freezes) {
      for (const m of missed) P.day(m).freeze = true;
      s.freezes -= missed.length;
      WS.store.save();
      WS.toast(`Used ${missed.length === 1 ? 'a streak freeze' : `${missed.length} streak freezes`} for ${missed.length === 1 ? 'yesterday' : 'the missed days'}. Your streak is safe.`);
    }
  };

  P.streak = () => {
    const s = WS.S();
    const today = WS.todayKey();
    const counts = (k) => s.days[k] && (s.days[k].core || s.days[k].freeze);
    let k = counts(today) ? today : WS.addDays(today, -1);
    let n = 0;
    while (counts(k) && n < 3650) { n++; k = WS.addDays(k, -1); }
    return n;
  };

  P.rank = (xp) => {
    let cur = P.RANKS[0];
    let next = null;
    for (let i = 0; i < P.RANKS.length; i++) {
      if (xp >= P.RANKS[i].xp) { cur = P.RANKS[i]; next = P.RANKS[i + 1] || null; }
    }
    return { cur, next };
  };

  P.coreDaysTotal = () => Object.values(WS.S().days).filter((d) => d.core).length;

  /* ---------- Tonight's plan ---------- */
  // Phase 1 week-by-week table from the Drill Library.
  P.PHASE1 = [
    null,
    { score: 'Gymnopédie No. 1: set up the score, then bars 1–8', ear: 'E1 in C', harmony: 'H1 major and minor: C, F, B♭, E♭, A♭, D♭', improv: 'I1 shape A, left hand only: C, F, B♭' },
    { score: 'Gymnopédie: bars 9–16', ear: 'E1 in G, then F', harmony: 'H1 all four qualities, all 12 keys', improv: 'I1 shape A: E♭, A♭, D♭, G♭; right-hand chord tones in C' },
    { score: 'Gymnopédie: bars 17–24', ear: 'E2: Twinkle Twinkle, Ode to Joy', harmony: 'H2 major ladders, all 12 keys', improv: 'I1 shape B: C, F, B♭, E♭; right-hand chord tones in F' },
    { score: 'Gymnopédie: bars 25–32', ear: 'E2: Amazing Grace, Happy Birthday', harmony: 'H2 minor ladders; H3 in all 12 keys', improv: 'I1 both shapes, all 12 keys (pass test)' },
    { score: 'Gymnopédie: the rest (mark the bars that differ)', ear: 'E3: Twist and Shout', harmony: 'H4: C, F, B♭, E♭, A♭, D♭', improv: 'I2 in C, with I3 as a warmup' },
    { score: 'Gymnopédie: whole piece with pedal and dynamics; record it', ear: 'E3: Stand By Me', harmony: 'Tue H4: G♭, B, E, A, D, G · Fri H6', improv: 'I2 in F and B♭' },
    { score: 'Chopin Prelude in E minor: set up the score, then bars 1–6', ear: 'E3: With or Without You', harmony: 'Tue H5 · Fri H6', improv: 'I2 in E♭ and G' },
    { score: 'Chopin: bars 7–12', ear: 'E3: Perfect, then check all four answers', harmony: 'Tue H7: C, F, B♭, E♭, A♭, D♭ · Fri H6', improv: 'I4 in C and F' },
    { score: 'Chopin: bars 13–18', ear: 'E4 + a song you choose, melody and bass', harmony: 'Tue H7: G♭, B, E, A, D, G · Fri H8', improv: 'I4 in B♭, E♭, G' },
    { score: 'Chopin: bars 19–25', ear: 'E4 + a second song', harmony: 'H9, all 12 keys', improv: 'I5 in C and F' },
    { score: 'Chopin: whole piece, hands together', ear: 'E4 + a third song', harmony: 'H10, all 12 keys', improv: 'I5 in B♭ and G' },
    { score: 'Chopin: dynamics and pedal; record it', ear: 'Milestone check: 3 songs, melody and bass', harmony: 'H11, all 12 keys', improv: 'Phase 1 test (on the I5 card)' },
  ];
  // Which app levels serve each week's drill. Empty = not in the app yet.
  const APP_MAP = {
    harmony: { 1: ['h1-maj', 'h1-min', 'h1-mix'], 2: ['h1-dimaug', 'h1-all'], 5: ['h4-maj7-dom7', 'h4-min7-hdim'], 6: ['h4-dim7', 'h4-all'], 7: ['h4-all'] },
    improv: { 1: ['i1-a'], 2: ['i1-a'], 3: ['i1-b'], 4: ['i1-ab'] },
  };
  const ROTATION = ['ear', 'harmony', 'improv', 'ear', 'harmony', 'improv', 'review']; // Mon..Sun

  P.weekNumber = (k = WS.todayKey()) => {
    const s = WS.S().settings;
    return Math.max(1, Math.floor(WS.daysBetween(s.planStart, k) / 7) + 1);
  };

  P.tonight = (k = WS.todayKey()) => {
    const week = P.weekNumber(k);
    const dow = WS.dowIndex(k);
    const focus = ROTATION[dow];
    const row = P.PHASE1[week] || null;
    const plan = { week, dow, focus, row, phase: week <= 12 ? 1 : 2 };
    if (focus === 'harmony' || focus === 'improv') {
      plan.drill = row ? row[focus] : null;
      const ids = (APP_MAP[focus][week] || []).filter((id) => WS.levels.isUnlocked(id));
      // First mapped level that still needs a silver star; else the lane's next level
      let pick = ids.find((id) => WS.levels.state(id).stars[0].s == null) || ids.find((id) => WS.levels.state(id).stars[1].s == null);
      if (!pick) pick = ids.length ? ids[ids.length - 1] : null;
      plan.levelId = pick;
      plan.inApp = !!(APP_MAP[focus][week] || []).length;
      if (!pick) plan.fallbackLevel = WS.levels.nextInLane(focus);
    } else if (focus === 'ear') {
      plan.drill = row ? row.ear : null;
      plan.inApp = false;
    } else {
      plan.drill = 'Record your score piece and one improv clip, then look over the week.';
      plan.inApp = false;
    }
    return plan;
  };
})();
