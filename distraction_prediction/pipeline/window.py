"""
SDPPS – Windowed Feature Generation (v3.1)
=============================================
Reads labeled_activity_log.csv and creates sliding windows for BiLSTM.
Uses LLM-scored app_category_score + 2 derived features for stronger
app-context signal.

Features: 24 (was 22)
  - Original 22 features
  - app_score_squared:  amplifies difference between high/low scores
  - is_entertainment:   binary flag (1.0 if app_category_score >= 0.70)

Output:
  - windowed_features.npz  (X: N x 10 x 24, y: N)
  - scaler_zscore.json      (mean/std for 24 features)
  - feature_columns.json    (list of 24 feature names)
"""

import json
import numpy as np
import pandas as pd
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────
BASE_DIR = Path(r"E:\SDPPS")
PROCESSED_DIR = BASE_DIR / "distraction_prediction" / "data" / "processed"
WINDOWS_DIR = PROCESSED_DIR / "windows"
INTERIM_DIR = BASE_DIR / "distraction_prediction" / "data" / "interim"

INPUT_CSV = WINDOWS_DIR / "labeled_activity_log.csv"
OUTPUT_NPZ = WINDOWS_DIR / "windowed_features.npz"
SCALER_JSON = WINDOWS_DIR / "scaler_zscore.json"
FEATURE_JSON = WINDOWS_DIR / "feature_columns.json"
LLM_SCORES_JSON = INTERIM_DIR / "app_distraction_scores.json"

# ── Window parameters ────────────────────────────────────────────────────
WINDOW_SIZE = 10
STRIDE = 1
LOOKAHEAD = 5

# ── 24 features (22 original + 2 derived) ────────────────────────────────
FEATURE_COLUMNS = [
    "app_switches",
    "final_app_dwell",
    "num_visible_apps",
    "cpu_usage",
    "memory_usage",
    "bytes_sent",
    "bytes_received",
    "hour",
    "session_time_minutes",
    "keystroke_count",
    "erase_key_count",
    "erase_key_pct",
    "avg_press_interval_ms",
    "std_press_interval_ms",
    "mouse_clicks",
    "mouse_moves",
    "mouse_scrolls",
    "idle_seconds",
    "engagement_momentum",
    "time_diff_seconds",
    "day_of_week_num",
    "app_category_score",
    "app_score_squared",        # NEW: amplifies high/low difference
    "is_entertainment",         # NEW: binary flag for entertainment apps
]

LABEL_COLUMN = "distraction_label"
APP_COL = "foreground_app_end"


def day_of_week_to_num(df: pd.DataFrame) -> pd.DataFrame:
    """Convert day_of_week string to integer if needed."""
    if "day_of_week_num" not in df.columns:
        if "day_of_week" in df.columns:
            day_map = {
                "monday": 0, "tuesday": 1, "wednesday": 2,
                "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6
            }
            df["day_of_week_num"] = (
                df["day_of_week"]
                .str.strip()
                .str.lower()
                .map(day_map)
            )
            df["day_of_week_num"] = df["day_of_week_num"].fillna(0).astype(int)
        else:
            df["day_of_week_num"] = 0
    return df


