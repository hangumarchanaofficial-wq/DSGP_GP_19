"""
SDPPS – Adaptive Planner Service
Fixes applied:
  1. focus_score_avg uses true running mean (stores focus_score_count)
  2. get_missed_tasks adds 24-hour upper bound to avoid stale tasks
  3. _get_range uses a read-only helper; no longer creates phantom JSON entries on reads
  4. badge _check_badges caches completed_count once per call
  5. imbalanced-learn optional warning on startup
  6. AdaptivePlanner.complete_task / miss_task wrappers added (api_server calls these)
  7. get_smart_schedule defaults tasks=None (api_server calls with no args)
  8. analyze_content_context and _check_distraction_reschedule added (api_server calls these)
"""

import os
import json
import random
import warnings
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score

try:
    from imblearn.over_sampling import SMOTE
    HAS_SMOTE = True
except ImportError:
    HAS_SMOTE = False
    warnings.warn(
        "[AdaptivePlanner] imbalanced-learn not installed. "
        "SMOTE oversampling will be skipped. "
        "Install with: pip install imbalanced-learn>=0.11.0",
        ImportWarning,
        stacklevel=2,
    )

SAVE_DIR = os.path.join(os.path.dirname(__file__), 'saved_models')
os.makedirs(SAVE_DIR, exist_ok=True)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

NUMERIC_COLS = ['age', 'study_hours_per_day', 'sleep_hours', 'total_social_hours']

_DOW_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']


# ═══════════════════════════════════════════════════════════════
#  PRODUCTIVITY PROFILER
# ═══════════════════════════════════════════════════════════════

class ProductivityProfiler:
    """
    Learns per-student productivity patterns over time.
    Tracks hourly completion rates, day-of-week performance, and
    per-subject stats to recommend optimal task slots.
    """

    def __init__(self):
        self.profile_file = os.path.join(DATA_DIR, 'productivity_profile.json')
        self.hourly_completion = {}
        self.dow_completion = {}
        self.subject_performance = {}
        self._load()

    def _load(self):
        if os.path.exists(self.profile_file):
            try:
                with open(self.profile_file, 'r') as f:
                    data = json.load(f)
                self.hourly_completion = data.get('hourly_completion', {})
                self.dow_completion = data.get('dow_completion', {})
                self.subject_performance = data.get('subject_performance', {})
                total = sum(v[1] for v in self.hourly_completion.values())
                print(f'[Profiler] Loaded profile ({total} hourly data points)')
            except Exception as e:
                print(f'[Profiler] Load failed: {e}')

    def _save(self):
        try:
            with open(self.profile_file, 'w') as f:
                json.dump({
                    'hourly_completion': self.hourly_completion,
                    'dow_completion': self.dow_completion,
                    'subject_performance': self.subject_performance,
                }, f, indent=2)
        except Exception as e:
            print(f'[Profiler] Save failed: {e}')

    def record_completion(self, task: dict, completed: bool):
        subject = (task.get('subject') or 'unknown').lower().strip()
        ts = task.get('completed_at') or task.get('started_at')
        hour = None
        dow = None
        if ts:
            try:
                dt = datetime.strptime(ts[:19], '%Y-%m-%d %H:%M:%S')
                hour = dt.hour
                dow = dt.weekday()
            except Exception:
                pass
        if hour is None:
            slot = task.get('scheduled_slot') or ''
            try:
                if ':' in slot and len(slot) <= 5:
                    hour = int(slot.split(':')[0])
            except Exception:
                pass

        if hour is not None:
            h = str(hour)
            if h not in self.hourly_completion:
                self.hourly_completion[h] = [0, 0]
            self.hourly_completion[h][1] += 1
            if completed:
                self.hourly_completion[h][0] += 1

        if dow is not None:
            d = str(dow)
            if d not in self.dow_completion:
                self.dow_completion[d] = [0, 0]
            self.dow_completion[d][1] += 1
            if completed:
                self.dow_completion[d][0] += 1

        dur = float(task.get('duration_minutes') or 0)
        if subject not in self.subject_performance:
            self.subject_performance[subject] = [0, 0, 0.0]
        self.subject_performance[subject][1] += 1
        self.subject_performance[subject][2] += dur
        if completed:
            self.subject_performance[subject][0] += 1

        self._save()

    def get_hourly_rate(self, hour: int) -> float:
        data = self.hourly_completion.get(str(hour))
        if not data or data[1] < 2:
            return 0.5
        return data[0] / data[1]

    def get_dow_rate(self, dow: int) -> float:
        data = self.dow_completion.get(str(dow))
        if not data or data[1] < 2:
            return 0.5
        return data[0] / data[1]

    def get_subject_rate(self, subject: str) -> float:
        key = (subject or '').lower().strip()
        data = self.subject_performance.get(key)
        if not data or data[1] < 1:
            return 0.5
        return data[0] / data[1]

    def get_optimal_slot(self, candidate_slots: list, subject: str = None,
                         priority: str = 'medium') -> str:
        if not candidate_slots:
            return None

        today_dow = datetime.now().weekday()
        dow_rate = self.get_dow_rate(today_dow)

        has_data = any(
            self.hourly_completion.get(str(s.split(':')[0]), [0, 0])[1] >= 2
            for s in candidate_slots if ':' in s
        )

        if not has_data:
            return candidate_slots[0]

        subject_rate = self.get_subject_rate(subject) if subject else 0.5

        def score(slot_time: str) -> float:
            try:
                hour = int(slot_time.split(':')[0])
            except Exception:
                return 0.0
            hr = self.get_hourly_rate(hour)
            if priority == 'high':
                p_weight = 0.6
            elif priority == 'low':
                p_weight = 0.3
            else:
                p_weight = 0.45
            subj_factor = 1.0 + (0.5 - subject_rate) * 0.4
            base = hr * p_weight + dow_rate * 0.2 + subject_rate * 0.1
            return base * subj_factor

        return max(candidate_slots, key=score)

    def get_best_hours(self, n: int = 3) -> list:
        ranked = [
            {'hour': int(h), 'label': f'{int(h):02d}:00',
             'rate': round(c / t, 3), 'total_tasks': t}
            for h, (c, t) in self.hourly_completion.items() if t >= 2
        ]
        ranked.sort(key=lambda x: x['rate'], reverse=True)
        return ranked[:n]

    def get_worst_hours(self, n: int = 3) -> list:
        ranked = [
            {'hour': int(h), 'label': f'{int(h):02d}:00',
             'rate': round(c / t, 3), 'total_tasks': t}
            for h, (c, t) in self.hourly_completion.items() if t >= 2
        ]
        ranked.sort(key=lambda x: x['rate'])
        return ranked[:n]

    def get_best_days(self, n: int = 3) -> list:
        ranked = [
            {'dow': int(d), 'day': _DOW_NAMES[int(d)],
             'rate': round(c / t, 3), 'total_tasks': t}
            for d, (c, t) in self.dow_completion.items() if t >= 2
        ]
        ranked.sort(key=lambda x: x['rate'], reverse=True)
        return ranked[:n]

    def get_subject_summary(self) -> list:
        result = [
            {'subject': s, 'completion_rate': round(c / t, 3),
             'total_tasks': t, 'avg_duration_minutes': round(d / t, 1)}
            for s, (c, t, d) in self.subject_performance.items() if t > 0
        ]
        result.sort(key=lambda x: x['completion_rate'], reverse=True)
        return result

    def get_profile_summary(self) -> dict:
        total_data = sum(v[1] for v in self.hourly_completion.values())
        return {
            'total_data_points': total_data,
            'has_enough_data': total_data >= 5,
            'best_hours': self.get_best_hours(3),
            'worst_hours': self.get_worst_hours(3),
            'best_days': self.get_best_days(3),
            'subject_performance': self.get_subject_summary(),
        }


