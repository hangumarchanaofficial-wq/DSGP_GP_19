"""
finetune_bilstm.py — Find best BiLSTM config for 5-min lookahead prediction.
All configs use strong regularization to prevent overfitting.
"""

import time
import json
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from pathlib import Path

# ── Paths ──
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
WINDOWS_DIR = BASE_DIR / "data" / "processed" / "windows"
SAVE_DIR = SCRIPT_DIR / "saved_models"
SAVE_DIR.mkdir(parents=True, exist_ok=True)


# ── Model ──
class TemporalAttention(nn.Module):
    def __init__(self, hidden_size):
        super().__init__()
        self.attn = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.Tanh(),
            nn.Linear(hidden_size // 2, 1),
        )

    def forward(self, lstm_out):
        scores = self.attn(lstm_out).squeeze(-1)
        weights = torch.softmax(scores, dim=1)
        return (lstm_out * weights.unsqueeze(-1)).sum(dim=1)


class DistractionLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=1,
                 dropout=0.3, bidirectional=True):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size, hidden_size, num_layers,
            batch_first=True, dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional,
        )
        d = hidden_size * (2 if bidirectional else 1)
        self.attention = TemporalAttention(d)
        self.norm = nn.LayerNorm(d)
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(d, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = self.attention(out)
        out = self.norm(out)
        out = self.dropout(out)
        return self.classifier(out)


def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss, correct, total = 0, 0, 0
    for X, y in loader:
        X, y = X.to(device), y.to(device)
        optimizer.zero_grad()
        out = model(X).squeeze()
        loss = criterion(out, y)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        total_loss += loss.item() * len(y)
        preds = (torch.sigmoid(out) >= 0.5).long()
        correct += (preds == y.long()).sum().item()
        total += len(y)
    return total_loss / total, correct / total


def eval_epoch(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0, 0, 0
    with torch.no_grad():
        for X, y in loader:
            X, y = X.to(device), y.to(device)
            out = model(X).squeeze()
            loss = criterion(out, y)
            total_loss += loss.item() * len(y)
            preds = (torch.sigmoid(out) >= 0.5).long()
            correct += (preds == y.long()).sum().item()
            total += len(y)
    return total_loss / total, correct / total


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Load data
    print("Loading data...")
    X_train = np.load(WINDOWS_DIR / "X_train.npy")
    y_train = np.load(WINDOWS_DIR / "y_train.npy")
    X_val = np.load(WINDOWS_DIR / "X_val.npy")
    y_val = np.load(WINDOWS_DIR / "y_val.npy")
    print(f"Train: {X_train.shape}, Val: {X_val.shape}")
    print(f"Distraction rate — Train: {y_train.mean():.3f}, Val: {y_val.mean():.3f}")

    # Class weight
    n_pos = y_train.sum()
    n_neg = len(y_train) - n_pos
    pos_weight = torch.tensor([n_neg / n_pos], dtype=torch.float32).to(device)

    # Tensors
    X_tr = torch.FloatTensor(X_train)
    y_tr = torch.FloatTensor(y_train)
    X_va = torch.FloatTensor(X_val)
    y_va = torch.FloatTensor(y_val)

    input_size = X_train.shape[2]

    # ── Configs designed to fight overfitting ──
    configs = [
        {
            "hidden_size": 64, "num_layers": 1, "dropout": 0.5,
            "lr": 5e-4, "weight_decay": 1e-3, "batch_size": 256,
        },
        {
            "hidden_size": 32, "num_layers": 1, "dropout": 0.5,
            "lr": 5e-4, "weight_decay": 1e-3, "batch_size": 256,
        },
        {
            "hidden_size": 64, "num_layers": 2, "dropout": 0.5,
            "lr": 5e-4, "weight_decay": 5e-3, "batch_size": 256,
        },
        {
            "hidden_size": 128, "num_layers": 1, "dropout": 0.6,
            "lr": 3e-4, "weight_decay": 1e-3, "batch_size": 512,
        },
        {
            "hidden_size": 64, "num_layers": 1, "dropout": 0.4,
            "lr": 1e-3, "weight_decay": 1e-2, "batch_size": 128,
        },
    ]

    print(f"\nTrying {len(configs)} configurations...\n")

    best_val_loss = float("inf")
    best_val_acc = 0
    best_config = None
    best_state = None
    results = []

    for i, cfg in enumerate(configs):
        print(f"  Config {i+1}/{len(configs)}: h={cfg['hidden_size']}, "
              f"layers={cfg['num_layers']}, drop={cfg['dropout']}, "
              f"lr={cfg['lr']}, wd={cfg['weight_decay']}, bs={cfg['batch_size']}")

        train_loader = DataLoader(
            TensorDataset(X_tr, y_tr),
            batch_size=cfg["batch_size"], shuffle=True,
        )
        val_loader = DataLoader(
            TensorDataset(X_va, y_va),
            batch_size=cfg["batch_size"],
        )

        model = DistractionLSTM(
            input_size=input_size,
            hidden_size=cfg["hidden_size"],
            num_layers=cfg["num_layers"],
            dropout=cfg["dropout"],
        ).to(device)

        params = sum(p.numel() for p in model.parameters())
        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
        optimizer = torch.optim.AdamW(
            model.parameters(), lr=cfg["lr"], weight_decay=cfg["weight_decay"],
        )
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode="min", factor=0.5, patience=5,
        )

        cfg_best_loss = float("inf")
        cfg_best_acc = 0
        cfg_best_state = None
        cfg_best_epoch = 0
        patience_counter = 0
        start_time = time.time()

        for epoch in range(1, 101):
            t_loss, t_acc = train_epoch(model, train_loader, criterion, optimizer, device)
            v_loss, v_acc = eval_epoch(model, val_loader, criterion, device)
            scheduler.step(v_loss)

            if v_loss < cfg_best_loss:
                cfg_best_loss = v_loss
                cfg_best_acc = v_acc
                cfg_best_state = model.state_dict().copy()
                cfg_best_epoch = epoch
                patience_counter = 0
            else:
                patience_counter += 1

            if patience_counter >= 15:
                break

        elapsed = time.time() - start_time
        print(f"    → Best epoch {cfg_best_epoch}: val_loss={cfg_best_loss:.4f}, "
              f"val_acc={cfg_best_acc:.4f}, params={params:,}, time={elapsed:.0f}s")

        results.append({
            "config": cfg,
            "val_loss": cfg_best_loss,
            "val_acc": cfg_best_acc,
            "best_epoch": cfg_best_epoch,
            "params": params,
            "time": elapsed,
        })

        if cfg_best_loss < best_val_loss:
            best_val_loss = cfg_best_loss
            best_val_acc = cfg_best_acc
            best_config = cfg
            best_state = cfg_best_state

    # ── Summary ──
    print("\n" + "=" * 60)
    print("  Fine-tuning Results")
    print("=" * 60)
    for i, r in enumerate(results):
        c = r["config"]
        marker = " ← BEST" if c == best_config else ""
        print(f"  Config {i+1}: h={c['hidden_size']}, layers={c['num_layers']}, "
              f"drop={c['dropout']}, lr={c['lr']}, wd={c['weight_decay']} "
              f"| val_loss={r['val_loss']:.4f}, val_acc={r['val_acc']:.4f}, "
              f"params={r['params']:,}, time={r['time']:.0f}s{marker}")
    print("=" * 60)

    # ── Save best model ──
    model_path = SAVE_DIR / "best_model_finetuned.pt"
    torch.save({
        "model_state_dict": best_state,
        "val_loss": best_val_loss,
        "config": {
            "input_size": input_size,
            "hidden_size": best_config["hidden_size"],
            "num_layers": best_config["num_layers"],
            "dropout": best_config["dropout"],
            "bidirectional": True,
        },
    }, model_path)

    # ── Save results JSON ──
    json_path = SAVE_DIR / "bilstm_finetuned_results.json"
    with open(json_path, "w") as f:
        json.dump({
            "val_loss": round(best_val_loss, 4),
            "val_acc": round(best_val_acc, 4),
            "best_config": best_config,
        }, f, indent=2)

    print(f"\nBest model saved to: {model_path}")
    print(f"Results saved to: {json_path}")
    print(f"Best config: {best_config}")
    print(f"Best val_loss: {best_val_loss:.4f}, val_acc: {best_val_acc:.4f}")


if __name__ == "__main__":
    main()
