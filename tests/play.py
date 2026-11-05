"""Play mode: every instrument loads and sounds right, split and layer route keys, rooms differ, sounds work offline."""
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


HELPERS = r"""
window.T_ = {
  wait: (ms) => new Promise(r => setTimeout(r, ms)),
  until: async (fn, ms = 30000) => { const t0 = performance.now(); while (!fn()) { if (performance.now() - t0 > ms) throw new Error('timeout'); await T_.wait(50); } },
  an: null,
  tap() {
    if (T_.an) return T_.an;
    const c = WS.audio.ctx; T_.an = c.createAnalyser(); T_.an.fftSize = 4096; WS.out.out.connect(T_.an); return T_.an;
  },
  rms() { const an = T_.tap(); const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); return Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length); },
  peak() { const an = T_.tap(); const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); return d.reduce((m, x) => Math.max(m, Math.abs(x)), 0); },
  db: (x) => 20 * Math.log10(x + 1e-9),
  async use(setup) {
    Object.assign(WS.S().settings, setup);
    WS.rig.configure();
    await T_.until(() => WS.rig.status().complete, 60000);
  },
  async hit(n, vel, ms = 140) {
    WS.input.inject(n, true, performance.now(), vel); await T_.wait(ms);
    const r = T_.rms(), p = T_.peak();
    WS.input.inject(n, false, performance.now()); await T_.wait(450);
    return { rms: r, peak: p };
  },
};
"""

