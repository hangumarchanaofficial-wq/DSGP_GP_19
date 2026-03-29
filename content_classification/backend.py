from flask import Flask , request ,jsonify
import joblib

# =========================
# Loading model + vectorizer
# =========================
model = joblib.load("Models/content_classifier_svm.pkl")
vectorizer= joblib.load ("Models/tfidf_vectorizer.pkl")
app = Flask("__name__")

# =========================
# Prediction Function
# =========================
def predict_search(text):
    text = text.lower().strip()

    # REMOVE NOISE
    noise_words = ["google", "search", "youtube"]
    for word in noise_words:
        text = text.replace(word, "")

    text_vectorized = vectorizer.transform([text])
    prediction = model.predict(text_vectorized)[0]

    return prediction
# =========================
# Home route
# =========================
@app.route("/")
def home():
    return " Backend is running "

# =========================
# Main API
# =========================

@app.route("/check_content",methods=["POST"])
def  check_content():
    data = request.get_json()

    title = data.get("title","")
    url = data.get("url","")
    content= data.get("content","")

    # Limiting content

    print("\n===== New request =====")
    print("Title received:",title)
    print("URL received:",url)


    # =================================
    # 1. SHORT TEXT HANDLING
    # =================================

    if len(content.split()) < 5:
        print("Decision: pending (not enough data)")
        return jsonify({"result": "pending"})



    # =================================
    # CLEANING INPUT
    # =================================

    content = content[:2000]
    combined_text = f"{title} {content}".lower()

    noise_words = ["google", "search"]
    for word in noise_words:
        combined_text = combined_text.replace(word, "")

    # =================================
    # PREDICTION
    # =================================
    prediction = predict_search(combined_text)

    result = "allow" if prediction == 1 else "block"

    print("Decision:", result)

    return jsonify({"result": result})

# =================================
# Running Server
# =================================
if __name__ == "__main__":
    app.run(debug=True)