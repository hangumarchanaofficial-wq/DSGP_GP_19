from preprocessing_1 import preprocess_data

from train_models_2 import (
    train_decision_tree,
    train_random_forest,
    train_logistic_regression
)
from tune_models_3 import (
    tune_decision_tree,
    tune_random_forest,
    tune_logistic_regression
)
from evaluate_models_4 import (
    compare_models,
    plot_confusion,
    check_overfitting,
    plot_roc_curve,
    cross_validation_score,
    feature_importance_rf
)
import joblib


def main():
    # -----------------------------
    # 1. Preprocess data
    # -----------------------------
    X_train_bal, X_test_bal, y_train_bal, y_test_bal, scaler, feature_columns = preprocess_data(
        "enhanced_student_habits_performance_dataset.csv"
    )

    # -----------------------------
    # 2. Train base models (without tuning)
    # -----------------------------
    dt_model = train_decision_tree(X_train_bal, y_train_bal)
    rf_model = train_random_forest(X_train_bal, y_train_bal)
    lr_model = train_logistic_regression(X_train_bal, y_train_bal)

    # -----------------------------
    # 3. Compare base models
    # -----------------------------
    base_models = {
        "Decision Tree": dt_model,
        "Random Forest": rf_model,
        "Logistic Regression": lr_model
    }

    print("\n===== Base Model Comparison =====")
    compare_models(base_models, X_test_bal, y_test_bal)

    # -----------------------------
    # 4. Base model confusion matrices
    # -----------------------------
    plot_confusion(dt_model, X_test_bal, y_test_bal, "Confusion Matrix – Decision Tree")
    plot_confusion(rf_model, X_test_bal, y_test_bal, "Confusion Matrix – Random Forest")
    plot_confusion(lr_model, X_test_bal, y_test_bal, "Confusion Matrix – Logistic Regression")

    # -----------------------------
    # 5. Tune all models
    # -----------------------------
    best_dt = tune_decision_tree(X_train_bal, y_train_bal)
    best_rf = tune_random_forest(X_train_bal, y_train_bal)
    best_lr = tune_logistic_regression(X_train_bal, y_train_bal)

    # -----------------------------
    # 6. Compare tuned models
    # -----------------------------
    tuned_models = {
        "Tuned Decision Tree": best_dt,
        "Tuned Random Forest": best_rf,
        "Tuned Logistic Regression": best_lr
    }

    print("\n===== Tuned Model Comparison =====")
    compare_models(tuned_models, X_test_bal, y_test_bal)

    # -----------------------------
    # 7. Tuned model confusion matrices
    # -----------------------------
    plot_confusion(best_dt, X_test_bal, y_test_bal, "Confusion Matrix – Tuned Decision Tree")
    plot_confusion(best_rf, X_test_bal, y_test_bal, "Confusion Matrix – Tuned Random Forest")
    plot_confusion(best_lr, X_test_bal, y_test_bal, "Confusion Matrix – Tuned Logistic Regression")

    # -----------------------------
    # 8. Additional evaluation for final model
    # -----------------------------
    check_overfitting(best_rf, X_train_bal, y_train_bal, X_test_bal, y_test_bal)
    plot_roc_curve(best_rf, X_test_bal, y_test_bal, "ROC Curve – Tuned Random Forest")
    cross_validation_score(best_rf, X_train_bal, y_train_bal)
    feature_importance_rf(best_rf, X_train_bal.columns)

    # -----------------------------
    # 9. Save final selected model + preprocessing artifacts
    # -----------------------------
    joblib.dump(best_rf, "adaptive_planner_model.pkl")
    joblib.dump(scaler, "scaler.pkl")
    joblib.dump(feature_columns, "feature_columns.pkl")

    print("\nFinal model and preprocessing artifacts saved successfully.")


if __name__ == "__main__":
    main()