from preprocessing_1 import preprocess_data

X_train_bal, X_test_bal, y_train_bal, y_test_bal, scaler, feature_columns = preprocess_data(
    "enhanced_student_habits_performance_dataset.csv"
)

from train_models_2 import train_decision_tree, train_random_forest, train_logistic_regression

dt_model = train_decision_tree(X_train_bal, y_train_bal)
rf_model = train_random_forest(X_train_bal, y_train_bal)
lr_model = train_logistic_regression(X_train_bal, y_train_bal)

from tune_models_3 import (
    tune_decision_tree,
    tune_logistic_regression,
    tune_random_forest
)

best_dt = tune_decision_tree(X_train_bal, y_train_bal)
best_lr = tune_logistic_regression(X_train_bal, y_train_bal)
best_rf = tune_random_forest(X_train_bal, y_train_bal)


from evaluate_models_4 import (
    compare_models,
    check_overfitting,
    plot_roc_curve,
    plot_confusion,
    cross_validation_score,
    feature_importance_rf
)

from preprocessing_1 import preprocess_data
from tune_models_3 import tune_random_forest
from planner_integration_6 import adaptive_planner
import joblib

# Step 1: Preprocess
X_train_bal, X_test_bal, y_train_bal, y_test_bal, scaler, feature_columns = preprocess_data(
    "enhanced_student_habits_performance_dataset.csv"
)

# Step 2: Train model
best_rf = tune_random_forest(X_train_bal, y_train_bal)

# Step 3: Save model
joblib.dump(best_rf, "adaptive_planner_model.pkl")

import joblib

# Save model
joblib.dump(best_rf, "adaptive_planner_model.pkl")

# Save scaler
joblib.dump(scaler, "scaler.pkl")

# Save feature columns
joblib.dump(X_train_bal.columns.tolist(), "feature_columns.pkl")

print("Model, scaler, and features saved successfully!")