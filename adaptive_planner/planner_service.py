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


class TaskManager:
    """Manages student tasks with persistent JSON storage."""

    def __init__(self):
        self.tasks = {}
        self.next_id = 1
        self.history = []
        self.tasks_file = os.path.join(DATA_DIR, 'tasks.json')
        self.history_file = os.path.join(DATA_DIR, 'task_history.json')
        self.streak_file = os.path.join(DATA_DIR, 'streaks.json')

        # Streak tracking
        self.focus_streak = 0
        self.best_streak = 0
        self.total_focused_sessions = 0
        self.total_sessions = 0
        self.badges = []

        self._load_tasks()
        self._load_history()
        self._load_streaks()

    # ---------- Persistence ----------

    def _save_tasks(self):
        """Save current tasks to JSON file."""
        try:
            data = {
                'tasks': self.tasks,
                'next_id': self.next_id,
            }
            with open(self.tasks_file, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f'[TaskManager] Failed to save tasks: {e}')

    def _load_tasks(self):
        """Load tasks from JSON file."""
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
        """Save task history to JSON file."""
        try:
            with open(self.history_file, 'w') as f:
                json.dump(self.history, f, indent=2)
        except Exception as e:
            print(f'[TaskManager] Failed to save history: {e}')

    def _load_history(self):
        """Load task history from JSON file."""
        if os.path.exists(self.history_file):
            try:
                with open(self.history_file, 'r') as f:
                    self.history = json.load(f)
                print(f'[TaskManager] Loaded {len(self.history)} history records from disk')
            except Exception as e:
                print(f'[TaskManager] Failed to load history: {e}')
                self.history = []

    def _save_streaks(self):
        """Save streak and badge data to JSON file."""
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
        """Load streak and badge data from JSON file."""
        if os.path.exists(self.streak_file):
            try:
                with open(self.streak_file, 'r') as f:
                    data = json.load(f)
                self.focus_streak = data.get('focus_streak', 0)
                self.best_streak = data.get('best_streak', 0)
                self.total_focused_sessions = data.get('total_focused_sessions', 0)
                self.total_sessions = data.get('total_sessions', 0)
                self.badges = data.get('badges', [])
                print(f'[TaskManager] Loaded streaks: current={self.focus_streak}, '
                      f'best={self.best_streak}, badges={len(self.badges)}')
            except Exception as e:
                print(f'[TaskManager] Failed to load streaks: {e}')

    # ---------- Streak & Badges ----------

    def update_streak(self, is_focused):
        """Update focus streak and check for new badges."""
        self.total_sessions += 1

        if is_focused:
            self.focus_streak += 1
            self.total_focused_sessions += 1
            if self.focus_streak > self.best_streak:
                self.best_streak = self.focus_streak
        else:
            self.focus_streak = 0

        # Check for new badges
        new_badges = self._check_badges()
        self._save_streaks()
        return new_badges

    def _check_badges(self):
        """Award badges based on milestones."""
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
             'description': 'Completed 5 tasks',
             'icon': 'check-circle',
             'condition': len([t for t in self.history if t.get('status') == 'completed']) >= 5},
            {'id': 'tasks_20', 'name': 'Productivity Machine',
             'description': 'Completed 20 tasks',
             'icon': 'zap',
             'condition': len([t for t in self.history if t.get('status') == 'completed']) >= 20},
        ]

        existing_ids = [b['id'] for b in self.badges]
        for rule in badge_rules:
            if rule['condition'] and rule['id'] not in existing_ids:
                badge = {
                    'id': rule['id'],
                    'name': rule['name'],
                    'description': rule['description'],
                    'icon': rule['icon'],
                    'earned_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                }
                self.badges.append(badge)
                new_badges.append(badge)

        return new_badges

    def get_streak_info(self):
        """Return current streak and badge info."""
        return {
            'focus_streak': self.focus_streak,
            'best_streak': self.best_streak,
            'total_focused_sessions': self.total_focused_sessions,
            'total_sessions': self.total_sessions,
            'focus_rate': round(self.total_focused_sessions / max(self.total_sessions, 1) * 100, 1),
            'badges': self.badges,
            'badge_count': len(self.badges),
        }

    # ---------- Task CRUD ----------

    def add_task(self, subject, duration_minutes, priority='medium',
                 scheduled_slot=None, notes=''):
        task_id = f'task_{self.next_id}'
        self.next_id += 1
        task = {
            'id': task_id,
            'subject': subject,
            'duration_minutes': duration_minutes,
            'priority': priority,
            'scheduled_slot': scheduled_slot,
            'status': 'pending',
            'created_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'started_at': None,
            'completed_at': None,
            'rescheduled_from': None,
            'rescheduled_to': None,
            'reschedule_reason': None,
            'distraction_events': 0,
            'focus_score_avg': None,
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
        task['status'] = 'active'
        task['started_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        self._save_tasks()
        return task

    def complete_task(self, task_id):
        task = self.tasks.get(task_id)
        if not task:
            return None
        task['status'] = 'completed'
        task['completed_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
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
        self.history.append({**task})
        self._save_tasks()
        self._save_history()
        return task

    def reschedule_task(self, task_id, new_slot, reason='distraction_detected'):
        task = self.tasks.get(task_id)
        if not task:
            return None
        old_slot = task['scheduled_slot']
        task['rescheduled_from'] = old_slot
        task['rescheduled_to'] = new_slot
        task['scheduled_slot'] = new_slot
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
            current = task.get('focus_score_avg')
            if current is None:
                task['focus_score_avg'] = focus_score
            else:
                task['focus_score_avg'] = round((current + focus_score) / 2, 4)
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

    def delete_task(self, task_id):
        if task_id in self.tasks:
            del self.tasks[task_id]
            self._save_tasks()
            return True
        return False

    def get_session_history(self):
        """Return study session history for analytics."""
        return {
            'completed_sessions': [t for t in self.history if t.get('status') == 'completed'],
            'missed_sessions': [t for t in self.history if t.get('status') == 'missed'],
            'total_study_minutes': sum(
                t.get('duration_minutes', 0)
                for t in self.history if t.get('status') == 'completed'
            ),
            'total_sessions': len(self.history),
        }


class AdaptivePlanner:
    """Predicts task completion probability with distraction-aware rescheduling."""

    def __init__(self):
        self.model = None
        self.scaler = None
        self.feature_columns = None
        self.model_path = os.path.join(SAVE_DIR, 'adaptive_planner_model.pkl')
        self.scaler_path = os.path.join(SAVE_DIR, 'planner_scaler.pkl')
        self.columns_path = os.path.join(SAVE_DIR, 'planner_columns.pkl')
        self.task_manager = TaskManager()
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
            ]
        }

        self.feedback_actions = {
            'recovery': 'Switch to a lighter task / add a short break',
            'missed_support': 'Review rescheduled task in your updated plan',
            'refocus': 'Close distracting apps and try a 5-min focus sprint',
            'streak': 'Continue with next planned task',
            'praise': 'Continue with next planned task',
            'encourage': 'Do the next task with a small goal',
            'distraction_warning': 'Take a 5-minute break then restart',
            'auto_reschedule': 'Check your updated schedule for the new time slot'
        }

        self._load_model()

    def _load_model(self):
        if (os.path.exists(self.model_path) and
            os.path.exists(self.scaler_path) and
            os.path.exists(self.columns_path)):
            try:
                self.model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.feature_columns = joblib.load(self.columns_path)
                print('[Planner] Model loaded from saved files')
                print(f'[Planner] Expected columns: {self.feature_columns}')
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

        pass_rate = df['task_completed'].mean() * 100
        print(f'[Planner] Target split: {pass_rate:.1f}% pass / {100-pass_rate:.1f}% fail')
        print(f'[Planner] task_completed value counts: {df["task_completed"].value_counts().to_dict()}')

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
        print(f'[Planner] Feature columns: {self.feature_columns}')
        print(f'[Planner] Scaler fitted on: {scale_cols}')

        if HAS_SMOTE:
            smote = SMOTE(random_state=42)
            X_bal, y_bal = smote.fit_resample(X, y)
        else:
            X_bal, y_bal = X, y

        X_train, X_test, y_train, y_test = train_test_split(
            X_bal, y_bal, test_size=0.2, random_state=42, stratify=y_bal)

        self.model = RandomForestClassifier(
            n_estimators=200,
            max_depth=10,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42
        )
        self.model.fit(X_train, y_train)

        train_acc = accuracy_score(y_train, self.model.predict(X_train))
        test_acc = accuracy_score(y_test, self.model.predict(X_test))
        print(f'[Planner] Train accuracy: {train_acc:.3f}, Test accuracy: {test_acc:.3f}')
        print(f'[Planner] Model: RandomForest (n=200, depth=10)')

        self._sanity_check()

        joblib.dump(self.model, self.model_path)
        joblib.dump(self.scaler, self.scaler_path)
        joblib.dump(self.feature_columns, self.columns_path)
        print(f'[Planner] Model saved to {SAVE_DIR}')

        return {'train_accuracy': train_acc, 'test_accuracy': test_acc}

    def _sanity_check(self):
        ideal = {'age': 21, 'study_hours_per_day': 8, 'sleep_hours': 8,
                 'total_social_hours': 0, 'gender': 'Female', 'part_time_job': 'No'}
        risky = {'age': 19, 'study_hours_per_day': 0.5, 'sleep_hours': 4,
                 'total_social_hours': 6, 'gender': 'Male', 'part_time_job': 'Yes'}
        mid = {'age': 20, 'study_hours_per_day': 3, 'sleep_hours': 7,
               'total_social_hours': 3, 'gender': 'Male', 'part_time_job': 'No'}

        for name, data in [('IDEAL', ideal), ('RISKY', risky), ('MIDDLE', mid)]:
            try:
                X = self._prepare_features(data)
                prob = float(self.model.predict_proba(X)[0][1])
                print(f'[Planner] Sanity check {name}: probability={prob:.3f}')
            except Exception as e:
                print(f'[Planner] Sanity check {name} failed: {e}')

    def _prepare_features(self, data):
        row = {}
        row['age'] = float(data.get('age', 20))
        row['study_hours_per_day'] = float(data.get('study_hours_per_day', 3))
        row['sleep_hours'] = float(data.get('sleep_hours', 7))
        row['total_social_hours'] = float(data.get('total_social_hours', 1.5))

        gender = data.get('gender', 'Male')
        row['gender_Male'] = 1 if gender == 'Male' else 0
        row['gender_Other'] = 1 if gender == 'Other' else 0

        job = data.get('part_time_job', 'No')
        row['part_time_job_Yes'] = 1 if job == 'Yes' else 0

        df = pd.DataFrame([row])

        for col in self.feature_columns:
            if col not in df.columns:
                df[col] = 0

        df = df[self.feature_columns]

        scale_cols = [c for c in NUMERIC_COLS if c in df.columns]
        if scale_cols:
            df[scale_cols] = self.scaler.transform(df[scale_cols])

        return df

    def _generate_feedback(self, probability, data, distraction_state=None):
        sleep = float(data.get('sleep_hours', 7))
        social = float(data.get('total_social_hours', 0))
        missed = int(data.get('missed_count_today', 0))

        if distraction_state and distraction_state.get('is_distracted'):
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

        message = random.choice(self.feedback_messages.get(fb_type, self.feedback_messages['encourage']))
        action = self.feedback_actions.get(fb_type, 'Continue with your plan')

        return {
            'feedback_type': fb_type,
            'message': message,
            'suggested_action': action,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        }

    def _find_next_free_slot(self, schedule, current_slot=None):
        if not schedule:
            return None
        free_slots = [s for s in schedule if s.get('status') == 'free']
        if current_slot:
            free_slots = [s for s in free_slots if s.get('time', '') > current_slot]
        if free_slots:
            return free_slots[0]['time']
        all_free = [s for s in schedule if s.get('status') == 'free']
        return all_free[0]['time'] if all_free else None

    def _check_distraction_reschedule(self, distraction_state, schedule, active_task=None):
        if not distraction_state:
            return None

        is_distracted = distraction_state.get('is_distracted', False)
        confidence = distraction_state.get('confidence', 0)

        if is_distracted:
            self.distraction_streak += 1
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
            new_slot = self._find_next_free_slot(schedule, current_slot)
            if new_slot:
                self.task_manager.reschedule_task(active_task['id'], new_slot, reason)
                self.task_manager.record_distraction_event(active_task['id'])
                return {
                    'rescheduled': True,
                    'task_id': active_task['id'],
                    'task_subject': active_task['subject'],
                    'old_slot': current_slot,
                    'new_slot': new_slot,
                    'reason': reason,
                    'distraction_confidence': confidence,
                    'distraction_streak': self.distraction_streak,
                }

        return None

    def predict(self, data, distraction_state=None):
        if self.model is None:
            self.train()

        X = self._prepare_features(data)
        prob = float(self.model.predict_proba(X)[0][1])
        pred = int(prob >= 0.5)

        original_prob = prob
        distraction_adjustment = 0
        if distraction_state and distraction_state.get('is_distracted'):
            dist_confidence = distraction_state.get('confidence', 0)
            distraction_adjustment = dist_confidence * 0.3
            prob = max(0.01, prob - distraction_adjustment)
            pred = int(prob >= 0.5)

        # Update streak based on prediction
        is_focused = prob >= 0.5
        new_badges = self.task_manager.update_streak(is_focused)

        active_task = self.task_manager.get_active_task()
        if active_task and distraction_state:
            focus_score = 1 - distraction_state.get('final_prob', 0.5)
            self.task_manager.update_focus_score(active_task['id'], focus_score)
            if distraction_state.get('is_distracted'):
                self.task_manager.record_distraction_event(active_task['id'])

        schedule = data.get('schedule', [])
        reschedule_info = self._check_distraction_reschedule(
            distraction_state, schedule, active_task)

        if reschedule_info:
            decision = f"Task '{reschedule_info['task_subject']}' auto-rescheduled to {reschedule_info['new_slot']} due to sustained distraction"
            new_slot = reschedule_info['new_slot']
        elif prob >= 0.7:
            decision = 'Continue current task'
            new_slot = None
        elif prob >= 0.4:
            decision = 'Continue with shorter focus blocks'
            new_slot = None
        else:
            decision = 'Ask user whether to rest and reschedule'
            new_slot = self._find_next_free_slot(schedule)

        feedback = self._generate_feedback(prob, data, distraction_state)

        social_alert = None
        social_hours = float(data.get('total_social_hours', 0))
        if social_hours > 1:
            self.social_alert_count += 1
            if self.social_alert_count <= 3:
                messages = [
                    'Your social media usage is increasing. Try to refocus on your current task.',
                    'You have been distracted for a while. It is time to continue your study task.',
                    'Social media is consuming your study time. Consider blocking these apps.'
                ]
            else:
                messages = [
                    'Repeated social media alerts detected. Strongly consider enabling the blocker.',
                    'Your social media time significantly exceeds recommended limits during study hours.'
                ]
            social_alert = {
                'type': 'social_media_alert',
                'message': random.choice(messages),
                'suggested_action': 'Return to the current task',
                'alert_count': self.social_alert_count,
            }

        result = {
            'prediction': pred,
            'task_completion_probability': round(prob, 4),
            'original_probability': round(original_prob, 4),
            'distraction_adjustment': round(distraction_adjustment, 4),
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

        if distraction_state:
            result['distraction_aware'] = True
            result['live_distraction'] = {
                'is_distracted': distraction_state.get('is_distracted', False),
                'confidence': distraction_state.get('confidence', 0),
                'dominant_app': distraction_state.get('dominant_app', 'unknown'),
                'streak': self.distraction_streak,
            }

        return result
