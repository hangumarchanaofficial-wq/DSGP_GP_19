import pandas as pd
import json
from pathlib import Path

def main():
    BASE_DIR = Path(__file__).resolve().parent.parent
    PROCESSED_DIR = BASE_DIR / "data" / "processed"

    INPUT_FILE = PROCESSED_DIR / "cleaned_data.csv"
    OUTPUT_FILE = PROCESSED_DIR / "labeled.csv"
    THRESHOLD_FILE = PROCESSED_DIR / "label_thresholds.json"

    df = pd.read_csv(INPUT_FILE, parse_dates=["timestamp"], low_memory=False)
    df = df.sort_values(["user_id", "timestamp"]).reset_index(drop=True)

    print("Rows:", len(df))
    print("Users:", df["user_id"].nunique())

    # Train mask: first 80% of time per user
    train_mask = (
        df.groupby("user_id")["timestamp"]
          .transform(lambda x: x.rank(method="first", pct=True) <= 0.8)
    )
    train_df = df[train_mask].copy()
    print("Training rows for threshold estimation:", len(train_df))

    thresholds = {}
    thresholds["A_app_switches_p80"] = train_df["app_switches"].quantile(0.80)
    thresholds["A_visible_apps_p75"] = train_df["num_visible_apps"].quantile(0.75)

    thresholds["B_dwell_p20"] = train_df["final_app_dwell"].quantile(0.20)

    nonzero_erase = train_df[train_df["erase_key_pct"] > 0]
    thresholds["C_erase_p75"] = (
        nonzero_erase["erase_key_pct"].quantile(0.75)
        if len(nonzero_erase) > 0 else 1e9  # disable if no erase activity
    )

    thresholds["C_keystroke_p25"] = train_df["keystroke_count"].quantile(0.25)
    thresholds["C_std_interval_p75"] = train_df["std_press_interval_ms"].quantile(0.75)
    thresholds["C_scroll_p75"] = train_df["mouse_scrolls"].quantile(0.75)

    thresholds["D_idle_p75"] = train_df["idle_seconds"].quantile(0.75)
    thresholds["D_idle_p60"] = train_df["idle_seconds"].quantile(0.60)
    thresholds["D_mouse_moves_p25"] = train_df["mouse_moves"].quantile(0.25)

    with open(THRESHOLD_FILE, "w") as f:
        json.dump({k: float(v) for k, v in thresholds.items()}, f, indent=4)
    print("Saved thresholds to:", THRESHOLD_FILE)

    # Dimension A
    dim_A = (
        (df["app_switches"] > thresholds["A_app_switches_p80"]) |
        (df["num_visible_apps"] > thresholds["A_visible_apps_p75"])
    )

    # Dimension B
    dim_B = (df["final_app_dwell"] < thresholds["B_dwell_p20"])

    # Dimension C (2 of 4)
    c1 = df["keystroke_count"] <= thresholds["C_keystroke_p25"]
    c2 = df["std_press_interval_ms"] > thresholds["C_std_interval_p75"]
    c3 = df["erase_key_pct"] > thresholds["C_erase_p75"]
    c4 = df["mouse_scrolls"] > thresholds["C_scroll_p75"]

    dim_C = ((c1.astype(int) + c2.astype(int) + c3.astype(int) + c4.astype(int)) >= 2)

    # Dimension D (robust)
    dim_D = (
        (df["idle_seconds"] >= thresholds["D_idle_p75"]) |
        (
            (df["idle_seconds"] >= thresholds["D_idle_p60"]) &
            (df["mouse_moves"] <= thresholds["D_mouse_moves_p25"])
        )
    )

    df["triggered_dimensions"] = (
        dim_A.astype(int) + dim_B.astype(int) + dim_C.astype(int) + dim_D.astype(int)
    )

    df["distraction_label"] = (df["triggered_dimensions"] >= 2).astype(int)

    print("\nDimension trigger rates:")
    print("A:", float(dim_A.mean()))
    print("B:", float(dim_B.mean()))
    print("C:", float(dim_C.mean()))
    print("D:", float(dim_D.mean()))
    print("\nFinal distraction rate:", float(df["distraction_label"].mean()))

    df.to_csv(OUTPUT_FILE, index=False)
    print("Saved labeled dataset to:", OUTPUT_FILE)

if __name__ == "__main__":
    main()