/* The Piano Roadmap, in the app: four phases, six lanes, every drill card from the Drill Library,
   a week-by-week schedule for the first year, milestone checklists, and your status on all of it. */
(function () {
  const KEYS12 = 'C, F, B♭, E♭, A♭, D♭, G♭, B, E, A, D, G';

  const LANES = [
    { id: 'reading', name: 'Reading', blurb: 'Sight-reading, key signatures, chords on the page' },
    { id: 'repertoire', name: 'Score pieces', blurb: 'Pieces learned only from the score' },
    { id: 'harmony', name: 'Harmony', blurb: 'Chords, voicings and progressions in all 12 keys' },
    { id: 'ear', name: 'Ear', blurb: 'Scale degrees, melodies, bass lines and chord quality' },
    { id: 'improv', name: 'Improv', blurb: 'Left-hand voicings, landing notes, tunes' },
    { id: 'technique', name: 'Technique and craft', blurb: 'Posture, recording, composing' },
  ];

  /* ---------- Drill cards ---------- */
  const D = [
    /* ===== Phase 1: Foundation ===== */
    { id: 'SR', phase: 1, lane: 'reading', title: 'Sight-reading, 7 min a day', when: 'Every day',
      steps: [
        'Scan for 30 seconds first. Say out loud the sharps or flats, the time signature, and any big leaps or tricky rhythms.',
        'Metronome at ♩ = 50 to 60, slow enough that you never stop.',
        'Play it once, straight through. Missed a note? Skip it and land on the next beat. Never go back.',
        'Eyes stay on the page. Glance down only for leaps bigger than an octave.',
        'Move to a new piece each time. Reading the same piece twice turns it into memory practice.',
      ],
      pass: 'Level up when you get through 3 new pieces in a row with no stops at ♩ = 60.',
      tip: 'Material: weeks 1–2 level 1 book, weeks 3–5 level 2, weeks 6–9 level 2 or 3 plus a hymn a day, weeks 10–12 level 3 plus hymns in new keys.' },
    { id: 'SP', phase: 1, lane: 'repertoire', title: 'Score-piece method, 8 min a day', when: 'Every day',
      steps: [
        'Setup, first session: number every bar, split the piece into 2–4 bar chunks, circle every pedal mark, dynamic and easy-to-miss accidental, write in missing fingering.',
        'Play yesterday’s chunk once.',
        'Today’s chunk hands separate at half tempo with the written fingering: 3 clean repetitions.',
        'Hands together, same tempo: 3 clean in a row. A mistake resets the count to zero.',
        'Add pedal and dynamics on the last repetitions, then connect yesterday’s chunk straight into today’s.',
      ],
      pass: 'A section is done when it’s clean at half tempo; then raise the metronome 4 to 6 clicks a day.',
      tip: 'Keep reading the score even after it’s memorized. Reading is the skill; the piece is the vehicle.' },
    { id: 'R1', phase: 1, lane: 'reading', title: 'Landmark notes', when: 'Weeks 1–2',
      steps: ['Learn seven landmarks until they’re instant, and read every other note as a step or skip from the nearest one.', '2 minutes a day of note naming, treble and bass.'],
      table: { head: ['Landmark', 'Where it sits'], rows: [['Low C', '2 ledger lines below the bass staff'], ['Bass C', '2nd space, bass staff'], ['Bass F', '4th line, between the clef’s dots'], ['Middle C', '1 ledger line between the staves'], ['Treble G', '2nd line, where the clef curls'], ['Treble C', '3rd space, treble staff'], ['High C', '2 ledger lines above the treble staff']] },
      pass: 'Name 20 notes in a row with no mistakes and no counting up from the bottom line.' },
    { id: 'R2', phase: 1, lane: 'reading', title: 'Blind leaps', when: 'Weeks 3–6, 1-minute warm-up',
      steps: ['Left thumb on a C, eyes on the music stand, jump to the next C up without looking. Then back.', 'Repeat with a 5th, 6th and 7th, then the right hand.'],
      pass: 'Land octave jumps 10 times out of 10 without looking.' },
    { id: 'R3', phase: 1, lane: 'reading', title: 'Key signatures', when: 'Weeks 2–4',
      steps: ['Order of sharps: F C G D A E B. Flats: B E A D G C F.', 'Sharp keys: the key is a half step above the last sharp.', 'Flat keys: the key is the second-to-last flat. One flat is F major.', 'The relative minor is 3 half steps below the major.'],
      pass: 'Name any key signature in under 5 seconds.' },
    { id: 'R4', phase: 1, lane: 'reading', title: 'Chord shapes on the page', when: 'Weeks 5–12',
      steps: ['Root position: all lines or all spaces, evenly stacked; the bottom note is the root.', 'Inversion: one wider gap (a 4th). The note just above the gap is the root.', 'With each hymn, name the chord on beat 1 of every bar before you play.'],
      pass: 'Name a hymn’s chords as fast as you play it at ♩ = 60.' },
    { id: 'H1', phase: 1, lane: 'harmony', title: 'Triad qualities', when: 'Weeks 1–2', app: ['h1-maj', 'h1-min', 'h1-mix', 'h1-dimaug', 'h1-all'],
      steps: ['On each root, play major, minor, diminished, augmented, one chord per click.', 'Major to minor lowers the 3rd; minor to diminished lowers the 5th; augmented raises major’s 5th.', 'Week 1: major and minor only. Week 2: all four. Right hand, then left, saying each name.'],
      table: { head: ['Quality', 'Half steps', 'In C'], rows: [['Major', '0 4 7', 'C E G'], ['Minor', '0 3 7', 'C E♭ G'], ['Diminished', '0 3 6', 'C E♭ G♭'], ['Augmented', '0 4 8', 'C E G♯']] },
      pass: 'All 12 roots at ♩ = 60 with no pause, each hand.' },
    { id: 'H2', phase: 1, lane: 'harmony', title: 'Inversion ladder', when: 'Weeks 3–4',
      steps: ['In C: C E G → E G C → G C E → C E G an octave up, then back down. One chord per click.', 'Major triads in week 3, minor in week 4, all 12 keys.'],
      pass: '♩ = 72 in each hand, all 12 keys.' },
    { id: 'H3', phase: 1, lane: 'harmony', title: 'I–IV–V–I with the smallest moves', when: 'Week 4',
      steps: ['Right hand in C: C E G → C F A → B D G → C E G. Left hand plays the roots.', 'Shared notes stay still; everything else slides to the nearest note.'],
      pass: 'All 12 keys without stopping.' },
    { id: 'H4', phase: 1, lane: 'harmony', title: 'Seventh-chord shift', when: 'Weeks 5–6', app: ['h4-maj7-dom7', 'h4-min7-hdim', 'h4-dim7', 'h4-all'],
      steps: ['On each root, play down the table, one chord per click.', 'Each chord lowers exactly one note of the one before by a half step: the 7th, the 3rd, the 5th, then the 7th again.'],
      table: { head: ['Chord', 'Symbol', 'Half steps', 'In C'], rows: [['Major 7', 'Cmaj7', '0 4 7 11', 'C E G B'], ['Dominant 7', 'C7', '0 4 7 10', 'C E G B♭'], ['Minor 7', 'Cm7', '0 3 7 10', 'C E♭ G B♭'], ['Half-diminished', 'Cø7', '0 3 6 10', 'C E♭ G♭ B♭'], ['Diminished 7', 'C°7', '0 3 6 9', 'C E♭ G♭ A']] },
      pass: 'All 12 roots at ♩ = 60, both hands.' },
    { id: 'H5', phase: 1, lane: 'harmony', title: 'Random draw', when: 'Week 7', app: ['h4-all'],
      steps: ['Draw a root and one of the five seventh types; play that chord.', '20 draws a session. Chord Runner’s “All five sevenths” is this drill with a timer.'],
      pass: 'Any draw in under 3 seconds.' },
    { id: 'H6', phase: 1, lane: 'harmony', title: 'Name the chords in a hymn', when: 'Fridays, weeks 6–8',
      steps: ['For each bar, find the chord on beat 1 (R4) and pencil its symbol above the staff.', 'When the lowest note isn’t the root, write a slash chord: G/B.', 'Then play the hymn reading your symbols.'],
      pass: 'Label a 4-line hymn in under 10 minutes.' },
    { id: 'H7', phase: 1, lane: 'harmony', title: 'Harmonize the scale', when: 'Weeks 8–9',
      steps: ['Build a seventh chord on every scale note using only notes from the key.', 'Play up and down saying each numeral. Week 8: C F B♭ E♭ A♭ D♭. Week 9: G♭ B E A D G.'],
      table: { head: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii'], rows: [['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'ø7'], ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bø7']] },
      pass: 'Any key on request at ♩ = 60.' },
    { id: 'H8', phase: 1, lane: 'harmony', title: 'Numeral call', when: 'Friday, week 9',
      steps: ['Draw a key and a numeral, play that seventh chord (E♭ + vi = Cm7).', '20 draws.'],
      pass: 'Under 3 seconds a draw.' },
    { id: 'H9', phase: 1, lane: 'harmony', title: 'Pop progression I–V–vi–IV', when: 'Week 10',
      steps: ['In C: C, G, Am, F. Left hand roots; right hand to the nearest inversion: C E G → B D G → C E A → C F A.', 'Two clicks per chord, all 12 keys. Then play along with With or Without You in D.'],
      pass: '♩ = 80 in all 12 keys.' },
    { id: 'H10', phase: 1, lane: 'harmony', title: 'ii–V–I with smooth voice leading', when: 'Week 11',
      steps: ['Right hand in C: Dm7 D F A C → G7 D F G B → Cmaj7 C E G B. Left hand roots.', 'ii to V: keep the bottom two, move the top two down a step. V to I: move the bottom two down, keep the top two.'],
      pass: '♩ = 80, two clicks per chord, all 12 keys.' },
    { id: 'H11', phase: 1, lane: 'harmony', title: 'Turnaround I–vi–ii–V', when: 'Week 12',
      steps: ['Right hand in C: C E G B → C E G A → C D F A → B D F G, then back to I as B C E G.', 'Every change moves one or two notes down a step and holds the rest.'],
      pass: 'Two laps in all 12 keys at ♩ = 60, two clicks per chord.' },
    { id: 'E1', phase: 1, lane: 'ear', title: 'Sing the degrees', when: 'Weeks 1–2', ear: ['degrees'],
      steps: ['Play the cadence (I–IV–V–I) so your ear knows home.', 'Sing up and down using numbers as words, then 1 3 5 8 5 3 1.', 'Eyes closed, play one random note in the key. Guess its number, then sing down to 1 counting steps.', 'Week 1 in C; week 2 in G, then F. The Degrees game drills this with grading.'],
      pass: '9 out of 10 in the week’s key.' },
    { id: 'E2', phase: 1, lane: 'ear', title: 'Melodies by ear', when: 'Weeks 3–4', ear: ['echo'],
      steps: ['Play the cadence in C. Sing the melody’s first note and find its number, then its key.', 'Pick out the rest note by note: sing, guess the number, play, correct.', 'Play it again in G and F, working from the numbers.', 'Melodies: Twinkle Twinkle and Ode to Joy (week 3), Amazing Grace and Happy Birthday (week 4). Echo trains the same skill.'],
      pass: 'All four right in C, G and F.' },
    { id: 'E3', phase: 1, lane: 'ear', title: 'Bass lines', when: 'Weeks 5–8', ear: ['bass'],
      steps: ['Find home: hum the most final note at the end of the chorus. That note is 1.', 'At each chord change, hum the lowest note and find it. Try 1, 4, 5 and 6 first.', 'Write the bass numbers for one section, then play along: bass left hand, chord right hand.', 'Songs: Twist and Shout, Stand By Me, With or Without You, Perfect. Bass Detective drills it.'],
      pass: 'All four worked out before checking.' },
    { id: 'E4', phase: 1, lane: 'ear', title: 'Chord quality and whole songs', when: 'Weeks 9–12', ear: ['quality'],
      steps: ['5 minutes of chord quality: major and minor, then dominant 7 and major 7 from week 10.', '10 minutes on a whole song: melody, then bass, then the chord on each bass note, then both hands. One song a week.'],
      pass: 'Quality at 9 out of 10; three songs done, melody and bass, by week 12.' },
    { id: 'I1', phase: 1, lane: 'improv', title: 'Shell voicings', when: 'Weeks 1–4', app: ['i1-a', 'i1-b', 'i1-ab'],
      steps: ['A shell is the root plus the 3rd or the 7th. Root low, the second note above it, below middle C.', 'Shape A: ii and I take root + 7th, V takes root + 3rd. Shape B is the reverse.', 'Weeks 1–2: left hand alone at ♩ = 60. Weeks 2–3: right hand plays chord tones as quarter notes over held shells.'],
      table: { head: ['Key', 'ii (A)', 'V (A)', 'I (A)'], rows: [['C', 'D + C', 'G + B', 'C + B'], ['F', 'G + F', 'C + E', 'F + E'], ['B♭', 'C + B♭', 'F + A', 'B♭ + A'], ['E♭', 'F + E♭', 'B♭ + D', 'E♭ + D']] },
      pass: 'Both shapes, all 12 keys, ♩ = 80, no pause between keys.' },
    { id: 'I2', phase: 1, lane: 'improv', title: 'Target the 3rd', when: 'Weeks 5–7',
      steps: ['Left hand: shape A shells as whole notes. Right hand: swung eighths from the key’s major scale.', 'One rule: on beat 1 of every new chord, land on that chord’s 3rd. In C: F over ii, B over V, E over I.', 'Four times around without stopping, then change key.'],
      pass: 'Every 3rd landed for 4 rounds in C, F, B♭, E♭ and G.' },
    { id: 'I3', phase: 1, lane: 'improv', title: 'One-note rhythm', when: '2-minute warm-up from week 5',
      steps: ['Hold the shells. Right hand improvises on one note, the 5th of the key, with rhythm alone.', 'Then allow two notes, then three. Your drumming is the edge here.'],
      pass: 'No test. It’s a warm-up.' },
    { id: 'I4', phase: 1, lane: 'improv', title: 'Charleston comping', when: 'Weeks 8–9',
      steps: ['Hit the shell on beat 1 and on the “and” of 2; let it ring through 3 and 4.', 'Add the right hand with I2’s rule, then approach each target 3rd from a half step below.', 'C and F in week 8; B♭, E♭ and G in week 9.'],
      pass: 'Left hand keeps the Charleston for 4 rounds while you solo in F, B♭, E♭ and G.' },
    { id: 'I5', phase: 1, lane: 'improv', title: 'Turnaround and the Phase 1 test', when: 'Weeks 10–12',
      steps: ['Turnaround shells in C: Cmaj7 C + B → Am7 A + C → Dm7 D + C → G7 G + B.', 'Solo with I2’s rule; the 3rd of vi is the key’s own note.', 'Week 12 test, recorded: shells in all 12 keys at ♩ = 80; 4 rounds landing every 3rd in F, B♭, E♭, G; 4 rounds of turnaround with Charleston comping in C.'],
      pass: 'All three parts of the test on one recording.' },
    { id: 'P1-satie', phase: 1, lane: 'repertoire', title: 'Satie, Gymnopédie No. 1', when: 'Weeks 1–6',
      steps: ['Left-hand leaps and pedal. SP setup in week 1, then 8 bars a week.', 'The second half mostly repeats the first; mark only the bars that differ.', 'Week 6: whole piece with pedal and dynamics, and record it.'],
      pass: 'The whole piece from the score with the written pedal and dynamics.' },
    { id: 'P1-chopin', phase: 1, lane: 'repertoire', title: 'Chopin, Prelude in E minor, Op. 28 No. 4', when: 'Weeks 7–12',
      steps: ['Chord reading and dynamics. SP setup, then about 6 bars a week.', 'Week 11 hands together, week 12 dynamics and pedal, and record it.'],
      pass: 'The whole prelude from the score, recorded.' },
    { id: 'T-posture', phase: 1, lane: 'technique', title: 'Posture check', when: 'Week 1',
      steps: ['Film yourself from the side for one minute.', 'Check: forearms level with the keys, elbows slightly forward, shoulders down, wrists level, fingers curved, right heel behind the pedal.'],
      pass: 'Video filmed and checked.' },
    { id: 'T-record', phase: 1, lane: 'technique', title: 'Sunday recordings', when: 'Every Sunday',
      steps: ['Record one score passage and one improv clip on the Play screen.', 'Compare recordings, not feelings: listen to month 1 against month 3 when progress feels invisible.'],
      pass: 'Four Sundays in a row recorded.' },

    /* ===== Phase 2: Fluency ===== */
    { id: 'SR2', phase: 2, lane: 'reading', title: 'Sight-reading, levels 3–4', when: 'Months 4–6',
      steps: ['Same SR method, early-intermediate material, keys up to 4 sharps or 4 flats.'], pass: 'Early-intermediate material in 4-sharp or 4-flat keys without stopping.' },
    { id: 'R5', phase: 2, lane: 'reading', title: 'Read a bar ahead', when: 'Weeks 13–18',
      steps: ['Before you finish each bar, your eyes are already on the next.', 'Test: look away at the start of a bar and finish it from memory.'], pass: 'You can finish any bar from memory with your eyes already ahead.' },
    { id: 'R6', phase: 2, lane: 'reading', title: 'Lead sheets', when: 'Weeks 19–26',
      steps: ['Right hand plays the melody; left hand plays the shell for each chord symbol.', 'Use the tunes from the improv lane.'], pass: 'Play Autumn Leaves from a lead sheet at sight, both hands.' },
    { id: 'P2-debussy', phase: 2, lane: 'repertoire', title: 'Debussy, The Girl with the Flaxen Hair', when: 'Weeks 13–20',
      steps: ['G♭ major, 6 flats: a stretch before Clair de Lune’s 5.', 'SP method, about 5 bars a week. Pedal and harmony are the point.', 'Week 20: whole piece with pedal and dynamics; record it.'], pass: 'The whole piece from the score.' },
    { id: 'P2-chopin', phase: 2, lane: 'repertoire', title: 'Chopin waltz or nocturne', when: 'Weeks 21–26',
      steps: ['Something at a similar level, such as the Waltz in A minor, B. 150.', 'SP method, one section at a time; record it in week 24.'], pass: 'The whole piece from the score, recorded.' },
    { id: 'H12', phase: 2, lane: 'harmony', title: 'Minor ii–V–i', when: 'Weeks 13–15',
      steps: ['In C minor: Dø7 → G7 → Cm7. Shells: D + F → G + F → C + E♭.', 'All 12 minor keys.'], pass: 'All 12 minor keys at ♩ = 80.' },
    { id: 'H13', phase: 2, lane: 'harmony', title: 'Secondary dominants', when: 'Weeks 16–18',
      steps: ['A dominant 7 that resolves to a chord other than I.', 'In C: Cmaj7 → A7 → Dm7 → G7. A7 is the V of Dm. All 12 keys.'], pass: 'All 12 keys at ♩ = 72.' },
    { id: 'H14', phase: 2, lane: 'harmony', title: 'Ninths', when: 'Weeks 19–21',
      steps: ['Add the 9th to every chord in H7: Cmaj9 C E G B D, Dm9 D F A C E, G9 G B D F A.'], pass: 'Harmonize the scale with ninths in any key on request.' },
    { id: 'H15', phase: 2, lane: 'harmony', title: 'Guide-tone lines', when: 'Weeks 22–24',
      steps: ['Only the 3rd and 7th of each chord. In C: Dm7 F + C → G7 F + B → Cmaj7 E + B.', 'Only one note moves at each change. All 12 keys.'], pass: 'All 12 keys at ♩ = 80.' },
    { id: 'E5', phase: 2, lane: 'ear', title: 'Four chord qualities', when: 'Weeks 13–16', ear: ['quality'],
      steps: ['Major, minor, dominant 7 and major 7 mixed together.'], pass: '9 out of 10 with all four mixed.' },
    { id: 'E6', phase: 2, lane: 'ear', title: 'Pop songs, both hands', when: 'Weeks 13–20',
      steps: ['Melody, then bass, then chords, one song a week.', 'Once that’s easy, move to a film or anime theme you love.'], pass: 'A full pop song by ear, both hands, in under an hour.' },
    { id: 'E7', phase: 2, lane: 'ear', title: 'Transcribe a phrase', when: 'Weeks 21–24',
      steps: ['Take a 2-bar phrase from a Chet Baker solo. Loop it, sing it until it’s exact.', 'Find it on the piano and play it along with the recording.'], pass: '3 transcribed phrases you can use in your own solos.' },
    { id: 'I6', phase: 2, lane: 'improv', title: 'Rootless voicings', when: 'Weeks 13–15',
      steps: ['Drop the root; four notes around middle C. Form A stacks 3 5 7 9, form B stacks 7 9 3 5. On V the 13th replaces the 5th.', 'Only one note moves from ii to V. Cover all 12 keys over 3 weeks.'],
      table: { head: ['Voicing', 'Dm7', 'G7', 'Cmaj7'], rows: [['ii in form A', 'F A C E', 'F A B E', 'E G B D'], ['ii in form B', 'C E F A', 'B E F A', 'B D E G']] },
      pass: 'Rootless ii–V–I in all 12 keys.' },
    { id: 'I8', phase: 2, lane: 'improv', title: 'Scales for chord colors', when: 'Weeks 16–17',
      steps: ['Dorian over minor 7 (D E F G A B C), Mixolydian over dominant 7 (G A B C D E F), the blues scale for blues (F A♭ B♭ B C E♭).'], pass: 'Each scale from any root on request.' },
    { id: 'I9', phase: 2, lane: 'improv', title: '12-bar blues in F', when: 'Weeks 18–19',
      steps: ['F7 | B♭7 | F7 | F7 | B♭7 | B♭7 | F7 | F7 | C7 | B♭7 | F7 | C7.', 'Shells left hand, F blues scale right hand.'], pass: '4 choruses without stopping.' },
    { id: 'I7', phase: 2, lane: 'improv', title: 'Autumn Leaves', when: 'Weeks 20–22',
      steps: ['First section in G minor: Cm7 | F7 | B♭maj7 | E♭maj7 | Aø7 | D7 | Gm7.', 'A major ii–V–I in B♭, then a minor ii–V–i in G minor. Melody from a lead sheet, then improvise over rootless voicings.'], pass: 'Improvise through the whole tune with left-hand voicings, without stopping.' },
    { id: 'I7b', phase: 2, lane: 'improv', title: 'Blue Bossa and Fly Me to the Moon', when: 'Weeks 23–25',
      steps: ['Both from lead sheets: melody first, then voicings, then a solo chorus.'], pass: 'Both tunes: head and one solo chorus.' },

    /* ===== Phase 3: Clair de Lune ===== */
    { id: 'SR3', phase: 3, lane: 'reading', title: 'Sight-reading in any key', when: 'Months 7–12',
      steps: ['SR at level 4–5, any key, including 5 to 7 sharps or flats.'], pass: 'Intermediate material in any key without stopping.' },
    { id: 'P3-clair', phase: 3, lane: 'repertoire', title: 'Debussy, Clair de Lune', when: 'Weeks 27–40',
      steps: ['D♭ major, 5 flats, 9/8 time. The main project for 2 to 3 months.', 'SP method, hardest section first: the flowing middle part with the left-hand arpeggios.', 'Then the opening and the ending. Record it every two weeks.'], pass: 'Start to finish from the score.' },
    { id: 'P3-ylia', phase: 3, lane: 'repertoire', title: 'A Your Lie in April piece', when: 'Weeks 41–52',
      steps: ['Pick one at a similar level. SP method.'], pass: 'The whole piece from the score, recorded.' },
    { id: 'H16', phase: 3, lane: 'harmony', title: 'Borrowed chords', when: 'Weeks 27–30',
      steps: ['Chords from the parallel minor, the bittersweet film sound. In C: C → Fm → C, and C → A♭ → B♭ → C.', 'All 12 keys.'], pass: 'All 12 keys.' },
    { id: 'H17', phase: 3, lane: 'harmony', title: 'Tritone substitution', when: 'Weeks 31–34',
      steps: ['Replace V7 with the dominant 7 a tritone away; they share the 3rd and 7th.', 'In C: Dm7 → D♭7 → Cmaj7. All 12 keys.'], pass: 'All 12 keys.' },
    { id: 'H18', phase: 3, lane: 'harmony', title: 'Diminished passing chord', when: 'Weeks 35–38',
      steps: ['Cmaj7 → C♯°7 → Dm7. The bass climbs by half steps. All 12 keys.'], pass: 'All 12 keys.' },
    { id: 'H19', phase: 3, lane: 'harmony', title: 'Reharmonize', when: 'Weeks 39–52',
      steps: ['Play Amazing Grace with 3 different progressions under the melody, using H12–H18.', 'Then a new melody each week.'], pass: 'Three reharmonizations of one melody you’d play for someone.' },
    { id: 'E8', phase: 3, lane: 'ear', title: 'Any song you know', when: 'Weeks 27–34 and 47–52',
      steps: ['Melody, bass and chords by ear, then your own arrangement.'], pass: '5 songs arranged by ear in your own style.' },
    { id: 'E9', phase: 3, lane: 'ear', title: 'Transpose by ear', when: 'Weeks 35–40',
      steps: ['Play a learned song in a key you’ve never played it in, without paper.'], pass: 'Any of your songs in any key.' },
    { id: 'E10', phase: 3, lane: 'ear', title: 'Hear jazz harmony', when: 'Weeks 41–46',
      steps: ['Listen to a jazz recording with its lead sheet and mark every ii–V–I.', 'Then try without the lead sheet.'], pass: 'Hear ii–V–I and I–vi–ii–V in a recording with no lead sheet.' },
    { id: 'I10', phase: 3, lane: 'improv', title: 'A tune list', when: 'Weeks 27–44',
      steps: ['Build 8 to 10 standards from memory: melody, chords and a solo, one every two weeks.', 'Autumn Leaves, Blue Bossa, Fly Me to the Moon, Summertime, Satin Doll, There Will Never Be Another You, My Funny Valentine, Misty, Take the A Train, All the Things You Are.'],
      pass: '8 standards from memory, each with a solo.' },
    { id: 'I11', phase: 3, lane: 'improv', title: 'Any key on request', when: 'Weeks 45–48',
      steps: ['Draw a key, play a rootless ii–V–I and improvise 4 rounds in it.'], pass: 'Any key on request.' },
    { id: 'I12', phase: 3, lane: 'improv', title: 'Transcribe a full chorus', when: 'Weeks 49–52',
      steps: ['A solo you love, a full chorus, played along with the recording.'], pass: 'One full chorus along with the recording.' },
    { id: 'C1', phase: 3, lane: 'technique', title: 'Compose', when: 'Weeks 49–52',
      steps: ['Write a 16-bar piece built on a progression you like from H16–H18.', 'Record it.'], pass: 'One short original piece, recorded.' },

    /* ===== Phase 4: Rachmaninoff and beyond ===== */
    { id: 'P4-c', phase: 4, lane: 'repertoire', title: 'Rachmaninoff, Prelude in C♯ minor, Op. 3 No. 2', when: 'Year 2',
      steps: ['His most approachable famous piece: big chords and big sound. Spend time on the acoustic piano.'], pass: 'From the score, recorded.' },
    { id: 'P4-g', phase: 4, lane: 'repertoire', title: 'Rachmaninoff, Prelude in G minor, Op. 23 No. 5', when: 'Year 2',
      steps: ['Real virtuosity, with a march rhythm your drumming will love.'], pass: 'From the score, recorded.' },
    { id: 'P4-arr', phase: 4, lane: 'repertoire', title: 'Concerto No. 2 themes, solo arrangement', when: 'Year 2+',
      steps: ['A solo-piano arrangement, to live inside the music.'], pass: 'From the score, recorded.' },
    { id: 'P4-mvt', phase: 4, lane: 'repertoire', title: 'Concerto No. 2, second movement solo part', when: 'Long term',
      steps: ['The summit. Treat it as direction, not a deadline.'], pass: 'Played with a recording of the orchestra.' },
    { id: 'P4-also', phase: 4, lane: 'repertoire', title: 'Debussy Arabesque No. 1 and Rêverie; Chopin nocturnes, then a ballade', when: 'Alongside',
      steps: ['Rotate these with the Rachmaninoff ladder so there’s always something lyrical in progress.'], pass: 'Two of them from the score.' },
    { id: 'J4', phase: 4, lane: 'improv', title: 'Jazz, open-ended', when: 'Ongoing',
      steps: ['Longer transcriptions; a full standard with no lead sheet; a jam session or playing with a friend.'], pass: 'Play a standard with another musician.' },
    { id: 'C4', phase: 4, lane: 'technique', title: 'Composition', when: 'Ongoing',
      steps: ['Write in the styles you love, using the harmony from Phases 2 and 3.'], pass: 'Three original pieces.' },
  ];
  const BY_ID = Object.fromEntries(D.map((d) => [d.id, d]));

  /* ---------- Phases and milestone checklists ---------- */
  const PHASES = [
    { n: 1, name: 'Foundation', months: 'Months 1–3', weeks: [1, 12],
      goal: 'Read simple music without stopping, know every common chord on sight, and hear melodies as numbers you can find on the keyboard.',
      checks: [
        { id: 'p1-read', text: 'Sight-read a beginner-level page start to finish without stopping' },
        { id: 'p1-keysig', text: 'Name any key signature in under 5 seconds' },
        { id: 'p1-sevenths', text: 'Play any of the five seventh chords from any root on request', app: 'h4-all' },
        { id: 'p1-satie', text: 'Play Gymnopédie No. 1 from the score, with written pedal and dynamics' },
        { id: 'p1-ear', text: 'Work out the melody and bass line of 3 simple songs by ear' },
        { id: 'p1-shells', text: 'Play ii–V–I with shell voicings in all 12 keys', app: 'i1-ab' },
        { id: 'p1-improv', text: 'Improvise over ii–V–I in F, B♭, E♭ and G' },
      ] },
    { n: 2, name: 'Fluency', months: 'Months 4–6', weeks: [13, 26],
      goal: 'Read in hard keys without panic, work out a full pop song by ear with both hands, and improvise over real tunes with proper left-hand voicings.',
      checks: [
        { id: 'p2-read', text: 'Sight-read early-intermediate material in 4-sharp or 4-flat keys without stopping' },
        { id: 'p2-debussy', text: 'Play The Girl with the Flaxen Hair from the score' },
        { id: 'p2-pop', text: 'Work out a full pop song by ear, both hands, in under an hour' },
        { id: 'p2-rootless', text: 'Play rootless ii–V–I voicings in all 12 keys' },
        { id: 'p2-autumn', text: 'Improvise through Autumn Leaves with left-hand voicings, without stopping' },
        { id: 'p2-phrases', text: 'Learn 3 transcribed phrases and use them in your own solos' },
      ] },
    { n: 3, name: 'Clair de Lune', months: 'Months 7–12', weeks: [27, 52],
      goal: 'Play Clair de Lune from the score, play any song you know by ear in your own arrangement, and improvise over standards in any key.',
      checks: [
        { id: 'p3-clair', text: 'Play Clair de Lune start to finish from the score' },
        { id: 'p3-read', text: 'Sight-read intermediate material in any key' },
        { id: 'p3-arrange', text: 'Arrange 5 songs by ear in your own style' },
        { id: 'p3-standards', text: 'Play 8 standards from memory with a solo' },
        { id: 'p3-anykey', text: 'Improvise over a ii–V–I in any key on request' },
        { id: 'p3-compose', text: 'Write one short original piece' },
      ] },
    { n: 4, name: 'Rachmaninoff and beyond', months: 'Year 2+', weeks: [53, 9999],
      goal: 'Reading is a tool now, not a project. A repertoire ladder toward Rachmaninoff, plus open-ended jazz and composition.',
      checks: [
        { id: 'p4-c', text: 'Prelude in C♯ minor, recorded' },
        { id: 'p4-g', text: 'Prelude in G minor, recorded' },
        { id: 'p4-jam', text: 'Play a standard with another musician' },
        { id: 'p4-mvt', text: 'Concerto No. 2, second movement, with an orchestra recording' },
      ] },
  ];

  /* ---------- Week by week ----------
     Each row: weeks [from, to], what to read, the score piece, the ear / harmony / improv drill, and the
     drill codes so the app can open the card. */
  const W = (from, to, reading, score, ear, harmony, improv, codes) => ({ from, to, reading, score, ear, harmony, improv, codes });
  const WEEKS = [
    W(1, 1, 'Level 1 book · R1 landmarks · posture video', 'Gymnopédie No. 1: SP setup, bars 1–8', 'E1 in C', 'H1 major and minor: C, F, B♭, E♭, A♭, D♭', 'I1 shape A, left hand only: C, F, B♭', { ear: 'E1', harmony: 'H1', improv: 'I1', score: 'P1-satie' }),
    W(2, 2, 'Level 1 book · R1 · R3 key signatures', 'Gymnopédie: bars 9–16', 'E1 in G, then F', 'H1 all four qualities, all 12 keys', 'I1 shape A: E♭, A♭, D♭, G♭; right-hand chord tones in C', { ear: 'E1', harmony: 'H1', improv: 'I1', score: 'P1-satie' }),
    W(3, 3, 'Level 2 book · R2 blind leaps · R3', 'Gymnopédie: bars 17–24', 'E2: Twinkle Twinkle, Ode to Joy', 'H2 major ladders, all 12 keys', 'I1 shape B: C, F, B♭, E♭; right-hand chord tones in F', { ear: 'E2', harmony: 'H2', improv: 'I1', score: 'P1-satie' }),
    W(4, 4, 'Level 2 book · R2 · R3', 'Gymnopédie: bars 25–32', 'E2: Amazing Grace, Happy Birthday', 'H2 minor ladders; H3 in all 12 keys', 'I1 both shapes, all 12 keys (pass test)', { ear: 'E2', harmony: 'H2', improv: 'I1', score: 'P1-satie' }),
    W(5, 5, 'Level 2 book · R2 · R4 chords on the page', 'Gymnopédie: the rest (mark the bars that differ)', 'E3: Twist and Shout', 'H4: C, F, B♭, E♭, A♭, D♭', 'I2 in C, with I3 as a warm-up', { ear: 'E3', harmony: 'H4', improv: 'I2', score: 'P1-satie' }),
    W(6, 6, 'Level 2–3 · a hymn a day · R4', 'Gymnopédie: whole piece with pedal and dynamics; record it', 'E3: Stand By Me', 'Tue H4: G♭, B, E, A, D, G · Fri H6', 'I2 in F and B♭', { ear: 'E3', harmony: 'H4', improv: 'I2', score: 'P1-satie' }),
    W(7, 7, 'Level 2–3 · a hymn a day · R4', 'Chopin Prelude in E minor: SP setup, bars 1–6', 'E3: With or Without You', 'Tue H5 · Fri H6', 'I2 in E♭ and G', { ear: 'E3', harmony: 'H5', improv: 'I2', score: 'P1-chopin' }),
    W(8, 8, 'Level 2–3 · a hymn a day · R4', 'Chopin: bars 7–12', 'E3: Perfect, then check all four answers', 'Tue H7: C, F, B♭, E♭, A♭, D♭ · Fri H6', 'I4 in C and F', { ear: 'E3', harmony: 'H7', improv: 'I4', score: 'P1-chopin' }),
    W(9, 9, 'Level 2–3 · a hymn a day · R4', 'Chopin: bars 13–18', 'E4 + a song you choose, melody and bass', 'Tue H7: G♭, B, E, A, D, G · Fri H8', 'I4 in B♭, E♭, G', { ear: 'E4', harmony: 'H7', improv: 'I4', score: 'P1-chopin' }),
    W(10, 10, 'Level 3 · hymns in new keys', 'Chopin: bars 19–25', 'E4 + a second song', 'H9, all 12 keys', 'I5 in C and F', { ear: 'E4', harmony: 'H9', improv: 'I5', score: 'P1-chopin' }),
    W(11, 11, 'Level 3 · hymns in new keys', 'Chopin: whole piece, hands together', 'E4 + a third song', 'H10, all 12 keys', 'I5 in B♭ and G', { ear: 'E4', harmony: 'H10', improv: 'I5', score: 'P1-chopin' }),
    W(12, 12, 'Level 3 · Phase 1 reading check', 'Chopin: dynamics and pedal; record it', 'Milestone check: 3 songs, melody and bass', 'H11, all 12 keys', 'Phase 1 test (on the I5 card)', { ear: 'E4', harmony: 'H11', improv: 'I5', score: 'P1-chopin' }),
    // Phase 2
    W(13, 14, 'Level 3 · R5 read a bar ahead', 'Flaxen Hair: SP setup, bars 1–10', 'E5 four qualities · E6 song 1', `H12 minor ii–V–i: C, F, B♭, E♭, A♭, D♭`, 'I6 rootless: C, F, B♭, E♭', { ear: 'E5', harmony: 'H12', improv: 'I6', score: 'P2-debussy' }),
    W(15, 15, 'Level 3 · R5', 'Flaxen Hair: bars 11–16', 'E5 · E6 song 2', 'H12: G♭, B, E, A, D, G', 'I6 rootless: A♭, D♭, G♭, B', { ear: 'E5', harmony: 'H12', improv: 'I6', score: 'P2-debussy' }),
    W(16, 16, 'Level 3 · R5', 'Flaxen Hair: bars 17–22', 'E5 · E6 song 2', 'H13 secondary dominants: C, F, B♭, E♭', 'I8 Dorian and Mixolydian · I6: E, A, D, G', { ear: 'E5', harmony: 'H13', improv: 'I8', score: 'P2-debussy' }),
    W(17, 17, 'Level 3–4 · R5', 'Flaxen Hair: bars 23–28', 'E6 song 3', 'H13: A♭, D♭, G♭, B', 'I8 blues scale', { ear: 'E6', harmony: 'H13', improv: 'I8', score: 'P2-debussy' }),
    W(18, 18, 'Level 3–4 · R5', 'Flaxen Hair: bars 29–34', 'E6 song 3, under an hour', 'H13: E, A, D, G', 'I9 12-bar blues in F', { ear: 'E6', harmony: 'H13', improv: 'I9', score: 'P2-debussy' }),
    W(19, 19, 'Level 4 · R6 lead sheets', 'Flaxen Hair: bars 35–39', 'E6 a film or anime theme', 'H14 ninths: C, F, B♭, E♭', 'I9 blues: 4 choruses', { ear: 'E6', harmony: 'H14', improv: 'I9', score: 'P2-debussy' }),
    W(20, 20, 'Level 4 · R6', 'Flaxen Hair: whole piece with pedal and dynamics; record it', 'E6 the theme, both hands', 'H14: A♭, D♭, G♭, B', 'I7 Autumn Leaves: melody and voicings', { ear: 'E6', harmony: 'H14', improv: 'I7', score: 'P2-debussy' }),
    W(21, 21, 'Level 4 · R6', 'Chopin waltz: SP setup, first section', 'E7 phrase 1', 'H14: E, A, D, G', 'I7 Autumn Leaves: solo, first half', { ear: 'E7', harmony: 'H14', improv: 'I7', score: 'P2-chopin' }),
    W(22, 22, 'Level 4 · R6', 'Chopin waltz: middle section', 'E7 phrase 2', 'H15 guide tones: C, F, B♭, E♭, A♭, D♭', 'I7 Autumn Leaves: whole tune', { ear: 'E7', harmony: 'H15', improv: 'I7', score: 'P2-chopin' }),
    W(23, 23, 'Level 4 · R6', 'Chopin waltz: return and ending', 'E7 phrase 3', 'H15: G♭, B, E, A, D, G', 'Blue Bossa: head and voicings', { ear: 'E7', harmony: 'H15', improv: 'I7b', score: 'P2-chopin' }),
    W(24, 24, 'Level 4 · R6', 'Chopin waltz: whole piece; record it', 'E7 use the phrases in a solo', 'H15 at ♩ = 80', 'Blue Bossa: solo chorus', { ear: 'E7', harmony: 'H15', improv: 'I7b', score: 'P2-chopin' }),
    W(25, 25, 'Level 4 · a lead sheet at sight', 'Polish both pieces', 'E6 pop song in under an hour (test)', 'Review H12–H15, random keys', 'Fly Me to the Moon', { ear: 'E6', harmony: 'H15', improv: 'I7b', score: 'P2-chopin' }),
    W(26, 26, 'Phase 2 reading check', 'Record both pieces', 'Phase 2 ear check', 'Rootless ii–V–I, all 12 keys (test)', 'Autumn Leaves with voicings (test)', { ear: 'E6', harmony: 'H12', improv: 'I7', score: 'P2-chopin' }),
    // Phase 3
    W(27, 30, 'Level 4–5 · keys with 5–7 sharps or flats', 'Clair de Lune: SP setup, then the middle section', 'E8 one song every two weeks', 'H16 borrowed chords', 'I10 tunes 1–2: Autumn Leaves, Blue Bossa from memory', { ear: 'E8', harmony: 'H16', improv: 'I10', score: 'P3-clair' }),
    W(31, 34, 'Level 4–5 · any key', 'Clair de Lune: middle section to tempo', 'E8 arrangements', 'H17 tritone substitution', 'I10 tunes 3–4: Fly Me to the Moon, Summertime', { ear: 'E8', harmony: 'H17', improv: 'I10', score: 'P3-clair' }),
    W(35, 38, 'Level 5 · any key', 'Clair de Lune: the opening', 'E9 transpose by ear', 'H18 diminished passing chords', 'I10 tunes 5–6: Satin Doll, There Will Never Be Another You', { ear: 'E9', harmony: 'H18', improv: 'I10', score: 'P3-clair' }),
    W(39, 40, 'Level 5 · any key', 'Clair de Lune: the ending, then the whole piece; record it', 'E9', 'H19 reharmonize Amazing Grace', 'I10 tune 7: My Funny Valentine', { ear: 'E9', harmony: 'H19', improv: 'I10', score: 'P3-clair' }),
    W(41, 44, 'Level 5 · any key', 'Your Lie in April piece: SP setup and first half', 'E10 hear jazz harmony', 'H19 a new melody each week', 'I10 tunes 8–9: Misty, Take the A Train', { ear: 'E10', harmony: 'H19', improv: 'I10', score: 'P3-ylia' }),
    W(45, 48, 'Level 5 · any key', 'Your Lie in April piece: second half', 'E10 without the lead sheet', 'H19', 'I11 any key on request', { ear: 'E10', harmony: 'H19', improv: 'I11', score: 'P3-ylia' }),
    W(49, 52, 'Phase 3 reading check', 'Record Clair de Lune and the Your Lie in April piece', 'E8 arrangements for the checklist', 'H19 · C1 compose', 'I12 transcribe a chorus', { ear: 'E8', harmony: 'H19', improv: 'I12', score: 'P3-ylia' }),
  ];

  const RULES = [
    ['Phase dates are guesses; milestones are the real gates.', 'Move on when you hit the checklist, early or late.'],
    ['Stuck for 2 weeks on one skill?', 'Make it smaller: slower metronome, easier reading level, or a two-bar passage.'],
    ['Didn’t pass a drill by the end of its week?', 'Start the next one anyway, and spend the first 5 minutes of the focus block on the old one until it passes.'],
    ['Bored?', 'Swap the score piece for a film or anime piece at the same level. The skill matters, not the piece.'],
    ['Compare recordings, not feelings.', 'Every Sunday clip is evidence.'],
    ['Never learn a new piece by Synthesia again.', 'Use it only to hear how a piece sounds before you read it.'],
    ['Missed a week?', 'Come back with just the 15-minute core for 3 days before adding the focus block.'],
  ];

  const START = [
    ['Technique', 'Late intermediate', 'Mia & Sebastian’s Theme; about 20 songs in muscle memory'],
    ['Rhythm and time', 'Advanced', 'Drummer’s feel; swing and 2-and-4 are easy'],
    ['Melodic memory', 'Advanced', 'Sings melodies back exactly'],
    ['Reading', 'Beginner', 'Slow; chords, leaps and many-flat keys stall you'],
    ['Chord vocabulary', 'Early intermediate', 'Major, minor, 7 in all 12 keys'],
    ['Ear to keyboard', 'Beginner', 'Hears changes, can’t find the notes'],
    ['Left hand by ear', 'None yet', 'No method for chords under a melody'],
    ['Improvisation', 'Beginner', '2-5-1 in C, block chords'],
    ['Voicings', 'Beginner', 'Root-position block chords only'],
  ];

  const RM = (WS.roadmap = { LANES, DRILLS: D, BY_ID, PHASES, WEEKS, RULES, START, KEYS12 });

  RM.st = () => {
    const s = WS.S();
    if (!s.roadmap) s.roadmap = { passed: {}, checks: {}, notes: {} };
    return s.roadmap;
  };
  RM.drill = (id) => BY_ID[id];
  RM.weekRow = (week) => WEEKS.find((r) => week >= r.from && week <= r.to) || null;
  RM.phaseOfWeek = (week) => PHASES.find((p) => week >= p.weeks[0] && week <= p.weeks[1]) || PHASES[PHASES.length - 1];
  RM.isPassed = (id) => !!RM.st().passed[id];
  RM.setPassed = (id, on) => {
    const r = RM.st();
    if (on) r.passed[id] = WS.todayKey(); else delete r.passed[id];
    WS.store.save();
    WS.bus.emit('roadmap', { id, on });
  };
  RM.isChecked = (id) => !!RM.st().checks[id];
  RM.setChecked = (id, on) => {
    const r = RM.st();
    if (on) r.checks[id] = WS.todayKey(); else delete r.checks[id];
    WS.store.save();
    WS.bus.emit('roadmap', { id, on, check: true });
  };

  /* Drills that are "now": referenced by the current week's row. */
  RM.nowSet = (week) => {
    const row = RM.weekRow(week);
    const set = new Set(['SR', 'SP']);
    if (row) Object.values(row.codes).forEach((c) => set.add(c));
    return set;
  };

  /* Status of a drill: passed, now, next (later in the current phase), later, or open (not scheduled) */
  RM.status = (d, week) => {
    if (RM.isPassed(d.id)) return 'passed';
    if (RM.nowSet(week).has(d.id)) return 'now';
    return 'todo';
  };

  /* How the app's own levels back a drill: e.g. "3 of 5 levels silver" */
  RM.appEvidence = (d) => {
    if (d.app) {
      const L = WS.levels;
      const silver = d.app.filter((id) => L.state(id).stars[0].s).length;
      const gold = d.app.filter((id) => L.goldCount(L.state(id)) > 0).length;
      return { kind: 'levels', total: d.app.length, silver, gold };
    }
    if (d.ear && WS.ear) {
      const g = WS.ear.def(d.ear[0]);
      if (!g) return null;
      const passed = g.levels.filter((_, i) => WS.ear.levelState(g.id, i).passed).length;
      return { kind: 'ear', total: g.levels.length, passed, game: g };
    }
    return null;
  };

  RM.phaseProgress = (n) => {
    const ph = PHASES.find((p) => p.n === n);
    const drills = D.filter((d) => d.phase === n);
    const passed = drills.filter((d) => RM.isPassed(d.id)).length;
    const checks = ph.checks.filter((c) => RM.isChecked(c.id)).length;
    const total = drills.length + ph.checks.length;
    return { drills: drills.length, passed, checks, checkTotal: ph.checks.length, pct: total ? Math.round(((passed + checks) / total) * 100) : 0 };
  };

  /* The phase you're actually in: the first one whose milestones aren't all ticked. */
  RM.currentPhase = () => {
    for (const ph of PHASES) if (!ph.checks.every((c) => RM.isChecked(c.id))) return ph.n;
    return 4;
  };
})();
