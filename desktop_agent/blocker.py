"""
Block distracting websites via the hosts file and kill distracting apps.
"""

import ctypes
import json
import os
import subprocess

import psutil

from desktop_agent.config import BASE_DIR, BLOCKED_SITES

HOSTS_PATH = r"C:\Windows\System32\drivers\etc\hosts"
BLOCK_MARKER = "# SDPPS-BLOCK"
BLOCKED_APPS_PATH = BASE_DIR / "common" / "blocked_apps.json"

# Runtime aliases for apps that appear under multiple foreground/window names.
APP_ALIAS_GROUPS = {
    "whatsapp": ["whatsapp.exe", "whatsapp.root.exe"],
    "whatsapp.root": ["whatsapp.exe", "whatsapp.root.exe"],
    "chatgpt": ["chatgpt.exe"],
    "chrome": ["chrome.exe"],
    "brave": ["brave.exe"],
    "discord": ["discord.exe"],
    "spotify": ["spotify.exe"],
    "media player": ["microsoft.media.player.exe", "video.ui.exe"],
    "microsoft store": ["winstore.app.exe"],
    "calculator": ["calculatorapp.exe"],
    "settings": ["systemsettings.exe"],
}

BROWSER_FAMILIES = {
    "chrome",
    "msedge",
    "firefox",
    "brave",
    "opera",
    "iexplore",
    "arc",
}

PRODUCTIVE_FAMILIES = {
    "code",
    "pycharm64",
    "pycharm",
    "idea64",
    "idea",
    "devenv",
    "excel",
    "winword",
    "powerpnt",
    "onenote",
    "zoom",
    "teams",
    "slack",
    "obsidian",
    "notion",
    "figma",
    "packettracer",
    "systemsettings",
    "settings",
    "calculatorapp",
    "calculator",
}

SYSTEM_FAMILIES = {
    "explorer",
    "searchhost",
    "startmenuexperiencehost",
    "shellexperiencehost",
    "taskmgr",
    "applicationframehost",
    "lockapp",
    "dllhost",
    "textinputhost",
}


def canonical_app_key(app_name):
    app = str(app_name or "").strip().lower()
    if not app:
        return ""
    return app[:-4] if app.endswith(".exe") else app


def normalize_app_name(app_name):
    key = canonical_app_key(app_name)
    if not key:
        return ""
    return key if key.endswith(".exe") else f"{key}.exe"


def expand_block_targets(app_name):
    key = canonical_app_key(app_name)
    if not key:
        return []

    targets = set()
    if " " not in key or key not in APP_ALIAS_GROUPS:
        targets.add(normalize_app_name(key))
    for alias in APP_ALIAS_GROUPS.get(key, []):
        normalized = normalize_app_name(alias)
        if normalized:
            targets.add(normalized)

    if key.endswith(".root"):
        normalized = normalize_app_name(key[:-5])
        if normalized:
            targets.add(normalized)

    return sorted(targets)


def app_family(app_name):
    key = canonical_app_key(app_name)
    if key in {"whatsapp", "whatsapp.root"}:
        return "whatsapp"
    if key in {"media player", "microsoft.media.player", "video.ui"}:
        return "media player"
    if key in {"settings", "systemsettings"}:
        return "settings"
    if key in {"calculator", "calculatorapp"}:
        return "calculator"
    return key


