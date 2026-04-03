"""
Inspect raw distraction CSV files and summarize app names with blocker targets.

Usage:
    python scripts/analyze_raw_apps.py
"""

from collections import Counter
import csv
from pathlib import Path
import sys

RAW_DIR = Path(r"E:\SDPPS\distraction_prediction\data\raw")
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


def normalize_value(value):
    return (value or "").strip()


def canonical_app_key(app_name):
    app = normalize_value(app_name).lower()
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


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    foreground_counts = Counter()
    visible_counts = Counter()

    for path in sorted(RAW_DIR.glob("*.csv")):
        with path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                app = normalize_value(row.get("foreground_app_end"))
                if app and app.lower() != "unknown":
                    foreground_counts[app] += 1

                visible = normalize_value(row.get("visible_apps"))
                if not visible:
                    continue
                for item in visible.split(";"):
                    app_name = normalize_value(item)
                    if app_name:
                        visible_counts[app_name] += 1

    all_apps = set(foreground_counts) | set(visible_counts)
    ranked = sorted(
        all_apps,
        key=lambda app: (-(foreground_counts[app] + visible_counts[app]), app.lower()),
    )

    print("app_name\tforeground_count\tvisible_count\tsuggested_block_targets")
    for app_name in ranked:
        targets = ",".join(expand_block_targets(app_name))
        print(
            f"{app_name}\t{foreground_counts[app_name]}\t{visible_counts[app_name]}\t{targets}"
        )


if __name__ == "__main__":
    main()
