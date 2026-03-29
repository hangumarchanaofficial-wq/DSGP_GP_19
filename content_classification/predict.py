import joblib
import pandas as pd
from sklearn.metrics import accuracy_score ,f1_score , classification_report

# Loading saved model and TF -IDF vectorizer
model = joblib.load("Models/content_classifier_svm.pkl")
vectorizer = joblib.load("Models/tfidf_vectorizer.pkl")

print("Model and Vectorizer Loaded Successfully!")




# Single text prediction

def predict_text(text):

    text= text.lower().strip()

    # Converting text to TF-IDF
    text_vectorized = vectorizer.transform([text])

     #predicting
    prediction = model.predict(text_vectorized)[0]

    if prediction==1 :
        return 1

    else:
        return 0


# Multiple text prediction
def predict_texts(text_list):
    cleaned_text = []

    for text in text_list :
        cleaned= text.lower().strip()
        cleaned_text.append(cleaned)

    # Vectorize all at once
    texts_vectorized = vectorizer.transform(cleaned_text)

    # predicting for all
    predictions = model.predict(texts_vectorized)
    results=[]

    for pred in predictions :
        if pred ==1:
            results.append (1)

        else:
            results.append(0)

    return results


# Option 1
def test_csv (file_path):

    sample_df = pd.read_csv(file_path)
    print(sample_df.columns)
    sample_df["Text"]= sample_df["Text"].dropna()

    texts= sample_df["Text"].tolist()
    actual_labels = sample_df["Actual_label"].tolist()
    predicted_labels = predict_texts(texts)

    for text,actual,pred in zip(texts,actual_labels,predicted_labels):
        print("Text:",text)
        print("Actual Label:",actual)
        print("Predicted Label:",pred)
        print("-" *50)

    acc = accuracy_score(actual_labels,predicted_labels)
    f1 = f1_score (actual_labels, predicted_labels)

    print("\n===== TEST SET EVALUATION =====")
    print("Accuracy on test_samples.csv:", acc)
    print("F1 Score on test_samples.csv:", f1)
    print("\nClassification Report:")
    print(classification_report(actual_labels, predicted_labels))

# Option 2
def test_text_input ():
    while True:
        text_input = input("Enter a text to classify:\n")
        result = predict_text(text_input)
        print("Prediction:", result)
        more_input = input("Do you want to enter another text?(yes/no):").lower()
        if more_input == "no":
            break



if __name__ == "__main__":
    print("\n Choose Model:")
    print("1 - Test with CSV")
    print("2 - Test with manual inputs")

    choice = int(input("Enter 1 or 2: "))

    if choice == 1 :
        test_csv("test_samples.csv")

    elif choice== 2 :
        test_text_input()

    else:
        print("Invalid Input!")



