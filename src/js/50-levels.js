/* Levels, key pools, the tempo staircase, silver and gold stars, XP and item stats. */
(function () {
  const T = WS.theory;

  const LEVELS = [
    { id: 'h1-maj', lane: 'harmony', drill: 'H1', code: 'H1', name: 'Major triads', short: 'Major', kind: 'chord', qualities: ['maj'], base: 50, target: 70 },
    { id: 'h1-min', lane: 'harmony', drill: 'H1', code: 'H1', name: 'Minor triads', short: 'Minor', kind: 'chord', qualities: ['min'], base: 50, target: 70 },
    { id: 'h1-mix', lane: 'harmony', drill: 'H1', code: 'H1', name: 'Major and minor', short: 'Maj + min', kind: 'chord', qualities: ['maj', 'min'], base: 55, target: 75 },
    { id: 'h1-dimaug', lane: 'harmony', drill: 'H1', code: 'H1', name: 'Diminished and augmented', short: 'Dim + aug', kind: 'chord', qualities: ['dim', 'aug'], base: 50, target: 70 },
    { id: 'h1-all', lane: 'harmony', drill: 'H1', code: 'H1', name: 'All four triads', short: 'All triads', kind: 'chord', qualities: ['maj', 'min', 'dim', 'aug'], base: 55, target: 80 },
    { id: 'h4-maj7-dom7', lane: 'harmony', drill: 'H4', code: 'H4', name: 'Major 7 and dominant 7', short: 'maj7 + 7', kind: 'chord', qualities: ['maj7', 'dom7'], base: 45, target: 65 },
    { id: 'h4-min7-hdim', lane: 'harmony', drill: 'H4', code: 'H4', name: 'Minor 7 and half-diminished', short: 'm7 + ø7', kind: 'chord', qualities: ['min7', 'hdim7'], base: 45, target: 65 },
    { id: 'h4-dim7', lane: 'harmony', drill: 'H4', code: 'H4', name: 'Diminished 7', short: '°7', kind: 'chord', qualities: ['dim7'], base: 45, target: 65 },
    { id: 'h4-all', lane: 'harmony', drill: 'H4', code: 'H4', name: 'All five sevenths', short: 'All 7ths', kind: 'chord', qualities: ['maj7', 'dom7', 'min7', 'hdim7', 'dim7'], base: 50, target: 75 },
    { id: 'i1-a', lane: 'improv', drill: 'I1', code: 'I1', name: 'Shells, shape A', short: 'Shape A', kind: 'shell', shapes: ['A'], base: 50, target: 80, metronome: '24' },
    { id: 'i1-b', lane: 'improv', drill: 'I1', code: 'I1', name: 'Shells, shape B', short: 'Shape B', kind: 'shell', shapes: ['B'], base: 50, target: 80, metronome: '24' },
    { id: 'i1-ab', lane: 'improv', drill: 'I1', code: 'I1', name: 'Shells, both shapes', short: 'A + B', kind: 'shell', shapes: ['A', 'B'], base: 55, target: 80, metronome: '24' },
  ];
  const BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

  const LANES = [
    { id: 'harmony', name: 'Harmony', blurb: 'Chord qualities in every key', levels: LEVELS.filter((l) => l.lane === 'harmony').map((l) => l.id) },
    { id: 'improv', name: 'Improv', blurb: 'Left-hand shell voicings on ii–V–I', levels: LEVELS.filter((l) => l.lane === 'improv').map((l) => l.id) },
    { id: 'reading', name: 'Reading', blurb: 'Sight-reading', locked: true, soon: 'Note Rain, the sight-reading trainer, is the next build. Keep reading from your books for now.' },
    { id: 'ear', name: 'Ear', blurb: 'Scale degrees and bass lines', locked: true, soon: 'Echo and Bass Detective come after Note Rain. Use the E-drills in the Drill Library for now.' },
  ];

  const L = (WS.levels = { LEVELS, BY_ID, LANES });
  L.ROUND = 12;        // prompts per round
  L.PASS = 11;         // hits needed to pass
  L.POOL_STEP = 3;     // keys added after a passed round

  L.def = (id) => BY_ID[id];

  L.state = (id) => {
    const s = WS.S();
    if (!s.levels[id]) {
      const d = BY_ID[id];
      s.levels[id] = {
        pool: 3, tempo: d.base, passStreak: 0, reversals: 0, lastDir: null,
        stars: [{ s: null, g: null }, { s: null, g: null }, { s: null, g: null }],
        lastPlayed: null, coldDay: null, rounds: 0, passes: 0, best: 0,
      };
    }
    return s.levels[id];
  };

  L.starCriteria = (d) => [
    `Pass a round with all 12 keys at ♩ = ${d.base}`,
    `Pass a round at ♩ = ${d.target}`,
    `Flawless round (12 of 12) at ♩ = ${d.target}`,
  ];

  L.isUnlocked = (id) => {
    const d = BY_ID[id];
    const lane = LANES.find((x) => x.id === d.lane);
    const idx = lane.levels.indexOf(id);
    if (idx === 0) return true;
    const prev = L.state(lane.levels[idx - 1]);
    return !!prev.stars[0].s;
  };

  L.silverCount = (ls) => ls.stars.filter((x) => x.s).length;
  L.goldCount = (ls) => ls.stars.filter((x) => x.g).length;
  L.allGold = (ls) => ls.stars.every((x) => x.g);

  /* Gold is possible today if a silver star was earned on an earlier day and isn't gold yet. */
  L.goldChance = (id) => {
    const ls = L.state(id);
    const today = WS.todayKey();
    return ls.stars.some((x) => x.s && x.s < today && !x.g);
  };
  /* The first round of the day on a level is its cold check. */
  L.coldReady = (id) => L.goldChance(id) && L.state(id).lastPlayed !== WS.todayKey();
  L.coldTempo = (id) => {
    const d = BY_ID[id];
    const ls = L.state(id);
    const today = WS.todayKey();
    const needsTarget = [1, 2].some((i) => ls.stars[i].s && ls.stars[i].s < today && !ls.stars[i].g);
    return needsTarget ? d.target : d.base;
  };

  L.keysInPool = (ls) => T.KEY_ORDER.slice(0, ls.pool);

  /* ---------- Item stats (per chord and key) ---------- */
  L.item = (key) => {
    const s = WS.S();
    if (!s.items[key]) s.items[key] = { n: 0, hit: 0, recent: [], absMs: 0 };
    return s.items[key];
  };
  L.itemWeakness = (key) => {
    const it = WS.S().items[key];
    if (!it || !it.recent.length) return 0.5;
    const acc = (it.recent.reduce((a, b) => a + b, 0) + 1) / (it.recent.length + 2);
    return 1 - acc;
  };
  const recordItem = (key, hit, offsetMs) => {
    const it = L.item(key);
    it.n++;
    if (hit) it.hit++;
    it.recent.push(hit ? 1 : 0);
    if (it.recent.length > 12) it.recent.shift();
    if (hit && Number.isFinite(offsetMs)) it.absMs = it.absMs ? it.absMs * 0.8 + Math.abs(offsetMs) * 0.2 : Math.abs(offsetMs);
  };

  /* ---------- Building a round ---------- */
  const samePcs = (a, b) => a.pcs.length === b.pcs.length && a.pcs.every((p) => b.pcs.includes(p));
  const fixAdjacent = (list) => {
    for (let pass = 0; pass < 4; pass++) {
      let changed = false;
      for (let i = 1; i < list.length; i++) {
        if (!samePcs(list[i], list[i - 1])) continue;
        const j = list.findIndex((x, k) => k > i && !samePcs(x, list[i - 1]) && (k + 1 >= list.length || !samePcs(list[i], list[k + 1])));
        if (j > 0) { [list[i], list[j]] = [list[j], list[i]]; changed = true; }
      }
      if (!changed) break;
    }
    return list;
  };

  L.makePrompts = (id, poolOverride) => {
    const d = BY_ID[id];
    const ls = L.state(id);
    const keys = T.KEY_ORDER.slice(0, poolOverride || ls.pool);
    if (d.kind === 'chord') {
      let roots = [];
      while (roots.length < L.ROUND) roots.push(...WS.shuffle(keys.slice()));
      roots = roots.slice(0, L.ROUND);
      const list = roots.map((r) => {
        const q = WS.pickWeighted(d.qualities, (q) => 0.4 + L.itemWeakness(`${q}:${r}`));
        return T.chord(r, q);
      });
      return fixAdjacent(WS.shuffle(list));
    }
    // Shells: four ii–V–I progressions, keys weighted toward weak and least-recent ones
    const progs = Math.round(L.ROUND / 3);
    const chosen = [];
    const avail = keys.slice();
    for (let p = 0; p < progs; p++) {
      if (!avail.length) avail.push(...keys.filter((k) => k !== chosen[chosen.length - 1]));
      const k = WS.pickWeighted(avail, (k) => 0.4 + ['ii', 'V', 'I'].reduce((s, r) => s + L.itemWeakness(`sh${d.shapes[0]}-${r}:${k}`), 0) / 3);
      avail.splice(avail.indexOf(k), 1);
      chosen.push(k);
    }
    const list = [];
    for (const k of chosen) {
      const shape = d.shapes[Math.floor(Math.random() * d.shapes.length)];
      for (const role of ['ii', 'V', 'I']) list.push(T.shell(k, role, shape));
    }
    return list;
  };

  /* ---------- Plan a round: tempo, pool, cold/challenge flags ---------- */
  L.planRound = (id, mode = 'normal') => {
    const d = BY_ID[id];
    const ls = L.state(id);
    const cold = L.coldReady(id);
    let tempo = ls.tempo;
    let pool = ls.pool;
    let challenge = false;
    if (cold) { tempo = L.coldTempo(id); pool = 12; }
    else if (mode === 'challenge') { tempo = d.target; pool = 12; challenge = true; }
    return { id, def: d, tempo, pool, cold, challenge, prompts: L.makePrompts(id, pool) };
  };

  /* ---------- Apply a finished round ---------- */
  L.applyRound = (plan, res) => {
    const s = WS.S();
    const d = plan.def;
    const ls = L.state(plan.id);
    const today = WS.todayKey();
    const fullPool = plan.pool >= 12;
    const passed = res.hits >= L.PASS;
    const flawless = res.hits === res.n;
    const out = { passed, flawless, earned: [], notes: [], xp: 0, nextTempo: ls.tempo };

    // Item stats
    plan.prompts.forEach((p, i) => recordItem(p.item, res.results[i].hit, res.results[i].offsetMs));

    // Stars: silver any time; gold only on the cold round, for silver earned on an earlier day
    const meets = [
      passed && fullPool && plan.tempo >= d.base,
      passed && fullPool && plan.tempo >= d.target,
      flawless && fullPool && plan.tempo >= d.target,
    ];
    meets.forEach((ok, i) => {
      if (ok && !ls.stars[i].s) { ls.stars[i].s = today; out.earned.push({ i, kind: 'silver' }); }
    });
    if (plan.cold) {
      meets.forEach((ok, i) => {
        const st = ls.stars[i];
        if (ok && st.s && st.s < today && !st.g) { st.g = today; out.earned.push({ i, kind: 'gold' }); }
      });
      ls.coldDay = today;
      out.coldResult = out.earned.some((e) => e.kind === 'gold') ? 'gold' : 'missed';
    }

    // Key pool and tempo staircase (normal rounds only)
    if (!plan.cold && !plan.challenge) {
      if (ls.pool < 12) {
        if (passed) {
          const added = T.KEY_ORDER.slice(ls.pool, Math.min(12, ls.pool + L.POOL_STEP)).map((k) => T.KEY_NAME[k]);
          ls.pool = Math.min(12, ls.pool + L.POOL_STEP);
          out.notes.push(`Keys added: ${added.join(', ')}.`);
        } else {
          ls.tempo = Math.max(d.base - 15, ls.tempo - 4);
          out.notes.push(`Tempo down to ♩ = ${ls.tempo}.`);
        }
      } else if (passed) {
        ls.passStreak++;
        if (ls.passStreak >= 3) {
          const step = ls.reversals < 2 ? 8 : 4;
          if (ls.lastDir === 'down') ls.reversals++;
          ls.lastDir = 'up';
          ls.tempo = Math.min(200, ls.tempo + step);
          ls.passStreak = 0;
          out.notes.push(`Three clean rounds in a row: tempo up to ♩ = ${ls.tempo}.`);
        } else {
          out.notes.push(`${ls.passStreak} of 3 clean rounds toward a faster tempo.`);
        }
      } else {
        const step = ls.reversals < 2 ? 8 : 4;
        if (ls.lastDir === 'up') ls.reversals++;
        ls.lastDir = 'down';
        ls.passStreak = 0;
        ls.tempo = Math.max(d.base - 15, ls.tempo - step);
        out.notes.push(`Tempo down to ♩ = ${ls.tempo} so you land more of them.`);
      }
    }
    out.nextTempo = ls.tempo;

    ls.rounds++;
    if (passed) { ls.passes++; ls.best = Math.max(ls.best, plan.tempo); }

    // XP: verified progress pays most; replaying a fully gold level pays little
    let xp = res.hits * 2 + (passed ? 10 : 0);
    if (L.allGold(ls) && !out.earned.length) xp = Math.round(xp * 0.25);
    for (const e of out.earned) xp += e.kind === 'gold' ? 100 : 50;
    out.xp = xp;
    s.xp += xp;

    // Day record
    const day = WS.progress.day(today);
    day.rounds++;
    day.focus = true;
    day.minutes = Math.round((day.minutes + res.durationSec / 60) * 10) / 10;
    day.xp += xp;

    s.rounds.push({
      at: new Date(WS.nowMs()).toISOString(), day: today, level: plan.id, tempo: plan.tempo, pool: plan.pool,
      hits: res.hits, n: res.n, perfects: res.perfects, passed, cold: plan.cold, challenge: plan.challenge,
      xp, meanOffsetMs: res.meanOffsetMs, misses: res.misses.slice(0, 12),
    });
    if (s.rounds.length > 600) s.rounds.splice(0, s.rounds.length - 600);
    WS.store.save();
    return out;
  };

  /* Next level to play in a lane: first unlocked level missing ★1, then ★2, then ★3. */
  L.nextInLane = (laneId) => {
    const lane = LANES.find((x) => x.id === laneId);
    if (!lane || lane.locked) return null;
    for (let star = 0; star < 3; star++) {
      for (const id of lane.levels) {
        if (!L.isUnlocked(id)) break;
        if (!L.state(id).stars[star].s) return id;
      }
    }
    return lane.levels[lane.levels.length - 1];
  };
})();
