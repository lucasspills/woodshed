#!/usr/bin/env python3
"""Build Woodshed's instrument sounds into sounds/<id>/ from free sample libraries.

  python3 tools/make_sounds.py                 # every instrument
  python3 tools/make_sounds.py kawai rhodes    # just these
  python3 tools/make_sounds.py --measure       # print loudness per velocity band, encode nothing

Needs git, npm, ffmpeg (with libopus) and numpy. Sources are downloaded into .cache/sources (gitignored).

Each instrument ends up as one Opus file per sampled note and velocity band, <root>-<band>.webm, plus a
zones.json the app reads: which notes were sampled in which band, and any tuning correction in cents.
Sources and licenses:
  salamander  Salamander Grand Piano V3, Yamaha C5 (Alexander Holm, CC BY 3.0), via npm @audio-samples
  steinway    Splendid Grand Piano, Steinway (sfzinstruments, public domain), via github.com/danigb/samples
  kawai       VCSL Grand Piano, Kawai (Versilian Community Sample Library, CC0), via danigb/samples
  upright     VCSL Upright Piano, Knight (CC0), via danigb/samples
  honkytonk   Old Piano by Francis Bacon, honky-tonk (freepats, CC0), via danigb/samples
  rhodes      jRhodes3d, 1977 Rhodes Mark I Stage 73 (J. Learman, CC0), via danigb/samples
  wurlitzer   Wurlitzer EP200 from Greg Sullivan's E-Pianos (CC BY 3.0), via danigb/samples
  bass        Growly Bass, Squier Jazz Bass (D. Smolken, CC0), via danigb/samples
"""
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "sounds"
CACHE = ROOT / ".cache" / "sources"
DS = CACHE / "danigb-samples" / "audio"
SAL = CACHE / "salamander" / "node_modules" / "@audio-samples"

NOTE_PC = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def note_to_midi(name, c4=60):
    """'F#3', 'Ab1', 'db2', 'C-1' -> MIDI number, with C4 = c4."""
    m = re.fullmatch(r"([A-Ga-g])([#b]?)(-?\d+)", name.strip())
    if not m:
        raise ValueError(name)
    pc = NOTE_PC[m.group(1).upper()] + (1 if m.group(2) == "#" else -1 if m.group(2) == "b" else 0)
    return c4 + (int(m.group(3)) - 4) * 12 + pc


def key_value(v):
    return v if isinstance(v, int) else note_to_midi(v)


# ---------------------------------------------------------------- downloading
SPARSE = [
    "/audio/splendid-grand-piano/*",
    "/audio/oldpiano-fb/*.ogg", "/audio/oldpiano-fb/websfz.json",
    "/audio/gs-e-pianos/Wurlitzer EP200/*",
    "/audio/jlearman/rhodes-mki/*.json", "/audio/jlearman/rhodes-mki/jRhodes3d-mono/*.ogg",
    "/audio/dsmolken/glowlybass/*.json", "/audio/dsmolken/glowlybass/sustain/*.ogg",
    "/audio/vcsl/Zithers/Grand Piano, Kawai.sfz", "/audio/vcsl/Zithers/Grand Piano, Kawai/Sustains/*.ogg",
    "/audio/vcsl/Zithers/Upright Piano, Knight.sfz", "/audio/vcsl/Zithers/Upright Piano, Knight/Sustains/*.ogg",
]


def fetch_sources():
    repo = CACHE / "danigb-samples"
    if not (repo / ".git").exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "-q", "--depth", "1", "--filter=blob:none", "--no-checkout",
                        "https://github.com/danigb/samples", str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "sparse-checkout", "init", "--no-cone"], check=True)
        (repo / ".git" / "info" / "sparse-checkout").write_text("\n".join(SPARSE) + "\n")
        subprocess.run(["git", "-C", str(repo), "checkout", "-q", "HEAD"], check=True)
    sal = CACHE / "salamander"
    if not (SAL / "piano-mp3-velocity15").exists():
        sal.mkdir(parents=True, exist_ok=True)
        subprocess.run("npm init -y >/dev/null", shell=True, cwd=sal, check=True)
        for v in (3, 9, 15):
            subprocess.run(["npm", "install", "--ignore-scripts", f"@audio-samples/piano-mp3-velocity{v}@1.0.5"],
                           cwd=sal, check=True, stdout=subprocess.DEVNULL)


