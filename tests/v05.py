"""0.5: staff notation and score in Chord Runner, automatic practice log with the one-tap question."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
import serve  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BASE, _srv = serve.start()
URL = BASE + "index.html?debug&nosw"
SHOTS = ROOT / "tests" / "shots"
SHOTS.mkdir(parents=True, exist_ok=True)
errors = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        errors.append(msg)


with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))
    pg.goto(URL + "#tonight")
    pg.wait_for_selector(".page-title")
    pg.click("text=Skip for now")

    # Notation: spelled notes land on the right lines
    v = pg.evaluate("WS.notation.chordVoicing(WS.theory.chord(3, 'min7'))")
    check([n["name"] for n in v["notes"]] == ["E♭", "G♭", "B♭", "D♭"] and v["notes"][0]["pos"] == 30, f"E♭m7 is spelled E♭ G♭ B♭ D♭ from E4 {v}")
    sh = pg.evaluate("WS.notation.shellVoicing(WS.theory.shell(0, 'ii', 'A'))")
    check(sh["clef"] == "bass" and [n["name"] for n in sh["notes"]] == ["D", "C"] and sh["notes"][1]["pos"] - sh["notes"][0]["pos"] == 6, f"Dm7 shell A is D + C a 7th up in the bass {sh}")

    for view in ["both", "staff", "names"]:
        pg.evaluate(f"WS.S().settings.crView = '{view}'")
        pg.evaluate("WS.debug.tempo && WS.debug.tempo(160)")
        pg.evaluate("WS.ui.startGame('h1-maj', 'normal')")
        pg.wait_for_timeout(2600)
        staff = pg.locator(".hud-staff svg").count()
        sym = pg.locator(".hud-sym .sym").count() if pg.locator(".hud-sym .sym").count() else pg.locator(".hud-sym > *:not(.hud-done)").count()
        check((staff == 1) == (view != "names"), f"{view}: staff shown = {staff == 1}")
        check((sym >= 1) == (view != "staff"), f"{view}: chord name shown = {sym >= 1}")
        pg.screenshot(path=str(SHOTS / f"40-runner-{view}.png"))
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(300)

    # Score and best score
    pg.evaluate("WS.S().settings.crView = 'both'")
    pg.evaluate("WS.ui.startGame('h1-maj', 'normal')")
    pg.wait_for_timeout(300)
    pg.evaluate("WS.debug.autoplay()")
    pg.wait_for_selector(".summary", timeout=90000)
    sc = pg.inner_text(".ss-num")
    best = pg.evaluate("WS.levels.state('h1-maj').bestScore")
    check(best and best > 1200, f"a clean round scores with the multiplier ({sc}, best {best})")
    check("First score" in pg.inner_text(".sum-score") or "New best" in pg.inner_text(".sum-score"), "the summary calls out the best score")
    pg.screenshot(path=str(SHOTS / "41-runner-summary.png"))
    pg.keyboard.press("Escape")

    # Automatic log: play in Play for a while (moving the clock), then go quiet
    pg.goto(URL + "#play")
    pg.wait_for_selector(".rec-btn")
    pg.evaluate("""(() => {
      const base = Date.now(); let k = 0;
      WS._fake = base; WS.nowMs = () => WS._fake;
      for (let i = 0; i < 300; i++) { WS._fake = base + i * 2000; WS.input.inject(60 + (i % 12), true, performance.now()); WS.input.inject(60 + (i % 12), false, performance.now()); }
    })()""")
    s = pg.evaluate("WS.debug.state()")
    check(s["openSession"] and s["openSession"]["active"] > 9 * 60000, "playing opens a session with no buttons pressed")
    pg.wait_for_timeout(1200)
    check(pg.is_visible("#session-pill") and "Practising" in pg.inner_text("#session-pill"), "the rail shows the session")
    pg.evaluate("WS._fake += 11 * 60000")
    pg.wait_for_timeout(16000)
    s = pg.evaluate("WS.debug.state()")
    e = s["log"][-1] if s["log"] else None
    check(e and e["auto"] and e["minutes"] >= 10 and e["areaMin"].get("free") == 10 and e["areaMin"].get("harmony") and e["ask"], f"10 quiet minutes close the session and log it {e and {k: e[k] for k in ('minutes', 'areaMin', 'ask')}}")
    pg.wait_for_selector(".ask-card", timeout=3000)
    pg.screenshot(path=str(SHOTS / "42-ask.png"))
    pg.click(".ask-card >> text=Both of those")
    s = pg.evaluate("WS.debug.state()")
    e = s["log"][-1]
    day = e["day"]
    check({"reading", "score"} <= set(e["areaMin"]) and "free" not in e["areaMin"] and "harmony" in e["areaMin"] and not e["ask"], f"one tap relabels the free play {e['areaMin']}")
    check(s["days"][day]["sight"] and s["days"][day]["score"], "answering ticks sight-reading and score on Tonight")
    # A Chord Runner round inside a session shows up in its summary
    pg.evaluate("WS.nowMs = () => Date.now()")
    pg.evaluate("WS.input.inject(60, true, performance.now()); WS.input.inject(60, false, performance.now())")
    pg.evaluate("WS.ui.startGame('h1-maj', 'normal')")
    pg.wait_for_timeout(300)
    pg.evaluate("WS.debug.autoplay()")
    pg.wait_for_selector(".summary", timeout=90000)
    pg.keyboard.press("Escape")
    did = pg.evaluate("WS.log.describe(WS.log.session.did)")
    check("Major triads" in did, f"the session knows what you played ({did})")
    pg.goto(URL + "#stats")
    pg.wait_for_selector(".session-card")
    pg.screenshot(path=str(SHOTS / "43-stats-auto.png"), full_page=True)
    b.close()

print()
if errors:
    print(f"{len(errors)} problem(s):")
    [print(" -", x) for x in errors]
    sys.exit(1)
print("ALL CHECKS PASSED")
