import os
import json
import random
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

SAVE_DIR = os.path.join(os.path.dirname(__file__), 'saved_models')
os.makedirs(SAVE_DIR, exist_ok=True)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

NUMERIC_COLS = ['age', 'study_hours_per_day', 'sleep_hours', 'total_social_hours']

# Day-of-week index → name
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
        # {hour_str: [completed, total]}  e.g. {"9": [5, 7]}
        self.hourly_completion = {}
        # {dow_str: [completed, total]}  e.g. {"0": [3, 4]} (0=Monday)
        self.dow_completion = {}
        # {subject_lower: [completed, total, total_duration_min]}
        self.subject_performance = {}
        self._load()

    # ── Persistence ─────────────────────────────────────────────

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

    # ── Recording ───────────────────────────────────────────────

    def record_completion(self, task: dict, completed: bool):
        """Record a task outcome to update the profiler stats."""
        subject = (task.get('subject') or 'unknown').lower().strip()

        # Determine hour and day-of-week from started_at or completed_at
        ts = task.get('completed_at') or task.get('started_at')
        hour = None
        dow = None
        if ts:
            try:
                dt = datetime.strptime(ts[:19], '%Y-%m-%d %H:%M:%S')
                hour = dt.hour
                dow = dt.weekday()  # 0=Monday
            except Exception:
                pass
        # Fallback: parse scheduled_slot time
        if hour is None:
            slot = task.get('scheduled_slot') or ''
            try:
                if ':' in slot and len(slot) <= 5:
                    hour = int(slot.split(':')[0])
            except Exception:
                pass

        # Hourly stats
        if hour is not None:
            h = str(hour)
            if h not in self.hourly_completion:
                self.hourly_completion[h] = [0, 0]
            self.hourly_completion[h][1] += 1
            if completed:
                self.hourly_completion[h][0] += 1

        # Day-of-week stats
        if dow is not None:
            d = str(dow)
            if d not in self.dow_completion:
                self.dow_completion[d] = [0, 0]
            self.dow_completion[d][1] += 1
            if completed:
                self.dow_completion[d][0] += 1

        # Subject stats
        dur = float(task.get('duration_minutes') or 0)
        if subject not in self.subject_performance:
            self.subject_performance[subject] = [0, 0, 0.0]  # [completed, total, total_duration]
        self.subject_performance[subject][1] += 1
        self.subject_performance[subject][2] += dur
        if completed:
            self.subject_performance[subject][0] += 1

        self._save()

    # ── Query ────────────────────────────────────────────────────

    def get_hourly_rate(self, hour: int) -> float:
        """Completion rate for the given hour (0-23). Returns 0.5 if no data."""
        data = self.hourly_completion.get(str(hour))
        if not data or data[1] < 2:
            return 0.5
        return data[0] / data[1]

    def get_dow_rate(self, dow: int) -> float:
        """Completion rate for the given day-of-week (0=Monday). Returns 0.5 if no data."""
        data = self.dow_completion.get(str(dow))
        if not data or data[1] < 2:
            return 0.5
        return data[0] / data[1]

    def get_subject_rate(self, subject: str) -> float:
        """Completion rate for a subject. Returns 0.5 if no data."""
        key = (subject or '').lower().strip()
        data = self.subject_performance.get(key)
        if not data or data[1] < 1:
            return 0.5
        return data[0] / data[1]

    def get_optimal_slot(self, candidate_slots: list, subject: str = None,
                         priority: str = 'medium') -> str:
        """
        Score candidate time slots and return the best one.
        High-priority tasks go to the student's best hours.
        Falls back to first slot if no profiler data.
        """
        if not candidate_slots:
            return None

        today_dow = datetime.now().weekday()
        dow_rate = self.get_dow_rate(today_dow)

        has_data = any(
            self.hourly_completion.get(str(s.split(':')[0]), [0, 0])[1] >= 2
            for s in candidate_slots
            if ':' in s
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

            # Priority modifier: high → strongly prefer best hours
            if priority == 'high':
                p_weight = 0.6
            elif priority == 'low':
                p_weight = 0.3
            else:
                p_weight = 0.45

            # Subject difficulty modifier: struggling subject → prefer peak hours
            # good subject → more tolerant of off-peak
            subj_factor = 1.0 + (0.5 - subject_rate) * 0.4  # harder subject = higher multiplier

            base = hr * p_weight + dow_rate * 0.2 + subject_rate * 0.1
            return base * subj_factor

        return max(candidate_slots, key=score)

    def get_best_hours(self, n: int = 3) -> list:
        """Return top n hours sorted by completion rate (minimum 2 samples)."""
        ranked = []
        for h_str, (comp, total) in self.hourly_completion.items():
            if total >= 2:
                ranked.append({
                    'hour': int(h_str),
                    'label': f'{int(h_str):02d}:00',
                    'rate': round(comp / total, 3),
                    'total_tasks': total,
                })
        ranked.sort(key=lambda x: x['rate'], reverse=True)
        return ranked[:n]

    def get_worst_hours(self, n: int = 3) -> list:
        """Return n worst hours (minimum 2 samples)."""
        ranked = []
        for h_str, (comp, total) in self.hourly_completion.items():
            if total >= 2:
                ranked.append({
                    'hour': int(h_str),
                    'label': f'{int(h_str):02d}:00',
                    'rate': round(comp / total, 3),
                    'total_tasks': total,
                })
        ranked.sort(key=lambda x: x['rate'])
        return ranked[:n]

    def get_best_days(self, n: int = 3) -> list:
        """Return top n days-of-week by completion rate."""
        ranked = []
        for d_str, (comp, total) in self.dow_completion.items():
            if total >= 2:
                ranked.append({
                    'dow': int(d_str),
                    'day': _DOW_NAMES[int(d_str)],
                    'rate': round(comp / total, 3),
                    'total_tasks': total,
                })
        ranked.sort(key=lambda x: x['rate'], reverse=True)
        return ranked[:n]

    def get_subject_summary(self) -> list:
        """Return per-subject stats sorted by completion rate."""
        result = []
        for subj, (comp, total, total_dur) in self.subject_performance.items():
            if total > 0:
                result.append({
                    'subject': subj,
                    'completion_rate': round(comp / total, 3),
                    'total_tasks': total,
                    'avg_duration_minutes': round(total_dur / total, 1),
                })
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
        # {date_str: {study_minutes, distraction_events, tasks_completed,
        #             tasks_missed, content_educational, content_non_educational}}
        self.daily = {}
        self._load()

    # ── Persistence ─────────────────────────────────────────────

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

    def _get_day(self, date_str: str) -> dict:
        if date_str not in self.daily:
            self.daily[date_str] = {
                'study_minutes': 0,
                'distraction_events': 0,
                'tasks_completed': 0,
                'tasks_missed': 0,
                'content_educational': 0,
                'content_non_educational': 0,
                'distraction_minutes': 0,
            }
        return self.daily[date_str]

    # ── Recording ───────────────────────────────────────────────

    def record_task_completed(self, task: dict):
        entry = self._get_day(self._today())
        entry['tasks_completed'] += 1
        entry['study_minutes'] += int(task.get('duration_minutes') or 0)
        # Count distraction events that happened during this task
        entry['distraction_events'] += int(task.get('distraction_events') or 0)
        self._save()

    def record_task_missed(self, task: dict):
        entry = self._get_day(self._today())
        entry['tasks_missed'] += 1
        entry['distraction_events'] += int(task.get('distraction_events') or 0)
        self._save()

    def record_distraction_event(self, duration_minutes: int = 5):
        """Record a live distraction event with estimated duration."""
        entry = self._get_day(self._today())
        entry['distraction_events'] += 1
        entry['distraction_minutes'] += duration_minutes
        self._save()

    def record_content_event(self, is_educational: bool):
        """Record a content classification event."""
        entry = self._get_day(self._today())
        if is_educational:
            entry['content_educational'] += 1
        else:
            entry['content_non_educational'] += 1
        self._save()

    # ── Analysis ────────────────────────────────────────────────

    def _get_range(self, days: int = 7) -> list:
        """Return list of day entries for the last N days (oldest first)."""
        result = []
        for i in range(days - 1, -1, -1):
            date_str = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            entry = dict(self._get_day(date_str))  # ensure key exists
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
        """Return enriched daily trend records for the last N days."""
        return self._get_range(days)

    def get_completion_trend(self, days: int = 7) -> list:
        """Return daily completion rates as a plain list (most recent last)."""
        return [e['completion_rate'] for e in self._get_range(days)]

    def get_weekly_summary(self) -> dict:
        entries = self._get_range(7)
        total_study = sum(e['study_minutes'] for e in entries)
        total_comp = sum(e['tasks_completed'] for e in entries)
        total_miss = sum(e['tasks_missed'] for e in entries)
        total_dist_events = sum(e['distraction_events'] for e in entries)
        total_dist_min = sum(e['distraction_minutes'] for e in entries)
        total_tasks = total_comp + total_miss

        # Trend: compare last 3 days vs previous 4
        recent = entries[-3:]
        older = entries[:4]
        r_comp = sum(e['tasks_completed'] for e in recent)
        r_total = sum(e['tasks_completed'] + e['tasks_missed'] for e in recent)
        o_comp = sum(e['tasks_completed'] for e in older)
        o_total = sum(e['tasks_completed'] + e['tasks_missed'] for e in older)
        recent_rate = r_comp / max(r_total, 1) * 100
        older_rate = o_comp / max(o_total, 1) * 100
        delta = round(recent_rate - older_rate, 1)

        if delta > 5:
            trend_direction = 'improving'
        elif delta < -5:
            trend_direction = 'declining'
        else:
            trend_direction = 'stable'

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
        """Compute study vs distraction time breakdown for the last 7 days."""
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
        """Detect notable patterns: best day, worst day, streak info."""
        entries = self._get_range(7)
        has_data = any(e['tasks_completed'] + e['tasks_missed'] > 0 for e in entries)
        if not has_data:
            return {'no_data': True}

        best = max(entries, key=lambda e: e['completion_rate'])
        worst = min(
            [e for e in entries if e['tasks_completed'] + e['tasks_missed'] > 0],
            key=lambda e: e['completion_rate'],
            default=None
        )
        most_distracted = max(entries, key=lambda e: e['distraction_events'])
        most_productive = max(entries, key=lambda e: e['study_minutes'])

        # Consecutive days with tasks completed
        streak = 0
        for e in reversed(entries):
            if e['tasks_completed'] > 0:
                streak += 1
            else:
                break

        return {
            'best_day': {'date': best['date'], 'completion_rate': best['completion_rate']},
            'worst_day': {'date': worst['date'], 'completion_rate': worst['completion_rate']} if worst else None,
            'most_distracted_day': {
                'date': most_distracted['date'],
                'events': most_distracted['distraction_events']
            },
            'most_productive_day': {
                'date': most_productive['date'],
                'study_minutes': most_productive['study_minutes']
            },
            'current_active_day_streak': streak,
        }

    def generate_suggestions(self, profiler: ProductivityProfiler = None) -> list:
        """Generate data-driven improvement suggestions based on trends."""
        suggestions = []
        entries = self._get_range(7)
        has_data = any(e['tasks_completed'] + e['tasks_missed'] > 0 for e in entries)

        if not has_data:
            suggestions.append({
                'type': 'onboarding',
                'priority': 'info',
                'title': 'Start tracking your progress',
                'message': 'Complete a few tasks to unlock personalized insights and recommendations.',
            })
            return suggestions

        summary = self.get_weekly_summary()
        ratio = self.get_study_vs_distraction()

        # Declining performance
        if summary['trend_direction'] == 'declining':
            suggestions.append({
                'type': 'trend_alert',
                'priority': 'high',
                'title': 'Performance declining this week',
                'message': (
                    f"Your completion rate dropped {abs(summary['trend_delta']):.0f}% "
                    "vs the previous period. Try shorter focus blocks (25 min) and take "
                    "a 5-min break between sessions."
                ),
            })

        # High distraction ratio
        if ratio['distraction_ratio_pct'] > 25:
            suggestions.append({
                'type': 'distraction',
                'priority': 'high',
                'title': 'High distraction rate detected',
                'message': (
                    f"~{ratio['distraction_ratio_pct']:.0f}% of your tracked time is "
                    "lost to distractions. Enable the content blocker during scheduled "
                    "tasks to recover that time."
                ),
            })

        # Low study time
        avg_daily = summary['avg_daily_study_minutes']
        if avg_daily < 60:
            suggestions.append({
                'type': 'study_time',
                'priority': 'medium',
                'title': 'Increase daily study time',
                'message': (
                    f"You're averaging {avg_daily:.0f} min/day this week. "
                    "Aim for at least 90 minutes of focused study each day — "
                    "even 2 Pomodoro sessions make a difference."
                ),
            })
        elif avg_daily > 300:
            suggestions.append({
                'type': 'balance',
                'priority': 'low',
                'title': 'Remember to take breaks',
                'message': (
                    f"You're studying {avg_daily/60:.1f} hours/day on average. "
                    "Sustained sessions without breaks reduce retention. "
                    "Schedule a 10-min break every 50 minutes."
                ),
            })

        # Many missed tasks recently
        recent_missed = sum(e['tasks_missed'] for e in entries[-3:])
        if recent_missed >= 3:
            suggestions.append({
                'type': 'missed_tasks',
                'priority': 'medium',
                'title': 'Reduce task misses',
                'message': (
                    f"You missed {recent_missed} tasks in the last 3 days. "
                    "Consider scheduling fewer tasks per day or using shorter "
                    "durations so each session feels achievable."
                ),
            })

        # Non-educational content dominates
        if (ratio['content_non_educational'] > ratio['content_educational']
                and ratio['content_non_educational'] >= 3):
            suggestions.append({
                'type': 'content',
                'priority': 'medium',
                'title': 'More non-educational content detected',
                'message': (
                    "Your browser activity during study time shows more entertainment "
                    "content than educational material. Use the content classifier to "
                    "stay focused on study resources."
                ),
            })

        # Profiler-based scheduling suggestion
        if profiler:
            best_hrs = profiler.get_best_hours(2)
            worst_hrs = profiler.get_worst_hours(2)
            if best_hrs and worst_hrs and best_hrs[0]['rate'] > worst_hrs[0]['rate'] + 0.2:
                best_labels = ', '.join(h['label'] for h in best_hrs)
                worst_labels = ', '.join(h['label'] for h in worst_hrs)
                suggestions.append({
                    'type': 'scheduling',
                    'priority': 'low',
                    'title': 'Optimize your study schedule',
                    'message': (
                        f"You complete tasks most reliably at {best_labels} "
                        f"and least reliably at {worst_labels}. "
                        "Schedule your hardest tasks during your peak hours."
                    ),
                })

            # Subject-specific suggestion
            subj = profiler.get_subject_summary()
            if len(subj) >= 2:
                hardest = subj[-1]
                if hardest['completion_rate'] < 0.5:
                    suggestions.append({
                        'type': 'subject',
                        'priority': 'low',
                        'title': f"Struggling with {hardest['subject'].title()}",
                        'message': (
                            f"Your completion rate for {hardest['subject'].title()} is "
                            f"{hardest['completion_rate']*100:.0f}%. "
                            "Try scheduling these tasks during your best hours and "
                            "breaking them into smaller chunks."
                        ),
                    })

        if not suggestions:
            if summary['trend_direction'] == 'improving':
                suggestions.append({
                    'type': 'positive',
                    'priority': 'info',
                    'title': 'Great improvement this week!',
                    'message': (
                        f"Your completion rate improved by {summary['trend_delta']:.0f}% "
                        "vs the previous period. Keep up the momentum!"
                    ),
                })
            else:
                suggestions.append({
                    'type': 'positive',
                    'priority': 'info',
                    'title': 'Consistent performance',
                    'message': (
                        "Your study patterns are stable. Focus on reducing distraction "
                        "events to level up your productivity score."
                    ),
                })

        return suggestions

    def get_full_analytics(self, profiler: ProductivityProfiler = None) -> dict:
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

    # ── Persistence ─────────────────────────────────────────────

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
            data = {
                'focus_streak': self.focus_streak,
                'best_streak': self.best_streak,
                'total_focused_sessions': self.total_focused_sessions,
                'total_sessions': self.total_sessions,
                'badges': self.badges,
            }
            with open(self.streak_file, 'w') as f:
                json.dump(data, f, indent=2)
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

    # ── Streaks & Badges ─────────────────────────────────────────

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
             'condition': len([t for t in self.history if t.get('status') == 'completed']) >= 5},
            {'id': 'tasks_20', 'name': 'Productivity Machine',
             'description': 'Completed 20 tasks', 'icon': 'zap',
             'condition': len([t for t in self.history if t.get('status') == 'completed']) >= 20},
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

    # ── Task CRUD ────────────────────────────────────────────────

    def _parse_datetime(self, value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        text = str(value).strip()
        if not text:
            return None
        candidates = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%S.%f',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%dT%H:%M:%S.%fZ',
        ]
        for fmt in candidates:
            try:
                return datetime.strptime(text, fmt)
            except Exception:
                continue
        try:
            return datetime.fromisoformat(text.replace('Z', '+00:00'))
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
                 scheduled_slot=None, notes='', planned_start=None,
                 planned_end=None):
        task_id = f'task_{self.next_id}'
        self.next_id += 1
        duration_minutes = int(duration_minutes or 0)
        task = {
            'id': task_id,
            'subject': subject,
            'duration_minutes': duration_minutes,
            'priority': priority,
            'scheduled_slot': scheduled_slot,
            'planned_start': planned_start,
            'planned_end': planned_end,
            'status': 'pending',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'started_at': None,
            'session_started_at': None,
            'completed_at': None,
            'rescheduled_from': None,
            'rescheduled_to': None,
            'reschedule_reason': None,
            'distraction_events': 0,
            'focus_score_avg': None,
            'remaining_seconds': max(duration_minutes, 0) * 60,
            'studied_seconds': 0,
            'notes': notes,
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
        task['completed_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        task['remaining_seconds'] = 0
        task['session_started_at'] = None
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
        task = self.tasks.get(task_id)
        if task:
            cur = task.get('focus_score_avg')
            task['focus_score_avg'] = (
                focus_score if cur is None
                else round((cur + focus_score) / 2, 4)
            )
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

    def get_missed_tasks(self, grace_seconds=60):
        now = datetime.now()
        results = []
        for task in self.tasks.values():
            if task.get('status') not in ('pending', 'rescheduled'):
                continue
            planned_start = self._parse_datetime(task.get('planned_start'))
            if not planned_start:
                continue
            if (now - planned_start).total_seconds() >= grace_seconds:
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
                if t.get('status') == 'completed'
            ),
            'total_sessions': len(self.history),
        }


