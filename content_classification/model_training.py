import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import  accuracy_score , classification_report,f1_score
from sklearn.model_selection import GridSearchCV
import joblib
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay
import matplotlib.pyplot as plt

# =============================
# Loading Final Cleaned Dataset
# =============================
file_path = "Cleaned_Datasets/final_dataset.csv"

df = pd.read_csv(file_path)

print("Dataset Loaded Successfully!")

# =============================
# Basic Dataset Inspection
# =============================
print("\n===== DATASET OVERVIEW =====")
print("Shape of dataset:", df.shape)

print("\nColumn Names:")
print(df.columns)


# =============================
# Checking Missing Values
# =============================
print("\nMissing Values:")
print(df.isnull().sum())

# =============================
# Checking Label Distribution
# =============================
print("\n===== LABEL DISTRIBUTION =====")
print(df["Label"].value_counts())


# ==============================
# Separating Features and labels
# ==============================
texts = df["Text"]
labels= df["Label"]

print ("\n Text Sample: ")
print(texts.head())

# ========================
# TF-IDF vectorization
# ========================
vectorizer = TfidfVectorizer(
    max_features = 5000,
    ngram_range=(1,2),
    stop_words ='english'
     )

texts_vectorized = vectorizer.fit_transform(texts)

# ========================
# Output logs
# ========================
print("\nTF-IDF Vectorization Completed!")
print("Shape of Vectorized Data:",texts_vectorized.shape)
print("Number of features(words): ",len(vectorizer.get_feature_names_out()))

# ========================
# Train-Test split
# ========================
X_train , X_test , y_train , y_test = train_test_split(
    texts_vectorized,
    labels,
    test_size = 0.2,
    random_state = 42,
    stratify =labels
)

print ("\nTraining Set Shape",X_train.shape)
print("Testing Set Shape:",X_test.shape)

print("\n Training Label Distribution:\n",y_train.value_counts())
print("\nTesting Label Distribution:\n",y_test.value_counts())

# ==============================
# Model 1 : Logistic Regression
# ==============================
print("\n===== Training Logistic Regression =====")

lr_model = LogisticRegression(max_iter =1000)
lr_model.fit(X_train ,y_train)

lr_prediction= lr_model.predict(X_test)

lr_train_prediction = lr_model.predict(X_train)
lr_train_accuracy = accuracy_score(y_train,lr_train_prediction)
lr_accuracy = accuracy_score(y_test,lr_prediction)
lr_f1 = f1_score(y_test,lr_prediction)
print(classification_report(y_test,lr_prediction))

print("Logistic Regression Training Accuracy:", lr_train_accuracy)
print("Logistic Regression Accuracy:", lr_accuracy)
print("Logistic Regression F1 Score:", lr_f1)

# =======================
# Model 2 : Naive Bayes
# =======================
print ("\n===== Training Naive Bayes =====")

nb_model = MultinomialNB()
nb_model.fit(X_train ,y_train)

nb_prediction = nb_model.predict(X_test)
nb_accuracy = accuracy_score(y_test, nb_prediction)
nb_f1 = f1_score(y_test, nb_prediction)

print(classification_report(y_test, nb_prediction))
print("Naive Bayes Accuracy: ",nb_accuracy)
print("Naive Bayes F1 Score: ",nb_f1)

# =======================
# Model 3 : Linear SVM
# =======================

print("\n===== Training Linear SVM =====")
svm_model = LinearSVC()
svm_model.fit(X_train,y_train)

svm_prediction = svm_model.predict(X_test)
svm_accuracy =accuracy_score(y_test, svm_prediction)
svm_train_prediction = svm_model.predict(X_train)
svm_train_accuracy = accuracy_score(y_train,svm_train_prediction)
svm_f1 = f1_score(y_test,svm_prediction)

print(classification_report(y_test,svm_prediction))
print("SVM Training Accuracy:",svm_train_accuracy)
print("SVM Accuracy:",svm_accuracy)
print("SVM F1 Score:",svm_f1)

# =======================
# Model 4 : Random Forest
# =======================

print("\n=====Training Random Forest =====")

