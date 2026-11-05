# Woodshed build notes

Woodshed is Lucas's piano practice app: the Piano Roadmap turned into a daily, graded, gamified plan. This file is the hand-off between build sessions. **The source of truth is the GitHub repo `lucasspills/woodshed`**; the app is live at https://lucasspills.github.io/woodshed/ (GitHub Pages, deployed from the root of `main`).

- Current version: **0.3.0**, built 4 Nov 2026
- Spec: https://claude.ai/artifact/TkvLt3HvgLwMvznjeEUFAz
- Research report: https://claude.ai/artifact/JzywSTrUWhy72GXMzHQSEA
- Roadmap with Drill Library: https://claude.ai/artifact/Jzs5ehfYj11s1ZMvP1yaB6

## Continuing the build

1. Attach the repo (`lucasspills/woodshed`) and clone it.
2. Make the change in `src/` (and `tools/` for sounds), add tests.
3. `python3 build.py && python3 tests/logic.py && python3 tests/smoke.py && python3 tests/play.py`, and look at the screenshots in `tests/shots/`.
4. Commit and push to `main`. Pages redeploys in a minute or two; the app picks up the new version the next time it's opened online.
5. Update this file (also kept in the claude.ai project as `claude/woodshed-build-notes.md`).

Tests serve the repo root over a local web server (`tests/serve.py`) and open `index.html?debug&nosw` (`nosw` skips the service worker). The Play test also checks the service worker and offline mode.

## What the app does

**Tonight.** Opens on tonight's session. It works out the roadmap week from the plan start date and the focus from the weekday: Mon/Thu ear, Tue/Fri harmony, Wed/Sat improv, Sun review. Steps: warm-up (with gold chances), sight-reading and score piece (ticked by hand), then the focus drill. The core (sight-reading plus score piece) counts toward the weekly goal (5 of 7 days) and the streak. A freeze is earned every 7 core days, up to 2, used automatically only when they cover the whole gap. Ranks: Busker 0, Session player 1,500, Soloist 6,000, Virtuoso 20,000 XP.

**Chord Runner**, 12 levels:

| Lane | Levels | Base / target tempo |
| --- | --- | --- |
| Harmony (H1) | Major, Minor, Major + minor, Dim + aug, All four triads | 50/70, 50/70, 55/75, 50/70, 55/80 |
| Harmony (H4) | maj7 + 7, m7 + ø7, °7, All five sevenths | 45/65, 45/65, 45/65, 50/75 |
| Improv (I1) | Shells shape A, shape B, both shapes (ii–V–I, clicks on 2 and 4) | 50/80, 50/80, 55/80 |

- 12 chords per round, one per bar after a one-bar count-in; 11 hits pass.
- Key pool starts with C, F, B♭; each pass adds 3 keys (C F B♭ E♭ A♭ D♭ G♭ B E A D G).
- Tempo staircase (full pool): 3 clean rounds raise by 8 BPM (4 after two reversals), a fail lowers by the same, floor base − 15.
- Stars: ★1 pass with all 12 keys at base, ★2 pass at target, ★3 flawless at target. Silver any time (unlocks the next level); gold only on the cold check (first round of the day, on a later day than the silver).
- XP: 2 per hit, +10 pass, +50 silver, +100 gold, +30 core day, +100 weekly goal; a fully gold level pays 25%.
- Grading: exact pitch-class set (any inversion, extra notes fail); shells are two keys, root on the bottom, guide tone within an octave, below middle C. Window ½ beat early, ¼ beat late; perfect within 8% of a beat (min 60 ms), judged on the audio clock minus the calibration offset.

