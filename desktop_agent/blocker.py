"""
blocker.py — Block distracting websites (hosts file) and kill distracting apps
"""

import os, ctypes, subprocess, psutil
from desktop_agent.config import BLOCKED_SITES, BLOCKED_APPS

HOSTS_PATH = r"C:\Windows\System32\drivers\etc\hosts"
BLOCK_MARKER = "# SDPPS-BLOCK"


class Blocker:
    def __init__(self):
        self.active = False
        self.is_admin = self._check_admin()
        if not self.is_admin:
            print("[Blocker] Not admin — website blocking unavailable. Run as Administrator for full blocking.")

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
        print("[Blocker] Enabled — sites blocked, distracting apps killed.")

    def disable(self):
        if not self.active:
            return
        self.active = False
        self._unblock_sites()
        print("[Blocker] Disabled — sites unblocked.")

    def _block_sites(self):
        if not self.is_admin:
            print("[Blocker] Not admin — skipping hosts file.")
            return
        try:
            with open(HOSTS_PATH, "r") as f:
                content = f.read()
            lines_to_add = []
            for site in BLOCKED_SITES:
                entry = f"127.0.0.1  {site}  {BLOCK_MARKER}"
                if entry not in content:
                    lines_to_add.append(entry)
            if lines_to_add:
                with open(HOSTS_PATH, "a") as f:
                    f.write("\n" + "\n".join(lines_to_add) + "\n")
                subprocess.run(["ipconfig", "/flushdns"], capture_output=True)
        except Exception as e:
            print(f"[Blocker] Error blocking sites: {e}")

    def _unblock_sites(self):
        if not self.is_admin:
            return
        try:
            with open(HOSTS_PATH, "r") as f:
                lines = f.readlines()
            with open(HOSTS_PATH, "w") as f:
                for line in lines:
                    if BLOCK_MARKER not in line:
                        f.write(line)
            subprocess.run(["ipconfig", "/flushdns"], capture_output=True)
        except Exception as e:
            print(f"[Blocker] Error unblocking sites: {e}")

    def _kill_apps(self):
        for proc in psutil.process_iter(["name"]):
            try:
                if proc.info["name"] and proc.info["name"].lower() in [a.lower() for a in BLOCKED_APPS]:
                    proc.kill()
                    print(f"[Blocker] Killed {proc.info['name']}")
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
