import pandas as pd
import json
import os


# =========================
# Loading Dataset
# =========================
us_df =pd.read_csv("Datasets/youtube/USvideos.csv")


# =========================
# EDA
# =========================
print (us_df.head())
print(us_df.info())
print(us_df.describe ())



# =========================
# Load Video Category mapping
# =========================
with open ("Datasets/youtube/US_category_id.json","r",encoding = "utf-8") as us_cat_file :
    us_cat = json.load(us_cat_file)

categories_map = {}
for item in us_cat["items"]:
    categories_map[int(item["id"])] = item["snippet"]["title"]

us_df ["Video Category"]= us_df["category_id"].map(categories_map)


# =========================
# Filtering Columns
# =========================
cols_to_keep = ['title','description','tags','Video Category']
us_df = us_df[cols_to_keep]


# ===============================================
# Removing Duplicates and handling Missing Values
# ===============================================

us_df.drop_duplicates(inplace=True)

us_df = us_df.dropna(subset=["title", "description", "tags", "Video Category"])


# =========================
# Feature Engineering
# =========================

us_df["Text"] = (
        us_df["title"]+ " " +
        us_df["description"] + " " +
        us_df["tags"]
)

# =========================
# Labelling Data
# =========================

educational_categories =['Science & Technology', 'Education']
non_educational_categories = ['Comedy','Entertainment','Music','Gaming','shows','Pets & Animals',
                              'Film & Animation','People & Blogs','Howto & Style','Howto & Style','Nonprofits & Activism']
ambiguous_categories =['News & Politics','Sports','Autos & Vehicles','Travel & Events']

def assigning_label(category):
    if category in educational_categories:
        return 1
    elif category in non_educational_categories:
        return 0
    else:
        return None # ambiguous

us_df["Label"]= us_df["Video Category"].apply(assigning_label)

# =========================
# Removing Ambiguous Categories
# =========================
us_df = us_df.dropna(subset=['Label'])
us_df["Label"]=us_df["Label"].astype(int)


# =========================
# Basic Cleaning
# =========================

us_df["Text"] = us_df["Text"].str.lower()
us_df["Text"] = us_df["Text"].str.replace('"', '', regex=False)
us_df["Text"] = us_df["Text"].str.strip()
us_df["Text"] = us_df["Text"].str.replace(r"\s+", " ", regex=True)


# =========================
# Final Dataset
# =========================

final_df = us_df[["Text", "Label"]]
us_df_final = final_df.to_csv("Cleaned_Datasets/cleaned_youtube_d2.csv",index=False)


# =========================
# Logs
# =========================

print("YouTube US dataset cleaned and saved successfully.")
print("Final shape:", final_df.shape)
print("Label distribution:\n", final_df["Label"].value_counts())


