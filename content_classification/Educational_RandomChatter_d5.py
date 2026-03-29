import pandas as pd
import re

# =========================
# Loading Dataset
# =========================
edu_rand_df = pd.read_csv("Datasets/edu_random_dataset.csv")

print("Dataset shape: ",edu_rand_df.shape)
print(edu_rand_df.head())
edu_rand_df = edu_rand_df.rename(columns={"text":"Text","label":"Label"})

# =========================
# Selecting Required columns
# =========================
edu_rand_df= edu_rand_df[["Text","Label"]]

# =========================
# Cleaning
# =========================

edu_rand_df["Text"] = edu_rand_df["Text"].astype(str)
edu_rand_df["Text"] = edu_rand_df["Text"].str.lower()
edu_rand_df["Text"] = edu_rand_df["Text"].str.replace(r"http\S+|www\S+|https\S+", "", regex=True)
edu_rand_df["Text"] = edu_rand_df["Text"].str.replace(r"\s+", " ", regex=True).str.strip()

# Handling missing values and duplicates
edu_rand_df = edu_rand_df.dropna()
edu_rand_df = edu_rand_df.drop_duplicates()


# =========================
# Encoding Labels
# =========================
label_map= {"Educational":1,
            "Random Chatter":0}

edu_rand_df['Label']= edu_rand_df['Label'].map(label_map)

# =========================
# Final Dataset
# =========================
edu_rand_final= edu_rand_df[["Text", "Label"]]
edu_rand_final.to_csv("Cleaned_Datasets\cleaned_edu_rand_d5.csv",index= False )

# =========================
# Logs
# =========================

print("Educational and Random Chatter dataset cleaned and saved successfully.")
print("Final shape:", edu_rand_final.shape)
print("Label distribution:\n", edu_rand_final["Label"].value_counts())

