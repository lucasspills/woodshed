"""Logic tests run inside the page: staircase, key pool, stars, freezes, weekly goal, chord matching."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import serve  # noqa: E402

BASE, _srv = serve.start()
URL = BASE + "index.html?debug&nosw"

JS = r"""
async () => {
  const out = [];
  const ok = (cond, msg) => out.push([!!cond, msg]);
  await WS.store.reset();
  const L = WS.levels, P = WS.progress, T = WS.theory;

  // ---- chord matching
  const C = T.chord(0, 'maj');
  ok(T.matches(C, [60, 64, 67]), 'C major root position matches');
  ok(T.matches(C, [52, 60, 67, 72]), 'C major inversion with doubling matches');
  ok(!T.matches(C, [60, 64, 67, 70]), 'extra B-flat fails');
  ok(!T.matches(C, [60, 64]), 'missing G fails');
  const sh = T.shell(0, 'ii', 'A'); // Dm7 shell A: D + C
  ok(sh.sym === 'Dm7' && sh.guideName === 'C', 'shell A on ii in C is Dm7, root + 7th (C)');
  ok(T.matches(sh, [38, 48]), 'D2 + C3 is a valid shell');
  ok(!T.matches(sh, [50, 60]), 'shell reaching middle C fails (must stay below)');
  ok(!T.matches(sh, [48, 50]), 'C under D (root not on the bottom) fails');
  const shB = T.shell(6, 'V', 'B'); // key G-flat, V = D-flat 7, shape B -> root + 7th (C-flat)
  ok(shB.sym === 'D♭7', 'key of G♭: V chord is D♭7');
  ok(T.shell(11, 'ii', 'A').sym === 'C♯m7', 'key of B: ii chord is C♯m7');
  ok(T.chord(3, 'min7').tones.join(' ') === 'E♭ G♭ B♭ D♭', 'E♭m7 spelled E♭ G♭ B♭ D♭');
  ok(T.chord(1, 'min').sym === 'C♯m', 'minor chord on pc 1 spelled C♯m');
  const id = T.identify([64, 67, 72]);
  ok(id && id.label === 'C' && id.detail.includes('first inversion'), 'identify E-G-C as C major, first inversion');

  // ---- key pool and staircase
  const id1 = 'h1-maj';
  const d = L.def(id1);
  const res = (hits) => ({ n: 12, hits, perfects: hits, results: Array.from({length: 12}, (_, i) => ({ hit: i < hits, perfect: i < hits, offsetMs: 0 })), misses: [], meanOffsetMs: 0, durationSec: 60 });
  let plan = L.planRound(id1); L.applyRound(plan, res(12));
  ok(L.state(id1).pool === 6, 'passed round with 3 keys adds 3 more (pool 6)');
  ok(!L.state(id1).stars[0].s, 'no star while the pool is under 12 keys');
  plan = L.planRound(id1); L.applyRound(plan, res(12));
  plan = L.planRound(id1); L.applyRound(plan, res(12));
  ok(L.state(id1).pool === 12, 'pool reaches 12 after three passes');
  const t0 = L.state(id1).tempo;
  plan = L.planRound(id1); let o = L.applyRound(plan, res(11));
  ok(o.passed && L.state(id1).stars[0].s, '11 of 12 with all keys at base tempo earns silver star 1');
  ok(!L.state(id1).stars[1].s, 'star 2 needs the target tempo');
  plan = L.planRound(id1); L.applyRound(plan, res(12));
  plan = L.planRound(id1); L.applyRound(plan, res(12));
  ok(L.state(id1).tempo === t0 + 8, 'three clean rounds raise the tempo by 8 (first steps)');
  plan = L.planRound(id1); L.applyRound(plan, res(9));
  ok(L.state(id1).tempo === t0, 'a failed round lowers it again');
  ok(L.state(id1).reversals === 1, 'a direction change counts as a reversal');

  // ---- challenge round for star 2, then gold the next day
  plan = L.planRound(id1, 'challenge');
  ok(plan.tempo === d.target && plan.challenge, 'challenge round runs at the target tempo');
  const before = L.state(id1).tempo;
  o = L.applyRound(plan, res(12));
  ok(L.state(id1).stars[1].s && L.state(id1).stars[2].s, 'flawless challenge earns silver stars 2 and 3');
  ok(L.state(id1).tempo === before, 'challenge rounds leave the staircase alone');
  ok(!L.coldReady(id1), 'no cold check on the same day');

  WS.dayOffset = 1;
  ok(L.coldReady(id1), 'next day: cold check is ready');
  ok(L.coldTempo(id1) === d.target, 'cold check runs at the target tempo when star 2 is silver');
  plan = L.planRound(id1);
  ok(plan.cold && plan.pool === 12, 'first round of the day is the cold check, with all 12 keys');
  L.state(id1).lastPlayed = WS.todayKey();
  o = L.applyRound(plan, res(11));
  ok(L.state(id1).stars[0].g && L.state(id1).stars[1].g && !L.state(id1).stars[2].g, 'cold pass (11/12) turns stars 1 and 2 gold, not the flawless star');
  ok(o.coldResult === 'gold', 'cold result reported as gold');
  ok(!L.coldReady(id1), 'only one cold check per level per day');
  plan = L.planRound(id1);
  ok(!plan.cold, 'second round that day is a normal round');

  WS.dayOffset = 2;
  plan = L.planRound(id1);
  ok(plan.cold, 'day after: another cold chance for the remaining star');
  L.state(id1).lastPlayed = WS.todayKey();
  o = L.applyRound(plan, res(10));
  ok(!L.state(id1).stars[2].g && o.coldResult === 'missed', 'a failed cold check gives no gold');

  // ---- unlocks
  ok(L.isUnlocked('h1-min'), 'silver star 1 on major triads unlocks minor triads');
  ok(!L.isUnlocked('h1-mix'), 'the level after that stays locked');

  // ---- XP for mastered levels is reduced
  L.state(id1).stars.forEach(s => { s.s = s.s || WS.todayKey(); s.g = s.g || WS.todayKey(); });
  plan = L.planRound(id1); o = L.applyRound(plan, res(12));
  ok(o.xp === Math.round((24 + 10) * 0.25), 'replaying a fully gold level pays a quarter of the XP');

  // ---- core days, weekly goal, streak and freezes
  WS.dayOffset = 0;
  await WS.store.reset();
  const today = WS.todayKey();
  const s = WS.S();
  P.setTask(today, 'sight', true);
  ok(!P.day(today).core, 'sight-reading alone is not the core');
  P.setTask(today, 'score', true);
  ok(P.day(today).core && s.xp === 30, 'sight-reading + score piece = core (+30 XP)');
  P.setTask(today, 'score', false);
  ok(!P.day(today).core && s.xp === 0, 'unticking removes the core and its XP');

  await WS.store.reset();
  const S2 = WS.S();
  // Core on days -4, -3, -2; missed day -1; one freeze available
  [-4, -3, -2].forEach(k => { const dd = P.day(WS.addDays(today, k)); dd.sight = dd.score = dd.core = true; });
  S2.freezes = 1;
  P.applyFreezes();
  ok(P.day(WS.addDays(today, -1)).freeze && S2.freezes === 0, 'a freeze covers the one missed day');
  ok(P.streak() === 4, 'streak counts the frozen day (4)');

  await WS.store.reset();
  const S3 = WS.S();
  [-5, -4].forEach(k => { const dd = P.day(WS.addDays(today, k)); dd.core = true; });
  S3.freezes = 2;
  P.applyFreezes();
  ok(S3.freezes === 2 && !P.day(WS.addDays(today, -1)).freeze, 'freezes are kept when they can’t cover the whole gap (3 days)');
  ok(P.streak() === 0, 'streak resets after an uncovered gap');

  await WS.store.reset();
  const mon = WS.mondayOf(today);
  for (let i = 0; i < 5; i++) { const k = WS.addDays(mon, i); P.setTask(k, 'sight', true); P.setTask(k, 'score', true); }
  ok(WS.S().weeksAwarded[mon] === true, 'five core days in a week award the weekly goal');
  ok(WS.S().xp === 5 * 30 + 100, 'weekly goal adds 100 XP');

  // Freeze earning
  await WS.store.reset();
  for (let i = 1; i <= 7; i++) { const k = WS.addDays(today, -i - 20); P.setTask(k, 'sight', true); P.setTask(k, 'score', true); }
  ok(WS.S().freezes === 1, 'seven core days earn a freeze');

  // ---- prompts: no identical neighbours, all 12 roots with a full pool
  await WS.store.reset();
  L.state('h1-mix').pool = 12;
  let clean = true, roots = true;
  for (let r = 0; r < 200; r++) {
    const ps = L.makePrompts('h1-mix');
    for (let i = 1; i < ps.length; i++) if (ps[i].pcs.join() === ps[i - 1].pcs.join()) clean = false;
    if (new Set(ps.map(p => p.root)).size !== 12) roots = false;
  }
  ok(clean, 'no two identical chords in a row (200 rounds)');
  ok(roots, 'every round with a full pool covers all 12 roots');
  const shells = L.makePrompts('i1-a');
  ok(shells.length === 12 && shells.every((p, i) => p.role === ['ii', 'V', 'I'][i % 3]), 'shell rounds are four ii–V–I progressions');

  // ---- tonight plan
  WS.S().settings.planStart = WS.mondayOf(today);
  const tn = P.tonight(today);
  ok(tn.week === 1, 'week 1 when the plan starts this Monday');

  // ---- the Play rig: which instrument each key goes to
  const st = WS.S().settings, R = WS.rig;
  st.soundMode = 'single'; st.sound = 'rhodes';
  ok(R.parts().length === 1 && R.parts()[0].id === 'rhodes', 'one-sound mode uses the picked instrument');
  st.soundMode = 'split'; st.splitLo = 'bass'; st.splitHi = 'kawai'; st.splitPoint = 55;
  const sp = R.parts();
  ok(sp[0].id === 'bass' && sp[0].hi === 54 && sp[1].id === 'kawai' && sp[1].lo === 55, 'split: bass below the split point, Kawai from it up');
  st.soundMode = 'layer'; st.layerA = 'salamander'; st.layerB = 'pad'; st.layerMix = 0.5;
  const lp = R.parts();
  ok(lp.length === 2 && Math.abs(lp[0].level - lp[1].level) < 1e-9 && Math.abs(lp[0].level ** 2 + lp[1].level ** 2 - 1) < 1e-9, 'layer at 50% mixes both at equal power');
  st.layerB = 'salamander';
  ok(R.parts().length === 1, 'layering a sound with itself plays it once');
  ok(Object.keys(WS.ZONES).length === 8 && WS.sounds.INSTRUMENTS.length === 9, '8 sampled instruments plus the synth pad');
  for (const d of WS.sounds.INSTRUMENTS) if (!d.synth) ok(WS.ZONES[d.id] && WS.ZONES[d.id].bands >= 1, `${d.name} has its sample map`);
  await WS.store.reset();
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    pg.wait_for_selector(".page-title")
    results = pg.evaluate(JS)
    b.close()

fails = 0
for passed, msg in results:
    print(("PASS " if passed else "FAIL ") + msg)
    fails += 0 if passed else 1
for e in errs:
    print("PAGE ERROR", e)
    fails += 1
print(f"\n{len(results) - fails} passed, {fails} failed")
sys.exit(1 if fails else 0)
