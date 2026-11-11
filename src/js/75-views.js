/* Screens added in 0.4: Roadmap, Metronome, Stats (log, insights, numbers), Ear games, Trophies,
   the session timer, and recordings on the Play screen. */
(function () {
  const h = WS.h;
  const svg = WS.svg;
  const UI = WS.ui;
  const VIEWS = UI.VIEWS;
  const RM = WS.roadmap;
  const LG = WS.log;
  const M = WS.metro;
  const E = WS.ear;
  const AC = WS.ach;
  const RC = WS.recorder;
  const T = WS.theory;
  const btn = (label, onclick, cls = 'btn') => h('button', { type: 'button', class: cls, onclick }, label);

  const ICONS = {
    map: 'M9 4 3 6.5v13L9 17l6 2.5 6-2.5V4l-6 2.5zM9 4v13M15 6.5v13',
    metro: 'M8.5 20h7L19 20 14.5 4h-5L5 20zM12 15l5-9M7.5 15.5h9',
    ear: 'M7 9a5 5 0 1 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0M10 10a2 2 0 1 1 4 0c0 1.5-2 2-2 4',
    stats: 'M5 19v-7M10 19V6M15 19v-4M20 19V9',
    trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4',
    games: 'M6 9h12a3 3 0 0 1 3 3v3a3 3 0 0 1-5 2l-1-1H9l-1 1a3 3 0 0 1-5-2v-3a3 3 0 0 1 3-3zM8 11v3M6.5 12.5h3M15.5 12h.01M17.5 14h.01',
    rec: 'M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0-12 0',
    stop: 'M7 7h10v10H7z',
    play: 'M8 5.5v13l11-6.5z',
    timer: 'M12 8v5l3 2M9 2h6M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  };
  const icon = (name, size = 18, fill) => svg('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: fill ? 'currentColor' : 'none', stroke: fill ? 'none' : 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon' }, svg('path', { d: ICONS[name] }));
  UI.icon2 = icon;

  const pageHead = (title, sub, extra) => h('header', { class: 'page-head' },
    h('div', { class: 'page-head-text' }, h('h1', { class: 'page-title', text: title }), sub ? h('p', { class: 'page-sub', text: sub }) : null), extra || null);
  const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); const m = Math.floor(sec / 60); return `${m}:${String(sec % 60).padStart(2, '0')}`; };
  const onLeave = (el, fn) => {
    const obs = new MutationObserver(() => { if (!document.body.contains(el)) { obs.disconnect(); fn(); } });
    obs.observe(WS.$('#view'), { childList: true });
  };
  const progBar = (pct, cls = '') => h('span', { class: `pbar ${cls}`, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct)) }, h('i', { style: { width: `${WS.clamp(pct, 0, 100)}%` } }));

  /* A generic sheet (dialog) like the level sheet */
  UI.sheet = (build, { wide = false } = {}) => {
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const panel = h('div', { class: `sheet${wide ? ' sheet-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
      h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Close', onclick: close, text: '×' }));
    const back = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === back) close(); } }, panel);
    build(panel, close);
    document.body.append(back);
    UI.glyphify(back);
    document.addEventListener('keydown', onKey);
    const f = panel.querySelector('.btn-primary') || panel.querySelector('button');
    if (f) f.focus();
    return close;
  };

  /* =========================================================================================
     ROADMAP
     ========================================================================================= */
  let roadPhase = null;
  const LANE_NAME = Object.fromEntries(RM.LANES.map((l) => [l.id, l.name]));
  const statusChip = (d, week) => {
    const stt = RM.status(d, week);
    if (stt === 'passed') return h('span', { class: 'chip-s chip-pass' }, icon('check', 13), ' Passed');
    if (stt === 'now') return h('span', { class: 'chip-s chip-now', text: 'This week' });
    return null;
  };
  const evidenceText = (d) => {
    const ev = RM.appEvidence(d);
    if (!ev) return null;
    if (ev.kind === 'levels') return `Chord Runner: ${ev.silver} of ${ev.total} level${ev.total > 1 ? 's' : ''} with a silver star${ev.gold ? `, ${ev.gold} with gold` : ''}`;
    return `${ev.game.name}: ${ev.passed} of ${ev.total} levels passed`;
  };

  UI.openDrill = (id) => {
    const d = RM.drill(id);
    if (!d) return;
    const week = WS.progress.weekNumber();
    UI.sheet((panel, close) => {
      const passed = RM.isPassed(id);
      const notes = h('textarea', { id: 'drill-notes', rows: '3', placeholder: 'Tempo reached, keys still shaky, anything for next time…', oninput: (e) => { RM.st().notes[id] = e.target.value; WS.store.save(); } });
      notes.value = RM.st().notes[id] || '';
      const ev = evidenceText(d);
      const actions = h('div', { class: 'sheet-actions' });
      if (d.app) {
        const next = d.app.find((lid) => WS.levels.isUnlocked(lid) && !WS.levels.state(lid).stars[0].s) || d.app.filter((lid) => WS.levels.isUnlocked(lid)).pop();
        if (next) actions.append(btn(h('span', {}, UI.icon('play', 16), ` Chord Runner: ${WS.levels.def(next).name}`), () => { close(); UI.openLevel(next); }, 'btn btn-primary'));
      }
      if (d.ear) actions.append(btn(h('span', {}, UI.icon('play', 16), ` Play ${E.def(d.ear[0]).name}`), () => { close(); location.hash = '#ear'; setTimeout(() => UI.startEar(d.ear[0], E.nextLevel(d.ear[0])), 30); }, d.app ? 'btn btn-ghost' : 'btn btn-primary'));
      actions.append(btn(passed ? 'Passed. Undo' : 'Mark passed', () => { RM.setPassed(id, !passed); close(); UI.rerender(); if (!passed) WS.toast(`${d.id === d.title ? d.title : `${d.id}`} passed. Nice.`); }, passed ? 'btn btn-ghost' : (d.app || d.ear ? 'btn btn-ghost' : 'btn btn-primary')));
      panel.append(
        h('p', { class: 'sheet-kicker', text: `Phase ${d.phase} · ${LANE_NAME[d.lane]} · ${d.when}` }),
        h('h2', { id: 'sheet-title', class: 'sheet-title' }, /^[A-Z]{1,2}\d+$/.test(d.id) ? h('span', { class: 'drill-code', text: d.id }) : null, d.title),
        passed ? h('p', { class: 'ok-line', text: `Passed ${WS.fmtDay(RM.st().passed[id])}.` }) : null,
        h('ol', { class: 'drill-steps' }, d.steps.map((x) => h('li', { text: x }))),
        d.table ? h('div', { class: 'table-wrap' }, h('table', { class: 'drill-table' },
          h('thead', {}, h('tr', {}, d.table.head.map((x) => h('th', { scope: 'col', text: x })))),
          h('tbody', {}, d.table.rows.map((r) => h('tr', {}, r.map((x) => h('td', { text: x }))))))) : null,
        d.tip ? h('p', { class: 'muted small', text: d.tip }) : null,
        h('div', { class: 'pass-box' }, h('strong', { text: 'Passed when: ' }), d.pass),
        ev ? h('p', { class: 'muted small', text: `In the app: ${ev}.` }) : null,
        h('label', { for: 'drill-notes', class: 'field-label', text: 'Your notes' }), notes,
        actions);
    }, { wide: true });
  };

  VIEWS.roadmap = (root) => {
    const week = WS.progress.weekNumber();
    const cur = RM.currentPhase();
    const weekPhase = RM.phaseOfWeek(week).n;
    if (roadPhase == null) roadPhase = cur;
    const ph = RM.PHASES.find((p) => p.n === roadPhase);
    const row = RM.weekRow(week);

    root.append(pageHead('The roadmap', `From where you are now to Clair de Lune and Rachmaninoff: four phases, six lanes, ${RM.DRILLS.length} drills. You’re in week ${week}; the milestones decide when a phase is really done.`));

    // Phase tabs
    root.append(h('div', { class: 'phase-tabs', role: 'tablist' }, RM.PHASES.map((p) => {
      const pp = RM.phaseProgress(p.n);
      return h('button', { type: 'button', role: 'tab', 'aria-selected': p.n === roadPhase ? 'true' : 'false', class: `phase-tab${p.n === roadPhase ? ' on' : ''}${p.n === cur ? ' current' : ''}`, onclick: () => { roadPhase = p.n; UI.rerender(); } },
        h('span', { class: 'phase-n', text: `Phase ${p.n}` }),
        h('span', { class: 'phase-name', text: p.name }),
        h('span', { class: 'phase-meta', text: `${p.months}${p.n === cur ? ' · you are here' : ''}` }),
        progBar(pp.pct));
    })));

    // This week (always shown, from the schedule)
    if (row) {
      const cell = (label, days, text, code) => h('div', { class: 'tw-cell' },
        h('p', { class: 'tw-label' }, label, days ? h('span', { class: 'muted', text: ` ${days}` }) : null),
        h('p', { class: 'tw-text', text }),
        code && RM.drill(code) ? btn(h('span', {}, h('span', { class: 'drill-code sm', text: /^[A-Z]{1,2}\d+$/.test(code) ? code : '' }), ` ${RM.drill(code).title}`), () => UI.openDrill(code), 'linkish') : null);
      root.append(h('section', { class: 'panel this-week' },
        h('h2', {}, `Week ${week}`, h('span', { class: 'muted', text: ` · Phase ${weekPhase}, ${RM.phaseOfWeek(week).name}` })),
        h('div', { class: 'tw-grid' },
          cell('Reading', 'every day', row.reading, 'SR'),
          cell('Score piece', 'every day', row.score, row.codes.score),
          cell('Ear', 'Mon · Thu', row.ear, row.codes.ear),
          cell('Harmony', 'Tue · Fri', row.harmony, row.codes.harmony),
          cell('Improv', 'Wed · Sat', row.improv, row.codes.improv),
          cell('Review', 'Sun', 'Record a score passage and an improv clip; look over the week in Stats.', 'T-record'))));
    } else {
      root.append(h('section', { class: 'panel this-week' }, h('h2', { text: `Week ${week}` }),
        h('p', { text: 'You’re past the week-by-week schedule. From here the plan is the Phase 4 repertoire ladder plus open-ended jazz: keep the daily core and rotate the focus days through your current drills.' })));
    }

    // Phase overview
    const pp = RM.phaseProgress(ph.n);
    const checks = h('ul', { class: 'milestones' }, ph.checks.map((c) => {
      const on = RM.isChecked(c.id);
      let hint = null;
      if (c.app) { const ls = WS.levels.state(c.app); hint = ls.stars[0].s ? `App: silver on ${WS.levels.def(c.app).name}${ls.stars[2].g ? ', gold at target' : ''}` : `App check: ${WS.levels.def(c.app).name} in Chord Runner`; }
      return h('li', {},
        h('button', { type: 'button', class: `check${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false', onclick: () => { RM.setChecked(c.id, !on); UI.rerender(); } }, h('span', { class: 'check-box', 'aria-hidden': 'true' })),
        h('span', { class: 'ms-text' }, h('span', { text: c.text }), on ? h('span', { class: 'muted small', text: ` · ${WS.fmtDay(RM.st().checks[c.id])}` }) : hint ? h('span', { class: 'muted small', text: ` · ${hint}` }) : null));
    }));
    root.append(h('section', { class: 'panel phase-panel' },
      h('div', { class: 'phase-head' },
        h('div', {}, h('h2', { text: `Phase ${ph.n}: ${ph.name}` }), h('p', { class: 'muted', text: `${ph.months} · weeks ${ph.weeks[0]}${ph.weeks[1] < 9999 ? `–${ph.weeks[1]}` : ' on'}` })),
        h('div', { class: 'phase-score' }, h('span', { class: 'big-num', text: `${pp.pct}%` }), h('span', { class: 'muted small', text: `${pp.passed}/${pp.drills} drills · ${pp.checks}/${pp.checkTotal} milestones` }))),
      h('p', { class: 'phase-goal', text: ph.goal }),
      h('h3', { class: 'sub-h', text: ph.n < 4 ? `Ready for Phase ${ph.n + 1} when you can:` : 'Milestones' }),
      checks));

    // Lanes with drill cards
    const lanes = h('div', { class: 'road-lanes' });
    for (const lane of RM.LANES) {
      const ds = RM.DRILLS.filter((d) => d.phase === ph.n && d.lane === lane.id);
      if (!ds.length) continue;
      lanes.append(h('section', { class: 'road-lane' },
        h('h2', { text: lane.name }), h('p', { class: 'lane-blurb', text: lane.blurb }),
        h('ol', { class: 'drill-list' }, ds.map((d) => {
          const stt = RM.status(d, week);
          const ev = RM.appEvidence(d);
          return h('li', {}, h('button', { type: 'button', class: `drill-card drill-${stt}`, onclick: () => UI.openDrill(d.id) },
            /^[A-Z]{1,2}\d+$/.test(d.id) ? h('span', { class: 'drill-code', text: d.id }) : h('span', { class: 'drill-code drill-code-soft', text: lane.id === 'repertoire' ? '♪' : '•' }),
            h('span', { class: 'drill-main' },
              h('span', { class: 'drill-title', text: d.title }),
              h('span', { class: 'drill-when', text: d.when }),
              ev ? h('span', { class: 'drill-ev' }, progBar(ev.kind === 'levels' ? (ev.silver / ev.total) * 100 : (ev.passed / ev.total) * 100, 'pbar-sm'), h('span', { class: 'small muted', text: ev.kind === 'levels' ? ` ${ev.silver}/${ev.total} in Chord Runner` : ` ${ev.passed}/${ev.total} in ${ev.game.name}` })) : null),
            statusChip(d, week)));
        }))));
    }
    root.append(lanes);

    // Week by week for this phase
    const rows = RM.WEEKS.filter((r) => r.from >= ph.weeks[0] && r.to <= ph.weeks[1]);
    if (rows.length) {
      root.append(h('details', { class: 'panel weeks-panel', open: ph.n === weekPhase },
        h('summary', {}, h('h2', { class: 'inline-h', text: 'Week by week' })),
        h('div', { class: 'table-wrap' }, h('table', { class: 'weeks' },
          h('thead', {}, h('tr', {}, ['Week', 'Reading', 'Score piece', 'Ear (Mon, Thu)', 'Harmony (Tue, Fri)', 'Improv (Wed, Sat)'].map((x) => h('th', { scope: 'col', text: x })))),
          h('tbody', {}, rows.map((r) => h('tr', { class: week >= r.from && week <= r.to ? 'wk-now' : week > r.to ? 'wk-past' : '' },
            h('th', { scope: 'row', text: r.from === r.to ? String(r.from) : `${r.from}–${r.to}` }),
            h('td', { text: r.reading }), h('td', { text: r.score }), h('td', { text: r.ear }), h('td', { text: r.harmony }), h('td', { text: r.improv }))))))));
    }

    if (ph.n === 1) {
      root.append(h('details', { class: 'panel' },
        h('summary', {}, h('h2', { class: 'inline-h', text: 'Where you started (Oct 26)' })),
        h('div', { class: 'table-wrap' }, h('table', { class: 'weeks' },
          h('thead', {}, h('tr', {}, ['Skill', 'Level', 'What it looked like'].map((x) => h('th', { scope: 'col', text: x })))),
          h('tbody', {}, RM.START.map((r) => h('tr', {}, r.map((x) => h('td', { text: x })))))))));
    }
    root.append(h('details', { class: 'panel' },
      h('summary', {}, h('h2', { class: 'inline-h', text: 'Rules for breaking plateaus' })),
      h('ul', { class: 'rules' }, RM.RULES.map(([a, b]) => h('li', {}, h('strong', { text: a }), ` ${b}`)))));
  };

  /* =========================================================================================
     METRONOME
     ========================================================================================= */
  const TEMPO_NAMES = [[40, 'Grave'], [60, 'Largo'], [66, 'Larghetto'], [76, 'Adagio'], [108, 'Andante'], [120, 'Moderato'], [156, 'Allegro'], [176, 'Vivace'], [200, 'Presto'], [999, 'Prestissimo']];
  const tempoName = (b) => (TEMPO_NAMES.find(([x]) => b < x) || TEMPO_NAMES[TEMPO_NAMES.length - 1])[1];
  const LEVEL_LABEL = ['Mute', 'Soft', 'Normal', 'Accent'];

  VIEWS.metronome = (root) => {
    const cfg = M.cfg();
    const save = () => WS.store.save();
    root.append(pageHead('Metronome', 'Any meter, any accent pattern, subdivisions, multi-bar patterns and trainers. Space starts and stops; the arrow keys change the tempo; T taps it.'));

    const bpmOut = h('span', { class: 'metro-bpm', text: String(M.curBpm()) });
    const nameOut = h('span', { class: 'metro-tname', text: tempoName(M.curBpm()) });
    const slider = h('input', { type: 'range', min: '20', max: '300', step: '1', value: String(cfg.bpm), 'aria-label': 'Tempo', class: 'metro-slider', oninput: (e) => M.setBpm(Number(e.target.value)) });
    const startBtn = h('button', { type: 'button', class: 'metro-go', 'aria-pressed': M.running ? 'true' : 'false', onclick: () => { M.toggle(); paintRun(); } });
    const tapBtn = btn('Tap', () => M.tap(), 'btn btn-ghost metro-tap');
    const elapsed = h('span', { class: 'muted small', text: '' });
    const paintRun = () => {
      startBtn.replaceChildren(icon(M.running ? 'stop' : 'play', 26, true), h('span', { text: M.running ? 'Stop' : 'Start' }));
      startBtn.classList.toggle('on', M.running);
      startBtn.setAttribute('aria-pressed', M.running ? 'true' : 'false');
    };
    const paintBpm = (b) => { bpmOut.textContent = String(b); nameOut.textContent = tempoName(b); if (document.activeElement !== slider) slider.value = String(b); };
    const nudge = (d) => M.setBpm(M.curBpm() + d);

    // Beat grid: every bar of the pattern, every beat tappable to cycle its accent
    const grid = h('div', { class: 'beat-grid' });
    const cells = [];
    const paintGrid = () => {
      grid.replaceChildren();
      cells.length = 0;
      cfg.seq.forEach((b, bi) => {
        const row = h('div', { class: 'beat-bar' }, h('span', { class: 'beat-meter', text: M.meterLabel(b) }));
        const rowCells = [];
        for (let i = 0; i < b.beats; i++) {
          const lvl = b.accents[i] == null ? 2 : b.accents[i];
          const c = h('button', { type: 'button', class: `beat b${lvl}`, title: `Beat ${i + 1}: ${LEVEL_LABEL[lvl]}. Click to change.`, 'aria-label': `Bar ${bi + 1}, beat ${i + 1}: ${LEVEL_LABEL[lvl]}`,
            onclick: () => { b.accents[i] = ((b.accents[i] == null ? 2 : b.accents[i]) + 3) % 4; save(); paintGrid(); } },
          h('i', { style: { height: `${[12, 38, 66, 100][lvl]}%` } }), h('span', { class: 'beat-n', text: String(i + 1) }));
          row.append(c); rowCells.push(c);
        }
        cells.push(rowCells);
        grid.append(row);
      });
    };

    // Pattern editor
    const editor = h('div', { class: 'bars-editor' });
    const paintEditor = () => {
      editor.replaceChildren();
      cfg.seq.forEach((b, bi) => {
        const beats = h('select', { 'aria-label': `Bar ${bi + 1} beats`, onchange: (e) => { const n = Number(e.target.value); b.accents = Array.from({ length: n }, (_, i) => (i === 0 ? 3 : b.accents[i] == null ? 2 : b.accents[i])); b.beats = n; save(); paintAll(); } },
          Array.from({ length: 16 }, (_, i) => h('option', { value: String(i + 1), selected: b.beats === i + 1, text: String(i + 1) })));
        const unit = h('select', { 'aria-label': `Bar ${bi + 1} beat unit`, onchange: (e) => { b.unit = Number(e.target.value); save(); paintAll(); } },
          [2, 4, 8, 16].map((u) => h('option', { value: String(u), selected: b.unit === u, text: String(u) })));
        const sub = h('select', { 'aria-label': `Bar ${bi + 1} subdivision`, onchange: (e) => { b.subdiv = e.target.value; save(); } },
          M.SUBDIVS.map((d) => h('option', { value: d.id, selected: b.subdiv === d.id, text: d.name })));
        editor.append(h('div', { class: 'mbar-row' },
          h('span', { class: 'bar-n', text: `Bar ${bi + 1}` }), beats, h('span', { class: 'slash', text: '/' }), unit, sub,
          cfg.seq.length > 1 ? btn('Remove', () => { cfg.seq.splice(bi, 1); save(); paintAll(); }, 'btn btn-ghost btn-sm') : null));
      });
      editor.append(h('div', { class: 'row' },
        btn('Add a bar', () => { const last = cfg.seq[cfg.seq.length - 1]; cfg.seq.push(M.bar(last.beats, last.unit, [...last.accents], last.subdiv)); save(); paintAll(); }, 'btn btn-ghost'),
        btn('Reset to 4/4', () => { cfg.seq = [M.bar(4, 4)]; save(); paintAll(); }, 'btn btn-ghost')));
    };
    const paintAll = () => { paintGrid(); paintEditor(); patternOut.textContent = M.patternLabel(cfg.seq); };
    const patternOut = h('span', { class: 'muted', text: M.patternLabel(cfg.seq) });

    root.append(h('section', { class: 'metro-stage' },
      h('div', { class: 'metro-top' },
        h('div', { class: 'metro-tempo' },
          h('div', { class: 'metro-read' }, h('span', { class: 'metro-note', text: '♩ =' }), bpmOut, nameOut),
          h('div', { class: 'metro-nudge' },
            btn('−5', () => nudge(-5), 'btn btn-ghost btn-sm'), btn('−1', () => nudge(-1), 'btn btn-ghost btn-sm'),
            slider,
            btn('+1', () => nudge(1), 'btn btn-ghost btn-sm'), btn('+5', () => nudge(5), 'btn btn-ghost btn-sm'))),
        h('div', { class: 'metro-actions' }, startBtn, tapBtn, elapsed)),
      grid,
      h('p', { class: 'muted small' }, 'Pattern: ', patternOut, '. Click a beat to cycle it: accent, normal, soft, mute.')));

    // Sound + pattern
    const soundSel = h('select', { id: 'metro-sound', onchange: (e) => { cfg.sound = e.target.value; save(); M.preview(cfg.sound); } },
      M.SOUNDS.map((x) => h('option', { value: x.id, selected: cfg.sound === x.id, text: x.name })));
    const vol = h('input', { type: 'range', id: 'metro-vol2', min: '0', max: '1.2', step: '0.05', value: String(cfg.vol), oninput: (e) => { cfg.vol = Number(e.target.value); M.ensureOut(); save(); } });
    const subVol = h('input', { type: 'range', id: 'metro-subvol', min: '0', max: '1', step: '0.05', value: String(cfg.subVol), oninput: (e) => { cfg.subVol = Number(e.target.value); save(); } });
    root.append(h('div', { class: 'two-col' },
      h('section', { class: 'panel' }, h('h2', { text: 'Pattern' }), editor,
        h('p', { class: 'muted small', text: 'One bar is a plain metronome. Add bars for changing meters (4/4 then 3/4), a clave, or a whole form. In /8 meters the tempo counts eighth notes.' })),
      h('section', { class: 'panel' }, h('h2', { text: 'Sound' }),
        h('div', { class: 'form-grid' },
          h('label', { for: 'metro-sound', text: 'Click' }), h('div', { class: 'row tight' }, soundSel, btn('Hear it', () => M.preview(cfg.sound), 'btn btn-ghost btn-sm')),
          h('label', { for: 'metro-vol2', text: 'Volume' }), vol,
          h('label', { for: 'metro-subvol', text: 'Subdivision volume' }), subVol))));

    // Trainers
    const tr = cfg.trainer; const gp = cfg.gap;
    const num = (id, val, min, max, set) => h('input', { type: 'number', id, min: String(min), max: String(max), value: String(val), class: 'num', onchange: (e) => { set(WS.clamp(Number(e.target.value) || min, min, max)); save(); } });
    const chk = (id, val, set) => h('input', { type: 'checkbox', id, checked: val, onchange: (e) => { set(e.target.checked); save(); } });
    const rm = h('input', { type: 'range', id: 'metro-rand', min: '0', max: '0.8', step: '0.05', value: String(cfg.randomMute), oninput: (e) => { cfg.randomMute = Number(e.target.value); randOut.textContent = `${Math.round(cfg.randomMute * 100)}%`; save(); } });
    const randOut = h('span', { class: 'muted small', text: `${Math.round(cfg.randomMute * 100)}%` });
    root.append(h('section', { class: 'panel' }, h('h2', { text: 'Trainers' }),
      h('div', { class: 'trainers' },
        h('div', { class: 'trainer' },
          h('label', { class: 'trainer-h' }, chk('tr-on', tr.on, (v) => { tr.on = v; }), ' Tempo trainer'),
          h('p', {}, 'Raise by ', num('tr-step', tr.step, 1, 20, (v) => { tr.step = v; }), ' every ', num('tr-every', tr.every, 1, 64, (v) => { tr.every = v; }), ' bars, up to ♩ = ', num('tr-max', tr.max, 30, 400, (v) => { tr.max = v; })),
          h('p', { class: 'muted small', text: 'Speed work without thinking about it. Start where it’s clean and let it creep up.' })),
        h('div', { class: 'trainer' },
          h('label', { class: 'trainer-h' }, chk('gap-on', gp.on, (v) => { gp.on = v; }), ' Gap trainer'),
          h('p', {}, 'Play ', num('gap-play', gp.play, 1, 16, (v) => { gp.play = v; }), ' bars, then ', num('gap-mute', gp.mute, 1, 16, (v) => { gp.mute = v; }), ' silent bars'),
          h('p', { class: 'muted small', text: 'Keep time through the silence and see if you land with the click when it comes back.' })),
        h('div', { class: 'trainer' },
          h('p', { class: 'trainer-h' }, h('label', { for: 'metro-rand', text: 'Random mute ' }), randOut), rm,
          h('p', { class: 'muted small', text: 'Drops random beats (never beat 1).' })),
        h('div', { class: 'trainer' },
          h('p', { class: 'trainer-h' }, 'Count-in'),
          h('p', {}, num('count-in', cfg.countIn, 0, 4, (v) => { cfg.countIn = v; }), ' bars before the pattern and trainers start'))),
      h('p', { class: 'muted small', text: 'Changes take effect the next time you press Start.' })));

    // Timing check
    const tOut = h('div', { class: 'timing-out' });
    const tDots = h('div', { class: 'timing-dots', 'aria-hidden': 'true' });
    const paintTiming = () => {
      const t = M.timingSummary();
      if (!M.cfg().grade) { tOut.replaceChildren(h('p', { class: 'muted', text: 'Timing check is off.' })); return; }
      if (!t) { tOut.replaceChildren(h('p', { class: 'muted', text: M.running ? 'Play along with the click. After a few notes you’ll see how you land.' : 'Start the metronome and play along. Your notes are compared with the clicks (with your calibration offset).' })); tDots.replaceChildren(); return; }
      const dir = Math.abs(t.mean) < 6 ? 'right on the click' : t.mean < 0 ? `${Math.round(-t.mean)} ms ahead (rushing)` : `${Math.round(t.mean)} ms behind (dragging)`;
      tOut.replaceChildren(
        h('p', { class: 'lat-big' }, h('strong', { text: dir })),
        h('p', { class: 'muted small', text: `Spread ${Math.round(t.sd)} ms over your last ${t.n} notes. Under 20 ms is very tight.` }));
      tDots.replaceChildren(...M.timing.offs.slice(-32).map((ms) => h('i', { style: { left: `${50 + WS.clamp(ms, -80, 80) / 1.6}%` }, class: Math.abs(ms) < 15 ? 'good' : '' })));
    };
    root.append(h('section', { class: 'panel' }, h('h2', { text: 'Timing check' }),
      h('label', { class: 'row tight' }, chk('metro-grade', cfg.grade, (v) => { cfg.grade = v; paintTiming(); }), ' Grade my timing against the click'),
      h('div', { class: 'timing-scale' }, h('span', { text: 'ahead' }), tDots, h('span', { text: 'behind' })),
      tOut,
      h('div', { class: 'row' }, btn('Reset', () => { M.resetTiming(); paintTiming(); }, 'btn btn-ghost btn-sm'))));

    // Presets
    const presetBox = h('div', { class: 'presets' });
    const nameIn = h('input', { type: 'text', id: 'preset-name', placeholder: 'Name this setup', maxlength: '40' });
    const paintPresets = () => {
      presetBox.replaceChildren(...cfg.presets.map((p, i) => h('div', { class: 'preset' },
        h('button', { type: 'button', class: 'preset-load', onclick: () => { M.load(p); UI.rerender(); WS.toast(`Loaded “${p.name}”.`); } },
          h('span', { class: 'preset-name', text: p.name }), h('span', { class: 'muted small', text: `♩ = ${p.bpm} · ${M.patternLabel(p.seq)}` })),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete ${p.name}`, onclick: () => { cfg.presets.splice(i, 1); save(); paintPresets(); } }, icon('trash', 16)))));
    };
    root.append(h('section', { class: 'panel' }, h('h2', { text: 'Presets' }), presetBox,
      h('div', { class: 'row' }, nameIn, btn('Save current', () => {
        const n = nameIn.value.trim() || `${M.patternLabel(cfg.seq)} at ${cfg.bpm}`;
        cfg.presets.push(M.snapshot(n)); save(); nameIn.value = ''; paintPresets(); WS.toast(`Saved “${n}”.`);
      }, 'btn btn-primary'), btn('Restore the built-in presets', () => { const have = new Set(cfg.presets.map((p) => p.name)); M.DEFAULT_PRESETS.forEach((p) => { if (!have.has(p.name)) cfg.presets.push(JSON.parse(JSON.stringify(p))); }); save(); paintPresets(); }, 'btn btn-ghost'))));

    paintRun(); paintAll(); paintPresets(); paintTiming();

    // Live updates
    let lastLit = null;
    const lis = (e) => {
      if (e.type === 'beat') {
        if (lastLit) lastLit.classList.remove('lit');
        const c = cells[e.bar] && cells[e.bar][e.beat];
        if (c) { c.classList.add('lit'); c.classList.toggle('lit-muted', e.muted); lastLit = c; }
        elapsed.textContent = `${mmss(M.elapsed())} · bar ${e.totalBars + 1}${e.count ? ' (count-in)' : ''}`;
      } else if (e.type === 'bpm') paintBpm(e.bpm);
      else if (e.type === 'hit') paintTiming();
      else if (e.type === 'stop' || e.type === 'start') { paintRun(); if (lastLit) lastLit.classList.remove('lit'); }
    };
    M.listeners.add(lis);
    const onKey = (e) => {
      if (UI.current !== 'metronome' || e.target.closest('input, select, textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); M.toggle(); paintRun(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); nudge(e.shiftKey ? 5 : 1); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); nudge(e.shiftKey ? -5 : -1); }
      else if (e.key === 't' || e.key === 'T') M.tap();
    };
    document.addEventListener('keydown', onKey);
    onLeave(grid, () => { M.listeners.delete(lis); document.removeEventListener('keydown', onKey); });
  };

  /* =========================================================================================
     SESSION TIMER (rail pill + the log form)
     ========================================================================================= */
  UI.paintSessionPill = () => {
    const pill = WS.$('#session-pill');
    if (!pill) return;
    const on = !!LG.session && LG.sessionMinutes() >= 1;
    pill.hidden = !on && !RC.recording;
    if (RC.recording) { pill.className = 'session-pill rec'; pill.querySelector('.sp-text').textContent = `Recording ${mmss(RC.elapsed())}`; return; }
    pill.className = 'session-pill';
    pill.querySelector('.sp-text').textContent = on ? `Practising · ${LG.fmtMin(LG.sessionMinutes())}` : '';
  };
  setInterval(() => UI.paintSessionPill(), 1000);

  /* The log form, used for finishing a timed session and for logging one after the fact */
  UI.logForm = (opts = {}) => {
    const timed = false;
    const start = opts.entry ? opts.entry.minutes : 20;
    const pre = opts.entry || {};
    const areasPre = new Set(pre.areas || []);
    UI.sheet((panel, close) => {
      const mins = h('input', { type: 'number', id: 'log-min', min: '1', max: '600', value: String(start), class: 'num' });
      const day = h('input', { type: 'date', id: 'log-day', value: pre.day || WS.todayKey(), max: WS.todayKey() });
      const areas = h('div', { class: 'area-chips', role: 'group', 'aria-label': 'What you worked on' }, LG.AREAS.map((a) => {
        const b = h('button', { type: 'button', class: `chip${areasPre.has(a.id) ? ' on' : ''}`, 'aria-pressed': areasPre.has(a.id) ? 'true' : 'false', onclick: () => { if (areasPre.has(a.id)) areasPre.delete(a.id); else areasPre.add(a.id); b.classList.toggle('on'); b.setAttribute('aria-pressed', areasPre.has(a.id) ? 'true' : 'false'); } }, a.name);
        return b;
      }));
      const piece = h('input', { type: 'text', id: 'log-piece', placeholder: 'Gymnopédie bars 9–16, H4 in G♭…', value: pre.piece || '' });
      const bpm = h('input', { type: 'number', id: 'log-bpm', min: '20', max: '400', placeholder: '♩ =', value: pre.bpm || '', class: 'num' });
      let rating = pre.rating || 0;
      const stars = h('div', { class: 'rate', role: 'radiogroup', 'aria-label': 'How it went' });
      const paintRate = () => stars.replaceChildren(...[1, 2, 3, 4, 5].map((n) => h('button', { type: 'button', role: 'radio', 'aria-checked': n === rating ? 'true' : 'false', class: `rate-b${n <= rating ? ' on' : ''}`, onclick: () => { rating = n; paintRate(); }, title: ['', 'Rough', 'Meh', 'Fine', 'Good', 'Great'][n] }, String(n))));
      paintRate();
      const notes = h('textarea', { id: 'log-notes', rows: '3', placeholder: 'What clicked, what didn’t, what to do next time', text: pre.notes || '' });
      const save = () => {
        const form = { minutes: Number(mins.value) || 1, day: day.value || WS.todayKey(), areas: [...areasPre], piece: piece.value.trim(), bpm: bpm.value ? Number(bpm.value) : null, rating: rating || null, notes: notes.value.trim() };
        if (pre.id) { if (pre.areaMin) form.areaMin = Object.fromEntries(form.areas.map((a) => [a, (pre.areaMin[a] != null ? pre.areaMin[a] : form.minutes / Math.max(1, form.areas.length))])); LG.update(pre.id, form); WS.toast('Session updated.'); }
        else { LG.add(form); WS.toast(`Logged ${LG.fmtMin(form.minutes)}.`); }
        close(); UI.paintSessionPill(); UI.rerender();
      };
      panel.append(
        h('p', { class: 'sheet-kicker', text: timed ? 'Finish the session' : pre.id ? 'Edit a session' : 'Log a session' }),
        h('h2', { id: 'sheet-title', class: 'sheet-title', text: timed ? `${LG.fmtMin(start)} in the shed` : 'What did you practise?' }),
        h('div', { class: 'form-grid' },
          h('label', { for: 'log-min', text: 'Minutes' }), mins,
          h('label', { for: 'log-day', text: 'Day' }), day,
          h('span', { class: 'label', text: 'Worked on' }), areas,
          h('label', { for: 'log-piece', text: 'Piece or drill' }), piece,
          h('label', { for: 'log-bpm', text: 'Tempo reached' }), bpm,
          h('span', { class: 'label', text: 'How it went' }), stars,
          h('label', { for: 'log-notes', text: 'Notes' }), notes),
        pre.summary ? h('p', { class: 'muted small', text: `Woodshed saw: ${pre.summary}` }) : null,
        h('p', { class: 'muted small', text: pre.auto ? 'Logged automatically. Fix anything that’s off; sight-reading or score piece also ticks Tonight.' : 'For practice away from Woodshed, like the acoustic piano. Ticking Sight-reading or Score piece also ticks them on Tonight.' }),
        h('div', { class: 'sheet-actions' },
          btn(pre.id ? 'Save changes' : 'Save to the log', save, 'btn btn-primary'),
          pre.id ? btn('Delete', () => { LG.remove(pre.id); close(); UI.rerender(); }, 'btn btn-ghost') : null));
    });
  };

  /* Session card used on Tonight and Stats */
  UI.sessionCard = () => {
    const card = h('section', { class: 'side-card session-card' });
    const paint = () => {
      if (!document.body.contains(card) && card.isConnected === false && card.childNodes.length) return;
      card.replaceChildren(h('h2', { text: 'Practice log' }));
      const x = LG.session;
      if (x && LG.sessionMinutes() >= 0.5) {
        const sum = LG.describe(x.did);
        const am = Object.entries(x.areaMs).filter(([, ms]) => ms >= 20000).sort((a, b) => b[1] - a[1]);
        card.append(
          h('p', { class: 'live-session', text: LG.fmtMin(LG.sessionMinutes()) }),
          h('p', { class: 'muted small', text: 'This session so far. It closes by itself after 10 quiet minutes.' }),
          am.length ? h('ul', { class: 'live-list' }, am.map(([a, ms]) => h('li', { text: `${LG.AREA[a] ? LG.AREA[a].name : a}: ${LG.fmtMin(ms / 60000)}` }))) : null,
          sum ? h('p', { class: 'muted small', text: sum }) : null,
          h('div', { class: 'row' }, btn('Done for now', () => { const e = LG.closeSession(); paint(); UI.paintSessionPill(); if (e && !e.ask) WS.toast(`Logged ${LG.fmtMin(e.minutes)}.`); if (!e) WS.toast('Under 2 minutes, so nothing was logged.'); if (UI.current === 'stats') UI.rerender(); }, 'btn btn-ghost')));
      } else {
        card.append(h('p', { class: 'muted', text: 'Woodshed logs your practice by itself: play, and it records how long, what you did and how it went. If it can’t tell what the free play was, it asks once at the end.' }));
      }
      card.append(h('div', { class: 'row' }, btn('Log practice away from the app', () => UI.logForm({ manual: true }), 'linkish')));
    };
    paint();
    const t = setInterval(() => { if (!card.isConnected) { clearInterval(t); return; } paint(); }, 15000);
    const un = WS.bus.on('session', () => { if (!card.isConnected) { un(); return; } paint(); });
    return card;
  };

  /* The one-tap question after a session with unlabeled free play */
  UI.showAsk = () => {
    const e = LG.pendingAsk();
    const old = WS.$('.ask-card');
    if (old) old.remove();
    if (!e || document.body.classList.contains('in-game')) return;
    const free = Math.round((e.areaMin && e.areaMin.free) || 0);
    const card = h('section', { class: 'ask-card', role: 'dialog', 'aria-labelledby': 'ask-title' },
      h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Not now', onclick: () => { LG.dismissAsk(e.id); card.remove(); }, text: '×' }),
      h('h2', { id: 'ask-title', text: `${LG.fmtMin(e.minutes)} logged ${e.day === WS.todayKey() ? 'just now' : WS.fmtDay(e.day)}. What were the ${free} minutes of free play?` }),
      h('div', { class: 'ask-chips' }, LG.ASK_CHOICES.map(([v, label]) => btn(label, () => {
        LG.answerAsk(e.id, v);
        card.remove();
        WS.toast(v === 'free' ? 'Logged as free play.' : `Logged as ${label.toLowerCase()}.${v === 'reading' || v === 'score' || v === 'both' ? ' Ticked on Tonight.' : ''}`);
        if (['tonight', 'stats'].includes(UI.current)) UI.rerender();
      }, 'chip'))));
    document.body.append(card);
    UI.glyphify(card);
  };
  WS.bus.on('log-ask', () => setTimeout(UI.showAsk, 50));

  /* =========================================================================================
     STATS
     ========================================================================================= */
  const barChart = (vals, labels, { height = 120, unit = '', highlightLast = true } = {}) => {
    const W = vals.length * 28;
    const max = Math.max(10, ...vals);
    const s = svg('svg', { viewBox: `0 0 ${W} ${height + 22}`, class: 'chart', role: 'img', 'aria-label': labels.map((l, i) => `${l}: ${Math.round(vals[i])}${unit}`).join(', ') });
    vals.forEach((v, i) => {
      const bh = Math.max(v > 0 ? 3 : 0, (v / max) * height);
      s.appendChild(svg('rect', { x: i * 28 + 5, y: height - bh, width: 18, height: bh, rx: 3, class: `bar${highlightLast && i === vals.length - 1 ? ' bar-today' : ''}` }));
      s.appendChild(svg('text', { x: i * 28 + 14, y: height + 16, 'text-anchor': 'middle', class: 'axis' }, document.createTextNode(labels[i])));
    });
    return s;
  };
  const hbars = (rows) => h('ul', { class: 'bars' }, rows.map(([label, val, max, txt]) => h('li', { class: 'bar-row' },
    h('span', { class: 'bar-label', text: label }),
    h('span', { class: 'bar-track' }, h('i', { style: { width: `${max ? Math.round((val / max) * 100) : 0}%` } })),
    h('span', { class: 'bar-val', text: txt }))));

  VIEWS.stats = (root) => {
    const s = WS.S();
    const today = WS.todayKey();
    const mon = WS.mondayOf(today);
    const wk = LG.rangeMinutes(mon, today);
    const m30 = LG.rangeMinutes(WS.addDays(today, -29), today);
    const total = LG.totalMinutes();
    root.append(pageHead('Stats', 'Your practice log, the numbers, and what they say.'));
    root.append(h('dl', { class: 'statline statline-6' },
      h('div', {}, h('dt', { text: 'This week' }), h('dd', { text: LG.fmtMin(wk) })),
      h('div', {}, h('dt', { text: 'Last 30 days' }), h('dd', { text: LG.fmtMin(m30) })),
      h('div', {}, h('dt', { text: 'All time' }), h('dd', { text: LG.fmtMin(total) })),
      h('div', {}, h('dt', { text: 'Streak' }), h('dd', {}, String(WS.progress.streak()), h('span', { class: 'dd-unit', text: ` · best ${LG.longestStreak()}` }))),
      h('div', {}, h('dt', { text: 'Days played, 30' }), h('dd', { text: String(LG.activeDays(WS.addDays(today, -29), today)) })),
      h('div', {}, h('dt', { text: 'XP' }), h('dd', { text: WS.fmtInt(s.xp) }))));

    // Insights + session
    const ins = LG.insights();
    const KIND_LABEL = { up: 'Going well', down: 'Watch this', weak: 'Weak spot', goal: 'Goal', balance: 'Balance', info: 'Note' };
    root.append(h('div', { class: 'stats-top' },
      h('section', { class: 'panel insights' }, h('h2', { text: 'Insights' }),
        ins.length ? h('ul', { class: 'insight-list' }, ins.slice(0, 7).map((x) => h('li', { class: `ins ins-${x.kind}` }, h('span', { class: 'ins-k', text: KIND_LABEL[x.kind] }), h('span', { text: x.text }))))
          : h('p', { class: 'muted', text: 'Insights show up once there’s a few days of practice to look at: time per area, weak chords and keys, tempo gains, ear accuracy, timing.' })),
      UI.sessionCard()));

    // Minutes per day, last 14 days
    const days14 = Array.from({ length: 14 }, (_, i) => WS.addDays(today, i - 13));
    const vals = days14.map((k) => Math.round(LG.dayMinutes(k)));
    const labs = days14.map((k) => WS.parseKey(k).toLocaleDateString(undefined, { weekday: 'narrow' }));
    const am = LG.areaMinutes(WS.addDays(today, -29), today);
    const amRows = Object.entries(am).filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1]);
    const amMax = amRows.length ? amRows[0][1] : 0;
    root.append(h('div', { class: 'two-col' },
      h('section', { class: 'panel' }, h('h2', { text: 'Minutes a day' }), barChart(vals, labs, { unit: ' min' }),
        h('p', { class: 'muted small', text: 'The last 14 days. A day counts the larger of your logged sessions and the playing time the keyboard picked up.' })),
      h('section', { class: 'panel' }, h('h2', { text: 'Time by area, 30 days' }),
        amRows.length ? hbars(amRows.map(([a, v]) => [LG.AREA[a] ? LG.AREA[a].name : a, v, amMax, LG.fmtMin(v)])) : h('p', { class: 'muted', text: 'Log a session or play in the app to see this.' }))));

    // The log
    const log = [...(s.log || [])].reverse();
    const logBody = h('div', { class: 'log-list' });
    const showN = 12;
    const renderLog = (n) => {
      logBody.replaceChildren(...log.slice(0, n).map((e) => h('button', { type: 'button', class: 'log-row', onclick: () => UI.logForm({ entry: e, manual: true }) },
        h('span', { class: 'log-day', text: WS.fmtDay(e.day) }),
        h('span', { class: 'log-min', text: LG.fmtMin(e.minutes) }),
        h('span', { class: 'log-what' },
          h('span', { text: e.areaMin && Object.keys(e.areaMin).length ? Object.entries(e.areaMin).sort((a, b) => b[1] - a[1]).map(([a, m]) => `${LG.AREA[a] ? LG.AREA[a].name : a} ${Math.round(m)}m`).join(', ') : e.areas.map((a) => (LG.AREA[a] ? LG.AREA[a].name : a)).join(', ') || 'Practice' }),
          e.auto ? h('span', { class: 'auto-tag', text: e.ask ? 'needs a label' : 'auto' }) : null,
          e.summary ? h('span', { class: 'log-notes muted small', text: e.summary }) : null,
          e.piece ? h('span', { class: 'muted', text: ` · ${e.piece}` }) : null,
          e.bpm ? h('span', { class: 'muted', text: ` · ♩ = ${e.bpm}` }) : null,
          e.notes ? h('span', { class: 'log-notes muted small', text: e.notes }) : null),
        h('span', { class: 'log-rate', text: e.rating ? '●'.repeat(e.rating) + '○'.repeat(5 - e.rating) : '' }))));
      if (log.length > n) logBody.append(btn(`Show all ${log.length}`, () => renderLog(log.length), 'btn btn-ghost'));
      UI.glyphify(logBody);
    };
    renderLog(showN);
    root.append(h('section', { class: 'panel' },
      h('div', { class: 'panel-h' }, h('h2', { text: 'Practice log' }), btn('Add practice away from the app', () => UI.logForm({ manual: true }), 'btn btn-ghost btn-sm')),
      log.length ? logBody : h('p', { class: 'muted', text: 'Nothing logged yet. Play and it fills in by itself.' })));

    // Tempo progress per Chord Runner level
    const tempoRows = WS.levels.LEVELS.map((d) => [d, LG.tempoHistory(d.id)]).filter(([, hst]) => hst.length);
    if (tempoRows.length) {
      root.append(h('section', { class: 'panel' }, h('h2', { text: 'Tempo progress, Chord Runner' }),
        h('ul', { class: 'tempo-list' }, tempoRows.map(([d, hst]) => {
          const first = hst[0][1]; const best = Math.max(...hst.map((x) => x[1]));
          const spark = svg('svg', { viewBox: '0 0 120 28', class: 'spark', 'aria-hidden': 'true' });
          const lo = Math.min(...hst.map((x) => x[1])) - 4; const hi = best + 4;
          const pts = hst.map(([, v], i) => `${hst.length === 1 ? 60 : (i / (hst.length - 1)) * 116 + 2},${26 - ((v - lo) / (hi - lo)) * 24}`).join(' ');
          spark.appendChild(svg('polyline', { points: pts, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linejoin': 'round' }));
          return h('li', {}, h('span', { class: 'tl-name', text: d.name }), spark, h('span', { class: 'tl-val', text: `♩ ${first} → ${best}` }), h('span', { class: 'muted small', text: `target ${d.target}` }));
        }))));
    }

    // Ear
    if ((s.earRounds || []).length) {
      const degs = E.accuracy('deg:').sort((a, b) => ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'].indexOf(a.key) - ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7'].indexOf(b.key));
      const qs = E.accuracy('q:');
      root.append(h('div', { class: 'two-col' },
        h('section', { class: 'panel' }, h('h2', { text: 'Ear: scale degrees' }),
          degs.length ? hbars(degs.map((x) => [x.key, x.acc, 1, `${Math.round(x.acc * 100)}% of ${x.n}`])) : h('p', { class: 'muted', text: 'Play Degrees to see this.' })),
        h('section', { class: 'panel' }, h('h2', { text: 'Ear: chord quality' }),
          qs.length ? hbars(qs.map((x) => [T.Q[x.key] ? T.Q[x.key].name : x.key, x.acc, 1, `${Math.round(x.acc * 100)}% of ${x.n}`])) : h('p', { class: 'muted', text: 'Play Chord Quality to see this.' }))));
    }

    // Metronome timing history
    const mr = (s.metroStats || {}).recent || [];
    if (mr.length) {
      root.append(h('section', { class: 'panel' }, h('h2', { text: 'Timing with the metronome' }),
        h('ul', { class: 'worst' }, mr.slice(-8).reverse().map((x) => h('li', {}, h('strong', { text: Math.abs(x.mean) < 6 ? 'On the click' : x.mean < 0 ? `${-x.mean} ms ahead` : `${x.mean} ms behind` }), h('span', { class: 'muted', text: ` · spread ${x.sd} ms · ${x.n} notes · ${WS.fmtDay(x.day)}` }))))));
    }

    // Chord Runner sections from the old Progress screen
    const tmp = h('div', {});
    VIEWS.progress(tmp);
    tmp.querySelectorAll('.page-head, .statline').forEach((n) => n.remove());
    const cal = tmp.querySelector('.panel');
    if (cal) cal.querySelector('h2').textContent = 'Core days, last 12 weeks';
    root.append(h('h2', { class: 'section-h', text: 'Chord Runner' }), ...tmp.childNodes);
  };

  /* =========================================================================================
     EAR GAMES
     ========================================================================================= */
  UI.earLane = () => h('section', { class: 'lane' },
    h('h2', { text: 'Ear' }), h('p', { class: 'lane-blurb', text: 'Degrees, Echo, Bass Detective, Chord Quality' }),
    h('ol', { class: 'nodes' }, E.GAMES.map((g) => {
      const passed = g.levels.filter((_, i) => E.levelState(g.id, i).passed).length;
      return h('li', {}, h('button', { type: 'button', class: `node${passed === g.levels.length ? ' node-mastered' : ''}`, onclick: () => { location.hash = '#ear'; setTimeout(() => UI.startEar(g.id, E.nextLevel(g.id)), 30); } },
        h('span', { class: 'node-badge', text: g.drill }),
        h('span', { class: 'node-text' }, h('span', { class: 'node-name', text: g.name }), h('span', { class: 'muted small', text: `${passed} of ${g.levels.length} levels passed` }))));
    })));

  VIEWS.ear = (root) => {
    UI._earActive = false;
    const sug = E.suggest();
    root.append(pageHead('Ear training', 'Woodshed plays, you answer on the keyboard. Every round is 10 questions; 8 right passes the level and opens the next. Each game is a drill from the roadmap.'));
    const grid = h('div', { class: 'ear-games' });
    for (const g of E.GAMES) {
      const card = RM.drill(g.drill);
      grid.append(h('section', { class: `panel ear-card${g.id === sug ? ' ear-sug' : ''}` },
        h('div', { class: 'ear-card-h' },
          h('div', {}, h('h2', { text: g.name }), h('p', { class: 'muted small', text: `${g.short} · roadmap ${g.drill}${card ? `, ${card.when.toLowerCase()}` : ''}` })),
          g.id === sug ? h('span', { class: 'chip-s chip-now', text: 'This week' }) : null),
        h('p', { class: 'ear-blurb', text: g.blurb }),
        h('ol', { class: 'ear-levels' }, g.levels.map((lv, i) => {
          const ls = E.levelState(g.id, i);
          const open = E.isUnlocked(g.id, i);
          return h('li', {}, h('button', { type: 'button', class: `ear-level${ls.passed ? ' passed' : ''}${!open ? ' locked' : ''}`, disabled: !open, onclick: () => UI.startEar(g.id, i) },
            h('span', { class: 'el-n', text: String(i + 1) }),
            h('span', { class: 'el-name', text: lv.name }),
            h('span', { class: 'el-best' }, !open ? icon('lock', 14) : ls.passed ? h('span', {}, icon('check', 14), ls.perfect ? ' 10/10' : ` ${ls.best}/10`) : ls.plays ? `best ${ls.best}/10` : '')));
        }))));
    }
    root.append(grid);
    const s = WS.S();
    const recent = (s.earRounds || []).slice(-8).reverse();
    if (recent.length) {
      root.append(h('section', { class: 'panel' }, h('h2', { text: 'Recent ear rounds' }),
        h('ul', { class: 'worst' }, recent.map((r) => h('li', {}, h('strong', { text: `${r.score}/${r.n}` }), h('span', { class: 'muted', text: ` · ${E.def(r.game).name}, ${E.def(r.game).levels[r.level].name} · ${WS.fmtDay(r.day)} · +${r.xp} XP` }))))));
    }
  };

  /* One round of an ear game, drawn in the view */
  UI.startEar = (gid, li) => {
    if (UI.current !== 'ear') { location.hash = '#ear'; UI.go('ear'); }
    const g = E.def(gid);
    const lv = g.levels[li];
    const root = WS.$('#view');
    root.replaceChildren();
    WS.audio.ensure();
    WS.input.qwertyWanted = true;
    WS.input.forceSound = true;
    UI._earActive = true;
    if (WS.piano && WS.piano.available() && WS.piano.status === 'idle') WS.piano.load();

    let qi = 0; let score = 0; let qn = null; let phase = 'idle'; let played = []; let replays = 0; let chordTimer = null;
    const results = [];
    const dots = h('ol', { class: 'hud-dots ear-dots', 'aria-label': 'Round progress' }, Array.from({ length: E.ROUND }, () => h('li', {})));
    const prompt = h('p', { class: 'ear-prompt', 'aria-live': 'polite' });
    const detail = h('p', { class: 'ear-detail' });
    const playedOut = h('div', { class: 'ear-played' });
    const kb = (() => {
      const lo = 36; const hi = 84;
      const whites = []; for (let n = lo; n <= hi; n++) if (![1, 3, 6, 8, 10].includes(n % 12)) whites.push(n);
      const s = svg('svg', { viewBox: `0 0 ${whites.length * 20} 64`, class: 'mini-kb ear-kb', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
      const map = {};
      whites.forEach((n, i) => { const r = svg('rect', { x: i * 20 + 0.5, y: 0.5, width: 19, height: 63, rx: 2, class: `kw${n === 60 ? ' kw-mid' : ''}` }); s.appendChild(r); map[n] = r; });
      whites.forEach((n, i) => { const b = n + 1; if (b <= hi && [1, 3, 6, 8, 10].includes(b % 12)) { const r = svg('rect', { x: i * 20 + 13.5, y: 0.5, width: 12, height: 38, rx: 1.5, class: 'kb' }); s.appendChild(r); map[b] = r; } });
      s._map = map; return s;
    })();
    const light = (notes, on, cls = 'down') => notes.forEach((n) => { const r = kb._map[n] || kb._map[n + 12] || kb._map[n - 12]; if (r) r.classList.toggle(cls, on); });
    const clearKb = () => Object.values(kb._map).forEach((r) => r.classList.remove('down', 'answer', 'wrong'));

    const qButtons = h('div', { class: 'q-buttons' });
    if (gid === 'quality') {
      qButtons.append(...lv.qs.map((q) => h('button', { type: 'button', class: 'btn btn-ghost q-btn', dataset: { q }, onclick: () => answerQuality(q) }, T.Q[q].name)));
    }
    const replayBtn = btn('Hear it again (R)', () => listen(false), 'btn btn-ghost');
    const keyBtn = btn('Key + question (K)', () => listen(true), 'btn btn-ghost');
    const skipBtn = btn('I don’t know', () => grade(false, 'Skipped'), 'btn btn-ghost');
    const nextBtn = btn('Next (Enter)', () => nextQ(), 'btn btn-primary');
    nextBtn.hidden = true;
    const scoreOut = h('span', { class: 'ear-score', text: '0' });

    root.append(
      h('div', { class: 'ear-game' },
        h('div', { class: 'ear-top' },
          btn('← All ear games', () => { E.stopAudio(); UI._earActive = false; UI.go('ear'); }, 'btn btn-ghost btn-sm'),
          h('div', { class: 'ear-title' }, h('span', { class: 'sheet-kicker', text: `${g.name} · level ${li + 1}` }), h('h1', { class: 'page-title', text: lv.name })),
          h('div', { class: 'ear-meta' }, dots, h('span', { class: 'muted small' }, 'Score ', scoreOut))),
        h('section', { class: 'ear-stage' }, prompt, detail, playedOut, qButtons,
          h('div', { class: 'kb-wrap' }, kb),
          h('div', { class: 'row ear-actions' }, replayBtn, gid !== 'quality' ? keyBtn : null, skipBtn, nextBtn)),
        h('p', { class: 'muted small ear-help', text: gid === 'quality' ? 'Tap the quality, or play the exact chord back (any voicing) for the same point.' : gid === 'degrees' ? 'Any octave counts. Sing it first, then find it.' : 'Any octave counts. Only the order of the notes matters.' })));
    UI.glyphify(root);

    const setPhase = (p) => {
      phase = p;
      replayBtn.disabled = p === 'listen';
      keyBtn.disabled = p === 'listen';
      skipBtn.hidden = p === 'done';
      nextBtn.hidden = p !== 'done';
      qButtons.querySelectorAll('button').forEach((b) => { b.disabled = p !== 'answer'; });
    };
    const listen = (withKey) => {
      if (!qn) return;
      if (phase === 'answer') replays++;
      setPhase('listen');
      prompt.textContent = 'Listen…';
      clearKb();
      E.playQuestion(qn, { withCadence: withKey }, () => {
        if (phase !== 'listen') return;
        setPhase('answer');
        played = [];
        prompt.textContent = gid === 'degrees' ? 'Play that note.' : gid === 'echo' ? `Play the ${qn.len} notes back.` : gid === 'bass' ? 'Play the 4 bass notes in order.' : 'What quality was that?';
        paintPlayed();
      });
    };
    const paintPlayed = () => {
      if (gid === 'quality') { playedOut.replaceChildren(); return; }
      playedOut.replaceChildren(...Array.from({ length: qn.len }, (_, i) => h('span', { class: `slot${played[i] != null ? ' filled' : ''}`, text: played[i] != null ? T.FLAT[played[i] % 12] : '' })));
      UI.glyphify(playedOut);
    };
    const grade = (ok, why) => {
      if (phase === 'done') return;
      E.stopAudio();
      clearTimeout(chordTimer);
      setPhase('done');
      if (ok) score++;
      results.push(ok);
      E.recordItem(qn, ok);
      dots.children[qi].className = ok ? 'dot-perfect' : 'dot-miss';
      scoreOut.textContent = String(score);
      prompt.textContent = ok ? 'Yes.' : (why || 'Not quite.');
      prompt.className = `ear-prompt ${ok ? 'ok' : 'no'}`;
      detail.textContent = qn.label;
      UI.glyphify(detail);
      if (ok) WS.audio.sfx('good'); else WS.audio.sfx('miss');
      // Show and play the answer
      setTimeout(() => {
        if (phase !== 'done') return;
        E.playAnswer(qn, (notes, on) => light(notes, on, 'answer'));
      }, ok ? 250 : 500);
      nextBtn.focus();
    };
    const answerQuality = (q) => { if (phase !== 'answer') return; grade(q === qn.q, `It was ${T.Q[qn.q].name}.`); };
    const onNote = (e) => {
      if (e.src === 'playback') return;
      light([e.n], true);
      if (phase !== 'answer') return;
      if (gid === 'quality') {
        clearTimeout(chordTimer);
        chordTimer = setTimeout(() => {
          const held = WS.input.notes();
          if (held.length >= qn.answer.length) grade(E.gradeChord(qn, held), `It was ${T.Q[qn.q].name}.`);
        }, 220);
        return;
      }
      played.push(e.n);
      paintPlayed();
      if (played.length >= qn.len) grade(E.gradeSeq(qn, played), gid === 'degrees' ? `That was ${T.FLAT[played[0] % 12]}.` : 'Not the same notes.');
    };
    const onOff = (e) => { if (e.src === 'playback') return; light([e.n], false); };
    const nextQ = () => {
      if (results.length >= E.ROUND) return finish();
      qi = results.length;
      qn = E.makeQuestion(gid, li);
      prompt.className = 'ear-prompt';
      detail.textContent = '';
      dots.children[qi].className = 'dot-now';
      // Degrees and Echo always set the key; after the first question the key stays the same until it changes
      listen(true);
    };
    const finish = () => {
      E.stopAudio();
      UI._earActive = false;
      cleanup();
      const out = E.finishRound(gid, li, score, E.ROUND);
      const panel = h('section', { class: 'summary ear-summary', role: 'dialog', 'aria-labelledby': 'ear-sum' },
        h('p', { class: 'sheet-kicker', text: `${g.name} · ${lv.name}` }),
        h('h2', { id: 'ear-sum', class: `sum-title ${out.passed ? 'sum-pass' : ''}`, text: out.perfect ? 'Perfect ear' : out.passed ? 'Passed' : 'Not yet' }),
        h('p', { class: 'sum-line' }, h('strong', { text: `${score} of ${E.ROUND}` }), ` right. 8 passes. ${replays ? `You asked to hear it again ${replays} time${replays > 1 ? 's' : ''}.` : ''}`),
        out.unlocked != null ? h('p', { class: 'ok-line', text: `Next level open: ${g.levels[out.unlocked].name}.` }) : null,
        h('p', { class: 'sum-xp', text: `+${out.xp} XP` }),
        h('div', { class: 'sheet-actions' },
          btn('Play again', () => UI.startEar(gid, li), 'btn btn-primary'),
          out.unlocked != null ? btn(`Next level`, () => UI.startEar(gid, out.unlocked), 'btn btn-ghost') : null,
          btn('All ear games', () => UI.go('ear'), 'btn btn-ghost')));
      root.querySelector('.ear-stage').replaceChildren(panel);
      UI.glyphify(panel);
      panel.querySelector('.btn-primary').focus();
    };
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea')) return;
      if ((e.key === 'r' || e.key === 'R') && phase === 'answer') listen(false);
      else if ((e.key === 'k' || e.key === 'K') && phase === 'answer') listen(true);
      else if (e.key === 'Enter' && phase === 'done') { e.preventDefault(); nextQ(); }
    };
    const unsubs = [WS.bus.on('noteon', onNote), WS.bus.on('noteoff', onOff)];
    document.addEventListener('keydown', onKey);
    const cleanup = () => { unsubs.forEach((f) => f()); document.removeEventListener('keydown', onKey); clearTimeout(chordTimer); };
    onLeave(kb, () => { cleanup(); E.stopAudio(); UI._earActive = false; });
    UI._ear = { get qn() { return qn; }, get phase() { return phase; }, answerQuality, finish };
    setPhase('idle');
    prompt.textContent = 'Get ready…';
    setTimeout(() => nextQ(), 400);
  };

  /* =========================================================================================
     TROPHIES
     ========================================================================================= */
  VIEWS.trophies = (root) => {
    const got = AC.st();
    const n = AC.LIST.filter((a) => got[a.id]).length;
    root.append(pageHead('Trophies', `${n} of ${AC.LIST.length} unlocked. Each one pays a little XP the moment you earn it.`,
      h('div', { class: 'stat' }, progBar((n / AC.LIST.length) * 100), h('p', { class: 'stat-label', text: `${Math.round((n / AC.LIST.length) * 100)}% of the case` }))));
    const cats = [...new Set(AC.LIST.map((a) => a.cat))];
    for (const c of cats) {
      const list = AC.LIST.filter((a) => a.cat === c);
      root.append(h('section', { class: 'trophy-cat' },
        h('h2', { text: c }),
        h('ul', { class: 'trophies' }, list.map((a) => {
          const on = !!got[a.id];
          const p = AC.progress(a);
          const hidden = a.secret && !on;
          return h('li', { class: `trophy t${a.tier}${on ? ' on' : ''}` },
            h('span', { class: 'trophy-ic' }, icon(on ? 'trophy' : 'lock', 22)),
            h('span', { class: 'trophy-body' },
              h('span', { class: 'trophy-name', text: hidden ? 'Secret' : a.name }),
              h('span', { class: 'trophy-desc', text: hidden ? 'Keep playing to find this one.' : a.desc }),
              on ? h('span', { class: 'trophy-when', text: `Unlocked ${WS.fmtDay(got[a.id])}${a.xp ? ` · +${a.xp} XP` : ''}` })
                : !hidden && p.goal > 1 ? h('span', { class: 'trophy-prog' }, progBar((p.cur / p.goal) * 100, 'pbar-sm'), h('span', { class: 'small muted', text: ` ${WS.fmtInt(p.cur)} / ${WS.fmtInt(p.goal)}` })) : null));
        }))));
    }
  };

  /* =========================================================================================
     RECORDINGS on the Play screen
     ========================================================================================= */
  const TAGS = [['free', 'Free play'], ['score', 'Score piece'], ['improv', 'Improv'], ['ear', 'By ear'], ['other', 'Other']];
  UI.recorderPanel = () => {
    const wrap = h('div', { class: 'rec-wrap' });
    const recBtn = h('button', { type: 'button', class: 'rec-btn', onclick: () => {
      if (RC.recording) {
        const r = RC.stop();
        WS.toast(r ? `Saved “${r.name}”.` : 'Nothing was played, so nothing was saved.');
      } else RC.start();
      paintRec(); paintList(); UI.paintSessionPill();
    } });
    const recTime = h('span', { class: 'rec-time' });
    const paintRec = () => {
      recBtn.replaceChildren(h('span', { class: `rec-dot${RC.recording ? ' on' : ''}`, 'aria-hidden': 'true' }), RC.recording ? 'Stop and save' : 'Record');
      recBtn.classList.toggle('on', RC.recording);
      recBtn.setAttribute('aria-pressed', RC.recording ? 'true' : 'false');
      recTime.textContent = RC.recording ? mmss(RC.elapsed()) : '';
    };
    const tick = setInterval(() => { if (!document.body.contains(recBtn)) { clearInterval(tick); return; } if (RC.recording) recTime.textContent = mmss(RC.elapsed()); }, 250);

    const list = h('div', { class: 'rec-list' });
    const paintList = () => {
      const recs = [...RC.list()].reverse();
      if (!recs.length) { list.replaceChildren(h('p', { class: 'muted', text: 'No recordings yet. Press Record, play, then Stop. Recordings are MIDI: they replay through any sound, and you can download them as .mid files.' })); return; }
      list.replaceChildren(...recs.map((r) => {
        const playing = RC.playing && RC.playing.id === r.id;
        const pos = h('span', { class: 'rec-pos', text: playing ? '' : mmss(r.dur) });
        const bar = h('span', { class: 'rec-bar' }, h('i', {}));
        const name = h('input', { type: 'text', class: 'rec-name', value: r.name, 'aria-label': 'Recording name', onchange: (e) => RC.rename(r.id, e.target.value.trim() || r.name) });
        const tag = h('select', { 'aria-label': 'Tag', class: 'rec-tag', onchange: (e) => RC.setTag(r.id, e.target.value) }, TAGS.map(([v, t]) => h('option', { value: v, selected: r.tag === v, text: t })));
        const playB = h('button', { type: 'button', class: 'icon-btn rec-play', 'aria-label': playing ? 'Stop' : `Play ${r.name}`, onclick: () => {
          if (RC.playing && RC.playing.id === r.id) RC.stopPlayback(); else RC.play(r.id, () => paintList());
          paintList();
        } }, icon(playing ? 'stop' : 'play', 18, true));
        const row = h('div', { class: `rec-row${playing ? ' playing' : ''}`, dataset: { id: r.id } },
          playB,
          h('div', { class: 'rec-main' }, name,
            h('div', { class: 'rec-meta' }, bar, pos, h('span', { class: 'muted small', text: `${WS.fmtDay(r.day)} · ${r.notes} notes` }), tag)),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Download ${r.name} as MIDI`, title: 'Download .mid', onclick: () => RC.download(r.id) }, icon('download', 18)),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete ${r.name}`, title: 'Delete', onclick: () => {
            if (row.classList.contains('confirm-del')) { RC.remove(r.id); paintList(); } else { row.classList.add('confirm-del'); WS.toast('Press delete again to remove it.'); setTimeout(() => row.classList.remove('confirm-del'), 3000); }
          } }, icon('trash', 18)));
        row._bar = bar; row._pos = pos;
        return row;
      }));
    };
    const unsub = WS.bus.on('playback', (e) => {
      if (!e.id) return;
      const row = list.querySelector(`.rec-row[data-id="${e.id}"]`);
      if (row && row._bar) { row._bar.firstChild.style.width = `${Math.min(100, (e.pos / e.dur) * 100)}%`; row._pos.textContent = `${mmss(e.pos)} / ${mmss(e.dur)}`; }
    });
    onLeave(recBtn, () => { unsub(); if (RC.playing) RC.stopPlayback(); });
    paintRec(); paintList();
    wrap.append(
      h('div', { class: 'rec-head' }, recBtn, recTime),
      h('section', { class: 'panel' }, h('h2', { text: 'Recordings' }), list));
    wrap._recBtn = recBtn;
    return wrap;
  };
})();
