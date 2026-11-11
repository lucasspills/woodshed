/* Notation: draw chords on a staff as SVG. Notes are spelled ({ name: 'E♭', pos }) where pos is the
   diatonic position (letter index + 7 * octave), so C4 = 28, E4 = 30, G2 = 18. */
(function () {
  const T = WS.theory;
  const N = (WS.notation = {});
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text != null) e.textContent = text;
    return e;
  };

  const CLEF = {
    treble: { bottom: 30, glyph: '𝄞' },  // bottom line E4
    bass: { bottom: 18, glyph: '𝄢' },    // bottom line G2
  };

  /* Root-position chord in the treble staff: root from C4 to B4, every tone a letter-third up. */
  N.chordVoicing = (p) => {
    const r = T.parseName(p.rootName || T.FLAT[p.root]);
    const rootPos = r.L + 28;
    const steps = T.Q[p.q].steps;
    return { clef: 'treble', notes: p.tones.map((name, k) => ({ name, pos: rootPos + steps[k] })) };
  };
  /* Shell in the bass staff: root from E2 to D3, the 3rd or 7th above it. */
  N.shellVoicing = (p) => {
    const r = T.parseName(p.rootName);
    const rootPos = r.L + (r.L < 2 ? 21 : 14);
    return { clef: 'bass', notes: [{ name: p.rootName, pos: rootPos }, { name: p.guideName, pos: rootPos + (p.use7 ? 6 : 2) }] };
  };
  N.voicingFor = (p) => (p.kind === 'shell' ? N.shellVoicing(p) : N.chordVoicing(p));

  /* A one-chord staff. opts: { size: px per staff space (default 10), width } */
  N.staff = (voicing, opts = {}) => {
    const s = opts.size || 10;
    const clef = CLEF[voicing.clef];
    const notes = [...voicing.notes].sort((a, b) => a.pos - b.pos);
    const top = Math.max(clef.bottom + 8, ...notes.map((n) => n.pos)) + 2;
    const bot = Math.min(clef.bottom, ...notes.map((n) => n.pos)) - 2;
    const yOf = (pos) => (top - pos) * (s / 2) + s;
    const H = (top - bot) * (s / 2) + 2 * s;
    // Accidentals: greedy columns, leftward, so ones a 6th or less apart don't collide
    const accs = notes.filter((n) => n.name.length > 1);
    const cols = [];
    accs.slice().reverse().forEach((n) => {
      let c = 0;
      while (cols[c] && cols[c].some((m) => Math.abs(m.pos - n.pos) < 6)) c++;
      (cols[c] = cols[c] || []).push(n);
      n.col = c;
    });
    const accW = s * 1.15;
    const clefW = s * 3.2;
    const headX = clefW + s * 1.2 + cols.length * accW + s * 0.6;
    // Seconds: the upper note of an adjacent pair sits to the right
    notes.forEach((n, i) => { n.shift = i > 0 && n.pos - notes[i - 1].pos === 1 && !notes[i - 1].shift ? 1 : 0; });
    const W = opts.width || headX + s * 4.2;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'staff', role: 'img', 'aria-label': `${voicing.clef} clef: ${notes.map((n) => `${n.name}${Math.floor(n.pos / 7)}`).join(', ')}` });
    for (let k = 0; k < 5; k++) {
      const y = yOf(clef.bottom + k * 2);
      svg.append(el('line', { x1: 0, x2: W, y1: y, y2: y, class: 'staff-line' }));
    }
    // Clef glyph, sized to the staff
    const clefY = voicing.clef === 'treble' ? yOf(clef.bottom) + s * 0.95 : yOf(clef.bottom + 6) + s * 1.55;
    svg.append(el('text', { x: s * 0.2, y: clefY, class: `clef clef-${voicing.clef}`, 'font-size': voicing.clef === 'treble' ? s * 6.2 : s * 3.6 }, clef.glyph));
    // Ledger lines
    const ledgers = new Set();
    for (const n of notes) {
      if (n.pos < clef.bottom) for (let p = clef.bottom - 2; p >= n.pos; p -= 2) ledgers.add(p);
      if (n.pos > clef.bottom + 8) for (let p = clef.bottom + 10; p <= n.pos; p += 2) ledgers.add(p);
    }
    const anyShift = notes.some((n) => n.shift);
    for (const p of ledgers) svg.append(el('line', { x1: headX - s * 0.25, x2: headX + s * 1.75 + (anyShift ? s * 1.45 : 0), y1: yOf(p), y2: yOf(p), class: 'staff-line ledger' }));
    // Noteheads (whole notes) and accidentals
    for (const n of notes) {
      const x = headX + s * 0.75 + n.shift * s * 1.45;
      const y = yOf(n.pos);
      svg.append(el('ellipse', { cx: x, cy: y, rx: s * 0.72, ry: s * 0.5, class: 'notehead', transform: `rotate(-18 ${x} ${y})` }));
      svg.append(el('ellipse', { cx: x, cy: y, rx: s * 0.36, ry: s * 0.2, class: 'notehead-hole', transform: `rotate(-55 ${x} ${y})` }));
      if (n.name.length > 1) {
        const acc = n.name.slice(1);
        const ax = headX - s * 0.35 - n.col * accW;
        svg.append(el('text', { x: ax, y: y + (acc === '♭' ? s * 0.42 : s * 0.55), class: 'accidental', 'font-size': s * 2.1, 'text-anchor': 'end' }, acc));
      }
    }
    return svg;
  };
})();
