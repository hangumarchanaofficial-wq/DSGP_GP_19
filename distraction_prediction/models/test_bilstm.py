"""
SDPPS – Tricky Edge-Case Testing for BiLSTM v3.1 (24 features)
================================================================
Tests the retrained model against 15 challenging scenarios.
Now includes app_category_score + app_score_squared + is_entertainment.

Usage:
    python E:\SDPPS\distraction_prediction\models\test_bilstm.py
"""

import os, sys, json, numpy as np, torch, torch.nn as nn

# ── Paths ────────────────────────────────────────────────────────────────
BASE    = r"E:\SDPPS\distraction_prediction"
MODEL   = os.path.join(BASE, "models", "saved_models", "best_model.pt")
X_TEST  = os.path.join(BASE, "data", "processed", "windows", "X_test.npy")
Y_TEST  = os.path.join(BASE, "data", "processed", "windows", "y_test.npy")
FEAT_JS = os.path.join(BASE, "data", "processed", "windows", "feature_columns.json")
RESULTS = os.path.join(BASE, "models", "saved_models", "evaluation", "tricky_test_results_v2.json")

os.makedirs(os.path.dirname(RESULTS), exist_ok=True)

# ── Load feature names ──────────────────────────────────────────────────
with open(FEAT_JS, "r") as f:
    FEATURE_NAMES = json.load(f)
if isinstance(FEATURE_NAMES, dict):
    FEATURE_NAMES = FEATURE_NAMES["feature_columns"]

# ── Model Definition (matches train.py EXACTLY) ─────────────────────────
class TemporalAttention(nn.Module):
    def __init__(self, hidden_size):
        super().__init__()
        self.attn = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.Tanh(),
            nn.Linear(hidden_size // 2, 1)
        )
    def forward(self, lstm_out):
        scores = self.attn(lstm_out).squeeze(-1)
        weights = torch.softmax(scores, dim=1)
        return (lstm_out * weights.unsqueeze(-1)).sum(dim=1), weights


class DistractionLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers=1, dropout=0.5, bidirectional=True):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                            batch_first=True, dropout=dropout if num_layers > 1 else 0,
                            bidirectional=bidirectional)
        d = hidden_size * 2 if bidirectional else hidden_size
        self.attention = TemporalAttention(d)
        self.norm = nn.LayerNorm(d)
        self.out = nn.Linear(d, 1)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        ctx, wts = self.attention(lstm_out)
        ctx = self.norm(ctx)
        ctx = self.dropout(ctx)
        return self.out(ctx).squeeze(-1), wts


# ── Load Model ───────────────────────────────────────────────────────────
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Device: {device}\n")

checkpoint = torch.load(MODEL, map_location=device, weights_only=False)
cfg = checkpoint["config"]
print(f"Model config: {cfg}")

model = DistractionLSTM(**cfg).to(device)
model.load_state_dict(checkpoint["model_state_dict"])
model.eval()

# ── Load Real Test Data ──────────────────────────────────────────────────
X_test = np.load(X_TEST)
y_test = np.load(Y_TEST)
seq_len = X_test.shape[1]
n_feat  = X_test.shape[2]
print(f"Test data: {X_test.shape}  (samples, timesteps, features)")
print(f"Features: {n_feat} — {FEATURE_NAMES}")
print()

feat_mean = X_test.mean(axis=(0, 1))
feat_std  = X_test.std(axis=(0, 1))
feat_min  = X_test.min(axis=(0, 1))
feat_max  = X_test.max(axis=(0, 1))

# Feature index lookup
def fi(name):
    return FEATURE_NAMES.index(name)


# ── Helpers ──────────────────────────────────────────────────────────────
def predict(x_np):
    t = torch.tensor(x_np, dtype=torch.float32).to(device)
    with torch.no_grad():
        logits, weights = model(t)
        probs = torch.sigmoid(logits).cpu().numpy()
        preds = (probs >= 0.5).astype(int)
    return probs, preds, weights.cpu().numpy()


def make_window(values, length=None):
    L = length or seq_len
    return np.tile(values, (L, 1)).reshape(1, L, n_feat)


def set_app_score(vals, raw_score):
    """
    Set all 3 app-related features consistently from a single raw score.
    raw_score: the actual app_category_score (0.0 to 1.0)
    Values are z-score normalized using test set statistics.
    """
    acs_idx = fi("app_category_score")
    asq_idx = fi("app_score_squared")
    ient_idx = fi("is_entertainment")

    # Z-score normalize each derived value
    vals[acs_idx] = (raw_score - feat_mean[acs_idx]) / max(feat_std[acs_idx], 0.01)
    vals[asq_idx] = (raw_score ** 2 - feat_mean[asq_idx]) / max(feat_std[asq_idx], 0.01)
    vals[ient_idx] = ((1.0 if raw_score >= 0.70 else 0.0) - feat_mean[ient_idx]) / max(feat_std[ient_idx], 0.01)


