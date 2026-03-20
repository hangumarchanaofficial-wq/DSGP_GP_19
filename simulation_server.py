"""
SDPPS – Simulation Server (v1.0)
==================================
Runs a fake API at http://127.0.0.1:5000 that simulates
the desktop agent with realistic cycling data.
No model, no collectors, no GPU needed.
Perfect for frontend development and demos.

Usage:
    python simulation_server.py
"""

import time
import random
import threading
from datetime import datetime, timedelta
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ═══════════════════════════════════════════════════════════════════
#  Simulation State
# ═══════════════════════════════════════════════════════════════════

SIM = {
    "running": True,
    "snapshot_count": 0,
    "window_size": 10,
    "window_filled": False,
    "blocking_active": False,
    "history": [],
    "latest_prediction": None,
    "latest_snapshot": None,
}

# ─── Scenario timeline ───────────────────────────────────────────
# Each entry: (app, title, app_cat_score, app_cat_label, base_prob, duration_snapshots)
SCENARIOS = [
    # Warm-up: filling window
    ("pycharm64.exe", "SDPPS – main.py", 0.00, "productive", 0.05, 3),
    # Focused coding session
    ("pycharm64.exe", "SDPPS – predictor.py", 0.00, "productive", 0.08, 5),
    ("pycharm64.exe", "SDPPS – train.py", 0.00, "productive", 0.12, 4),
    # Quick Chrome research (neutral)
    ("chrome.exe", "Stack Overflow - Python BiLSTM - Google Chrome", 0.15, "productive", 0.25, 3),
    # Back to coding
    ("pycharm64.exe", "SDPPS – window.py", 0.00, "productive", 0.10, 4),
    # Distraction: YouTube
    ("chrome.exe", "YouTube - Lofi Hip Hop Radio - Google Chrome", 0.90, "entertainment", 0.75, 2),
    ("chrome.exe", "YouTube - Lofi Hip Hop Radio - Google Chrome", 0.90, "entertainment", 0.88, 3),
    # Distraction: Social media
    ("chrome.exe", "Instagram - Google Chrome", 0.90, "entertainment", 0.92, 3),
    # Recovery: back to work
    ("WINWORD.EXE", "CM2606_Report_Draft.docx - Word", 0.00, "productive", 0.55, 2),
    ("WINWORD.EXE", "CM2606_Report_Draft.docx - Word", 0.00, "productive", 0.30, 3),
    ("WINWORD.EXE", "CM2606_Report_Draft.docx - Word", 0.00, "productive", 0.15, 4),
    # Reading PDF
    ("chrome.exe", "CM2606_Data_Engineering_CW.pdf - Google Chrome", 0.15, "productive", 0.20, 5),
    # WhatsApp break
    ("WhatsApp", "WhatsApp", 0.75, "social", 0.65, 3),
    # Late night coding
    ("pycharm64.exe", "SDPPS – api_server.py", 0.00, "productive", 0.18, 6),
    # Netflix distraction
    ("chrome.exe", "Netflix - Stranger Things S5 - Google Chrome", 0.90, "entertainment", 0.95, 4),
    # Back to productive
    ("pycharm64.exe", "SDPPS – agent.py", 0.00, "productive", 0.12, 5),
]


