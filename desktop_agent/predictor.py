"""
SDPPS – Predictor (v3.3)
==========================
Changes from v3.2:
  - Stronger adaptive blend for productive apps (0.55 model / 0.45 app)
  - Added consecutive-app tracking: 3+ productive snapshots forces score down
  - Recency blend increased to 50% for faster transitions
"""

import json
import time
import numpy as np
import torch
import torch.nn as nn
from pathlib import Path
from datetime import datetime

from desktop_agent.config import MODEL_PATH, SCALER_PATH, FEATURE_COLUMNS_PATH, BLEND_MODE
from desktop_agent.app_categorizer import categorize_app


# ═══════════════════════════════════════════════════════════════════
#  Model architecture  (must mirror train.py exactly)
# ═══════════════════════════════════════════════════════════════════

class TemporalAttention(nn.Module):
    def __init__(self, hidden_size):
        super().__init__()
        self.attn = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.Tanh(),
            nn.Linear(hidden_size // 2, 1),
        )

    def forward(self, lstm_out):
        scores = self.attn(lstm_out)
        weights = torch.softmax(scores, dim=1)
        context = (lstm_out * weights).sum(dim=1)
        return context, weights.squeeze(-1)


class DistractionLSTM(nn.Module):
    def __init__(self, input_size=24, hidden_size=64, num_layers=1,
                 dropout=0.5, bidirectional=True):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional,
        )
        d = 2 if bidirectional else 1
        total_hidden = hidden_size * d

        self.attention = TemporalAttention(total_hidden)
        self.norm = nn.LayerNorm(total_hidden)
        self.out = nn.Linear(total_hidden, 1)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        context, _ = self.attention(lstm_out)
        context = self.norm(context)
        context = self.dropout(context)
        return self.out(context).squeeze(-1)

    def forward_with_attention(self, x):
        lstm_out, _ = self.lstm(x)
        context, weights = self.attention(lstm_out)
        context = self.norm(context)
        context = self.dropout(context)
        logits = self.out(context).squeeze(-1)
        return logits, weights




