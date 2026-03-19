import pandas as pd
import json
import getpass
from pathlib import Path
import sys

# force utf-8 output
sys.stdout.reconfigure(encoding='utf-8')

df = pd.read_csv(Path(f'C:/Users/{getpass.getuser()}/distract_lstm_features.csv'))
last10 = df.tail(10).reset_index(drop=True)

t = json.load(open('e:/SDPPS/distraction_prediction/data/processed/label_thresholds.json'))

print(f"\nTotal rows in CSV : {len(df)}")
print(f"Window used       : last 10 rows\n")

print("=== APPS SEEN IN PREDICTION WINDOW ===")
print(last10['foreground_app_end'].value_counts().to_string())

print("\n=== KEY FEATURES vs DISTRACTION THRESHOLDS ===")
print(f"  {'Feature':<25} {'Your avg':>10}   {'Threshold':>14}   Result")
print(f"  {'-'*68}")

idle_avg   = last10['idle_seconds'].mean()
ks_avg     = last10['keystroke_count'].mean()
mm_avg     = last10['mouse_moves'].mean()
ms_avg     = last10['mouse_scrolls'].mean()
sw_avg     = last10['app_switches'].mean()
dw_avg     = last10['final_app_dwell'].mean()
em_avg     = last10['engagement_momentum'].mean()

print(f"  {'idle_seconds':<25} {idle_avg:>10.1f}s  {'>=60s (distracted)':>14}   {'[!!] HIGH' if idle_avg >= 60 else '[OK]'}")
print(f"  {'keystroke_count':<25} {ks_avg:>10.1f}   {'<=0 (distracted)':>14}   {'[!!] ZERO' if ks_avg <= 0 else '[OK] ACTIVE'}")
print(f"  {'mouse_moves':<25} {mm_avg:>10.1f}   {'<=0 (distracted)':>14}   {'[!!] NONE' if mm_avg <= 0 else '[OK] ACTIVE'}")
print(f"  {'mouse_scrolls':<25} {ms_avg:>10.1f}   {'>7 (distracted)':>14}   {'[!!] HIGH' if ms_avg > 7 else '[OK]'}")
print(f"  {'app_switches':<25} {sw_avg:>10.1f}   {'>1 (distracted)':>14}   {'[!!] HIGH' if sw_avg > 1 else '[OK]'}")
print(f"  {'final_app_dwell':<25} {dw_avg:>10.1f}s  {'<60s (distracted)':>14}   {'[!!] SHORT' if dw_avg < 60 else '[OK] LONG'}")
print(f"  {'engagement_momentum':<25} {em_avg:>10.1f}   {'(higher=more active)':>14}")

print("\n=== DIMENSION TRIGGER ANALYSIS ===")

dim_A = ((last10['app_switches'] > t['A_app_switches_p80']) |
         (last10['num_visible_apps'] > t['A_visible_apps_p75'])).mean()

dim_B = (last10['final_app_dwell'] < t['B_dwell_p20']).mean()

c1 = last10['keystroke_count'] <= t['C_keystroke_p25']
c2 = last10['std_press_interval_ms'] > t['C_std_interval_p75']
c3 = last10['erase_key_pct'] > t['C_erase_p75']
c4 = last10['mouse_scrolls'] > t['C_scroll_p75']
dim_C = ((c1.astype(int)+c2.astype(int)+c3.astype(int)+c4.astype(int)) >= 2).mean()

dim_D = (
    (last10['idle_seconds'] >= t['D_idle_p75']) |
    ((last10['idle_seconds'] >= t['D_idle_p60']) & (last10['mouse_moves'] <= t['D_mouse_moves_p25']))
).mean()

for name, rate, desc in [
    ("A - Multitasking",   dim_A, "App switches & visible apps"),
    ("B - Short dwell",    dim_B, "Rapid app switching"),
    ("C - Low/erratic input", dim_C, "Keystrokes, typing pattern"),
    ("D - Idle/passive",   dim_D, "Idle seconds + mouse moves"),
]:
    trig = "[FIRED]" if rate >= 0.5 else "[quiet]"
    print(f"  Dim {name:<22}: {rate*100:4.0f}% rows  {trig}  ({desc})")

triggered_count = sum([dim_A >= 0.5, dim_B >= 0.5, dim_C >= 0.5, dim_D >= 0.5])
print(f"\n  Dimensions triggered : {triggered_count} / 4  (need >=2 for DISTRACTED)")
print(f"  Heuristic verdict    : {'[DISTRACTED]' if triggered_count >= 2 else '[FOCUSED]'}")
print(f"  BiLSTM model output  : [FOCUSED]  prob=30.2%")

print("\n=== WHY THE MODEL SAID FOCUSED ===")
print(f"  - Foreground app was KMPlayer 9/10 rows (high dwell = 'focused' signal)")
print(f"  - You had {ks_avg:.0f} avg keystrokes/min  ->  not zero, model sees 'activity'")
print(f"  - Mouse moved {mm_avg:.0f} times/min          ->  not completely idle")
print(f"  - Idle avg: {idle_avg:.0f}s                     ->  {'exceeds threshold' if idle_avg >= 60 else 'below idle threshold of 60s'}")
print(f"")
print(f"  ROOT CAUSE: The model has NO knowledge that KMPlayer = entertainment.")
print(f"  It only sees behavioral signals. Watching a movie with occasional")
print(f"  mouse movements 'looks like' focused single-app work to the model.")

