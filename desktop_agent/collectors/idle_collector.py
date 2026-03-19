"""
idle_collector.py – System-wide idle detection via Windows API.
"""

import time
import threading
import ctypes
import ctypes.wintypes


class LASTINPUTINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", ctypes.wintypes.UINT),
        ("dwTime", ctypes.wintypes.DWORD),
    ]


def get_idle_seconds():
    lii = LASTINPUTINFO()
    lii.cbSize = ctypes.sizeof(LASTINPUTINFO)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
    millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
    return millis / 1000.0


class IdleCollector:
    def __init__(self, poll_interval=1.0, idle_threshold=10.0):
        self._lock = threading.Lock()
        self._poll_interval = poll_interval
        self._idle_threshold = idle_threshold
        self._running = False
        self._thread = None
        self._reset()

    def _reset(self):
        self.idle_time_total = 0.0
        self.idle_count = 0
        self.longest_idle = 0.0
        self._current_idle_start = None
        self._was_idle = False
        self._start_time = time.time()

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._poll_loop, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)

    def _poll_loop(self):
        while self._running:
            idle_secs = get_idle_seconds()
            with self._lock:
                is_idle = idle_secs > self._idle_threshold
                if is_idle and not self._was_idle:
                    self._current_idle_start = time.time()
                    self.idle_count += 1
                    self._was_idle = True
                elif not is_idle and self._was_idle:
                    if self._current_idle_start:
                        duration = time.time() - self._current_idle_start
                        self.idle_time_total += duration
                        self.longest_idle = max(self.longest_idle, duration)
                    self._was_idle = False
                    self._current_idle_start = None
            time.sleep(self._poll_interval)

    def collect_and_reset(self):
        with self._lock:
            elapsed = max(time.time() - self._start_time, 1.0)
            if self._was_idle and self._current_idle_start:
                ongoing = time.time() - self._current_idle_start
                idle_total = self.idle_time_total + ongoing
                longest = max(self.longest_idle, ongoing)
            else:
                idle_total = self.idle_time_total
                longest = self.longest_idle
            active_ratio = 1.0 - (idle_total / elapsed)
            count = self.idle_count
            self._reset()
        return {
            "idle_time_total": idle_total,
            "idle_count": count,
            "longest_idle": longest,
            "active_time_ratio": max(active_ratio, 0.0),
        }
