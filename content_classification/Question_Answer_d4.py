import pandas as pd
import re
from bs4 import BeautifulSoup
import html

# =========================
# Loading Questions
# =========================
question_df = pd.read_csv("Datasets/Q&A/Questions.csv", usecols=['Id','Title','Body'],encoding="latin1",nrows=10000)

# Renaming
question_df = question_df.rename(columns={"Body":"QuestionBody"})

# Cleaning
question_df = question_df.dropna().drop_duplicates()
print("Questions Loaded: ",question_df.shape)

# Storing selected IDs
selected_question_ids = set(question_df["Id"])


# =========================
# Loading Answers (Chunks)
# =========================
answer_chunks = pd.read_csv("Datasets/Q&A/Answers.csv", usecols=["ParentId","Body"],encoding="latin1",chunksize= 50000)

answer_list =[]

for chunk in answer_chunks:
    filtered = chunk[chunk["ParentId"].isin(selected_question_ids)]
    answer_list.append(filtered)

answer_df = pd.concat(answer_list, ignore_index=True)
answer_df = answer_df.drop_duplicates()
answer_df = answer_df.dropna()

print("Answers matched:", answer_df.shape)

answer_df_grouped = answer_df.groupby("ParentId")["Body"].apply(lambda x: " ".join(x)).reset_index()


# =========================
# Loading Tags (Chunks)
# =========================

tag_chunks = pd.read_csv("Datasets/Q&A/Tags.csv",usecols=["Id","Tag"],encoding='latin1',chunksize = 50000)

tags_list = []
for t_chunk in tag_chunks :
    t_filtered = t_chunk[t_chunk["Id"].isin(selected_question_ids)]
    tags_list.append(t_filtered)

tag_df = pd.concat(tags_list)
tag_df = tag_df.drop_duplicates()
tag_df = tag_df.dropna()
print ("Tags matched:", tag_df.shape)

tag_df_grouped = tag_df.groupby("Id")["Tag"].apply(lambda x:" ".join(x)).reset_index()


# =========================
# Merging All
# =========================
merged_df= question_df.merge(
    answer_df_grouped,
    left_on ="Id",
    right_on= "ParentId",
    how = "left"
)

merged_df = merged_df.merge(
    tag_df_grouped ,
    on = "Id",
    how="left"
)

print("Merged Dataset shape :",merged_df.shape)

# =========================
# Feature Engineering
# =========================
merged_df["Body"] = merged_df["Body"].fillna("")
merged_df["Tag"]= merged_df["Tag"].fillna("")

merged_df["Text"] =(
    merged_df["Title"] + " " +
    merged_df["QuestionBody"] + " " +
    merged_df["Body"] + " " +
    merged_df["Tag"] + " "
)


# =========================
# Cleaning
# =========================
def clean_text (text):
    if pd.isna(text):
        return ""

    text = html.unescape(text)  # Decoding html entries
    try:
        text = BeautifulSoup(text, "html.parser").get_text(separator=" ")
    except:
        text = re.sub(r'<[^>]*>', ' ', text)

    text = re.sub(r"http\S+|www\S+|https\S+", "", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text


merged_df["Text"]= merged_df["Text"].apply(clean_text)

# =========================
# Labeling (Educational Dataset)
# =========================
merged_df["Label"] = 1  # StackOverflow Q&A = Educational


# =========================
# Final Dataset
# =========================
question_answer_df_final = merged_df[["Text","Label"]].dropna().drop_duplicates()

question_answer_df_final.to_csv("Cleaned_Datasets/cleaned_Q&A_d4.csv",index=False)


# =========================
# Logs
# =========================

print("StackOverflow Q&A dataset cleaned and saved successfully.")
print("Final shape:", question_answer_df_final.shape)
print("Label distribution:\n", question_answer_df_final["Label"].value_counts())

