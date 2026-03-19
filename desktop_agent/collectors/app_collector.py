"""
app_collector.py – Matches LocalAgent.py EXACTLY.
- Filters out explorer.exe and backgroundtaskhost.exe from visible apps.
- Handles ApplicationFrameHost.exe -> window title mapping.
- final_app_dwell accumulated as integer seconds.
- Skips explorer.exe for app switch tracking.
"""

import time
import threading

try:
    import win32gui
    import win32process
    import psutil as _psutil
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

_EXCLUDED_APPS = {'explorer.exe', 'backgroundtaskhost.exe'}


class AppCollector:
    def __init__(self):
        self._lock = threading.Lock()
        self._switches = 0
        self._last_app = None
        self._last_title = ""
        self._dwell_start = time.time()
        self._dwell_time = 0
        self._running = False
        self._thread = None
        self._app_history = []
        self._last_real_app = None

    def start(self):
        self._running = True
        self._dwell_start = time.time()
        self._dwell_time = 0
        if HAS_WIN32:
            self._thread = threading.Thread(target=self._poll_loop, daemon=True)
            self._thread.start()

    def stop(self):
        self._running = False

    def _get_active_app(self):
        try:
            hwnd = win32gui.GetForegroundWindow()
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            proc_name = _psutil.Process(pid).name()
            title = win32gui.GetWindowText(hwnd).strip()
            if proc_name == "ApplicationFrameHost.exe" and title:
                return title, title
            return proc_name, title
        except Exception:
            return "unknown", ""

    def _count_visible_windows(self):
        app_set = set()
        def cb(hwnd, _):
            if win32gui.IsWindowVisible(hwnd):
                try:
                    _, pid = win32process.GetWindowThreadProcessId(hwnd)
                    pname = _psutil.Process(pid).name()
                    title = win32gui.GetWindowText(hwnd).strip()
                    if pname and pname.lower() not in _EXCLUDED_APPS:
                        if pname == "ApplicationFrameHost.exe" and title:
                            app_set.add(title)
                        else:
                            app_set.add(pname)
                except Exception:
                    pass
        try:
            win32gui.EnumWindows(cb, None)
        except Exception:
            pass
        return len(app_set)

    def _poll_loop(self):
        while self._running:
            app, title = self._get_active_app()
            with self._lock:
                if app.lower() != "explorer.exe" and app:
                    self._app_history.append((app, title))
                    if app != self._last_app and self._last_app is not None:
                        self._dwell_time = int(time.time() - self._dwell_start)
                        self._switches += 1
                        self._dwell_start = time.time()
                    self._last_app = app
                    self._last_title = title
                    self._last_real_app = app
            time.sleep(1)

    def flush(self) -> dict:
        with self._lock:
            dwell = self._dwell_time + int(time.time() - self._dwell_start)
            visible = self._count_visible_windows() if HAS_WIN32 else 1

            result = {
                "app_switches": self._switches,
                "final_app_dwell": dwell,
                "num_visible_apps": visible,
                "current_app": self._last_real_app or "unknown",
                "current_title": self._last_title or "",
                "app_history": list(self._app_history),
            }
            self._switches = 0
            self._dwell_time = 0
            self._dwell_start = time.time()
            self._app_history.clear()
            return result