# ═══════════════════════════════════════════════════════════════
#  TREND ANALYZER
# ═══════════════════════════════════════════════════════════════

class TrendAnalyzer:
    """
    Tracks daily productivity aggregates and generates data-driven
    improvement suggestions, trend analysis, and study vs distraction ratios.
    """

    def __init__(self):
        self.trend_file = os.path.join(DATA_DIR, 'trend_data.json')
        self.daily = {}
        self._load()

    def _load(self):
        if os.path.exists(self.trend_file):
            try:
                with open(self.trend_file, 'r') as f:
                    self.daily = json.load(f)
                print(f'[TrendAnalyzer] Loaded {len(self.daily)} daily records')
            except Exception as e:
                print(f'[TrendAnalyzer] Load failed: {e}')

    def _save(self):
        try:
            with open(self.trend_file, 'w') as f:
                json.dump(self.daily, f, indent=2)
        except Exception as e:
            print(f'[TrendAnalyzer] Save failed: {e}')

    def _today(self) -> str:
        return datetime.now().strftime('%Y-%m-%d')

    def _empty_day(self) -> dict:
        """Return a zero-filled day entry (does NOT write to self.daily)."""
        return {
            'study_minutes': 0,
            'distraction_events': 0,
            'tasks_completed': 0,
            'tasks_missed': 0,
            'content_educational': 0,
            'content_non_educational': 0,
            'distraction_minutes': 0,
        }

    def _get_day(self, date_str: str) -> dict:
        """Get or create the mutable day entry (writes to self.daily on first access)."""
        if date_str not in self.daily:
            self.daily[date_str] = self._empty_day()
        return self.daily[date_str]

    def _get_day_readonly(self, date_str: str) -> dict:
        """Return a copy of a day entry without creating a new entry in self.daily."""
        return dict(self.daily.get(date_str) or self._empty_day())

    def record_task_completed(self, task: dict):
        entry = self._get_day(self._today())
        entry['tasks_completed'] += 1
        # Use actual studied seconds if available, else fall back to duration_minutes.
        studied_sec = int(task.get('actual_duration_seconds') or task.get('studied_seconds') or 0)
        if studied_sec > 0:
            entry['study_minutes'] += round(studied_sec / 60, 2)
        else:
            entry['study_minutes'] += int(task.get('duration_minutes') or 0)
        entry['distraction_events'] += int(task.get('distraction_events') or 0)
        self._save()

    def record_task_missed(self, task: dict):
        entry = self._get_day(self._today())
        entry['tasks_missed'] += 1
        entry['distraction_events'] += int(task.get('distraction_events') or 0)
        self._save()

    def record_distraction_event(self, duration_minutes: int = 5):
        entry = self._get_day(self._today())
        entry['distraction_events'] += 1
        entry['distraction_minutes'] += duration_minutes
        self._save()

    def record_content_event(self, is_educational: bool):
        entry = self._get_day(self._today())
        if is_educational:
            entry['content_educational'] += 1
        else:
            entry['content_non_educational'] += 1
        self._save()

    def _get_range(self, days: int = 7) -> list:
        """Return enriched day entries for the last N days (read-only; no side effects)."""
        result = []
        for i in range(days - 1, -1, -1):
            date_str = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            entry = self._get_day_readonly(date_str)
            entry['date'] = date_str
            total = entry['tasks_completed'] + entry['tasks_missed']
            entry['completion_rate'] = round(
                entry['tasks_completed'] / total * 100 if total > 0 else 0, 1)
            total_content = entry['content_educational'] + entry['content_non_educational']
            entry['educational_ratio'] = round(
                entry['content_educational'] / total_content * 100
                if total_content > 0 else 0, 1)
            result.append(entry)
        return result

    def get_daily_trends(self, days: int = 7) -> list:
        return self._get_range(days)

    def get_completion_trend(self, days: int = 7) -> list:
        return [e['completion_rate'] for e in self._get_range(days)]

    def get_weekly_summary(self) -> dict:
        entries = self._get_range(7)
        total_study = sum(e['study_minutes'] for e in entries)
        total_comp = sum(e['tasks_completed'] for e in entries)
        total_miss = sum(e['tasks_missed'] for e in entries)
        total_dist_events = sum(e['distraction_events'] for e in entries)
        total_dist_min = sum(e['distraction_minutes'] for e in entries)
        total_tasks = total_comp + total_miss

        recent = entries[-3:]
        older = entries[:4]
        r_comp = sum(e['tasks_completed'] for e in recent)
        r_total = sum(e['tasks_completed'] + e['tasks_missed'] for e in recent)
        o_comp = sum(e['tasks_completed'] for e in older)
        o_total = sum(e['tasks_completed'] + e['tasks_missed'] for e in older)
        recent_rate = r_comp / max(r_total, 1) * 100
        older_rate = o_comp / max(o_total, 1) * 100
        delta = round(recent_rate - older_rate, 1)

        trend_direction = ('improving' if delta > 5 else 'declining' if delta < -5 else 'stable')

        return {
            'days_tracked': 7,
            'total_study_minutes': total_study,
            'total_study_hours': round(total_study / 60, 1),
            'avg_daily_study_minutes': round(total_study / 7, 1),
            'total_tasks_completed': total_comp,
            'total_tasks_missed': total_miss,
            'total_tasks': total_tasks,
            'overall_completion_rate': round(total_comp / max(total_tasks, 1) * 100, 1),
            'total_distraction_events': total_dist_events,
            'total_distraction_minutes': total_dist_min,
            'trend_direction': trend_direction,
            'trend_delta': delta,
            'recent_completion_rate': round(recent_rate, 1),
            'older_completion_rate': round(older_rate, 1),
        }

    def get_study_vs_distraction(self) -> dict:
        entries = self._get_range(7)
        study_min = sum(e['study_minutes'] for e in entries)
        dist_min = sum(e['distraction_minutes'] for e in entries)
        dist_events = sum(e['distraction_events'] for e in entries)
        total = study_min + dist_min
        edu = sum(e['content_educational'] for e in entries)
        non_edu = sum(e['content_non_educational'] for e in entries)
        total_content = edu + non_edu
        return {
            'study_minutes': study_min,
            'study_hours': round(study_min / 60, 1),
            'distraction_minutes': dist_min,
            'distraction_events': dist_events,
            'study_ratio_pct': round(study_min / max(total, 1) * 100, 1),
            'distraction_ratio_pct': round(dist_min / max(total, 1) * 100, 1),
            'content_educational': edu,
            'content_non_educational': non_edu,
            'educational_content_pct': round(edu / max(total_content, 1) * 100, 1),
        }

    def detect_patterns(self) -> dict:
        entries = self._get_range(7)
        has_data = any(e['tasks_completed'] + e['tasks_missed'] > 0 for e in entries)
        if not has_data:
            return {'no_data': True}

        best = max(entries, key=lambda e: e['completion_rate'])
        worst = min(
            [e for e in entries if e['tasks_completed'] + e['tasks_missed'] > 0],
            key=lambda e: e['completion_rate'], default=None)
        most_distracted = max(entries, key=lambda e: e['distraction_events'])
        most_productive = max(entries, key=lambda e: e['study_minutes'])

        streak = 0
        for e in reversed(entries):
            if e['tasks_completed'] > 0:
                streak += 1
            else:
                break

        return {
            'best_day': {'date': best['date'], 'completion_rate': best['completion_rate']},
            'worst_day': {'date': worst['date'], 'completion_rate': worst['completion_rate']} if worst else None,
            'most_distracted_day': {'date': most_distracted['date'], 'events': most_distracted['distraction_events']},
            'most_productive_day': {'date': most_productive['date'], 'study_minutes': most_productive['study_minutes']},
            'current_active_day_streak': streak,
        }

    def generate_suggestions(self, profiler: 'ProductivityProfiler' = None) -> list:
        suggestions = []
        entries = self._get_range(7)
        has_data = any(e['tasks_completed'] + e['tasks_missed'] > 0 for e in entries)

        if not has_data:
            suggestions.append({
                'type': 'onboarding', 'priority': 'info',
                'title': 'Start tracking your progress',
                'message': 'Complete a few tasks to unlock personalized insights and recommendations.',
            })
            return suggestions

        summary = self.get_weekly_summary()
        ratio = self.get_study_vs_distraction()

        if summary['trend_direction'] == 'declining':
            suggestions.append({
                'type': 'trend_alert', 'priority': 'high',
                'title': 'Performance declining this week',
                'message': (
                    f"Your completion rate dropped {abs(summary['trend_delta']):.0f}% "
                    "vs the previous period. Try shorter focus blocks (25 min) and take "
                    "a 5-min break between sessions."),
            })

        if ratio['distraction_ratio_pct'] > 25:
            suggestions.append({
                'type': 'distraction', 'priority': 'high',
                'title': 'High distraction rate detected',
                'message': (
                    f"~{ratio['distraction_ratio_pct']:.0f}% of your tracked time is "
                    "lost to distractions. Enable the content blocker during scheduled tasks."),
            })

        avg_daily = summary['avg_daily_study_minutes']
        if avg_daily < 60:
            suggestions.append({
                'type': 'study_time', 'priority': 'medium',
                'title': 'Increase daily study time',
                'message': (
                    f"You're averaging {avg_daily:.0f} min/day. "
                    "Aim for at least 90 minutes of focused study each day."),
            })
        elif avg_daily > 300:
            suggestions.append({
                'type': 'balance', 'priority': 'low',
                'title': 'Remember to take breaks',
                'message': (
                    f"You're studying {avg_daily/60:.1f} hours/day. "
                    "Schedule a 10-min break every 50 minutes to improve retention."),
            })

        recent_missed = sum(e['tasks_missed'] for e in entries[-3:])
        if recent_missed >= 3:
            suggestions.append({
                'type': 'missed_tasks', 'priority': 'medium',
                'title': 'Reduce task misses',
                'message': (
                    f"You missed {recent_missed} tasks in the last 3 days. "
                    "Consider scheduling fewer tasks or shorter durations."),
            })

        if (ratio['content_non_educational'] > ratio['content_educational']
                and ratio['content_non_educational'] >= 3):
            suggestions.append({
                'type': 'content', 'priority': 'medium',
                'title': 'More non-educational content detected',
                'message': (
                    "Your browser activity shows more entertainment than educational material. "
                    "Use the content classifier to stay on task."),
            })

        if profiler:
            best_hrs = profiler.get_best_hours(2)
            worst_hrs = profiler.get_worst_hours(2)
            if best_hrs and worst_hrs and best_hrs[0]['rate'] > worst_hrs[0]['rate'] + 0.2:
                suggestions.append({
                    'type': 'scheduling', 'priority': 'low',
                    'title': 'Optimize your study schedule',
                    'message': (
                        f"Best hours: {', '.join(h['label'] for h in best_hrs)}. "
                        f"Worst hours: {', '.join(h['label'] for h in worst_hrs)}. "
                        "Schedule harder tasks during your peak hours."),
                })
            subj = profiler.get_subject_summary()
            if len(subj) >= 2:
                hardest = subj[-1]
                if hardest['completion_rate'] < 0.5:
                    suggestions.append({
                        'type': 'subject', 'priority': 'low',
                        'title': f"Struggling with {hardest['subject'].title()}",
                        'message': (
                            f"Completion rate for {hardest['subject'].title()} is "
                            f"{hardest['completion_rate']*100:.0f}%. "
                            "Break into smaller chunks and schedule during peak hours."),
                    })

        if not suggestions:
            if summary['trend_direction'] == 'improving':
                suggestions.append({
                    'type': 'positive', 'priority': 'info',
                    'title': 'Great improvement this week!',
                    'message': f"Completion rate improved by {summary['trend_delta']:.0f}%. Keep it up!",
                })
            else:
                suggestions.append({
                    'type': 'positive', 'priority': 'info',
                    'title': 'Consistent performance',
                    'message': "Study patterns are stable. Focus on reducing distraction events.",
                })

        return suggestions

    def get_full_analytics(self, profiler: 'ProductivityProfiler' = None) -> dict:
        return {
            'weekly_summary': self.get_weekly_summary(),
            'daily_trends': self.get_daily_trends(7),
            'completion_trend': self.get_completion_trend(7),
            'study_vs_distraction': self.get_study_vs_distraction(),
            'patterns': self.detect_patterns(),
            'suggestions': self.generate_suggestions(profiler),
        }