# ---------------------------------------------------------------- reading the sample maps
def websfz_regions(path):
    """Flatten a websfz.json: each region inherits its group's opcodes."""
    d = json.loads(Path(path).read_text())
    out = []
    for gi, g in enumerate(d["groups"]):
        gk = {k: v for k, v in g.items() if k != "regions"}
        for r in g["regions"]:
            reg = dict(gk)
            reg.update(r)
            reg["_group"] = gi
            out.append(reg)
    return out


def region_root(r):
    if "pitch_keycenter" in r:
        return key_value(r["pitch_keycenter"])
    if "key" in r:
        return key_value(r["key"])
    return 60


def sfz_regions(path):
    """A small SFZ reader for the VCSL files: <group>/<region> blocks with one opcode per line."""
    text = Path(path).read_text(errors="replace")
    regions, group, cur = [], {}, None
    for raw in text.splitlines():
        line = raw.split("//")[0].strip()
        if not line:
            continue
        if line.startswith("<group>"):
            group, cur = {}, None
            continue
        if line.startswith("<region>"):
            cur = dict(group)
            regions.append(cur)
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            (cur if cur is not None else group)[k.strip()] = v.strip()
    return regions


def rr_extra(sample):
    return bool(re.search(r"_rr[2-9]", sample))


def pick_by_rank(by_root, bands):
    """VCSL velocity layers differ note to note: pick the softest, middle and loudest layer of each note."""
    out = []
    for root, regs in by_root.items():
        regs = sorted(regs, key=lambda r: int(r.get("hivel", 127)))
        k = len(regs)
        for b in range(bands):
            t = 0 if bands == 1 else b * (k - 1) / (bands - 1)
            r = regs[min(range(k), key=lambda i: abs(i - t))]
            out.append((b, root, r["_src"], float(r.get("tune", 0) or 0)))
    return out


def collect(inst):
    """Return [(band, root midi, source file, tune cents)] for one instrument."""
    out = []
    if inst == "salamander":
        for b, v in enumerate((3, 9, 15)):
            for f in sorted((SAL / f"piano-mp3-velocity{v}" / "audio").glob(f"*v{v}.mp3")):
                name = f.name[: -len(f"v{v}.mp3")]
                out.append((b, note_to_midi(name), f, 0.0))
    elif inst == "steinway":
        base = DS / "splendid-grand-piano"
        band_of = {"PP": 0, "MP": 1, "MF": 2, "FF": 3}
        for r in websfz_regions(base / "websfz.json"):
            b = band_of.get(r.get("group_label"))
            if b is None:
                continue
            out.append((b, region_root(r), base / f"{r['sample']}.ogg", float(r.get("tune", 0) or 0)))
    elif inst in ("kawai", "upright"):
        name = "Grand Piano, Kawai" if inst == "kawai" else "Upright Piano, Knight"
        base = DS / "vcsl" / "Zithers"
        by_root = {}
        for r in sfz_regions(base / f"{name}.sfz"):
            s = r.get("sample", "")
            if not s or rr_extra(s) or "/Sustains/" not in s.replace("\\", "/"):
                continue
            r["_src"] = base / Path(s.replace("\\", "/")).with_suffix(".ogg")
            by_root.setdefault(int(r["pitch_keycenter"]), []).append(r)
        out = pick_by_rank(by_root, 3 if inst == "kawai" else 2)
    elif inst == "honkytonk":
        base = DS / "oldpiano-fb"
        for r in websfz_regions(base / "websfz.json"):
            out.append((0, region_root(r), base / f"{r['sample']}.ogg", float(r.get("tune", 0) or 0)))
    elif inst == "rhodes":
        base = DS / "jlearman" / "rhodes-mki"
        band_of = {0: 0, 2: 1, 4: 2}           # five layers in the source; softest, middle and hardest
        for r in websfz_regions(base / "jrhodes3dmono.websfz.json"):
            b = band_of.get(r["_group"])
            if b is None:
                continue
            out.append((b, region_root(r), base / "jRhodes3d-mono" / f"{r['sample']}.ogg", 0.0))
    elif inst == "wurlitzer":
        base = DS / "gs-e-pianos" / "Wurlitzer EP200"
        band_of = {"pp": 0, "mp": 1, "f": 2, "ff": 3}
        for r in websfz_regions(base / "wurlitzer-ep200.websfz.json"):
            b = band_of.get(r.get("group_label"))
            if b is None:
                continue
            out.append((b, region_root(r), base / "Samples" / f"{r['sample']}.ogg", float(r.get("tune", 0) or 0)))
    elif inst == "bass":
        base = DS / "dsmolken" / "glowlybass"
        band_of = {"p": 0, "f": 1, "ff": 2}       # skip pp: too quiet to be useful on a keyboard
        for r in websfz_regions(base / "growlybassclean.websfz.json"):
            s = r.get("sample", "")
            m = re.fullmatch(r"sustain/[a-g]b?\d_(pp|p|f|ff)_rr1", s)
            if not m or m.group(1) not in band_of:
                continue
            out.append((band_of[m.group(1)], region_root(r), base / f"{s}.ogg", 0.0))
    else:
        raise SystemExit(f"Unknown instrument {inst}")
    # Some maps spell file names in a different case than the files (MF-C#1 vs Mf-C#1)
    def resolve(p):
        p = Path(p)
        if p.exists():
            return p
        for q in p.parent.glob("*"):
            if q.name.lower() == p.name.lower():
                return q
        return p
    out = [(b, r, resolve(s), t) for b, r, s, t in out]
    # one source per band and root
    seen, uniq = set(), []
    for e in out:
        if (e[0], e[1]) in seen:
            continue
        seen.add((e[0], e[1]))
        uniq.append(e)
    # At most one sample every minor third, like the Salamander: no note is shifted more than a semitone or so,
    # and decoded audio stays around 100-200 MB per instrument instead of 400+
    if inst in ("steinway", "kawai", "upright", "honkytonk"):
        keep, last = set(), -99
        for r in sorted({e[1] for e in uniq}):
            if r - last >= 3:
                keep.add(r)
                last = r
        uniq = [e for e in uniq if e[1] in keep]
    missing = [str(e[2]) for e in uniq if not Path(e[2]).exists()]
    if missing:
        raise SystemExit(f"{inst}: {len(missing)} source files missing, e.g. {missing[0]}")
    return uniq


