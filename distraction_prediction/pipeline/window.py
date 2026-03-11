# window.py (LEAKAGE-FIXED)
# Build LSTM-ready windows from labeled.csv with:
# - per-user chronological splitting FIRST (train/val/test) on rows
# - windowing done INSIDE each split only (no overlap leakage)
# - train-only scaling (z-score) applied to val/test
# - high-resolution timestamps in metadata (unix seconds)
# - consistent feature list

import json
import numpy as np
import pandas as pd
from pathlib import Path

# ---------------------------
# Config
# ---------------------------
WINDOW_SIZE = 10
STRIDE = 1

# Time-based split per user (chronological ROW split)
TRAIN_RATIO = 0.80
VAL_RATIO = 0.10
TEST_RATIO = 0.10

ENCODE_DAY_OF_WEEK = True


def zscore_fit(X: np.ndarray, eps: float = 1e-8):
    """
    Fit z-score scaler on 3D array: (N, T, F)
    Returns mean, std arrays of shape (F,)
    """
    flat = X.reshape(-1, X.shape[-1])
    mean = flat.mean(axis=0)
    std = flat.std(axis=0)
    std = np.where(std < eps, 1.0, std)
    return mean, std


def zscore_apply(X: np.ndarray, mean: np.ndarray, std: np.ndarray):
    return (X - mean) / std


def day_name_to_int(series: pd.Series) -> pd.Series:
    mapping = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6
    }
    return series.map(mapping).fillna(-1).astype(int)


def build_windows(df_part: pd.DataFrame, feature_cols: list, label_col: str, split_name: str):
    """
    Build windows inside ONE split (train/val/test) for one user.
    Returns: X, y, meta (or (None, None, None) if not enough rows)
    """
    if len(df_part) < WINDOW_SIZE:
        return None, None, None

    values = df_part[feature_cols].to_numpy(dtype=np.float32)
    labels = df_part[label_col].to_numpy(dtype=np.int64)
    timestamps = df_part["timestamp"].to_numpy()  # datetime64[ns]
    user_id = df_part["user_id"].iloc[0]

    X_list, y_list, meta_list = [], [], []

    max_start = len(df_part) - WINDOW_SIZE
    for start in range(0, max_start + 1, STRIDE):
        end = start + WINDOW_SIZE

        Xw = values[start:end]
        yw = labels[end - 1]  # label at last step
        end_ts = pd.Timestamp(timestamps[end - 1]).timestamp()

        X_list.append(Xw)
        y_list.append(yw)
        meta_list.append({
            "user_id": str(user_id),
            "split": split_name,
            "window_end_unix": float(end_ts),
            "start_index_in_split": int(start),
            "end_index_in_split": int(end - 1),
        })

    return np.stack(X_list), np.array(y_list), meta_list


def split_user_rows(user_df: pd.DataFrame, train_ratio: float, val_ratio: float):
    """
    Chronological ROW split for one user's time-sorted dataframe.
    """
    n = len(user_df)
    if n == 0:
        return None, None, None

    n_train = int(np.floor(n * train_ratio))
    n_val = int(np.floor(n * val_ratio))

    # Ensure train has enough for at least one window if possible
    if n_train < WINDOW_SIZE and n >= WINDOW_SIZE:
        n_train = WINDOW_SIZE

    train_end = min(n_train, n)
    val_end = min(train_end + n_val, n)

    df_train = user_df.iloc[:train_end].copy()
    df_val = user_df.iloc[train_end:val_end].copy()
    df_test = user_df.iloc[val_end:].copy()

    return df_train, df_val, df_test


