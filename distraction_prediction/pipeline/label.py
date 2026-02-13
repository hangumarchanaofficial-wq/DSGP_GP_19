import pandas as pd
import json
from pathlib import Path


# Initialized paths


BASE_DIR = Path(__file__).resolve().parent.parent
PROCESSED_DIR = BASE_DIR / "data" / "processed"

INPUT_FILE = PROCESSED_DIR / "cleaned_data.csv"
OUTPUT_FILE = PROCESSED_DIR / "labeled.csv"
THRESHOLD_FILE = PROCESSED_DIR / "label_thresholds.json"


# Load cleaned dataset

df = pd.read_csv(INPUT_FILE, parse_dates=["timestamp"])

print("Rows:", len(df))
print("Users:", df["user_id"].nunique())


# Train split
# Use first 80% time per user for percentile estimation

train_mask = (
    df.groupby("user_id")["timestamp"]
      .transform(lambda x: x.rank(pct=True) <= 0.8)
)

train_df = df[train_mask].copy()

print("Training rows for threshold estimation:", len(train_df))


# Compute percentiles on TRAIN ONLY


thresholds = {}

thresholds["A_app_switches_p80"] = train_df["app_switches"].quantile(0.80)
thresholds["A_visible_apps_p75"] = train_df["num_visible_apps"].quantile(0.75)

thresholds["B_dwell_p20"] = train_df["final_app_dwell"].quantile(0.20)

#compute percentile on non-zero values
nonzero_erase = train_df[train_df["erase_key_pct"] > 0]
thresholds["C_erase_p75"] = (
    nonzero_erase["erase_key_pct"].quantile(0.75)
    if len(nonzero_erase) > 0 else 0
)

thresholds["C_keystroke_p25"] = train_df["keystroke_count"].quantile(0.25)
thresholds["C_std_interval_p75"] = train_df["std_press_interval_ms"].quantile(0.75)
thresholds["C_scroll_p75"] = train_df["mouse_scrolls"].quantile(0.75)

thresholds["D_idle_p75"] = train_df["idle_seconds"].quantile(0.75)
thresholds["D_idle_p60"] = train_df["idle_seconds"].quantile(0.60)
thresholds["D_mouse_moves_p75"] = train_df["mouse_moves"].quantile(0.75)

# Save thresholds for reproducibility
with open(THRESHOLD_FILE, "w") as f:
    json.dump({k: float(v) for k, v in thresholds.items()}, f, indent=4)

print("Saved thresholds.")


# Apply Dimensions


# Dimension A – Attention Fragmentation
dim_A = (
    (df["app_switches"] > thresholds["A_app_switches_p80"]) |
    (df["num_visible_apps"] > thresholds["A_visible_apps_p75"])
)

# Dimension B – Shallow Engagement
dim_B = (
    df["final_app_dwell"] < thresholds["B_dwell_p20"]
)

# Dimension C – Interaction Anomalies (2 of 4 rule)
c1 = df["keystroke_count"] < thresholds["C_keystroke_p25"]
c2 = df["std_press_interval_ms"] > thresholds["C_std_interval_p75"]
c3 = df["erase_key_pct"] > thresholds["C_erase_p75"]
c4 = df["mouse_scrolls"] > thresholds["C_scroll_p75"]

dim_C = (
    (c1.astype(int) + c2.astype(int) + c3.astype(int) + c4.astype(int)) >= 2
)

# Dimension D – Inactivity / Passive Consumption
dim_D = (
    (df["idle_seconds"] > thresholds["D_idle_p75"]) |
    (
        (df["idle_seconds"] > thresholds["D_idle_p60"]) &
        (df["mouse_moves"] > thresholds["D_mouse_moves_p75"])
    )
)


# Count triggered dimensions

df["triggered_dimensions"] = (
    dim_A.astype(int) +
    dim_B.astype(int) +
    dim_C.astype(int) +
    dim_D.astype(int)
)

# Final label rule
df["distraction_label"] = (
    df["triggered_dimensions"] >= 2
).astype(int)


# Diagnostics

print("\nDimension trigger rates:")
print("A:", dim_A.mean())
print("B:", dim_B.mean())
print("C:", dim_C.mean())
print("D:", dim_D.mean())

print("\nFinal distraction rate:", df["distraction_label"].mean())


# Save labeled dataset

df.to_csv(OUTPUT_FILE, index=False)

print("Saved labeled dataset to:", OUTPUT_FILE)