# ---------------------------------------------------------------- audio
SR = 48000


def decode(path, seconds=None):
    cmd = ["ffmpeg", "-v", "error", "-i", str(path)]
    if seconds:
        cmd += ["-t", str(seconds)]
    cmd += ["-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def channels(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=channels",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout.strip()
    return int(out or 1)


def loudness(path):
    """RMS (dB) of the first 400 ms after the attack: how loud a note sounds when it's struck."""
    x = decode(path, 1.5)
    if not len(x):
        return -120.0
    a = np.abs(x)
    start = int(np.argmax(a > a.max() * 0.05)) if a.max() > 0 else 0
    seg = x[start: start + int(0.4 * SR)]
    return float(20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9))


def f0(path, root):
    """Rough pitch check: autocorrelation on 300 ms after the attack, searched within ±7 semitones of the root."""
    x = decode(path, 1.2)
    a = np.abs(x)
    start = int(np.argmax(a > a.max() * 0.05)) + int(0.08 * SR)
    seg = x[start: start + int(0.3 * SR)]
    if len(seg) < 2048:
        return None
    seg = seg - seg.mean()
    ac = np.correlate(seg, seg, "full")[len(seg) - 1:]
    expect = 440 * 2 ** ((root - 69) / 12)
    best = None
    for oct_shift in (0, -12, 12):
        f = expect * 2 ** (oct_shift / 12)
        lo, hi = int(SR / (f * 2 ** (7 / 12))), int(SR / (f * 2 ** (-7 / 12)))
        if hi >= len(ac) or lo < 2:
            continue
        lag = lo + int(np.argmax(ac[lo:hi]))
        score = ac[lag] / ac[0]
        if best is None or score > best[1]:
            best = (SR / lag, score, oct_shift)
    if not best:
        return None
    cents = 1200 * np.log2(best[0] / expect)
    return round(float(cents)), best[2]


# Seconds kept per note, by register: the bass rings longest, the top dies quickly
def keep_seconds(inst, m):
    if inst == "bass":
        return 5.0
    if inst in ("rhodes", "wurlitzer"):
        return 6.0 if m < 48 else 5.0 if m < 72 else 3.5
    if m < 40: return 9.0
    if m < 60: return 7.0
    if m < 76: return 5.0
    if m < 90: return 3.5
    return 2.2


