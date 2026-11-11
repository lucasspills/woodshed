/* Practice log: a session timer, logged sessions, minutes tracked automatically from the keyboard,
   and the numbers and plain-language insights the Stats screen shows. */
(function () {
  const LG = (WS.log = {});

  LG.AREAS = [
    { id: 'reading', name: 'Sight-reading' },
    { id: 'score', name: 'Score piece' },
    { id: 'harmony', name: 'Harmony' },
    { id: 'ear', name: 'Ear' },
    { id: 'improv', name: 'Improv' },
    { id: 'technique', name: 'Technique' },
    { id: 'repertoire', name: 'Old songs' },
    { id: 'free', name: 'Free play' },
    { id: 'metronome', name: 'Metronome work' },
  ];
  LG.AREA = Object.fromEntries(LG.AREAS.map((a) => [a.id, a]));

  const st = () => {
    const s = WS.S();
    if (!s.log) s.log = [];
    if (!s.activity) s.activity = {};
    return s;
  };

  /* ---------- Automatic tracking ----------
     Any note you play counts as practice time, as long as the gap since the last note is under 20 seconds.
     The area comes from the screen you're on. */
  const GAP = 20;
  let last = 0;
  LG.areaNow = () => {
    const ui = WS.ui || {};
    if (ui._runner) { const d = ui._runner.plan && ui._runner.plan.def; return d ? d.lane : 'harmony'; }
    if (ui._earActive) return 'ear';
    if (ui.current === 'metronome' || (WS.metro && WS.metro.running)) return 'metronome';
    if (ui.current === 'play') return 'free';
    if (ui.current === 'ear') return 'ear';
    return 'free';
  };
  LG.track = (perfNow) => {
    const s = st();
    const now = perfNow || performance.now();
    const day = WS.todayKey();
    const a = (s.activity[day] = s.activity[day] || { sec: 0, notes: 0, areas: {}, hours: {} });
    a.notes++;
    if (last && now - last < GAP * 1000) {
      const dt = (now - last) / 1000;
      const area = LG.areaNow();
      a.sec += dt;
      a.areas[area] = (a.areas[area] || 0) + dt;
      const hr = new Date(WS.nowMs()).getHours();
      a.hours[hr] = (a.hours[hr] || 0) + dt;
      if (LG.session) LG.session.played += dt;
    }
    last = now;
    WS.store.save();
  };
  WS.bus.on('noteon', (e) => { if (e && e.src === 'playback') return; LG.track(); });

  /* ---------- The session timer ---------- */
  LG.session = null; // { start (ms), areas, played (sec of notes while running) }
  LG.startSession = (areas = []) => {
    LG.session = { start: WS.nowMs(), areas, played: 0, paused: 0, pausedAt: null };
    WS.S().openSession = LG.session;
    WS.store.save();
    WS.bus.emit('session', { on: true });
  };
  LG.pauseSession = () => {
    const x = LG.session;
    if (!x) return;
    if (x.pausedAt) { x.paused += WS.nowMs() - x.pausedAt; x.pausedAt = null; } else x.pausedAt = WS.nowMs();
    WS.store.save();
    WS.bus.emit('session', { on: true });
  };
  LG.sessionSecs = () => {
    const x = LG.session;
    if (!x) return 0;
    const end = x.pausedAt || WS.nowMs();
    return Math.max(0, (end - x.start - x.paused) / 1000);
  };
  LG.cancelSession = () => { LG.session = null; delete WS.S().openSession; WS.store.save(); WS.bus.emit('session', { on: false }); };
  LG.restoreSession = () => { const o = WS.S().openSession; if (o) LG.session = o; };

  /* Save a log entry. Logging sight-reading or the score piece also ticks them on Tonight. */
  LG.add = (e) => {
    const s = st();
    const entry = {
      id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      day: e.day || WS.todayKey(),
      at: e.at || new Date(WS.nowMs()).toISOString(),
      minutes: Math.max(1, Math.round(e.minutes || 0)),
      areas: e.areas || [],
      piece: e.piece || '',
      bpm: e.bpm ? Number(e.bpm) : null,
      rating: e.rating || null,
      notes: e.notes || '',
      timed: !!e.timed,
    };
    s.log.push(entry);
    s.log.sort((a, b) => (a.at < b.at ? -1 : 1));
    if (entry.areas.includes('reading')) WS.progress.day(entry.day).sight || WS.progress.setTask(entry.day, 'sight', true);
    if (entry.areas.includes('score')) WS.progress.day(entry.day).score || WS.progress.setTask(entry.day, 'score', true);
    WS.store.save();
    WS.bus.emit('log', entry);
    return entry;
  };
  LG.update = (id, patch) => {
    const e = st().log.find((x) => x.id === id);
    if (e) Object.assign(e, patch);
    WS.store.save();
  };
  LG.remove = (id) => {
    const s = st();
    s.log = s.log.filter((x) => x.id !== id);
    WS.store.save();
  };
  LG.finishSession = (form) => {
    const x = LG.session;
    const minutes = form.minutes != null ? form.minutes : Math.round(LG.sessionSecs() / 60);
    LG.session = null;
    delete WS.S().openSession;
    const e = LG.add({ ...form, minutes, timed: true, at: x ? new Date(x.start).toISOString() : undefined });
    WS.bus.emit('session', { on: false });
    return e;
  };

  /* ---------- Numbers ----------
     Minutes per day blend the two sources: logged sessions, and played time the keyboard saw.
     A day counts whichever is larger, so a logged session and the notes inside it aren't counted twice. */
  LG.dayMinutes = (k) => {
    const s = st();
    const logged = s.log.filter((e) => e.day === k).reduce((a, e) => a + e.minutes, 0);
    const act = s.activity[k] ? s.activity[k].sec / 60 : 0;
    const rounds = (s.days[k] && s.days[k].minutes) || 0;
    return Math.max(logged, act, rounds);
  };
  LG.areaMinutes = (fromKey, toKey) => {
    const s = st();
    const out = {};
    for (const e of s.log) {
      if (e.day < fromKey || e.day > toKey) continue;
      const per = e.minutes / Math.max(1, e.areas.length || 1);
      (e.areas.length ? e.areas : ['free']).forEach((a) => { out[a] = (out[a] || 0) + per; });
    }
    // Played time from the keyboard counts for the areas with no logged session that day
    for (const [k, a] of Object.entries(s.activity)) {
      if (k < fromKey || k > toKey) continue;
      if (s.log.some((e) => e.day === k)) continue;
      for (const [ar, sec] of Object.entries(a.areas || {})) out[ar] = (out[ar] || 0) + sec / 60;
    }
    return out;
  };
  LG.rangeMinutes = (fromKey, toKey) => {
    let n = 0;
    for (let k = fromKey; k <= toKey; k = WS.addDays(k, 1)) n += LG.dayMinutes(k);
    return n;
  };
  LG.totalMinutes = () => {
    const s = st();
    const days = new Set([...Object.keys(s.activity), ...s.log.map((e) => e.day), ...Object.keys(s.days)]);
    let n = 0;
    for (const k of days) n += LG.dayMinutes(k);
    return n;
  };
  LG.activeDays = (fromKey, toKey) => {
    let n = 0;
    for (let k = fromKey; k <= toKey; k = WS.addDays(k, 1)) if (LG.dayMinutes(k) >= 1) n++;
    return n;
  };
  LG.longestStreak = () => {
    const s = WS.S();
    const keys = Object.keys(s.days).filter((k) => s.days[k].core || s.days[k].freeze).sort();
    let best = 0; let cur = 0; let prev = null;
    for (const k of keys) {
      cur = prev && WS.daysBetween(prev, k) === 1 ? cur + 1 : 1;
      best = Math.max(best, cur);
      prev = k;
    }
    return best;
  };
  LG.fmtMin = (m) => {
    m = Math.round(m);
    if (m < 60) return `${m} min`;
    const hrs = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${hrs} h ${r} min` : `${hrs} h`;
  };

  /* Best passing tempo per Chord Runner level, by day, for the tempo chart */
  LG.tempoHistory = (levelId) => {
    const by = {};
    for (const r of WS.S().rounds) {
      if (r.level !== levelId || !r.passed) continue;
      by[r.day] = Math.max(by[r.day] || 0, r.tempo);
    }
    return Object.entries(by).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  };

  /* ---------- Insights: plain-language observations from your data ---------- */
  LG.insights = () => {
    const s = WS.S();
    const T = WS.theory;
    const today = WS.todayKey();
    const out = [];
    const add = (kind, text, weight) => out.push({ kind, text, weight });

    // This week vs last week
    const thisMon = WS.mondayOf(today);
    const lastMon = WS.addDays(thisMon, -7);
    const dow = WS.dowIndex(today);
    const thisWk = LG.rangeMinutes(thisMon, today);
    const lastSame = LG.rangeMinutes(lastMon, WS.addDays(lastMon, dow));
    if (thisWk >= 5 && lastSame >= 5) {
      const ch = Math.round(((thisWk - lastSame) / lastSame) * 100);
      if (ch >= 15) add('up', `You’ve practised ${LG.fmtMin(thisWk)} so far this week, ${ch}% more than by this point last week.`, 3);
      else if (ch <= -25) add('down', `${LG.fmtMin(thisWk)} so far this week, ${Math.abs(ch)}% less than by this point last week. Even a 15-minute core night keeps it moving.`, 4);
    } else if (thisWk >= 5) add('info', `${LG.fmtMin(thisWk)} of practice so far this week.`, 1);

    // Weekly goal
    const wk = WS.progress.weekCount(today);
    const left = WS.progress.WEEK_GOAL - wk;
    const daysLeft = 6 - dow + (WS.progress.day(today).core ? 0 : 1);
    if (left > 0 && left <= daysLeft) add('goal', `${left} more core ${left === 1 ? 'day' : 'days'} this week for the weekly goal (+100 XP), and ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left to get ${left === 1 ? 'it' : 'them'}.`, 5);
    else if (left > daysLeft) add('goal', 'The weekly goal is out of reach this week, but every core day still counts for your streak.', 2);

    // Neglected areas (last 14 days), among the four focus lanes
    const from14 = WS.addDays(today, -13);
    const am = LG.areaMinutes(from14, today);
    const earRounds = (s.earRounds || []).filter((r) => r.day >= from14).length;
    const hasLogs = s.log.length > 0 || Object.keys(s.activity).length > 2;
    if (hasLogs) {
      const lanes = { harmony: (am.harmony || 0) + s.rounds.filter((r) => r.day >= from14 && WS.levels.def(r.level) && WS.levels.def(r.level).lane === 'harmony').length * 2, improv: (am.improv || 0) + s.rounds.filter((r) => r.day >= from14 && WS.levels.def(r.level) && WS.levels.def(r.level).lane === 'improv').length * 2, ear: (am.ear || 0) + earRounds * 3, reading: am.reading || 0 };
      const sorted = Object.entries(lanes).sort((a, b) => a[1] - b[1]);
      const [low, lowMin] = sorted[0];
      const [high, highMin] = sorted[sorted.length - 1];
      if (highMin > 20 && lowMin < highMin * 0.25) add('balance', `In the last two weeks ${LG.AREA[high].name.toLowerCase()} got the most time and ${LG.AREA[low].name.toLowerCase()} the least. Give ${LG.AREA[low].name.toLowerCase()} the next free focus block.`, 4);
    }

    // Chord-quality weak spot and improvement
    const byQ = {};
    for (const [key, it] of Object.entries(s.items)) {
      const [q] = key.split(':');
      if (!T.Q[q] || !it.recent.length) continue;
      (byQ[q] = byQ[q] || []).push(...it.recent);
    }
    const qAcc = Object.entries(byQ).filter(([, v]) => v.length >= 8).map(([q, v]) => [q, v.reduce((a, b) => a + b, 0) / v.length]);
    if (qAcc.length >= 2) {
      qAcc.sort((a, b) => a[1] - b[1]);
      const [wq, wa] = qAcc[0];
      const [bq, ba] = qAcc[qAcc.length - 1];
      if (ba - wa > 0.08) add('weak', `${T.Q[wq].name[0].toUpperCase()}${T.Q[wq].name.slice(1)} chords are your weakest quality right now (${Math.round(wa * 100)}% vs ${Math.round(ba * 100)}% for ${T.Q[bq].name}).`, 4);
    }
    const byRoot = {};
    for (const [key, it] of Object.entries(s.items)) {
      const [q, pc] = key.split(':');
      if (!T.Q[q] || !it.recent.length) continue;
      (byRoot[pc] = byRoot[pc] || []).push(...it.recent);
    }
    const rAcc = Object.entries(byRoot).filter(([, v]) => v.length >= 6).map(([pc, v]) => [Number(pc), v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => a[1] - b[1]);
    if (rAcc.length >= 4 && rAcc[0][1] < 0.85) {
      const names = rAcc.slice(0, 2).filter((x) => x[1] < 0.9).map((x) => T.MAJ_FAM_ROOT[x[0]]);
      add('weak', `Your slowest roots are ${names.join(' and ')}. Two Chord Runner rounds in those keys would close the gap fastest.`, 3);
    }

    // Tempo gains on Chord Runner over the last 4 weeks
    const from28 = WS.addDays(today, -27);
    for (const d of WS.levels.LEVELS) {
      const hist = LG.tempoHistory(d.id);
      const recent = hist.filter(([k]) => k >= from28);
      if (recent.length >= 2) {
        const gain = recent[recent.length - 1][1] - recent[0][1];
        if (gain >= 8) add('up', `${d.name}: you went from ♩ = ${recent[0][1]} to ♩ = ${recent[recent.length - 1][1]} in the last four weeks.`, 3);
      }
    }

    // Ear: weakest scale degree from the Degrees game
    const deg = s.earItems || {};
    const dAcc = Object.entries(deg).filter(([k, v]) => k.startsWith('deg:') && v.n >= 4).map(([k, v]) => [k.slice(4), v.ok / v.n]).sort((a, b) => a[1] - b[1]);
    if (dAcc.length >= 3 && dAcc[0][1] < 0.8) add('weak', `Scale degree ${dAcc[0][0]} is the one your ear misses most (${Math.round(dAcc[0][1] * 100)}%). Sing down from it to 1 a few times before your next round.`, 3);

    // When you practise
    const hours = {};
    for (const a of Object.values(s.activity)) for (const [hr, sec] of Object.entries(a.hours || {})) hours[hr] = (hours[hr] || 0) + sec;
    const totalH = Object.values(hours).reduce((a, b) => a + b, 0);
    if (totalH > 1800) {
      const [bh] = Object.entries(hours).sort((a, b) => b[1] - a[1])[0];
      const hr = Number(bh);
      const label = new Date(2000, 0, 1, hr).toLocaleTimeString([], { hour: 'numeric' });
      add('info', `Most of your playing happens around ${label}. Protect that slot.`, 1);
    }

    // Score piece neglect
    let lastScore = null;
    for (const [k, d] of Object.entries(s.days)) if (d.score && (!lastScore || k > lastScore)) lastScore = k;
    if (lastScore && WS.daysBetween(lastScore, today) >= 4) add('down', `It’s been ${WS.daysBetween(lastScore, today)} days since you ticked the score piece. It’s the skill that gets you to Clair de Lune.`, 4);

    // Ratings
    const rated = s.log.filter((e) => e.rating && e.day >= from14);
    if (rated.length >= 4) {
      const avg = rated.reduce((a, e) => a + e.rating, 0) / rated.length;
      if (avg <= 2.5) add('down', 'Your recent sessions are rated low. Rule of the roadmap: stuck for two weeks? Make it smaller: slower tempo, shorter passage.', 4);
      else if (avg >= 4) add('up', `Your sessions in the last two weeks average ${avg.toFixed(1)} out of 5. Keep the same shape.`, 2);
    }

    // Metronome timing tendency
    const mt = (s.metroStats || {}).recent;
    if (mt && mt.length >= 3) {
      const m = mt.reduce((a, x) => a + x.mean, 0) / mt.length;
      if (Math.abs(m) >= 12) add('info', `With the metronome you tend to play ${Math.round(Math.abs(m))} ms ${m < 0 ? 'ahead (rushing)' : 'behind (dragging)'}. Try the gap trainer to lock in your inner pulse.`, 3);
    }

    // Roadmap
    const RM = WS.roadmap;
    const ph = RM.currentPhase();
    const pp = RM.phaseProgress(ph);
    if (pp.passed + pp.checks > 0) add('info', `Phase ${ph}: ${pp.passed} of ${pp.drills} drills passed and ${pp.checks} of ${pp.checkTotal} milestones ticked.`, 2);

    out.sort((a, b) => b.weight - a.weight);
    return out;
  };
})();