def main():
    BASE_DIR = Path(__file__).resolve().parent.parent
    PROCESSED_DIR = BASE_DIR / "data" / "processed"
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    INPUT_FILE = PROCESSED_DIR / "labeled.csv"

    OUT_DIR = PROCESSED_DIR / "windows"
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    X_TRAIN_FILE = OUT_DIR / "X_train.npy"
    Y_TRAIN_FILE = OUT_DIR / "y_train.npy"
    X_VAL_FILE = OUT_DIR / "X_val.npy"
    Y_VAL_FILE = OUT_DIR / "y_val.npy"
    X_TEST_FILE = OUT_DIR / "X_test.npy"
    Y_TEST_FILE = OUT_DIR / "y_test.npy"

    META_TRAIN_FILE = OUT_DIR / "meta_train.json"
    META_VAL_FILE = OUT_DIR / "meta_val.json"
    META_TEST_FILE = OUT_DIR / "meta_test.json"

    SCALER_FILE = OUT_DIR / "scaler_zscore.json"
    FEATURES_FILE = OUT_DIR / "feature_columns.json"

    df = pd.read_csv(INPUT_FILE, parse_dates=["timestamp"], low_memory=False)

    required_cols = {"user_id", "timestamp", "distraction_label"}
    missing_req = required_cols - set(df.columns)
    if missing_req:
        raise ValueError(f"Missing required columns in labeled.csv: {sorted(missing_req)}")

    df = df.sort_values(["user_id", "timestamp"]).reset_index(drop=True)

    if ENCODE_DAY_OF_WEEK and "day_of_week" in df.columns:
        df["day_of_week_num"] = day_name_to_int(df["day_of_week"])

    candidate_features = [
        "app_switches", "final_app_dwell", "num_visible_apps",
        "cpu_usage", "memory_usage", "bytes_sent", "bytes_received",
        "hour", "session_time_minutes", "keystroke_count", "erase_key_count",
        "erase_key_pct", "avg_press_interval_ms", "std_press_interval_ms",
        "mouse_clicks", "mouse_moves", "mouse_scrolls", "idle_seconds",
        "engagement_momentum", "time_diff_seconds",
        "day_of_week_num",
    ]
    feature_cols = [c for c in candidate_features if c in df.columns]
    if not feature_cols:
        raise ValueError("No feature columns found. Check your cleaned/labelled dataset columns.")

    # numeric safety
    for c in feature_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0)

    label_col = "distraction_label"
    df[label_col] = pd.to_numeric(df[label_col], errors="coerce").fillna(0).astype(int)

    print("Total rows:", len(df))
    print("Users:", df["user_id"].nunique())
    print("Using features:", feature_cols)
    print("Window size:", WINDOW_SIZE, "Stride:", STRIDE)
    print("Row split ratios:", TRAIN_RATIO, VAL_RATIO, TEST_RATIO)

    X_train_all, y_train_all, meta_train_all = [], [], []
    X_val_all, y_val_all, meta_val_all = [], [], []
    X_test_all, y_test_all, meta_test_all = [], [], []

    for user_id, user_df in df.groupby("user_id", sort=False):
        user_df = user_df.sort_values("timestamp")

        df_tr, df_va, df_te = split_user_rows(user_df, TRAIN_RATIO, VAL_RATIO)
        if df_tr is None:
            continue

        Xtr, ytr, mtr = build_windows(df_tr, feature_cols, label_col, "train")
        Xva, yva, mva = build_windows(df_va, feature_cols, label_col, "val") if len(df_va) else (None, None, None)
        Xte, yte, mte = build_windows(df_te, feature_cols, label_col, "test") if len(df_te) else (None, None, None)

        if Xtr is not None and len(ytr) > 0:
            X_train_all.append(Xtr)
            y_train_all.append(ytr)
            meta_train_all.extend(mtr)

        if Xva is not None and len(yva) > 0:
            X_val_all.append(Xva)
            y_val_all.append(yva)
            meta_val_all.extend(mva)

        if Xte is not None and len(yte) > 0:
            X_test_all.append(Xte)
            y_test_all.append(yte)
            meta_test_all.extend(mte)

    if not X_train_all:
        raise ValueError("No training windows were created. Increase data or reduce WINDOW_SIZE.")

    X_train = np.concatenate(X_train_all, axis=0)
    y_train = np.concatenate(y_train_all, axis=0)

    X_val = np.concatenate(X_val_all, axis=0) if X_val_all else np.empty((0, WINDOW_SIZE, len(feature_cols)), dtype=np.float32)
    y_val = np.concatenate(y_val_all, axis=0) if y_val_all else np.empty((0,), dtype=np.int64)

    X_test = np.concatenate(X_test_all, axis=0) if X_test_all else np.empty((0, WINDOW_SIZE, len(feature_cols)), dtype=np.float32)
    y_test = np.concatenate(y_test_all, axis=0) if y_test_all else np.empty((0,), dtype=np.int64)

    print("\nWindows created (LEAKAGE-SAFE):")
    print("Train:", X_train.shape, y_train.shape)
    print("Val  :", X_val.shape, y_val.shape)
    print("Test :", X_test.shape, y_test.shape)

    # Train-only scaling
    mean, std = zscore_fit(X_train)
    X_train = zscore_apply(X_train, mean, std)
    if len(X_val) > 0:
        X_val = zscore_apply(X_val, mean, std)
    if len(X_test) > 0:
        X_test = zscore_apply(X_test, mean, std)

    # Save arrays
    np.save(X_TRAIN_FILE, X_train)
    np.save(Y_TRAIN_FILE, y_train)
    np.save(X_VAL_FILE, X_val)
    np.save(Y_VAL_FILE, y_val)
    np.save(X_TEST_FILE, X_test)
    np.save(Y_TEST_FILE, y_test)

    # Save metadata + scaler + features
    with open(META_TRAIN_FILE, "w") as f:
        json.dump(meta_train_all, f, indent=2)
    with open(META_VAL_FILE, "w") as f:
        json.dump(meta_val_all, f, indent=2)
    with open(META_TEST_FILE, "w") as f:
        json.dump(meta_test_all, f, indent=2)

    scaler_payload = {
        "type": "zscore",
        "mean": [float(m) for m in mean],
        "std": [float(s) for s in std],
        "window_size": WINDOW_SIZE,
        "stride": STRIDE
    }
    with open(SCALER_FILE, "w") as f:
        json.dump(scaler_payload, f, indent=2)

    with open(FEATURES_FILE, "w") as f:
        json.dump({"feature_columns": feature_cols}, f, indent=2)

    print("\nSaved leakage-safe windows to:", OUT_DIR)


if __name__ == "__main__":
    main()
    