**Play (0.3).** Free play with nine sounds, a split, or a layer.
- **Sounds** (`src/js/37-sounds.js` catalog; samples in `sounds/<id>/`, made by `tools/make_sounds.py`):

  | id | Name | Source (license) | Bands | Files |
  | --- | --- | --- | --- | --- |
  | salamander | Salamander Grand | Salamander V3, Yamaha C5 (CC BY 3.0) | 3 | 90 |
  | steinway | Steinway Grand | Splendid Grand Piano (public domain) | 4 | 102 |
  | kawai | Kawai Grand | VCSL Kawai grand (CC0) | 3 | 78 |
  | upright | Upright Piano | VCSL Knight upright (CC0) | 2 | 46 |
  | honkytonk | Honky-Tonk | Old Piano FB, freepats (CC0) | 1 | 28 |
  | rhodes | Rhodes | jRhodes3d, Mark I Stage 73 (CC0) | 3 | 44 |
  | wurlitzer | Wurlitzer | Greg Sullivan's EP200 (CC BY 3.0) | 4 | 46 |
  | bass | Bass | Growly Bass, Squier Jazz Bass (CC0); sounds an octave below the keys | 3 | 42 |
  | pad | Synth Pad | generated live in Web Audio (`36-pad.js`) | – | – |

  About 20 MB of Opus in total. One sample per minor third at most for the dense sets, trimmed by register, faded, Opus 64 kbps (48 kbps mono). Loudness is matched to the Salamander: one gain per velocity band so soft-to-loud follows the Salamander's curve (most sources had normalized layers); the Salamander itself is untouched. Small extra trims live in the catalog (`trim` dB). The tool also pitch-checks every file; the only flags are the top octave (detector limits) and the bass (an octave down, by design).
