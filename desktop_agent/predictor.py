"""
SDPPS – Predictor (v3.4)
==========================
Changes from v3.3:
  - Removed duplicate DistractionLSTM / TemporalAttention class definitions.
    Now imports the single canonical class from distraction_prediction.models.lstm_model
    to guarantee training/inference architecture parity.
  - forward_with_attention is now a proper method on DistractionLSTM (in lstm_model.py).
  - config.py BASE_DIR is now portable (no hardcoded E:\\ path).
  - bilstm_recency key is consistent across predictor and api_server.
"""

from __future__ import annotations

import json
import sys
import numpy as np
import torch
from pathlib import Path
from datetime import datetime

# ── Ensure project root is on sys.path so the shared model import works ──
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from distraction_prediction.models.lstm_model import DistractionLSTM          # ← single source of truth
from desktop_agent.config import MODEL_PATH, SCALER_PATH, FEATURE_COLUMNS_PATH, BLEND_MODE
from desktop_agent.app_categorizer import categorize_app


class Predictor:
    RECENCY_DECAY = 0.7
    RECENCY_BLEND = 0.50   # 50% recency probe + 50% full-window

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
        cfg  = ckpt.get("config", {})

        # Guarantee head_name key exists (older checkpoints may omit it)
        cfg.setdefault("head_name", "out")

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
        print(
            f"[Predictor] Recency weights (oldest→newest): "
            f"{[f'{w:.3f}' for w in self._recency_weights]}"
        )
        print(
            f"[Predictor] Recency blend: {self.RECENCY_BLEND:.0%} recency + "
            f"{1 - self.RECENCY_BLEND:.0%} full-window"
        )

        # ── State ────────────────────────────────────────────────
        self.window     = []
        self.history    = []
        self._validated = False
        self._app_streak = []   # tracks recent app categories for streak logic

    # ──────────────────────────────────────────────────────────────
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
        """Run the model on a padded 3-snapshot mini-window to emphasise
        the most recent behaviour.  The padding (7 copies of the latest
        snapshot) is an intentional approximation — the model still
        receives a valid (10, 24) input."""
        window_np = x_tensor.squeeze(0).cpu().numpy()   # (10, 24)

        mini_size = 3
        recent  = window_np[-mini_size:]
        latest  = window_np[-1:]
        padding = np.repeat(latest, self.window_size - mini_size, axis=0)
        mini_window = np.concatenate([padding, recent], axis=0)          # (10, 24)

        mini_tensor = (
            torch.tensor(mini_window, dtype=torch.float32)
            .unsqueeze(0)
            .to(self.device)
        )

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

        count = 0
        for cat in reversed(self._app_streak):
            if cat == category:
                count += 1
            else:
                break
        return count

    # ──────────────────────────────────────────────────────────────
    #  Main predict entry point
    # ──────────────────────────────────────────────────────────────
    def predict(self, snapshot: dict) -> dict:
        ts = snapshot.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

        vec = self._snapshot_to_vector(snapshot)
        self.window.append(vec)
        if len(self.window) > self.window_size:
            self.window = self.window[-self.window_size:]

        if len(self.window) < self.window_size:
            return {
                "timestamp":    ts,
                "status":       "filling",
                "window_count": len(self.window),
                "needed":       self.window_size - len(self.window),
            }

        # ── Full-window BiLSTM inference ─────────────────────────
        x        = np.array(self.window, dtype=np.float32)
        x_tensor = torch.tensor(x).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits, attn_weights = self.model.forward_with_attention(x_tensor)
            full_window_prob = torch.sigmoid(logits).item()
            attn = attn_weights.cpu().numpy().flatten().tolist()

        # ── Recency-weighted prediction ──────────────────────────
        recency_prob = self._recency_prediction(x_tensor)

        bilstm_prob = (
            (1 - self.RECENCY_BLEND) * full_window_prob +
            self.RECENCY_BLEND       * recency_prob
        )

        # ── App categorizer score ────────────────────────────────
        current_app   = snapshot.get("current_app",   "unknown")
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

        # ── Adaptive Blending ────────────────────────────────────
        if self.blend_mode == "pure":
            final_prob = bilstm_prob

        elif self.blend_mode == "light":
            final_prob = 0.80 * bilstm_prob + 0.20 * app_cat_score

        elif self.blend_mode == "adaptive":
            if app_cat_score >= 0.75:
                w_model, w_app = 0.40, 0.60
            elif app_cat_score <= 0.15:
                w_model, w_app = 0.55, 0.45
            else:
                w_model, w_app = 0.70, 0.30

            final_prob = w_model * bilstm_prob + w_app * app_cat_score

            # Streak override — 3+ consecutive productive pulls score down
            if streak_count >= 3 and app_cat_score <= 0.15:
                streak_bonus = min(streak_count - 2, 5) * 0.05   # max 0.25
                final_prob   = max(final_prob - streak_bonus, 0.05)

            # Streak override — 3+ consecutive entertainment pushes score up
            elif streak_count >= 3 and app_cat_score >= 0.70:
                streak_penalty = min(streak_count - 2, 5) * 0.05
                final_prob     = min(final_prob + streak_penalty, 0.98)

        else:
            final_prob = bilstm_prob

        final_prob = float(np.clip(final_prob, 0.0, 1.0))

        # ── Label ────────────────────────────────────────────────
        label      = "DISTRACTED" if final_prob >= 0.5 else "FOCUSED"
        confidence = final_prob if label == "DISTRACTED" else (1.0 - final_prob)

        # ── Result dict ──────────────────────────────────────────
        result = {
            "timestamp":      ts,
            "bilstm_prob":    round(bilstm_prob,        4),
            "bilstm_full":    round(full_window_prob,   4),
            "bilstm_recency": round(recency_prob,       4),   # ← consistent key name
            "app_cat_score":  round(app_cat_score,      4),
            "app_cat_label":  app_cat_label,
            "blend_mode":     self.blend_mode,
            "final_prob":     round(final_prob,         4),
            "label":          label,
            "confidence":     round(confidence,         4),
            "dominant_app":   current_app,
            "streak_count":   streak_count,
            "attention":      [round(a, 4) for a in attn],
            "raw_features":   {
                c: round(float(snapshot.get(c, 0)), 4)
                for c in self.feature_cols
            },
        }

        self.history.append(result)
        return result
