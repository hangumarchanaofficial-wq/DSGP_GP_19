# label.py  (v3.1 — with productive-idle override)
# ═══════════════════════════════════════════════════════════════════
#  SDPPS — Improved Distraction Labeling
#  With LLM-based app awareness + productive-idle fix
# ═══════════════════════════════════════════════════════════════════
#
#  Changes from v3:
#    - Rule 2 threshold REVERTED to 0.55 (was 0.75 which broke gaming/erratic)
#    - NEW Rule 2b: productive app + high idle + low switching → FOCUSED
#      (fixes compile-wait and PDF-reading misclassifications)


import json
import numpy as np
import pandas as pd
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────
BASE_DIR = Path(r"E:\SDPPS")
PROCESSED_DIR = BASE_DIR / "distraction_prediction" / "data" / "processed"
WINDOWS_DIR = PROCESSED_DIR / "windows"
INTERIM_DIR = BASE_DIR / "distraction_prediction" / "data" / "interim"

INPUT_CSV = PROCESSED_DIR / "cleaned_data.csv"
OUTPUT_CSV = WINDOWS_DIR / "labeled_activity_log.csv"
THRESHOLD_JSON = WINDOWS_DIR / "label_thresholds.json"
LLM_SCORES_JSON = INTERIM_DIR / "app_distraction_scores.json"

# ── App column in the data ───────────────────────────────────────────────
APP_COL = "foreground_app_end"

# ── Fallback hardcoded scores (used ONLY if LLM scores file missing) ────
FALLBACK_SCORES = {
    "productive": 0.1,
    "browser": 0.5,
    "unknown": 0.5,
    "social": 0.75,
    "entertainment": 0.9,
}

PRODUCTIVE_APPS = {
    "pycharm64.exe", "pycharm.exe", "code.exe", "devenv.exe",
    "excel.exe", "winword.exe", "powerpnt.exe", "onenote.exe",
    "notepad++.exe", "notepad.exe", "sublime_text.exe",
    "android studio.exe", "idea64.exe", "eclipse.exe",
    "cmd.exe", "powershell.exe", "windowsterminal.exe",
    "jupyter-notebook.exe", "spyder.exe",
    "mspaint.exe", "gimp.exe", "photoshop.exe",
    "teams.exe", "zoom.exe", "slack.exe",
    "acrobat.exe", "acrord32.exe", "foxitreader.exe",
    "m365copilot.exe", "snippingtool.exe",
}

ENTERTAINMENT_APPS = {
    "spotify.exe", "vlc.exe", "wmplayer.exe", "kmplayer.exe",
    "steam.exe", "epicgameslauncher.exe",
    "minecraft.exe", "javaw.exe",
}

SOCIAL_APPS = {
    "whatsapp.exe", "whatsapp.root.exe", "discord.exe",
    "telegram.exe", "messenger.exe", "signal.exe",
}

BROWSER_APPS = {
    "chrome.exe", "brave.exe", "msedge.exe", "firefox.exe",
    "opera.exe", "vivaldi.exe",
}


# ═══════════════════════════════════════════════════════════════════
#  LLM Score Loader
# ═══════════════════════════════════════════════════════════════════

