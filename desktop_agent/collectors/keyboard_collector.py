"""
keyboard_collector.py – Matches LocalAgent.py EXACTLY.
Counts backspace and delete as erase keys.
Records press timestamps for interval calculation.
"""

import time
import threading
from pynput import keyboard


class KeyboardCollector:
    def __init__(self):
        self._lock = threading.Lock()
        self._count = 0
        self._erase_count = 0
        self._intervals_ms = []
        self._last_press_time = None

        self._listener = keyboard.Listener(on_press=self._on_press)
        self._listener.daemon = True
        self._listener.start()

    def _on_press(self, key):
        now = time.time()
        with self._lock:
            self._count += 1
            try:
                if key.name.lower() in ('backspace', 'delete'):
                    self._erase_count += 1
            except AttributeError:
                pass
            if self._last_press_time is not None:
                interval_ms = (now - self._last_press_time) * 1000.0
                self._intervals_ms.append(interval_ms)
            self._last_press_time = now

    def flush(self) -> dict:
        with self._lock:
            result = {
                "keystroke_count": self._count,
                "erase_key_count": self._erase_count,
                "intervals_ms": list(self._intervals_ms),
            }
            self._count = 0
            self._erase_count = 0
            self._intervals_ms.clear()
            self._last_press_time = None
            return result
