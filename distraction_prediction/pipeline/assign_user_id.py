import pandas as pd
from pathlib import Path 

RAW_DIR = Path("../data/raw")
INTERIM_DIR = Path("../data/interim")

INTERIM_DIR.mkdir(parents=True, exist_ok=True)

csv_files = sorted(RAW_DIR.glob("*.csv"))
print(f"Found {len(csv_files)} CSV files in {RAW_DIR}")

for index , file_path in enumerate(csv_files):
    try:
        df = pd.read_csv(file_path)

        #Assign a new user ID
        df["user_id"] = f"user_{index}"

        #drop old columns safely

        if "user" in df.columns:
            df = df.drop(columns=["user"])
        output_path = INTERIM_DIR / file_path.name

        df.to_csv(output_path, index=False)

        print(f"Processed : {file_path}")




    except Exception as e:
        print(f"Error processing {file_path}: {e}")

