"""Fine-tune the current BiLSTM checkpoint on the 24-feature windowed dataset.

This keeps the model architecture compatible with the live pipeline by starting
from the current baseline checkpoint and continuing training on the latest
windowed train/validation split.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    roc_auc_score,
)
from torch.utils.data import DataLoader, TensorDataset

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from distraction_prediction.models.lstm_model import DistractionLSTM

WINDOWS_DIR      = PROJECT_ROOT / "distraction_prediction" / "data" / "processed" / "windows"
SAVE_DIR         = PROJECT_ROOT / "distraction_prediction" / "models" / "saved_models"
EVAL_DIR         = SAVE_DIR / "evaluation"

BASELINE_CKPT    = SAVE_DIR / "best_model.pt"
FINETUNED_CKPT   = SAVE_DIR / "best_model_finetuned.pt"
FINETUNE_RESULTS = SAVE_DIR / "bilstm_finetuned_results.json"
EVAL_RESULTS     = EVAL_DIR / "finetuned_bilstm_results.json"


# ──────────────────────────────────────────────────────────────────────────
def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss    = 0.0
    total_correct = 0
    total_items   = 0

    for features, labels in loader:
        features = features.to(device)
        labels   = labels.to(device)

        optimizer.zero_grad()
        logits = model(features)
        loss   = criterion(logits, labels)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()

        total_loss    += loss.item() * len(labels)
        predictions    = (torch.sigmoid(logits) >= 0.5).float()
        total_correct += (predictions == labels).sum().item()
        total_items   += len(labels)

    return total_loss / total_items, total_correct / total_items


def evaluate_epoch(model, loader, criterion, device):
    model.eval()
    total_loss    = 0.0
    total_correct = 0
    total_items   = 0

    with torch.no_grad():
        for features, labels in loader:
            features = features.to(device)
            labels   = labels.to(device)
            logits   = model(features)
            loss     = criterion(logits, labels)

            total_loss    += loss.item() * len(labels)
            predictions    = (torch.sigmoid(logits) >= 0.5).float()
            total_correct += (predictions == labels).sum().item()
            total_items   += len(labels)

    return total_loss / total_items, total_correct / total_items


def evaluate_checkpoint(checkpoint_path, x_test, y_test, device):
    checkpoint  = torch.load(checkpoint_path, map_location=device, weights_only=False)
    config      = dict(checkpoint["config"])
    config.setdefault("head_name", "out")   # safety — older checkpoints may omit this

    model = DistractionLSTM(**config).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    with torch.no_grad():
        logits        = model(torch.tensor(x_test, dtype=torch.float32, device=device))
        probabilities = torch.sigmoid(logits).cpu().numpy()

    predictions = (probabilities >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, predictions).ravel()

    return {
        "accuracy":          round(float(accuracy_score(y_test, predictions)),           4),
        "f1":                round(float(f1_score(y_test, predictions)),                  4),
        "auc":               round(float(roc_auc_score(y_test, probabilities)),           4),
        "avg_precision":     round(float(average_precision_score(y_test, probabilities)), 4),
        "confusion_matrix":  {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "config":            config,
        "used_feature_count": int(x_test.shape[2]),
        "compatibility_note": "exact feature match",
    }


# ──────────────────────────────────────────────────────────────────────────
def main():
    SAVE_DIR.mkdir(parents=True, exist_ok=True)
    EVAL_DIR.mkdir(parents=True, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # ── Load windowed data ───────────────────────────────────────
    x_train = np.load(WINDOWS_DIR / "X_train.npy")
    y_train = np.load(WINDOWS_DIR / "y_train.npy")
    x_val   = np.load(WINDOWS_DIR / "X_val.npy")
    y_val   = np.load(WINDOWS_DIR / "y_val.npy")
    x_test  = np.load(WINDOWS_DIR / "X_test.npy")
    y_test  = np.load(WINDOWS_DIR / "y_test.npy")

    print(f"Train: {x_train.shape}, distracted rate={y_train.mean():.3f}")
    print(f"Val  : {x_val.shape},   distracted rate={y_val.mean():.3f}")
    print(f"Test : {x_test.shape},  distracted rate={y_test.mean():.3f}")

    # ── Load baseline checkpoint ─────────────────────────────────
    baseline    = torch.load(BASELINE_CKPT, map_location=device, weights_only=False)
    base_config = dict(baseline["config"])
    base_config.setdefault("head_name", "out")   # ← safety: guarantee key exists

    model = DistractionLSTM(**base_config).to(device)
    model.load_state_dict(baseline["model_state_dict"])

    # ── DataLoaders ──────────────────────────────────────────────
    train_loader = DataLoader(
        TensorDataset(
            torch.tensor(x_train, dtype=torch.float32),
            torch.tensor(y_train, dtype=torch.float32),
        ),
        batch_size=256,
        shuffle=True,
    )
    val_loader = DataLoader(
        TensorDataset(
            torch.tensor(x_val, dtype=torch.float32),
            torch.tensor(y_val, dtype=torch.float32),
        ),
        batch_size=256,
    )

    # ── Loss / Optimiser / Scheduler ────────────────────────────
    pos_weight = torch.tensor(
        [(len(y_train) - y_train.sum()) / y_train.sum()],
        dtype=torch.float32,
        device=device,
    )
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4, weight_decay=5e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=3
    )

    # ── Training loop ────────────────────────────────────────────
    max_epochs              = 30
    early_stopping_patience = 8
    best_val_loss           = float("inf")
    best_state              = None
    best_epoch              = 0
    history                 = []
    epochs_without_improvement = 0
    start_time              = time.time()

    for epoch in range(1, max_epochs + 1):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss,   val_acc   = evaluate_epoch(model, val_loader, criterion, device)
        scheduler.step(val_loss)

        history.append({
            "epoch":      epoch,
            "train_loss": round(train_loss, 6),
            "train_acc":  round(train_acc,  6),
            "val_loss":   round(val_loss,   6),
            "val_acc":    round(val_acc,    6),
            "lr":         optimizer.param_groups[0]["lr"],
        })

        message = (
            f"Epoch {epoch:02d} | "
            f"Train {train_loss:.4f}/{train_acc:.4f} | "
            f"Val {val_loss:.4f}/{val_acc:.4f} | "
            f"LR {optimizer.param_groups[0]['lr']:.1e}"
        )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_epoch    = epoch
            best_state    = {
                k: v.detach().cpu().clone()
                for k, v in model.state_dict().items()
            }
            epochs_without_improvement = 0
            message += "  [saved]"
        else:
            epochs_without_improvement += 1

        print(message)

        if epochs_without_improvement >= early_stopping_patience:
            print(f"Early stopping at epoch {epoch}")
            break

    elapsed = time.time() - start_time

    if best_state is None:
        raise RuntimeError("Fine-tuning did not produce any checkpoint.")

    # ── Save fine-tuned checkpoint ───────────────────────────────
    torch.save(
        {
            "epoch":             best_epoch,
            "model_state_dict":  best_state,
            "val_loss":          best_val_loss,
            "config":            base_config,          # includes head_name
            "source_checkpoint": str(BASELINE_CKPT),
        },
        FINETUNED_CKPT,
    )

    # ── Save training summary ────────────────────────────────────
    with open(FINETUNE_RESULTS, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "source_checkpoint": str(BASELINE_CKPT),
                "best_epoch":        best_epoch,
                "best_val_loss":     round(best_val_loss, 6),
                "training_seconds":  round(elapsed, 2),
                "optimizer":         {"name": "AdamW", "lr": 1e-4, "weight_decay": 5e-4},
                "history":           history,
                "config":            base_config,
            },
            handle,
            indent=2,
        )

    # ── Evaluate on test set ─────────────────────────────────────
    test_metrics = evaluate_checkpoint(FINETUNED_CKPT, x_test, y_test, device)
    with open(EVAL_RESULTS, "w", encoding="utf-8") as handle:
        json.dump(test_metrics, handle, indent=2)

    print(f"\nFine-tuning finished in {elapsed:.1f}s")
    print(f"Saved checkpoint     : {FINETUNED_CKPT}")
    print(f"Saved training summary: {FINETUNE_RESULTS}")
    print(f"Saved test metrics   : {EVAL_RESULTS}")
    print(f"Test metrics         : {test_metrics}")


if __name__ == "__main__":
    main()
