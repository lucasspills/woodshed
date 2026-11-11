/* Achievements: milestones across practice, games, ear, metronome, recordings and the roadmap.
   Each one is checked against your saved data whenever something happens; unlocking pays a little XP. */
(function () {
  const s0 = () => WS.S();
  const L = () => WS.levels;
  const cnt = (cur, goal) => ({ cur: Math.min(cur, goal), goal });
  const golds = () => L().LEVELS.reduce((n, d) => n + L().goldCount(L().state(d.id)), 0);
  const silvers = () => L().LEVELS.reduce((n, d) => n + L().silverCount(L().state(d.id)), 0);
  const hours = () => (WS.log ? WS.log.totalMinutes() / 60 : 0);
  const earPasses = () => WS.ear ? WS.ear.GAMES.reduce((n, g) => n + g.levels.filter((_, i) => WS.ear.levelState(g.id, i).passed).length, 0) : 0;
  const earTotal = () => WS.ear ? WS.ear.GAMES.reduce((n, g) => n + g.levels.length, 0) : 1;
  const recs = () => (s0().recordings || []);
  const roadPassed = () => Object.keys((s0().roadmap || {}).passed || {}).length;
  const ms = () => s0().metroStats || {};

  /* tier: 1 bronze-ish (sage), 2 silver, 3 gold. xp paid on unlock. */
  const A = [
    // Consistency
    { id: 'first-core', cat: 'Consistency', name: 'First night in the shed', desc: 'Finish the daily core once.', tier: 1, xp: 25, check: () => cnt(WS.progress.coreDaysTotal(), 1) },
    { id: 'week-goal', cat: 'Consistency', name: 'Five for five', desc: 'Hit the weekly goal: 5 core days in one week.', tier: 1, xp: 50, check: () => cnt(Object.keys(s0().weeksAwarded).length, 1) },
    { id: 'week-goal-4', cat: 'Consistency', name: 'A month of weeks', desc: 'Hit the weekly goal 4 times.', tier: 2, xp: 100, check: () => cnt(Object.keys(s0().weeksAwarded).length, 4) },
    { id: 'streak-3', cat: 'Consistency', name: 'Warming up', desc: 'A 3-day streak.', tier: 1, xp: 25, check: () => cnt(Math.max(WS.progress.streak(), WS.log.longestStreak()), 3) },
    { id: 'streak-7', cat: 'Consistency', name: 'Week in the woods', desc: 'A 7-day streak.', tier: 1, xp: 50, check: () => cnt(Math.max(WS.progress.streak(), WS.log.longestStreak()), 7) },
    { id: 'streak-30', cat: 'Consistency', name: 'Habit formed', desc: 'A 30-day streak.', tier: 2, xp: 150, check: () => cnt(Math.max(WS.progress.streak(), WS.log.longestStreak()), 30) },
    { id: 'streak-100', cat: 'Consistency', name: 'Hundred nights', desc: 'A 100-day streak.', tier: 3, xp: 400, check: () => cnt(Math.max(WS.progress.streak(), WS.log.longestStreak()), 100) },
    { id: 'freeze', cat: 'Consistency', name: 'Insurance', desc: 'Earn a streak freeze.', tier: 1, xp: 25, check: () => cnt(s0().freezes > 0 || WS.progress.coreDaysTotal() >= 7 ? 1 : 0, 1) },
    { id: 'core-50', cat: 'Consistency', name: 'Fifty cores', desc: '50 core days in total.', tier: 2, xp: 150, check: () => cnt(WS.progress.coreDaysTotal(), 50) },
    // Time
    { id: 'hours-1', cat: 'Time', name: 'First hour', desc: '1 hour of practice tracked.', tier: 1, xp: 25, check: () => cnt(Math.floor(hours()), 1) },
    { id: 'hours-10', cat: 'Time', name: 'Ten hours', desc: '10 hours of practice tracked.', tier: 2, xp: 100, check: () => cnt(Math.floor(hours()), 10) },
    { id: 'hours-50', cat: 'Time', name: 'Fifty hours', desc: '50 hours of practice tracked.', tier: 2, xp: 250, check: () => cnt(Math.floor(hours()), 50) },
    { id: 'hours-100', cat: 'Time', name: 'Hundred-hour club', desc: '100 hours of practice tracked.', tier: 3, xp: 500, check: () => cnt(Math.floor(hours()), 100) },
    { id: 'log-first', cat: 'Time', name: 'Dear diary', desc: 'Log your first practice session.', tier: 1, xp: 25, check: () => cnt((s0().log || []).length, 1) },
    { id: 'log-hour', cat: 'Time', name: 'Deep work', desc: 'Log a single session of 60 minutes or more.', tier: 2, xp: 75, check: () => cnt((s0().log || []).some((e) => e.minutes >= 60) ? 1 : 0, 1) },
    { id: 'night-owl', cat: 'Time', name: 'Night owl', desc: 'Play after midnight.', tier: 1, xp: 25, secret: true, check: () => cnt(Object.values(s0().activity || {}).some((a) => [0, 1, 2, 3].some((h) => (a.hours || {})[h] > 30)) ? 1 : 0, 1) },
    { id: 'early-bird', cat: 'Time', name: 'Early bird', desc: 'Play before 8 in the morning.', tier: 1, xp: 25, secret: true, check: () => cnt(Object.values(s0().activity || {}).some((a) => [5, 6, 7].some((h) => (a.hours || {})[h] > 30)) ? 1 : 0, 1) },
    // Chord Runner
    { id: 'first-silver', cat: 'Chord Runner', name: 'First star', desc: 'Earn a silver star.', tier: 1, xp: 25, check: () => cnt(silvers(), 1) },
    { id: 'first-gold', cat: 'Chord Runner', name: 'It stuck', desc: 'Earn a gold star on a cold check.', tier: 1, xp: 50, check: () => cnt(golds(), 1) },
    { id: 'gold-10', cat: 'Chord Runner', name: 'Gold rush', desc: 'Earn 10 gold stars.', tier: 2, xp: 150, check: () => cnt(golds(), 10) },
    { id: 'gold-all', cat: 'Chord Runner', name: 'Solid gold', desc: 'Every star on every level, gold.', tier: 3, xp: 500, check: () => cnt(golds(), L().LEVELS.length * 3) },
    { id: 'flawless', cat: 'Chord Runner', name: 'Flawless', desc: 'A round with every chord landed.', tier: 1, xp: 25, check: () => cnt(s0().rounds.some((r) => r.hits === r.n) ? 1 : 0, 1) },
    { id: 'perfect-12', cat: 'Chord Runner', name: 'Metronomic', desc: 'A round with all 12 chords perfectly on the beat.', tier: 2, xp: 100, check: () => cnt(s0().rounds.some((r) => r.perfects === r.n) ? 1 : 0, 1) },
    { id: 'triads', cat: 'Chord Runner', name: 'Every triad', desc: 'Silver on All four triads.', tier: 1, xp: 50, check: () => cnt(L().state('h1-all').stars[0].s ? 1 : 0, 1) },
    { id: 'sevenths', cat: 'Chord Runner', name: 'Every seventh', desc: 'Silver on All five sevenths.', tier: 2, xp: 75, check: () => cnt(L().state('h4-all').stars[0].s ? 1 : 0, 1) },
    { id: 'all-12', cat: 'Chord Runner', name: 'All 12 keys', desc: 'Pass Shells, both shapes, with all 12 keys in play.', tier: 2, xp: 100, check: () => cnt(L().state('i1-ab').stars[0].s ? 1 : 0, 1) },
    { id: 'speed', cat: 'Chord Runner', name: 'Up to speed', desc: 'Earn star 2 (target tempo) on any level.', tier: 1, xp: 50, check: () => cnt(L().LEVELS.some((d) => L().state(d.id).stars[1].s) ? 1 : 0, 1) },
    { id: 'rounds-100', cat: 'Chord Runner', name: 'Hundred rounds', desc: 'Play 100 rounds.', tier: 2, xp: 100, check: () => cnt(s0().rounds.length, 100) },
    // Ear
    { id: 'ear-first', cat: 'Ear', name: 'Open ears', desc: 'Pass your first ear level.', tier: 1, xp: 25, check: () => cnt(earPasses(), 1) },
    { id: 'ear-perfect', cat: 'Ear', name: 'Perfect pitch? Perfect round.', desc: '10 out of 10 in any ear game.', tier: 1, xp: 50, check: () => cnt((s0().earRounds || []).some((r) => r.score === r.n) ? 1 : 0, 1) },
    { id: 'ear-degrees', cat: 'Ear', name: 'Numbers person', desc: 'Pass Degrees: all seven, any key.', tier: 2, xp: 100, check: () => cnt(WS.ear && WS.ear.levelState('degrees', 3).passed ? 1 : 0, 1) },
    { id: 'ear-bass', cat: 'Ear', name: 'Bass detective', desc: 'Pass every Bass Detective level.', tier: 2, xp: 150, check: () => cnt(WS.ear ? WS.ear.GAMES.find((g) => g.id === 'bass').levels.filter((_, i) => WS.ear.levelState('bass', i).passed).length : 0, 4) },
    { id: 'ear-all', cat: 'Ear', name: 'Golden ear', desc: 'Pass every level of every ear game.', tier: 3, xp: 400, check: () => cnt(earPasses(), earTotal()) },
    { id: 'ear-50', cat: 'Ear', name: 'Fifty rounds by ear', desc: 'Play 50 ear rounds.', tier: 2, xp: 100, check: () => cnt((s0().earRounds || []).length, 50) },
    // Metronome
    { id: 'metro-10', cat: 'Metronome', name: 'In the pocket', desc: '10 minutes with the metronome in one go.', tier: 1, xp: 25, check: () => cnt(Math.floor((ms().longest || 0) / 60), 10) },
    { id: 'metro-odd', cat: 'Metronome', name: 'Odd one out', desc: 'Practise in an odd meter (5, 7, 9 or 11 beats).', tier: 1, xp: 25, check: () => cnt(ms().odd ? 1 : 0, 1) },
    { id: 'metro-trainer', cat: 'Metronome', name: 'Speed trainer', desc: 'Ride the tempo trainer all the way to its top tempo.', tier: 1, xp: 50, check: () => cnt(ms().trainerDone || 0, 1) },
    { id: 'metro-tight', cat: 'Metronome', name: 'Locked in', desc: 'A timing check with your notes within 15 ms of the click on average and a spread under 25 ms.', tier: 2, xp: 100, check: () => cnt(ms().tight ? 1 : 0, 1) },
    { id: 'metro-gap', cat: 'Metronome', name: 'Inner clock', desc: 'Play 5 minutes with the gap trainer on.', tier: 2, xp: 75, check: () => cnt(Math.floor((ms().gapSecs || 0) / 60), 5) },
    // Recording
    { id: 'rec-first', cat: 'Recording', name: 'Tape’s rolling', desc: 'Make your first recording.', tier: 1, xp: 25, check: () => cnt(recs().length, 1) },
    { id: 'rec-10', cat: 'Recording', name: 'Archivist', desc: 'Keep 10 recordings.', tier: 2, xp: 75, check: () => cnt(recs().length, 10) },
    { id: 'rec-sunday', cat: 'Recording', name: 'Sunday review', desc: 'Record something on a Sunday.', tier: 1, xp: 25, check: () => cnt(recs().some((r) => WS.dowIndex(r.day) === 6) ? 1 : 0, 1) },
    { id: 'rec-long', cat: 'Recording', name: 'Full take', desc: 'A recording longer than 3 minutes.', tier: 1, xp: 50, check: () => cnt(recs().some((r) => r.dur >= 180) ? 1 : 0, 1) },
    // Roadmap
    { id: 'road-first', cat: 'Roadmap', name: 'On the map', desc: 'Mark your first roadmap drill passed.', tier: 1, xp: 25, check: () => cnt(roadPassed(), 1) },
    { id: 'road-10', cat: 'Roadmap', name: 'Ten drills down', desc: 'Pass 10 roadmap drills.', tier: 2, xp: 150, check: () => cnt(roadPassed(), 10) },
    { id: 'phase-1', cat: 'Roadmap', name: 'Foundation laid', desc: 'Tick every Phase 1 milestone.', tier: 3, xp: 500, check: () => cnt(WS.roadmap.PHASES[0].checks.filter((c) => WS.roadmap.isChecked(c.id)).length, WS.roadmap.PHASES[0].checks.length) },
    { id: 'phase-2', cat: 'Roadmap', name: 'Fluent', desc: 'Tick every Phase 2 milestone.', tier: 3, xp: 750, check: () => cnt(WS.roadmap.PHASES[1].checks.filter((c) => WS.roadmap.isChecked(c.id)).length, WS.roadmap.PHASES[1].checks.length) },
    { id: 'phase-3', cat: 'Roadmap', name: 'Clair de Lune', desc: 'Tick every Phase 3 milestone.', tier: 3, xp: 1000, check: () => cnt(WS.roadmap.PHASES[2].checks.filter((c) => WS.roadmap.isChecked(c.id)).length, WS.roadmap.PHASES[2].checks.length) },
    // Ranks
    { id: 'rank-session', cat: 'Ranks', name: 'Session player', desc: 'Reach 1,500 XP.', tier: 1, xp: 0, check: () => cnt(s0().xp, 1500) },
    { id: 'rank-soloist', cat: 'Ranks', name: 'Soloist', desc: 'Reach 6,000 XP.', tier: 2, xp: 0, check: () => cnt(s0().xp, 6000) },
    { id: 'rank-virtuoso', cat: 'Ranks', name: 'Virtuoso', desc: 'Reach 20,000 XP.', tier: 3, xp: 0, check: () => cnt(s0().xp, 20000) },
  ];

  const AC = (WS.ach = { LIST: A, BY: Object.fromEntries(A.map((a) => [a.id, a])) });
  AC.st = () => { const s = s0(); if (!s.ach) s.ach = {}; return s.ach; };
  AC.has = (id) => !!AC.st()[id];
  AC.progress = (a) => { try { return a.check(); } catch (e) { return { cur: 0, goal: 1 }; } };

  let pending = false;
  let quiet = true; // the first check after boot unlocks silently (old progress), no toasts
  AC.check = () => {
    const got = AC.st();
    const fresh = [];
    for (const a of A) {
      if (got[a.id]) continue;
      const p = AC.progress(a);
      if (p.cur >= p.goal) {
        got[a.id] = WS.todayKey();
        if (a.xp) { s0().xp += a.xp; WS.progress.day(WS.todayKey()).xp += a.xp; }
        fresh.push(a);
      }
    }
    if (fresh.length) {
      WS.store.save();
      if (!quiet) AC.celebrate(fresh);
      WS.bus.emit('achievement', fresh);
    }
    quiet = false;
    return fresh;
  };
  AC.schedule = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; AC.check(); }, 60);
  };
  AC.celebrate = (list) => {
    const a = list[0];
    const more = list.length > 1 ? ` (+${list.length - 1} more)` : '';
    WS.toast(`Achievement: ${a.name}${a.xp ? ` · +${a.xp} XP` : ''}${more}`, 4200);
    if (WS.audio.ctx) WS.audio.sfx('gold');
  };
  ['progress', 'round', 'ear', 'log', 'metro', 'metro-trainer-done', 'record', 'roadmap', 'session'].forEach((evt) => WS.bus.on(evt, AC.schedule));
  AC.boot = () => { quiet = true; AC.check(); };

  /* Metronome stats that achievements and insights read */
  WS.bus.on('metro', (e) => {
    if (e.running !== false || !e.cfg) return;
    const s = s0();
    const m = (s.metroStats = s.metroStats || {});
    m.totalSecs = (m.totalSecs || 0) + e.secs;
    m.longest = Math.max(m.longest || 0, e.secs);
    if (e.secs > 20 && e.cfg.seq.some((b) => [5, 7, 9, 11].includes(b.beats))) m.odd = true;
    if (e.cfg.gap.on) m.gapSecs = (m.gapSecs || 0) + e.secs;
    const t = WS.metro.timingSummary();
    if (t && t.n >= 16) {
      m.recent = [...(m.recent || []), { day: WS.todayKey(), mean: Math.round(t.mean), sd: Math.round(t.sd), n: t.n }].slice(-20);
      if (Math.abs(t.mean) <= 15 && t.sd < 25) m.tight = true;
    }
    WS.store.save();
  });
  WS.bus.on('metro-trainer-done', () => { const m = (s0().metroStats = s0().metroStats || {}); m.trainerDone = (m.trainerDone || 0) + 1; WS.store.save(); });
})();
