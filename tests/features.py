"""0.4 features: roadmap, metronome, practice log and insights, ear games, recordings, achievements."""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import serve  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BASE, _srv = serve.start()
URL = BASE + "index.html?debug&nosw"
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tests" / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
errors = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        errors.append(msg)


def st(pg):
    return pg.evaluate("WS.debug.state()")


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))
    pg.goto(URL + "#tonight")
    pg.wait_for_selector(".page-title")
    pg.click("text=Skip for now")

    # ---------------- Roadmap ----------------
    pg.goto(URL + "#roadmap")
    pg.wait_for_selector(".phase-tabs")
    n_drills = pg.evaluate("WS.roadmap.DRILLS.length")
    check(n_drills >= 60, f"the roadmap has every drill card ({n_drills})")
    weeks = pg.evaluate("[1, 12, 13, 20, 26, 27, 40, 52].map((w) => !!WS.roadmap.weekRow(w))")
    check(all(weeks), "the week-by-week schedule covers weeks 1 to 52")
    bad = pg.evaluate("WS.roadmap.WEEKS.flatMap((r) => Object.values(r.codes)).filter((c) => !WS.roadmap.drill(c))")
    check(bad == [], f"every scheduled drill code has a card {bad}")
    check(pg.locator(".tw-cell").count() == 6, "this week shows all six slots")
    pg.screenshot(path=str(SHOTS / "30-roadmap.png"), full_page=True)
    pg.click(".drill-card >> text=Triad qualities")
    pg.wait_for_selector(".sheet .drill-steps")
    check(pg.locator(".sheet .drill-table").count() == 1, "the H1 card shows its chord table")
    pg.screenshot(path=str(SHOTS / "31-drill-card.png"))
    pg.click(".sheet >> text=Mark passed")
    check("H1" in st(pg)["roadmap"]["passed"], "marking H1 passed saves it")
    pg.locator(".milestones .check").first.click()
    check(len(st(pg)["roadmap"]["checks"]) == 1, "ticking a milestone saves it")
    pp = pg.evaluate("WS.roadmap.phaseProgress(1)")
    check(pp["passed"] == 1 and pp["checks"] == 1 and pp["pct"] > 0, f"phase progress counts both {pp}")
    pg.click(".phase-tab >> text=Clair de Lune")
    pg.wait_for_selector("text=Phase 3: Clair de Lune")
    check(pg.locator(".drill-card >> text=Clair de Lune").count() >= 1, "phase 3 lists Clair de Lune")
    # Tonight beyond week 12 still has a plan
    tn = pg.evaluate("(() => { WS.S().settings.planStart = WS.addDays(WS.mondayOf(WS.todayKey()), -7 * 19); const t = WS.progress.tonight(); WS.S().settings.planStart = WS.mondayOf(WS.todayKey()); return { week: t.week, phase: t.phase, drill: t.drill, code: t.code }; })()")
    check(tn["week"] == 20 and tn["phase"] == 2 and tn["drill"], f"week 20 gets a phase 2 plan {tn}")

    # ---------------- Metronome ----------------
    pg.goto(URL + "#metronome")
    pg.wait_for_selector(".metro-go")
    pg.click(".preset-load >> text=7/8 (2 + 2 + 3)")
    cfg = pg.evaluate("WS.metro.cfg()")
    check(cfg["seq"][0]["beats"] == 7 and cfg["seq"][0]["unit"] == 8 and cfg["bpm"] == 200, "loading a 7/8 preset sets the pattern")
    pg.click(".preset-load >> text=Straight 4/4")
    pg.evaluate("WS.metro.setBpm(120)")
    pg.click(".metro-go")
    pg.wait_for_timeout(1300)
    lit = pg.locator(".beat.lit").count()
    check(lit == 1, "a beat lights up while it runs")
    # Play along exactly on the clicks for a few seconds
    pg.evaluate("""(() => {
      const A = WS.audio; const done = new Set(); let n = 0;
      const t = setInterval(() => {
        const now = A.heardNow();
        for (const c of WS.metro._clicks) if (!done.has(c) && now >= c && now - c < 0.01) { done.add(c); WS.input.inject(60 + (n++ % 2) * 7, true, performance.now()); setTimeout(() => WS.input.inject(60 + ((n - 1) % 2) * 7, false, performance.now()), 80); }
        if (n >= 14) clearInterval(t);
      }, 1);
    })()""")
    pg.wait_for_timeout(8500)
    tsum = pg.evaluate("WS.metro.timingSummary()")
    print("timing:", tsum)
    check(tsum is not None and abs(tsum["mean"]) < 15, "the timing check reads notes on the click as on time")
    pg.screenshot(path=str(SHOTS / "32-metronome.png"), full_page=True)
    pg.keyboard.press("ArrowUp")
    check(pg.evaluate("WS.metro.cfg().bpm") == 121, "arrow up nudges the tempo")
    pg.keyboard.press("Space")
    pg.wait_for_timeout(200)
    check(not pg.evaluate("WS.metro.running"), "space stops it")
    check(pg.evaluate("WS.S().metroStats.totalSecs > 5"), "metronome time is recorded")
    # Tempo trainer: fast run
    pg.evaluate("(() => { const c = WS.metro.cfg(); c.trainer = { on: true, step: 10, every: 1, max: 150 }; WS.metro.setBpm(240); WS.metro.cfg().trainer.max = 260; })()")
    pg.evaluate("WS.metro.start()")
    pg.wait_for_timeout(2600)
    bpm_now = pg.evaluate("WS.metro.curBpm()")
    pg.evaluate("WS.metro.stop(); WS.metro.cfg().trainer.on = false")
    check(bpm_now > 240, f"the tempo trainer raises the tempo ({bpm_now})")

    # ---------------- Practice log + Tonight ----------------
    pg.goto(URL + "#stats")
    pg.wait_for_selector(".session-card")
    pg.click(".session-card >> text=Log practice away from the app")
    pg.wait_for_selector("#log-min")
    pg.fill("#log-min", "25")
    pg.click(".area-chips >> text=Sight-reading")
    pg.click(".area-chips >> text=Score piece")
    pg.fill("#log-piece", "Gymnopedie bars 1-8")
    pg.click(".rate-b >> text=4")
    pg.click("text=Save to the log")
    pg.wait_for_timeout(300)
    s = st(pg)
    check(len(s["log"]) == 1 and s["log"][0]["minutes"] == 25 and s["log"][0]["rating"] == 4, "the session is logged")
    today = pg.evaluate("WS.todayKey()")
    check(s["days"][today]["core"], "logging sight-reading and score ticks the core on Tonight")
    check("first-core" in s["ach"] and "log-first" in s["ach"], "achievements unlock for the first core and first log")
    pg.wait_for_selector(".log-row")
    pg.screenshot(path=str(SHOTS / "33-stats.png"), full_page=True)
    ins = pg.evaluate("WS.log.insights().map((x) => x.text)")
    print("insights:", ins)
    check(len(ins) >= 1, "insights have something to say")

    # ---------------- Ear games ----------------
    pg.goto(URL + "#ear")
    pg.wait_for_selector(".ear-games")
    pg.screenshot(path=str(SHOTS / "34-ear.png"), full_page=True)
    pg.click(".ear-card:has-text('Chord Quality') .ear-level >> nth=0")
    pg.wait_for_selector(".ear-stage")
    for i in range(10):
        pg.wait_for_function("WS.ui._ear && WS.ui._ear.phase === 'answer'", timeout=15000)
        if i == 3:
            pg.screenshot(path=str(SHOTS / "35-ear-question.png"))
        pg.evaluate(f"WS.debug.earAnswer({'false' if i == 9 else 'true'})")
        pg.wait_for_function("WS.ui._ear.phase === 'done'", timeout=5000)
        pg.keyboard.press("Enter")
    pg.wait_for_selector(".ear-summary", timeout=10000)
    pg.screenshot(path=str(SHOTS / "36-ear-summary.png"))
    s = st(pg)
    check(s["ear"]["quality"]["0"]["passed"], "9 of 10 passes Chord Quality level 1")
    check(s["earRounds"][-1]["score"] == 9, "the ear round is saved with its score")
    check(pg.evaluate("WS.ear.isUnlocked('quality', 1)"), "passing opens the next level")
    # Echo: one right answer by playing the notes, one wrong
    pg.click("text=All ear games")
    pg.click(".ear-card:has-text('Echo') .ear-level >> nth=0")
    pg.wait_for_function("WS.ui._ear && WS.ui._ear.phase === 'answer'", timeout=20000)
    pg.evaluate("WS.debug.earAnswer(true)")
    pg.wait_for_function("WS.ui._ear.phase === 'done'", timeout=5000)
    check("ok" in pg.get_attribute(".ear-prompt", "class"), "playing the melody back is marked right")
    pg.keyboard.press("Enter")
    pg.wait_for_function("WS.ui._ear.phase === 'answer'", timeout=20000)
    pg.evaluate("WS.debug.earAnswer(false)")
    pg.wait_for_function("WS.ui._ear.phase === 'done'", timeout=5000)
    check("no" in pg.get_attribute(".ear-prompt", "class"), "wrong notes are marked wrong")
    # Degrees and Bass Detective generate valid questions
    qs = pg.evaluate("""(() => { const out = []; for (const g of WS.ear.GAMES) g.levels.forEach((_, i) => { for (let k = 0; k < 30; k++) { const q = WS.ear.makeQuestion(g.id, i); out.push(q.answer.length === q.len || g.id === 'quality'); } }); return out.every(Boolean); })()""")
    check(qs, "every ear level makes well-formed questions")

    # ---------------- Recordings ----------------
    pg.goto(URL + "#play")
    pg.wait_for_selector(".rec-btn")
    pg.click(".rec-btn")
    pg.evaluate("""(() => { const t = performance.now(); [[60,0],[64,150],[67,300]].forEach(([n,d]) => { setTimeout(() => WS.input.inject(n, true, performance.now(), 90), d); setTimeout(() => WS.input.inject(n, false, performance.now()), d + 400); }); })()""")
    pg.wait_for_timeout(1000)
    pg.click(".rec-btn")
    recs = st(pg)["recordings"]
    check(len(recs) == 1 and recs[0]["notes"] == 3, "a recording saves the three notes played")
    mid = pg.evaluate("Array.from(WS.recorder.toMidi(WS.recorder.list()[0]).slice(0, 4))")
    check(bytes(mid) == b"MThd", "the MIDI export is a standard MIDI file")
    with pg.expect_download() as dl:
        pg.click(".rec-row [title='Download .mid']")
    check(dl.value.suggested_filename.endswith(".mid"), "download gives a .mid file")
    before = st(pg)["activity"][today]["notes"]
    seen = pg.evaluate("""new Promise((res) => { const got = []; const un = WS.bus.on('noteon', (e) => { if (e.src === 'playback') got.push(e.n); }); WS.recorder.play(WS.recorder.list()[0].id, () => { un(); res(got); }); })""")
    check(seen == [60, 64, 67], f"playback replays the notes in order {seen}")
    check(st(pg)["activity"][today]["notes"] == before, "playback isn't counted as practice")
    pg.screenshot(path=str(SHOTS / "37-play-recordings.png"), full_page=True)

    # ---------------- Trophies ----------------
    pg.goto(URL + "#trophies")
    pg.wait_for_selector(".trophies")
    on = pg.locator(".trophy.on").count()
    check(on >= 4, f"unlocked trophies show in the case ({on})")
    pg.screenshot(path=str(SHOTS / "38-trophies.png"), full_page=True)

    # ---------------- Mobile ----------------
    mp = ctx.new_page()
    mp.set_viewport_size({"width": 390, "height": 844})
    for v in ["roadmap", "metronome", "stats", "ear", "trophies"]:
        mp.goto(URL + "#" + v)
        mp.wait_for_selector(".page-title")
        mp.wait_for_timeout(200)
        w = mp.evaluate("document.documentElement.scrollWidth")
        check(w <= 392, f"no horizontal scroll on {v} at phone width ({w})")
    mp.goto(URL + "#metronome")
    mp.wait_for_selector(".metro-go")
    mp.screenshot(path=str(SHOTS / "39-metronome-mobile.png"), full_page=True)
    browser.close()

print()
if errors:
    print(f"{len(errors)} problem(s):")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("ALL CHECKS PASSED")
