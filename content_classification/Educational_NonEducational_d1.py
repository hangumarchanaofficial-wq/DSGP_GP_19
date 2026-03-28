import pandas as pd

# =========================
# Loading Dataset
# =========================

df = pd.read_csv("Datasets/educational_dataset_1.csv", header= None )
df.columns = ["Question","Answer","Label"]

print(df.head())
print (df.columns.tolist()) # Printing column names

# Number of educational vs non educational texts
print(df["Label"].value_counts())


# =========================
# Combining Text Fields
# =========================
df["Text"]= df["Question"]+" " + df["Answer"]


# =========================
# CLeaning
# =========================
df["Text"] = df["Text"].str.replace('"', '', regex=False)
df["Text"]= df["Text"].str.lower() # lowercase
df["Text"]= df["Text"].str.strip() # trimming spaces
df["Text"] = df["Text"].str.replace(r"\s+"," ", regex = True) # normalizing space


# =========================
# Encoding Labels
# =========================

label_map = {'educational':1,
             'noneducational':0
             }
df["Label"]= df["Label"].map(label_map)


# =========================
# Final dataset and saving
# =========================
df_final = df[["Text","Label"]]
df_final.to_csv("Cleaned_Datasets\cleaned_educational_d1.csv", index = False)

print("Educational vs Non-Educational dataset cleaned and saved successfully.")
print("Final shape:", df_final.shape)