- **Engine** (`35-sampler.js`): files load on demand (middle band first, so a sound is playable within a moment), decode, attack trimmed (first point above 2% of the early peak, minus 1.5 ms). Velocity → touch curve (light 0.7 / normal 1 / heavy 1.45 exponent) → two neighbouring bands blended equal-power, plus gain within a band (`minGain`, default 0.42). Pedal, re-strike damping (60 ms), no dampers from F6 up on the pianos, 72 voices. Only the most recently used instruments stay decoded (700 MB budget).
- **Rig** (`37-sounds.js`, `WS.rig`): `single`, `split` (left/right instrument and split point; "Set split point" takes the next key pressed and doesn't sound it) or `layer` (two instruments on every key, equal-power mix). The bass ignores the sustain pedal, so in a split the pedal holds only the right hand.
- **Output** (`WS.out`): every Play sound and the drills' grand share one path: dry + reverb (generated impulses: Room 1.3 s, Hall 3.4 s with a 22 ms predelay; Dry = no reverb; amount slider) → volume → zero-latency soft clipper → speakers. No compressor (it looks ahead). `latencyHint: 0`; latency readout warns on Bluetooth.
- **Drills and lessons** always use the Salamander Grand (`WS.piano`), following Keyboard → "Piano sound in drills".

**Installable and offline (0.3).** `manifest.webmanifest` + icons (`tools/make_icons.py`) let Chrome install it as an app. `sw.js` (written by `build.py` with a content version) fetches the page network-first, so updates arrive on the next online open, and keeps every sound file cache-first after its first load. Sound URLs carry a per-instrument version (`WS.SOUND_VERSION`) so rebuilt sounds are fetched again.

**Other screens.** Keyboard (Web MIDI connect, hot-plug, 88-key test, computer-keys fallback: Z row from C3, Q row from C4, −/= octaves, space = pedal in Play; calibration tap test). Progress (12-week calendar, accuracy by quality and root, most-missed chords, recent rounds). Settings (plan start week, metronome, backup export/restore, reset).

**Storage.** One JSON state object in IndexedDB (localStorage fallback), `navigator.storage.persist()`. Each address keeps its own data: export a backup from the old file and restore it on the hosted app.

**Palette.** Dust Grey #DAD7CD, Dry Sage #A3B18A, Fern #588157, Hunter Green #3A5A40, Pine Teal #344E41, page #1E2C25.

## Files

```
index.html, sw.js, manifest.webmanifest, .nojekyll   built by build.py (committed: Pages serves them)
src/index.html        page shell (<!--STYLE--> and <!--SCRIPT--> filled by build.py)
src/styles.css        all styles
src/js/00-core.js     namespace WS, DOM helpers, event bus, dates
src/js/10-theory.js   spelling, chord qualities, shells, matching, naming
src/js/20-store.js    IndexedDB state, export/import
src/js/30-audio.js    AudioContext, heard-time clock, metronome, sfx, fallback synth, note routing
src/js/35-sampler.js  shared output (rooms, clipper) and the sampled-instrument engine
src/js/36-pad.js      the generated synth pad
src/js/37-sounds.js   instrument catalog, memory budget, WS.piano, the Play rig
src/js/40-input.js    Web MIDI + computer keys -> noteon/noteoff/pedal
src/js/50-levels.js   levels, prompts, staircase, stars, XP
src/js/55-progress.js core days, weekly goal, streak, ranks, tonight's plan
src/js/60-runner.js   Chord Runner engine and drawing
src/js/70-ui.js       screens (Play has the sound picker, split, layer, rooms)
src/js/90-main.js     boot, routing, service worker, debug hooks
src/fonts/            Kalam 700, Atkinson Hyperlegible 400/700 (OFL 1.1)
sounds/<id>/          <root>-<band>.webm + zones.json per instrument
icons/                app icons
tools/make_sounds.py  downloads sources (danigb/samples on GitHub, npm) into .cache/ and builds sounds/
tools/make_icons.py   renders icons/ with headless Chromium
tests/                logic.py (in-page logic), smoke.py (end to end), play.py (sounds, split, layer, rooms, offline)
```

## Next builds

0. **Improv Coach ("Idea of the Day")**, the next priority. Pick a progression and key; backing loop (bass plus soft chords) at a chosen tempo, which can now use the Bass and Rhodes/pad sounds; chord names and numbers as they go by; one challenge, checked over MIDI, with XP. Progression bank: 1-5-6-4, 6-4-1-5, 1-6-4-5, 1-4-5, major 2-5-1 and 2-5-1-6, minor 2-5-1, minor walk-down 1–♭7–♭6–5, and songs he's learning (Stand By Me, Let It Be, Für Elise). Challenges: borrowed iv / ♭VI / ♭VII, raised 7th over V in minor, sus4 resolving to 3, approach notes, the loop around the circle of fifths, voice-leading score, call-and-response. Settings: key, tempo, progression, difficulty, "surprise me".
1. **Note Rain + generated sight-reading** (research report §3).
2. **Score Quest:** MusicXML import with OpenSheetMusicDisplay, Prepare and Assess modes.
3. **Ear and improv games:** Echo, Bass Detective, Lick Ladder, Jam Session.
4. **Coach and review:** FSRS for facts, expanding intervals for motor skills, coach rules, checkpoint tests.
5. **Rewards polish:** achievements, weekly ghost, phase bosses.

## Known limits

- Bluetooth headphones add roughly 150–250 ms no app can remove. Wired headphones (what Lucas uses now) or the Mac speakers.
- Pedalled bass notes stop at their trimmed length (9 s low, 7 s up to B3; electric pianos 5–6 s).
- The Kawai's soft layer is boosted about 21 dB to match (the VCSL recordings are quiet), so it may carry a little hiss.
- Sound levels were matched by measurement, not by ear; trims are easy to adjust in the catalog.
- Computer-keys mode can drop the third or fourth key of a chord on laptop keyboards.
- The Reading and Ear lanes are placeholders.

## Changelog

- **0.3.0 (4 Nov 2026):** Hosted on GitHub Pages and installable, with offline support. Nine Play sounds (Salamander, Steinway, Kawai, Upright, Honky-Tonk, Rhodes, Wurlitzer, Bass, Synth Pad), loaded on demand and cached. Split mode (two sounds, settable split point) and Layer mode (two sounds stacked, mix slider). Room presets Dry / Room / Hall plus amount. New sound test suite.
- **0.2.0 (4 Nov 2026):** Play mode with the sampled grand piano; new palette.
- **0.1.0 (27 Oct 2026):** first build. Tonight plan, path, Chord Runner (12 levels), stars, staircase, keyboard setup and calibration, progress, backups.
