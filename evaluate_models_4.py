

import pandas as pd
import matplotlib.pyplot as plt
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, ConfusionMatrixDisplay, roc_curve
)
from sklearn.model_selection import cross_val_score


# -----------------------------
# Feature Importance (RF only)
# -----------------------------
def feature_importance_rf(model, feature_names):
    importance_df = pd.DataFrame({
        'feature': feature_names,
        'importance': model.feature_importances_
    }).sort_values(by='importance', ascending=False)

    print("\nTop Features:")
    print(importance_df.head(10))
    return importance_df


# -----------------------------
# Compare Models
# -----------------------------
def compare_models(models, X_test, y_test):
    results = []

    for name, model in models.items():
        y_pred = model.predict(X_test)

        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec = recall_score(y_test, y_pred, zero_division=0)
        f1 = f1_score(y_test, y_pred, zero_division=0)

        if hasattr(model, "predict_proba"):
            y_prob = model.predict_proba(X_test)[:, 1]
            auc = roc_auc_score(y_test, y_prob)
        else:
            auc = None

        results.append({
            "Model": name,
            "Accuracy": round(acc, 3),
            "Precision": round(prec, 3),
            "Recall": round(rec, 3),
            "F1-score": round(f1, 3),
            "ROC-AUC": round(auc, 3) if auc else "N/A"
        })

    results_df = pd.DataFrame(results).sort_values(by="F1-score", ascending=False)
    print("\nModel Comparison:")
    print(results_df)
    return results_df


# -----------------------------
# Overfitting Check
# -----------------------------
def check_overfitting(model, X_train, y_train, X_test, y_test):
    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)

    print("\nOverfitting Check:")
    print("Train Accuracy:", round(accuracy_score(y_train, train_pred), 3))
    print("Test Accuracy:", round(accuracy_score(y_test, test_pred), 3))


# -----------------------------
# ROC-AUC + Curve
# -----------------------------
def plot_roc_curve(model, X_test, y_test, title="ROC Curve"):
    if hasattr(model, "predict_proba"):
        y_prob = model.predict_proba(X_test)[:, 1]

        roc_auc = roc_auc_score(y_test, y_prob)
        print("\nROC-AUC Score:", round(roc_auc, 3))

        fpr, tpr, _ = roc_curve(y_test, y_prob)

        plt.plot(fpr, tpr, label=f"AUC = {roc_auc:.2f}")
        plt.plot([0, 1], [0, 1], linestyle='--')
        plt.xlabel("False Positive Rate")
        plt.ylabel("True Positive Rate")
        plt.title(title)
        plt.legend()
        plt.show()


# -----------------------------
# Confusion Matrix
# -----------------------------
def plot_confusion(model, X_test, y_test, title):
    ConfusionMatrixDisplay.from_estimator(
        model,
        X_test,
        y_test,
        display_labels=['Not Completed', 'Completed'],
        cmap='Blues'
    )
    plt.title(title)
    plt.show()


# -----------------------------
# Cross Validation
# -----------------------------
def cross_validation_score(model, X_train, y_train):
    cv_scores = cross_val_score(model, X_train, y_train, cv=3, scoring='f1')

    print("\nCross-validation F1 scores:", cv_scores)
    print("Mean CV F1 score:", round(cv_scores.mean(), 3))