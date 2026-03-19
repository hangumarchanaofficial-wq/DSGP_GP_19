# finetune_xgboost.py
# Fine-tune XGBoost with grid search over key hyperparameters

import json
import numpy as np
from pathlib import Path
import xgboost as xgb
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, confusion_matrix, classification_report
import joblib

# ── Paths ──
BASE_DIR = Path(__file__).resolve().parent.parent
WINDOWS_DIR = BASE_DIR / "data" / "processed" / "windows"
SAVE_DIR = Path(__file__).resolve().parent / "saved_models" / "baselines"
SAVE_DIR.mkdir(parents=True, exist_ok=True)


def flatten_windows(X_3d):
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

    X_train_flat = flatten_windows(X_train)
    X_val_flat = flatten_windows(X_val)
    X_test_flat = flatten_windows(X_test)

    n_pos = (y_train == 1).sum()
    n_neg = (y_train == 0).sum()
    scale = n_neg / n_pos if n_pos > 0 else 1.0

    print(f"Train: {len(y_train)}, Val: {len(y_val)}, Test: {len(y_test)}")
    print(f"Features: {X_train_flat.shape[1]}, Scale: {scale:.2f}")

    # 2. Define hyperparameter combinations to try
    configs = [
        {"n_estimators": 300, "max_depth": 6, "learning_rate": 0.05, "subsample": 1.0, "colsample_bytree": 1.0},
        {"n_estimators": 500, "max_depth": 8, "learning_rate": 0.03, "subsample": 0.8, "colsample_bytree": 0.8},
        {"n_estimators": 400, "max_depth": 10, "learning_rate": 0.05, "subsample": 0.9, "colsample_bytree": 0.9},
        {"n_estimators": 300, "max_depth": 4, "learning_rate": 0.1, "subsample": 1.0, "colsample_bytree": 1.0},
        {"n_estimators": 500, "max_depth": 6, "learning_rate": 0.01, "subsample": 0.8, "colsample_bytree": 0.7},
    ]

    # 3. Try each config, pick best by validation F1
    best_f1 = 0
    best_model = None
    best_config = None

    print(f"\nTrying {len(configs)} configurations...\n")
    print(f"  {'#':>3}  {'depth':>5}  {'lr':>6}  {'trees':>5}  {'sub':>4}  {'col':>4}  {'Val F1':>8}  {'Val Acc':>8}")
    print(f"  {'-'*55}")

    for i, cfg in enumerate(configs, 1):
        model = xgb.XGBClassifier(
            n_estimators=cfg["n_estimators"],
            max_depth=cfg["max_depth"],
            learning_rate=cfg["learning_rate"],
            subsample=cfg["subsample"],
            colsample_bytree=cfg["colsample_bytree"],
            scale_pos_weight=scale,
            early_stopping_rounds=20,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X_train_flat, y_train, eval_set=[(X_val_flat, y_val)], verbose=False)

        val_pred = model.predict(X_val_flat)
        val_f1 = f1_score(y_val, val_pred, zero_division=0)
        val_acc = accuracy_score(y_val, val_pred)

        tag = ""
        if val_f1 > best_f1:
            best_f1 = val_f1
            best_model = model
            best_config = cfg
            tag = " <-- best"

        print(f"  {i:3d}  {cfg['max_depth']:>5}  {cfg['learning_rate']:>6.3f}  "
              f"{cfg['n_estimators']:>5}  {cfg['subsample']:>4.1f}  {cfg['colsample_bytree']:>4.1f}  "
              f"{val_f1:>8.4f}  {val_acc:>8.4f}{tag}")

    # 4. Evaluate best model on test set
    print(f"\nBest config: {best_config}")

    y_pred = best_model.predict(X_test_flat)
    y_prob = best_model.predict_proba(X_test_flat)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_prob) if len(np.unique(y_test)) > 1 else 0.0
    cm = confusion_matrix(y_test, y_pred)

    print(f"\n{'='*40}")
    print(f"  Fine-tuned XGBoost Results")
    print(f"{'='*40}")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  F1 Score : {f1:.4f}")
    print(f"  ROC-AUC  : {auc:.4f}")
    print(f"  Confusion Matrix:")
    print(f"    TN={cm[0,0]}  FP={cm[0,1]}")
    print(f"    FN={cm[1,0]}  TP={cm[1,1]}")
    print(f"{'='*40}")
    print(classification_report(y_test, y_pred, target_names=["Focused", "Distracted"]))

    # 5. Save
    joblib.dump(best_model, SAVE_DIR / "xgboost_finetuned.joblib")

    results = {
        "accuracy": round(acc, 4),
        "f1": round(f1, 4),
        "auc": round(auc, 4),
        "best_config": best_config,
    }
    with open(SAVE_DIR / "xgboost_finetuned_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nFine-tuned model saved to: {SAVE_DIR / 'xgboost_finetuned.joblib'}")


if __name__ == "__main__":
    main()