class AppScorer:
    """Loads LLM-generated app scores with fallback to hardcoded rules."""

    def __init__(self):
        self.llm_scores = {}
        self.using_llm = False

        if LLM_SCORES_JSON.exists():
            with open(LLM_SCORES_JSON, "r") as f:
                raw = json.load(f)
            # Normalize keys to lowercase
            self.llm_scores = {k.lower().strip(): float(v) for k, v in raw.items()}
            self.using_llm = True
            print(f"    Loaded LLM scores: {len(self.llm_scores)} apps from {LLM_SCORES_JSON.name}")
        else:
            print(f"    WARNING: LLM scores not found at {LLM_SCORES_JSON}")
            print(f"    Using hardcoded fallback categories.")
            print(f"    Run score_apps_llm.py first for better results.")

    def get_score(self, app_name: str) -> float:
        """Get distraction score for an app. 0.0 = productive, 1.0 = entertainment."""
        if not isinstance(app_name, str) or not app_name.strip():
            return 0.5

        name = app_name.strip().lower()

        # Try LLM scores first (exact match)
        if self.using_llm:
            if name in self.llm_scores:
                return self.llm_scores[name]
            # Try without .exe
            name_no_ext = name.replace(".exe", "")
            for key, val in self.llm_scores.items():
                if key.replace(".exe", "") == name_no_ext:
                    return val

        # Fallback to hardcoded categories
        if name in PRODUCTIVE_APPS:
            return 0.1
        if name in ENTERTAINMENT_APPS:
            return 0.9
        if name in SOCIAL_APPS:
            return 0.75
        if name in BROWSER_APPS:
            return 0.5
        return 0.5

    def get_category(self, score: float) -> str:
        """Convert numeric score to category label."""
        if score <= 0.15:
            return "productive"
        elif score <= 0.35:
            return "mostly-productive"
        elif score <= 0.55:
            return "neutral"
        elif score <= 0.75:
            return "social"
        else:
            return "entertainment"

    def get_threshold_modifier(self, score: float) -> float:
        """
        Return the distraction threshold based on app score.
        Lower threshold = easier to label as distracted.
        Higher threshold = harder to label as distracted.
        """
        if score <= 0.15:
            return 0.60   # Productive: need strong behavioral evidence
        elif score <= 0.35:
            return 0.55   # Mostly productive: slightly easier
        elif score <= 0.55:
            return 0.45   # Neutral: standard threshold
        elif score <= 0.75:
            return 0.35   # Social: easier to flag
        else:
            return 0.25   # Entertainment: very easy to flag


# ═══════════════════════════════════════════════════════════════════
#  Thresholds
# ═══════════════════════════════════════════════════════════════════

def compute_thresholds(df: pd.DataFrame) -> dict:
    """Compute percentile-based thresholds from training portion (first 80%)."""
    thresholds_list = []

    for uid in df["user_id"].unique():
        user_df = df[df["user_id"] == uid].sort_values("timestamp")
        cutoff = int(len(user_df) * 0.8)
        train_part = user_df.iloc[:cutoff]

        t = {}
        t["A_app_switches_p80"] = float(train_part["app_switches"].quantile(0.80))
        t["A_visible_apps_p75"] = float(train_part["num_visible_apps"].quantile(0.75))
        t["B_dwell_p20"] = float(train_part["final_app_dwell"].quantile(0.20))

        erase_nonzero = train_part.loc[train_part["erase_key_pct"] > 0, "erase_key_pct"]
        t["C_erase_p75"] = float(erase_nonzero.quantile(0.75)) if len(erase_nonzero) > 10 else 999.0
        t["C_keystroke_p25"] = float(train_part["keystroke_count"].quantile(0.25))
        t["C_std_interval_p75"] = float(train_part["std_press_interval_ms"].quantile(0.75))
        t["C_scroll_p75"] = float(train_part["mouse_scrolls"].quantile(0.75))

        t["D_idle_p75"] = float(train_part["idle_seconds"].quantile(0.75))
        t["D_idle_p60"] = float(train_part["idle_seconds"].quantile(0.60))
        t["D_mouse_moves_p25"] = float(train_part["mouse_moves"].quantile(0.25))

        thresholds_list.append(t)

    avg = {}
    for key in thresholds_list[0]:
        avg[key] = float(np.mean([t[key] for t in thresholds_list]))
    return avg


# ═══════════════════════════════════════════════════════════════════
#  Labeling
# ═══════════════════════════════════════════════════════════════════

