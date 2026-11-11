'use strict';
/* Woodshed core: namespace, DOM helpers, event bus, dates, small utils. */
const WS = (window.WS = window.WS || {});
WS.VERSION = '0.4.0';
WS.DEBUG = /[?&]debug\b/.test(location.search);

WS.$ = (sel, root = document) => root.querySelector(sel);
WS.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* Tiny element builder. Text is always set with textContent unless `html` is used for static markup. */
WS.h = function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
};

WS.svg = function svg(tag, attrs, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const kid of kids.flat(Infinity)) if (kid) el.appendChild(kid);
  return el;
};

WS.bus = (() => {
  const map = new Map();
  return {
    on(evt, fn) {
      if (!map.has(evt)) map.set(evt, new Set());
      map.get(evt).add(fn);
      return () => map.get(evt).delete(fn);
    },
    emit(evt, data) {
      const set = map.get(evt);
      if (!set) return;
      for (const fn of [...set]) {
        try { fn(data); } catch (err) { console.error(err); }
      }
    },
  };
})();

/* ---------- Dates (local calendar days as YYYY-MM-DD keys) ---------- */
WS.dayOffset = 0; // debug only: shifts "today"
WS.nowMs = () => Date.now() + WS.dayOffset * 86400000;
const pad2 = (n) => String(n).padStart(2, '0');
WS.dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
WS.todayKey = () => WS.dateKey(new Date(WS.nowMs()));
WS.parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
WS.addDays = (k, n) => { const d = WS.parseKey(k); d.setDate(d.getDate() + n); return WS.dateKey(d); };
WS.daysBetween = (a, b) => Math.round((WS.parseKey(b) - WS.parseKey(a)) / 86400000);
WS.dowIndex = (k) => (WS.parseKey(k).getDay() + 6) % 7; // 0 = Monday
WS.mondayOf = (k) => WS.addDays(k, -WS.dowIndex(k));
WS.DOW_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
WS.fmtDay = (k) => WS.parseKey(k).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

/* ---------- Small utils ---------- */
WS.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
WS.shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
WS.pickWeighted = (items, weightFn) => {
  const total = items.reduce((s, it) => s + weightFn(it), 0);
  let r = Math.random() * total;
  for (const it of items) { r -= weightFn(it); if (r <= 0) return it; }
  return items[items.length - 1];
};
WS.reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
WS.fmtInt = (n) => Math.round(n).toLocaleString();

WS.toast = (msg, ms = 2800) => {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(WS._toastTimer);
  WS._toastTimer = setTimeout(() => t.classList.remove('show'), ms);
};

/* Seeded PRNG for stable decorative scenery */
WS.rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
