import pandas as pd
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
INTERIM_DIR = BASE_DIR / "data" / "interim"
PROCESSED_DIR = BASE_DIR / "data" / "processed"

INPUT_FILE = INTERIM_DIR / "merged_dedup.csv"
OUTPUT_FILE = PROCESSED_DIR / "cleaned.csv"

PROCESSED_DIR.mkdir(parents=True, exist_ok=True)


df = pd.read_csv(INPUT_FILE)

required_cols = {"user_id", "timestamp"}
missing = required_cols - set(df.columns)
if missing:
    raise ValueError(f"Missing required columns: {missing}")

print("Rows before cleaning:", len(df))
print("Users:", df["user_id"].nunique())


ts_auto = pd.to_datetime(df["timestamp"], errors="coerce")


ts_us = pd.to_datetime(
    df["timestamp"],
    format="%m/%d/%Y %H:%M",
    errors="coerce"
)


df["timestamp"] = ts_auto.fillna(ts_us)

df = df[df["timestamp"].notna()]


df = df.sort_values(
    by=["user_id", "timestamp"]
).reset_index(drop=True)


DROP_COLS = [
    "visible_apps"
]

df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])


TEXT_COLS = [
    "foreground_app_start",
    "foreground_app_end",
    "day_of_week"
]

for col in TEXT_COLS:
    if col in df.columns:
        df[col] = (
            df[col]
            .astype(str)
            .str.lower()
            .str.strip()
        )


NUMERIC_COLS = [
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
    "engagement_momentum"
]

for col in NUMERIC_COLS:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)


df["hour"] = df["hour"].clip(0, 23)
df["erase_key_pct"] = df["erase_key_pct"].clip(0, 100)


OUTLIER_COLS = [
    "bytes_sent",
    "bytes_received",
    "final_app_dwell",
    "idle_seconds",
    "mouse_moves",
    "engagement_momentum"
]

for col in OUTLIER_COLS:
    if col in df.columns:
        upper = df[col].quantile(0.99)
        df[col] = df[col].clip(upper=upper)

if df.isna().sum().sum() != 0:
    raise ValueError("NaNs still present after cleaning")

print("Rows after cleaning:", len(df))
print("Users after cleaning:", df["user_id"].nunique())


df.to_csv(OUTPUT_FILE, index=False)
print("Cleaned data saved to:", OUTPUT_FILE)
