import pandas as pd
from pathlib import Path

def main():
    # Initialize paths
    BASE_DIR = Path(__file__).resolve().parent.parent
    INTERIM_DIR = BASE_DIR / "data" / "interim"
    OUTPUT_FILE = INTERIM_DIR / "merged_dedup.csv"
    INVALID_FILE = INTERIM_DIR / "invalid_timestamps.csv"

    datasets = []
    csv_files = sorted(INTERIM_DIR.glob("*.csv"))

    for csv in csv_files:
        if csv.name in {"merged_dedup.csv", "invalid_timestamps.csv"}:
            continue
        df = pd.read_csv(csv, low_memory=False)
        df["source_file"] = csv.name   # helpful for debugging
        datasets.append(df)

    if not datasets:
        raise ValueError(f"No CSV files found in {INTERIM_DIR}")

    # Merge datasets
    merged_df = pd.concat(datasets, ignore_index=True)

    if "user_id" not in merged_df.columns or "timestamp" not in merged_df.columns:
        raise ValueError("Missing required columns: 'user_id' and/or 'timestamp'")

    print("Rows after merge:", len(merged_df))
    print("Unique users after merge:", merged_df["user_id"].nunique())

    # Convert timestamp column to datetime
    merged_df["timestamp"] = pd.to_datetime(merged_df["timestamp"], format="mixed", dayfirst=False, errors="coerce")


    print("Timestamp dtype:", merged_df["timestamp"].dtype)
    print("NaT timestamps:", int(merged_df["timestamp"].isna().sum()))

    # Split valid/invalid timestamps
    valid_ts = merged_df[merged_df["timestamp"].notna()].copy()
    invalid_ts = merged_df[merged_df["timestamp"].isna()].copy()

    # Save invalid timestamps separately (debugging)
    if len(invalid_ts) > 0:
        invalid_ts.to_csv(INVALID_FILE, index=False)
        print("Saved invalid timestamps to:", INVALID_FILE)

    # Sort valid data
    valid_ts = valid_ts.sort_values(by=["user_id", "timestamp"]).reset_index(drop=True)

    # Deduplicate (stronger key if possible)
    dedup_cols = ["user_id", "timestamp"]
    # If these exist, use them to avoid collapsing real records
    for extra in ["foreground_app_start", "foreground_app_end"]:
        if extra in valid_ts.columns:
            dedup_cols.append(extra)

    before_dupes = len(valid_ts)
    valid_ts = valid_ts.drop_duplicates(subset=dedup_cols, keep="last")
    print("Rows removed by dedup:", before_dupes - len(valid_ts))
    print("Remaining duplicates:", int(valid_ts.duplicated(subset=dedup_cols).sum()))

    print("Unique users after dedup:", valid_ts["user_id"].nunique())

    # Save merged + deduped valid data only
    valid_ts.to_csv(OUTPUT_FILE, index=False)
    print("Merged and deduplicated data saved to:", OUTPUT_FILE)

if __name__ == "__main__":
    main()