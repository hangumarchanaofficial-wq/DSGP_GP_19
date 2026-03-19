"""
SDPPS – Snapshot Collector (v3.1)
==================================
Collects one system-wide snapshot every interval.
Now includes 24 features: 22 base + app_score_squared + is_entertainment.
"""

import time
import psutil
import statistics
from datetime import datetime
from collections import Counter

from desktop_agent.collectors.app_collector import AppCollector
from desktop_agent.collectors.keyboard_collector import KeyboardCollector
from desktop_agent.collectors.mouse_collector import MouseCollector
from desktop_agent.collectors.idle_collector import IdleCollector
from desktop_agent.app_categorizer import categorize_app


class SnapshotCollector:
    def __init__(self):
        self.app = AppCollector()
        self.keyboard = KeyboardCollector()
        self.mouse = MouseCollector()
        self.idle = IdleCollector()

        self.app.start()
        self.idle.start()

        self._session_start = time.time()
        self._last_snapshot_time = None
        self._prev_app = None
        self._prev_momentum = 0.0

    def collect(self) -> dict:
        now = datetime.now()
        timestamp = now.strftime("%Y-%m-%d %H:%M:%S")
        hour = now.hour
        day_of_week_num = now.weekday()

        # ── Time diff ────────────────────────────────────────────
        if self._last_snapshot_time is None:
            time_diff = 0.0
        else:
            time_diff = time.time() - self._last_snapshot_time
        self._last_snapshot_time = time.time()

        session_minutes = (time.time() - self._session_start) / 60.0

        # ── App info ─────────────────────────────────────────────
        ap = self.app.flush()
        current_app = ap.get("current_app", "unknown")
        current_title = ap.get("current_title", "")
        app_switches = ap.get("app_switches", 0)
        final_app_dwell = ap.get("final_app_dwell", 0)
        visible_apps = ap.get("num_visible_apps", 0)
        num_visible_apps = visible_apps if isinstance(visible_apps, int) else len(visible_apps)

        # ── Keyboard ─────────────────────────────────────────────
        kb = self.keyboard.flush()
        keystroke_count = kb.get("keystroke_count", 0)
        erase_key_count = kb.get("erase_key_count", 0)
        erase_key_pct = (erase_key_count / keystroke_count * 100.0) if keystroke_count > 0 else 0.0
        intervals = kb.get("intervals_ms", [])
        avg_press_interval_ms = statistics.mean(intervals) if intervals else 0.0
        std_press_interval_ms = statistics.stdev(intervals) if len(intervals) >= 2 else 0.0

        # ── Mouse ────────────────────────────────────────────────
        ms = self.mouse.flush()
        mouse_clicks = ms.get("clicks", 0)
        mouse_moves = ms.get("moves", 0)
        mouse_scrolls = ms.get("scrolls", 0)

        # ── Idle ─────────────────────────────────────────────────
        idle_data = self.idle.collect_and_reset()
        idle_seconds = idle_data.get("idle_time_total", 0.0)

        # ── System ───────────────────────────────────────────────
        cpu_usage = psutil.cpu_percent(interval=0)
        memory_usage = psutil.virtual_memory().percent
        net = psutil.net_io_counters()
        bytes_sent = net.bytes_sent
        bytes_received = net.bytes_recv

        # ── Engagement momentum ──────────────────────────────────
        raw_engagement = keystroke_count + mouse_clicks + mouse_moves + mouse_scrolls
        alpha = 0.3
        engagement_momentum = alpha * raw_engagement + (1 - alpha) * self._prev_momentum
        self._prev_momentum = engagement_momentum

        # ── App switches (from prev) ────────────────────────────
        if self._prev_app is not None and current_app != self._prev_app:
            app_switches = max(app_switches, 1)
        self._prev_app = current_app

        # ── App category score (feature 22) ──────────────────────
        app_category_score = categorize_app(current_app, current_title)

        # ── Derived app features (features 23-24) ────────────────
        app_score_squared = round(app_category_score ** 2, 4)
        is_entertainment = 1.0 if app_category_score >= 0.70 else 0.0

        # ── Build feature dict (24 features, training order) ─────
        features = {
            "app_switches":          app_switches,
            "final_app_dwell":       final_app_dwell,
            "num_visible_apps":      num_visible_apps,
            "cpu_usage":             cpu_usage,
            "memory_usage":          memory_usage,
            "bytes_sent":            bytes_sent,
            "bytes_received":        bytes_received,
            "hour":                  hour,
            "session_time_minutes":  round(session_minutes, 2),
            "keystroke_count":       keystroke_count,
            "erase_key_count":       erase_key_count,
            "erase_key_pct":         round(erase_key_pct, 2),
            "avg_press_interval_ms": round(avg_press_interval_ms, 2),
            "std_press_interval_ms": round(std_press_interval_ms, 2),
            "mouse_clicks":          mouse_clicks,
            "mouse_moves":           mouse_moves,
            "mouse_scrolls":         mouse_scrolls,
            "idle_seconds":          round(idle_seconds, 1),
            "engagement_momentum":   round(engagement_momentum, 2),
            "time_diff_seconds":     round(time_diff, 2),
            "day_of_week_num":       day_of_week_num,
            "app_category_score":    app_category_score,
            "app_score_squared":     app_score_squared,
            "is_entertainment":      is_entertainment,
        }

        # ── Metadata (not fed to model) ─────────────────────────
        metadata = {
            "timestamp":     timestamp,
            "current_app":   current_app,
            "current_title": current_title,
            "visible_apps":  ap.get("app_history", []),
        }

        return {**features, **metadata}