# ═══════════════════════════════════════════════════════════════
#  ADAPTIVE PLANNER
# ═══════════════════════════════════════════════════════════════

class AdaptivePlanner:
    """
    Predicts task completion probability with:
    - Distraction-aware dynamic rescheduling using smart slot selection
    - Personalized productivity profiling per student
    - Weekly trend analytics and data-driven improvement suggestions
    - Content classification integration for context-aware feedback
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

        self.feedback_messages = {
            'recovery': [
                "You seem tired. Take 5 minutes to reset, then continue with an easier task.",
                "Rest is productive too. Take a short break and come back refreshed.",
                "Your energy is low. A quick stretch or snack can help you refocus."
            ],
            'missed_support': [
                "It's okay to miss a task. Let's reschedule it for a better time.",
                "Don't stress about the missed session. We've moved it to your next free slot.",
                "Missing one task doesn't define your day. Let's adjust the plan."
            ],
            'refocus': [
                "You've been distracted for a while. Try a 5-minute focus sprint.",
                "Let's get back on track. Start with the easiest part of your task.",
                "Distractions happen. Close unnecessary tabs and try again."
            ],
            'streak': [
                "You're on a roll! Keep up the great work.",
                "Fantastic focus streak! Your consistency is paying off.",
                "Impressive discipline! You've been focused for multiple sessions."
            ],
            'praise': [
                "Nice work! Your study pattern looks solid today.",
                "Great job staying focused. Your effort is showing.",
                "Excellent session! You're making real progress."
            ],
            'encourage': [
                "You're doing okay - let's aim to complete the next task calmly.",
                "Keep going at your own pace. Every minute of focus counts.",
                "You're making progress. Stay with it a little longer."
            ],
            'distraction_warning': [
                "High distraction detected! Your current task has been rescheduled.",
                "You've been distracted for several minutes. We've adjusted your schedule.",
                "Distraction levels are elevated. Taking a break might help before continuing."
            ],
            'auto_reschedule': [
                "We've automatically moved your task to the next available slot due to sustained distraction.",
                "Your schedule has been adjusted. The current task was rescheduled because focus dropped significantly.",
                "Task rescheduled automatically. Try a lighter task or take a short break first."
            ],
            'content_warning': [
                "Non-educational content detected during your study session. Refocus on your task.",
                "Your browser shows entertainment content. Close it and return to your study material.",
                "Content classifier flagged non-study material. Stay on track!"
            ],
        }

        self.feedback_actions = {
            'recovery': 'Switch to a lighter task / add a short break',
            'missed_support': 'Review rescheduled task in your updated plan',
            'refocus': 'Close distracting apps and try a 5-min focus sprint',
            'streak': 'Continue with next planned task',
            'praise': 'Continue with next planned task',
            'encourage': 'Do the next task with a small goal',
            'distraction_warning': 'Take a 5-minute break then restart',
            'auto_reschedule': 'Check your updated schedule for the new time slot',
            'content_warning': 'Close non-study tabs and refocus on your material',
        }

        self._load_model()

    # ── Model ────────────────────────────────────────────────────

    def _load_model(self):
        if (os.path.exists(self.model_path) and
                os.path.exists(self.scaler_path) and
                os.path.exists(self.columns_path)):
            try:
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.feature_columns = joblib.load(self.columns_path)
                print('[Planner] Model loaded from saved files')
            except Exception as e:
                print(f'[Planner] Failed to load model: {e}')
                self.model = None
        else:
            print('[Planner] No saved model found, will train on first request')

    def train(self):
        data_dir = os.path.dirname(__file__)
        enhanced_path = os.path.join(data_dir, 'enhanced_student_habits_performance_dataset.csv')
        basic_path = os.path.join(data_dir, 'student_habits_performance.csv')

        if os.path.exists(enhanced_path):
            df = pd.read_csv(enhanced_path)
            print(f'[Planner] Loaded enhanced dataset: {df.shape}')
        elif os.path.exists(basic_path):
            df = pd.read_csv(basic_path)
            print(f'[Planner] Loaded basic dataset: {df.shape}')
        else:
            raise FileNotFoundError('No planner dataset found')

        if 'social_media_hours' in df.columns:
            df['total_social_hours'] = df['social_media_hours']
        elif 'total_social_hours' not in df.columns:
            df['total_social_hours'] = 0

        df['focus_ratio'] = df['study_hours_per_day'] / (
            df['study_hours_per_day'] + df['total_social_hours'] + 1
        )

        np.random.seed(42)
        df['task_completed'] = (
            df['focus_ratio'] + np.random.normal(0, 0.1, len(df)) > 0.5
        ).astype(int)

        features = ['age', 'gender', 'part_time_job', 'study_hours_per_day',
                    'sleep_hours', 'total_social_hours']
        available = [f for f in features if f in df.columns]
        df = df[available + ['task_completed']].dropna()

        X = df[available].copy()
        y = df['task_completed'].copy()

        cat_cols = [c for c in ['gender', 'part_time_job'] if c in available]
        X = pd.get_dummies(X, columns=cat_cols, drop_first=True)

        self.scaler = StandardScaler()
        scale_cols = [c for c in NUMERIC_COLS if c in X.columns]
        X[scale_cols] = self.scaler.fit_transform(X[scale_cols])

        self.feature_columns = list(X.columns)

        if HAS_SMOTE:
            smote = SMOTE(random_state=42)
            X_bal, y_bal = smote.fit_resample(X, y)
        else:
            X_bal, y_bal = X, y

        X_train, X_test, y_train, y_test = train_test_split(
            X_bal, y_bal, test_size=0.2, random_state=42, stratify=y_bal)

        self.model = RandomForestClassifier(
            n_estimators=200, max_depth=10,
            min_samples_split=10, min_samples_leaf=5,
            random_state=42
        )
        self.model.fit(X_train, y_train)

        train_acc = accuracy_score(y_train, self.model.predict(X_train))
        test_acc = accuracy_score(y_test, self.model.predict(X_test))
        print(f'[Planner] Train acc: {train_acc:.3f}, Test acc: {test_acc:.3f}')

        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        joblib.dump(self.feature_columns, self.columns_path)
        return {'train_accuracy': train_acc, 'test_accuracy': test_acc}

    def _prepare_features(self, data):
        row = {
            'age': float(data.get('age', 20)),
            'study_hours_per_day': float(data.get('study_hours_per_day', 3)),
            'sleep_hours': float(data.get('sleep_hours', 7)),
            'total_social_hours': float(data.get('total_social_hours', 1.5)),
            'gender_Male': 1 if data.get('gender', 'Male') == 'Male' else 0,
            'gender_Other': 1 if data.get('gender', 'Male') == 'Other' else 0,
            'part_time_job_Yes': 1 if data.get('part_time_job', 'No') == 'Yes' else 0,
        }
        df = pd.DataFrame([row])
        for col in self.feature_columns:
            if col not in df.columns:
                df[col] = 0
        df = df[self.feature_columns]
        scale_cols = [c for c in NUMERIC_COLS if c in df.columns]
        if scale_cols:
            df[scale_cols] = self.scaler.transform(df[scale_cols])
        return df

    # ── Task wrappers (with profiler + trend hooks) ──────────────

    def complete_task(self, task_id: str, elapsed_seconds: int = None):
        """Complete a task and update profiler + trend analyzer."""
        task = self.task_manager.complete_task(task_id, elapsed_seconds)
        if task:
            self.profiler.record_completion(task, completed=True)
            self.trend_analyzer.record_task_completed(task)
        return task

    def miss_task(self, task_id: str, reason: str = 'distraction'):
        """Mark a task missed and update profiler + trend analyzer."""
        task = self.task_manager.miss_task(task_id, reason)
        if task:
            self.profiler.record_completion(task, completed=False)
            self.trend_analyzer.record_task_missed(task)
        return task

    # ── Smart slot selection ─────────────────────────────────────

    def _find_best_slot(self, schedule, current_slot=None,
                        subject=None, priority='medium', duration=60):
        """
        Find the optimal available slot using the productivity profiler.
        For high-priority tasks, cascades lower-priority tasks to later slots
        if needed to secure a peak-performance time window.
        Falls back to first free slot if no profiler data.
        """
        if not schedule:
            return None

        free_slots = [s for s in schedule if s.get('status') == 'free']
        if current_slot:
            future = [s for s in free_slots if s.get('time', '') > current_slot]
            free_slots = future if future else free_slots

        if not free_slots:
            return None

        candidates = [s['time'] for s in free_slots if s.get('time')]
        if not candidates:
            return None

        # Use profiler for intelligent selection
        best = self.profiler.get_optimal_slot(candidates, subject, priority)

        # For high-priority tasks: if best slot is occupied by a lower-priority
        # pending task, cascade that task to the next available slot (max 2 bumps)
        if priority == 'high' and best:
            bumped = 0
            for pending in self.task_manager.get_pending_tasks():
                if bumped >= 2:
                    break
                if (pending.get('scheduled_slot') == best and
                        pending.get('priority', 'medium') != 'high'):
                    remaining = [c for c in candidates if c > best]
                    if remaining:
                        bump_slot = self.profiler.get_optimal_slot(
                            remaining, pending.get('subject'), pending.get('priority', 'medium'))
                        self.task_manager.reschedule_task(
                            pending['id'], bump_slot, 'bumped_for_high_priority')
                        bumped += 1

        return best

    # ── Content classification integration ───────────────────────

    def analyze_content_context(self, content_state: dict) -> dict:
        """
        Analyze browser content state (from ContentClassifier) and return
        an adjustment to the task completion probability and optional warning.
        """
        if not content_state or content_state.get('result') == 'pending':
            return {'adjustment': 0.0, 'is_educational': None, 'content_warning': None}

        result = content_state.get('result', '')
        label = content_state.get('label', 'unknown')
        is_educational = (label == 'educational' or result == 'allow')

        # Record in trend tracker
        if result in ('allow', 'block'):
            self.trend_analyzer.record_content_event(is_educational)

        if is_educational:
            adjustment = -0.05  # Educational content → slight boost to completion prob
            warning = None
        else:
            adjustment = 0.15   # Non-educational → raises distraction probability
            title = content_state.get('title', 'unknown page')
            warning = f"Non-educational content detected: '{title}'. Refocus on your task."

        return {
            'adjustment': adjustment,
            'is_educational': is_educational,
            'content_warning': warning,
            'label': label,
            'title': content_state.get('title', ''),
            'url': content_state.get('url', ''),
        }

    # ── Feedback ─────────────────────────────────────────────────

    def _generate_feedback(self, probability, data, distraction_state=None,
                           content_context=None):
        sleep = float(data.get('sleep_hours', 7))
        social = float(data.get('total_social_hours', 0))
        missed = int(data.get('missed_count_today', 0))

        # Determine feedback type in priority order
        if content_context and content_context.get('content_warning'):
            fb_type = 'content_warning'
        elif distraction_state and distraction_state.get('is_distracted'):
            confidence = distraction_state.get('confidence', 0)
            if confidence > 0.8:
                fb_type = 'auto_reschedule'
            elif confidence > 0.6:
                fb_type = 'distraction_warning'
            else:
                fb_type = 'refocus'
        elif sleep < 5:
            fb_type = 'recovery'
        elif missed > 2:
            fb_type = 'missed_support'
        elif social > 3:
            fb_type = 'refocus'
        elif probability > 0.85:
            fb_type = 'praise'
        elif probability > 0.65:
            fb_type = 'encourage'
        else:
            fb_type = 'recovery'

        message = random.choice(
            self.feedback_messages.get(fb_type, self.feedback_messages['encourage'])
        )
        action = self.feedback_actions.get(fb_type, 'Continue with your plan')

        # Supplement with trend context
        supplement = None
        try:
            summary = self.trend_analyzer.get_weekly_summary()
            trend = summary.get('trend_direction', 'stable')
            if trend == 'improving' and fb_type in ('praise', 'encourage'):
                supplement = f"You're improving this week — up {summary.get('trend_delta', 0):.0f}% from last period!"
            elif trend == 'declining' and fb_type in ('encourage', 'recovery'):
                supplement = "This week has been tough. Small wins still count — keep going."
        except Exception:
            pass

        result = {
            'feedback_type': fb_type,
            'message': message,
            'suggested_action': action,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }
        if supplement:
            result['trend_supplement'] = supplement
        if content_context and content_context.get('content_warning'):
            result['content_warning'] = content_context['content_warning']

        return result

    # ── Distraction reschedule ────────────────────────────────────

    def _check_distraction_reschedule(self, distraction_state, schedule,
                                      active_task=None):
        if not distraction_state:
            return None

        is_distracted = distraction_state.get('is_distracted', False)
        confidence = distraction_state.get('confidence', 0)

        if is_distracted:
            self.distraction_streak += 1
            self.trend_analyzer.record_distraction_event(duration_minutes=5)
        else:
            self.distraction_streak = 0

        should_reschedule = False
        reason = None

        if is_distracted and confidence > 0.95:
            should_reschedule = True
            reason = 'extreme_distraction'
        elif is_distracted and confidence > 0.90 and self.distraction_streak >= 2:
            should_reschedule = True
            reason = 'sustained_high_distraction'
        elif is_distracted and confidence > 0.80 and self.distraction_streak >= 3:
            should_reschedule = True
            reason = 'prolonged_distraction'

        if should_reschedule and active_task:
            current_slot = active_task.get('scheduled_slot')
            subject = active_task.get('subject')
            priority = active_task.get('priority', 'medium')
            duration = active_task.get('duration_minutes', 60)

            new_slot = self._find_best_slot(
                schedule, current_slot, subject, priority, duration)

            if new_slot:
                self.task_manager.reschedule_task(active_task['id'], new_slot, reason)
                self.task_manager.record_distraction_event(active_task['id'])
                profile = self.profiler.get_profile_summary()
                return {
                    'rescheduled': True,
                    'task_id': active_task['id'],
                    'task_subject': active_task['subject'],
                    'old_slot': current_slot,
                    'new_slot': new_slot,
                    'reason': reason,
                    'distraction_confidence': confidence,
                    'distraction_streak': self.distraction_streak,
                    'slot_optimized': profile['has_enough_data'],
                }

        return None

    # ── Main predict ─────────────────────────────────────────────

    def predict(self, data, distraction_state=None, content_state=None):
        if self.model is None:
            self.train()

        X = self._prepare_features(data)
        prob = float(self.model.predict_proba(X)[0][1])
        original_prob = prob
        distraction_adjustment = 0.0
        content_adjustment = 0.0

        # Content classification adjustment
        content_context = None
        if content_state:
            content_context = self.analyze_content_context(content_state)
            content_adjustment = content_context.get('adjustment', 0.0)
            prob = max(0.01, min(0.99, prob - content_adjustment))

        # Distraction model adjustment
        if distraction_state and distraction_state.get('is_distracted'):
            dist_confidence = distraction_state.get('confidence', 0)
            distraction_adjustment = dist_confidence * 0.3
            prob = max(0.01, prob - distraction_adjustment)

        pred = int(prob >= 0.5)

        # Update focus streak
        new_badges = self.task_manager.update_streak(prob >= 0.5)

        # Update active task focus score + distraction events
        active_task = self.task_manager.get_active_task()
        if active_task and distraction_state:
            focus_score = 1 - distraction_state.get('final_prob', 0.5)
            self.task_manager.update_focus_score(active_task['id'], focus_score)
            if distraction_state.get('is_distracted'):
                self.task_manager.record_distraction_event(active_task['id'])

        # Smart rescheduling
        schedule = data.get('schedule', [])
        reschedule_info = self._check_distraction_reschedule(
            distraction_state, schedule, active_task)

        if reschedule_info:
            decision = (
                f"Task '{reschedule_info['task_subject']}' auto-rescheduled "
                f"to {reschedule_info['new_slot']} "
                f"({'optimized slot' if reschedule_info.get('slot_optimized') else 'next free slot'})"
            )
            new_slot = reschedule_info['new_slot']
        elif prob >= 0.7:
            decision = 'Continue current task'
            new_slot = None
        elif prob >= 0.4:
            decision = 'Continue with shorter focus blocks'
            new_slot = None
        else:
            decision = 'Consider resting and rescheduling'
            subject = active_task.get('subject') if active_task else None
            priority = active_task.get('priority', 'medium') if active_task else 'medium'
            duration = active_task.get('duration_minutes', 60) if active_task else 60
            new_slot = self._find_best_slot(schedule, subject=subject,
                                            priority=priority, duration=duration)

        feedback = self._generate_feedback(prob, data, distraction_state, content_context)

        # Social media alert
        social_alert = None
        social_hours = float(data.get('total_social_hours', 0))
        if social_hours > 1:
            self.social_alert_count += 1
            if self.social_alert_count <= 3:
                msgs = [
                    'Your social media usage is increasing. Try to refocus.',
                    'You have been distracted for a while. Time to continue your task.',
                    'Social media is consuming your study time. Consider blocking these apps.'
                ]
            else:
                msgs = [
                    'Repeated social media alerts detected. Strongly consider enabling the blocker.',
                    'Your social media time significantly exceeds recommended limits.'
                ]
            social_alert = {
                'type': 'social_media_alert',
                'message': random.choice(msgs),
                'suggested_action': 'Return to the current task',
                'alert_count': self.social_alert_count,
            }

        result = {
            'prediction': pred,
            'task_completion_probability': round(prob, 4),
            'original_probability': round(original_prob, 4),
            'distraction_adjustment': round(distraction_adjustment, 4),
            'content_adjustment': round(content_adjustment, 4),
            'planner_decision': decision,
            'new_slot': new_slot,
            'feedback': feedback,
            'social_alert': social_alert,
            'task_stats': self.task_manager.get_stats(),
            'streak_info': self.task_manager.get_streak_info(),
        }

        if new_badges:
            result['new_badges'] = new_badges
        if reschedule_info:
            result['reschedule_info'] = reschedule_info
        if content_context and content_context.get('content_warning'):
            result['content_context'] = {
                'warning': content_context['content_warning'],
                'label': content_context.get('label'),
                'is_educational': content_context.get('is_educational'),
            }
        if distraction_state:
            result['distraction_aware'] = True
            result['live_distraction'] = {
                'is_distracted': distraction_state.get('is_distracted', False),
                'confidence': distraction_state.get('confidence', 0),
                'dominant_app': distraction_state.get('dominant_app', 'unknown'),
                'streak': self.distraction_streak,
            }

        return result

    # ── Smart schedule ────────────────────────────────────────────

    def get_smart_schedule(self) -> dict:
        """
        Generate an AI-recommended schedule for all pending tasks.
        Orders tasks by urgency (priority × subject difficulty),
        maps them to the student's optimal time slots.
        """
        pending = self.task_manager.get_pending_tasks()
        if not pending:
            return {
                'recommendations': [],
                'message': 'No pending tasks to schedule.',
                'profile_based': False,
            }

        profile = self.profiler.get_profile_summary()
        subj_rates = {s['subject']: s['completion_rate']
                      for s in profile.get('subject_performance', [])}
        priority_weight = {'high': 3, 'medium': 2, 'low': 1}

        def urgency(task):
            base = priority_weight.get(task.get('priority', 'medium'), 2)
            subj = (task.get('subject') or '').lower().strip()
            perf = subj_rates.get(subj, 0.5)
            # Hard subject + high priority = most urgent for prime slots
            return base * (1.5 - perf)

        sorted_tasks = sorted(pending, key=urgency, reverse=True)

        # Build available slot pool from now
        now_hour = datetime.now().hour
        all_slots = [f'{h:02d}:00' for h in range(max(now_hour, 8), 23)]

        # Separate peak from off-peak
        best_hours_set = {h['hour'] for h in profile.get('best_hours', [])}
        peak_slots = [s for s in all_slots if int(s.split(':')[0]) in best_hours_set]
        off_peak_slots = [s for s in all_slots if s not in peak_slots]
        ordered_pool = peak_slots + off_peak_slots

        # Already occupied slots (from other pending tasks' current scheduled_slot)
        used_slots = set()
        recommendations = []

        for task in sorted_tasks:
            subject = (task.get('subject') or '').lower().strip()
            priority = task.get('priority', 'medium')

            # Find best unused slot for this task
            available = [s for s in ordered_pool if s not in used_slots]
            if not available:
                available = ordered_pool  # reuse if we run out

            rec_slot = self.profiler.get_optimal_slot(available, subject, priority)
            if rec_slot:
                used_slots.add(rec_slot)

            subj_rate = subj_rates.get(subject)
            is_peak = rec_slot and int(rec_slot.split(':')[0]) in best_hours_set

            recommendations.append({
                'task_id': task['id'],
                'subject': task['subject'],
                'priority': priority,
                'duration_minutes': task.get('duration_minutes', 60),
                'current_slot': task.get('scheduled_slot'),
                'recommended_slot': rec_slot or task.get('scheduled_slot'),
                'subject_completion_rate': round(subj_rate, 3) if subj_rate is not None else None,
                'is_peak_hour': bool(is_peak),
                'reason': (
                    'Peak productivity hour based on your history'
                    if is_peak else
                    'Next available slot (build more history for smarter suggestions)'
                ),
            })

        return {
            'recommendations': recommendations,
            'profile_based': profile['has_enough_data'],
            'best_hours': profile.get('best_hours', []),
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'message': (
                'Schedule optimized using your productivity profile.'
                if profile['has_enough_data'] else
                'Schedule generated. Complete more tasks to improve personalization.'
            ),
        }

    # ── Full analytics ────────────────────────────────────────────

    def get_analytics(self) -> dict:
        """Return comprehensive analytics payload."""
        return {
            'trend_analytics': self.trend_analyzer.get_full_analytics(self.profiler),
            'productivity_profile': self.profiler.get_profile_summary(),
            'task_stats': self.task_manager.get_stats(),
            'streak_info': self.task_manager.get_streak_info(),
            'session_history': self.task_manager.get_session_history(),
        }
