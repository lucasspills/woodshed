/* Persistent state: IndexedDB first, localStorage fallback, export/import backups. */
(function () {
  const DB_NAME = 'woodshed';
  const STORE = 'kv';
  const KEY = 'state';
  let db = null;
  let saveTimer = null;

  const openDb = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const idbGet = () => new Promise((resolve, reject) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const idbPut = (value) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  const store = (WS.store = {
    state: null,
    backend: 'memory',
    persisted: false,

    defaults() {
      const today = WS.todayKey();
      return {
        v: 1,
        createdAt: today,
        settings: {
          planStart: WS.mondayOf(today), // Monday of roadmap week 1
          inputMode: 'auto',             // auto | midi | qwerty
          synth: 'auto',                 // auto | on | off  (sound for computer-keyboard notes)
          metroVol: 0.7,
          sfx: true,
          calibrationMs: 0,
          calibratedAt: null,
          octave: 0,
          planWeek: null,                // optional manual override of the roadmap week
          pianoVol: 0.8,                 // Play output level
          pianoRoom: 0.25,               // reverb amount, 0..1
          reverb: 'room',                // dry | room | hall
          pianoTouch: 'normal',          // light | normal | heavy velocity curve
          audioLatency: 'lowest',        // lowest | safe (bigger buffer if it crackles)
          soundMode: 'single',           // single | split | layer (Play only)
          sound: 'salamander',           // the sound in single mode
          splitLo: 'bass',               // left of the split point
          splitHi: 'salamander',         // right of the split point
          splitPoint: 60,                // lowest key of the right-hand side (middle C)
          layerA: 'salamander',
          layerB: 'pad',
          layerMix: 0.35,                // 0 = all A, 1 = all B
        },
        xp: 0,
        days: {},
        weeksAwarded: {},
        freezes: 0,
        freezeProgress: 0,
        levels: {},
        items: {},
        rounds: [],
        play: {},                        // day -> { minutes, notes } of free play
        seenIntro: false,
      };
    },

    async load() {
      let data = null;
      try {
        db = await openDb();
        data = await idbGet();
        this.backend = 'indexeddb';
      } catch (e) {
        try {
          data = JSON.parse(localStorage.getItem('woodshed-state') || 'null');
          this.backend = 'localstorage';
        } catch (e2) {
          this.backend = 'memory';
        }
      }
      this.state = this.migrate(data || this.defaults());
      try {
        if (navigator.storage && navigator.storage.persisted) this.persisted = await navigator.storage.persisted();
      } catch (e) { /* ignore */ }
      return this.state;
    },

    migrate(s) {
      const d = this.defaults();
      s.settings = Object.assign({}, d.settings, s.settings || {});
      for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
      if (s.rounds.length > 600) s.rounds = s.rounds.slice(-600);
      s.v = 1;
      return s;
    },

    save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => this.flush(), 200);
    },

    async flush() {
      clearTimeout(saveTimer);
      const snap = JSON.parse(JSON.stringify(this.state));
      try {
        if (this.backend === 'indexeddb') await idbPut(snap);
        else if (this.backend === 'localstorage') localStorage.setItem('woodshed-state', JSON.stringify(snap));
      } catch (e) {
        console.error('Save failed', e);
        WS.toast('Progress didn’t save. Export a backup from Settings.');
      }
      if (!this._askedPersist && navigator.storage && navigator.storage.persist) {
        this._askedPersist = true;
        try { this.persisted = await navigator.storage.persist(); } catch (e) { /* ignore */ }
      }
    },

    exportJson() {
      return JSON.stringify({ app: 'woodshed', version: WS.VERSION, exportedAt: new Date().toISOString(), state: this.state }, null, 2);
    },

    async importJson(text) {
      let obj;
      try { obj = JSON.parse(text); } catch (e) { throw new Error('That file isn’t valid JSON.'); }
      if (!obj || obj.app !== 'woodshed' || !obj.state) throw new Error('That file isn’t a Woodshed backup.');
      this.state = this.migrate(obj.state);
      await this.flush();
    },

    async reset() {
      this.state = this.defaults();
      await this.flush();
    },
  });

  WS.S = () => store.state;
})();