class Predictor:
    RECENCY_DECAY = 0.7
    RECENCY_BLEND = 0.50         

    def __init__(self):
        # ── Scaler ───────────────────────────────────────────────
        with open(SCALER_PATH, "r") as f:
            scaler = json.load(f)
        self.means = np.array(scaler["mean"], dtype=np.float32)
        self.stds  = np.array(scaler["std"],  dtype=np.float32)
        self.window_size = scaler.get("window_size", 10)
        print(f"[Predictor] Scaler loaded — features={len(self.means)}, window_size={self.window_size}")
        print(f"[Predictor] Means[:3]: {self.means[:3]}")
        print(f"[Predictor] Stds [:3]: {self.stds[:3]}")

        # ── Feature columns ──────────────────────────────────────
        with open(FEATURE_COLUMNS_PATH, "r") as f:
            self.feature_cols = json.load(f)
        if isinstance(self.feature_cols, dict):
            self.feature_cols = self.feature_cols["feature_columns"]
        print(f"[Predictor] Features ({len(self.feature_cols)}): {self.feature_cols}")

        assert len(self.feature_cols) == len(self.means), (
            f"Feature count mismatch: columns={len(self.feature_cols)}, "
            f"scaler={len(self.means)}"
        )

        # ── Model ────────────────────────────────────────────────
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        ckpt = torch.load(MODEL_PATH, map_location=self.device, weights_only=False)
        cfg = ckpt.get("config", {})
        print(f"[Predictor] Model on {self.device} | config: {cfg}")

        self.model = DistractionLSTM(**cfg).to(self.device)
        self.model.load_state_dict(ckpt["model_state_dict"])
        self.model.eval()

        # ── Blend mode ───────────────────────────────────────────
        self.blend_mode = BLEND_MODE
        mode_labels = {
            "pure":     "PURE BiLSTM (100% model)",
            "light":    "LIGHT BLEND (80/20 default)",
            "adaptive": "ADAPTIVE BLEND (app-aware weights)",
        }
        print(f"[Predictor] Mode: {mode_labels.get(self.blend_mode, self.blend_mode)}")

        # ── Precompute recency weights ───────────────────────────
        raw_weights = np.array(
            [self.RECENCY_DECAY ** (self.window_size - 1 - t)
             for t in range(self.window_size)],
            dtype=np.float32,
        )
        self._recency_weights = raw_weights / raw_weights.sum()
        print(f"[Predictor] Recency weights (oldest→newest): "
              f"{[f'{w:.3f}' for w in self._recency_weights]}")
        print(f"[Predictor] Recency blend: {self.RECENCY_BLEND:.0%} recency + "
              f"{1 - self.RECENCY_BLEND:.0%} full-window")

        # ── State ────────────────────────────────────────────────
        self.window = []
        self.history = []
        self._validated = False
        self._app_streak = []          # ← NEW: tracks recent app categories

    def ready(self) -> bool:
        return len(self.window) >= self.window_size

    def get_history(self) -> list:
        return list(self.history[-50:])

    # ──────────────────────────────────────────────────────────────
    #  Snapshot → normalised feature vector (24 features)
    # ──────────────────────────────────────────────────────────────

    def _snapshot_to_vector(self, snapshot: dict) -> np.ndarray:
        vec = np.array(
            [float(snapshot.get(c, 0.0)) for c in self.feature_cols],
            dtype=np.float32,
        )

        if not self._validated:
            missing = [c for c in self.feature_cols if c not in snapshot]
            if missing:
                print(f"[Predictor] WARNING missing keys: {missing}")
            else:
                print(f"[Predictor] All {len(self.feature_cols)} features present in snapshot.")
            self._validated = True

        safe_stds = np.where(self.stds == 0, 1.0, self.stds)
        vec = (vec - self.means) / safe_stds
        vec = np.clip(vec, -3.0, 3.0)
        return vec

    # ──────────────────────────────────────────────────────────────
    #  Recency-weighted mini-window prediction
    # ──────────────────────────────────────────────────────────────

    def _recency_prediction(self, x_tensor: torch.Tensor) -> float:
        window_np = x_tensor.squeeze(0).cpu().numpy()  # (10, 24)

        mini_size = 3
        recent = window_np[-mini_size:]
        latest = window_np[-1:]
        padding = np.repeat(latest, self.window_size - mini_size, axis=0)
        mini_window = np.concatenate([padding, recent], axis=0)

        mini_tensor = torch.tensor(mini_window, dtype=torch.float32).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits, _ = self.model.forward_with_attention(mini_tensor)
            prob = torch.sigmoid(logits).item()

        return prob

    # ──────────────────────────────────────────────────────────────
    #  App streak tracking
    # ──────────────────────────────────────────────────────────────

    def _update_app_streak(self, app_cat_score: float) -> int:
        """Track consecutive snapshots in the same app category.
        Returns count of consecutive productive (<=0.15) or
        entertainment (>=0.70) snapshots."""
        if app_cat_score <= 0.15:
            category = "productive"
        elif app_cat_score >= 0.70:
            category = "entertainment"
        else:
            category = "neutral"

        self._app_streak.append(category)
        if len(self._app_streak) > 10:
            self._app_streak = self._app_streak[-10:]

        # Count consecutive same-category from the end
        count = 0
        for cat in reversed(self._app_streak):
            if cat == category:
                count += 1
            else:
                break

        return count

    # ──────────────────────────────────────────────────────────────
    #  Predict
    # ──────────────────────────────────────────────────────────────

    def predict(self, snapshot: dict) -> dict:
        ts = snapshot.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        vec = self._snapshot_to_vector(snapshot)
        self.window.append(vec)
        if len(self.window) > self.window_size:
            self.window = self.window[-self.window_size:]

        if len(self.window) < self.window_size:
            return {
                "timestamp": ts,
                "status": "filling",
                "window_count": len(self.window),
                "needed": self.window_size - len(self.window),
            }

        # ── Full-window BiLSTM inference ─────────────────────────
        x = np.array(self.window, dtype=np.float32)
        x_tensor = torch.tensor(x).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits, attn_weights = self.model.forward_with_attention(x_tensor)
            full_window_prob = torch.sigmoid(logits).item()
            attn = attn_weights.cpu().numpy().flatten().tolist()

        # ── Recency-weighted prediction ──────────────────────────
        recency_prob = self._recency_prediction(x_tensor)

        bilstm_prob = (
            (1 - self.RECENCY_BLEND) * full_window_prob +
            self.RECENCY_BLEND * recency_prob
        )

        # ── App categorizer score ────────────────────────────────
        current_app = snapshot.get("current_app", "unknown")
        current_title = snapshot.get("current_title", "")
        app_cat_score = categorize_app(current_app, current_title)

        if app_cat_score >= 0.75:
            app_cat_label = "entertainment"
        elif app_cat_score >= 0.6:
            app_cat_label = "social"
        elif app_cat_score <= 0.15:
            app_cat_label = "productive"
        else:
            app_cat_label = "neutral"

        # ── App streak ───────────────────────────────────────────
        streak_count = self._update_app_streak(app_cat_score)

        # ── Adaptive Blending (v3.3 — stronger app context) ──────
        if self.blend_mode == "pure":
            final_prob = bilstm_prob

        elif self.blend_mode == "light":
            final_prob = 0.80 * bilstm_prob + 0.20 * app_cat_score

        elif self.blend_mode == "adaptive":
            if app_cat_score >= 0.75:
                # Entertainment: trust app category heavily
                w_model, w_app = 0.40, 0.60
            elif app_cat_score <= 0.15:
                # Productive: trust app category more than before
                w_model, w_app = 0.55, 0.45
            else:
                # Neutral: balanced
                w_model, w_app = 0.70, 0.30

            final_prob = w_model * bilstm_prob + w_app * app_cat_score

            # ── Streak override ──────────────────────────────────
            # If 3+ consecutive productive snapshots, pull score down further
            if streak_count >= 3 and app_cat_score <= 0.15:
                streak_bonus = min(streak_count - 2, 5) * 0.05  # 0.05 per extra snapshot, max 0.25
                final_prob = max(final_prob - streak_bonus, 0.05)

            # If 3+ consecutive entertainment snapshots, push score up
            elif streak_count >= 3 and app_cat_score >= 0.70:
                streak_penalty = min(streak_count - 2, 5) * 0.05
                final_prob = min(final_prob + streak_penalty, 0.98)

        else:
            final_prob = bilstm_prob

        final_prob = float(np.clip(final_prob, 0.0, 1.0))

        # ── Label ────────────────────────────────────────────────
        label = "DISTRACTED" if final_prob >= 0.5 else "FOCUSED"
        confidence = final_prob if label == "DISTRACTED" else (1.0 - final_prob)

        dominant_app = current_app

        # ── Result ───────────────────────────────────────────────
        result = {
            "timestamp":         ts,
            "bilstm_prob":       round(bilstm_prob, 4),
            "bilstm_full":       round(full_window_prob, 4),
            "bilstm_recency":    round(recency_prob, 4),
            "app_cat_score":     round(app_cat_score, 4),
            "app_cat_label":     app_cat_label,
            "blend_mode":        self.blend_mode,
            "final_prob":        round(final_prob, 4),
            "label":             label,
            "confidence":        round(confidence, 4),
            "dominant_app":      dominant_app,
            "streak_count":      streak_count,
            "attention":         [round(a, 4) for a in attn],
            "raw_features":      {c: round(float(snapshot.get(c, 0)), 4)
                                  for c in self.feature_cols},
        }

        self.history.append(result)
        return result
