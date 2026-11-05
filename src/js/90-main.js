/* Boot, routing, day rollover, offline support, and test hooks (only with ?debug). */
(function () {
  const setupDebug = () => {
    const A = WS.audio;
    const T = WS.theory;
    const D = (WS.debug = { forceTempo: null });
    D.setDay = (offset) => { WS.dayOffset = offset; WS.progress.applyFreezes(); WS.ui.rerender(); return WS.todayKey(); };
    D.state = () => JSON.parse(JSON.stringify(WS.S()));
    D.runner = () => WS.ui._runner;
    const notesFor = (p, correct) => {
      let notes;
      if (p.kind === 'chord') notes = p.pcs.map((pc) => 60 + pc);
      else { const r = 36 + p.root; notes = [r, r + p.guideInt]; }
      if (!correct) notes = notes.slice(0, -1); // drop a note
      return notes;
    };
    /* Play the current round automatically. miss: indexes to get wrong. offsetMs: timing offset from the beat. */
    D.autoplay = ({ miss = [], offsetMs = 0 } = {}) => {
      const r = WS.ui._runner;
      if (!r) throw new Error('No round running');
      const cal = (WS.S().settings.calibrationMs || 0);
      // Like a player, react to the audio clock as it is heard, rather than pre-scheduling on the wall clock.
      const events = [];
      r.prompts.forEach((p, i) => {
        const notes = notesFor(p, !miss.includes(i));
        events.push({ t: r.downbeats[i] + offsetMs / 1000, on: true, notes });
        events.push({ t: r.downbeats[i] + 2 * r.spb, on: false, notes });
      });
      events.sort((a, b) => a.t - b.t);
      const timer = setInterval(() => {
        if (!r.running) {
          // Round over: lift any keys still held, like taking hands off the keyboard
          events.filter((ev) => !ev.on).forEach((ev) => ev.notes.forEach((n) => WS.input.inject(n, false, performance.now())));
          clearInterval(timer);
          return;
        }
        const now = A.heardNow();
        while (events.length && now >= events[0].t - 0.002) {
          const ev = events.shift();
          const stamp = performance.now() + (ev.t - now) * 1000 + cal;
          ev.notes.forEach((n) => WS.input.inject(n, ev.on, stamp));
        }
        if (!events.length) clearInterval(timer);
      }, 2);
      return r.prompts.map((p) => p.sym);
    };
    // Tempo override for fast tests
    const orig = WS.levels.planRound;
    WS.levels.planRound = (id, mode) => {
      const plan = orig(id, mode);
      if (D.forceTempo) plan.tempo = D.forceTempo;
      return plan;
    };
  };

  const checkDay = (() => {
    let last = null;
    return () => {
      const k = WS.todayKey();
      if (last && k !== last) { WS.progress.applyFreezes(); WS.ui.rerender(); }
      last = k;
    };
  })();

  /* Offline support and installing: a service worker keeps the app and every sound you've loaded on this Mac.
     The page itself is always fetched fresh when you're online, so updates show up on the next open. */
  const registerWorker = () => {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol) || /[?&]nosw\b/.test(location.search)) return;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      WS.sw = reg;
    }).catch((err) => console.warn('Offline support unavailable:', err));
  };

  (async function boot() {
    await WS.store.load();
    if (WS.DEBUG) setupDebug();
    WS.progress.applyFreezes();
    checkDay();

    window.addEventListener('hashchange', () => WS.ui.go(location.hash.slice(1) || 'tonight'));
    WS.$('#kbd-pill').addEventListener('click', () => { location.hash = '#keyboard'; });
    WS.bus.on('inputstatus', () => WS.ui.refreshRail());
    WS.ui.go(location.hash.slice(1) || 'tonight');

    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load('700 40px Kalam'), document.fonts.load('400 16px "Atkinson Hyperlegible"')]).catch(() => {});
    }
    WS.input.autoConnect();
    registerWorker();

    setInterval(checkDay, 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) WS.store.flush();
      else checkDay();
    });
    window.addEventListener('pagehide', () => WS.store.flush());
    document.documentElement.classList.add('ready');
  })();
})();