def label_rows(df: pd.DataFrame, thresholds: dict, scorer: AppScorer) -> pd.DataFrame:
    """
    Apply weighted labeling with LLM-based app awareness.

    Key improvement: the app distraction score now influences BOTH
    the threshold (how easily a row is labeled distracted) AND
    becomes a training feature (so the model learns app context).

    v3.1 changes:
      - Rule 2 threshold reverted to 0.55
      - Added Rule 2b: productive-app idle override
    """
    t = thresholds

    # ── Dimension A: Context Switching ───────────────────────────────
    dim_A = (
        (df["app_switches"] > t["A_app_switches_p80"]) |
        (df["num_visible_apps"] > t["A_visible_apps_p75"])
    ).astype(int)

    # ── Dimension B: Short Dwell ─────────────────────────────────────
    dim_B = (df["final_app_dwell"] < t["B_dwell_p20"]).astype(int)

    # ── Dimension C: Irregular Input (softened scroll) ───────────────
    c1 = (df["keystroke_count"] < t["C_keystroke_p25"]).astype(int)
    c2 = (df["std_press_interval_ms"] > t["C_std_interval_p75"]).astype(int)
    c3 = (df["erase_key_pct"] > t["C_erase_p75"]).astype(int)
    c4 = (
        (df["mouse_scrolls"] > t["C_scroll_p75"]) &
        (df["keystroke_count"] == 0) &
        (df["mouse_clicks"] < 3)
    ).astype(int)
    dim_C = ((c1 + c2 + c3 + c4) >= 2).astype(int)

    # ── Dimension D: Idle / Passive ──────────────────────────────────
    dim_D = (
        (df["idle_seconds"] > t["D_idle_p75"]) |
        (
            (df["idle_seconds"] > t["D_idle_p60"]) &
            (df["mouse_moves"] < t["D_mouse_moves_p25"])
        )
    ).astype(int)

    # ── Weighted distraction score ───────────────────────────────────
    weights = {"A": 0.30, "B": 0.15, "C": 0.25, "D": 0.30}
    distraction_score = (
        dim_A * weights["A"] +
        dim_B * weights["B"] +
        dim_C * weights["C"] +
        dim_D * weights["D"]
    )

    # ── LLM-based app scores ────────────────────────────────────────
    app_col = None
    for col in [APP_COL, "foreground_app_end", "app_name", "foreground_app_start"]:
        if col in df.columns:
            app_col = col
            break

    if app_col is not None:
        # Get per-row distraction score from LLM
        app_scores = df[app_col].apply(scorer.get_score)
        # Get per-row threshold modifier
        threshold_modifier = app_scores.apply(scorer.get_threshold_modifier)
        # Get category labels
        app_categories = app_scores.apply(scorer.get_category)
    else:
        app_scores = pd.Series(0.5, index=df.index)
        threshold_modifier = pd.Series(0.45, index=df.index)
        app_categories = pd.Series("unknown", index=df.index)

    # ── Base label from weighted score vs app-aware threshold ────────
    distraction_label = (distraction_score >= threshold_modifier).astype(int)

    # ── App-based override rules ─────────────────────────────────────
    # Rule 1: Entertainment app for 3+ consecutive rows → distracted
    #         regardless of behavioral dimensions
    if app_col is not None:
        CONSECUTIVE_ENTERTAIN = 3
        for uid in df["user_id"].unique():
            mask = df["user_id"] == uid
            user_idx = df[mask].sort_values("timestamp").index

            is_entertain = (app_scores.loc[user_idx] >= 0.75).astype(int)
            groups = (is_entertain != is_entertain.shift()).cumsum()
            consecutive = is_entertain.groupby(groups).cumcount() + 1
            consecutive_entertain = consecutive * is_entertain

            override_idx = user_idx[consecutive_entertain >= CONSECUTIVE_ENTERTAIN]
            distraction_label.loc[override_idx] = 1

    # Rule 2: Productive app with low behavioral score → focused
    #         (Overrides cases where idle in PyCharm gets flagged)
    if app_col is not None:
        productive_mask = (app_scores <= 0.15) & (distraction_score < 0.55)
        distraction_label.loc[productive_mask] = 0

    # Rule 2b: Productive-app idle override  [NEW in v3.1]
    #   If user is in a productive app (IDE, Office, terminal) with
    #   high idle time but NOT switching away, they're likely
    #   reading code, waiting for compile, or reviewing a document.
    #   Force label to FOCUSED even if distraction_score is high.
    if app_col is not None:
        productive_idle_mask = (
            (app_scores <= 0.15) &                # productive app
            (df["idle_seconds"] > 30) &            # significant idle
            (df["app_switches"] <= 1) &            # not switching away
            (df["final_app_dwell"] > 40)           # staying in the app
        )
        distraction_label.loc[productive_idle_mask] = 0

        # Count how many rows this new rule affects
        rule2b_count = productive_idle_mask.sum()
        if rule2b_count > 0:
            print(f"    Rule 2b (productive-idle override): {rule2b_count:,} rows forced FOCUSED")

    # ── Sustained idle override ──────────────────────────────────────
    HIGH_IDLE_THRESHOLD = 45
    LOW_ENGAGE_THRESHOLD = 50
    CONSECUTIVE_REQUIRED = 3

    for uid in df["user_id"].unique():
        mask = df["user_id"] == uid
        user_idx = df[mask].sort_values("timestamp").index

        high_idle = (
            (df.loc[user_idx, "idle_seconds"] > HIGH_IDLE_THRESHOLD) &
            (df.loc[user_idx, "engagement_momentum"] < LOW_ENGAGE_THRESHOLD)
        ).astype(int)

        # Only override if NOT a productive app
        is_productive = (app_scores.loc[user_idx] <= 0.15)
        high_idle = high_idle & (~is_productive).astype(int)

        groups = (high_idle != high_idle.shift()).cumsum()
        consecutive = high_idle.groupby(groups).cumcount() + 1
        consecutive_idle = consecutive * high_idle

        override_idx = user_idx[consecutive_idle >= CONSECUTIVE_REQUIRED]
        distraction_label.loc[override_idx] = 1

    # ── Store columns ────────────────────────────────────────────────
    df["dim_A"] = dim_A
    df["dim_B"] = dim_B
    df["dim_C"] = dim_C
    df["dim_D"] = dim_D
    df["distraction_score"] = distraction_score.round(4)
    df["threshold_used"] = threshold_modifier
    df["triggered_dimensions"] = dim_A + dim_B + dim_C + dim_D
    df["distraction_label"] = distraction_label
    df["app_category_score"] = app_scores
    df["app_category"] = app_categories

    return df


