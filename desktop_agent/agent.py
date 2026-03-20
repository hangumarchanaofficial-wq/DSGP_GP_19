"""
SDPPS - Desktop Agent (v3.2)
==============================
Supports pure, light-blend, and adaptive-blend modes.
Shows recency vs full-window prediction breakdown + app streak count.
"""

import time
import threading
from desktop_agent.config import (
    BASE_DIR, MODEL_PATH, SCALER_PATH, FEATURE_COLUMNS_PATH,
    COLLECT_INTERVAL, DISTRACTION_THRESHOLD, BLEND_MODE,
)
from desktop_agent.collectors.snapshot import SnapshotCollector
from desktop_agent.predictor import Predictor
from desktop_agent.blocker import Blocker
from desktop_agent.api_server import create_app


class DesktopAgent:
    def __init__(self):
        mode_labels = {
            "pure":     "PURE BiLSTM (100%)",
            "light":    "LIGHT BLEND (80% BiLSTM + 20% AppCat)",
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

        print("[Agent] All components ready.\n")

        # Shared state for API
        self.latest_snapshot = None
        self.latest_prediction = None
        self.snapshot_count = 0
        self.blocking_active = False
        self._prediction_history = []

    def start_api(self):
        app = create_app(self)
        print(f"[Agent] API server starting at http://127.0.0.1:5000")
        app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)

    def run(self):
        # Start API in background thread
        api_thread = threading.Thread(target=self.start_api, daemon=True)
        api_thread.start()

        print(f"[Agent] Collecting every {COLLECT_INTERVAL}s | "
              f"Threshold: {DISTRACTION_THRESHOLD} | Mode: {BLEND_MODE}")
        print()

        try:
            while True:
                snapshot = self.collector.collect()
                self.snapshot_count += 1
                self.latest_snapshot = snapshot

                # -- Print snapshot info --
                ts = time.strftime("%H:%M:%S")
                app_name = snapshot.get("current_app", "?")
                title = snapshot.get("current_title", "")
                title_short = title[:60] + "..." if len(title) > 60 else title

                print(f"[Snapshot #{self.snapshot_count}] {ts}")
                print(f"  App: {app_name} | Title: {title_short}")
                print(f"  Keys={snapshot.get('keystroke_count', 0)}, "
                      f"Clicks={snapshot.get('mouse_clicks', 0)}, "
                      f"Moves={snapshot.get('mouse_moves', 0)}, "
                      f"Scrolls={snapshot.get('mouse_scrolls', 0)}, "
                      f"Idle={snapshot.get('idle_seconds', 0)}s")
                print(f"  CPU={snapshot.get('cpu_usage', 0):.1f}%, "
                      f"Mem={snapshot.get('memory_usage', 0):.1f}%, "
                      f"Apps={snapshot.get('num_visible_apps', 0)}, "
                      f"Switches={snapshot.get('app_switches', 0)}, "
                      f"Dwell={snapshot.get('final_app_dwell', 0)}s")
                print(f"  NetSent={snapshot.get('bytes_sent', 0)}, "
                      f"NetRecv={snapshot.get('bytes_received', 0)}, "
                      f"Session={snapshot.get('session_time_minutes', 0)}min, "
                      f"Engage={snapshot.get('engagement_momentum', 0)}, "
                      f"AppCatScore={snapshot.get('app_category_score', 0.5):.2f}")

                # -- Prediction --
                result = self.predictor.predict(snapshot)

                if result.get("status") == "filling":
                    count = result["window_count"]
                    needed = result["needed"]
                    print(f"  Filling window... {count}/{self.predictor.window_size} "
                          f"(need {needed} more)")
                else:
                    # Extract values FIRST
                    bilstm = result["bilstm_prob"]
                    full_w  = result["bilstm_full"]
                    recent  = result["bilstm_recency"]
                    appcat  = result["app_cat_score"]
                    final   = result["final_prob"]
                    label   = result["label"]
                    conf    = result["confidence"]
                    mode    = result["blend_mode"]
                    dom     = result["dominant_app"]
                    streak  = result.get("streak_count", 0)

                    # Store prediction
                    self.latest_prediction = result

                    # Append to history
                    self._prediction_history.append({
                        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
                        'label': label,
                        'final_prob': final,
                        'bilstm_prob': bilstm,
                        'app_cat_score': appcat,
                        'confidence': conf,
                        'dominant_app': dom,
                        'streak_count': streak,
                        'blend_mode': mode,
                        'raw_features': {
                            'cpu_usage': snapshot.get('cpu_usage', 0),
                            'memory_usage': snapshot.get('memory_usage', 0),
                            'keystroke_count': snapshot.get('keystroke_count', 0),
                            'mouse_clicks': snapshot.get('mouse_clicks', 0),
                            'mouse_moves': snapshot.get('mouse_moves', 0),
                            'mouse_scrolls': snapshot.get('mouse_scrolls', 0),
                            'idle_seconds': snapshot.get('idle_seconds', 0),
                            'app_switches': snapshot.get('app_switches', 0),
                        },
                    })

                    # Print prediction
                    print(f"  >> BiLSTM={bilstm:.4f} (full={full_w:.4f}, "
                          f"recent={recent:.4f}) | "
                          f"AppCat={appcat:.4f} ({result['app_cat_label']}) | "
                          f"Streak={streak} | Final={final:.4f} [{mode}]")
                    print(f"  >> Prediction: {label} (confidence {conf * 100:.1f}%) "
                          f"| DomApp: {dom}")

                    # -- Auto-block logic --
                    if final >= 0.70:
                        if not self.blocking_active:
                            print(f"  >> HIGH DISTRACTION ({final:.2f}) - enabling blocker")
                            self.blocker.enable()
                            self.blocking_active = True
                    elif final <= 0.35:
                        if self.blocking_active:
                            print(f"  >> LOW DISTRACTION ({final:.2f}) - disabling blocker")
                            self.blocker.disable()
                            self.blocking_active = False

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
