import pandas  as pd

# =========================
# Loading Dataset
# =========================
imdb_df = pd.read_csv("Datasets/imdb_dataset.csv",nrows= 6000)

print("IMDB Dataset Loaded:",imdb_df.shape)
print("Columns:",imdb_df.columns)
print(imdb_df.head())

# =========================
# Renaming Columns
# =========================
imdb_df= imdb_df.rename(columns={"review":"Text"})

# ====================================
# Removing Missing Values & Duplicates
# ====================================
imdb_df = imdb_df.dropna(subset=["Text"])
imdb_df = imdb_df.drop_duplicates(subset=["Text"])

# ===================
# Assigning Label
# ===================
imdb_df["Label"]=0

# ==================
# Cleaning
# ==================
imdb_df["Text"] = imdb_df["Text"].astype(str)
imdb_df["Text"] = imdb_df["Text"].str.lower()
imdb_df["Text"] = imdb_df["Text"].str.replace(r"http\S+|www\S+|https\S+", "", regex=True)
imdb_df["Text"] = imdb_df["Text"].str.replace(r"\s+", " ", regex=True).str.strip()

# =========================
# Final Dataset
# =========================
imdb_df_final = imdb_df[["Text","Label"]]

imdb_df_final.to_csv("Cleaned_Datasets/cleaned_imdb_d6.csv",index= False)

# =========================
# Logs
# =========================
print("IMDb dataset cleaned and saved successfully.")
print("Final shape:", imdb_df_final.shape)
print("Label distribution:\n", imdb_df_final["Label"].value_counts())