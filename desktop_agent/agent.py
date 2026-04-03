"""
SDPPS desktop agent runtime and blocker orchestration.
"""

import json
import time
import threading

from desktop_agent.config import (
    BASE_DIR,
    COLLECT_INTERVAL,
    DISTRACTION_THRESHOLD,
    BLEND_MODE,
)
from desktop_agent.collectors.snapshot import SnapshotCollector
from desktop_agent.predictor import Predictor
from desktop_agent.blocker import Blocker, app_family
from desktop_agent.api_server import create_app

BLOCKER_SETTINGS_PATH = BASE_DIR / "common" / "blocker_settings.json"


class DesktopAgent:
    def __init__(self):
        mode_labels = {
            "pure": "PURE BiLSTM (100%)",
            "light": "LIGHT BLEND (80% BiLSTM + 20% AppCat)",
            "adaptive": "ADAPTIVE BLEND (app-aware weights + streak override)",
        }
        mode_str = mode_labels.get(BLEND_MODE, BLEND_MODE)
        print("=" * 60)
        print("  SDPPS Desktop Agent (v3.2)")
        print("  Student Distraction Prevention & Productivity System")
        print(f"  Mode: {mode_str}")
        print("=" * 60)

        print("\n[Agent] Initializing collectors...")
        self.collector = SnapshotCollector()

        print("[Agent] Loading BiLSTM model...")
        self.predictor = Predictor()

        print("[Agent] Initializing blocker...")
        self.blocker = Blocker()

        settings = self._load_blocker_settings()
        self.auto_block_enabled = bool(settings.get("auto_block_enabled", True))
        self.manual_blocking_enabled = bool(settings.get("manual_blocking_enabled", False))
        self.auto_blocking_active = False
        self.auto_blocked_apps = []
        self.auto_blocked_reasons = {}

        print("[Agent] All components ready.\n")

        self.latest_snapshot = None
        self.latest_prediction = None
        self.snapshot_count = 0
        self.blocking_active = False
        self._prediction_history = []

        self._sync_blocker_state()

    def _load_blocker_settings(self):
        try:
            BLOCKER_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
            if not BLOCKER_SETTINGS_PATH.exists():
                default_settings = {
                    "auto_block_enabled": True,
                    "manual_blocking_enabled": False,
                }
                BLOCKER_SETTINGS_PATH.write_text(
                    json.dumps(default_settings, indent=2),
                    encoding="utf-8",
                )
                return default_settings

            return json.loads(BLOCKER_SETTINGS_PATH.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"[Agent] Failed to load blocker settings: {exc}")
            return {"auto_block_enabled": True, "manual_blocking_enabled": False}

    def _save_blocker_settings(self):
        try:
            payload = {
                "auto_block_enabled": self.auto_block_enabled,
                "manual_blocking_enabled": self.manual_blocking_enabled,
            }
            BLOCKER_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
            BLOCKER_SETTINGS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        except Exception as exc:
            print(f"[Agent] Failed to save blocker settings: {exc}")

    def _sync_blocker_state(self):
        should_block = bool(self.manual_blocking_enabled or self.auto_blocking_active)
        if should_block and not self.blocking_active:
            self.blocker.enable()
            self.blocking_active = True
        elif not should_block and self.blocking_active:
            self.blocker.disable()
            self.blocking_active = False

    def set_manual_blocking(self, enabled):
        self.manual_blocking_enabled = bool(enabled)
        self._save_blocker_settings()
        self._sync_blocker_state()

    def set_auto_block_enabled(self, enabled):
        self.auto_block_enabled = bool(enabled)
        if not self.auto_block_enabled:
            self.auto_blocking_active = False
            self.auto_blocked_apps = []
            self.auto_blocked_reasons = {}
            self.blocker.set_auto_blocked_apps([])
        self._save_blocker_settings()
        self._sync_blocker_state()

    def _recent_distracted_hits(self, family, lookback=5):
        hits = 0
        for entry in reversed(self._prediction_history[-lookback:]):
            if entry.get("label") != "DISTRACTED":
                continue
            if app_family(entry.get("dominant_app")) == family:
                hits += 1
        return hits

    def _consecutive_distracted_hits(self, family):
        hits = 0
        for entry in reversed(self._prediction_history):
            if entry.get("label") != "DISTRACTED":
                break
            if app_family(entry.get("dominant_app")) != family:
                break
            hits += 1
        return hits

    def _should_auto_block_app(self, prediction):
        family = app_family(prediction.get("dominant_app"))
        if not family:
            return False, "missing_app"

        reason = self.blocker.auto_block_reason(family)
        if reason != "eligible":
            return False, reason

        final_prob = float(prediction.get("final_prob", 0) or 0)
        confidence = float(prediction.get("confidence", 0) or 0)
        app_score = float(prediction.get("app_cat_score", 0.5) or 0.5)
        consecutive_hits = self._consecutive_distracted_hits(family)
        recent_hits = self._recent_distracted_hits(family)

        if final_prob < 0.75 or confidence < 0.65:
            return False, "weak_signal"
        if recent_hits < 2:
            return False, "insufficient_history"
        if consecutive_hits < 2 and app_score < 0.8:
            return False, "needs_repeat_confirmation"
        return True, "repeated_distracted_non_browser"

    def _update_auto_block_targets(self, prediction):
        if not self.auto_block_enabled:
            self.auto_blocking_active = False
            self.auto_blocked_apps = []
            self.auto_blocked_reasons = {}
            self.blocker.set_auto_blocked_apps([])
            return

        final_prob = float(prediction.get("final_prob", 0) or 0)
        if final_prob <= 0.35:
            if self.auto_blocking_active:
                print(f"  >> LOW DISTRACTION ({final_prob:.2f}) - disabling auto-block")
            self.auto_blocking_active = False
            self.auto_blocked_apps = []
            self.auto_blocked_reasons = {}
            self.blocker.set_auto_blocked_apps([])
            return

        if final_prob < 0.70:
            self.auto_blocking_active = False
            self.auto_blocked_apps = []
            self.auto_blocked_reasons = {}
            self.blocker.set_auto_blocked_apps([])
            return

        if not self.auto_blocking_active:
            print(f"  >> HIGH DISTRACTION ({final_prob:.2f}) - enabling auto-block")
        self.auto_blocking_active = True

        should_block, reason = self._should_auto_block_app(prediction)
        current_family = app_family(prediction.get("dominant_app"))

        if not should_block:
            if current_family and reason.endswith("_exempt"):
                print(f"  >> Auto-block skipped for {current_family}: {reason}")
            self.blocker.set_auto_blocked_apps(self.auto_blocked_apps)
            return

        normalized_app = self.blocker._normalize_app_name(current_family)
        if normalized_app and normalized_app not in self.auto_blocked_apps:
            self.auto_blocked_apps.append(normalized_app)
            self.auto_blocked_apps = self.blocker._normalize_app_names(self.auto_blocked_apps)
            self.auto_blocked_reasons[normalized_app] = reason
            print(f"  >> Auto-blocking app family: {normalized_app} ({reason})")

        self.blocker.set_auto_blocked_apps(self.auto_blocked_apps)

    def start_api(self):
        app = create_app(self)
        print("[Agent] API server starting at http://127.0.0.1:5000")
        app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)

    def run(self):
        api_thread = threading.Thread(target=self.start_api, daemon=True)
        api_thread.start()

        print(
            f"[Agent] Collecting every {COLLECT_INTERVAL}s | "
            f"Threshold: {DISTRACTION_THRESHOLD} | Mode: {BLEND_MODE}"
        )
        print()

        try:
            while True:
                snapshot = self.collector.collect()
                self.snapshot_count += 1
                self.latest_snapshot = snapshot

                ts = time.strftime("%H:%M:%S")
                app_name = snapshot.get("current_app", "?")
                title = snapshot.get("current_title", "")
                title_short = title[:60] + "..." if len(title) > 60 else title

                print(f"[Snapshot #{self.snapshot_count}] {ts}")
                print(f"  App: {app_name} | Title: {title_short}")
                print(
                    f"  Keys={snapshot.get('keystroke_count', 0)}, "
                    f"Clicks={snapshot.get('mouse_clicks', 0)}, "
                    f"Moves={snapshot.get('mouse_moves', 0)}, "
                    f"Scrolls={snapshot.get('mouse_scrolls', 0)}, "
                    f"Idle={snapshot.get('idle_seconds', 0)}s"
                )
                print(
                    f"  CPU={snapshot.get('cpu_usage', 0):.1f}%, "
                    f"Mem={snapshot.get('memory_usage', 0):.1f}%, "
                    f"Apps={snapshot.get('num_visible_apps', 0)}, "
                    f"Switches={snapshot.get('app_switches', 0)}, "
                    f"Dwell={snapshot.get('final_app_dwell', 0)}s"
                )
                print(
                    f"  NetSent={snapshot.get('bytes_sent', 0)}, "
                    f"NetRecv={snapshot.get('bytes_received', 0)}, "
                    f"Session={snapshot.get('session_time_minutes', 0)}min, "
                    f"Engage={snapshot.get('engagement_momentum', 0)}, "
                    f"AppCatScore={snapshot.get('app_category_score', 0.5):.2f}"
                )

                result = self.predictor.predict(snapshot)

                if result.get("status") == "filling":
                    count = result["window_count"]
                    needed = result["needed"]
                    print(
                        f"  Filling window... {count}/{self.predictor.window_size} "
                        f"(need {needed} more)"
                    )
                else:
                    bilstm = result["bilstm_prob"]
                    full_w = result["bilstm_full"]
                    recent = result["bilstm_recency"]
                    appcat = result["app_cat_score"]
                    final = result["final_prob"]
                    label = result["label"]
                    conf = result["confidence"]
                    mode = result["blend_mode"]
                    dom = result["dominant_app"]
                    streak = result.get("streak_count", 0)

                    self.latest_prediction = result
                    self._prediction_history.append(
                        {
                            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                            "label": label,
                            "final_prob": final,
                            "bilstm_prob": bilstm,
                            "app_cat_score": appcat,
                            "confidence": conf,
                            "dominant_app": dom,
                            "streak_count": streak,
                            "blend_mode": mode,
                            "raw_features": {
                                "cpu_usage": snapshot.get("cpu_usage", 0),
                                "memory_usage": snapshot.get("memory_usage", 0),
                                "keystroke_count": snapshot.get("keystroke_count", 0),
                                "mouse_clicks": snapshot.get("mouse_clicks", 0),
                                "mouse_moves": snapshot.get("mouse_moves", 0),
                                "mouse_scrolls": snapshot.get("mouse_scrolls", 0),
                                "idle_seconds": snapshot.get("idle_seconds", 0),
                                "app_switches": snapshot.get("app_switches", 0),
                            },
                        }
                    )

                    print(
                        f"  >> BiLSTM={bilstm:.4f} (full={full_w:.4f}, recent={recent:.4f}) | "
                        f"AppCat={appcat:.4f} ({result['app_cat_label']}) | "
                        f"Streak={streak} | Final={final:.4f} [{mode}]"
                    )
                    print(
                        f"  >> Prediction: {label} (confidence {conf * 100:.1f}%) | "
                        f"DomApp: {dom}"
                    )

                    self._update_auto_block_targets(result)
                    self._sync_blocker_state()

                if self.blocking_active:
                    self.blocker.enforce_blocked_apps()

                print()
                time.sleep(COLLECT_INTERVAL)

        except KeyboardInterrupt:
            print("\n[Agent] Shutting down...")
            if self.blocking_active:
                self.blocker.disable()
            print("[Agent] Stopped.")


if __name__ == "__main__":
    agent = DesktopAgent()
    agent.run()
