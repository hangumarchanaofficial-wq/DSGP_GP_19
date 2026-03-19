"""
mouse_collector.py – Matches LocalAgent.py EXACTLY.
mouse_moves = event count (each on_move callback = +1)
mouse_scrolls = event count (each on_scroll callback = +1)
mouse_clicks = press-only count
"""

import threading
from pynput import mouse


class MouseCollector:
    def __init__(self):
        self._lock = threading.Lock()
        self._clicks = 0
        self._moves = 0
        self._scrolls = 0

        self._listener = mouse.Listener(
            on_click=self._on_click,
            on_move=self._on_move,
            on_scroll=self._on_scroll,
        )
        self._listener.daemon = True
        self._listener.start()

    def _on_click(self, x, y, button, pressed):
        if pressed:
            with self._lock:
                self._clicks += 1

    def _on_move(self, x, y):
        with self._lock:
            self._moves += 1

    def _on_scroll(self, x, y, dx, dy):
        with self._lock:
            self._scrolls += 1

    def flush(self) -> dict:
        with self._lock:
            result = {
                "clicks": self._clicks,
                "moves": self._moves,
                "scrolls": self._scrolls,
            }
            self._clicks = 0
            self._moves = 0
            self._scrolls = 0
            return result
