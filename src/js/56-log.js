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
    }
    last = now;
    LG.onNote();
    WS.store.save();
  };
  WS.bus.on('noteon', (e) => { if (e && e.src === 'playback') return; LG.track(); });

  /* ---------- Automatic sessions ----------
     The first note opens a session; 10 minutes without a note closes it. Gaps over 3 minutes inside a
     session don't count as practice. What you did in the app (rounds, ear games, metronome, recordings)
     is collected as you go. When a session closes with free play the app can't label, it asks once. */
  LG.GAP_END = 10 * 60 * 1000;
  LG.BREAK = 3 * 60 * 1000;
  LG.MIN_KEEP = 2;
  LG.session = null; // { start, last, active (ms), areaMs, did: [] }

  const openSession = (now) => {
    LG.session = { start: now, last: now, active: 0, areaMs: {}, did: [] };
    WS.S().openSession = LG.session;
    WS.bus.emit('session', { on: true });
    return LG.session;
  };
  LG.onNote = () => {
    const now = WS.nowMs();
    let x = LG.session;
    if (x && now - x.last > LG.GAP_END) { LG.closeSession(); x = null; }
    if (!x) x = openSession(now);
    else {
      const gap = now - x.last;
      if (gap > 0 && gap < LG.BREAK) {
        x.active += gap;
        const ar = LG.areaNow();
        x.areaMs[ar] = (x.areaMs[ar] || 0) + gap;
      }
    }
    x.last = now;
  };
  LG.sessionMinutes = () => (LG.session ? LG.session.active / 60000 : 0);
  LG.note = (item) => { if (LG.session) { LG.session.did.push(item); WS.store.save(); } };

  /* One line describing what happened in a session */
  LG.describe = (did) => {
    const parts = [];
    const cr = did.filter((d) => d.t === 'cr');
    const byLevel = {};
    cr.forEach((d) => { const b = (byLevel[d.id] = byLevel[d.id] || { n: 0, tempo: 0, best: 0, total: d.n }); b.n++; b.tempo = Math.max(b.tempo, d.tempo); b.best = Math.max(b.best, d.hits); });
    for (const [id, b] of Object.entries(byLevel)) {
      const def = WS.levels.def(id);
      parts.push(`${def ? def.name : id}: ${b.n} round${b.n > 1 ? 's' : ''}, best ${b.best}/${b.total} at ♩ ${b.tempo}`);
    }
    const ear = did.filter((d) => d.t === 'ear');
    const byGame = {};
    ear.forEach((d) => { const k = `${d.gid}:${d.li}`; const b = (byGame[k] = byGame[k] || { n: 0, best: 0, d }); b.n++; b.best = Math.max(b.best, d.score); });
    for (const b of Object.values(byGame)) {
      const g = WS.ear && WS.ear.def(b.d.gid);
      parts.push(`${g ? `${g.name}, ${g.levels[b.d.li].name}` : b.d.gid}: best ${b.best}/10`);
    }
    const mt = did.filter((d) => d.t === 'metro');
    if (mt.length) {
      const secs = mt.reduce((a, d) => a + d.secs, 0);
      const bpms = [...new Set(mt.map((d) => d.bpm))];
      parts.push(`Metronome ${LG.fmtMin(secs / 60)} at ♩ ${bpms.slice(0, 3).join(', ')} (${mt[mt.length - 1].pattern})`);
    }
    const rc = did.filter((d) => d.t === 'rec');
    if (rc.length) parts.push(`${rc.length} recording${rc.length > 1 ? 's' : ''}`);
    return parts.join(' · ');
  };

  LG.closeSession = () => {
    const x = LG.session;
    LG.session = null;
    delete WS.S().openSession;
    if (!x) return null;
    const minutes = x.active / 60000;
    WS.bus.emit('session', { on: false });
    if (minutes < LG.MIN_KEEP) { WS.store.save(); return null; }
    const areaMin = {};
    for (const [a, ms] of Object.entries(x.areaMs)) if (ms >= 20000) areaMin[a] = Math.round((ms / 60000) * 10) / 10;
    const day = WS.dateKey(new Date(x.start));
    const e = LG.add({
      day, at: new Date(x.start).toISOString(), minutes: Math.round(minutes),
      areas: Object.keys(areaMin), areaMin, auto: true, summary: LG.describe(x.did),
      ask: (areaMin.free || 0) >= LG.MIN_KEEP,
    });
    if (e.ask) WS.bus.emit('log-ask', e);
    return e;
  };

  /* The one-tap answer: what was the free play? */
  LG.ASK_CHOICES = [
    ['reading', 'Sight-reading'], ['score', 'Score piece'], ['both', 'Both of those'],
    ['improv', 'Improv'], ['ear', 'Songs by ear'], ['repertoire', 'Old songs'], ['free', 'Just playing'],
  ];
  LG.pendingAsk = () => (st().log || []).filter((e) => e.ask).slice(-1)[0] || null;
  LG.answerAsk = (id, choice) => {
    const e = st().log.find((x) => x.id === id);
    if (!e) return;
    e.ask = false;
    const free = (e.areaMin && e.areaMin.free) || 0;
    if (choice !== 'free' && free) {
      delete e.areaMin.free;
      const to = choice === 'both' ? ['reading', 'score'] : [choice];
      to.forEach((a) => { e.areaMin[a] = Math.round(((e.areaMin[a] || 0) + free / to.length) * 10) / 10; });
      e.areas = Object.keys(e.areaMin);
      if (to.includes('reading')) WS.progress.setTask(e.day, 'sight', true);
      if (to.includes('score')) WS.progress.setTask(e.day, 'score', true);
    }
    e.answered = choice;
    WS.store.save();
    WS.bus.emit('log', e);
  };
  LG.dismissAsk = (id) => { const e = st().log.find((x) => x.id === id); if (e) { e.ask = false; WS.store.save(); } };

  LG.restoreSession = () => {
    const o = WS.S().openSession;
    if (!o) return;
    LG.session = o;
    if (!o.did) o.did = [];
    if (WS.nowMs() - o.last > LG.GAP_END) LG.closeSession();
  };
  setInterval(() => { if (LG.session && WS.nowMs() - LG.session.last > LG.GAP_END) LG.closeSession(); }, 15000);

  // What you did, collected into the open session
  WS.bus.on('round', (d) => LG.note({ t: 'cr', id: d.id, tempo: d.tempo, hits: d.hits, n: d.n }));
  WS.bus.on('ear', (d) => LG.note({ t: 'ear', gid: d.gid, li: d.li, score: d.score }));
  WS.bus.on('metro', (d) => { if (d.running === false && d.secs > 20 && d.cfg) LG.note({ t: 'metro', secs: d.secs, bpm: d.bpm, pattern: WS.metro.patternLabel(d.cfg.seq) }); });
  WS.bus.on('record', () => LG.note({ t: 'rec' }));

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
      auto: !!e.auto,
      areaMin: e.areaMin || null,
      summary: e.summary || '',
      ask: !!e.ask,
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
      if (e.areaMin && Object.keys(e.areaMin).length) { for (const [a, m] of Object.entries(e.areaMin)) out[a] = (out[a] || 0) + m; continue; }
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
