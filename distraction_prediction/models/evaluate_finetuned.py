# evaluate_finetuned.py — Evaluate fine-tuned BiLSTM (matches best_model_finetuned.pt)
import os, json, numpy as np, torch, torch.nn as nn
from sklearn.metrics import (accuracy_score, f1_score, roc_auc_score,
                             average_precision_score, confusion_matrix,
                             classification_report)

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
BASE_DIR    = os.path.dirname(SCRIPT_DIR)
WINDOWS_DIR = os.path.join(BASE_DIR, "data", "processed", "windows")
MODEL_PATH  = os.path.join(SCRIPT_DIR, "saved_models", "best_model_finetuned.pt")
OUTPUT_DIR  = os.path.join(SCRIPT_DIR, "saved_models", "evaluation")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ── Model (matches best_model_finetuned.pt state_dict) ──────────────
class TemporalAttention(nn.Module):
    def __init__(self, hidden_size):
        super().__init__()
        self.attn = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Linear(hidden_size // 2, 1)
        )
    def forward(self, lstm_out):
        scores = self.attn(lstm_out).squeeze(-1)
        weights = torch.softmax(scores, dim=1)
        return (lstm_out * weights.unsqueeze(-1)).sum(dim=1), weights

class DistractionLSTM(nn.Module):
    def __init__(self, input_size, hidden_size=128, num_layers=1,
                 dropout=0.6, bidirectional=True):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                            batch_first=True,
                            dropout=dropout if num_layers > 1 else 0,
                            bidirectional=bidirectional)
        d = hidden_size * (2 if bidirectional else 1)
        self.attention = TemporalAttention(d)
        self.norm = nn.LayerNorm(d)
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(d, 1)   # named "classifier" in checkpoint

    def forward(self, x):
        out, _ = self.lstm(x)
        ctx, _ = self.attention(out)
        ctx = self.norm(ctx)
        ctx = self.dropout(ctx)
        return self.classifier(ctx)

# ── Main ─────────────────────────────────────────────────────────────
def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    X_test = np.load(os.path.join(WINDOWS_DIR, "X_test.npy"))
    y_test = np.load(os.path.join(WINDOWS_DIR, "y_test.npy"))
    print(f"Test samples: {len(y_test)}")

    checkpoint = torch.load(MODEL_PATH, map_location=device, weights_only=False)
    cfg = checkpoint["config"]
    model = DistractionLSTM(
        input_size=cfg["input_size"],
        hidden_size=cfg["hidden_size"],
        num_layers=cfg["num_layers"],
        dropout=cfg["dropout"],
        bidirectional=cfg.get("bidirectional", True)
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()
    print(f"Model loaded — h={cfg['hidden_size']}, layers={cfg['num_layers']}, "
          f"dropout={cfg['dropout']}")

    X_tensor = torch.FloatTensor(X_test).to(device)
    with torch.no_grad():
        logits = model(X_tensor).squeeze()
        probs = torch.sigmoid(logits).cpu().numpy()

    y_pred = (probs >= 0.5).astype(int)
    acc = accuracy_score(y_test, y_pred)
    f1  = f1_score(y_test, y_pred)
    auc = roc_auc_score(y_test, probs)
    ap  = average_precision_score(y_test, probs)
    cm  = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel()

    print("\n" + "=" * 60)
    print("  Fine-tuned BiLSTM — Test Results")
    print("=" * 60)
    print(f"  Accuracy         : {acc:.4f}")
    print(f"  F1 Score         : {f1:.4f}")
    print(f"  ROC-AUC          : {auc:.4f}")
    print(f"  Avg Precision    : {ap:.4f}")
    print(f"  TP={tp}  TN={tn}  FP={fp}  FN={fn}")
    print("=" * 60)
    print(classification_report(y_test, y_pred,
                                target_names=["Focused", "Distracted"]))

    results = {"accuracy": round(acc, 4), "f1": round(f1, 4),
               "auc": round(auc, 4), "avg_precision": round(ap, 4),
               "confusion_matrix": {"tn": int(tn), "fp": int(fp),
                                    "fn": int(fn), "tp": int(tp)}}
    json_path = os.path.join(OUTPUT_DIR, "finetuned_bilstm_results.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Results saved to {json_path}")

    # ── Plots ────────────────────────────────────────────────────────
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from sklearn.metrics import roc_curve, precision_recall_curve

        fig, ax = plt.subplots(figsize=(6, 5))
        im = ax.imshow(cm, cmap="Blues")
        ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
        ax.set_xticklabels(["Focused", "Distracted"])
        ax.set_yticklabels(["Focused", "Distracted"])
        ax.set_xlabel("Predicted"); ax.set_ylabel("Actual")
        ax.set_title("Fine-tuned BiLSTM — Confusion Matrix")
        for i in range(2):
            for j in range(2):
                ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                        color="white" if cm[i, j] > cm.max()/2 else "black",
                        fontsize=16)
        fig.colorbar(im); fig.tight_layout()
        fig.savefig(os.path.join(OUTPUT_DIR, "finetuned_confusion_matrix.png"), dpi=150)
        plt.close(fig)

        fpr, tpr, _ = roc_curve(y_test, probs)
        fig, ax = plt.subplots(figsize=(6, 5))
        ax.plot(fpr, tpr, label=f"AUC = {auc:.4f}")
        ax.plot([0, 1], [0, 1], "--", color="gray")
        ax.set_xlabel("FPR"); ax.set_ylabel("TPR")
        ax.set_title("Fine-tuned BiLSTM — ROC Curve"); ax.legend()
        fig.tight_layout()
        fig.savefig(os.path.join(OUTPUT_DIR, "finetuned_roc_curve.png"), dpi=150)
        plt.close(fig)

        prec, rec, _ = precision_recall_curve(y_test, probs)
        fig, ax = plt.subplots(figsize=(6, 5))
        ax.plot(rec, prec, label=f"AP = {ap:.4f}")
        ax.set_xlabel("Recall"); ax.set_ylabel("Precision")
        ax.set_title("Fine-tuned BiLSTM — PR Curve"); ax.legend()
        fig.tight_layout()
        fig.savefig(os.path.join(OUTPUT_DIR, "finetuned_pr_curve.png"), dpi=150)
        plt.close(fig)
        print(f"Plots saved to {OUTPUT_DIR}")
    except ImportError:
        print("matplotlib not installed — skipping plots")

    # ── Comparison table ─────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  Model Comparison (5-min Lookahead, Leakage-Free)")
    print("=" * 70)
    print(f"  {'Model':<25} {'Accuracy':<12} {'F1':<10} {'AUC':<10}")
    print("-" * 70)
    print(f"  {'Fine-tuned BiLSTM':<25} {acc:<12.4f} {f1:<10.4f} {auc:<10.4f}")

    baselines = {
        "BiLSTM (base)":  os.path.join(OUTPUT_DIR, "test_results.json"),
        "XGBoost":        os.path.join(SCRIPT_DIR, "saved_models", "baselines", "xgboost_results.json"),
        "Random Forest":  os.path.join(SCRIPT_DIR, "saved_models", "baselines", "random_forest_results.json"),
    }
    for name, path in baselines.items():
        if os.path.exists(path):
            with open(path) as f:
                r = json.load(f)
            print(f"  {name:<25} {r.get('accuracy', 0):<12.4f} "
                  f"{r.get('f1', 0):<10.4f} {r.get('auc', 0):<10.4f}")
    print("=" * 70)

if __name__ == "__main__":
    main()