class Blocker:
    def __init__(self):
        self.active = False
        self.is_admin = self._check_admin()
        self._blocked_apps_path = str(BLOCKED_APPS_PATH)
        self._custom_blocked_apps = self._load_custom_blocked_apps()
        self._temporary_auto_blocked_apps = []
        if not self.is_admin:
            print("[Blocker] Not admin - website blocking unavailable. Run as Administrator for full blocking.")

    def _normalize_app_name(self, app_name):
        return normalize_app_name(app_name)

    def _normalize_app_names(self, app_names):
        normalized = []
        seen = set()
        for app_name in app_names or []:
            app = self._normalize_app_name(app_name)
            if app and app not in seen:
                normalized.append(app)
                seen.add(app)
        return normalized

    def _load_custom_blocked_apps(self):
        try:
            os.makedirs(os.path.dirname(self._blocked_apps_path), exist_ok=True)
            if not os.path.exists(self._blocked_apps_path):
                with open(self._blocked_apps_path, "w", encoding="utf-8") as f:
                    json.dump({"apps": []}, f, indent=2)
                return []

            with open(self._blocked_apps_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return self._normalize_app_names(data.get("apps", []))
        except Exception as exc:
            print(f"[Blocker] Failed to load custom blocked apps: {exc}")
            return []

    def _save_custom_blocked_apps(self):
        try:
            with open(self._blocked_apps_path, "w", encoding="utf-8") as f:
                json.dump({"apps": self._custom_blocked_apps}, f, indent=2)
        except Exception as exc:
            print(f"[Blocker] Failed to save custom blocked apps: {exc}")

    def _expanded_blocked_targets(self, app_names):
        targets = []
        seen = set()
        for app_name in app_names:
            for target in expand_block_targets(app_name):
                if target not in seen:
                    targets.append(target)
                    seen.add(target)
        return targets

    def get_blocked_apps(self):
        return self._normalize_app_names(self._custom_blocked_apps)

    def get_manual_blocked_apps(self):
        return self.get_blocked_apps()

    def get_auto_blocked_apps(self):
        return self._normalize_app_names(self._temporary_auto_blocked_apps)

    def get_effective_blocked_apps(self):
        return self._normalize_app_names(self.get_manual_blocked_apps() + self.get_auto_blocked_apps())

    def is_browser_app(self, app_name):
        return app_family(app_name) in BROWSER_FAMILIES

    def is_protected_app(self, app_name):
        family = app_family(app_name)
        return family in BROWSER_FAMILIES or family in PRODUCTIVE_FAMILIES or family in SYSTEM_FAMILIES

    def auto_block_reason(self, app_name):
        family = app_family(app_name)
        if not family:
            return "missing_app"
        if family in BROWSER_FAMILIES:
            return "browser_exempt"
        if family in PRODUCTIVE_FAMILIES:
            return "productive_exempt"
        if family in SYSTEM_FAMILIES:
            return "system_exempt"
        return "eligible"

    def add_blocked_app(self, app_name):
        app = self._normalize_app_name(app_name)
        if not app:
            return self.get_blocked_apps()
        if app not in self._custom_blocked_apps:
            self._custom_blocked_apps.append(app)
            self._custom_blocked_apps = self._normalize_app_names(self._custom_blocked_apps)
            self._save_custom_blocked_apps()

        # Kill matching aliases immediately so "Block" behaves like a real action.
        self._kill_matching_apps(set(expand_block_targets(app)))
        return self.get_blocked_apps()

    def remove_blocked_app(self, app_name):
        app = self._normalize_app_name(app_name)
        if app in self._custom_blocked_apps:
            self._custom_blocked_apps = [item for item in self._custom_blocked_apps if item != app]
            self._save_custom_blocked_apps()
        return self.get_blocked_apps()

    def _check_admin(self):
        try:
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            return False

    def enable(self):
        if self.active:
            return
        self.active = True
        self._block_sites()
        self._kill_apps()
        print("[Blocker] Enabled - sites blocked, distracting apps killed.")

    def disable(self):
        if not self.active:
            return
        self.active = False
        self._unblock_sites()
        print("[Blocker] Disabled - sites unblocked.")

    def _block_sites(self):
        if not self.is_admin:
            print("[Blocker] Not admin - skipping hosts file.")
            return
        try:
            with open(HOSTS_PATH, "r", encoding="utf-8") as f:
                content = f.read()
            lines_to_add = []
            for site in BLOCKED_SITES:
                entry = f"127.0.0.1  {site}  {BLOCK_MARKER}"
                if entry not in content:
                    lines_to_add.append(entry)
            if lines_to_add:
                with open(HOSTS_PATH, "a", encoding="utf-8") as f:
                    f.write("\n" + "\n".join(lines_to_add) + "\n")
                subprocess.run(["ipconfig", "/flushdns"], capture_output=True)
        except Exception as exc:
            print(f"[Blocker] Error blocking sites: {exc}")

    def _unblock_sites(self):
        if not self.is_admin:
            return
        try:
            with open(HOSTS_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
            with open(HOSTS_PATH, "w", encoding="utf-8") as f:
                for line in lines:
                    if BLOCK_MARKER not in line:
                        f.write(line)
            subprocess.run(["ipconfig", "/flushdns"], capture_output=True)
        except Exception as exc:
            print(f"[Blocker] Error unblocking sites: {exc}")

    def _kill_matching_apps(self, blocked_apps):
        if not blocked_apps:
            return
        for proc in psutil.process_iter(["name"]):
            try:
                proc_name = self._normalize_app_name(proc.info["name"])
                if proc_name and proc_name in blocked_apps:
                    proc.kill()
                    print(f"[Blocker] Killed {proc.info['name']}")
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

    def _kill_apps(self):
        self._kill_matching_apps(set(self._expanded_blocked_targets(self.get_effective_blocked_apps())))

    def set_auto_blocked_apps(self, app_names):
        self._temporary_auto_blocked_apps = self._normalize_app_names(app_names)
        if self.active:
            self._kill_apps()
        return self.get_auto_blocked_apps()

    def enforce_blocked_apps(self):
        if not self.active:
            return
        self._kill_apps()
