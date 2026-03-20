from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GridSearchCV


# -----------------------------
# Tune Decision Tree
# -----------------------------
def tune_decision_tree(X_train, y_train):
    dt = DecisionTreeClassifier(random_state=42)

    param_grid = {
        'max_depth': [3, 5, 7, 10, None],
        'min_samples_split': [2, 10, 20, 50],
        'min_samples_leaf': [1, 5, 10, 20],
        'criterion': ['gini', 'entropy']
    }

    grid_search = GridSearchCV(
        estimator=dt,
        param_grid=param_grid,
        cv=5,
        scoring='f1',
        n_jobs=-1
    )

    grid_search.fit(X_train, y_train)
    print("Best Decision Tree Parameters:", grid_search.best_params_)
    return grid_search.best_estimator_


# -----------------------------
# Tune Logistic Regression
# -----------------------------
def tune_logistic_regression(X_train, y_train):
    log_reg = LogisticRegression(
        max_iter=2000,
        class_weight='balanced',
        random_state=42
    )

    param_grid = {
        "C": [0.01, 0.1, 1, 10],
        "penalty": ["l2"],
        "solver": ["lbfgs", "liblinear"]
    }

    grid_lr = GridSearchCV(
        estimator=log_reg,
        param_grid=param_grid,
        cv=5,
        scoring="f1",
        n_jobs=-1,
        verbose=1
    )

    grid_lr.fit(X_train, y_train)
    print("Best Logistic Regression Parameters:", grid_lr.best_params_)
    return grid_lr.best_estimator_


# -----------------------------
# Tune Random Forest
# -----------------------------
def tune_random_forest(X_train, y_train):
    rf = RandomForestClassifier(
        random_state=42,
        n_jobs=-1
    )

    param_grid = {
        "n_estimators": [100, 150],
        "max_depth": [8, 12],
        "min_samples_split": [10, 20],
        "min_samples_leaf": [5, 10],
        "max_features": ["sqrt"]
    }

    grid_rf = GridSearchCV(
        estimator=rf,
        param_grid=param_grid,
        cv=3,
        scoring="f1",
        n_jobs=-1,
        verbose=1
    )

    grid_rf.fit(X_train, y_train)
    print("Best Random Forest Parameters:", grid_rf.best_params_)
    return grid_rf.best_estimator_