"""End-to-end smoke test for Woodshed with simulated MIDI input (uses the ?debug hooks)."""
import json
import re
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


def wait_summary(page, timeout=60):
    page.wait_for_selector(".summary", timeout=timeout * 1000)


def state(page):
    return page.evaluate("WS.debug.state()")


with sync_playwright() as p:
    browser = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page = ctx.new_page()
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))

    page.goto(URL + "#tonight")
    page.wait_for_selector(".page-title")
    info = page.evaluate("({secure: window.isSecureContext, midi: typeof navigator.requestMIDIAccess, backend: WS.store.backend})")
    print("env:", info)
    check(info["secure"] is True, "the page is a secure context")
    check(info["midi"] == "function", "Web MIDI API is present")
    page.wait_for_timeout(400)
    page.screenshot(path=str(SHOTS / "01-tonight-first.png"))

    page.click("text=Skip for now")
    page.goto(URL + "#path")
    page.wait_for_selector(".lanes")
    page.screenshot(path=str(SHOTS / "02-path.png"))

    # Level sheet
    page.click(".node >> text=Major triads")
    page.wait_for_selector(".sheet")
    page.screenshot(path=str(SHOTS / "03-sheet.png"))
    page.click("text=Use all 12 keys now")
    page.wait_for_selector(".sheet")

    # Round 1: fast tempo, perfect play
    page.evaluate("WS.debug.forceTempo = 160")
    page.click(".sheet >> text=Play a round")
    page.wait_for_selector("#game:not([hidden])")
    syms = page.evaluate("WS.debug.autoplay({miss: []})")
    print("prompts:", syms)
    page.wait_for_timeout(5200)
    page.screenshot(path=str(SHOTS / "04-game.png"))
    wait_summary(page)
    page.wait_for_timeout(600)
    page.screenshot(path=str(SHOTS / "05-summary.png"))
    title = page.inner_text(".sum-title")
    print("summary title:", title, "|", page.inner_text(".sum-line"))
    check(title in ("Flawless", "Passed"), "perfect autoplay passes the round")
    st = state(page)
    stars = st["levels"]["h1-maj"]["stars"]
    print("stars after round 1:", stars)
    check(all(s["s"] for s in stars), "three silver stars at a fast tempo, flawless round")
    check(not any(s["g"] for s in stars), "no gold on the same day")

    page.keyboard.press("Escape")
    page.wait_for_selector("#game", state="hidden")

    # Persistence
    page.reload()
    page.wait_for_selector(".page-title")
    st = state(page)
    check(bool(st["levels"].get("h1-maj", {}).get("stars", [{}])[0].get("s")), "progress survives a reload")

    # Next day: cold check for gold
    page.evaluate("WS.debug.setDay(1)")
    page.goto(URL + "#tonight")
    page.wait_for_selector(".page-title")
    page.evaluate("WS.debug.setDay(1)")
    page.wait_for_timeout(200)
    has_chip = page.locator(".chip-gold").count()
    check(has_chip >= 1, "tonight lists a gold chance the next day")
    page.screenshot(path=str(SHOTS / "06-tonight-gold.png"))
    page.locator(".chip-gold").first.click()
    page.wait_for_selector(".cold-banner")
    page.screenshot(path=str(SHOTS / "07-sheet-cold.png"))
    page.evaluate("WS.debug.forceTempo = 160")
    page.click(".sheet >> text=Play the cold check")
    page.wait_for_selector("#game:not([hidden])")
    page.evaluate("WS.debug.autoplay({miss: []})")
    wait_summary(page)
    page.wait_for_timeout(700)
    page.screenshot(path=str(SHOTS / "08-summary-gold.png"))
    st = state(page)
    stars = st["levels"]["h1-maj"]["stars"]
    print("stars after cold check:", stars)
    check(all(s["g"] for s in stars), "cold check on a later day turns all three gold")
    check("Cold check passed" in page.inner_text(".summary"), "summary says the cold check passed")

    # Second round the same day is not cold
    page.click("text=Play again (Enter)")
    page.wait_for_timeout(300)
    cold_badge = page.locator(".badge-gold").count()
    check(cold_badge == 0, "second round of the day is not a cold check")
    page.keyboard.press("Escape")
    page.wait_for_selector("#game", state="hidden")

    # Misses and reasons on the next level
    page.goto(URL + "#path")
    page.wait_for_selector(".lanes")
    page.click(".node >> text=Minor triads")
    page.wait_for_selector(".sheet")
    page.click("text=Use all 12 keys now")
    page.wait_for_selector(".sheet")
    page.evaluate("WS.debug.forceTempo = 160")
    page.click(".sheet >> text=Play a round")
    page.wait_for_selector("#game:not([hidden])")
    page.evaluate("WS.debug.autoplay({miss: [0, 3, 7]})")
    wait_summary(page)
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "09-summary-miss.png"))
    txt = page.inner_text(".summary")
    check("Not yet" in txt, "three misses fails the round")
    check("Missing" in txt, "miss reasons name the missing note")
    page.keyboard.press("Escape")
    page.wait_for_selector("#game", state="hidden")

    # Shell voicings
    page.goto(URL + "#path")
    page.wait_for_selector(".lanes")
    page.click(".node >> text=Shells, shape A")
    page.wait_for_selector(".sheet")
    page.click("text=Use all 12 keys now")
    page.wait_for_selector(".sheet")
    page.evaluate("WS.debug.forceTempo = 160")
    page.click(".sheet >> text=Play a round")
    page.wait_for_selector("#game:not([hidden])")
    page.evaluate("WS.debug.autoplay({miss: []})")
    page.wait_for_timeout(4000)
    page.screenshot(path=str(SHOTS / "10-game-shells.png"))
    wait_summary(page)
    check(page.inner_text(".sum-title") in ("Flawless", "Passed"), "correct shells pass")
    page.keyboard.press("Escape")
    page.wait_for_selector("#game", state="hidden")

    # Real-tempo timing check: one round at the level tempo with early hits by 40 ms
    page.evaluate("WS.debug.forceTempo = 96")
    page.goto(URL + "#path")
    page.wait_for_selector(".lanes")
    page.click(".node >> text=Minor triads")
    page.wait_for_selector(".sheet")
    page.click(".sheet >> text=Play a round")
    page.wait_for_selector("#game:not([hidden])")
    page.evaluate("WS.debug.autoplay({miss: [], offsetMs: -40})")
    wait_summary(page, 60)
    line = page.inner_text(".sum-line")
    print("timing line:", line)
    check("early" in line, "timing report reflects early playing")
    mm = re.search(r"about (\d+) ms early", line)
    check(mm is not None and 25 <= int(mm.group(1)) <= 60, "measured early offset is close to the injected 40 ms")
    page.keyboard.press("Escape")
    page.wait_for_selector("#game", state="hidden")

    # Keyboard screen with computer keys
    page.goto(URL + "#keyboard")
    page.wait_for_selector(".full-kb")
    page.keyboard.down("z"); page.keyboard.down("c"); page.keyboard.down("b")
    page.wait_for_timeout(150)
    ident = page.inner_text(".ident")
    print("ident:", ident)
    check(ident.strip().startswith("C") and "major" in ident, "computer keys Z C B play a C major chord")
    page.screenshot(path=str(SHOTS / "11-keyboard.png"))
    page.keyboard.up("z"); page.keyboard.up("c"); page.keyboard.up("b")

    page.goto(URL + "#progress")
    page.wait_for_selector(".statline")
    page.screenshot(path=str(SHOTS / "12-progress.png"), full_page=True)

    page.goto(URL + "#settings")
    page.wait_for_selector(".panel")
    with page.expect_download() as dl:
        page.click("button:has-text('Export a backup')")
    path = dl.value.path()
    data = json.loads(Path(path).read_text())
    check(data.get("app") == "woodshed" and "levels" in data["state"], "backup export contains the state")
    page.screenshot(path=str(SHOTS / "13-settings.png"), full_page=True)

    # Narrow screen
    m = browser.new_context(viewport={"width": 390, "height": 844})
    mp = m.new_page()
    mp.on("pageerror", lambda e: errors.append(f"mobile pageerror: {e}"))
    mp.goto(URL + "#tonight")
    mp.wait_for_selector(".page-title")
    mp.screenshot(path=str(SHOTS / "14-mobile.png"), full_page=True)
    overflow = mp.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
    check(not overflow, "no horizontal scroll at phone width")

    browser.close()

print("\nERRORS:" if errors else "\nALL CHECKS PASSED")
for e in errors:
    print(" -", e)
sys.exit(1 if errors else 0)
