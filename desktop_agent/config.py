"""
SDPPS – Desktop Agent Configuration
"""

from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────
BASE_DIR = Path(r"E:\SDPPS")
MODEL_PATH = BASE_DIR / "distraction_prediction" / "models" / "saved_models" / "best_model.pt"
SCALER_PATH = BASE_DIR / "distraction_prediction" / "data" / "processed" / "windows" / "scaler_zscore.json"
FEATURE_COLUMNS_PATH = BASE_DIR / "distraction_prediction" / "data" / "processed" / "windows" / "feature_columns.json"

# ── Agent Settings ───────────────────────────────────────────────────────
COLLECT_INTERVAL = 60         
DISTRACTION_THRESHOLD = 0.5     



BLEND_MODE = "adaptive"


# ── Blocker Settings ─────────────────────────────────────────────────────
BLOCKED_APPS = ["spotify.exe", "vlc.exe", "kmplayer.exe"]
BLOCKED_SITES = ["youtube.com", "netflix.com", "tiktok.com", "instagram.com"]
PRODUCTIVE_APPS = ["pycharm64.exe", "code.exe", "devenv.exe", "excel.exe", "winword.exe"]

