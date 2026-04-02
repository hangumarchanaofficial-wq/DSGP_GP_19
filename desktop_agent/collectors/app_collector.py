"""
app_collector.py
- Filters out explorer.exe and backgroundtaskhost.exe from visible apps.
- Handles ApplicationFrameHost.exe -> window title mapping.
- final_app_dwell accumulated as integer seconds.
- Skips explorer.exe for app switch tracking.
"""

import ctypes
import os
import threading
import time

try:
    import win32gui
    import win32process
    import psutil as _psutil
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False
    _psutil = None

try:
    import psutil
except ImportError:
    psutil = None

_EXCLUDED_APPS = {"explorer.exe", "backgroundtaskhost.exe"}
HAS_CTYPES_WIN = os.name == "nt"


def _normalize_app_name(proc_name, title):
    proc_name = (proc_name or "").strip()
    title = (title or "").strip()
    if proc_name == "ApplicationFrameHost.exe" and title:
        return title, title
    if proc_name:
        return proc_name, title
    return "unknown", title


def _get_active_app_via_ctypes():
    if not HAS_CTYPES_WIN or psutil is None:
        return "unknown", ""

    user32 = ctypes.windll.user32
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return "unknown", ""

    length = user32.GetWindowTextLengthW(hwnd)
    buffer = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buffer, length + 1)
    title = buffer.value.strip()

    pid = ctypes.c_ulong()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if not pid.value:
        return "unknown", title

    try:
        proc_name = psutil.Process(pid.value).name()
    except Exception:
        proc_name = ""

    return _normalize_app_name(proc_name, title)


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
        if HAS_WIN32 or HAS_CTYPES_WIN:
            self._thread = threading.Thread(target=self._poll_loop, daemon=True)
            self._thread.start()

    def stop(self):
        self._running = False

    def _get_active_app(self):
        if HAS_WIN32:
            try:
                hwnd = win32gui.GetForegroundWindow()
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                proc_name = _psutil.Process(pid).name()
                title = win32gui.GetWindowText(hwnd).strip()
                return _normalize_app_name(proc_name, title)
            except Exception:
                pass
        return _get_active_app_via_ctypes()

    def _count_visible_windows(self):
        if not HAS_WIN32:
            app, _ = self._get_active_app()
            return 0 if app == "unknown" else 1

        app_set = set()

        def cb(hwnd, _):
            if not win32gui.IsWindowVisible(hwnd):
                return
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
                if app and app.lower() != "explorer.exe":
                    self._app_history.append((app, title))
                    if app != self._last_app and self._last_app is not None:
                        self._dwell_time = int(time.time() - self._dwell_start)
                        self._switches += 1
                        self._dwell_start = time.time()
                    self._last_app = app
                    self._last_title = title
                    if app != "unknown":
                        self._last_real_app = app
            time.sleep(1)

    def flush(self) -> dict:
        with self._lock:
            current_app = self._last_real_app
            current_title = self._last_title or ""

            if not current_app or current_app == "unknown":
                app, title = self._get_active_app()
                if app and app != "unknown":
                    self._last_real_app = app
                    self._last_app = app
                    if title:
                        self._last_title = title
                    current_app = app
                    current_title = self._last_title
                else:
                    current_app = "unknown"
                    current_title = title or current_title

            dwell = self._dwell_time + int(time.time() - self._dwell_start)
            visible = self._count_visible_windows()

            result = {
                "app_switches": self._switches,
                "final_app_dwell": dwell,
                "num_visible_apps": visible,
                "current_app": current_app,
                "current_title": current_title,
                "app_history": list(self._app_history),
            }
            self._switches = 0
            self._dwell_time = 0
            self._dwell_start = time.time()
            self._app_history.clear()
            return result
