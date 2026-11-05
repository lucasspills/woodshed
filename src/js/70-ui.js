/* Screens: Tonight, Path, Play, Progress, Keyboard, Settings; the level sheet; the game overlay and round summary. */
(function () {
  const h = WS.h;
  const svg = WS.svg;
  const T = WS.theory;
  const L = WS.levels;
  const P = WS.progress;
  const UI = (WS.ui = {});

  /* ---------------- Small building blocks ---------------- */
  const ICON_PATHS = {
    tonight: [['path', { d: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z' }]],
    path: [['circle', { cx: 6, cy: 18, r: 2.2 }], ['circle', { cx: 12, cy: 7, r: 2.2 }], ['circle', { cx: 18, cy: 15, r: 2.2 }], ['path', { d: 'M7.2 16.1l3.6-7.2M13.4 8.7l3.4 4.6' }]],
    progress: [['path', { d: 'M5 19v-7M12 19V6M19 19v-10' }]],
    keyboard: [['rect', { x: 3, y: 6, width: 18, height: 12, rx: 2 }], ['path', { d: 'M8 6v7M12 6v7M16 6v7' }]],
    settings: [['path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }], ['circle', { cx: 15, cy: 7, r: 2 }], ['circle', { cx: 9, cy: 17, r: 2 }]],
    freeze: [['path', { d: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5' }]],
    play: [['path', { d: 'M8 5.5v13l11-6.5z', fill: 'currentColor', stroke: 'none' }]],
    grand: [['path', { d: 'M4 18V9.5C4 6.5 6.5 4 9.5 4c2.6 0 3.6 1.6 4.4 3.3.8 1.7 2 2.7 4.1 3.2 1.5.4 1.9 1.4 1.9 2.5V18z' }], ['path', { d: 'M4 14.5h16M8 14.5V18M12 14.5V18M16 14.5V18' }]],
  };
  UI.icon = (name, size = 20) => svg('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'icon' },
    ICON_PATHS[name].map(([tag, attrs]) => svg(tag, attrs)));

  const STAR_D = 'M12 2.6l2.85 5.95 6.55.8-4.83 4.5 1.27 6.5L12 17.2l-5.84 3.15 1.27-6.5L2.6 9.35l6.55-.8z';
  UI.stars = (ls, size = 18) => {
    const wrap = h('span', { class: 'stars', role: 'img', 'aria-label': UI.starsLabel(ls) });
    ls.stars.forEach((st) => {
      const kind = st.g ? 'gold' : st.s ? 'silver' : 'empty';
      wrap.appendChild(svg('svg', { viewBox: '0 0 24 24', width: size, height: size, class: `star star-${kind}`, 'aria-hidden': 'true' }, svg('path', { d: STAR_D })));
    });
    return wrap;
  };
  UI.starsLabel = (ls) => {
    const g = L.goldCount(ls);
    const s = L.silverCount(ls) - g;
    return `${g} gold, ${s} silver, ${3 - g - s} to earn`;
  };
  UI.oneStar = (kind, size = 22) => svg('svg', { viewBox: '0 0 24 24', width: size, height: size, class: `star star-${kind}`, 'aria-hidden': 'true' }, svg('path', { d: STAR_D }));

  /* Chord symbol as DOM, lead-sheet style */
  UI.sym = (sym, cls = '') => {
    const p = T.symParts(sym);
    return h('span', { class: `sym ${cls}` },
      h('span', { class: 'sym-root', text: p.letter }),
      p.acc ? h('span', { class: 'sym-acc', text: p.acc }) : null,
      p.suffix ? h('span', { class: 'sym-q', text: p.suffix }) : null);
  };

  const btn = (label, onclick, cls = 'btn') => h('button', { type: 'button', class: cls, onclick }, label);

  /* Wrap music glyphs (♩ ★ ♭ ♯) in a span set in a symbol font, so they sit right in running text. */
  const GLYPH_RE = /[♩★♭♯]/;
  UI.glyphify = (root) => {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!GLYPH_RE.test(n.nodeValue)) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || p.closest('.sym, .glyph, option, select, script, style, svg')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/([♩★♭♯])/).forEach((part) => {
        if (!part) return;
        if (part === '♩') {
          // Drawn quarter note: looks the same on every machine
          frag.appendChild(svg('svg', { viewBox: '0 0 12 20', class: 'glyph-svg glyph-note', role: 'img', 'aria-label': 'quarter note' },
            svg('ellipse', { cx: 4.6, cy: 16, rx: 4.1, ry: 3, transform: 'rotate(-22 4.6 16)', fill: 'currentColor' }),
            svg('path', { d: 'M8.3 15.6V1.8', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })));
        } else if (part === '★') {
          frag.appendChild(svg('svg', { viewBox: '0 0 24 24', class: 'glyph-svg glyph-star', role: 'img', 'aria-label': 'star' }, svg('path', { d: STAR_D, fill: 'currentColor' })));
        } else if (part === '♭' || part === '♯') {
          frag.appendChild(h('span', { class: 'glyph glyph-acc', text: part }));
        } else frag.appendChild(document.createTextNode(part));
      });
      node.parentNode.replaceChild(frag, node);
    }
  };

  UI.weekStrip = (k) => {
    const mon = WS.mondayOf(k);
    const today = WS.todayKey();
    const letters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return h('ol', { class: 'weekstrip', 'aria-label': 'This week' }, letters.map((l, i) => {
      const dk = WS.addDays(mon, i);
      const d = WS.S().days[dk];
      const cls = ['wday'];
      if (d && d.core) cls.push('wday-core');
      else if (d && d.freeze) cls.push('wday-freeze');
      if (dk === today) cls.push('wday-today');
      const label = `${WS.DOW_NAMES[i]}${d && d.core ? ': core done' : d && d.freeze ? ': freeze used' : ''}`;
      return h('li', { class: cls.join(' '), title: label, 'aria-label': label }, h('span', { class: 'wday-dot' }, d && d.freeze && !d.core ? UI.icon('freeze', 12) : null), h('span', { class: 'wday-l', text: l }));
    }));
  };

  /* ---------------- Rail status ---------------- */
  UI.refreshRail = () => {
    const pill = WS.$('#kbd-pill');
    if (!pill) return;
    const st = WS.input.status;
    const mode = WS.S().settings.inputMode;
    let text = 'Connect keyboard';
    let cls = 'kbd-pill';
    if (st === 'connected') { text = WS.input.devices[0] ? WS.input.devices[0].name : 'Keyboard connected'; cls += ' kbd-on'; }
    else if (mode !== 'midi') { text = 'Computer keys'; cls += ' kbd-alt'; }
    pill.className = cls;
    pill.querySelector('.kbd-text').textContent = text;
    WS.$$('.nav-link').forEach((a) => a.classList.toggle('active', a.dataset.view === UI.current));
  };

  /* ---------------- Router ---------------- */
  const VIEWS = {};
  UI.current = 'tonight';
  UI.go = (name) => {
    if (!VIEWS[name]) name = 'tonight';
    if (UI.current === 'play' && name !== 'play' && UI._leavePlay) UI._leavePlay();
    UI.current = name;
    WS.input.qwertyWanted = name === 'keyboard' || name === 'play';
    WS.input.forceSound = name === 'play';
    WS.input.qwertySustain = name === 'play';
    WS.rig.active = name === 'play';
    const main = WS.$('#view');
    main.replaceChildren();
    VIEWS[name](main);
    UI.glyphify(main);
    UI.refreshRail();
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  };
  UI.rerender = () => { if (!WS.$('#game').hidden) return; UI.go(UI.current); };

  /* ---------------- Tonight ---------------- */
  VIEWS.tonight = (root) => {
    const s = WS.S();
    const today = WS.todayKey();
    const plan = P.tonight(today);
    const day = P.day(today);
    const weekN = P.weekCount(today);
    const streak = P.streak();
    const { cur, next } = P.rank(s.xp);

    const focusName = { harmony: 'harmony', improv: 'improv', ear: 'ear', review: 'review' }[plan.focus];
    root.append(
      h('header', { class: 'page-head' },
        h('div', { class: 'page-head-text' },
          h('h1', { class: 'page-title', text: `${WS.DOW_NAMES[plan.dow]}, week ${plan.week}` }),
          h('p', { class: 'page-sub', text: plan.phase === 1 ? `Phase 1, Foundation. Focus tonight: ${focusName}.` : `Past the Phase 1 plan. Focus tonight: ${focusName}.` })),
        h('div', { class: 'status' },
          h('div', { class: 'stat' },
            UI.weekStrip(today),
            h('p', { class: 'stat-label' }, h('strong', { text: `${weekN} of ${P.WEEK_GOAL}` }), ' core days this week')),
          h('div', { class: 'stat stat-streak' },
            h('span', { class: 'big-num', text: String(streak) }),
            h('p', { class: 'stat-label' }, `day streak`,
              h('span', { class: 'freezes', title: 'Streak freezes cover a missed day. You earn one every 7 core days, up to 2.' },
                [...Array(s.freezes)].map(() => UI.icon('freeze', 14)), s.freezes ? ` ${s.freezes} freeze${s.freezes > 1 ? 's' : ''}` : ''))),
          h('div', { class: 'stat stat-rank' },
            h('p', { class: 'rank-name', text: cur.name }),
            h('div', { class: 'xpbar', role: 'progressbar', 'aria-valuemin': cur.xp, 'aria-valuemax': next ? next.xp : s.xp, 'aria-valuenow': s.xp },
              h('i', { style: { width: `${next ? Math.round(((s.xp - cur.xp) / (next.xp - cur.xp)) * 100) : 100}%` } })),
            h('p', { class: 'stat-label', text: next ? `${WS.fmtInt(s.xp)} of ${WS.fmtInt(next.xp)} XP to ${next.name}` : `${WS.fmtInt(s.xp)} XP` })))),
    );

    if (!s.seenIntro) {
      root.append(h('section', { class: 'intro' },
        h('div', {},
          h('h2', { text: 'Welcome to the shed' }),
          h('p', { text: 'Each night has the same shape: sight-reading and your score piece from the books, then one focus drill. Tick off the core here, play the drills in the app, and the path, stars and streak take care of themselves.' }),
          h('p', { text: 'Start by connecting your keyboard. No cable yet? Your computer keys work as a piano until it arrives.' })),
        h('div', { class: 'intro-actions' },
          btn('Set up the keyboard', () => { s.seenIntro = true; WS.store.save(); location.hash = '#keyboard'; }, 'btn btn-primary'),
          btn('Skip for now', () => { s.seenIntro = true; WS.store.save(); UI.rerender(); }, 'btn btn-ghost'))));
    }

    const colds = L.LEVELS.filter((d) => L.coldReady(d.id));
    const doneStep = (on) => (on ? ' step-done' : '');

    const toggle = (field, label) => {
      const on = !!day[field];
      return h('button', {
        type: 'button', class: `check${on ? ' on' : ''}`, 'aria-pressed': on ? 'true' : 'false',
        onclick: () => { P.setTask(today, field, !on); UI.rerender(); },
      }, h('span', { class: 'check-box', 'aria-hidden': 'true' }), on ? 'Done' : label);
    };

    // Step 1: warm up / cold checks
    const warm = h('li', { class: 'step' },
      h('span', { class: 'step-num', 'aria-hidden': 'true', text: '1' }),
      h('div', { class: 'step-body' },
        h('h3', {}, 'Warm up ', h('span', { class: 'step-time', text: '1–3 min' })),
        colds.length
          ? h('div', {},
            h('p', { text: 'Gold chances: your first round today on these levels is a cold check. Pass it and the silver star turns gold.' }),
            h('div', { class: 'chips' }, colds.map((d) => h('button', { type: 'button', class: 'chip chip-gold', onclick: () => UI.openLevel(d.id) }, UI.oneStar('gold', 14), d.name))))
          : h('p', { text: 'Scales in this week’s keys, hands together. Gold chances appear here the day after you earn a silver star.' })));

    const sight = h('li', { class: `step${doneStep(day.sight)}` },
      h('span', { class: 'step-num', 'aria-hidden': 'true', text: '2' }),
      h('div', { class: 'step-body' },
        h('h3', {}, 'Sight-reading ', h('span', { class: 'step-time', text: '7 min' })),
        h('p', { text: 'Something new from your books. Scan it for 20 seconds, metronome at 50 to 60, and never stop.' })),
      toggle('sight', 'Mark done'));

    const score = h('li', { class: `step${doneStep(day.score)}` },
      h('span', { class: 'step-num', 'aria-hidden': 'true', text: '3' }),
      h('div', { class: 'step-body' },
        h('h3', {}, 'Score piece ', h('span', { class: 'step-time', text: '8 min' })),
        h('p', { text: plan.row ? plan.row.score : 'Your current score piece, chunk by chunk.' })),
      toggle('score', 'Mark done'));

    // Step 4: focus
    let focusBody;
    const focusTitle = { harmony: 'Focus: harmony', improv: 'Focus: improv', ear: 'Focus: ear', review: 'Review' }[plan.focus];
    if (plan.focus === 'harmony' || plan.focus === 'improv') {
      const id = plan.levelId || plan.fallbackLevel;
      const d = id ? L.def(id) : null;
      focusBody = h('div', { class: 'step-body' },
        h('h3', {}, focusTitle, ' ', h('span', { class: 'step-time', text: '15 min' })),
        plan.drill ? h('p', { class: 'drill-ref', text: `Roadmap: ${plan.drill}` }) : null,
        d ? h('p', {}, plan.levelId ? 'In the app: ' : plan.inApp ? 'That level is still locked. Next up: ' : 'Not in the app yet. Warm-up pick: ', h('strong', { text: `Chord Runner, ${d.name}` })) : null,
        d ? h('div', { class: 'step-actions' }, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => UI.openLevel(id) }, UI.icon('play', 16), ' Play')) : null);
    } else {
      focusBody = h('div', { class: 'step-body' },
        h('h3', {}, focusTitle, ' ', h('span', { class: 'step-time', text: plan.focus === 'review' ? '15 min' : '15 min' })),
        h('p', { class: 'drill-ref', text: plan.focus === 'ear' ? `Roadmap: ${plan.drill || 'E-drill from the Drill Library'}` : plan.drill }),
        h('p', { class: 'muted', text: plan.focus === 'ear' ? 'Ear games aren’t built yet. Use the drill card in the Drill Library tab.' : 'Use any gold chances above, then record and listen back.' }));
    }
    const focus = h('li', { class: `step${doneStep(day.focus)}` },
      h('span', { class: 'step-num', 'aria-hidden': 'true', text: '4' }),
      focusBody,
      plan.focus === 'harmony' || plan.focus === 'improv' ? (day.focus ? h('span', { class: 'check on static' }, h('span', { class: 'check-box', 'aria-hidden': 'true' }), 'Done') : null) : toggle('focus', 'Mark done'));

    const coreNote = day.core
      ? h('p', { class: 'core-note core-done', text: 'Core done. Tonight counts toward your week and your streak.' })
      : h('p', { class: 'core-note', text: 'The core is sight-reading plus the score piece. Tick both and tonight counts, even on a 15-minute night.' });

    // Side column
    const side = h('aside', { class: 'side' });
    if (WS.input.status !== 'connected') {
      side.append(h('section', { class: 'side-card' },
        h('h2', { text: 'Keyboard' }),
        h('p', { text: WS.input.midiSupported() ? 'Not connected. Plug in your keyboard and connect it, or play with your computer keys for now.' : 'This browser can’t read MIDI. Open Woodshed in Chrome to use your keyboard.' }),
        btn('Open keyboard setup', () => { location.hash = '#keyboard'; }, 'btn btn-ghost')));
    }
    const nh = L.nextInLane('harmony');
    const ni = L.nextInLane('improv');
    side.append(h('section', { class: 'side-card' },
      h('h2', { text: 'Next on the path' }),
      [nh, ni].filter(Boolean).map((id) => {
        const d = L.def(id);
        return h('button', { type: 'button', class: 'next-row', onclick: () => UI.openLevel(id) },
          h('span', { class: 'next-code', text: d.code }),
          h('span', { class: 'next-name', text: d.name }),
          UI.stars(L.state(id), 14));
      })));
    side.append(h('section', { class: 'side-card' },
      h('h2', { text: 'Stars' }),
      h('p', { class: 'legend' }, UI.oneStar('silver', 16), ' Silver: you did it once.'),
      h('p', { class: 'legend' }, UI.oneStar('gold', 16), ' Gold: you did it on your first try on a later day. Gold is what stuck.')));

    root.append(h('div', { class: 'tonight-grid' },
      h('section', { class: 'session', 'aria-labelledby': 'session-h' },
        h('h2', { id: 'session-h', text: 'Tonight’s session' }),
        h('ol', { class: 'steps' }, warm, sight, score, focus),
        coreNote),
      side));
  };

  /* ---------------- Path ---------------- */
  VIEWS.path = (root) => {
    const recH = L.nextInLane('harmony');
    const recI = L.nextInLane('improv');
    root.append(h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        h('h1', { class: 'page-title', text: 'The path' }),
        h('p', { class: 'page-sub', text: 'Phase 1, Foundation. Each level needs a silver star to open the next one. Gold stars come from a clean first try on a later day.' }))));
    const lanes = h('div', { class: 'lanes' });
    for (const lane of L.LANES) {
      if (lane.locked) {
        lanes.append(h('section', { class: 'lane lane-locked' },
          h('h2', { text: lane.name }), h('p', { class: 'lane-blurb', text: lane.blurb }),
          h('p', { class: 'lane-soon', text: lane.soon })));
        continue;
      }
      const list = h('ol', { class: 'nodes' });
      for (const id of lane.levels) {
        const d = L.def(id);
        const ls = L.state(id);
        const open = L.isUnlocked(id);
        const cls = ['node'];
        if (!open) cls.push('node-locked');
        if (open && (id === recH || id === recI)) cls.push('node-next');
        if (L.allGold(ls)) cls.push('node-mastered');
        if (open && L.coldReady(id)) cls.push('node-cold');
        list.append(h('li', {},
          h('button', { type: 'button', class: cls.join(' '), disabled: !open, onclick: () => UI.openLevel(id), 'aria-label': `${d.name}. ${open ? UI.starsLabel(ls) : 'Locked: earn a silver star on the level before it.'}` },
            h('span', { class: 'node-badge', text: d.code }),
            h('span', { class: 'node-text' },
              h('span', { class: 'node-name', text: d.name }),
              open ? UI.stars(ls, 16) : h('span', { class: 'node-lock', text: 'Locked' }),
              open && L.coldReady(id) ? h('span', { class: 'node-flag', text: 'Gold chance today' }) : null))));
      }
      lanes.append(h('section', { class: 'lane' }, h('h2', { text: lane.name }), h('p', { class: 'lane-blurb', text: lane.blurb }), list));
    }
    root.append(lanes);
  };

  /* ---------------- Level sheet ---------------- */
  UI.openLevel = (id) => {
    const d = L.def(id);
    const ls = L.state(id);
    const today = WS.todayKey();
    const cold = L.coldReady(id);
    const crit = L.starCriteria(d);
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const how = d.kind === 'chord'
      ? 'A chord name rides in on each crate. Play that chord on beat 1 as the crate reaches you. Any inversion, either hand. Extra notes count as a miss.'
      : 'Each crate is one chord of a ii–V–I. Play the shell with your left hand below middle C: the root on the bottom, then the 3rd or 7th the shape calls for. The metronome clicks on 2 and 4.';
    const shapeNote = d.kind === 'shell'
      ? h('p', { class: 'muted', text: d.shapes.length > 1 ? 'Shape A: ii and I take root + 7th, V takes root + 3rd. Shape B is the reverse. Each progression tells you its shape.' : d.shapes[0] === 'A' ? 'Shape A: ii and I take root + 7th, V takes root + 3rd.' : 'Shape B: ii and I take root + 3rd, V takes root + 7th.' })
      : null;
    const starRows = crit.map((c, i) => {
      const st = ls.stars[i];
      const kind = st.g ? 'gold' : st.s ? 'silver' : 'empty';
      const status = st.g ? `Gold since ${WS.fmtDay(st.g)}` : st.s ? (st.s < today ? 'Silver. Gold chance: your first round today' : 'Silver today. Gold chance from tomorrow') : 'Not yet';
      return h('li', { class: `star-row star-row-${kind}` }, UI.oneStar(kind, 20), h('span', { class: 'star-row-text' }, h('span', { text: c }), h('span', { class: 'muted', text: status })));
    });
    const keys = L.keysInPool(ls).map((k) => T.KEY_NAME[k]);
    const actions = h('div', { class: 'sheet-actions' });
    const play = btn(cold ? 'Play the cold check' : 'Play a round', () => { close(); UI.startGame(id, 'normal'); }, 'btn btn-primary');
    actions.append(play);
    if (!cold && ls.pool >= 12 && !ls.stars[1].s && ls.tempo < d.target) {
      actions.append(btn(`Go for ★2 at ♩ = ${d.target}`, () => { close(); UI.startGame(id, 'challenge'); }, 'btn btn-ghost'));
    }
    if (ls.pool < 12) {
      actions.append(btn('Use all 12 keys now', () => { ls.pool = 12; WS.store.save(); close(); UI.openLevel(id); }, 'btn btn-ghost'));
    }
    const back = h('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === back) close(); } },
      h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sheet-title' },
        h('button', { type: 'button', class: 'sheet-close', 'aria-label': 'Close', onclick: close, text: '×' }),
        h('p', { class: 'sheet-kicker', text: `Chord Runner · Drill Library ${d.drill}` }),
        h('h2', { id: 'sheet-title', class: 'sheet-title', text: d.name }),
        cold ? h('p', { class: 'cold-banner' }, UI.oneStar('gold', 18), ` Cold check ready. Your first round today on this level counts for gold. It runs at ♩ = ${L.coldTempo(id)} with all 12 keys.`) : null,
        h('p', { text: how }),
        shapeNote,
        h('ul', { class: 'star-rows' }, starRows),
        h('dl', { class: 'facts' },
          h('div', {}, h('dt', { text: 'Tempo now' }), h('dd', { text: `♩ = ${cold ? L.coldTempo(id) : ls.tempo}` })),
          h('div', {}, h('dt', { text: 'Keys in play' }), h('dd', { text: ls.pool >= 12 ? 'All 12' : keys.join(', ') })),
          h('div', {}, h('dt', { text: 'Rounds' }), h('dd', { text: `${ls.rounds} played, ${ls.passes} passed` }))),
        h('p', { class: 'muted small', text: `A round is 12 chords; 11 hits passes. Three clean rounds in a row speed the tempo up, a missed round slows it down, so most rounds land around 80%. ${ls.pool < 12 ? 'Each passed round adds three more keys until all 12 are in.' : ''}` }),
        actions));
    document.body.append(back);
    UI.glyphify(back);
    document.addEventListener('keydown', onKey);
    play.focus();
  };

  /* ---------------- Game overlay ---------------- */
  let runner = null;
  let gameKeys = null;
  let unsubGame = [];

  const miniKeyboard = (lo = 36, hi = 84) => {
    const whites = [];
    for (let n = lo; n <= hi; n++) if (![1, 3, 6, 8, 10].includes(n % 12)) whites.push(n);
    const W = whites.length * 20;
    const s = svg('svg', { viewBox: `0 0 ${W} 64`, class: 'mini-kb', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
    const map = {};
    const xOf = {};
    whites.forEach((n, i) => {
      const r = svg('rect', { x: i * 20 + 0.5, y: 0.5, width: 19, height: 63, rx: 2, class: `kw${n === 60 ? ' kw-mid' : ''}` });
      s.appendChild(r); map[n] = r; xOf[n] = i * 20;
    });
    whites.forEach((n, i) => {
      const b = n + 1;
      if (b <= hi && [1, 3, 6, 8, 10].includes(b % 12)) {
        const r = svg('rect', { x: i * 20 + 13.5, y: 0.5, width: 12, height: 38, rx: 1.5, class: 'kb' });
        s.appendChild(r); map[b] = r; xOf[b] = i * 20 + 13.5;
      }
    });
    const c4 = whites.indexOf(60);
    if (c4 >= 0) s.appendChild(svg('circle', { cx: c4 * 20 + 10, cy: 54, r: 2.4, class: 'mid-dot' }));
    s._map = map;
    s._xOf = xOf;
    return s;
  };
  const paintKeys = (kbSvg) => {
    if (!kbSvg) return;
    const held = new Set(WS.input.notes());
    for (const [n, r] of Object.entries(kbSvg._map)) r.classList.toggle('down', held.has(Number(n)));
  };

  UI.startGame = (id, mode) => {
    unsubGame.forEach((f) => f());
    unsubGame = [];
    const game = WS.$('#game');
    const plan = L.planRound(id, mode);
    const d = plan.def;
    WS.input.qwertyWanted = true;
    WS.rig.active = false;
    WS.audio.ensure();
    game.hidden = false;
    document.body.classList.add('in-game');
    const hud = WS.$('#hud');
    hud.replaceChildren();
    hud.classList.remove('show-summary');

    const dots = h('ol', { class: 'hud-dots', 'aria-label': 'Round progress' }, plan.prompts.map(() => h('li', {})));
    const symBox = h('div', { class: 'hud-sym', 'aria-live': 'polite' });
    const subBox = h('p', { class: 'hud-sub' });
    const nextBox = h('p', { class: 'hud-next' });
    const countBox = h('div', { class: 'hud-count', 'aria-hidden': 'true' });
    const comboBox = h('p', { class: 'hud-combo' });
    gameKeys = miniKeyboard();
    const holding = h('p', { class: 'hud-hint', text: WS.input.qwertyActive() ? 'Computer keys: bottom row from Z is C3, top row from Q is C4. Press − or = to shift octaves.' : '' });

    hud.append(
      h('div', { class: 'hud-top' },
        h('button', { type: 'button', class: 'btn btn-ghost hud-quit', onclick: () => quit() }, 'Quit (Esc)'),
        h('div', { class: 'hud-level' },
          h('span', { class: 'hud-level-name', text: d.name }),
          plan.cold ? h('span', { class: 'badge badge-gold' }, UI.oneStar('gold', 13), ' Cold check') : null,
          plan.challenge ? h('span', { class: 'badge', text: '★2 attempt' }) : null),
        h('div', { class: 'hud-meta' }, h('span', { class: 'hud-tempo', text: `♩ = ${plan.tempo}` }), dots)),
      h('div', { class: 'hud-prompt' }, symBox, subBox, nextBox, comboBox),
      countBox,
      h('div', { class: 'hud-bottom' }, gameKeys, holding));
    UI.glyphify(hud);

    const sub = (p) => {
      if (!p) return '';
      if (p.kind === 'shell') return `${p.name} · shape ${p.shape}: ${p.hint} · key of ${p.keyName}`;
      return p.name;
    };
    const hudApi = {
      setPrompt(i, r) {
        const p = plan.prompts[i];
        symBox.replaceChildren(p ? UI.sym(p.sym, 'sym-xl') : h('span', { class: 'hud-done', text: '' }));
        subBox.textContent = sub(p);
        UI.glyphify(subBox);
        const nx = plan.prompts.slice(i + 1, i + 3).map((x) => x.sym);
        nextBox.replaceChildren(...(nx.length ? ['Then ', ...nx.flatMap((s, k) => [k ? ' · ' : '', UI.sym(s, 'sym-sm')])] : []));
      },
      setCount(n) {
        if (n === null) { countBox.textContent = ''; countBox.classList.remove('show'); return; }
        countBox.textContent = n === 0 ? 'Get ready' : String(n);
        countBox.classList.add('show');
      },
      setDot(i, res) {
        const li = dots.children[i];
        if (li) li.className = res.hit ? (res.perfect ? 'dot-perfect' : 'dot-hit') : 'dot-miss';
      },
      setCombo(c) { comboBox.textContent = c >= 3 ? `${c} in a row` : ''; },
    };

    unsubGame = [
      WS.bus.on('noteon', () => paintKeys(gameKeys)),
      WS.bus.on('noteoff', () => paintKeys(gameKeys)),
    ];

    const quit = () => {
      if (runner) runner.stopAll();
      closeGame();
    };
    gameKeys._quit = quit;

    // Mark the level as played today now, so a cold check can't be restarted after a bad start.
    L.state(id).lastPlayed = WS.todayKey();
    WS.store.save();

    runner = new WS.ChordRunner({
      plan,
      hud: hudApi,
      onDone: (res) => {
        const out = L.applyRound(plan, res);
        showSummary(plan, res, out);
      },
      onQuit: () => closeGame(),
    });
    runner.resize();
    runner.start();
    WS.ui._runner = runner;
  };

  const closeGame = () => {
    const game = WS.$('#game');
    game.hidden = true;
    document.body.classList.remove('in-game');
    unsubGame.forEach((f) => f());
    unsubGame = [];
    runner = null;
    WS.ui._runner = null;
    WS.input.qwertyWanted = UI.current === 'keyboard' || UI.current === 'play';
    UI.rerender();
  };

  const showSummary = (plan, res, out) => {
    const d = plan.def;
    const ls = L.state(plan.id);
    const hud = WS.$('#hud');
    const passed = out.passed;
    const timing = res.meanOffsetMs == null ? '' : Math.abs(res.meanOffsetMs) < 25 ? 'Timing: right on the beat.' : res.meanOffsetMs < 0 ? `Timing: about ${Math.abs(res.meanOffsetMs)} ms early on average.` : `Timing: about ${res.meanOffsetMs} ms late on average.`;
    const earnedRows = out.earned.map((e) => h('li', { class: `earned earned-${e.kind}` }, UI.oneStar(e.kind, 22),
      ` ${e.kind === 'gold' ? 'Gold' : 'Silver'} star ${e.i + 1}: ${L.starCriteria(d)[e.i]}`));
    const misses = res.misses.length
      ? h('ul', { class: 'misses' }, res.misses.map((m) => h('li', {}, UI.sym(m.sym, 'sym-sm'), h('span', { text: ` ${m.reason}` }))))
      : null;
    let coldLine = null;
    if (plan.cold) {
      coldLine = out.coldResult === 'gold'
        ? h('p', { class: 'cold-line cold-win', text: 'Cold check passed. That one stuck.' })
        : h('p', { class: 'cold-line', text: 'Cold check missed. Practise it now; your next gold chance is tomorrow’s first round.' });
    }
    const nextIdx = (() => {
      const lane = L.LANES.find((x) => x.id === d.lane);
      const i = lane.levels.indexOf(plan.id);
      const nid = lane.levels[i + 1];
      return nid && L.isUnlocked(nid) && out.earned.some((e) => e.i === 0 && e.kind === 'silver') ? nid : null;
    })();

    const again = btn('Play again (Enter)', () => { panel.remove(); document.removeEventListener('keydown', onKey); UI.startGame(plan.id, 'normal'); }, 'btn btn-primary');
    const panel = h('section', { class: 'summary', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'sum-title' },
      h('p', { class: 'sheet-kicker', text: d.name }),
      h('h2', { id: 'sum-title', class: `sum-title ${passed ? 'sum-pass' : ''}`, text: passed ? (out.flawless ? 'Flawless' : 'Passed') : 'Not yet' }),
      h('p', { class: 'sum-line' }, h('strong', { text: `${res.hits} of ${res.n}` }), ` chords landed (11 passes), ${res.perfects} perfect, at ♩ = ${plan.tempo}. ${timing}`),
      coldLine,
      earnedRows.length ? h('ul', { class: 'earned-list' }, earnedRows) : null,
      h('div', { class: 'sum-stars' }, UI.stars(ls, 26)),
      out.notes.length ? h('p', { class: 'muted', text: out.notes.join(' ') }) : null,
      misses ? h('h3', { class: 'sum-h', text: 'What to fix' }) : null,
      misses,
      h('p', { class: 'sum-xp', text: `+${out.xp} XP` }),
      h('div', { class: 'sheet-actions' },
        again,
        nextIdx ? btn(`Next level: ${L.def(nextIdx).name}`, () => { panel.remove(); document.removeEventListener('keydown', onKey); UI.startGame(nextIdx, 'normal'); }, 'btn btn-ghost') : null,
        btn('Back to the path', () => { panel.remove(); document.removeEventListener('keydown', onKey); location.hash = '#path'; closeGame(); }, 'btn btn-ghost')));
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); again.click(); }
      else if (e.key === 'Escape') { panel.remove(); document.removeEventListener('keydown', onKey); closeGame(); }
    };
    hud.append(panel);
    hud.classList.add('show-summary');
    UI.glyphify(panel);
    document.addEventListener('keydown', onKey);
    if (out.earned.length) WS.audio.sfx(out.earned.some((e) => e.kind === 'gold') ? 'gold' : 'silver');
    again.focus();
  };

  // Esc quits a running round
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && runner && runner.running) { e.preventDefault(); runner.stopAll(); closeGame(); }
  });
  // Switching away mid-round would desync the clock and the drawing, so stop the round cleanly
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && runner && runner.running) {
      runner.stopAll();
      closeGame();
      WS.toast('Round stopped when you switched away. Nothing was saved from it.');
    }
  });


  /* ---------------- Play: free play with any sound, a split, or a layer ---------------- */
  /* A segmented control (radio buttons styled as one row of pills). */
  const segmented = (name, label, options, value, onchange) => {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    for (const [v, text] of options) {
      const id = `${name}-${v}`;
      wrap.append(
        h('input', { type: 'radio', name, id, value: v, checked: v === value, class: 'visually-hidden', onchange: () => onchange(v) }),
        h('label', { for: id, class: 'seg-opt', text }));
    }
    return wrap;
  };
  /* An instrument dropdown grouped by family. */
  const soundSelect = (id, value, onchange) => {
    const S = WS.sounds;
    const fams = [...new Set(S.INSTRUMENTS.map((d) => d.family))];
    return h('select', { id, onchange: (e) => onchange(e.target.value) },
      fams.map((f) => h('optgroup', { label: f },
        S.INSTRUMENTS.filter((d) => d.family === f).map((d) => h('option', { value: d.id, selected: d.id === value, text: d.name })))));
  };

  VIEWS.play = (root) => {
    const s = WS.S();
    const st = s.settings;
    const I = WS.input;
    const R = WS.rig;
    const S = WS.sounds;
    const today = WS.todayKey();
    if (!s.play) s.play = {};
    const log = () => (s.play[today] = s.play[today] || { sec: 0, notes: 0 });
    const save = () => WS.store.save();

    root.append(h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        h('h1', { class: 'page-title', text: 'Play' }),
        h('p', { class: 'page-sub', text: 'Just play: no lesson and no score. Pick a sound, or split and layer two of them.' }))));

    // Sound status
    const meter = h('div', { class: 'load-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('i', {}));
    const soundLine = h('p', { class: 'sound-line' });
    const startBtn = btn('Load the sound', () => { WS.audio.ensure(); R.configure(); paintStatus(); }, 'btn btn-primary');
    const names = (es) => es.map((e) => e.def.name).join(' and ');
    const setupText = () => {
      if (st.soundMode === 'split') return `Split at ${T.noteName(st.splitPoint)}: ${S.def(st.splitLo).name} on the left, ${S.def(st.splitHi).name} on the right.`;
      if (st.soundMode === 'layer') return `Layered: ${S.def(st.layerA).name} with ${S.def(st.layerB).name}.`;
      const d = S.def(st.sound);
      return d.id === 'salamander' ? 'Salamander Grand ready: three velocity layers blended by how hard you play.' : `${d.name} ready.`;
    };
    const paintStatus = () => {
      const r = R.status();
      const idle = r.engines.every((e) => e.status === 'idle');
      meter.querySelector('i').style.width = `${r.complete ? 100 : r.pct}%`;
      meter.setAttribute('aria-valuenow', String(r.pct));
      meter.hidden = idle || r.complete;
      startBtn.hidden = !idle;
      let text;
      if (r.error && !r.anyReady) text = `${names(r.engines.filter((e) => e.status === 'error'))} didn’t load. Check your connection; notes use the simple synth for now.`;
      else if (idle) text = 'The sound loads the first time you play. Press a key or the button.';
      else if (!r.ready) text = `Loading ${names(r.loading)}… ${r.pct}%`;
      else if (!r.complete) text = `Ready to play. Adding the soft and loud layers… ${r.pct}%`;
      else text = setupText();
      soundLine.textContent = text;
      soundLine.className = `sound-line${r.ready ? ' ok' : ''}`;
    };

    // Big keyboard, with the split shown on it
    const kb = miniKeyboard(21, 108);
    kb.classList.add('full-kb', 'play-kb');
    const splitMark = svg('line', { class: 'split-mark', y1: -2, y2: 66 });
    kb.appendChild(splitMark);
    const paintSplit = () => {
      const on = st.soundMode === 'split';
      splitMark.style.display = on ? '' : 'none';
      const x = kb._xOf[st.splitPoint] != null ? kb._xOf[st.splitPoint] : 0;
      splitMark.setAttribute('x1', x); splitMark.setAttribute('x2', x);
      for (const [n, r] of Object.entries(kb._map)) r.classList.toggle('zone-left', on && Number(n) < st.splitPoint);
    };
    const chord = h('div', { class: 'play-chord', 'aria-live': 'polite' });
    const pedal = h('span', { class: 'pill-stat', text: 'Pedal up' });
    const velOut = h('span', { class: 'pill-stat' }, 'Velocity ', h('strong', { text: '–' }));
    const voicesOut = h('span', { class: 'pill-stat' }, 'Voices ', h('strong', { text: '0' }));
    const todayOut = h('p', { class: 'muted small play-today' });
    const vels = new Map();

    const paintKb = () => {
      const held = new Set(I.notes());
      const sus = new Set(R.sustainedNotes());
      for (const [n, r] of Object.entries(kb._map)) {
        const k = Number(n);
        const on = held.has(k);
        r.classList.toggle('down', on);
        r.classList.toggle('sus', !on && sus.has(k));
        r.style.opacity = on ? String(0.55 + 0.45 * ((vels.get(k) || 90) / 127)) : '';
      }
      const id = T.identify(I.notes());
      chord.replaceChildren(id ? (id.isChord ? UI.sym(id.label, 'sym-xl') : h('span', { class: 'play-note', text: id.label })) : h('span', { class: 'play-idle', text: 'Play anything' }),
        h('span', { class: 'play-chord-detail', text: id ? id.detail : '' }));
      UI.glyphify(chord);
      voicesOut.querySelector('strong').textContent = String(R.voiceCount());
    };
    const paintToday = () => {
      const d = s.play[today];
      const min = d ? Math.floor(d.sec / 60) : 0;
      todayOut.textContent = d && d.notes ? `Free play today: ${min < 1 ? 'under a minute' : `${min} min`}, ${WS.fmtInt(d.notes)} notes.` : 'Free play time is logged here, separate from the drills.';
    };

    let lastNote = 0;
    let susTimer = null;
    const unsubs = [
      WS.bus.on('noteon', (e) => {
        vels.set(e.n, e.vel);
        velOut.querySelector('strong').textContent = String(e.vel);
        const now = performance.now();
        const d = log();
        if (lastNote && now - lastNote < 20000) d.sec += (now - lastNote) / 1000;
        d.notes++;
        lastNote = now;
        save();
        paintKb();
        paintToday();
        paintStatus();
      }),
      WS.bus.on('noteoff', () => paintKb()),
      WS.bus.on('pedal', (e) => {
        pedal.textContent = e.down ? 'Pedal down' : 'Pedal up';
        pedal.classList.toggle('on', e.down);
        paintKb();
        clearTimeout(susTimer);
        if (!e.down) susTimer = setTimeout(paintKb, 400);
      }),
      WS.bus.on('sound', () => { paintStatus(); paintLatency(); }),
      WS.bus.on('inputstatus', () => paintInput()),
    ];
    const obs = new MutationObserver(() => { if (!document.body.contains(kb)) { unsubs.forEach((f) => f()); obs.disconnect(); clearTimeout(susTimer); I.captureNext = null; } });
    obs.observe(WS.$('#view'), { childList: true });
    UI._leavePlay = () => {
      if (I.pedal && I.status !== 'connected') I.setPedal(false, performance.now());
      R.allOff();
    };

    const inputLine = h('p', { class: 'muted small' });
    const paintInput = () => {
      inputLine.textContent = I.status === 'connected'
        ? `Listening to ${I.devices.map((d) => d.name).join(', ')}. Turn your keyboard’s own volume all the way down so you only hear Woodshed.`
        : I.qwertyActive()
          ? 'No keyboard connected, so your computer keys play: Z row from C3, Q row from C4, − and = shift octaves, space bar is the sustain pedal.'
          : 'Connect your keyboard on the Keyboard screen.';
    };

    root.append(h('section', { class: 'play-stage' },
      h('div', { class: 'play-top' }, chord,
        h('div', { class: 'play-stats' }, pedal, velOut, voicesOut)),
      h('div', { class: 'kb-wrap' }, kb),
      inputLine,
      h('div', { class: 'play-sound' }, soundLine, meter, startBtn),
      todayOut));

    /* ---- Sound: mode, then the instruments for that mode ---- */
    const modeBody = h('div', { class: 'mode-body' });
    const changed = () => { save(); R.configure(); paintSplit(); paintStatus(); };
    const paintMode = () => {
      modeBody.replaceChildren();
      if (st.soundMode === 'single') {
        const fams = [...new Set(S.INSTRUMENTS.map((d) => d.family))];
        for (const f of fams) {
          modeBody.append(h('h3', { class: 'fam-h', text: f }),
            h('div', { class: 'inst-grid' }, S.INSTRUMENTS.filter((d) => d.family === f).map((d) =>
              h('button', {
                type: 'button', class: `inst${st.sound === d.id ? ' on' : ''}`, 'aria-pressed': st.sound === d.id ? 'true' : 'false', dataset: { id: d.id },
                onclick: () => { st.sound = d.id; changed(); paintMode(); },
              }, h('span', { class: 'inst-name', text: d.name }), h('span', { class: 'inst-blurb', text: d.blurb })))));
        }
      } else if (st.soundMode === 'split') {
        const pointOut = h('strong', { text: T.noteName(st.splitPoint) });
        const setBtn = btn('Set split point', () => {
          setBtn.textContent = 'Press the lowest key for your right hand…';
          setBtn.disabled = true;
          I.captureNext = (n) => {
            st.splitPoint = WS.clamp(n, 24, 104);
            setBtn.textContent = 'Set split point';
            setBtn.disabled = false;
            pointOut.textContent = T.noteName(st.splitPoint);
            changed();
            WS.toast(`Split set: ${T.noteName(st.splitPoint)} and up is the right hand.`);
          };
        }, 'btn btn-ghost');
        modeBody.append(
          h('div', { class: 'form-grid' },
            h('label', { for: 'split-lo', text: 'Left hand' }), soundSelect('split-lo', st.splitLo, (v) => { st.splitLo = v; changed(); }),
            h('label', { for: 'split-hi', text: 'Right hand' }), soundSelect('split-hi', st.splitHi, (v) => { st.splitHi = v; changed(); })),
          h('div', { class: 'row' },
            h('p', {}, 'Right hand starts at ', pointOut),
            setBtn,
            btn('Middle C', () => { st.splitPoint = 60; pointOut.textContent = T.noteName(60); changed(); }, 'btn btn-ghost')),
          h('p', { class: 'muted small', text: 'Try Bass on the left and a piano or the Rhodes on the right: left-hand bass lines under right-hand chords. The sustain pedal holds the right side only when the left is the bass.' }));
      } else {
        const mix = h('input', { type: 'range', id: 'layer-mix', min: '0', max: '1', step: '0.05', value: String(st.layerMix), oninput: (e) => { st.layerMix = Number(e.target.value); save(); R.configure(); } });
        modeBody.append(
          h('div', { class: 'form-grid' },
            h('label', { for: 'layer-a', text: 'Sound A' }), soundSelect('layer-a', st.layerA, (v) => { st.layerA = v; changed(); }),
            h('label', { for: 'layer-b', text: 'Sound B' }), soundSelect('layer-b', st.layerB, (v) => { st.layerB = v; changed(); }),
            h('label', { for: 'layer-mix', text: 'Mix' }), h('div', { class: 'mix-row' }, h('span', { class: 'small muted', text: 'A' }), mix, h('span', { class: 'small muted', text: 'B' }))),
          h('p', { class: 'muted small', text: 'Every key plays both sounds. Grand piano with Synth Pad underneath is a good place to start, with the mix about a third of the way toward B.' }));
      }
      UI.glyphify(modeBody);
    };
    const modes = segmented('sound-mode', 'Sound mode', [['single', 'One sound'], ['split', 'Split'], ['layer', 'Layer']], st.soundMode, (v) => {
      st.soundMode = v; changed(); paintMode();
    });

    const vol = h('input', { type: 'range', id: 'piano-vol', min: '0', max: '1.2', step: '0.05', value: String(st.pianoVol), oninput: (e) => { st.pianoVol = Number(e.target.value); WS.out.apply(); save(); } });
    const amount = h('input', { type: 'range', id: 'piano-room', min: '0', max: '1', step: '0.05', value: String(st.pianoRoom), disabled: st.reverb === 'dry', oninput: (e) => { st.pianoRoom = Number(e.target.value); WS.out.apply(); save(); } });
    const rooms = segmented('reverb', 'Room', [['dry', 'Dry'], ['room', 'Room'], ['hall', 'Hall']], st.reverb, (v) => {
      st.reverb = v; amount.disabled = v === 'dry'; WS.out.apply(); save();
    });
    const touch = h('select', { id: 'piano-touch', onchange: (e) => { st.pianoTouch = e.target.value; save(); } },
      [['light', 'Light: soft playing comes out louder'], ['normal', 'Normal'], ['heavy', 'Heavy: you have to dig in for loud notes']].map(([v, t]) => h('option', { value: v, selected: st.pianoTouch === v, text: t })));
    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'Sound' }),
      modes,
      modeBody,
      h('div', { class: 'form-grid' },
        h('span', { class: 'label', text: 'Room' }), rooms,
        h('label', { for: 'piano-room', text: 'Reverb amount' }), amount,
        h('label', { for: 'piano-vol', text: 'Volume' }), vol,
        h('label', { for: 'piano-touch', text: 'Touch' }), touch),
      h('p', { class: 'muted small', text: 'Dry is the instrument with no space around it. Room is a small studio; Hall is a concert hall, best for slow, pedalled music. Touch sets how key velocity maps to loudness.' })));
    paintMode();

    // Latency
    const latOut = h('div', { class: 'lat-out' });
    const paintLatency = () => {
      const L = WS.audioLatency();
      if (!L) { latOut.replaceChildren(h('p', { class: 'muted', text: 'Play a note and the numbers show up here.' })); return; }
      const total = Math.round(L.total);
      const bt = L.out > 40;
      latOut.replaceChildren(
        h('p', { class: 'lat-big' }, h('strong', { text: `${total} ms` }), h('span', { class: 'muted', text: ' from key to speaker, as Chrome reports it' })),
        h('p', { class: 'muted small', text: `Audio buffer ${L.base.toFixed(1)} ms · output device ${L.out.toFixed(1)} ms · ${Math.round(L.rate / 100) / 10} kHz. USB MIDI adds about 1–3 ms on top.` }),
        bt ? h('p', { class: 'warn-line', text: 'That output delay looks like Bluetooth (AirPods and similar). The app can’t remove it. Wired headphones or the Mac speakers will feel instant.' })
          : h('p', { class: 'ok-line', text: total <= 12 ? 'That’s under the 10–12 ms most players can feel. Nice.' : 'Playable. Wired headphones or the Mac speakers are as fast as it gets.' }));
    };
    const latSel = h('select', { id: 'audio-lat', onchange: (e) => { st.audioLatency = e.target.value; save(); WS.toast('Saved. Reload Woodshed for the new buffer size to take effect.', 4000); } },
      [['lowest', 'Lowest: smallest buffer (default)'], ['safe', 'Safer: a bit more buffer, if you hear crackles']].map(([v, t]) => h('option', { value: v, selected: st.audioLatency === v, text: t })));
    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'Latency' }),
      latOut,
      h('div', { class: 'form-grid' }, h('label', { for: 'audio-lat', text: 'Audio buffer' }), latSel)));

    root.append(h('details', { class: 'credits muted small' },
      h('summary', { text: 'Where the sounds come from' }),
      h('ul', {}, S.INSTRUMENTS.map((d) => h('li', {}, h('strong', { text: `${d.name}: ` }), d.credit)))));

    // Start loading straight away if audio is already allowed; otherwise the first key or the button does it.
    if (WS.audio.ctx) R.configure();
    paintSplit(); paintStatus(); paintKb(); paintToday(); paintInput(); paintLatency();
  };

  /* ---------------- Progress ---------------- */
  VIEWS.progress = (root) => {
    const s = WS.S();
    const today = WS.todayKey();
    const golds = L.LEVELS.reduce((n, d) => n + L.goldCount(L.state(d.id)), 0);
    const silvers = L.LEVELS.reduce((n, d) => n + L.silverCount(L.state(d.id)), 0);
    root.append(h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        h('h1', { class: 'page-title', text: 'Progress' }),
        h('p', { class: 'page-sub', text: 'What you’ve done, and where the weak spots are.' }))));

    root.append(h('dl', { class: 'statline' },
      h('div', {}, h('dt', { text: 'Core days' }), h('dd', { text: String(P.coreDaysTotal()) })),
      h('div', {}, h('dt', { text: 'Rounds played' }), h('dd', { text: String(s.rounds.length) })),
      h('div', {}, h('dt', { text: 'Stars' }), h('dd', {}, `${golds}`, h('span', { class: 'dd-unit', text: ' gold, ' }), `${silvers - golds}`, h('span', { class: 'dd-unit', text: ' silver' }))),
      h('div', {}, h('dt', { text: 'XP' }), h('dd', { text: WS.fmtInt(s.xp) }))));

    // Calendar: last 12 weeks
    const startMon = WS.addDays(WS.mondayOf(today), -77);
    const cal = h('div', { class: 'cal', role: 'img', 'aria-label': 'Core days over the last 12 weeks' });
    for (let w = 0; w < 12; w++) {
      const col = h('div', { class: 'cal-col' });
      for (let i = 0; i < 7; i++) {
        const k = WS.addDays(startMon, w * 7 + i);
        const d = s.days[k];
        let cls = 'cal-cell';
        if (k > today) cls += ' cal-future';
        else if (d && d.core) cls += ' cal-core';
        else if (d && d.freeze) cls += ' cal-freeze';
        else if (d && d.rounds) cls += ' cal-some';
        col.append(h('span', { class: cls, title: `${WS.fmtDay(k)}${d && d.core ? ': core done' : d && d.freeze ? ': freeze' : d && d.rounds ? `: ${d.rounds} rounds` : ''}` }));
      }
      cal.append(col);
    }
    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'Last 12 weeks' }), cal,
      h('p', { class: 'legend-row' },
        h('span', { class: 'cal-cell cal-core' }), ' core done ',
        h('span', { class: 'cal-cell cal-some' }), ' drills only ',
        h('span', { class: 'cal-cell cal-freeze' }), ' freeze used')));

    // Weak spots
    const items = s.items;
    const byQ = {};
    const byKey = {};
    const list = [];
    for (const [key, it] of Object.entries(items)) {
      if (!it.recent.length) continue;
      const acc = it.recent.reduce((a, b) => a + b, 0) / it.recent.length;
      const [q, pcStr] = key.split(':');
      const pc = Number(pcStr);
      if (T.Q[q]) {
        (byQ[q] = byQ[q] || []).push(...it.recent);
        (byKey[pc] = byKey[pc] || []).push(...it.recent);
        list.push({ sym: T.chord(pc, q).sym, acc, n: it.n });
      } else {
        const m = /^sh([AB])-(ii|V|I):$/.exec(`${q}:`);
        if (m) {
          const sh = T.shell(pc, m[2], m[1]);
          list.push({ sym: sh.sym, acc, n: it.n, extra: `shape ${m[1]}` });
        }
      }
    }
    const bar = (label, vals) => {
      const acc = vals.reduce((a, b) => a + b, 0) / vals.length;
      return h('li', { class: 'bar-row' },
        h('span', { class: 'bar-label', text: label }),
        h('span', { class: 'bar-track' }, h('i', { class: acc < 0.75 ? 'weak' : '', style: { width: `${Math.round(acc * 100)}%` } })),
        h('span', { class: 'bar-val', text: `${Math.round(acc * 100)}%` }));
    };
    const qRows = Object.entries(byQ).map(([q, v]) => bar(T.Q[q].name, v));
    const kRows = T.KEY_ORDER.filter((pc) => byKey[pc]).map((pc) => bar(T.MAJ_FAM_ROOT[pc], byKey[pc]));
    const worst = list.filter((x) => x.n >= 2 && x.acc < 1).sort((a, b) => a.acc - b.acc).slice(0, 8);
    root.append(h('div', { class: 'two-col' },
      h('section', { class: 'panel' }, h('h2', { text: 'By chord quality' }),
        qRows.length ? h('ul', { class: 'bars' }, qRows) : h('p', { class: 'muted', text: 'Play a few rounds of Chord Runner to see this.' })),
      h('section', { class: 'panel' }, h('h2', { text: 'By root' }),
        kRows.length ? h('ul', { class: 'bars' }, kRows) : h('p', { class: 'muted', text: 'Play a few rounds of Chord Runner to see this.' }))));
    root.append(h('section', { class: 'panel' }, h('h2', { text: 'Most-missed chords' }),
      worst.length ? h('ul', { class: 'worst' }, worst.map((w) => h('li', {}, UI.sym(w.sym, 'sym-md'), h('span', { class: 'muted', text: `${w.extra ? `${w.extra} · ` : ''}${Math.round(w.acc * 100)}% of the last ${Math.min(12, w.n)}` })))) : h('p', { class: 'muted', text: 'No misses worth flagging yet. Chords you miss show up here once you’ve seen them at least twice.' })));

    const recent = s.rounds.slice(-12).reverse();
    root.append(h('section', { class: 'panel' }, h('h2', { text: 'Recent rounds' }),
      recent.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'rounds' },
        h('thead', {}, h('tr', {}, ['Day', 'Level', 'Tempo', 'Landed', 'Result', 'XP'].map((t) => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, recent.map((r) => h('tr', {},
          h('td', { text: WS.fmtDay(r.day) }),
          h('td', { text: (L.def(r.level) || { name: r.level }).name }),
          h('td', { text: `♩ = ${r.tempo}` }),
          h('td', { text: `${r.hits}/${r.n}` }),
          h('td', { text: `${r.passed ? 'Passed' : 'Not yet'}${r.cold ? ' · cold check' : ''}${r.challenge ? ' · ★2 try' : ''}` }),
          h('td', { text: `+${r.xp}` }))))))
        : h('p', { class: 'muted', text: 'No rounds yet.' })));
  };

  /* ---------------- Keyboard ---------------- */
  VIEWS.keyboard = (root) => {
    const s = WS.S().settings;
    const I = WS.input;
    WS.input.qwertyWanted = true;
    const statusText = () => ({
      idle: 'Not connected yet.',
      unsupported: 'This browser can’t read MIDI. Use Chrome on your Mac.',
      denied: 'Chrome blocked MIDI access. Click the icon at the left of the address bar, allow MIDI devices, then reload.',
      'denied-file': 'Chrome didn’t allow MIDI for a page opened from a file. Open Woodshed from its web address instead, and use your computer keys until then.',
      'no-device': 'MIDI is allowed, but no keyboard is plugged in. Check the cable and that the keyboard is on.',
      connected: `Connected: ${I.devices.map((d) => d.name).join(', ')}`,
      error: 'Something went wrong connecting. Unplug the keyboard, plug it back in, and try again.',
    })[I.status];

    const status = h('p', { class: `kbd-status kbd-${I.status}`, text: statusText() });
    const connect = btn(I.status === 'connected' ? 'Reconnect' : 'Connect keyboard', async () => { await I.connectMidi(); UI.rerender(); }, 'btn btn-primary');

    const modeSel = h('select', { id: 'input-mode', onchange: (e) => { s.inputMode = e.target.value; WS.store.save(); UI.rerender(); } },
      [['auto', 'Keyboard when connected, otherwise computer keys'], ['midi', 'Keyboard only'], ['qwerty', 'Computer keys only']].map(([v, t]) => h('option', { value: v, selected: s.inputMode === v, text: t })));
    const synthSel = h('select', { id: 'synth-mode', onchange: (e) => { s.synth = e.target.value; WS.store.save(); } },
      [['auto', 'Computer keys only'], ['on', 'Always, also for the keyboard'], ['off', 'Never']].map(([v, t]) => h('option', { value: v, selected: s.synth === v, text: t })));

    // Live keyboard
    const kb = miniKeyboard(21, 108);
    kb.classList.add('full-kb');
    const ident = h('p', { class: 'ident' });
    const pedal = h('span', { class: 'pedal', text: 'Sustain pedal up' });
    const vel = h('span', { class: 'vel' }, 'Velocity ', h('span', { class: 'vel-track' }, h('i', {})));
    const update = () => {
      paintKeys(kb);
      const id = T.identify(I.notes());
      const label = id ? (id.isChord ? UI.sym(id.label, 'sym-lg') : h('span', { class: 'ident-plain', text: id.label })) : null;
      ident.replaceChildren(...(id ? [label, h('span', { class: 'muted', text: ` ${id.detail}` })] : [h('span', { class: 'muted', text: 'Play a chord and its name shows up here.' })]));
      UI.glyphify(ident);
      vel.querySelector('i').style.width = `${Math.round((I.lastVel / 127) * 100)}%`;
    };
    const unsubs = [
      WS.bus.on('noteon', update), WS.bus.on('noteoff', update),
      WS.bus.on('pedal', (e) => { pedal.textContent = e.down ? 'Sustain pedal down' : 'Sustain pedal up'; pedal.classList.toggle('on', e.down); }),
      WS.bus.on('inputstatus', () => { if (UI.current === 'keyboard') UI.rerender(); }),
      WS.bus.on('octave', () => { octaveLine.textContent = octaveText(); }),
    ];
    const octaveText = () => `Computer keys start at ${T.noteName(I.qwertyBase())} on the bottom row and ${T.noteName(I.qwertyBase() + 12)} on the top row.`;
    const octaveLine = h('p', { class: 'muted', text: octaveText() });
    // Clean up listeners when the view changes
    const obs = new MutationObserver(() => { if (!document.body.contains(kb)) { unsubs.forEach((f) => f()); obs.disconnect(); } });
    obs.observe(WS.$('#view'), { childList: true });

    root.append(h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        h('h1', { class: 'page-title', text: 'Keyboard' }),
        h('p', { class: 'page-sub', text: 'Connect your keyboard, check every key registers, then calibrate timing once.' }))));

    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'Connection' }),
      status,
      h('div', { class: 'row' }, connect),
      h('p', { class: 'muted', text: 'Chrome will ask to let this page use MIDI devices. Allow it. If nothing shows up, plug the cable into the keyboard’s USB port (the square one) and the Mac, then press Reconnect.' }),
      h('div', { class: 'form-grid' },
        h('label', { for: 'input-mode', text: 'Play with' }), modeSel,
        h('label', { for: 'synth-mode', text: 'Piano sound in drills' }), synthSel),
      h('p', { class: 'muted small', text: 'The Play screen always uses the sound you picked there. Drills and lessons use the Salamander Grand, and this setting decides when.' })));

    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'Test every key' }),
      h('p', { class: 'muted', text: 'Play from the bottom of the keyboard to the top. Each key should light up. Try the pedal too.' }),
      h('div', { class: 'kb-wrap' }, kb),
      h('div', { class: 'kb-meta' }, ident, h('p', { class: 'kb-row' }, pedal, vel)),
      octaveLine,
      h('details', { class: 'qwerty-help' },
        h('summary', { text: 'Computer key layout' }),
        h('p', { text: 'Bottom row Z X C V B N M , . / are the white keys from C; S D G H J L ; are the black keys between them. Top row Q W E R T Y U I O P are the white keys an octave up; 2 3 5 6 7 9 0 are the black keys. Press − and = to move down or up an octave. Most laptop keyboards can only hold a few keys at once, so some chords may drop a note.' }))));

    // Calibration
    const calOut = h('p', { class: 'cal-out', 'aria-live': 'polite', text: s.calibratedAt ? `Saved offset: ${s.calibrationMs > 0 ? '+' : ''}${s.calibrationMs} ms (measured ${WS.fmtDay(s.calibratedAt)}).` : 'Not calibrated yet. Until you do, timing is judged with no offset.' });
    const calDots = h('ol', { class: 'cal-dots' });
    const calBtn = btn('Start the tap test', () => runCalibration(calOut, calDots, calBtn), 'btn btn-primary');
    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'Timing calibration' }),
      h('p', { text: 'Sixteen clicks at ♩ = 90 after a four-click count-in. Tap any key exactly on each click. Woodshed measures how far your taps land from the clicks and corrects for it, so “perfect” means perfect on your setup. Use wired headphones or speakers; Bluetooth adds a lot of delay.' }),
      h('div', { class: 'row' }, calBtn, btn('Clear', () => { s.calibrationMs = 0; s.calibratedAt = null; WS.store.save(); UI.rerender(); }, 'btn btn-ghost')),
      calDots, calOut));

    update();
  };

  const runCalibration = (out, dotsEl, button) => {
    const A = WS.audio;
    const c = A.ensure();
    if (!c) { out.textContent = 'Audio isn’t available in this browser.'; return; }
    WS.input.qwertyWanted = true;
    button.disabled = true;
    const spb = 60 / 90;
    const t0 = c.currentTime + 0.5;
    const clicks = Array.from({ length: 16 }, (_, i) => t0 + (4 + i) * spb);
    const metro = new A.Metronome();
    metro.start({ t0, spb, beatsPerBar: 4, pattern: 'all', countInBars: 1, endTime: clicks[15] + 0.01 });
    dotsEl.replaceChildren(...clicks.map(() => h('li', {})));
    const offs = new Array(16).fill(null);
    const un = WS.bus.on('noteon', (e) => {
      const t = A.perfToHeard(e.t);
      let best = -1; let bd = 1e9;
      clicks.forEach((ct, i) => { const dd = Math.abs(t - ct); if (dd < bd) { bd = dd; best = i; } });
      if (best >= 0 && bd < spb / 2 && offs[best] == null) {
        offs[best] = (t - clicks[best]) * 1000;
        const li = dotsEl.children[best];
        if (li) { li.className = 'on'; li.title = `${Math.round(offs[best])} ms`; }
      }
    });
    out.textContent = 'Listen for the count-in, then tap on every click.';
    setTimeout(() => {
      metro.stop(); un(); button.disabled = false;
      const got = offs.filter((x) => x != null).sort((a, b) => a - b);
      if (got.length < 10) { out.textContent = `Only ${got.length} of 16 taps registered. Try again, tapping on every click.`; return; }
      const med = got[Math.floor(got.length / 2)];
      const iqr = got[Math.floor(got.length * 0.75)] - got[Math.floor(got.length * 0.25)];
      if (iqr > 90) { out.textContent = `Your taps spread over ${Math.round(iqr)} ms, too wide to trust. Try again, a little more relaxed.`; return; }
      const s = WS.S().settings;
      s.calibrationMs = Math.round(med);
      s.calibratedAt = WS.todayKey();
      WS.store.save();
      out.textContent = `Saved. Your taps land ${Math.abs(Math.round(med))} ms ${med >= 0 ? 'after' : 'before'} the click on average, with a spread of ${Math.round(iqr)} ms. Timing is now judged with that offset.`;
    }, (clicks[15] - c.currentTime + 0.8) * 1000);
  };

  /* ---------------- Settings ---------------- */
  VIEWS.settings = (root) => {
    const s = WS.S();
    const st = s.settings;
    root.append(h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' },
        h('h1', { class: 'page-title', text: 'Settings' }),
        h('p', { class: 'page-sub', text: 'Your plan, sound, and your data.' }))));

    const start = h('input', { type: 'date', id: 'plan-start', value: st.planStart, onchange: (e) => { if (e.target.value) { st.planStart = WS.mondayOf(e.target.value); WS.store.save(); UI.rerender(); } } });
    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'Plan' }),
      h('div', { class: 'form-grid' }, h('label', { for: 'plan-start', text: 'Week 1 started on' }), start),
      h('p', { class: 'muted', text: `You’re in week ${P.weekNumber()} of the Piano Roadmap. Weeks start on Monday; any date you pick snaps to its Monday.` })));

    const vol = h('input', { type: 'range', id: 'metro-vol', min: '0', max: '1', step: '0.05', value: String(st.metroVol), oninput: (e) => { st.metroVol = Number(e.target.value); WS.audio.applySettings(); WS.store.save(); } });
    const sfx = h('input', { type: 'checkbox', id: 'sfx', checked: st.sfx, onchange: (e) => { st.sfx = e.target.checked; WS.audio.applySettings(); WS.store.save(); } });
    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'Sound' }),
      h('div', { class: 'form-grid' },
        h('label', { for: 'metro-vol', text: 'Metronome volume' }), vol,
        h('label', { for: 'sfx', text: 'Hit and miss sounds' }), sfx),
      h('p', { class: 'muted small', text: 'Instruments, split, layer and room are on the Play screen.' })));

    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', id: 'import-file', class: 'visually-hidden', onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { await WS.store.importJson(await f.text()); WS.toast('Backup restored.'); UI.rerender(); }
      catch (err) { WS.toast(err.message); }
    } });
    const confirmBox = h('div', { class: 'confirm', hidden: true },
      h('p', { text: 'This deletes every star, streak and round saved in this browser. Export a backup first if you might want it back.' }),
      h('div', { class: 'row' },
        btn('Delete everything', async () => { await WS.store.reset(); WS.toast('Everything was reset.'); location.hash = '#tonight'; UI.go('tonight'); }, 'btn btn-danger'),
        btn('Keep my progress', () => { confirmBox.hidden = true; }, 'btn btn-ghost')));
    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'Your data' }),
      h('p', { text: `Progress lives in this browser on this Mac (${WS.store.backend === 'indexeddb' ? 'IndexedDB' : WS.store.backend}${WS.store.persisted ? ', protected from automatic clean-up' : ''}). Clearing browsing data deletes it, and opening Woodshed from a different address starts fresh. Export a backup every week or so; you can also send the file to Claude for a progress review.` }),
      h('div', { class: 'row' },
        btn('Export a backup', () => UI.exportBackup(), 'btn btn-primary'),
        h('label', { for: 'import-file', class: 'btn btn-ghost', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } } }, 'Restore a backup'),
        fileIn,
        btn('Reset everything…', () => { confirmBox.hidden = false; }, 'btn btn-ghost')),
      confirmBox));

    root.append(h('section', { class: 'panel' },
      h('h2', { text: 'How stars work' }),
      h('p', {}, UI.oneStar('silver', 16), ' Silver: you met the goal once. It opens the next level.'),
      h('p', {}, UI.oneStar('gold', 16), ' Gold: you met it on your first round of the day on a later day, with no warm-up on that level. That shows the skill stuck, not just that you got warm.'),
      h('p', { class: 'muted', text: `Woodshed ${WS.VERSION}. Sound credits are at the bottom of the Play screen.` })));
  };

  UI.exportBackup = () => {
    const blob = new Blob([WS.store.exportJson()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `woodshed-backup-${WS.todayKey()}.json` });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    WS.toast('Backup saved to your Downloads folder.');
  };

  UI.VIEWS = VIEWS;
})();
