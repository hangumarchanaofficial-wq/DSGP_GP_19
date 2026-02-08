import pandas as pd
from pathlib import Path

raw_dir = Path("../data/raw")
num_files = len(list(raw_dir.glob("*.csv")))
print(num_files)

for i in range(1, num_files+1):
    df = pd.read_csv(f"../data/raw/distract_lstm_features -{i}.csv")
    print(df.head())
    df["user_id"] = f"user_{i}"
    df = df.drop(columns=["user"])
    try:

        df.to_csv(f"../data/interim/distract_lstm_features -{i}.csv", index=False)
    except Exception as e:
        print(e)
        continue