def generate_snapshot(scenario_entry, snapshot_num, start_time):
    """Generate a realistic fake snapshot."""
    app, title, app_cat, app_cat_label, base_prob, _ = scenario_entry
    now = start_time + timedelta(seconds=snapshot_num * 60)
    ts = now.strftime("%Y-%m-%d %H:%M:%S")

    is_productive = app_cat <= 0.15
    is_entertainment = app_cat >= 0.70

    # Realistic feature ranges based on app type
    if is_productive:
        keys = random.randint(40, 180)
        clicks = random.randint(2, 15)
        moves = random.randint(100, 800)
        scrolls = random.randint(0, 60)
        idle = round(random.uniform(0, 5), 1)
        switches = random.randint(0, 2)
        dwell = random.randint(45, 60)
    elif is_entertainment:
        keys = random.randint(0, 10)
        clicks = random.randint(1, 8)
        moves = random.randint(50, 400)
        scrolls = random.randint(10, 200)
        idle = round(random.uniform(0, 30), 1)
        switches = random.randint(0, 1)
        dwell = random.randint(50, 60)
    else:
        keys = random.randint(10, 80)
        clicks = random.randint(3, 12)
        moves = random.randint(200, 1500)
        scrolls = random.randint(5, 80)
        idle = round(random.uniform(0, 10), 1)
        switches = random.randint(1, 4)
        dwell = random.randint(20, 55)

    # Add noise to probability
    noise = random.uniform(-0.08, 0.08)
    bilstm_prob = max(0.01, min(0.99, base_prob + noise))
    full_window = max(0.01, min(0.99, bilstm_prob + random.uniform(-0.05, 0.05)))
    recency = max(0.01, min(0.99, bilstm_prob + random.uniform(-0.15, 0.15)))

    # Adaptive blend calculation
    if app_cat >= 0.75:
        w_model, w_app = 0.40, 0.60
    elif app_cat <= 0.15:
        w_model, w_app = 0.55, 0.45
    else:
        w_model, w_app = 0.70, 0.30

    final_prob = round(w_model * bilstm_prob + w_app * app_cat, 4)
    final_prob = max(0.0, min(1.0, final_prob))

    label = "DISTRACTED" if final_prob >= 0.5 else "FOCUSED"
    confidence = round(final_prob if label == "DISTRACTED" else (1.0 - final_prob), 4)

    # Generate fake attention weights (10 timesteps)
    raw_attn = [random.uniform(0.05, 0.3) for _ in range(10)]
    attn_sum = sum(raw_attn)
    attention = [round(a / attn_sum, 4) for a in raw_attn]

    # Streak tracking
    streak = 1
    for prev in reversed(SIM["history"][-9:]):
        if prev.get("app_cat_label") == app_cat_label:
            streak += 1
        else:
            break

    # Apply streak override
    if streak >= 3 and app_cat <= 0.15:
        bonus = min(streak - 2, 5) * 0.05
        final_prob = max(round(final_prob - bonus, 4), 0.05)
        label = "DISTRACTED" if final_prob >= 0.5 else "FOCUSED"
        confidence = round(final_prob if label == "DISTRACTED" else (1.0 - final_prob), 4)
    elif streak >= 3 and app_cat >= 0.70:
        penalty = min(streak - 2, 5) * 0.05
        final_prob = min(round(final_prob + penalty, 4), 0.98)
        label = "DISTRACTED" if final_prob >= 0.5 else "FOCUSED"
        confidence = round(final_prob if label == "DISTRACTED" else (1.0 - final_prob), 4)

    snapshot = {
        "app_switches": switches,
        "final_app_dwell": dwell,
        "num_visible_apps": random.randint(8, 14),
        "cpu_usage": round(random.uniform(10, 35), 1),
        "memory_usage": round(random.uniform(70, 90), 1),
        "bytes_sent": 500000000 + snapshot_num * 1500000,
        "bytes_received": 5000000000 + snapshot_num * 8000000,
        "hour": now.hour,
        "session_time_minutes": round(snapshot_num * 1.0, 2),
        "keystroke_count": keys,
        "erase_key_count": random.randint(0, keys // 5),
        "erase_key_pct": round(random.uniform(0, 15), 2),
        "avg_press_interval_ms": round(random.uniform(80, 350), 2),
        "std_press_interval_ms": round(random.uniform(20, 150), 2),
        "mouse_clicks": clicks,
        "mouse_moves": moves,
        "mouse_scrolls": scrolls,
        "idle_seconds": idle,
        "engagement_momentum": round(random.uniform(200, 1800), 2),
        "time_diff_seconds": 60.0,
        "day_of_week_num": now.weekday(),
        "app_category_score": app_cat,
        "app_score_squared": round(app_cat ** 2, 4),
        "is_entertainment": 1.0 if app_cat >= 0.70 else 0.0,
        "timestamp": ts,
        "current_app": app,
        "current_title": title,
    }

    prediction = {
        "timestamp": ts,
        "bilstm_prob": round(bilstm_prob, 4),
        "bilstm_full": round(full_window, 4),
        "bilstm_recency": round(recency, 4),
        "app_cat_score": round(app_cat, 4),
        "app_cat_label": app_cat_label,
        "blend_mode": "adaptive",
        "final_prob": final_prob,
        "label": label,
        "confidence": confidence,
        "dominant_app": app,
        "streak_count": streak,
        "attention": attention,
        "raw_features": {
            "keystroke_count": keys,
            "mouse_clicks": clicks,
            "mouse_moves": moves,
            "idle_seconds": idle,
            "app_category_score": app_cat,
        },
    }

    return snapshot, prediction


# ═══════════════════════════════════════════════════════════════════
#  Background simulation thread
# ═══════════════════════════════════════════════════════════════════

def simulation_loop():
    """Generate snapshots every 3 seconds (fast mode for frontend dev)."""
    start_time = datetime.now()
    snapshot_num = 0
    scenario_idx = 0
    remaining = 0

    print("\n[Simulator] Starting scenario playback (3s per snapshot)...\n")

    while True:
        # Pick current scenario
        if remaining <= 0:
            if scenario_idx >= len(SCENARIOS):
                scenario_idx = 0  # Loop back
                print("[Simulator] === Restarting scenario cycle ===")
            current = SCENARIOS[scenario_idx]
            remaining = current[5]
            scenario_idx += 1

        snapshot_num += 1
        remaining -= 1
        SIM["snapshot_count"] = snapshot_num

        # Fill window phase
        if snapshot_num <= 10:
            SIM["window_filled"] = False
            if snapshot_num == 10:
                SIM["window_filled"] = True
                print(f"[Simulator] Window filled at snapshot #{snapshot_num}")
        else:
            SIM["window_filled"] = True

        snapshot, prediction = generate_snapshot(current, snapshot_num, start_time)
        SIM["latest_snapshot"] = snapshot

        if snapshot_num >= 10:
            SIM["latest_prediction"] = prediction
            SIM["history"].append(prediction)

            # Keep history manageable
            if len(SIM["history"]) > 200:
                SIM["history"] = SIM["history"][-100:]

            # Auto-blocker simulation
            if prediction["final_prob"] >= 0.70:
                SIM["blocking_active"] = True
            elif prediction["final_prob"] <= 0.35:
                SIM["blocking_active"] = False

            status = prediction["label"]
            conf = prediction["confidence"]
            app = prediction["dominant_app"]
            streak = prediction["streak_count"]
            print(f"  [#{snapshot_num:3d}] {app:20s} | {status:10s} "
                  f"({conf*100:5.1f}%) | Streak={streak} | "
                  f"Final={prediction['final_prob']:.4f}")
        else:
            print(f"  [#{snapshot_num:3d}] Filling window... "
                  f"{snapshot_num}/10")

        time.sleep(3)  # 3 seconds per snapshot for fast demo


# ═══════════════════════════════════════════════════════════════════
#  Flask API endpoints (identical to real agent)
# ═══════════════════════════════════════════════════════════════════

@app.route("/api/status")
def status():
    result = SIM["latest_prediction"]
    response = {
        "running": True,
        "snapshots": SIM["snapshot_count"],
        "window_size": SIM["window_size"],
        "window_filled": SIM["window_filled"],
        "blend_mode": "adaptive",
        "prediction": None,
        "blocker": {
            "is_blocking": SIM["blocking_active"],
            "is_admin": False,
            "blocked_sites": ["youtube.com", "netflix.com", "tiktok.com",
                              "instagram.com"] if SIM["blocking_active"] else [],
        },
    }
    if result:
        response["prediction"] = {
            "label": result["label"],
            "probability": result["final_prob"],
            "bilstm_prob": result["bilstm_prob"],
            "bilstm_full": result.get("bilstm_full", 0),
            "bilstm_recency": result.get("bilstm_recency", 0),
            "app_category": result["app_cat_score"],
            "app_cat_label": result["app_cat_label"],
            "dominant_app": result["dominant_app"],
            "blend_mode": result["blend_mode"],
            "confidence": result["confidence"],
            "is_distracted": result["label"] == "DISTRACTED",
            "attention": result.get("attention", []),
            "timestamp": result.get("timestamp", ""),
            "streak_count": result.get("streak_count", 0),
        }
    return jsonify(response)


@app.route("/api/history")
def history():
    return jsonify(SIM["history"][-50:])


@app.route("/api/block", methods=["POST"])
def block():
    SIM["blocking_active"] = True
    return jsonify({"status": "blocking_enabled", "is_blocking": True})


@app.route("/api/unblock", methods=["POST"])
def unblock():
    SIM["blocking_active"] = False
    return jsonify({"status": "blocking_disabled", "is_blocking": False})


@app.route("/api/features")
def features():
    return jsonify({
        "latest_snapshot": SIM["latest_snapshot"],
        "window_size": 10,
        "feature_columns": [
            "app_switches", "final_app_dwell", "num_visible_apps",
            "cpu_usage", "memory_usage", "bytes_sent", "bytes_received",
            "hour", "session_time_minutes", "keystroke_count",
            "erase_key_count", "erase_key_pct", "avg_press_interval_ms",
            "std_press_interval_ms", "mouse_clicks", "mouse_moves",
            "mouse_scrolls", "idle_seconds", "engagement_momentum",
            "time_diff_seconds", "day_of_week_num", "app_category_score",
            "app_score_squared", "is_entertainment",
        ],
    })


# ═══════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print("  SDPPS Simulation Server (v1.0)")
    print("  Fake data for frontend development")
    print("  API: http://127.0.0.1:5000")
    print("  Speed: 1 snapshot every 3 seconds")
    print("=" * 60)

    # Start simulation in background
    sim_thread = threading.Thread(target=simulation_loop, daemon=True)
    sim_thread.start()

    # Start Flask
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)