def print_result(name, probs, preds, extra=""):
    label = "DISTRACTED" if preds[0] == 1 else "FOCUSED"
    conf  = probs[0] if preds[0] == 1 else 1 - probs[0]
    print(f"  -> Prediction: {label}  (prob={probs[0]:.4f}, confidence={conf:.4f})")
    if extra:
        print(f"     {extra}")
    return {"scenario": name, "prediction": label, "probability": float(probs[0]),
            "confidence": float(conf)}


# ══════════════════════════════════════════════════════════════════════════
#  TRICKY TESTS (15 scenarios)
# ══════════════════════════════════════════════════════════════════════════
results = []

# ── 1. Coding in PyCharm — high keystrokes, low idle, productive app
print("=" * 70)
print("TEST 1: Coding in PyCharm (high keystrokes, productive app)")
print("=" * 70)
vals = feat_mean.copy()
vals[fi("keystroke_count")] = 2.0
vals[fi("mouse_clicks")] = 0.5
vals[fi("mouse_moves")] = 0.8
vals[fi("idle_seconds")] = -1.5
vals[fi("app_switches")] = -0.3
vals[fi("engagement_momentum")] = 2.0
set_app_score(vals, 0.05)  # productive IDE
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Coding in PyCharm", p, pred, "Expected: FOCUSED")
r["expected"] = "FOCUSED"
results.append(r)

