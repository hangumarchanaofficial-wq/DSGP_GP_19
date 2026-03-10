import sys
import subprocess

import psutil
import pandas as pd
import time
import getpass
import os
from datetime import datetime
from pynput import keyboard, mouse
import win32gui
import win32process

# Stage 1: app category scoring
from app_categorizer import categorize_app

username = getpass.getuser()
log_path = os.path.expanduser(f"C:/Users/{username}/distract_lstm_features.csv")

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
        proc = psutil.Process(pid)
        return proc.name()
    except Exception as e:
        print(f"(Debug) get_foreground_process_name error: {e}")
        return 'Unknown'

def get_foreground_window_title():
    try:
        hwnd = win32gui.GetForegroundWindow()
        return win32gui.GetWindowText(hwnd)
    except Exception as e:
        print(f"(Debug) get_foreground_window_title error: {e}")
        return ''

def get_app_name(proc_name, window_title):
    if proc_name == "ApplicationFrameHost.exe" and window_title.strip():
        return window_title.strip()
    return proc_name

def get_visible_app_processes_with_titles():
    app_set = set()
    def enum_handler(hwnd, ctx):
        if win32gui.IsWindowVisible(hwnd):
            try:
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                proc = psutil.Process(pid)
                pname = proc.name()
                title = win32gui.GetWindowText(hwnd).strip()
                # skip common system shell windows
                if pname and pname.lower() not in ['explorer.exe', 'backgroundtaskhost.exe']:
                    if pname == "ApplicationFrameHost.exe" and title:
                        app_set.add(title)
                    else:
                        app_set.add(pname)
            except Exception:
                pass
    win32gui.EnumWindows(enum_handler, None)
    return app_set

def on_press(key):
    global key_count, erase_keys, last_input_time
    key_count += 1
    press_times.append(time.time())
    last_input_time = time.time()
    try:
        if key.name.lower() in erase_keys_set:
            erase_keys += 1
    except Exception as e:
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

try:
    keyboard_listener = keyboard.Listener(on_press=on_press)
    mouse_listener = mouse.Listener(on_click=on_click, on_move=on_move, on_scroll=on_scroll)
    keyboard_listener.start()
    mouse_listener.start()
    print("(Debug) Input listeners started.")
except Exception as e:
    print(f"(Debug) Listener startup failed: {e}")

def save_row(data):
    try:
        df = pd.DataFrame([data])
        header = not os.path.isfile(log_path)
        df.to_csv(log_path, mode='a', index=False, header=header)
        print(f"(Debug) Row saved: {data}")
    except Exception as e:
        print(f"(Debug) Error saving row: {e}")

minute = 60
while True:
    try:
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
        session_time_minutes = int((time.time() - session_start) // 60)
        net_start = psutil.net_io_counters()

        start = time.time()
        while time.time() - start < minute:
            proc_name = get_foreground_process_name()
            window_title = get_foreground_window_title()
            app_name = get_app_name(proc_name, window_title)
            if app_name.lower() == "explorer.exe" or not app_name:

                pass
            elif app_name != current_app:
                dwell_duration = int(time.time() - dwell_start)
                print(f"(Debug) App switched to: {app_name}")
                app_switches += 1
                dwell_time = dwell_duration
                current_app = app_name
                last_real_app = app_name
                dwell_start = time.time()
            if time.time() - last_input_time > 2:
                idle_seconds += 1
            time.sleep(1)

        dwell_duration = int(time.time() - dwell_start)
        dwell_time += dwell_duration

        net_end = psutil.net_io_counters()
        bytes_sent = net_end.bytes_sent - net_start.bytes_sent
        bytes_recv = net_end.bytes_recv - net_start.bytes_recv

        try:
            visible_apps = get_visible_app_processes_with_titles()
            apps_running = ';'.join(visible_apps)
            n_running_apps = len(visible_apps)
            cpu = psutil.cpu_percent()
            mem = psutil.virtual_memory().percent
        except Exception as e:
            print(f"(Debug) Error getting user apps: {e}")
            apps_running, n_running_apps, cpu, mem = '', 0, 0, 0

        hour = datetime.now().hour
        day_of_week = datetime.now().strftime('%A')
        erase_pct = (erase_keys / key_count * 100) if key_count > 0 else 0
        avg_press_interval = (pd.Series(press_times).diff().mean() * 1000) if len(press_times) > 1 else 0
        std_press_interval = (pd.Series(press_times).diff().std() * 1000) if len(press_times) > 1 else 0

        # Stage 1: compute app category score for the foreground app this minute
        current_window_title = get_foreground_window_title()
        app_category_score = categorize_app(current_app, current_window_title)

        row = {
            'timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'user': username,
            'foreground_app_start': prev_app if prev_app else "",
            'foreground_app_end': current_app if current_app else "",
            'app_switches': app_switches,
            'final_app_dwell': dwell_time,
            'num_visible_apps': n_running_apps,
            'cpu_usage': cpu,
            'memory_usage': mem,
            'bytes_sent': bytes_sent,
            'bytes_received': bytes_recv,
            'hour': hour,
            'day_of_week': day_of_week,
            'session_time_minutes': session_time_minutes,
            'keystroke_count': key_count,
            'erase_key_count': erase_keys,
            'erase_key_pct': erase_pct,
            'avg_press_interval_ms': avg_press_interval,
            'std_press_interval_ms': std_press_interval,
            'mouse_clicks': mouse_clicks,
            'mouse_moves': mouse_moves,
            'mouse_scrolls': mouse_scrolls,
            'idle_seconds': idle_seconds,
            'engagement_momentum': key_count + mouse_clicks + mouse_moves,
            'visible_apps': apps_running,
            'app_category': app_category_score,
        }

        save_row(row)
        print(f"(Debug) Logged this minute: {row}")

    except KeyboardInterrupt:
        print("(Debug) Logging interrupted by user. Exiting...")
        break
    except Exception as e:
        print(f"(Debug) Error in main logging loop: {e}")
        time.sleep(2)



