# live_predict.py
# Real-time distraction prediction
# Reads LocalAgent CSV, builds window, predicts with BiLSTM + app category blending

import sys
import json
import time
import csv
import getpass
import numpy as np
import pandas as pd
import torch
from pathlib import Path
from datetime import datetime

# ── Paths ──
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
WINDOWS_DIR = BASE_DIR / "data" / "processed" / "windows"
MODEL_PATH = MODELS_DIR / "saved_models" / "best_model.pt"
SCALER_PATH = WINDOWS_DIR / "scaler_zscore.json"
FEATURES_PATH = WINDOWS_DIR / "feature_columns.json"

USERNAME = getpass.getuser()
AGENT_CSV = Path(f"C:/Users/{USERNAME}/distract_lstm_features.csv")

WINDOW_SIZE = 10
THRESHOLD = 0.5

# Import model and app categorizer
sys.path.insert(0, str(MODELS_DIR))
from train import DistractionLSTM
sys.path.insert(0, str(Path(__file__).resolve().parent))
from app_categorizer import window_category_score, categorize_window

DAY_MAP = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
           "Friday": 4, "Saturday": 5, "Sunday": 6}


def load_model(device):
    ckpt = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    cfg = ckpt["config"]
    model = DistractionLSTM(
        input_size=cfg["input_size"], hidden_size=cfg["hidden_size"],
        num_layers=cfg["num_layers"], dropout=cfg["dropout"],
        bidirectional=cfg["bidirectional"],
    )
    model.load_state_dict(ckpt["model_state_dict"])
    model.to(device)
    model.eval()
    return model


def load_scaler():
    with open(SCALER_PATH) as f:
        s = json.load(f)
    return np.array(s["mean"], dtype=np.float32), np.array(s["std"], dtype=np.float32)


def load_features():
    with open(FEATURES_PATH) as f:
        return json.load(f)["feature_columns"]


def read_agent_csv():
    """Read LocalAgent CSV, handling comma-containing visible_apps field."""
    if not AGENT_CSV.exists():
        return None
    with open(AGENT_CSV, newline='', encoding='utf-8', errors='replace') as f:
        rows = list(csv.reader(f))
    if len(rows) < 2:
        return None
    header = rows[0]
    n = len(header)
    fixed = []
    for row in rows[1:]:
        if len(row) >= n:
            fixed.append(row[:n-1] + [','.join(row[n-1:])])
        elif len(row) > 0:
            fixed.append(row + [''] * (n - len(row)))
    return pd.DataFrame(fixed, columns=header)


def prepare_features(df, feature_cols):
    """Add derived columns and ensure all features exist."""
    df = df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = df.dropna(subset=["timestamp"]).sort_values("timestamp").reset_index(drop=True)
    df["time_diff_seconds"] = df["timestamp"].diff().dt.total_seconds().fillna(0)

    if "day_of_week" in df.columns:
        df["day_of_week_num"] = df["day_of_week"].map(DAY_MAP).fillna(-1).astype(int)
    else:
        df["day_of_week_num"] = df["timestamp"].dt.dayofweek

    if "hour" not in df.columns:
        df["hour"] = df["timestamp"].dt.hour

    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


def predict_once(model, mean, std, feature_cols, device):
    """Read latest data, predict with BiLSTM + app category blending."""
    df = read_agent_csv()
    if df is None or len(df) < WINDOW_SIZE:
        print(f"[WAITING] Need at least {WINDOW_SIZE} minutes of data.")
        return None

    df = prepare_features(df, feature_cols)
    if len(df) < WINDOW_SIZE:
        return None

    last10 = df.tail(WINDOW_SIZE)
    window = last10[feature_cols].to_numpy(dtype=np.float32)

    # BiLSTM prediction
    scaled = (window - mean) / std
    tensor = torch.tensor(scaled, dtype=torch.float32).unsqueeze(0).to(device)
    with torch.no_grad():
        prob = torch.sigmoid(model(tensor)).item()

    # App category score
    apps = last10["foreground_app_end"].fillna("").tolist() if "foreground_app_end" in last10.columns else [""] * WINDOW_SIZE
    cat_score = window_category_score(apps, apps)
    dominant_app = last10["foreground_app_end"].value_counts().idxmax() if "foreground_app_end" in last10.columns else "unknown"
    cat_info = categorize_window(dominant_app)

    # Blend: 60% BiLSTM + 40% app category
    blended = round(0.60 * prob + 0.40 * cat_score, 4)
    label = int(blended >= THRESHOLD)

    return {
        "class": "distracted" if label == 1 else "focused",
        "probability": blended,
        "bilstm_prob": round(prob, 4),
        "app_category": cat_score,
        "dominant_app": dominant_app,
        "category_label": cat_info["category_label"],
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def display(result):
    if result is None:
        return
    status = "[!!] DISTRACTED" if result["class"] == "distracted" else "[OK] FOCUSED"
    bar = "#" * int(result["probability"] * 20) + "-" * (20 - int(result["probability"] * 20))

    print(f"\n{'='*55}")
    print(f"  {status}")
    print(f"  Blended    : [{bar}] {result['probability']*100:.1f}%")
    print(f"  BiLSTM     : {result['bilstm_prob']*100:.1f}%")
    print(f"  App category: {result['app_category']:.2f}  ({result['dominant_app']} -> {result['category_label']})")
    print(f"  Time       : {result['timestamp']}")
    print(f"{'='*55}")


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    print("=" * 55)
    print("  SDPPS - Live Distraction Prediction")
    print("=" * 55)
    print(f"  Device : {device}")
    print(f"  CSV    : {AGENT_CSV}")
    print(f"  Window : {WINDOW_SIZE} minutes")

    if not MODEL_PATH.exists():
        print(f"\n[ERROR] Model not found: {MODEL_PATH}")
        print("        Run train.py first.")
        sys.exit(1)

    model = load_model(device)
    mean, std = load_scaler()
    feature_cols = load_features()
    print(f"  Features: {len(feature_cols)}")
    print("=" * 55)

    # Check if --watch flag
    watch = "--watch" in sys.argv

    if watch:
        print("\nWatching every 60s. Ctrl+C to stop.\n")
        try:
            while True:
                display(predict_once(model, mean, std, feature_cols, device))
                time.sleep(60)
        except KeyboardInterrupt:
            print("\nStopped.")
    else:
        result = predict_once(model, mean, std, feature_cols, device)
        display(result)
        if result is None:
            print("\n[TIP] Start LocalAgent.py, wait 10 minutes, then run again.")


if __name__ == "__main__":
    main()
