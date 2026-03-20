"""
SDPPS – LLM-Based App Distraction Scoring (v3)
================================================
Uses OpenRouter free models to score apps.

Output: E:\SDPPS\distraction_prediction\data\interim\app_distraction_scores.json

Setup: pip install openai
"""

import json
import re
import pandas as pd
from pathlib import Path
from openai import OpenAI

# ── OpenRouter config ────────────────────────────────────────────────────
OPENROUTER_API_KEY = "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"

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

MODEL = "google/gemma-3-27b-it:free"



# ── Paths ────────────────────────────────────────────────────────────────
BASE_DIR = Path(r"E:\SDPPS")
RAW_DIR = BASE_DIR / "distraction_prediction" / "data" / "raw"
INTERIM_DIR = BASE_DIR / "distraction_prediction" / "data" / "interim"
OUTPUT_JSON = INTERIM_DIR / "app_distraction_scores.json"

APP_COL = "foreground_app_end"


def extract_unique_apps() -> list:
    all_apps = set()
    for f in sorted(RAW_DIR.glob("*.csv")):
        df = pd.read_csv(f, usecols=[APP_COL], low_memory=False)
        apps = df[APP_COL].dropna().astype(str).str.strip().unique()
        all_apps.update(apps)
    all_apps.discard("")
    all_apps.discard("unknown")
    all_apps.discard("Unknown")
    return sorted(all_apps)


def score_with_openrouter(app_names: list) -> dict:
    app_list = "\n".join(f"  {i+1}. {name}" for i, name in enumerate(app_names))

    prompt = f"""You are an expert on student productivity and digital distraction.

I have {len(app_names)} application names collected from university students' Windows computers.
For each application, assign a distraction_score between 0.0 and 1.0:

  0.00-0.05 = purely productive (IDE: VS Code, PyCharm, IntelliJ, terminal, PowerShell)
  0.10 = office/academic (Word, Excel, PowerPoint, Notepad, Figma, PacketTracer)
  0.15 = productive utility (Outlook, VirtualBox, SnippingTool, M365 Copilot)
  0.20 = dev tools/installers (Git installer, Anaconda installer, Taskmgr, paint.net)
  0.25 = AI assistants (ChatGPT, Claude, Copilot — research aid)
  0.30 = productive communication (Zoom, MS Teams, mspaint, wavepad)
  0.35 = system processes (dwm.exe, SearchHost.exe, Settings, NVIDIA drivers, LockApp)
  0.40 = mild utilities (Calculator, Camera, Photos, Microsoft Store, Widgets)
  0.50 = neutral/unknown (browsers like chrome.exe/brave.exe/msedge.exe, unknown .exe, generic launchers)
  0.60 = mildly distracting (LinkedIn — professional but browsable)
  0.70 = social messaging (WhatsApp, Discord — casual use)
  0.75 = background media (Spotify — many students use for focus music)
  0.80 = media consumption (VLC, Media Player, CapCut, Clipchamp, Syncplay, freecam)
  0.90 = gaming launchers (Steam, Epic Games, EA Desktop, Riot Client, PrismLauncher)
  0.95 = active gaming (GTA5, Valorant, CS2, Brawlhalla, Roblox, Titanfall2, Hogwarts Legacy)

Key rules:
- Web browsers (chrome.exe, brave.exe, msedge.exe) = 0.50 (context-dependent, can't tell from name alone)
- System/OS processes that students don't actively choose = 0.35
- Installers and .tmp files = score based on what they install, or 0.50 if unclear
- If truly unknown, use 0.50

Return ONLY a valid JSON object where keys are the EXACT app names as given and values are the scores.
No markdown code blocks, no explanation, no extra text. Just the raw JSON object.

Applications:
{app_list}"""

    print(f"  Sending {len(app_names)} apps to {MODEL} via OpenRouter...")

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=4096,
    )

    raw_text = response.choices[0].message.content.strip()
    print(f"  Response received ({len(raw_text)} chars)\n")

    return parse_json_response(raw_text)


