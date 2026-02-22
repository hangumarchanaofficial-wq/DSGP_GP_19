import pandas as pd
from pathlib import Path

def main():
    # Initialize paths
    BASE_DIR = Path(__file__).resolve().parent.parent
    INTER_DIR = BASE_DIR / "data" / "interim"
    PROCESSED_DIR = BASE_DIR / "data" / "processed"
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    INPUT_FILE = INTER_DIR / "merged_dedup.csv"
    OUTPUT_FILE = PROCESSED_DIR / "cleaned_data.csv"

    # Load data
    df = pd.read_csv(INPUT_FILE, low_memory=False)

    # Display stats (raw)
    print("Rows (raw):", len(df))
    print("Raw users:", df["user_id"].nunique() if "user_id" in df.columns else "NA")
    print("Missing timestamp (raw):", int(df["timestamp"].isna().sum()) if "timestamp" in df.columns else "NA")

    # Required columns
    if "timestamp" not in df.columns or "user_id" not in df.columns:
        raise ValueError("Missing required 'timestamp' or 'user_id' column")

    # Timestamp handling
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    before = len(df)
    df = df[df["timestamp"].notna()].copy()
    print("Rows dropped due to missing/invalid timestamp:", before - len(df))

    # Drop missing user_id (safer for groupby/sort)
    before_uid = len(df)
    df = df[df["user_id"].notna()].copy()
    print("Rows dropped due to missing user_id:", before_uid - len(df))

    # Sort by user and time
    df = df.sort_values(["user_id", "timestamp"]).reset_index(drop=True)

    # Time features
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.day_name()

    # Time gaps (useful for LSTM)
    df["time_diff_seconds"] = (
        df.groupby("user_id")["timestamp"].diff().dt.total_seconds().fillna(0)
    )

    # Handle missing values in categorical/string columns
    for col in ["foreground_app_start", "foreground_app_end"]:
        if col in df.columns:
            df[col] = df[col].fillna("unknown").astype(str).str.strip().str.lower()

    # Drop unusable column if present
    if "visible_apps" in df.columns:
        df = df.drop(columns=["visible_apps"])

    # Numeric columns handling
    numeric_cols = [
        "app_switches", "final_app_dwell", "num_visible_apps",
        "cpu_usage", "memory_usage", "bytes_sent", "bytes_received",
        "hour", "session_time_minutes", "keystroke_count", "erase_key_count",
        "erase_key_pct", "avg_press_interval_ms", "std_press_interval_ms",
        "mouse_clicks", "mouse_moves", "mouse_scrolls", "idle_seconds",
        "engagement_momentum", "time_diff_seconds"
    ]

    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    # Clip values to valid ranges
    range_clips = {
        "hour": (0, 23),
        "erase_key_pct": (0, 100),
        "idle_seconds": (0, 60),
        "cpu_usage": (0, 100),
        "memory_usage": (0, 100),
    }

    for col, (lower, upper) in range_clips.items():
        if col in df.columns:
            df[col] = df[col].clip(lower=lower, upper=upper)

    # Quantile clipping to reduce extreme outliers
    clip_cols = [
        "bytes_sent", "bytes_received", "final_app_dwell",
        "keystroke_count", "mouse_moves", "mouse_scrolls",
        "engagement_momentum"
    ]

    for col in clip_cols:
        if col in df.columns:
            upper = df[col].quantile(0.99)
            if col == "final_app_dwell":
                upper = min(upper, 600)
            df[col] = df[col].clip(upper=upper)

    # Final stats
    print("Rows (cleaned):", len(df))
    print("Users (cleaned):", df["user_id"].nunique())
    print("Total NaNs (cleaned):", int(df.isna().sum().sum()))

    # Save
    df.to_csv(OUTPUT_FILE, index=False)
    print("Saved:", OUTPUT_FILE)

if __name__ == "__main__":
    main()