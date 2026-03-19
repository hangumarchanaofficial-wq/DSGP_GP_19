# train.py
# BiLSTM with Attention — predicts distraction in next 5 minutes

import time
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from pathlib import Path

# ── Paths ──
BASE_DIR = Path(__file__).resolve().parent.parent
WINDOWS_DIR = BASE_DIR / "data" / "processed" / "windows"
SAVE_DIR = Path(__file__).resolve().parent / "saved_models"
SAVE_DIR.mkdir(parents=True, exist_ok=True)


# ── Attention: which minutes matter most? ──
class TemporalAttention(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.attn = nn.Sequential(nn.Linear(dim, dim // 2), nn.Tanh(), nn.Linear(dim // 2, 1))

    def forward(self, x):
        w = torch.softmax(self.attn(x), dim=1)
        return (x * w).sum(dim=1)


# ── Model: LSTM → Attention → Predict ──
class DistractionLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=64, num_layers=1, dropout=0.5, bidirectional=True):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True,
                            dropout=dropout if num_layers > 1 else 0, bidirectional=bidirectional)
        d = hidden_size * (2 if bidirectional else 1)
        self.attention = TemporalAttention(d)
        self.norm = nn.LayerNorm(d)
        self.dropout = nn.Dropout(dropout)
        self.out = nn.Linear(d, 1)

    def forward(self, x):
        h, _ = self.lstm(x)
        h = self.attention(h)
        h = self.dropout(self.norm(h))
        return self.out(h).squeeze(-1)


# ── Main ──
def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # Load data
    X_train = np.load(WINDOWS_DIR / "X_train.npy")
    y_train = np.load(WINDOWS_DIR / "y_train.npy")
    X_val = np.load(WINDOWS_DIR / "X_val.npy")
    y_val = np.load(WINDOWS_DIR / "y_val.npy")
    print(f"Train: {X_train.shape}, Val: {X_val.shape}, Distraction rate: {y_train.mean():.3f}")

    train_loader = DataLoader(TensorDataset(torch.FloatTensor(X_train), torch.FloatTensor(y_train)),
                              batch_size=256, shuffle=True)
    val_loader = DataLoader(TensorDataset(torch.FloatTensor(X_val), torch.FloatTensor(y_val)),
                            batch_size=256)

    # Build model
    model = DistractionLSTM(input_size=X_train.shape[2]).to(device)
    print(f"Parameters: {sum(p.numel() for p in model.parameters()):,}")

    # Class weight + loss + optimizer
    pos_weight = torch.tensor([(y_train == 0).sum() / y_train.sum()], device=device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-4, weight_decay=1e-3)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, factor=0.5, patience=5)

    # Train
    best_loss, patience = float("inf"), 0
    model_path = SAVE_DIR / "best_model.pt"
    t0 = time.time()

    for epoch in range(1, 101):
        # Train
        model.train()
        t_loss, t_correct, t_total = 0, 0, 0
        for X, y in train_loader:
            X, y = X.to(device), y.to(device)
            optimizer.zero_grad()
            logits = model(X)
            loss = criterion(logits, y)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            t_loss += loss.item() * len(y)
            t_correct += ((torch.sigmoid(logits) >= 0.5).float() == y).sum().item()
            t_total += len(y)

        # Validate
        model.eval()
        v_loss, v_correct, v_total = 0, 0, 0
        with torch.no_grad():
            for X, y in val_loader:
                X, y = X.to(device), y.to(device)
                logits = model(X)
                loss = criterion(logits, y)
                v_loss += loss.item() * len(y)
                v_correct += ((torch.sigmoid(logits) >= 0.5).float() == y).sum().item()
                v_total += len(y)

        t_loss, t_acc = t_loss / t_total, t_correct / t_total
        v_loss, v_acc = v_loss / v_total, v_correct / v_total
        scheduler.step(v_loss)

        tag = ""
        if v_loss < best_loss:
            best_loss = v_loss
            patience = 0
            tag = " * saved"
            torch.save({"epoch": epoch, "model_state_dict": model.state_dict(),
                        "val_loss": v_loss, "config": {"input_size": X_train.shape[2],
                        "hidden_size": 64, "num_layers": 1, "dropout": 0.5,
                        "bidirectional": True}}, model_path)
        else:
            patience += 1

        print(f"Epoch {epoch:3d} | Train {t_loss:.4f}/{t_acc:.4f} | Val {v_loss:.4f}/{v_acc:.4f} | "
              f"LR {optimizer.param_groups[0]['lr']:.1e}{tag}")

        if patience >= 15:
            print(f"\nEarly stopping at epoch {epoch}")
            break

    print(f"\nDone in {time.time()-t0:.1f}s | Best val loss: {best_loss:.6f}")
    print(f"Model saved: {model_path}")


if __name__ == "__main__":
    main()
