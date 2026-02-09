import pandas as pd
import re


# =========================
# Loading Dataset
# =========================
bbc_df = pd.read_csv("Datasets/BBC/bbc_data.csv")


# =========================
# Renaming Columns
# =========================
bbc_df = bbc_df.rename(columns={"data":"Text","labels":"Label"})


# =========================
# Basic Cleaning
# =========================
bbc_df["Text"] = bbc_df["Text"].str.lower()
bbc_df["Text"]=bbc_df["Text"].str.replace(r"\s+"," ",regex= True)
bbc_df["Text"] = bbc_df["Text"].str.strip()


# =========================
# Removing Duplicates & NA
# =========================

bbc_df = bbc_df.drop_duplicates(subset=["Text"])
bbc_df = bbc_df.dropna(subset=["Text", "Label"])

# =========================
# Label Mapping
# =========================

educational_categories =['tech']
non_educational_categories = ['sport','entertainment']
ambiguous_categories =['business','politics']

def assigning_label(category):
    if category in educational_categories:
        return 1
    elif category in non_educational_categories:
        return 0
    else:
        return None # ambiguous

bbc_df["Label"] = bbc_df["Label"].apply(assigning_label)

# ============================
# Removing Ambiguous Categories
# =============================
bbc_df = bbc_df.dropna(subset=['Label'])
bbc_df["Label"]=bbc_df["Label"].astype(int)


# =========================
# Final Dataset
# =========================
bbc_df_final = bbc_df[["Text", "Label"]]
bbc_df_final.to_csv("Cleaned_Datasets\cleaned_bbc_d3.csv", index=False)

# =========================
# Logs
# =========================
print("BBC dataset cleaned and saved successfully.")
print("Final shape:", bbc_df_final.shape)
print("Label distribution:\n", bbc_df_final["Label"].value_counts())
