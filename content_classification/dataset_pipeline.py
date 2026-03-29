# ============================================================
# Purpose: Merge all cleaned datasets into one master dataset
# ============================================================

import pandas as pd
import re

# =============================
# Loading Cleaned Datasets
# =============================

d1 = pd.read_csv("Cleaned_Datasets/cleaned_educational_d1.csv")
d2 = pd.read_csv("Cleaned_Datasets/cleaned_youtube_d2.csv")
d3 = pd.read_csv("Cleaned_Datasets/cleaned_bbc_d3.csv")
d4 = pd.read_csv("Cleaned_Datasets/cleaned_Q&A_d4.csv")
d5 = pd.read_csv ("Cleaned_Datasets/cleaned_edu_rand_d5.csv")
d6= pd.read_csv ("Cleaned_Datasets/cleaned_imdb_d6.csv")

print ("Datasets Loaded")

# =============================
#  Validation
# =============================

required_cols ={"Text","Label"}

def validating(df,name):
    for col in required_cols:
        if col not in df.columns:
            raise Exception (f"{name} missing required column: {col}")

validating(d1,"Dataset 1")
validating(d2,"Dataset 2")
validating(d3,"Dataset 3")
validating(d4,"Dataset 4")
validating(d5,"Dataset 5")
validating(d6,"Dataset 6")

# =============================
#  Merging Datasets
# =============================
final_df = pd.concat([d1,d2,d3,d4,d5,d6],ignore_index = True)
print("Merged dataframe shape:", final_df.shape)

# =============================
#  Overall Cleaning
# =============================
def overall_cleaning(text):
    if pd.isna(text):
        return ""
    text = text.lower()
    text = re.sub(r"http\S+|www\S+","",text)
    text= re.sub(r"[^a-z0-9\s]"," ",text)
    text = re.sub(r"\s+"," ",text).strip()
    return text

final_df["Text"]=final_df["Text"].apply(overall_cleaning)

final_df= final_df.dropna(subset=["Text","Label"])
final_df = final_df.drop_duplicates(subset=["Text"])

final_df["Label"] = final_df["Label"].astype(int)

print ("After cleaning shape of df:",final_df.shape)
print("Label Distribution:\n",final_df["Label"].value_counts())

# =============================
#  Saving Final Dataset
# =============================
final_df.to_csv("Cleaned_Datasets/final_dataset.csv",index= False)
print("Final Dataset created successfully")
