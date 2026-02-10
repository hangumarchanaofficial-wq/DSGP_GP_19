import pandas as pd
from pathlib import Path

#Initialize paths
BASE_DIR = Path(__file__).resolve().parent.parent
INTERIM_DIR = BASE_DIR / "data" / "interim"
OUTPUT_FILE = INTERIM_DIR / "merged_dedup.csv"

#Initialize datasets
datasets = []

#Loop through all csv files in interim directory
for csv in sorted(INTERIM_DIR.glob("*.csv")):
    if csv.name =="merged_dedup.csv":
        continue
    df = pd.read_csv(csv)
    datasets.append(df)

#Merge datasets
merged_df = pd.concat(datasets,ignore_index=True)

print("Unique users after merge:", merged_df["user_id"].nunique())

#Convert timestamp column to datetime
merged_df["timestamp"] = pd.to_datetime(
    merged_df["timestamp"],
    errors="coerce"
)

#Sort dataframe by user_id and timestamp
merged_df = merged_df.sort_values(
    by=["user_id", "timestamp"],

).reset_index(drop=True)

print("TimeStamp dtype:", merged_df["timestamp"].dtype)
print("Nat timeStamp dtype:", merged_df["timestamp"].isna().sum())

#Divide datasets into valid_timestamp and invalid_timestamp
valid_ts =   merged_df[merged_df["timestamp"].notna()]
invalid_ts = merged_df[merged_df["timestamp"].isna()]

#Remove duplicate values in valid_timestamp
valid_ts = valid_ts.drop_duplicates(
    subset=["user_id", "timestamp"],
    keep="last"
)

#Merge valid_timestamp and invalid_timestamp
merged_df = pd.concat(
    [valid_ts, invalid_ts],
    ignore_index=True
)

print("Remaining duplicates:", merged_df.duplicated(subset=["user_id", "timestamp"]).sum() )

print("Unique users after deduplication:", merged_df["user_id"].nunique())

#Save merged file
merged_df.to_csv(OUTPUT_FILE, index=False)

print("Merged and deduplicated data saved to:", OUTPUT_FILE)