def parse_json_response(raw_text: str) -> dict:
    # Strategy 1: Direct parse
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract from ```json block
    match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', raw_text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Strategy 3: Find largest {...}
    start = raw_text.find('{')
    end = raw_text.rfind('}')
    if start != -1 and end != -1:
        block = raw_text[start:end + 1]
        block = re.sub(r',\s*}', '}', block)
        try:
            return json.loads(block)
        except json.JSONDecodeError:
            pass

    print(f"  ERROR: Could not parse JSON")
    print(f"  Raw preview: {raw_text[:500]}")
    return None


def validate_scores(scores: dict, app_names: list) -> dict:
    normalized = {}
    for key, val in scores.items():
        try:
            score = float(val)
            score = max(0.0, min(1.0, round(score, 2)))
            normalized[key.strip()] = score
        except (ValueError, TypeError):
            normalized[key.strip()] = 0.5

    scored_lower = {k.lower(): k for k in normalized}
    missing = []
    for app in app_names:
        if app.lower() not in scored_lower:
            missing.append(app)
            normalized[app] = 0.5

    if missing:
        print(f"  WARNING: {len(missing)} apps not scored, defaulted to 0.5:")
        for m in missing:
            print(f"    - {m}")

    return normalized


def main():
    print("=" * 60)
    print("  SDPPS — LLM App Distraction Scoring (v3)")
    print(f"  Model: {MODEL} (via OpenRouter)")
    print("=" * 60)

    INTERIM_DIR.mkdir(parents=True, exist_ok=True)

    # ── Step 1: Extract ──────────────────────────────────────────────
    print(f"\n[1] Extracting unique apps...")
    app_names = extract_unique_apps()
    print(f"    Found {len(app_names)} unique apps")

    # ── Step 2: Score ────────────────────────────────────────────────
    print(f"\n[2] Scoring with LLM...")
    scores = score_with_openrouter(app_names)

    if scores is None:
        print("  FATAL: Could not parse LLM response. Check output above.")
        return

    # ── Step 3: Validate ─────────────────────────────────────────────
    print(f"[3] Validating {len(scores)} scores...")
    scores = validate_scores(scores, app_names)

    # ── Step 4: Save ─────────────────────────────────────────────────
    with open(OUTPUT_JSON, "w") as f:
        json.dump(scores, f, indent=2)

    print(f"\n[4] Saved {len(scores)} app scores → {OUTPUT_JSON}")

    # ── Summary ──────────────────────────────────────────────────────
    print(f"\n    {'Score':<8} {'App':<50} {'Category'}")
    print(f"    {'─'*7}  {'─'*49} {'─'*15}")
    for app, score in sorted(scores.items(), key=lambda x: x[1]):
        cat = (
            "productive" if score <= 0.15 else
            "mostly-productive" if score <= 0.35 else
            "neutral" if score <= 0.55 else
            "social" if score <= 0.75 else
            "entertainment"
        )
        print(f"    {score:.2f}     {app:<50} ({cat})")

    cats = {"productive": 0, "mostly-productive": 0, "neutral": 0, "social": 0, "entertainment": 0}
    for score in scores.values():
        if score <= 0.15:
            cats["productive"] += 1
        elif score <= 0.35:
            cats["mostly-productive"] += 1
        elif score <= 0.55:
            cats["neutral"] += 1
        elif score <= 0.75:
            cats["social"] += 1
        else:
            cats["entertainment"] += 1

    print(f"\n    Category distribution:")
    for cat, count in cats.items():
        pct = count / len(scores) * 100
        print(f"      {cat:<20}: {count:>3} apps ({pct:.0f}%)")

    print("\n" + "=" * 60)
    print("  REVIEW the scores above.")
    print("  Edit if needed: " + str(OUTPUT_JSON))
    print("  Then run: python -m distraction_prediction.pipeline.main")
    print("=" * 60)


if __name__ == "__main__":
    main()