# ═══════════════════════════════════════════════════════════════
#  TASK MANAGER
# ═══════════════════════════════════════════════════════════════

class TaskManager:
    """Manages student tasks with persistent JSON storage."""

    def __init__(self):
        self.tasks = {}
        self.next_id = 1
        self.history = []
        self.tasks_file = os.path.join(DATA_DIR, 'tasks.json')
        self.history_file = os.path.join(DATA_DIR, 'task_history.json')
        self.streak_file = os.path.join(DATA_DIR, 'streaks.json')

        self.focus_streak = 0
        self.best_streak = 0
        self.total_focused_sessions = 0
        self.total_sessions = 0
        self.badges = []

        self._load_tasks()
        self._load_history()
        self._load_streaks()

    def _save_tasks(self):
        try:
            with open(self.tasks_file, 'w') as f:
                json.dump({'tasks': self.tasks, 'next_id': self.next_id}, f, indent=2)
        except Exception as e:
            print(f'[TaskManager] Failed to save tasks: {e}')

    def _load_tasks(self):
        if os.path.exists(self.tasks_file):
            try:
                with open(self.tasks_file, 'r') as f:
                    data = json.load(f)
                self.tasks = data.get('tasks', {})
                self.next_id = data.get('next_id', 1)
                print(f'[TaskManager] Loaded {len(self.tasks)} tasks from disk')
            except Exception as e:
                print(f'[TaskManager] Failed to load tasks: {e}')
                self.tasks = {}
                self.next_id = 1
        else:
            print('[TaskManager] No saved tasks found, starting fresh')

    def _save_history(self):
        """Save history, pruning records older than 7 days."""
        cutoff = datetime.now() - timedelta(days=7)
        pruned = []
        for t in self.history:
            ts_str = t.get('completed_at') or t.get('started_at') or t.get('created_at')
            try:
                ts = datetime.strptime(str(ts_str)[:19], '%Y-%m-%d %H:%M:%S')
                if ts >= cutoff:
                    pruned.append(t)
            except Exception:
                pruned.append(t)  # keep records with unparseable dates
        self.history = pruned
        try:
            with open(self.history_file, 'w') as f:
                json.dump(self.history, f, indent=2)
        except Exception as e:
            print(f'[TaskManager] Failed to save history: {e}')

    def _load_history(self):
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r') as f:
                    self.history = json.load(f)
                print(f'[TaskManager] Loaded {len(self.history)} history records')
            except Exception as e:
                print(f'[TaskManager] Failed to load history: {e}')
                self.history = []

    def _save_streaks(self):
        try:
            with open(self.streak_file, 'w') as f:
                json.dump({
                    'focus_streak': self.focus_streak,
                    'best_streak': self.best_streak,
                    'total_focused_sessions': self.total_focused_sessions,
                    'total_sessions': self.total_sessions,
                    'badges': self.badges,
                }, f, indent=2)
        except Exception as e:
            print(f'[TaskManager] Failed to save streaks: {e}')

    def _load_streaks(self):
        if os.path.exists(self.streak_file):
            try:
                with open(self.streak_file, 'r') as f:
                    data = json.load(f)
                self.focus_streak = data.get('focus_streak', 0)
                self.best_streak = data.get('best_streak', 0)
                self.total_focused_sessions = data.get('total_focused_sessions', 0)
                self.total_sessions = data.get('total_sessions', 0)
                self.badges = data.get('badges', [])
            except Exception as e:
                print(f'[TaskManager] Failed to load streaks: {e}')

    def update_streak(self, is_focused: bool):
        self.total_sessions += 1
        if is_focused:
            self.focus_streak += 1
            self.total_focused_sessions += 1
            if self.focus_streak > self.best_streak:
                self.best_streak = self.focus_streak
        else:
            self.focus_streak = 0
        new_badges = self._check_badges()
        self._save_streaks()
        return new_badges

    def _check_badges(self):
        completed_count = sum(1 for t in self.history if t.get('status') == 'completed')
        new_badges = []
        badge_rules = [
            {'id': 'first_focus', 'name': 'First Focus',
             'description': 'Completed your first focused session',
             'icon': 'star', 'condition': self.total_focused_sessions >= 1},
            {'id': 'streak_3', 'name': 'Hat Trick',
             'description': '3 focused sessions in a row',
             'icon': 'flame', 'condition': self.focus_streak >= 3},
            {'id': 'streak_5', 'name': 'Focus Master',
             'description': '5 focused sessions in a row',
             'icon': 'trophy', 'condition': self.focus_streak >= 5},
            {'id': 'streak_10', 'name': 'Unstoppable',
             'description': '10 focused sessions in a row',
             'icon': 'crown', 'condition': self.focus_streak >= 10},
            {'id': 'total_10', 'name': 'Dedicated Learner',
             'description': '10 total focused sessions',
             'icon': 'book', 'condition': self.total_focused_sessions >= 10},
            {'id': 'total_25', 'name': 'Study Champion',
             'description': '25 total focused sessions',
             'icon': 'medal', 'condition': self.total_focused_sessions >= 25},
            {'id': 'total_50', 'name': 'Academic Hero',
             'description': '50 total focused sessions',
             'icon': 'shield', 'condition': self.total_focused_sessions >= 50},
            {'id': 'tasks_5', 'name': 'Task Crusher',
             'description': 'Completed 5 tasks', 'icon': 'check-circle',
             'condition': completed_count >= 5},
            {'id': 'tasks_20', 'name': 'Productivity Machine',
             'description': 'Completed 20 tasks', 'icon': 'zap',
             'condition': completed_count >= 20},
        ]
        existing_ids = {b['id'] for b in self.badges}
        for rule in badge_rules:
            if rule['condition'] and rule['id'] not in existing_ids:
                badge = {
                    'id': rule['id'], 'name': rule['name'],
                    'description': rule['description'], 'icon': rule['icon'],
                    'earned_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                }
                self.badges.append(badge)
                new_badges.append(badge)
        return new_badges

    def get_streak_info(self):
        return {
            'focus_streak': self.focus_streak,
            'best_streak': self.best_streak,
            'total_focused_sessions': self.total_focused_sessions,
            'total_sessions': self.total_sessions,
            'focus_rate': round(self.total_focused_sessions / max(self.total_sessions, 1) * 100, 1),
            'badges': self.badges,
            'badge_count': len(self.badges),
        }

    def _parse_datetime(self, value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value.astimezone().replace(tzinfo=None) if value.tzinfo else value
        text = str(value).strip()
        if not text:
            return None
        for fmt in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M:%S.%f'):
            try:
                return datetime.strptime(text, fmt)
            except Exception:
                continue
        try:
            parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
            return parsed.astimezone().replace(tzinfo=None) if parsed.tzinfo else parsed
        except Exception:
            return None

    def _task_matches_today(self, task):
        today = datetime.now().date()
        for key in ('completed_at', 'session_started_at', 'started_at', 'created_at'):
            dt = self._parse_datetime(task.get(key))
            if dt and dt.date() == today:
                return True
        return False

    def add_task(self, subject, duration_minutes, priority='medium',
                 scheduled_slot=None, notes='', planned_start=None, planned_end=None):
        task_id = f'task_{self.next_id}'
        self.next_id += 1
        duration_minutes = int(duration_minutes or 0)
        task = {
            'id': task_id, 'subject': subject,
            'duration_minutes': duration_minutes, 'priority': priority,
            'scheduled_slot': scheduled_slot, 'planned_start': planned_start,
            'planned_end': planned_end, 'status': 'pending',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'started_at': None, 'session_started_at': None, 'completed_at': None,
            'rescheduled_from': None, 'rescheduled_to': None, 'reschedule_reason': None,
            'distraction_events': 0,
            'focus_score_avg': None,
            'focus_score_count': 0,
            'remaining_seconds': max(duration_minutes, 0) * 60,
            'studied_seconds': 0, 'notes': notes,
        }
        self.tasks[task_id] = task
        self._save_tasks()
        return task

    def get_task(self, task_id):
        return self.tasks.get(task_id)

    def get_all_tasks(self):
        return list(self.tasks.values())

    def get_pending_tasks(self):
        return [t for t in self.tasks.values() if t['status'] in ('pending', 'rescheduled')]

    def get_active_task(self):
        active = [t for t in self.tasks.values() if t['status'] == 'active']
        return active[0] if active else None

    def start_task(self, task_id):
        task = self.tasks.get(task_id)
        if not task:
            return None
        for other in self.tasks.values():
            if other['id'] != task_id and other.get('status') == 'active':
                other['status'] = 'pending'
                other['session_started_at'] = None
        task['status'] = 'active'
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        if not task.get('started_at'):
            task['started_at'] = now
        task['session_started_at'] = now
        if task.get('remaining_seconds') is None:
            task['remaining_seconds'] = max(int(task.get('duration_minutes') or 0), 0) * 60
        self._save_tasks()
        return task

    def pause_task(self, task_id, remaining_seconds=None, elapsed_seconds=None):
        task = self.tasks.get(task_id)
        if not task:
            return None
        studied = max(int(elapsed_seconds or 0), 0)
        if studied:
            task['studied_seconds'] = max(int(task.get('studied_seconds') or 0), 0) + studied
        if remaining_seconds is None:
            total_seconds = max(int(task.get('duration_minutes') or 0), 0) * 60
            remaining_seconds = max(total_seconds - int(task.get('studied_seconds') or 0), 0)
        task['remaining_seconds'] = max(int(remaining_seconds or 0), 0)
        task['status'] = 'pending' if not task.get('rescheduled_to') else 'rescheduled'
        task['session_started_at'] = None
        self._save_tasks()
        return task

    def resume_task(self, task_id):
        task = self.tasks.get(task_id)
        if not task:
            return None
        if task.get('remaining_seconds') is None:
            task['remaining_seconds'] = max(int(task.get('duration_minutes') or 0), 0) * 60
        task['status'] = 'active'
        task['session_started_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self._save_tasks()
        return task

    def complete_task(self, task_id, elapsed_seconds=None):
        task = self.tasks.get(task_id)
        if not task:
            return None
        studied = max(int(elapsed_seconds or 0), 0)
        if studied:
            task['studied_seconds'] = max(int(task.get('studied_seconds') or 0), 0) + studied
        task['status'] = 'completed'
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        task['completed_at'] = now_str
        task['remaining_seconds'] = 0
        task['session_started_at'] = None
        # Record actual start time (when user clicked Start) and compute actual duration
        if not task.get('actual_started_at'):
            task['actual_started_at'] = task.get('started_at') or now_str
        task['actual_completed_at'] = now_str
        try:
            t_start = datetime.strptime(task['actual_started_at'][:19], '%Y-%m-%d %H:%M:%S')
            t_end = datetime.strptime(task['actual_completed_at'][:19], '%Y-%m-%d %H:%M:%S')
            wall_clock_seconds = max(0, int((t_end - t_start).total_seconds()))
        except Exception:
            wall_clock_seconds = 0
        # Prefer tracked timer seconds; wall-clock as fallback
        actual_secs = int(task.get('studied_seconds') or 0) or wall_clock_seconds
        task['actual_duration_seconds'] = actual_secs
        self.history.append({**task})
        self._save_tasks()
        self._save_history()
        return task

    def miss_task(self, task_id, reason='distraction'):
        task = self.tasks.get(task_id)
        if not task:
            return None
        task['status'] = 'missed'
        task['reschedule_reason'] = reason
        task['session_started_at'] = None
        self.history.append({**task})
        self._save_tasks()
        self._save_history()
        return task

    def reschedule_task(self, task_id, new_slot, reason='distraction_detected',
                        planned_start=None, planned_end=None):
        task = self.tasks.get(task_id)
        if not task:
            return None
        task['rescheduled_from'] = task['scheduled_slot']
        task['rescheduled_to'] = new_slot
        task['scheduled_slot'] = new_slot
        if planned_start is not None:
            task['planned_start'] = planned_start
        if planned_end is not None:
            task['planned_end'] = planned_end
        task['status'] = 'rescheduled'
        task['reschedule_reason'] = reason
        self._save_tasks()
        return task

    def record_distraction_event(self, task_id):
        task = self.tasks.get(task_id)
        if task:
            task['distraction_events'] = task.get('distraction_events', 0) + 1
            self._save_tasks()

    def update_focus_score(self, task_id, focus_score):
        """True running mean using stored count."""
        task = self.tasks.get(task_id)
        if task:
            cur = task.get('focus_score_avg')
            count = int(task.get('focus_score_count') or 0)
            if cur is None:
                task['focus_score_avg'] = round(float(focus_score), 4)
                task['focus_score_count'] = 1
            else:
                count += 1
                task['focus_score_avg'] = round(
                    (cur * (count - 1) + float(focus_score)) / count, 4)
                task['focus_score_count'] = count
            self._save_tasks()

    def get_stats(self):
        all_tasks = list(self.tasks.values())
        completed = [t for t in all_tasks if t['status'] == 'completed']
        missed = [t for t in all_tasks if t['status'] == 'missed']
        rescheduled = [t for t in all_tasks if t['status'] == 'rescheduled']
        pending = [t for t in all_tasks if t['status'] in ('pending', 'rescheduled')]
        active = [t for t in all_tasks if t['status'] == 'active']
        return {
            'total': len(all_tasks),
            'completed': len(completed),
            'missed': len(missed),
            'rescheduled': len(rescheduled),
            'pending': len(pending),
            'active': len(active),
            'completion_rate': round(len(completed) / max(len(all_tasks), 1) * 100, 1),
        }

    def get_today_study_seconds(self):
        total = 0
        for task in self.tasks.values():
            if self._task_matches_today(task):
                total += int(task.get('studied_seconds') or 0)
        return total

    def get_missed_tasks(self, grace_seconds: int = 60, max_overdue_hours: int = 24):
        """Returns tasks overdue between grace_seconds and max_overdue_hours."""
        now = datetime.now()
        results = []
        for task in self.tasks.values():
            if task.get('status') not in ('pending', 'rescheduled'):
                continue
            planned_start = self._parse_datetime(task.get('planned_start'))
            if not planned_start:
                continue
            overdue_seconds = (now - planned_start).total_seconds()
            if grace_seconds <= overdue_seconds <= max_overdue_hours * 3600:
                results.append(task)
        return results

    def delete_task(self, task_id):
        if task_id in self.tasks:
            del self.tasks[task_id]
            self._save_tasks()
            return True
        return False

    def get_session_history(self):
        return {
            'completed_sessions': [t for t in self.history if t.get('status') == 'completed'],
            'missed_sessions': [t for t in self.history if t.get('status') == 'missed'],
            'total_study_minutes': sum(
                t.get('duration_minutes', 0) for t in self.history
                if t.get('status') == 'completed'),
            'total_sessions': len(self.history),
        }


# ═══════════════════════════════════════════════════════════════
#  ADAPTIVE PLANNER
# ═══════════════════════════════════════════════════════════════

class AdaptivePlanner:
    """
    Predicts task completion probability using a Random Forest trained on
    student habits data. Integrates distraction-aware rescheduling,
    productivity profiling, trend analytics, and content classification.
    """

    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_columns = None
        self.model_path = os.path.join(SAVE_DIR, 'adaptive_planner_model.pkl')
        self.scaler_path = os.path.join(SAVE_DIR, 'planner_scaler.pkl')
        self.columns_path = os.path.join(SAVE_DIR, 'planner_columns.pkl')

        self.task_manager = TaskManager()
        self.profiler = ProductivityProfiler()
        self.trend_analyzer = TrendAnalyzer()

        self.social_alert_count = 0
        self.distraction_streak = 0
        self.last_distraction_state = None

        # Smart suggestion cooldown: track last probability and timestamp
        # so we don't fire repeated distraction alerts within 20 minutes.
        self._last_suggestion_prob = None
        self._last_suggestion_time = None

        self.feedback_messages = {
            'recovery': [
                "You seem tired. Take 5 minutes to reset, then continue with an easier task.",
                "Rest is productive too. Take a short break and come back refreshed.",
                "Consider switching to a lighter task to rebuild momentum.",
            ],
            'focused': [
                "Great focus! Keep the momentum going.",
                "You're in the zone — stay consistent!",
                "Excellent concentration. Your effort is paying off.",
            ],
            'distracted': [
                "It looks like you got distracted. Try closing unnecessary tabs.",
                "Distraction detected. Take a breath and refocus on your task.",
                "Stay on track! Minimize distractions for the next 25 minutes.",
            ],
            'social_media': [
                "Social media detected. Consider enabling the site blocker.",
                "You've been on social media. Redirect to your study material.",
                "Social media can wait — your deadline can't.",
            ],
            'reschedule': [
                "Task rescheduled to a better time. You can do this!",
                "No worries — your task has been moved to a slot where you perform better.",
                "Rescheduled successfully. Make the most of your next study window.",
            ],
            'complete': [
                "Task completed! Well done — take a short break before the next one.",
                "Great job finishing on time! Keep building that streak.",
                "One down! Your productivity is building momentum.",
            ],
        }

        self._load_model()

    # ── Model Persistence ────────────────────────────────────────

    def _load_model(self):
        if (os.path.exists(self.model_path)
                and os.path.exists(self.scaler_path)
                and os.path.exists(self.columns_path)):
            try:
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.feature_columns = joblib.load(self.columns_path)
                print(f'[AdaptivePlanner] Model loaded ({len(self.feature_columns)} features)')
            except Exception as e:
                print(f'[AdaptivePlanner] Failed to load model: {e}')
                self.model = None
        else:
            print('[AdaptivePlanner] No saved model found – call train_model() first.')

    def _save_model(self):
        try:
            joblib.dump(self.model, self.model_path)
            joblib.dump(self.scaler, self.scaler_path)
            joblib.dump(self.feature_columns, self.columns_path)
            print('[AdaptivePlanner] Model saved.')
        except Exception as e:
            print(f'[AdaptivePlanner] Failed to save model: {e}')

    # ── Training ─────────────────────────────────────────────────

    def train_model(self, csv_path: str = None) -> dict:
        """Train Random Forest on student_habits_performance.csv."""
        if csv_path is None:
            csv_path = os.path.join(os.path.dirname(__file__), 'student_habits_performance.csv')

        try:
            df = pd.read_csv(csv_path)
        except Exception as e:
            return {'success': False, 'error': f'Failed to load CSV: {e}'}

        if 'exam_score' not in df.columns:
            return {'success': False, 'error': 'Column "exam_score" not found in CSV.'}

        median_score = df['exam_score'].median()
        df['target'] = (df['exam_score'] >= median_score).astype(int)

        social_cols = [c for c in df.columns if 'social' in c.lower() and c != 'total_social_hours']
        if 'total_social_hours' not in df.columns and social_cols:
            df['total_social_hours'] = df[social_cols].sum(axis=1)
        elif 'total_social_hours' not in df.columns:
            df['total_social_hours'] = 0.0

        features = [
            'age',
            'gender',
            'part_time_job',
            'study_hours_per_day',
            'sleep_hours',
            'total_social_hours',
        ]
        available = [f for f in features if f in df.columns]
        if not available:
            return {'success': False, 'error': 'No usable planner feature columns found.'}

        X = df[available].copy()
        numeric_available = [c for c in NUMERIC_COLS if c in X.columns]
        if numeric_available:
            X[numeric_available] = X[numeric_available].fillna(X[numeric_available].median())

        cat_cols = [c for c in ('gender', 'part_time_job') if c in X.columns]
        if cat_cols:
            X = pd.get_dummies(X, columns=cat_cols, drop_first=True)

        y = df['target']

        if HAS_SMOTE:
            try:
                X, y = SMOTE(random_state=42).fit_resample(X, y)
                print('[AdaptivePlanner] SMOTE applied.')
            except Exception as e:
                print(f'[AdaptivePlanner] SMOTE failed, proceeding without: {e}')

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y)

        scaler = StandardScaler()
        X_train_s = X_train.copy()
        X_test_s = X_test.copy()
        scale_cols = [c for c in NUMERIC_COLS if c in X_train_s.columns]
        if scale_cols:
            X_train_s.loc[:, scale_cols] = scaler.fit_transform(X_train_s[scale_cols])
            X_test_s.loc[:, scale_cols] = scaler.transform(X_test_s[scale_cols])

        clf = RandomForestClassifier(
            n_estimators=200, max_depth=8, min_samples_split=4,
            class_weight='balanced', random_state=42, n_jobs=-1)
        clf.fit(X_train_s, y_train)

        acc = accuracy_score(y_test, clf.predict(X_test_s))
        self.model = clf
        self.scaler = scaler
        self.feature_columns = list(X.columns)
        self._save_model()

        print(f'[AdaptivePlanner] Training complete. Test accuracy: {acc:.3f}')
        return {
            'success': True,
            'accuracy': round(float(acc), 4),
            'features': feature_cols,
            'train_samples': len(X_train),
            'test_samples': len(X_test),
            'smote_applied': HAS_SMOTE,
            'note': (
                'Target is exam_score >= median. This is a proxy for task-completion '
                'probability. Re-train when real completion data is collected.'
            ),
        }

    # ── Prediction ───────────────────────────────────────────────

    def _prepare_prediction_features(self, user_data: dict) -> pd.DataFrame:
        """
        Build a single-row feature frame aligned to the saved planner model.
        Supports both numeric-only models and older models that include
        one-hot categorical columns.
        """
        row = {}

        for col in NUMERIC_COLS:
            try:
                row[col] = float(user_data.get(col, 0.0) or 0.0)
            except (TypeError, ValueError):
                row[col] = 0.0

        gender = str(user_data.get('gender', '') or '').strip()
        part_time_job = str(user_data.get('part_time_job', '') or '').strip()
        row['gender_Male'] = 1 if gender == 'Male' else 0
        row['gender_Other'] = 1 if gender == 'Other' else 0
        row['part_time_job_Yes'] = 1 if part_time_job == 'Yes' else 0

        df = pd.DataFrame([row])
        expected_cols = list(self.feature_columns or [])
        if expected_cols:
            for col in expected_cols:
                if col not in df.columns:
                    df[col] = 0
            df = df[expected_cols]

        scale_cols = [c for c in NUMERIC_COLS if c in df.columns]
        if scale_cols and self.scaler is not None:
            df.loc[:, scale_cols] = self.scaler.transform(df[scale_cols])

        return df

    def _model_supports_profile_inputs(self) -> bool:
        expected = {'gender_Male', 'part_time_job_Yes'}
        return expected.issubset(set(self.feature_columns or []))

    def _study_fatigue_probability(self, study_hours: float) -> float:
        study_hours = max(0.0, float(study_hours or 0.0))
        fatigue_score = 0.98 - (0.03 * study_hours) - (0.003 * (study_hours ** 2))
        return max(0.05, min(fatigue_score, 0.98))

    def _generate_feedback(self, probability: float, user_data: dict,
                           distraction_state: dict = None,
                           recommendation: str = 'proceed') -> dict:
        sleep = float(user_data.get('sleep_hours', 7) or 7)
        social = float(user_data.get('total_social_hours', 0) or 0)
        app_label = str((distraction_state or {}).get('app_cat_label', '')).lower()

        if recommendation == 'reschedule':
            feedback_type = 'reschedule'
            message = random.choice(self.feedback_messages['reschedule'])
            suggested_action = 'Review the suggested new slot and restart with a shorter block'
        elif distraction_state and distraction_state.get('label') == 'DISTRACTED':
            if 'social' in app_label or 'entertainment' in app_label:
                feedback_type = 'social_media'
                message = random.choice(self.feedback_messages['social_media'])
                suggested_action = 'Leave the distracting app and enable blocking if needed'
            else:
                feedback_type = 'distracted'
                message = random.choice(self.feedback_messages['distracted'])
                suggested_action = 'Close distracting apps and do a short refocus sprint'
        elif sleep < 5:
            feedback_type = 'recovery'
            message = random.choice(self.feedback_messages['recovery'])
            suggested_action = 'Take a short break or switch to a lighter task first'
        elif probability >= 0.7:
            feedback_type = 'focused'
            message = random.choice(self.feedback_messages['focused'])
            suggested_action = 'Continue with your plan'
        elif social > 3:
            feedback_type = 'social_media'
            message = random.choice(self.feedback_messages['social_media'])
            suggested_action = 'Reduce social time before the next session'
        else:
            feedback_type = 'recovery'
            message = random.choice(self.feedback_messages['recovery'])
            suggested_action = 'Do the next task with a smaller goal'

        return {
            'feedback_type': feedback_type,
            'message': message,
            'suggested_action': suggested_action,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }

    def predict(self, user_data: dict, task: dict = None,
                distraction_state: dict = None, content_state: dict = None) -> dict:
        """Predict completion probability for a given user context."""

        # ── Zero-input guard ────────────────────────────────────────
        # When the user has not entered meaningful data (all activity
        # values are zero / near-zero), the model would produce a
        # misleading non-zero probability.  Return 0 immediately.
        _study = float(user_data.get('study_hours_per_day', 0) or 0)
        _sleep = float(user_data.get('sleep_hours', 0) or 0)
        _social = float(user_data.get('total_social_hours', 0) or 0)
        _all_zero = (_study < 0.01 and _sleep < 0.01 and _social < 0.01)

        if _all_zero:
            zero_feedback = {
                'feedback_type': 'recovery',
                'message': 'Enter your study, sleep, and social hours to get a meaningful prediction.',
                'suggested_action': 'Fill in the planner inputs above to generate your plan.',
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            }
            return {
                'success': True,
                'base_probability': 0.0,
                'adjusted_probability': 0.0,
                'completion_probability': 0.0,
                'prediction': 0,
                'task_completion_probability': 0.0,
                'original_probability': 0.0,
                'rule_based_probability': 0.0,
                'blended_probability': 0.0,
                'planner_decision': 'Fill in the planner inputs to generate a prediction.',
                'new_slot': None,
                'recommendation': 'no_data',
                'confidence_tier': 'none',
                'distraction_penalty': 0.0,
                'distraction_adjustment': 0.0,
                'content_penalty': 0.0,
                'profiler_adjustment': 0.0,
                'feedback': zero_feedback,
                'social_alert': None,
                'reschedule': None,
                'reschedule_info': None,
                'distraction_streak': self.distraction_streak,
                'social_alert_count': self.social_alert_count,
                'task_stats': self.task_manager.get_stats(),
                'streak_info': self.task_manager.get_streak_info(),
                'distraction_aware': distraction_state is not None,
                'live_distraction': (
                    {
                        'is_distracted': distraction_state.get('is_distracted', False),
                        'confidence': distraction_state.get('confidence', 0),
                        'dominant_app': distraction_state.get('dominant_app', 'unknown'),
                        'streak': self.distraction_streak,
                    }
                    if distraction_state else None
                ),
            }
        # ── End zero-input guard ────────────────────────────────────

        if self.model is None or not self._model_supports_profile_inputs():
            trained = self.train_model()
            if not trained.get('success'):
                return {
                    'success': False,
                    'error': trained.get('error', 'Model not trained.'),
                    'completion_probability': 0.5,
                }

        X_prepared = self._prepare_prediction_features(user_data)
        model_prob = float(self.model.predict_proba(X_prepared)[0][1])
        original_prob = model_prob

        study_hours = float(user_data.get('study_hours_per_day', 0) or 0)
        sleep_hours = float(user_data.get('sleep_hours', 0) or 0)
        social_hours = float(user_data.get('total_social_hours', 0) or 0)

        study_prob = self._study_fatigue_probability(study_hours)
        sleep_adjustment = (sleep_hours - 7.0) * 0.035
        social_adjustment = social_hours * 0.11
        rule_prob = max(0.0, min(study_prob + sleep_adjustment - social_adjustment, 1.0))

        blended_prob = (0.15 * model_prob) + (0.85 * rule_prob)

        distraction_penalty = 0.0
        if distraction_state and distraction_state.get('is_distracted'):
            distraction_penalty = float(distraction_state.get('confidence', 0) or 0) * 0.30

        content_penalty = 0.0
        if content_state:
            if not content_state.get('is_educational', True):
                content_penalty = 0.05

        adjusted_prob = float(
            np.clip(blended_prob - distraction_penalty - content_penalty, 0.05, 0.98)
        )

        now = datetime.now()
        hour_rate = self.profiler.get_hourly_rate(now.hour)
        dow_rate = self.profiler.get_dow_rate(now.weekday())
        profiler_adj = (hour_rate - 0.5) * 0.10 + (dow_rate - 0.5) * 0.05
        adjusted_prob = float(np.clip(adjusted_prob + profiler_adj, 0.05, 0.98))

        if adjusted_prob >= 0.70:
            recommendation = 'proceed'
            tier = 'high'
        elif adjusted_prob >= 0.40:
            recommendation = 'caution'
            tier = 'medium'
        else:
            recommendation = 'reschedule'
            tier = 'low'

        if distraction_state and distraction_state.get('label') == 'DISTRACTED':
            self.distraction_streak += 1
        else:
            self.distraction_streak = 0

        self.last_distraction_state = distraction_state

        active_task = task or self.task_manager.get_active_task()
        new_badges = self.task_manager.update_streak(adjusted_prob >= 0.5)
        if active_task and distraction_state:
            focus_score = 1 - float(distraction_state.get('final_prob', 0.5) or 0.5)
            self.task_manager.update_focus_score(active_task['id'], focus_score)
            if distraction_state.get('is_distracted'):
                self.task_manager.record_distraction_event(active_task['id'])

        reschedule_info = None
        if recommendation == 'reschedule' and active_task:
            reschedule_info = self._compute_reschedule(active_task, adjusted_prob)

        prediction = int(adjusted_prob >= 0.5)
        planner_decision = 'Continue current task'
        new_slot = None

        if reschedule_info:
            new_slot = reschedule_info.get('suggested_slot')
            subject = active_task.get('subject', 'Current task') if active_task else 'Current task'
            planner_decision = f'Task "{subject}" should be moved to a better slot'
        elif recommendation == 'caution':
            planner_decision = 'Continue with shorter focus blocks'
        elif recommendation == 'reschedule':
            planner_decision = 'Ask user whether to rest and reschedule'

        feedback_payload = self._generate_feedback(
            adjusted_prob,
            user_data,
            distraction_state=distraction_state,
            recommendation=recommendation,
        )

        social_alert = None
        app_label = str((distraction_state or {}).get('app_cat_label', '')).lower()
        if social_hours > 1 or (
            distraction_state and distraction_state.get('label') == 'DISTRACTED' and
            ('social' in app_label or 'entertainment' in app_label)
        ):
            self.social_alert_count += 1
            if social_hours > 1 or 'social' in app_label or 'entertainment' in app_label:
                social_alert = {
                    'type': 'social_media_alert',
                    'message': feedback_payload['message'],
                    'suggested_action': feedback_payload['suggested_action'],
                    'alert_count': self.social_alert_count,
                }

        result = {
            'success': True,
            'base_probability': round(model_prob, 4),
            'adjusted_probability': round(adjusted_prob, 4),
            'completion_probability': round(adjusted_prob, 4),
            'prediction': prediction,
            'task_completion_probability': round(adjusted_prob, 4),
            'original_probability': round(original_prob, 4),
            'rule_based_probability': round(rule_prob, 4),
            'blended_probability': round(blended_prob, 4),
            'planner_decision': planner_decision,
            'new_slot': new_slot,
            'recommendation': recommendation,
            'confidence_tier': tier,
            'distraction_penalty': round(distraction_penalty, 4),
            'distraction_adjustment': round(distraction_penalty, 4),
            'content_penalty': round(content_penalty, 4),
            'profiler_adjustment': round(profiler_adj, 4),
            'feedback': feedback_payload,
            'social_alert': social_alert,
            'reschedule': reschedule_info,
            'reschedule_info': (
                {
                    'task_subject': active_task.get('subject', 'Current task'),
                    'new_slot': reschedule_info.get('suggested_slot'),
                    'planned_start': reschedule_info.get('planned_start'),
                    'planned_end': reschedule_info.get('planned_end'),
                    'reason': reschedule_info.get('reason'),
                    'message': reschedule_info.get('message'),
                }
                if reschedule_info and active_task else None
            ),
            'distraction_streak': self.distraction_streak,
            'social_alert_count': self.social_alert_count,
            'task_stats': self.task_manager.get_stats(),
            'streak_info': self.task_manager.get_streak_info(),
            'distraction_aware': distraction_state is not None,
            'live_distraction': (
                {
                    'is_distracted': distraction_state.get('is_distracted', False),
                    'confidence': distraction_state.get('confidence', 0),
                    'dominant_app': distraction_state.get('dominant_app', 'unknown'),
                    'streak': self.distraction_streak,
                }
                if distraction_state else None
            ),
        }

        if new_badges:
            result['new_badges'] = new_badges

        return result

    # ── Rescheduling ─────────────────────────────────────────────

    def _compute_reschedule(self, task: dict, current_prob: float) -> dict:
        """Compute the best reschedule slot for a task."""
        now = datetime.now()
        duration = int(task.get('duration_minutes') or 30)
        priority = task.get('priority', 'medium')
        subject = task.get('subject', '')

        candidates = []
        for offset_mins in range(30, 8 * 60 + 1, 30):
            slot_dt = now + timedelta(minutes=offset_mins)
            candidates.append(slot_dt.strftime('%H:%M'))

        best_slot = self.profiler.get_optimal_slot(candidates, subject=subject, priority=priority)

        if best_slot:
            slot_dt = datetime.strptime(
                now.strftime('%Y-%m-%d') + ' ' + best_slot, '%Y-%m-%d %H:%M')
            if slot_dt <= now:
                slot_dt += timedelta(days=1)
            planned_start = slot_dt.strftime('%Y-%m-%d %H:%M:%S')
            planned_end = (slot_dt + timedelta(minutes=duration)).strftime('%Y-%m-%d %H:%M:%S')
            hour_rate = self.profiler.get_hourly_rate(slot_dt.hour)
            expected_improvement = max(0.0, hour_rate - current_prob)
        else:
            slot_dt = now + timedelta(hours=1)
            best_slot = slot_dt.strftime('%H:%M')
            planned_start = slot_dt.strftime('%Y-%m-%d %H:%M:%S')
            planned_end = (slot_dt + timedelta(minutes=duration)).strftime('%Y-%m-%d %H:%M:%S')
            expected_improvement = 0.0

        return {
            'suggested_slot': best_slot,
            'planned_start': planned_start,
            'planned_end': planned_end,
            'reason': 'Low completion probability at current time',
            'expected_improvement': round(expected_improvement, 3),
            'message': random.choice(self.feedback_messages['reschedule']),
        }

    def auto_reschedule_task(self, task_id: str, distraction_state: dict = None) -> dict:
        """Auto-reschedule a task when distraction is detected or probability is low."""
        task = self.task_manager.get_task(task_id)
        if not task:
            return {'success': False, 'error': f'Task {task_id} not found.'}

        reschedule_info = self._compute_reschedule(
            task, current_prob=float((distraction_state or {}).get('final_prob', 0.4)))

        updated = self.task_manager.reschedule_task(
            task_id,
            new_slot=reschedule_info['suggested_slot'],
            reason='distraction_detected',
            planned_start=reschedule_info['planned_start'],
            planned_end=reschedule_info['planned_end'],
        )

        return {'success': True, 'task': updated, 'reschedule': reschedule_info}

    # ── Task Wrappers (called by api_server.py) ───────────────────

    def complete_task(self, task_id: str, elapsed_seconds: int = None) -> dict:
        """
        Complete a task and update profiler + trend analyzer.
        api_server calls planner.complete_task() — this is that method.
        """
        task = self.task_manager.complete_task(task_id, elapsed_seconds=elapsed_seconds)
        if task:
            self.profiler.record_completion(task, completed=True)
            self.trend_analyzer.record_task_completed(task)
            self.task_manager.update_streak(is_focused=True)
        return task

    def miss_task(self, task_id: str, reason: str = 'distraction') -> dict:
        """
        Mark task missed and update profiler + trend analyzer.
        api_server calls planner.miss_task() — this is that method.
        """
        task = self.task_manager.miss_task(task_id, reason=reason)
        if task:
            self.profiler.record_completion(task, completed=False)
            self.trend_analyzer.record_task_missed(task)
            self.task_manager.update_streak(is_focused=False)
        return task

    def record_task_outcome(self, task_id: str, completed: bool):
        """Call after complete_task or miss_task to update profiler and trends."""
        task = self.task_manager.get_task(task_id)
        if not task:
            task = next((t for t in self.task_manager.history if t['id'] == task_id), None)
        if not task:
            return
        self.profiler.record_completion(task, completed=completed)
        if completed:
            self.trend_analyzer.record_task_completed(task)
        else:
            self.trend_analyzer.record_task_missed(task)

    # ── Content & Distraction Helpers (called by api_server.py) ──

    def analyze_content_context(self, content_result: dict) -> dict:
        """
        Analyze a content classification result and return a planner context summary.
        api_server calls planner.analyze_content_context() — this is that method.
        """
        if not content_result:
            return {'context': 'unknown', 'suggestion': None}

        is_edu = content_result.get('is_educational', True)
        label = content_result.get('label', 'unknown')
        confidence = float(content_result.get('confidence', 0.0))

        if is_edu:
            context = 'educational'
            suggestion = None
        else:
            context = 'non_educational'
            if confidence >= 0.7:
                suggestion = (
                    "You are browsing non-educational content during a study session. "
                    "Consider switching to your study material."
                )
            else:
                suggestion = "Some non-educational content detected. Stay focused on your task."

        self.trend_analyzer.record_content_event(is_educational=is_edu)

        return {
            'context': context,
            'is_educational': is_edu,
            'label': label,
            'confidence': round(confidence, 4),
            'suggestion': suggestion,
        }

    def _check_distraction_reschedule(self, distraction_state: dict,
                                       schedule_data: list,
                                       active_task: dict) -> dict:
        """
        Return a reschedule dict if the active task should be moved due to distraction,
        else return None.
        api_server calls planner._check_distraction_reschedule() — this is that method.
        """
        if not distraction_state or not active_task:
            return None

        final_prob = float(distraction_state.get('final_prob', 0.0))
        streak = int(distraction_state.get('distraction_streak', 0))

        if final_prob >= 0.75 and streak >= 3:
            return self._compute_reschedule(active_task, current_prob=final_prob)

        return None

    # ── Analytics Helpers ─────────────────────────────────────────

    def get_analytics(self) -> dict:
        return self.trend_analyzer.get_full_analytics(self.profiler)

    def get_profile(self) -> dict:
        return self.profiler.get_profile_summary()

    def get_smart_schedule(self, tasks: list = None) -> list:
        """
        Sort tasks by predicted success probability using the profiler.
        Defaults to all pending tasks when called with no argument
        (api_server calls planner.get_smart_schedule() with no args).
        """
        if tasks is None:
            tasks = self.task_manager.get_pending_tasks()

        now = datetime.now()
        scored = []
        for task in tasks:
            subject = task.get('subject', '')
            priority = task.get('priority', 'medium')
            hour_rate = self.profiler.get_hourly_rate(now.hour)
            subj_rate = self.profiler.get_subject_rate(subject)
            p_weight = {'high': 1.5, 'medium': 1.0, 'low': 0.6}.get(priority, 1.0)
            score = (hour_rate * 0.5 + subj_rate * 0.3) * p_weight
            scored.append({**task, '_score': round(score, 4)})

        scored.sort(key=lambda t: t['_score'], reverse=True)
        for t in scored:
            t.pop('_score', None)
        return scored

    def health_check(self) -> dict:
        return {
            'model_loaded': self.model is not None,
            'features': self.feature_columns or [],
            'has_smote': HAS_SMOTE,
            'task_count': len(self.task_manager.tasks),
            'history_count': len(self.task_manager.history),
            'profiler_data_points': sum(
                v[1] for v in self.profiler.hourly_completion.values()),
            'trend_days': len(self.trend_analyzer.daily),
        }
