# main.py
# Runs the full preprocessing pipeline in order:
# 1) assign_user_id.py  -> creates interim user-tagged files
# 2) merge_data.py      -> merges + dedups into interim/merged_dedup.csv
# 3) clean.py           -> cleans into processed/cleaned_data.csv
# 4) label.py           -> labels into processed/labeled.csv (+ thresholds json)
# 5) window.py          -> creates train/val/test windows into processed/windows/

from __future__ import annotations

import sys
import subprocess
from pathlib import Path


def run_step(python_exe: str, script_path: Path) -> None:
    """Run a python script as a subprocess and stop the pipeline if it fails."""
    if not script_path.exists():
        raise FileNotFoundError(f"Missing script: {script_path}")

    print(f"\n==============================")
    print(f"Running: {script_path.name}")
    print(f"==============================")

    # Use the pipeline directory as the working directory so relative paths work.
    result = subprocess.run(
        [python_exe, str(script_path.name)],
        cwd=str(script_path.parent),
        capture_output=False,  # show live output
        text=True,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(f"Step failed: {script_path.name} (exit code {result.returncode})")

    print(f"Completed: {script_path.name}")


def main() -> None:
    pipeline_dir = Path(__file__).resolve().parent

    # Use the same Python interpreter that is running main.py
    python_exe = sys.executable

    steps = [
        pipeline_dir / "assign_user_id.py",
        pipeline_dir / "merge_data.py",
        pipeline_dir / "clean.py",
        pipeline_dir / "label.py",
        pipeline_dir / "window.py",
    ]

    print("Starting SDPPS preprocessing pipeline...")
    print("Pipeline directory:", pipeline_dir)

    for step in steps:
        run_step(python_exe, step)

    print("\nPipeline finished successfully.")
    print("Final outputs should be in:")
    print(" - data/interim/merged_dedup.csv")
    print(" - data/processed/cleaned_data.csv")
    print(" - data/processed/labeled.csv")
    print(" - data/processed/windows/ (X_train.npy, y_train.npy, etc.)")


if __name__ == "__main__":
    main()