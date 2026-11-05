"""Serve the built site (the repository root) on a local port for the tests, the way GitHub Pages serves it."""
import functools
import http.server
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Quiet(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".webm": "audio/webm", ".webmanifest": "application/manifest+json", ".js": "text/javascript"}

    def log_message(self, *args):
        pass


def start():
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_address[1]}/", srv