def ensure_hour_int(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure hour is integer."""
    if "hour" in df.columns:
        df["hour"] = df["hour"].astype(int)
    return df


def add_derived_app_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add derived features from app_category_score to amplify
    the model's ability to distinguish productive vs entertainment apps.

    app_score_squared:
      - productive (0.05) -> 0.0025  (very small)
      - neutral    (0.50) -> 0.2500  (moderate)
      - social     (0.70) -> 0.4900  (high)
      - entertain  (0.95) -> 0.9025  (very high)
      This widens the gap between categories.

    is_entertainment:
      - 1.0 if app_category_score >= 0.70 (social + entertainment)
      - 0.0 otherwise
      Gives the model a clear binary signal.
    """
    acs = df["app_category_score"]
    df["app_score_squared"] = (acs ** 2).round(4)
    df["is_entertainment"] = (acs >= 0.70).astype(float)

    print(f"    Derived features added:")
    print(f"      app_score_squared:  mean={df['app_score_squared'].mean():.4f}, "
          f"min={df['app_score_squared'].min():.4f}, "
          f"max={df['app_score_squared'].max():.4f}")
    print(f"      is_entertainment:   {df['is_entertainment'].mean() * 100:.1f}% of rows flagged")

    return df


def verify_app_category_scores(df: pd.DataFrame) -> pd.DataFrame:
    """
    Verify that app_category_score was set by label.py using LLM scores.
    If the column exists but only has a few unique values (hardcoded),
    try to re-score using LLM JSON.
    """
    if "app_category_score" not in df.columns:
        print("    WARNING: app_category_score not found — adding default 0.5")
        df["app_category_score"] = 0.5
        return df

    n_unique = df["app_category_score"].nunique()
    print(f"    app_category_score: mean={df['app_category_score'].mean():.3f}, "
          f"unique_values={n_unique}")

    # If LLM scores exist and current scores look hardcoded (few unique values),
    # re-apply LLM scores for richer feature values
    if n_unique <= 5 and LLM_SCORES_JSON.exists():
        print(f"    Detected hardcoded scores ({n_unique} unique). Re-scoring with LLM JSON...")

        with open(LLM_SCORES_JSON, "r") as f:
            llm_scores = {k.lower().strip(): float(v) for k, v in json.load(f).items()}

        if APP_COL in df.columns:
            def lookup(app_name):
                if not isinstance(app_name, str):
                    return 0.5
                name = app_name.strip().lower()
                if name in llm_scores:
                    return llm_scores[name]
                name_no_ext = name.replace(".exe", "")
                for k, v in llm_scores.items():
                    if k.replace(".exe", "") == name_no_ext:
                        return v
                return 0.5

            df["app_category_score"] = df[APP_COL].apply(lookup)
            new_unique = df["app_category_score"].nunique()
            print(f"    Re-scored: mean={df['app_category_score'].mean():.3f}, "
                  f"unique_values={new_unique}")

    return df


def build_windows(df: pd.DataFrame):
    """Build sliding windows per user."""
    X_list = []
    y_list = []

    for uid in df["user_id"].unique():
        user_df = (
            df[df["user_id"] == uid]
            .sort_values("timestamp")
            .reset_index(drop=True)
        )

        values = user_df[FEATURE_COLUMNS].values.astype(np.float32)
        labels = user_df[LABEL_COLUMN].values.astype(np.float32)

        n = len(user_df)
        max_start = n - WINDOW_SIZE - LOOKAHEAD

        for start in range(0, max_start + 1, STRIDE):
            end = start + WINDOW_SIZE

            Xw = values[start:end]
            future_labels = labels[end: end + LOOKAHEAD]
            yw = 1.0 if future_labels.sum() > 0 else 0.0

            X_list.append(Xw)
            y_list.append(yw)

    X = np.array(X_list, dtype=np.float32)
    y = np.array(y_list, dtype=np.float32)
    return X, y


def compute_scaler(X: np.ndarray) -> tuple:
    """Compute per-feature mean and std."""
    flat = X.reshape(-1, X.shape[-1])
    means = flat.mean(axis=0)
    stds = flat.std(axis=0)
    stds[stds == 0] = 1.0
    return means, stds


def normalize(X: np.ndarray, means: np.ndarray, stds: np.ndarray) -> np.ndarray:
    """Z-score normalize."""
    return (X - means) / stds


def main():
    print("=" * 60)
    print("  SDPPS — Windowed Feature Generation (v3.1)")
    print(f"  Window={WINDOW_SIZE}, Stride={STRIDE}, Lookahead={LOOKAHEAD}")
    print(f"  Features: {len(FEATURE_COLUMNS)} (22 base + 2 derived app features)")
    print("=" * 60)

    WINDOWS_DIR.mkdir(parents=True, exist_ok=True)

    # ── Load labeled data ────────────────────────────────────────────
    print(f"\n[1] Loading: {INPUT_CSV}")
    if not INPUT_CSV.exists():
        print(f"    ERROR: File not found: {INPUT_CSV}")
        print(f"    Run label.py first.")
        return

    df = pd.read_csv(INPUT_CSV)
    print(f"    Rows: {len(df):,} | Users: {df['user_id'].nunique()}")

    # ── Preprocessing ────────────────────────────────────────────────
    print("\n[2] Preprocessing...")
    df = day_of_week_to_num(df)
    df = ensure_hour_int(df)
    df = verify_app_category_scores(df)

    # Add derived app features BEFORE checking columns
    df = add_derived_app_features(df)

    for col in FEATURE_COLUMNS:
        if col not in df.columns:
            print(f"    WARNING: Missing column '{col}' — filling with 0")
            df[col] = 0.0
        else:
            df[col] = df[col].fillna(0.0)

    if LABEL_COLUMN not in df.columns:
        print(f"    ERROR: Label column '{LABEL_COLUMN}' not found!")
        return

    dist_rate = df[LABEL_COLUMN].mean() * 100
    print(f"    Label distribution: {dist_rate:.1f}% distracted, "
          f"{100 - dist_rate:.1f}% focused")

    # ── Build windows ────────────────────────────────────────────────
    print(f"\n[3] Building windows...")
    X, y = build_windows(df)
    print(f"    X shape: {X.shape}")
    print(f"    y shape: {y.shape}")
    print(f"    y distraction rate: {y.mean() * 100:.1f}%")

    # ── Compute scaler ───────────────────────────────────────────────
    print(f"\n[4] Computing Z-score scaler...")
    means, stds = compute_scaler(X)
    X_normed = normalize(X, means, stds)

    print(f"    {'Feature':<28} {'Mean':>10} {'Std':>10}")
    print(f"    {'-' * 48}")
    for i, col in enumerate(FEATURE_COLUMNS):
        print(f"    {col:<28} {means[i]:>10.4f} {stds[i]:>10.4f}")

    # ── Save ─────────────────────────────────────────────────────────
    scaler = {
        "mean": means.tolist(),
        "std": stds.tolist(),
        "feature_columns": FEATURE_COLUMNS,
        "window_size": WINDOW_SIZE,
    }
    with open(SCALER_JSON, "w") as f:
        json.dump(scaler, f, indent=2)
    print(f"\n[5] Saved scaler: {SCALER_JSON}")

    with open(FEATURE_JSON, "w") as f:
        json.dump(FEATURE_COLUMNS, f, indent=2)
    print(f"    Saved features: {FEATURE_JSON}")

    np.savez(OUTPUT_NPZ, X=X_normed, y=y, X_raw=X)
    print(f"    Saved windows: {OUTPUT_NPZ}")

    # ── Summary ──────────────────────────────────────────────────────
    n = len(y)
    print(f"\n[6] Dataset ready for training:")
    print(f"    Total windows: {n:,}")
    print(f"    Distracted:    {int(y.sum()):,} ({y.mean() * 100:.1f}%)")
    print(f"    Focused:       {int(n - y.sum()):,} ({(1 - y.mean()) * 100:.1f}%)")
    print(f"    Feature dim:   {X.shape[-1]}")

    print("\n" + "=" * 60)
    print("  Next: python -m distraction_prediction.models.train")
    print("=" * 60)


if __name__ == "__main__":
    main()
