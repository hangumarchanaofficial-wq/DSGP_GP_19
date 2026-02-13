#Importing libraries
import pandas as pd
from pathlib import Path

#Initializing paths
BASE_DIR = Path(__file__).resolve().parent.parent
Interim_DIR = BASE_DIR / "data" / "interim"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

INPUT_FILE = Interim_DIR / "merged_dedup.csv"
OUTPUT_FILE = PROCESSED_DIR / "cleaned_data.csv"

df = pd.read_csv(INPUT_FILE, low_memory=False)
#Display stats of the invalid dataset
print("Rows (raw) :", len(df))
print("Users (raw) :", df["user_id"].nunique())
print("Missing timestamp (raw) :", df["timestamp"].isna().sum())

df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

before =len(df)

df =df[df["timestamp"].notna()].copy()

print("Rows dropped due to missing timestamp:", before - len(df))

#Sort the datasets

df =df.sort_values(["user_id", "timestamp"]).reset_index(drop=True)

#analyze timestamp
df["Hour"] = df["timestamp"].dt.hour
df["Day_of_week"] = df["timestamp"].dt.day_name()

#handle missing values in foreground_app_start and foreground_app_end
for col in ["foreground_app_start", "foreground_app_end"]:
    if col in df.columns:
        df[col]= (df[col].fillna("unknown").astype(str).str.strip().str.lower())

#Remove unusable raw string list columns

if "visible_apps" in df.columns:
    df = df.drop(columns=["visible_apps"])

#Initialize list of numeric columns
numeric_cols = [
    "app_switches", "final_app_dwell", "num_visible_apps",
    "cpu_usage", "memory_usage", "bytes_sent", "bytes_received",
    "hour", "session_time_minutes", "keystroke_count", "erase_key_count",
    "erase_key_pct", "avg_press_interval_ms", "std_press_interval_ms",
    "mouse_clicks", "mouse_moves", "mouse_scrolls", "idle_seconds",
    "engagement_momentum"
]

#Handle missing values in numeric columns
for col in numeric_cols:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

#Clip values to within valid ranges
df["hour"] = df["hour"].clip(lower=0, upper=23)
df["erase_key_pct"] = df["erase_key_pct"].clip(0, 100)
df["idle_seconds"] = df["idle_seconds"].clip(0, 60)
df["cpu_usage"] = df["cpu_usage"].clip(0, 100)
df["memory_usage"] = df["memory_usage"].clip(0, 100)

#clip columns
clip_cols = [
    "bytes_sent", "bytes_received", "final_app_dwell",
    "keystroke_count", "mouse_moves", "mouse_scrolls",
    "engagement_momentum"
]

#Clip values in clip_cols
for col in clip_cols:
    if col in df.columns:
        upper = df[col].quantile(0.99)

        if col == "final_app_dwell":
            upper = min(upper, 600)
        df[col] = df[col].clip(upper=upper)

print("Rows (cleaned):", len(df))
print("Users (cleaned):", df["user_id"].nunique())
print("Total NaNs (cleaned):", int(df.isna().sum().sum()))

df.to_csv(OUTPUT_FILE, index=False)
print("Saved:", OUTPUT_FILE)