rf_model = RandomForestClassifier(
    n_estimators= 100,
    random_state = 42,
    n_jobs = -1
)
rf_model.fit(X_train,y_train)
rf_prediction = rf_model.predict(X_test)
rf_train_prediction = rf_model.predict(X_train)
rf_train_accuracy = accuracy_score (y_train,rf_train_prediction)
rf_accuracy = accuracy_score(y_test,rf_prediction)
rf_f1 = f1_score(y_test , rf_prediction)

print(classification_report(y_test,rf_prediction))
print("Random Forest Train Accuracy:", rf_train_accuracy)
print("Random Forest Accuracy:",rf_accuracy)
print("Random Forest F1 Score:",rf_f1)


# =========================
# Model Comparison Summary
# =========================

print("\n===== Final Model Comparison =====")
print(f"Logistic Regression -> Accuracy: {lr_accuracy:.4f},  F1 Score:{lr_f1:.4f}")
print(f"Naive Bayes         -> Accuracy: {nb_accuracy:.4f},  F1 Score:{nb_f1:.4f}")
print(f"Linear SVM          -> Accuracy: {svm_accuracy:.4f}, F1_score:{svm_f1:.4f}")
print(f"Random Forest       -> Accuracy: {rf_accuracy:.4f},   F1_score:{rf_f1:.4f}")

# Best model selection

best_model = max(
    [
     ("Logistic Regression",lr_f1),
     ("Naive Bayes",nb_f1),
     ("Linear SVM",svm_f1),
     ("Random Forest",rf_f1)
    ],
    key = lambda x:x[1]
)

print("\nBest Performing Model(Bsed on F1 Score):",best_model[0])

# ===============================================
# Hyperparameter Tuning -Linear SVM(Best Model)
# ===============================================
print("\n ===== Hyperparameter Tuning: Linear SVM =====")

param_grid = {
    "C":[0.1,1.5,10]
}

grid_search = GridSearchCV(
    estimator = LinearSVC(),
    param_grid = param_grid,
    scoring="f1",
    cv=5,
    n_jobs =  -1
)

#Training with tuning
grid_search.fit(X_train,y_train)

# Best tuned model
best_svm = grid_search.best_estimator_

print("Best C Value found :",grid_search.best_params_)
print("Best Cross-validation in F1 score:",grid_search.best_score_)

# ======================
# Evaluating Tuned Model
# ======================
tuned_predictions = best_svm.predict(X_test)
tuned_accuracy = accuracy_score(y_test,tuned_predictions)
tuned_f1 = f1_score(y_test,tuned_predictions)
print("\n===== Tuned Linear SVM Results =====")
print("Classification Report:\n" , classification_report(y_test, tuned_predictions))
print("Tuned SVM Accuracy:", tuned_accuracy)
print("Tuned SVM F1 Score:", tuned_f1)

# ======================
# Confusion Matrix
# ======================

cm = confusion_matrix(y_test, tuned_predictions)

print("\nConfusion Matrix:")
print(cm)

# Plot confusion matrix
disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["Educational","Non-Educational"])
disp.plot(cmap="Blues")

plt.title("Confusion Matrix - Tuned Linear SVM")
plt.show()


#=========================
# Overfitting check
#=========================

print("\nOverfitting Check")

train_predictions = best_svm.predict(X_train)
train_accuracy =accuracy_score(y_train,train_predictions)
train_f1 = f1_score(y_train, train_predictions)

print("Train Accuracy:", train_accuracy)
print("Training F1 Score:",train_f1)

print("Testing Accuracy:", tuned_accuracy)
print("Testing F1 Score:", tuned_f1)



# ================================
# Saving best model and vectorizer
# ================================

final_model = best_svm
joblib.dump(final_model,"Models/content_classifier_svm.pkl")

# saving TF-IDF Vectorizer
joblib.dump(vectorizer,"Models/tfidf_vectorizer.pkl")

print("\n Model and Vectorizer saved successfully!")
print("Saved files:")
print("-Models/content_classifier_svm.pkl")
print("-Models/tfidf_vectorizer.pkl")