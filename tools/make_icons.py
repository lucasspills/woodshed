#!/usr/bin/env python3
"""Render the Woodshed app icons (the shed under the moon) to icons/*.png with headless Chromium."""
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent.parent / "icons"

MARK = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <circle cx="31" cy="9" r="5" fill="#DAD7CD"/>
  <path d="M6 20 L19 10 L32 20 V34 H6 Z" fill="#588157"/>
  <path d="M4 21 L19 9 L34 21" fill="none" stroke="#A3B18A" stroke-width="3" stroke-linejoin="round"/>
  <rect x="21" y="21" width="7" height="6" rx="1" fill="#E9C46A"/>
  <rect x="10" y="24" width="6" height="10" fill="#1E2C25"/>
</svg>"""


def page(size, pad, radius):
    inner = size - 2 * pad
    return f"""<html><body style="margin:0;background:transparent">
<div style="width:{size}px;height:{size}px;border-radius:{radius}px;overflow:hidden;
  background:radial-gradient(circle at 75% 20%, #344E41, #1E2C25 70%);display:grid;place-items:center">
  <div style="width:{inner}px;height:{inner}px">{MARK.replace('<svg ', f'<svg width="{inner}" height="{inner}" ')}</div>
</div></body></html>"""


def main():
    OUT.mkdir(exist_ok=True)
    jobs = [  # name, size, padding, corner radius
        ("icon-192.png", 192, 22, 42), ("icon-512.png", 512, 58, 112), ("icon-180.png", 180, 20, 0),
        ("icon-maskable-512.png", 512, 104, 0),   # maskable: content inside the middle 80%
    ]
    with sync_playwright() as p:
        b = p.chromium.launch()
        for name, size, pad, radius in jobs:
            pg = b.new_page(viewport={"width": size, "height": size})
            pg.set_content(page(size, pad, radius))
            pg.screenshot(path=str(OUT / name), omit_background=True)
            pg.close()
        b.close()
    print("Wrote", ", ".join(j[0] for j in jobs))


if __name__ == "__main__":
    main()