# How each instrument is brought to the same loudness as the Salamander grand.
# natural: one gain for the whole instrument, so its own dynamics stay as recorded.
# banded: one gain per velocity band, so soft-to-loud follows the Salamander's curve. For sources whose
#   layers were normalized to the same level (most of these), which would otherwise play equally loud.
# Either way the note-to-note balance inside a band stays as recorded.
LEVELING = {"salamander": "natural", "steinway": "banded", "kawai": "banded", "upright": "banded",
            "honkytonk": "natural", "rhodes": "banded", "wurlitzer": "banded", "bass": "banded"}
ORDER = ["salamander", "steinway", "kawai", "upright", "honkytonk", "rhodes", "wurlitzer", "bass"]


def band_levels(entries):
    lv = {}
    for b, root, src, _ in entries:
        lv.setdefault(b, []).append(loudness(src))
    return {b: float(np.median(v)) for b, v in sorted(lv.items())}


def reference():
    ref = CACHE / "salamander-levels.json"
    if ref.exists():
        return {int(k): v for k, v in json.loads(ref.read_text()).items()}
    lv = band_levels(collect("salamander"))
    ref.write_text(json.dumps(lv))
    return lv


def build(inst, ref):
    entries = collect(inst)
    bands = max(e[0] for e in entries) + 1
    dest = OUT / inst
    if dest.exists():
        shutil.rmtree(dest)
    dest.mkdir(parents=True)
    mode = LEVELING[inst]
    levels = {(e[0], e[1]): loudness(e[2]) for e in entries}
    # The Salamander's band levels, interpolated to this instrument's number of bands
    rb = [ref[k] for k in sorted(ref)]
    def ref_at(b):
        if bands == 1:
            return rb[-1]
        pos = b * (len(rb) - 1) / (bands - 1)
        i = min(int(pos), len(rb) - 2)
        return rb[i] + (rb[i + 1] - rb[i]) * (pos - i)
    med = {b: float(np.median([v for (bb, _), v in levels.items() if bb == b])) for b in range(bands)}
    if mode == "natural":
        band_gain = {b: ref_at(bands - 1) - med[bands - 1] for b in range(bands)}
    else:
        band_gain = {b: ref_at(b) - med[b] for b in range(bands)}
    if inst == "salamander":
        band_gain = {b: 0.0 for b in range(bands)}   # keep the grand exactly as it was
    zones = {"bands": bands, "files": {}}
    pitch_warn = []
    by_src = {}
    for b, root, src, tune in sorted(entries, key=lambda e: (e[1], e[0])):
        gain = band_gain[b]
        key = (str(src), round(gain, 1))
        if key in by_src:
            fname = by_src[key]
        else:
            fname = f"{root}-{b}.webm"
            secs = keep_seconds(inst, root)
            fade = min(1.2, secs * 0.3)
            ac = "1" if channels(src) == 1 else "2"
            br = "48k" if ac == "1" else "64k"
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-t", str(secs),
                            "-af", f"volume={gain:.2f}dB,afade=t=out:st={secs - fade:.2f}:d={fade:.2f}",
                            "-ac", ac, "-ar", str(SR), "-c:a", "libopus", "-b:a", br, "-vbr", "on", str(dest / fname)],
                           check=True)
            by_src[key] = fname
            chk = f0(dest / fname, root)
            if chk and abs(chk[0]) > 40:
                pitch_warn.append((fname, chk))
        zones["files"].setdefault(str(b), {})[str(root)] = {"f": fname, "tune": round(tune)} if tune else {"f": fname}
    (dest / "zones.json").write_text(json.dumps(zones, separators=(",", ":")))
    size = sum(p.stat().st_size for p in dest.glob("*.webm"))
    n = len(list(dest.glob("*.webm")))
    print(f"{inst:11s} {bands} bands, {n:3d} files, {size / 1e6:5.1f} MB, {mode}, gains "
          + " ".join(f"{band_gain[b]:+.1f}" for b in range(bands)) + " dB")
    for w in pitch_warn:
        print(f"   pitch check {w[0]}: {w[1][0]:+d} cents (octave shift {w[1][1]:+d})")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    fetch_sources()
    if "--measure" in sys.argv:
        for inst in args or ORDER:
            e = collect(inst)
            lv = band_levels(e)
            roots = sorted({x[1] for x in e})
            print(f"{inst:11s} roots {roots[0]}-{roots[-1]} ({len(roots)}), bands:", {b: round(v, 1) for b, v in lv.items()})
        return
    ref = reference()
    for inst in args or ORDER:
        build(inst, ref)


if __name__ == "__main__":
    main()
