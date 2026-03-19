# finetune_random_forest.py
# Fine-tune Random Forest with grid search over key hyperparameters

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

    # Combine train + val for final training
    X_trainval = np.concatenate([X_train_flat, X_val_flat])
    y_trainval = np.concatenate([y_train, y_val])

    print(f"Train: {len(y_train)}, Val: {len(y_val)}, Test: {len(y_test)}")
    print(f"Train+Val: {len(y_trainval)}, Features: {X_train_flat.shape[1]}")

    # 2. Define hyperparameter combinations
    configs = [
        {"n_estimators": 300, "max_depth": 15, "min_samples_split": 2, "min_samples_leaf": 1, "max_features": "sqrt"},
        {"n_estimators": 500, "max_depth": 20, "min_samples_split": 5, "min_samples_leaf": 2, "max_features": "sqrt"},
        {"n_estimators": 300, "max_depth": 10, "min_samples_split": 10, "min_samples_leaf": 4, "max_features": "log2"},
        {"n_estimators": 500, "max_depth": None, "min_samples_split": 2, "min_samples_leaf": 1, "max_features": "sqrt"},
        {"n_estimators": 400, "max_depth": 8, "min_samples_split": 5, "min_samples_leaf": 2, "max_features": 0.5},
    ]

    # 3. Try each config on train, evaluate on val
    best_f1 = 0
    best_model = None
    best_config = None

    print(f"\nTrying {len(configs)} configurations...\n")
    print(f"  {'#':>3}  {'depth':>6}  {'split':>5}  {'leaf':>4}  {'trees':>5}  {'feat':>5}  {'Val F1':>8}  {'Val Acc':>8}")
    print(f"  {'-'*60}")

    for i, cfg in enumerate(configs, 1):
        model = RandomForestClassifier(
            n_estimators=cfg["n_estimators"],
            max_depth=cfg["max_depth"],
            min_samples_split=cfg["min_samples_split"],
            min_samples_leaf=cfg["min_samples_leaf"],
            max_features=cfg["max_features"],
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )
        # Train on train only, evaluate on val
        model.fit(X_train_flat, y_train)

        val_pred = model.predict(X_val_flat)
        val_f1 = f1_score(y_val, val_pred, zero_division=0)
        val_acc = accuracy_score(y_val, val_pred)

        depth_str = str(cfg["max_depth"]) if cfg["max_depth"] else "None"
        feat_str = str(cfg["max_features"])

        tag = ""
        if val_f1 > best_f1:
            best_f1 = val_f1
            best_model = model
            best_config = cfg
            tag = " <-- best"

        print(f"  {i:3d}  {depth_str:>6}  {cfg['min_samples_split']:>5}  "
              f"{cfg['min_samples_leaf']:>4}  {cfg['n_estimators']:>5}  {feat_str:>5}  "
              f"{val_f1:>8.4f}  {val_acc:>8.4f}{tag}")

    # 4. Retrain best config on train+val, evaluate on test
    print(f"\nBest config: {best_config}")
    print("Retraining on train+val...")

    final_model = RandomForestClassifier(
        n_estimators=best_config["n_estimators"],
        max_depth=best_config["max_depth"],
        min_samples_split=best_config["min_samples_split"],
        min_samples_leaf=best_config["min_samples_leaf"],
        max_features=best_config["max_features"],
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    final_model.fit(X_trainval, y_trainval)

    y_pred = final_model.predict(X_test_flat)
    y_prob = final_model.predict_proba(X_test_flat)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_prob) if len(np.unique(y_test)) > 1 else 0.0
    cm = confusion_matrix(y_test, y_pred)

    print(f"\n{'='*40}")
    print(f"  Fine-tuned Random Forest Results")
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
    joblib.dump(final_model, SAVE_DIR / "random_forest_finetuned.joblib")

    # Convert max_features for JSON serialization
    save_config = best_config.copy()
    if save_config["max_depth"] is None:
        save_config["max_depth"] = "None"

    results = {
        "accuracy": round(acc, 4),
        "f1": round(f1, 4),
        "auc": round(auc, 4),
        "best_config": save_config,
    }
    with open(SAVE_DIR / "random_forest_finetuned_results.json", "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nFine-tuned model saved to: {SAVE_DIR / 'random_forest_finetuned.joblib'}")


if __name__ == "__main__":
    main()
