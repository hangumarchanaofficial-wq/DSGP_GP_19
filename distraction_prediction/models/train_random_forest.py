# train_random_forest.py
# Simple Random Forest baseline for distraction prediction

import json
import numpy as np
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, confusion_matrix, classification_report
import joblib

# ── Paths ──
BASE_DIR = Path(__file__).resolve().parent.parent
WINDOWS_DIR = BASE_DIR / "data" / "processed" / "windows"
SAVE_DIR = Path(__file__).resolve().parent / "saved_models" / "baselines"
SAVE_DIR.mkdir(parents=True, exist_ok=True)


def flatten_windows(X_3d):
    """
    Convert 3D windows (samples, timesteps, features) to 2D
    by taking mean and last value of each feature across the window.
    """
    mean_feat = np.mean(X_3d, axis=1)
    last_feat = X_3d[:, -1, :]
    return np.hstack([mean_feat, last_feat]).astype(np.float32)


def main():
    # 1. Load data
    print("Loading data...")
    X_train = np.load(WINDOWS_DIR / "X_train.npy")
    y_train = np.load(WINDOWS_DIR / "y_train.npy")
    X_val = np.load(WINDOWS_DIR / "X_val.npy")
    y_val = np.load(WINDOWS_DIR / "y_val.npy")
    X_test = np.load(WINDOWS_DIR / "X_test.npy")
    y_test = np.load(WINDOWS_DIR / "y_test.npy")

    print(f"Train: {X_train.shape}, Val: {X_val.shape}, Test: {X_test.shape}")

    # 2. Flatten 3D windows to 2D
    X_train_flat = flatten_windows(X_train)
    X_val_flat = flatten_windows(X_val)
    X_test_flat = flatten_windows(X_test)

    # 3. Combine train + val (RF doesn't need separate validation)
    X_trainval = np.concatenate([X_train_flat, X_val_flat])
    y_trainval = np.concatenate([y_train, y_val])

    print(f"Train+Val: {len(X_trainval)}, Test: {len(X_test_flat)}")
    print(f"Flattened features: {X_trainval.shape[1]}")

    # 4. Train Random Forest
    print("\nTraining Random Forest...")
    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=15,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_trainval, y_trainval)
    print("Training complete.")

    # 5. Predict
    y_pred = model.predict(X_test_flat)
    y_prob = model.predict_proba(X_test_flat)[:, 1]

    # 6. Evaluate
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_prob) if len(np.unique(y_test)) > 1 else 0.0
    cm = confusion_matrix(y_test, y_pred)

    print(f"\n{'='*40}")
    print(f"  Random Forest Results")
    print(f"{'='*40}")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  F1 Score : {f1:.4f}")
    print(f"  ROC-AUC  : {auc:.4f}")
    print(f"  Confusion Matrix:")
    print(f"    TN={cm[0,0]}  FP={cm[0,1]}")
    print(f"    FN={cm[1,0]}  TP={cm[1,1]}")
    print(f"{'='*40}")
    print(classification_report(y_test, y_pred, target_names=["Focused", "Distracted"]))

    # 7. Save model and results
    joblib.dump(model, SAVE_DIR / "random_forest.joblib")

    results = {"accuracy": round(acc, 4), "f1": round(f1, 4), "auc": round(auc, 4)}
    with open(SAVE_DIR / "random_forest_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"Model saved to: {SAVE_DIR / 'random_forest.joblib'}")


if __name__ == "__main__":
    main()
