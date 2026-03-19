# LocalAgent.py
# Collects desktop behavioral data every 60 seconds
# Sends data to Flask backend API and receives prediction + blocking instructions
# Falls back to local CSV if API is unreachable

import psutil
import pandas as pd
import requests
import time
import getpass
import os
from datetime import datetime
from pynput import keyboard, mouse
import win32gui
import win32process

# ── Config ──
API_URL = "http://localhost:5000/api/activity"
username = getpass.getuser()
log_path = os.path.expanduser(f"C:/Users/{username}/distract_lstm_features.csv")

# ── Tracking variables ──
key_count = 0
erase_keys = 0
press_times = []
mouse_clicks = 0
mouse_moves = 0
mouse_scrolls = 0
idle_seconds = 0
app_switches = 0
session_start = time.time()
last_input_time = time.time()
erase_keys_set = {'backspace', 'delete'}
last_real_app = None


def get_foreground_process_name():
    try:
        hwnd = win32gui.GetForegroundWindow()
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        return psutil.Process(pid).name()
    except:
        return 'Unknown'


def get_foreground_window_title():
    try:
        return win32gui.GetWindowText(win32gui.GetForegroundWindow())
    except:
        return ''


def get_app_name(proc_name, window_title):
    if proc_name == "ApplicationFrameHost.exe" and window_title.strip():
        return window_title.strip()
    return proc_name


def get_visible_apps():
    app_set = set()
    def handler(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            try:
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                pname = psutil.Process(pid).name()
                title = win32gui.GetWindowText(hwnd).strip()
                if pname and pname.lower() not in ['explorer.exe', 'backgroundtaskhost.exe']:
                    if pname == "ApplicationFrameHost.exe" and title:
                        app_set.add(title)
                    else:
                        app_set.add(pname)
            except:
                pass
    win32gui.EnumWindows(handler, None)
    return app_set


# ── Input listeners ──
def on_press(key):
    global key_count, erase_keys, last_input_time
    key_count += 1
    press_times.append(time.time())
    last_input_time = time.time()
    try:
        if key.name.lower() in erase_keys_set:
            erase_keys += 1
    except:
        pass

def on_click(x, y, button, pressed):
    global mouse_clicks, last_input_time
    if pressed:
        mouse_clicks += 1
        last_input_time = time.time()

def on_move(x, y):
    global mouse_moves, last_input_time
    mouse_moves += 1
    last_input_time = time.time()

def on_scroll(x, y, dx, dy):
    global mouse_scrolls, last_input_time
    mouse_scrolls += 1
    last_input_time = time.time()


keyboard.Listener(on_press=on_press).start()
mouse.Listener(on_click=on_click, on_move=on_move, on_scroll=on_scroll).start()

print(f"SDPPS Agent started for user: {username}")
print(f"API endpoint: {API_URL}")
print(f"Fallback CSV: {log_path}")
print("Collecting data every 60 seconds...\n")


def save_csv(data):
    """Fallback: save to local CSV if API is unreachable."""
    df = pd.DataFrame([data])
    header = not os.path.isfile(log_path)
    df.to_csv(log_path, mode='a', index=False, header=header)


def send_to_api(payload):
    """Send data to Flask API and return response."""
    try:
        response = requests.post(API_URL, json=payload, timeout=10)
        return response.json()
    except requests.ConnectionError:
        return None
    except Exception as e:
        print(f"  API error: {e}")
        return None


# ── Main collection loop ──
while True:
    try:
        # Reset counters
        key_count = 0
        erase_keys = 0
        mouse_clicks = 0
        mouse_moves = 0
        mouse_scrolls = 0
        idle_seconds = 0
        app_switches = 0
        press_times.clear()

        prev_app = last_real_app if last_real_app else ""
        current_app = prev_app
        dwell_start = time.time()
        dwell_time = 0
        session_minutes = int((time.time() - session_start) // 60)
        net_start = psutil.net_io_counters()

        # Monitor for 60 seconds
        start = time.time()
        while time.time() - start < 60:
            proc_name = get_foreground_process_name()
            window_title = get_foreground_window_title()
            app_name = get_app_name(proc_name, window_title)

            if app_name.lower() != "explorer.exe" and app_name:
                if app_name != current_app:
                    dwell_time = int(time.time() - dwell_start)
                    app_switches += 1
                    current_app = app_name
                    last_real_app = app_name
                    dwell_start = time.time()

            if time.time() - last_input_time > 2:
                idle_seconds += 1
            time.sleep(1)

        # Final dwell
        dwell_time += int(time.time() - dwell_start)

        # Network
        net_end = psutil.net_io_counters()
        bytes_sent = net_end.bytes_sent - net_start.bytes_sent
        bytes_recv = net_end.bytes_recv - net_start.bytes_recv

        # System info
        visible_apps = get_visible_apps()
        cpu = psutil.cpu_percent()
        mem = psutil.virtual_memory().percent

        # Derived features
        erase_pct = (erase_keys / key_count * 100) if key_count > 0 else 0
        avg_interval = (pd.Series(press_times).diff().mean() * 1000) if len(press_times) > 1 else 0
        std_interval = (pd.Series(press_times).diff().std() * 1000) if len(press_times) > 1 else 0

        # Build payload
        payload = {
            "user_id": username,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "foreground_app_start": prev_app,
            "foreground_app_end": current_app,
            "app_switches": app_switches,
            "final_app_dwell": dwell_time,
            "num_visible_apps": len(visible_apps),
            "cpu_usage": cpu,
            "memory_usage": mem,
            "bytes_sent": bytes_sent,
            "bytes_received": bytes_recv,
            "hour": datetime.now().hour,
            "day_of_week": datetime.now().strftime('%A'),
            "session_time_minutes": session_minutes,
            "keystroke_count": key_count,
            "erase_key_count": erase_keys,
            "erase_key_pct": erase_pct,
            "avg_press_interval_ms": avg_interval,
            "std_press_interval_ms": std_interval,
            "mouse_clicks": mouse_clicks,
            "mouse_moves": mouse_moves,
            "mouse_scrolls": mouse_scrolls,
            "idle_seconds": idle_seconds,
            "engagement_momentum": key_count + mouse_clicks + mouse_moves,
            "visible_apps": ';'.join(visible_apps),
        }

        # Try sending to API
        result = send_to_api(payload)

        if result:
            # API responded — show prediction
            pred = result.get("prediction", {})
            if pred:
                status = "DISTRACTED" if pred.get("prediction") == "distracted" else "FOCUSED"
                prob = pred.get("blended_prob", 0)
                bilstm = pred.get("bilstm_prob", 0)
                app_cat = pred.get("app_category_score", 0)
                dom_app = pred.get("dominant_app", "?")

                print(f"[{payload['timestamp']}] {status} ({prob*100:.0f}%) | "
                      f"BiLSTM: {bilstm*100:.0f}% | AppCat: {app_cat:.2f} | App: {dom_app}")

                # Handle blocking instruction from server
                if result.get("action") == "block":
                    print(f"WARNING: {result.get('message', 'You seem distracted. Refocus!')}")
            else:
                print(f"[{payload['timestamp']}] Saved | App: {current_app} | Waiting for {10} rows...")
        else:
            # API unreachable — fallback to CSV
            save_csv(payload)
            print(f"[{payload['timestamp']}] API offline — saved to CSV | App: {current_app}")

    except KeyboardInterrupt:
        print("\nAgent stopped by user.")
        break
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(2)
