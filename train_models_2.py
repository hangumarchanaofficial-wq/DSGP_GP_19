from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression


# -----------------------------
# Decision Tree
# -----------------------------
def train_decision_tree(X_train, y_train):
    model = DecisionTreeClassifier(
        max_depth=5,
        min_samples_split=20,
        min_samples_leaf=10,
        random_state=42
    )
    model.fit(X_train, y_train)
    return model


# -----------------------------
# Random Forest
# -----------------------------
def train_random_forest(X_train, y_train):
    rf_model = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42
    )
    rf_model.fit(X_train, y_train)
    return rf_model


# -----------------------------
# Logistic Regression
# -----------------------------
def train_logistic_regression(X_train, y_train):
    log_model = LogisticRegression(
        max_iter=1000,
        class_weight='balanced',
        random_state=42
    )
    log_model.fit(X_train, y_train)
    return log_model