with sync_playwright() as p:
    b = p.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))
    pg.goto(URL + "#play")
    pg.wait_for_selector(".play-stage")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(SHOTS / "20-play-idle.png"), full_page=True)
    check(pg.evaluate("WS.sounds.INSTRUMENTS.length === 9 && document.querySelectorAll('.inst').length === 9"), "nine sounds to pick from")

    pg.click("text=Load the sound")
    pg.wait_for_function("WS.piano.status === 'ready'", timeout=30000)
    first = pg.evaluate("WS.piano.loaded")
    check(first >= 30, f"the grand is playable after its middle layer ({first} decoded)")
    pg.wait_for_function("WS.piano.loaded === WS.piano.total", timeout=60000)
    check(pg.evaluate("WS.piano.layersReady.length === 3"), "all three velocity layers of the grand decode")
    pg.evaluate(HELPERS)
    pg.evaluate("WS.S().settings.reverb = 'dry'; WS.out.apply(); T_.tap()")
    pg.wait_for_timeout(200)

    offs = pg.evaluate("""() => { const o = []; for (const b of Object.values(WS.piano._bufs)) for (const v of Object.values(b)) o.push(v.off*1000); return [Math.min(...o), Math.max(...o)]; }""")
    print("attack offsets ms:", offs)
    check(offs[1] < 30 and offs[1] > 2, "silent lead-in is found and skipped (up to 30 ms)")

    # ---- The grand: velocity layers, dampers, pedal (as in 0.2)
    level = pg.evaluate("""async () => {
      const P = WS.piano, res = {};
      res.soft = (await T_.hit(60, 30)).rms;
      WS.input.inject(60, true, performance.now(), 120); await T_.wait(120); res.loud = T_.rms();
      res.mixSoft = P.layerMix(P.touch(30)); res.mixLoud = P.layerMix(P.touch(120)); res.mixMid = P.layerMix(P.touch(90));
      WS.input.inject(60, false, performance.now()); await T_.wait(600); res.afterRelease = T_.rms();
      WS.input.setPedal(true, performance.now());
      for (const n of [48, 52, 55]) WS.input.inject(n, true, performance.now(), 90);
      await T_.wait(150);
      for (const n of [48, 52, 55]) WS.input.inject(n, false, performance.now());
      await T_.wait(500); res.pedalHeld = T_.rms(); res.sustained = WS.rig.sustainedNotes().length;
      WS.input.setPedal(false, performance.now()); await T_.wait(700); res.pedalUp = T_.rms();
      WS.input.inject(100, true, performance.now(), 100); await T_.wait(80); WS.input.inject(100, false, performance.now()); await T_.wait(250); res.treble = T_.rms();
      res.lat = WS.audioLatency();
      return res;
    }""")
    print("grand:", {k: v for k, v in level.items() if k != "lat"})
    print("latency:", level["lat"])
    check(level["soft"] > 0.002, "a soft note makes sound")
    check(level["loud"] > level["soft"] * 2, "a hard note is much louder than a soft one")
    check(level["mixSoft"][0][0] == 0 and level["mixLoud"][-1][0] == 2, "soft notes use the soft layer, hard notes the loud layer")
    check(len(level["mixMid"]) == 2, "in-between velocities blend two layers")
    check(level["afterRelease"] < level["loud"] * 0.1, "lifting the key damps the note")
    check(level["sustained"] == 3 and level["pedalHeld"] > 0.01, "the pedal keeps released notes ringing")
    check(level["pedalUp"] < level["pedalHeld"] * 0.2, "lifting the pedal damps them")
    check(level["treble"] > 0.001, "the top octave rings on without dampers")
    n = pg.evaluate("""async () => { for (let i = 0; i < 40; i++) { WS.input.inject(64, true, performance.now(), 80); WS.input.inject(64, false, performance.now()); }
      await T_.wait(900); return WS.rig.voiceCount(); }""")
    check(n <= 3, f"repeated notes don't stack up voices ({n} live)")

    # ---- Every instrument: loads from sounds/, plays across the range, soft < loud, level close to the grand
    ref, ref_peak = pg.evaluate("""async () => { await T_.use({ soundMode: 'single', sound: 'salamander' }); const m = T_.db((await T_.hit(60, 90, 160)).rms);
      for (const k of [48, 55, 60, 64, 67, 72]) WS.input.inject(k, true, performance.now(), 127);
      await T_.wait(120); const pk = T_.peak();
      for (const k of [48, 55, 60, 64, 67, 72]) WS.input.inject(k, false, performance.now());
      await T_.wait(500); return [m, pk]; }""")
    for inst in ["salamander", "steinway", "kawai", "upright", "honkytonk", "rhodes", "wurlitzer", "bass", "pad"]:
        r = pg.evaluate("""async (id) => {
          await T_.use({ soundMode: 'single', sound: id });
          const e = WS.sounds.engine(id);
          const out = { bands: e.layersReady.length, total: e.total, loaded: e.loaded, mb: Math.round(e.bytes / 1e6) };
          const lowNote = id === 'bass' ? 28 : 33, highNote = id === 'bass' ? 67 : 96;
          out.soft = T_.db((await T_.hit(60, 25, 160)).rms);
          const loud = await T_.hit(60, 120, 160);
          out.loud = T_.db(loud.rms); out.peak = loud.peak;
          out.mid = T_.db((await T_.hit(60, 90, 160)).rms);
          out.low = T_.db((await T_.hit(lowNote, 90, 160)).rms);
          out.high = T_.db((await T_.hit(highNote, 90, 160)).rms);
          // a big chord (for the bass, a root and fifth) shouldn't drive the limiter hard
          const chord = id === 'bass' ? [33, 40] : [48, 55, 60, 64, 67, 72];
          for (const k of chord) WS.input.inject(k, true, performance.now(), 127);
          await T_.wait(120); out.chordPeak = T_.peak();
          for (const k of chord) WS.input.inject(k, false, performance.now());
          await T_.wait(500);
          return out;
        }""", inst)
        print(f"  {inst:11s}", {k: (round(v, 1) if isinstance(v, float) else v) for k, v in r.items()})
        check(r["loaded"] == r["total"], f"{inst}: every sample loads")
        check(r["loud"] - r["soft"] > 6, f"{inst}: hard playing is clearly louder than soft ({r['loud'] - r['soft']:.1f} dB)")
        check(abs(r["mid"] - ref) < 6, f"{inst}: about as loud as the grand ({r['mid'] - ref:+.1f} dB)")
        check(r["low"] > -60 and r["high"] > -60, f"{inst}: low and high notes sound")
        # The soft clipper catches loud chords for every sound; none should push it much harder than the grand does
        check(r["chordPeak"] < ref_peak * 1.8, f"{inst}: a loud six-note chord hits the limiter no harder than the grand's ({r['chordPeak']:.2f} vs {ref_peak:.2f})")
    check(pg.evaluate("WS.sounds.loaded().reduce((s, e) => s + e.bytes, 0)") < 800e6, "decoded audio stays under the memory budget")

    # ---- Split: bass under the split point, piano above; the pedal doesn't hold the bass
    sp = pg.evaluate("""async () => {
      await T_.use({ soundMode: 'split', splitLo: 'bass', splitHi: 'rhodes', splitPoint: 55 });
      const bass = WS.sounds.engine('bass'), rh = WS.sounds.engine('rhodes'), res = {};
      WS.input.inject(40, true, performance.now(), 90); await T_.wait(80);
      res.lowBass = bass.voiceCount(); res.lowRhodes = rh.voiceCount();
      WS.input.inject(64, true, performance.now(), 90); await T_.wait(80);
      res.highRhodes = rh.voiceCount();
      WS.input.setPedal(true, performance.now());
      WS.input.inject(40, false, performance.now()); WS.input.inject(64, false, performance.now()); await T_.wait(400);
      res.bassAfter = bass.voiceCount(); res.rhodesHeld = rh.voiceCount();
      WS.input.setPedal(false, performance.now()); await T_.wait(800);
      res.rhodesAfter = rh.voiceCount();
      return res;
    }""")
    print("split:", sp)
    check(sp["lowBass"] == 1 and sp["lowRhodes"] == 0, "split: a low key plays only the bass")
    check(sp["highRhodes"] == 1, "split: a high key plays the right-hand sound")
    check(sp["bassAfter"] == 0 and sp["rhodesHeld"] == 1, "split: the pedal holds the right hand but not the bass")
    check(sp["rhodesAfter"] == 0, "split: lifting the pedal releases the right hand")
    pg.wait_for_timeout(300)
    pg.evaluate("WS.ui.rerender()")
    pg.wait_for_timeout(300)
    pg.evaluate("WS.input.inject(40, true, performance.now(), 90); WS.input.inject(64, true, performance.now(), 90)")
    pg.wait_for_timeout(150)
    pg.screenshot(path=str(SHOTS / "21-play-split.png"), full_page=True)
    pg.evaluate("WS.input.inject(40, false, performance.now()); WS.input.inject(64, false, performance.now())")

    # Setting the split point from the keyboard
    pg.click("text=Set split point")
    pg.evaluate("WS.input.inject(62, true, performance.now(), 90); WS.input.inject(62, false, performance.now())")
    pg.wait_for_timeout(200)
    check(pg.evaluate("WS.S().settings.splitPoint") == 62, "Set split point takes the next key pressed")
    check(pg.evaluate("WS.sounds.engine('rhodes').voiceCount() + WS.sounds.engine('bass').voiceCount()") == 0, "the key that sets the split isn't played")

    # ---- Layer: one key, two instruments
    ly = pg.evaluate("""async () => {
      await T_.use({ soundMode: 'layer', layerA: 'salamander', layerB: 'pad', layerMix: 0.5 });
      WS.input.inject(60, true, performance.now(), 90); await T_.wait(200);
      const res = { grand: WS.sounds.engine('salamander').voiceCount(), pad: WS.sounds.engine('pad').voiceCount(), level: T_.db(T_.rms()) };
      WS.input.inject(60, false, performance.now()); await T_.wait(900);
      return res;
    }""")
    print("layer:", ly)
    check(ly["grand"] == 1 and ly["pad"] == 1, "layer: one key plays both sounds")
    pg.evaluate("WS.ui.rerender()")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(SHOTS / "22-play-layer.png"), full_page=True)

    # ---- Rooms: hall rings longer than room, dry has no tail
    tails = pg.evaluate("""async () => {
      await T_.use({ soundMode: 'single', sound: 'salamander', pianoRoom: 0.6 });
      const out = {};
      for (const r of ['dry', 'room', 'hall']) {
        WS.S().settings.reverb = r; WS.out.apply(); await T_.wait(300);
        WS.input.inject(72, true, performance.now(), 110); await T_.wait(150);
        WS.input.inject(72, false, performance.now()); await T_.wait(900);
        out[r] = T_.db(T_.rms());
        await T_.wait(2500);
      }
      WS.S().settings.reverb = 'room'; WS.out.apply();
      return out;
    }""")
    print("tails 0.9 s after release (dB):", {k: round(v, 1) for k, v in tails.items()})
    check(tails["hall"] > tails["room"] + 3 and tails["room"] > tails["dry"] + 3, "Hall rings longer than Room, Room longer than Dry")

    # ---- Picking a sound on screen
    pg.evaluate("WS.S().settings.soundMode = 'single'; WS.ui.rerender()")
    pg.wait_for_selector(".inst")
    pg.click(".inst[data-id='wurlitzer']")
    pg.wait_for_function("WS.S().settings.sound === 'wurlitzer'")
    pg.wait_for_function("WS.rig.status().complete", timeout=30000)
    pg.wait_for_timeout(200)
    check("Wurlitzer ready" in pg.inner_text(".play-stage"), "picking a card switches the sound and says so")
    pg.screenshot(path=str(SHOTS / "23-play-single.png"), full_page=True)
    pg.click("label[for='sound-mode-split']")
    check(pg.locator("#split-lo").count() == 1, "the Split tab shows the left and right hand pickers")
    pg.click("label[for='sound-mode-single']")

    # Leaving Play: drills go back to their own sound setting and the grand
    pg.goto(URL + "#path"); pg.wait_for_selector(".lanes")
    check(pg.evaluate("WS.input.forceSound === false && WS.rig.active === false"), "leaving Play hands sound back to the drills")

    m = b.new_context(viewport={"width": 390, "height": 844})
    mp = m.new_page()
    mp.goto(URL + "#play"); mp.wait_for_selector(".play-stage")
    mp.screenshot(path=str(SHOTS / "24-play-mobile.png"), full_page=True)
    check(not mp.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1"), "Play has no horizontal page scroll at phone width")
    m.close()

    # ---- Installable and offline: the service worker caches the app and the sounds you've played
    oc = b.new_context(viewport={"width": 1200, "height": 800})
    op = oc.new_page()
    op.goto(BASE + "index.html?debug#play")
    op.wait_for_selector(".play-stage")
    op.evaluate("navigator.serviceWorker.ready.then(() => true)")
    op.wait_for_function("navigator.serviceWorker.controller !== null", timeout=20000)
    manifest = op.evaluate("fetch('manifest.webmanifest').then(r => r.json())")
    check(manifest.get("display") == "standalone" and len(manifest.get("icons", [])) >= 2, "the web app manifest makes it installable")
    op.evaluate("WS.S().settings.sound = 'rhodes'; WS.S().settings.soundMode = 'single'; WS.store.flush(); WS.audio.ensure(); WS.rig.configure()")
    op.wait_for_function("WS.rig.status().complete", timeout=60000)
    cached = op.evaluate("caches.open('woodshed-sounds-1').then(c => c.keys()).then(k => k.filter(r => r.url.includes('/sounds/rhodes/')).length)")
    check(cached >= 40, f"loaded sounds are kept on the Mac ({cached} Rhodes files cached)")
    oc.set_offline(True)
    op.reload()
    op.wait_for_selector(".play-stage", timeout=15000)
    op.evaluate("WS.audio.ensure(); WS.rig.configure()")
    op.wait_for_function("WS.rig.status().complete", timeout=30000)
    check(op.evaluate("WS.sounds.engine('rhodes').loaded === WS.sounds.engine('rhodes').total"), "offline, the app opens and the Rhodes still loads")
    oc.close()
    b.close()

print("\nERRORS:" if errors else "\nALL CHECKS PASSED")
for e in errors:
    print(" -", e)
sys.exit(1 if errors else 0)
