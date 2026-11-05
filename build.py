#!/usr/bin/env python3
"""Build Woodshed into the repository root, ready for GitHub Pages.

  index.html            the app: page, styles, fonts and scripts in one file, plus the instrument maps
  sw.js                 service worker: offline support, keeps loaded sounds on the Mac
  manifest.webmanifest  makes it installable ("Install Woodshed" in Chrome)
  sounds/<id>/          instrument samples (made by tools/make_sounds.py), loaded on demand
  icons/                app icons (made by tools/make_icons.py)

Pages serves the repository root of main, so whatever this writes is what goes live on push.
"""
import base64
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "src"

FONTS = [
    # (family, weight, style, file) - both families are SIL Open Font License 1.1
    ("Kalam", 700, "normal", "kalam-latin-700-normal.woff2"),
    ("Atkinson Hyperlegible", 400, "normal", "atkinson-hyperlegible-latin-400-normal.woff2"),
    ("Atkinson Hyperlegible", 700, "normal", "atkinson-hyperlegible-latin-700-normal.woff2"),
]


def font_faces() -> str:
    out = []
    for family, weight, style, fname in FONTS:
        data = base64.b64encode((SRC / "fonts" / fname).read_bytes()).decode("ascii")
        out.append(
            "@font-face{font-family:\"%s\";font-weight:%d;font-style:%s;font-display:swap;"
            "src:url(data:font/woff2;base64,%s) format(\"woff2\");}" % (family, weight, style, data)
        )
    return "\n".join(out)


def sound_maps() -> str:
    """WS.ZONES (which notes each instrument sampled, per velocity band) and WS.SOUND_VERSION (cache busting)."""
    zones, versions = {}, {}
    for z in sorted((ROOT / "sounds").glob("*/zones.json")):
        inst = z.parent.name
        zones[inst] = json.loads(z.read_text())
        h = hashlib.sha1(z.read_bytes())
        for f in sorted(z.parent.glob("*.webm")):
            h.update(f.name.encode())
            h.update(str(f.stat().st_size).encode())
        versions[inst] = h.hexdigest()[:8]
    return ("window.WS = window.WS || {};\nWS.ZONES = " + json.dumps(zones, separators=(",", ":"))
            + ";\nWS.SOUND_VERSION = " + json.dumps(versions) + ";"), zones


MANIFEST = {
    "name": "Woodshed",
    "short_name": "Woodshed",
    "description": "A daily, graded, gamified piano practice plan.",
    "start_url": "./#tonight",
    "scope": "./",
    "display": "standalone",
    "background_color": "#1E2C25",
    "theme_color": "#1E2C25",
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}

SW = r"""/* Woodshed service worker, version __VERSION__ (written by build.py).
   - The page is fetched fresh whenever you're online, so updates arrive on the next open; offline, the
     last copy is used.
   - Sounds are cached the first time they load and come from the Mac after that. Their URLs carry a
     version, so a rebuilt instrument is fetched again. */
const SHELL = 'woodshed-shell-__VERSION__';
const SOUNDS = 'woodshed-sounds-1';
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('woodshed-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

const networkFirst = async (req) => {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req.mode === 'navigate' ? 'index.html' : req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req.mode === 'navigate' ? 'index.html' : req)) || (await cache.match('./')) || Response.error();
  }
};

const soundFirst = async (req) => {
  const cache = await caches.open(SOUNDS);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    cache.put(req, res.clone());
    // Drop older versions of the same file
    const base = req.url.split('?')[0];
    for (const k of await cache.keys()) if (k.url.split('?')[0] === base && k.url !== req.url) cache.delete(k);
  }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.includes('/sounds/')) { e.respondWith(soundFirst(req)); return; }
  e.respondWith(networkFirst(req));
});
"""


def main() -> None:
    html = (SRC / "index.html").read_text(encoding="utf-8")
    css = font_faces() + "\n" + (SRC / "styles.css").read_text(encoding="utf-8")
    js_files = sorted((SRC / "js").glob("*.js"))
    js = "\n".join(f"/* ---- {p.name} ---- */\n" + p.read_text(encoding="utf-8") for p in js_files)
    if "</script" in js.lower():
        raise SystemExit("A JS file contains '</script', which would break the inline bundle.")
    maps, zones = sound_maps()
    out = html.replace("<!--STYLE-->", f"<style>\n{css}\n</style>").replace(
        "<!--SCRIPT-->", f"<script>\n{maps}\n</script>\n<script>\n{js}\n</script>")
    (ROOT / "index.html").write_text(out, encoding="utf-8")
    version = hashlib.sha1(out.encode("utf-8")).hexdigest()[:10]
    (ROOT / "sw.js").write_text(SW.replace("__VERSION__", version), encoding="utf-8")
    (ROOT / "manifest.webmanifest").write_text(json.dumps(MANIFEST, indent=2) + "\n", encoding="utf-8")
    (ROOT / ".nojekyll").write_text("")
    size = sum(f.stat().st_size for f in (ROOT / "sounds").glob("*/*.webm"))
    print(f"Built index.html ({len(out.encode('utf-8')) / 1024:.0f} KB) from {len(js_files)} scripts; "
          f"{len(zones)} sampled instruments, {size / 1e6:.1f} MB of sounds; version {version}")


if __name__ == "__main__":
    main()
