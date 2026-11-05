/* Music theory: spelling, chord qualities, shells, chord identification. */
(function () {
  const T = (WS.theory = {});

  T.LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  T.LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  T.SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  T.FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  // Common lead-sheet spellings for roots, by chord family
  T.MAJ_FAM_ROOT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  T.MIN_FAM_ROOT = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];

  // The roadmap's key order: each key a 5th below the last
  T.KEY_ORDER = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];
  T.KEY_NAME = { 0: 'C', 5: 'F', 10: 'B♭', 3: 'E♭', 8: 'A♭', 1: 'D♭', 6: 'G♭', 11: 'B', 4: 'E', 9: 'A', 2: 'D', 7: 'G' };

  T.Q = {
    maj:   { sym: '',     name: 'major',             ints: [0, 4, 7],      steps: [0, 2, 4],    fam: 'maj' },
    min:   { sym: 'm',    name: 'minor',             ints: [0, 3, 7],      steps: [0, 2, 4],    fam: 'min' },
    dim:   { sym: '°',    name: 'diminished',        ints: [0, 3, 6],      steps: [0, 2, 4],    fam: 'min' },
    aug:   { sym: '+',    name: 'augmented',         ints: [0, 4, 8],      steps: [0, 2, 4],    fam: 'maj' },
    maj7:  { sym: 'maj7', name: 'major 7',           ints: [0, 4, 7, 11],  steps: [0, 2, 4, 6], fam: 'maj' },
    dom7:  { sym: '7',    name: 'dominant 7',        ints: [0, 4, 7, 10],  steps: [0, 2, 4, 6], fam: 'maj' },
    min7:  { sym: 'm7',   name: 'minor 7',           ints: [0, 3, 7, 10],  steps: [0, 2, 4, 6], fam: 'min' },
    hdim7: { sym: 'ø7',   name: 'half-diminished 7', ints: [0, 3, 6, 10],  steps: [0, 2, 4, 6], fam: 'min' },
    dim7:  { sym: '°7',   name: 'diminished 7',      ints: [0, 3, 6, 9],   steps: [0, 2, 4, 6], fam: 'min' },
  };

  const ACC = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };

  T.parseName = (name) => {
    const L = T.LETTERS.indexOf(name[0]);
    const rest = name.slice(1);
    const acc = rest === '♯' ? 1 : rest === '♭' ? -1 : 0;
    return { L, acc, pc: (T.LETTER_PC[L] + acc + 12) % 12 };
  };

  /* Spell the note `semis` above `rootName`, `steps` letters up. Returns null for double accidentals. */
  T.spellFrom = (rootName, semis, steps) => {
    const r = T.parseName(rootName);
    const tL = (r.L + steps) % 7;
    const target = (r.pc + semis) % 12;
    let d = (target - T.LETTER_PC[tL] + 12) % 12;
    if (d > 6) d -= 12;
    if (Math.abs(d) > 1) return null;
    return T.LETTERS[tL] + ACC[d];
  };

  T.rootNameFor = (pc, q) => (T.Q[q].fam === 'maj' ? T.MAJ_FAM_ROOT : T.MIN_FAM_ROOT)[pc];

  T.chord = (pc, q, rootName) => {
    const def = T.Q[q];
    const rn = rootName || T.rootNameFor(pc, q);
    const fallback = def.fam === 'maj' ? T.FLAT : T.SHARP;
    const pcs = def.ints.map((i) => (pc + i) % 12);
    const tones = def.ints.map((i, k) => T.spellFrom(rn, i, def.steps[k]) || fallback[(pc + i) % 12]);
    return { kind: 'chord', root: pc, q, rootName: rn, pcs, tones, sym: rn + def.sym, name: `${rn} ${def.name}`, item: `${q}:${pc}` };
  };

  /* A shell voicing inside a major-key ii–V–I. Shape A: ii=R+7, V=R+3, I=R+7. Shape B: ii=R+3, V=R+7, I=R+3. */
  T.shell = (keyPc, role, shape) => {
    const keyName = T.KEY_NAME[keyPc];
    const map = { ii: { deg: 2, steps: 1, q: 'min7' }, V: { deg: 7, steps: 4, q: 'dom7' }, I: { deg: 0, steps: 0, q: 'maj7' } };
    const r = map[role];
    const rootPc = (keyPc + r.deg) % 12;
    const rootName = r.steps ? T.spellFrom(keyName, r.deg, r.steps) || T.rootNameFor(rootPc, r.q) : keyName;
    const base = T.chord(rootPc, r.q, rootName);
    const use7 = shape === 'A' ? role !== 'V' : role === 'V';
    const def = T.Q[r.q];
    const guideInt = use7 ? def.ints[3] : def.ints[1];
    return {
      kind: 'shell', role, shape, key: keyPc, keyName,
      root: rootPc, rootName, q: r.q,
      guidePc: (rootPc + guideInt) % 12, guideInt, guideName: use7 ? base.tones[3] : base.tones[1],
      use7, hint: use7 ? 'root + 7th' : 'root + 3rd',
      pcs: [rootPc, (rootPc + guideInt) % 12],
      sym: base.sym, name: base.name, item: `sh${shape}-${role}:${keyPc}`,
    };
  };

  /* Split a symbol into root letter, accidental and quality suffix, for lead-sheet style drawing. */
  T.symParts = (sym) => {
    const letter = sym[0];
    const acc = sym[1] === '♭' || sym[1] === '♯' ? sym[1] : '';
    return { letter, acc, suffix: sym.slice(1 + acc.length) };
  };

  T.noteName = (n) => `${T.FLAT[n % 12]}${Math.floor(n / 12) - 1}`;

  /* Name a pitch class as spelled inside a chord, falling back to flats. */
  T.pcIn = (pc, chord) => {
    if (chord && chord.tones) {
      const i = chord.pcs ? chord.pcs.indexOf(pc) : -1;
      if (i >= 0 && chord.tones[i]) return chord.tones[i];
    }
    return T.FLAT[pc];
  };

  T.matches = (spec, notes) => {
    if (!notes.length) return false;
    if (spec.kind === 'chord') {
      const have = new Set(notes.map((n) => n % 12));
      if (have.size !== spec.pcs.length) return false;
      return spec.pcs.every((pc) => have.has(pc));
    }
    // shell: exactly two keys, root on the bottom, guide tone within an octave above, all below middle C
    if (notes.length !== 2) return false;
    const [lo, hi] = notes;
    return lo % 12 === spec.root && hi % 12 === spec.guidePc && hi - lo >= 1 && hi - lo <= 12 && hi < 60;
  };

  const INTERVALS = ['unison', 'minor 2nd', 'major 2nd', 'minor 3rd', 'major 3rd', 'perfect 4th', 'tritone',
    'perfect 5th', 'minor 6th', 'major 6th', 'minor 7th', 'major 7th', 'octave'];

  /* Identify what's held, for the Keyboard screen. */
  T.identify = (notes) => {
    if (!notes.length) return null;
    const pcs = [...new Set(notes.map((n) => n % 12))];
    const bass = notes[0] % 12;
    const roots = [bass, ...pcs.filter((p) => p !== bass)];
    for (const root of roots) {
      for (const [q, def] of Object.entries(T.Q)) {
        if (def.ints.length !== pcs.length) continue;
        const set = def.ints.map((i) => (root + i) % 12);
        if (!set.every((p) => pcs.includes(p))) continue;
        const c = T.chord(root, q);
        let detail = c.name;
        if (bass !== root) {
          const idx = def.ints.findIndex((i) => (root + i) % 12 === bass);
          detail += `, ${['root position', 'first inversion', 'second inversion', 'third inversion'][idx]}`;
        }
        return { label: c.sym, detail, isChord: true };
      }
    }
    if (notes.length === 1) return { label: T.noteName(notes[0]), detail: notes[0] === 60 ? 'single note, middle C' : 'single note' };
    if (notes.length === 2) {
      const iv = notes[1] - notes[0];
      const name = iv <= 12 ? INTERVALS[iv] : `${INTERVALS[iv % 12] || 'octave'} plus an octave`;
      return { label: `${T.FLAT[notes[0] % 12]} and ${T.FLAT[notes[1] % 12]}`, detail: name };
    }
    return { label: pcs.map((p) => T.FLAT[p]).join(' '), detail: 'not a chord in the drills yet' };
  };
})();