# ═══════════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  SDPPS — Improved Distraction Labeling (v3.1)")
    print("  With LLM-based app awareness + productive-idle fix")
    print("=" * 60)

    WINDOWS_DIR.mkdir(parents=True, exist_ok=True)

    # ── Load LLM scorer ──────────────────────────────────────────────
    print(f"\n[0] Loading app scorer...")
    scorer = AppScorer()

    # ── Load data ────────────────────────────────────────────────────
    if not INPUT_CSV.exists():
        alternates = [
            PROCESSED_DIR / "cleaned_activity_log.csv",
            PROCESSED_DIR / "user_activity_log.csv",
            PROCESSED_DIR / "windows" / "cleaned_data.csv",
        ]
        input_path = None
        for alt in alternates:
            if alt.exists():
                input_path = alt
                break
        if input_path is None:
            print(f"ERROR: Cannot find input CSV.")
            print(f"  Tried: {INPUT_CSV}")
            for alt in alternates:
                print(f"  Tried: {alt}")
            return
    else:
        input_path = INPUT_CSV

    print(f"\n[1] Loading: {input_path}")
    df = pd.read_csv(input_path)
    print(f"    Rows: {len(df):,} | Columns: {len(df.columns)}")

    if "user_id" not in df.columns:
        print("    WARNING: 'user_id' not found — assigning all to 'user_0'")
        df["user_id"] = "user_0"

    print(f"    Users: {df['user_id'].nunique()}")

    # ── Show app score distribution ──────────────────────────────────
    if APP_COL in df.columns:
        unique_apps = df[APP_COL].dropna().unique()
        print(f"\n    App scoring preview ({len(unique_apps)} unique apps):")
        app_score_preview = {}
        for app in sorted(unique_apps):
            score = scorer.get_score(app)
            cat = scorer.get_category(score)
            app_score_preview[app] = (score, cat)

        for app, (score, cat) in sorted(app_score_preview.items(), key=lambda x: x[1][0]):
            count = (df[APP_COL] == app).sum()
            print(f"      {score:.2f}  {app:<35} ({cat}, {count:,} rows)")

    # ── Compute thresholds ───────────────────────────────────────────
    print(f"\n[2] Computing thresholds (80% train split per user)...")
    thresholds = compute_thresholds(df)

    with open(THRESHOLD_JSON, "w") as f:
        json.dump(thresholds, f, indent=2)
    print(f"    Saved: {THRESHOLD_JSON}")
    for key, val in thresholds.items():
        print(f"    {key}: {val:.4f}")

    # ── Label rows ───────────────────────────────────────────────────
    print(f"\n[3] Labeling with LLM-aware weighted system...")
    df = label_rows(df, thresholds, scorer)

    # ── Statistics ───────────────────────────────────────────────────
    total = len(df)
    distracted = int(df["distraction_label"].sum())
    focused = total - distracted
    rate = distracted / total * 100

    print(f"\n[4] Results:")
    print(f"    Total rows:      {total:,}")
    print(f"    Distracted (1):  {distracted:,}  ({rate:.1f}%)")
    print(f"    Focused (0):     {focused:,}  ({100 - rate:.1f}%)")

    print(f"\n    Dimension trigger rates:")
    print(f"      A (Context Switching): {df['dim_A'].mean() * 100:.1f}%")
    print(f"      B (Short Dwell):       {df['dim_B'].mean() * 100:.1f}%")
    print(f"      C (Irregular Input):   {df['dim_C'].mean() * 100:.1f}%")
    print(f"      D (Idle/Passive):      {df['dim_D'].mean() * 100:.1f}%")

    print(f"\n    App category score distribution:")
    print(f"      Mean:   {df['app_category_score'].mean():.3f}")
    print(f"      Median: {df['app_category_score'].median():.3f}")
    print(f"      Min:    {df['app_category_score'].min():.3f}")
    print(f"      Max:    {df['app_category_score'].max():.3f}")
    print(f"      Unique: {df['app_category_score'].nunique()}")

    print(f"\n    Distraction rate by app category:")
    for cat in ["productive", "mostly-productive", "neutral", "social", "entertainment"]:
        cat_mask = df["app_category"] == cat
        if cat_mask.any():
            cat_rate = df.loc[cat_mask, "distraction_label"].mean() * 100
            cat_count = cat_mask.sum()
            print(f"      {cat:<20}: {cat_rate:.1f}% distracted  ({cat_count:,} rows)")

    print(f"\n    Per-user distraction rates:")
    for uid in sorted(df["user_id"].unique()):
        user_df = df[df["user_id"] == uid]
        user_rate = user_df["distraction_label"].mean() * 100
        print(f"      {uid}: {user_rate:.1f}%  ({len(user_df):,} rows)")

    # ── Save ─────────────────────────────────────────────────────────
    print(f"\n[5] Saving: {OUTPUT_CSV}")
    df.to_csv(OUTPUT_CSV, index=False)
    print("    Done.")

    print("\n" + "=" * 60)
    print("  Next: python -m distraction_prediction.pipeline.window")
    print("=" * 60)


if __name__ == "__main__":
    main()