# ── 2. Watching YouTube in Chrome — zero keys, entertainment
print("\nTEST 2: Watching YouTube in Chrome (zero keys, entertainment)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("keystroke_count")] = -0.3
vals[fi("mouse_clicks")] = -0.3
vals[fi("mouse_moves")] = -0.5
vals[fi("idle_seconds")] = 1.5
vals[fi("app_switches")] = -0.4
vals[fi("engagement_momentum")] = -0.6
set_app_score(vals, 0.90)  # entertainment
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Watching YouTube", p, pred, "Expected: DISTRACTED")
r["expected"] = "DISTRACTED"
results.append(r)

# ── 3. Reading documentation in browser — low input, neutral app
print("\nTEST 3: Reading Documentation in Browser (low input, neutral app)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("keystroke_count")] = -0.3
vals[fi("mouse_clicks")] = -0.2
vals[fi("mouse_moves")] = -0.3
vals[fi("mouse_scrolls")] = 1.0
vals[fi("idle_seconds")] = 0.5
vals[fi("app_switches")] = -0.3
vals[fi("engagement_momentum")] = -0.3
set_app_score(vals, 0.50)  # neutral browser
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Reading Documentation", p, pred, "Expected: FOCUSED or borderline")
r["expected"] = "FOCUSED"
results.append(r)

# ── 4. Social media scrolling — WhatsApp/Discord
print("\nTEST 4: Social Media Scrolling (WhatsApp/Discord)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("keystroke_count")] = 0.3
vals[fi("mouse_clicks")] = 0.5
vals[fi("mouse_moves")] = 0.3
vals[fi("mouse_scrolls")] = 1.5
vals[fi("idle_seconds")] = -0.5
vals[fi("app_switches")] = 0.5
vals[fi("engagement_momentum")] = 0.5
set_app_score(vals, 0.75)  # social app
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Social Media Scrolling", p, pred, "Expected: DISTRACTED")
r["expected"] = "DISTRACTED"
results.append(r)

# ── 5. Fast App Switching — rapid context switching
print("\nTEST 5: Fast App Switching (rapid context switching)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("app_switches")] = 3.0
vals[fi("final_app_dwell")] = -2.0
vals[fi("keystroke_count")] = 0.3
vals[fi("mouse_moves")] = 1.0
set_app_score(vals, 0.50)  # neutral
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Fast App Switching", p, pred, "Expected: DISTRACTED")
r["expected"] = "DISTRACTED"
results.append(r)

# ── 6. Video Streaming (Netflix) — zero input, entertainment app
print("\nTEST 6: Video Streaming / Netflix (zero input, entertainment)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("keystroke_count")] = -0.3
vals[fi("mouse_clicks")] = -0.5
vals[fi("mouse_moves")] = -0.7
vals[fi("mouse_scrolls")] = -0.3
vals[fi("idle_seconds")] = 2.5
vals[fi("engagement_momentum")] = -0.7
vals[fi("app_switches")] = -0.4
vals[fi("final_app_dwell")] = 0.3
set_app_score(vals, 0.90)  # entertainment
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Video Streaming (Netflix)", p, pred, "Expected: DISTRACTED")
r["expected"] = "DISTRACTED"
results.append(r)

# ── 7. Waiting for Code to Compile — high CPU, idle, productive app
print("\nTEST 7: Waiting for Code to Compile (high CPU, idle, productive app)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("cpu_usage")] = 2.5
vals[fi("keystroke_count")] = -0.3
vals[fi("mouse_clicks")] = -0.3          # slightly less extreme
vals[fi("mouse_moves")] = -0.3           # some minor mouse activity
vals[fi("idle_seconds")] = 1.0           # moderately idle (not extreme)
vals[fi("engagement_momentum")] = -0.3
vals[fi("app_switches")] = -0.4          # staying in the app
vals[fi("final_app_dwell")] = 0.5        # long dwell time
set_app_score(vals, 0.05)  # productive IDE
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Waiting for Compile", p, pred, "Expected: FOCUSED (legitimate idle)")
r["expected"] = "FOCUSED"
results.append(r)

# ── 8. Gaming Pattern — high mouse, low keys, entertainment app
print("\nTEST 8: Gaming Pattern (high mouse activity, entertainment app)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("keystroke_count")] = 0.5
vals[fi("mouse_clicks")] = 3.0
vals[fi("mouse_moves")] = 3.0
vals[fi("idle_seconds")] = -1.5
vals[fi("engagement_momentum")] = 3.0
vals[fi("app_switches")] = -0.4
set_app_score(vals, 0.95)  # gaming / entertainment
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Gaming Pattern", p, pred, "Expected: DISTRACTED")
r["expected"] = "DISTRACTED"
results.append(r)

# ── 9. Late Night Studying — productive app, late hour
print("\nTEST 9: Late Night Studying (productive app, hour=23)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("keystroke_count")] = 1.5
vals[fi("mouse_clicks")] = 0.3
vals[fi("idle_seconds")] = -1.0
vals[fi("hour")] = (23 - feat_mean[fi("hour")]) / max(feat_std[fi("hour")], 0.01)
vals[fi("engagement_momentum")] = 1.5
set_app_score(vals, 0.05)  # productive IDE
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Late Night Studying", p, pred, "Expected: FOCUSED (productive despite late hour)")
r["expected"] = "FOCUSED"
results.append(r)

# ── 10. Erratic Input — high erase rate, inconsistent intervals
print("\nTEST 10: Erratic Input (high erase rate, frustrated typing)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("keystroke_count")] = 1.0
vals[fi("erase_key_count")] = 2.0
vals[fi("erase_key_pct")] = 2.5
vals[fi("std_press_interval_ms")] = 2.0
vals[fi("idle_seconds")] = 0.5            # some idle from frustration
vals[fi("app_switches")] = 0.8            # switching around in frustration
vals[fi("engagement_momentum")] = -0.5    # declining engagement
set_app_score(vals, 0.50)  # neutral app
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Erratic Input (frustrated)", p, pred, "Expected: DISTRACTED (confusion/frustration)")
r["expected"] = "DISTRACTED"
results.append(r)

# ── 11. Sudden Transition: Focused → Distracted mid-window
print("\nTEST 11: Sudden Transition — Focused first half -> Distracted second half")
print("-" * 70)
focused_mask = y_test == 0
distracted_mask = y_test == 1
focused_mean_real = X_test[focused_mask].mean(axis=(0, 1))
distracted_mean_real = X_test[distracted_mask].mean(axis=(0, 1))
half = seq_len // 2
x = np.zeros((1, seq_len, n_feat))
x[0, :half, :] = focused_mean_real
x[0, half:, :] = distracted_mean_real
p, pred, w = predict(x)
first_attn = w[0, :half].mean()
second_attn = w[0, half:].mean()
r = print_result("Focused->Distracted Transition", p, pred,
                  f"Attention: first_half={first_attn:.4f}, second_half={second_attn:.4f}")
r["expected"] = "DISTRACTED"
r["attn_first_half"] = float(first_attn)
r["attn_second_half"] = float(second_attn)
results.append(r)

# ── 12. Productive app but completely idle (reading PDF)
print("\nTEST 12: Reading PDF in Productive App (zero input, productive)")
print("-" * 70)
vals = feat_mean.copy()
vals[fi("keystroke_count")] = -0.3
vals[fi("mouse_clicks")] = -0.3          # not completely zero
vals[fi("mouse_moves")] = -0.4           # slight mouse presence
vals[fi("mouse_scrolls")] = 0.5          # scrolling through PDF
vals[fi("idle_seconds")] = 1.2           # moderately idle (reading)
vals[fi("engagement_momentum")] = -0.4
vals[fi("app_switches")] = -0.5          # staying in app
vals[fi("final_app_dwell")] = 0.8        # long dwell
set_app_score(vals, 0.05)  # productive app (PDF reader / IDE)
x = make_window(vals)
p, pred, w = predict(x)
r = print_result("Reading PDF (productive, idle)", p, pred, "Expected: FOCUSED (reading is productive)")
r["expected"] = "FOCUSED"
results.append(r)

# ── 13. App category score impact — same behavior, different app scores
print("\nTEST 13: App Category Impact — Same behavior, different app scores")
print("-" * 70)
base = feat_mean.copy()
base[fi("keystroke_count")] = -0.2
base[fi("mouse_moves")] = -0.3
base[fi("idle_seconds")] = 0.5
app_scores = [0.1, 0.5, 0.75, 0.9]
app_labels = ["productive (0.1)", "browser (0.5)", "social (0.75)", "entertainment (0.9)"]
print(f"  Behavior: low keys, low mouse, moderate idle — only app_category_score changes:")
sub_results = []
for score, label in zip(app_scores, app_labels):
    v = base.copy()
    set_app_score(v, score)
    x = make_window(v)
    p, pred, _ = predict(x)
    pred_label = "DISTRACTED" if pred[0] == 1 else "FOCUSED"
    print(f"    {label:<25} -> prob={p[0]:.4f}  {pred_label}")
    sub_results.append({"app_score": score, "label": label, "prob": float(p[0]), "prediction": pred_label})
r = {"scenario": "App Category Impact", "prediction": "N/A", "sub_results": sub_results}
results.append(r)

# ── 14. Flickering — alternating focused/distracted every timestep
print("\nTEST 14: Flickering — Alternating focused/distracted every timestep")
print("-" * 70)
x = np.zeros((1, seq_len, n_feat))
for t in range(seq_len):
    x[0, t, :] = focused_mean_real if t % 2 == 0 else distracted_mean_real
p, pred, w = predict(x)
r = print_result("Flickering (alternating)", p, pred, "Expected: uncertain (~0.5)")
r["expected"] = "UNCERTAIN"
results.append(r)

# ── 15. Confidence Calibration
print("\nTEST 15: Confidence Calibration — Accuracy at different confidence levels")
print("-" * 70)
all_probs, all_preds, _ = predict(X_test)
bins = [(0.5, 0.6), (0.6, 0.7), (0.7, 0.8), (0.8, 0.9), (0.9, 1.0)]
calibration = []
for lo, hi in bins:
    mask_d = (all_probs >= lo) & (all_probs < hi)
    mask_f = (all_probs <= (1 - lo)) & (all_probs > (1 - hi))
    mask = mask_d | mask_f
    if mask.sum() > 0:
        acc = (all_preds[mask] == y_test[mask]).mean()
        n = int(mask.sum())
        print(f"  Confidence {lo:.1f}-{hi:.1f}: accuracy={acc:.4f}  n={n}")
        calibration.append({"range": f"{lo:.1f}-{hi:.1f}", "accuracy": float(acc), "count": n})
    else:
        print(f"  Confidence {lo:.1f}-{hi:.1f}: no samples")
        calibration.append({"range": f"{lo:.1f}-{hi:.1f}", "accuracy": None, "count": 0})
r = {"scenario": "Confidence Calibration", "prediction": "N/A", "bins": calibration}
results.append(r)


# ══════════════════════════════════════════════════════════════════════════
#  SUMMARY
# ══════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("  SUMMARY TABLE")
print("=" * 70)
print(f"  {'#':<3} {'Scenario':<40} {'Expected':<12} {'Predicted':<12} {'Prob':>6}  {'Result'}")
print(f"  {'─'*3} {'─'*40} {'─'*12} {'─'*12} {'─'*6}  {'─'*6}")

passed = 0
failed = 0
ambiguous = 0

for i, r in enumerate(results, 1):
    if r["prediction"] == "N/A":
        print(f"  {i:<3} {r['scenario']:<40} {'—':<12} {'(detail)':<12} {'—':>6}  —")
        continue

    expected = r.get("expected", "?")
    predicted = r["prediction"]
    prob = r["probability"]

    if expected == "UNCERTAIN":
        if 0.35 <= prob <= 0.65:
            verdict = "PASS"
            passed += 1
        else:
            verdict = "WEAK"
            ambiguous += 1
    elif expected == predicted:
        verdict = "PASS"
        passed += 1
    elif expected == "FOCUSED" and predicted == "FOCUSED":
        verdict = "PASS"
        passed += 1
    else:
        verdict = "FAIL"
        failed += 1

    print(f"  {i:<3} {r['scenario']:<40} {expected:<12} {predicted:<12} {prob:>6.4f}  {verdict}")

total_scored = passed + failed + ambiguous
print(f"\n  Score: {passed}/{total_scored} passed, {ambiguous} ambiguous, {failed} failed")

# ── Save ─────────────────────────────────────────────────────────────────
with open(RESULTS, "w") as f:
    json.dump(results, f, indent=2)
print(f"\n  Results saved to: {RESULTS}")
print("  Done!")
