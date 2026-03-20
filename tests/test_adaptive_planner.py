"""
SDPPS - Adaptive Planner Module Test Suite
===========================================
Tests the planner model, task manager, feedback engine,
distraction-aware rescheduling, and API endpoints.

Run: cd E:\\SDPPS && python -m pytest tests/test_adaptive_planner.py -v
"""

import pytest
import json
import sys
import os
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from adaptive_planner.planner_service import AdaptivePlanner, TaskManager


# ============================================================
#  FIXTURES
# ============================================================

@pytest.fixture(scope="module")
def planner():
    """Create and train planner once for all tests."""
    p = AdaptivePlanner()
    if p.model is None:
        p.train()
    return p


@pytest.fixture
def task_manager():
    """Fresh TaskManager with clean state for each test."""
    tm = TaskManager()
    # Clear persisted state so tests are isolated
    tm.tasks = {}
    tm.next_id = 1
    tm.history = []
    tm.focus_streak = 0
    tm.best_streak = 0
    tm.total_focused_sessions = 0
    tm.total_sessions = 0
    tm.badges = []
    return tm


@pytest.fixture
def ideal_student():
    return {
        'age': 21, 'gender': 'Female', 'part_time_job': 'No',
        'study_hours_per_day': 8, 'sleep_hours': 8, 'total_social_hours': 0
    }


@pytest.fixture
def risky_student():
    return {
        'age': 19, 'gender': 'Male', 'part_time_job': 'Yes',
        'study_hours_per_day': 0.5, 'sleep_hours': 4, 'total_social_hours': 6
    }


@pytest.fixture
def borderline_student():
    return {
        'age': 20, 'gender': 'Male', 'part_time_job': 'No',
        'study_hours_per_day': 3, 'sleep_hours': 7, 'total_social_hours': 3
    }


@pytest.fixture
def social_addict():
    return {
        'age': 18, 'gender': 'Female', 'part_time_job': 'No',
        'study_hours_per_day': 1, 'sleep_hours': 5, 'total_social_hours': 8
    }


@pytest.fixture
def no_study_student():
    return {
        'age': 22, 'gender': 'Male', 'part_time_job': 'No',
        'study_hours_per_day': 0, 'sleep_hours': 10, 'total_social_hours': 0
    }


@pytest.fixture
def working_student():
    return {
        'age': 20, 'gender': 'Female', 'part_time_job': 'Yes',
        'study_hours_per_day': 4, 'sleep_hours': 5, 'total_social_hours': 2
    }


@pytest.fixture
def sample_schedule():
    return [
        {'time': '5-6 PM', 'status': 'occupied'},
        {'time': '6-7 PM', 'status': 'free'},
        {'time': '7-8 PM', 'status': 'free'},
        {'time': '8-9 PM', 'status': 'free'},
        {'time': '9-10 PM', 'status': 'free'},
    ]


@pytest.fixture
def distracted_state():
    return {
        'is_distracted': True,
        'confidence': 0.92,
        'final_prob': 0.85,
        'dominant_app': 'chrome.exe',
        'label': 'DISTRACTED',
        'app_category': 0.9,
        'distraction_streak': 3,
    }


@pytest.fixture
def focused_state():
    return {
        'is_distracted': False,
        'confidence': 0.95,
        'final_prob': 0.05,
        'dominant_app': 'pycharm64.exe',
        'label': 'FOCUSED',
        'app_category': 0.0,
        'distraction_streak': 0,
    }


# ============================================================
#  1. MODEL TRAINING & LOADING TESTS
# ============================================================

class TestModelTraining:

    def test_model_loads_successfully(self, planner):
        """TC-M01: Model should be loaded and ready."""
        assert planner.model is not None
        assert planner.scaler is not None
        assert planner.feature_columns is not None

    def test_feature_columns_correct(self, planner):
        """TC-M02: Feature columns must match notebook (drop_first=True)."""
        expected = ['age', 'study_hours_per_day', 'sleep_hours', 'total_social_hours',
                    'gender_Male', 'gender_Other', 'part_time_job_Yes']
        assert planner.feature_columns == expected

    def test_model_has_predict_proba(self, planner):
        """TC-M03: Model must support probability predictions."""
        assert hasattr(planner.model, 'predict_proba')

    def test_scaler_fitted_on_numeric_only(self, planner):
        """TC-M04: Scaler should be fitted on 4 numeric columns only."""
        assert planner.scaler.n_features_in_ == 4

    def test_model_files_exist(self):
        """TC-M05: Saved model files must exist on disk."""
        from adaptive_planner.planner_service import SAVE_DIR
        assert os.path.exists(os.path.join(SAVE_DIR, 'adaptive_planner_model.pkl'))
        assert os.path.exists(os.path.join(SAVE_DIR, 'planner_scaler.pkl'))
        assert os.path.exists(os.path.join(SAVE_DIR, 'planner_columns.pkl'))


# ============================================================
#  2. PREDICTION ACCURACY TESTS
# ============================================================

class TestPredictions:

    def test_ideal_student_high_probability(self, planner, ideal_student):
        """TC-P01: Ideal student -> >= 85%."""
        result = planner.predict(ideal_student)
        prob = result['task_completion_probability']
        assert prob >= 0.85, f"Ideal student got {prob:.3f}, expected >= 0.85"
        assert result['prediction'] == 1
        assert result['planner_decision'] == 'Continue current task'

    def test_risky_student_low_probability(self, planner, risky_student):
        """TC-P02: Risky student -> <= 20%."""
        result = planner.predict(risky_student)
        prob = result['task_completion_probability']
        assert prob <= 0.20, f"Risky student got {prob:.3f}, expected <= 0.20"
        assert result['prediction'] == 0

    def test_borderline_student_mid_probability(self, planner, borderline_student):
        """TC-P03: Borderline student -> 10-70%."""
        result = planner.predict(borderline_student)
        prob = result['task_completion_probability']
        assert 0.10 <= prob <= 0.70, f"Borderline got {prob:.3f}, expected 0.10-0.70"

    def test_social_addict_very_low(self, planner, social_addict):
        """TC-P04: Social addict -> <= 15%."""
        result = planner.predict(social_addict)
        prob = result['task_completion_probability']
        assert prob <= 0.15, f"Social addict got {prob:.3f}, expected <= 0.15"

    def test_no_study_student_low(self, planner, no_study_student):
        """TC-P05: No study -> <= 40%."""
        result = planner.predict(no_study_student)
        prob = result['task_completion_probability']
        assert prob <= 0.40, f"No-study got {prob:.3f}, expected <= 0.40"

    def test_working_student_moderate(self, planner, working_student):
        """TC-P06: Working student -> 30-75%."""
        result = planner.predict(working_student)
        prob = result['task_completion_probability']
        assert 0.30 <= prob <= 0.75, f"Working got {prob:.3f}, expected 0.30-0.75"

    def test_extreme_high_study(self, planner):
        """TC-P07: Extreme study -> >= 90%."""
        data = {'age': 20, 'gender': 'Male', 'part_time_job': 'No',
                'study_hours_per_day': 12, 'sleep_hours': 8, 'total_social_hours': 0}
        result = planner.predict(data)
        assert result['task_completion_probability'] >= 0.90

    def test_extreme_social_media(self, planner):
        """TC-P08: Extreme social -> <= 10%."""
        data = {'age': 18, 'gender': 'Male', 'part_time_job': 'Yes',
                'study_hours_per_day': 0, 'sleep_hours': 3, 'total_social_hours': 12}
        result = planner.predict(data)
        assert result['task_completion_probability'] <= 0.10

    def test_prediction_returns_all_fields(self, planner, ideal_student):
        """TC-P09: Result dict must contain all required keys."""
        result = planner.predict(ideal_student)
        required_keys = [
            'prediction', 'task_completion_probability', 'original_probability',
            'distraction_adjustment', 'planner_decision', 'new_slot',
            'feedback', 'social_alert', 'task_stats', 'streak_info'
        ]
        for key in required_keys:
            assert key in result, f"Missing key: {key}"

    def test_probability_range(self, planner, ideal_student, risky_student,
                                borderline_student, social_addict):
        """TC-P10: All probabilities must be between 0 and 1."""
        for student in [ideal_student, risky_student, borderline_student, social_addict]:
            result = planner.predict(student)
            prob = result['task_completion_probability']
            assert 0.0 <= prob <= 1.0


# ============================================================
#  3. DECISION LOGIC TESTS
# ============================================================

class TestDecisionLogic:

    def test_high_prob_continue(self, planner, ideal_student):
        """TC-D01: prob >= 0.7 -> Continue current task."""
        result = planner.predict(ideal_student)
        assert result['planner_decision'] == 'Continue current task'
        assert result['new_slot'] is None

    def test_low_prob_reschedule(self, planner, risky_student):
        """TC-D02: prob < 0.4 -> rest and reschedule."""
        result = planner.predict(risky_student)
        assert 'rest and reschedule' in result['planner_decision'].lower()

    def test_mid_prob_shorter_blocks(self, planner, borderline_student):
        """TC-D03: 0.4 <= prob < 0.7 -> shorter focus blocks."""
        result = planner.predict(borderline_student)
        prob = result['task_completion_probability']
        if 0.4 <= prob < 0.7:
            assert 'shorter focus blocks' in result['planner_decision'].lower()


# ============================================================
#  4. FEEDBACK ENGINE TESTS
# ============================================================

class TestFeedback:

    def test_praise_for_ideal(self, planner, ideal_student):
        """TC-F01: Ideal student gets praise feedback."""
        result = planner.predict(ideal_student)
        assert result['feedback']['feedback_type'] == 'praise'

    def test_recovery_for_risky(self, planner, risky_student):
        """TC-F02: Risky student with low sleep gets recovery."""
        result = planner.predict(risky_student)
        assert result['feedback']['feedback_type'] == 'recovery'

    def test_refocus_for_high_social(self, planner):
        """TC-F03: High social with decent sleep -> refocus."""
        data = {'age': 20, 'gender': 'Male', 'part_time_job': 'No',
                'study_hours_per_day': 2, 'sleep_hours': 7, 'total_social_hours': 5}
        result = planner.predict(data)
        assert result['feedback']['feedback_type'] == 'refocus'

    def test_feedback_has_required_fields(self, planner, ideal_student):
        """TC-F04: Feedback must contain type, message, action, timestamp."""
        result = planner.predict(ideal_student)
        fb = result['feedback']
        assert 'feedback_type' in fb
        assert 'message' in fb
        assert 'suggested_action' in fb
        assert 'timestamp' in fb
        assert len(fb['message']) > 10

    def test_feedback_message_varies(self, planner, ideal_student):
        """TC-F05: Multiple calls should give different messages."""
        messages = set()
        for _ in range(20):
            result = planner.predict(ideal_student)
            messages.add(result['feedback']['message'])
        assert len(messages) >= 2


# ============================================================
#  5. SOCIAL MEDIA ALERT TESTS
# ============================================================

class TestSocialAlerts:

    def test_no_alert_when_low_social(self, planner, ideal_student):
        """TC-S01: No alert when social hours <= 1."""
        result = planner.predict(ideal_student)
        assert result['social_alert'] is None

    def test_alert_when_high_social(self, planner, risky_student):
        """TC-S02: Alert present when social hours > 1."""
        result = planner.predict(risky_student)
        assert result['social_alert'] is not None
        assert result['social_alert']['type'] == 'social_media_alert'

    def test_alert_count_increments(self, planner):
        """TC-S03: Alert count increments on repeated predictions."""
        planner_fresh = AdaptivePlanner()
        if planner_fresh.model is None:
            planner_fresh.train()
        planner_fresh.social_alert_count = 0

        data = {'age': 20, 'gender': 'Male', 'part_time_job': 'No',
                'study_hours_per_day': 2, 'sleep_hours': 7, 'total_social_hours': 4}

        counts = []
        for _ in range(5):
            result = planner_fresh.predict(data)
            if result['social_alert']:
                counts.append(result['social_alert']['alert_count'])

        assert len(counts) >= 3
        assert counts == sorted(counts)

    def test_escalated_message_after_threshold(self, planner):
        """TC-S04: After 3 alerts, messages escalate."""
        planner_fresh = AdaptivePlanner()
        if planner_fresh.model is None:
            planner_fresh.train()
        planner_fresh.social_alert_count = 4

        data = {'age': 20, 'gender': 'Male', 'part_time_job': 'No',
                'study_hours_per_day': 2, 'sleep_hours': 7, 'total_social_hours': 4}
        result = planner_fresh.predict(data)
        msg = result['social_alert']['message']
        assert any(word in msg.lower() for word in ['repeated', 'exceeds', 'strongly'])


# ============================================================
#  6. TASK MANAGER TESTS
# ============================================================

class TestTaskManager:

    def test_add_task(self, task_manager):
        """TC-T01: Add a task and verify fields."""
        task = task_manager.add_task('Math', 60, 'high', '5-6 PM')
        assert task['id'] == 'task_1'
        assert task['subject'] == 'Math'
        assert task['duration_minutes'] == 60
        assert task['priority'] == 'high'
        assert task['scheduled_slot'] == '5-6 PM'
        assert task['status'] == 'pending'

    def test_add_multiple_tasks(self, task_manager):
        """TC-T02: Add multiple tasks with auto-incrementing IDs."""
        t1 = task_manager.add_task('Math', 60)
        t2 = task_manager.add_task('Physics', 45)
        t3 = task_manager.add_task('English', 30)
        assert t1['id'] == 'task_1'
        assert t2['id'] == 'task_2'
        assert t3['id'] == 'task_3'
        assert len(task_manager.get_all_tasks()) == 3

    def test_start_task(self, task_manager):
        """TC-T03: Start a task -> status becomes active."""
        task = task_manager.add_task('Math', 60)
        started = task_manager.start_task(task['id'])
        assert started['status'] == 'active'
        assert started['started_at'] is not None

    def test_complete_task(self, task_manager):
        """TC-T04: Complete a task -> status becomes completed."""
        task = task_manager.add_task('Math', 60)
        task_manager.start_task(task['id'])
        completed = task_manager.complete_task(task['id'])
        assert completed['status'] == 'completed'
        assert completed['completed_at'] is not None
        assert len(task_manager.history) == 1

    def test_miss_task(self, task_manager):
        """TC-T05: Miss a task -> status becomes missed."""
        task = task_manager.add_task('Math', 60)
        missed = task_manager.miss_task(task['id'], 'distraction')
        assert missed['status'] == 'missed'
        assert missed['reschedule_reason'] == 'distraction'

    def test_reschedule_task(self, task_manager):
        """TC-T06: Reschedule a task to new slot."""
        task = task_manager.add_task('Math', 60, scheduled_slot='5-6 PM')
        rescheduled = task_manager.reschedule_task(task['id'], '8-9 PM', 'distraction')
        assert rescheduled['status'] == 'rescheduled'
        assert rescheduled['scheduled_slot'] == '8-9 PM'
        assert rescheduled['rescheduled_from'] == '5-6 PM'

    def test_delete_task(self, task_manager):
        """TC-T07: Delete a task."""
        task = task_manager.add_task('Math', 60)
        tid = task['id']
        assert task_manager.delete_task(tid) is True
        assert task_manager.get_task(tid) is None
        # Only check the deleted task is gone, not total count
        assert tid not in task_manager.tasks

    def test_delete_nonexistent_task(self, task_manager):
        """TC-T08: Deleting nonexistent task returns False."""
        assert task_manager.delete_task('task_999') is False

    def test_get_active_task(self, task_manager):
        """TC-T09: Started task is returned as active."""
        t1 = task_manager.add_task('Math', 60)
        task_manager.start_task(t1['id'])
        active = task_manager.get_active_task()
        assert active is not None
        assert active['id'] == t1['id']
        assert active['status'] == 'active'

    def test_no_active_task(self, task_manager):
        """TC-T10: Returns None when no task has been started."""
        task_manager.add_task('Math', 60)
        active = task_manager.get_active_task()
        assert active is None

    def test_stats_calculation(self, task_manager):
        """TC-T11: Stats correctly count task states."""
        t1 = task_manager.add_task('Math', 60)
        t2 = task_manager.add_task('Physics', 45)
        t3 = task_manager.add_task('English', 30)
        t4 = task_manager.add_task('History', 40)

        task_manager.start_task(t1['id'])
        task_manager.complete_task(t1['id'])
        task_manager.start_task(t2['id'])
        task_manager.miss_task(t3['id'])

        stats = task_manager.get_stats()
        completed = [t for t in task_manager.get_all_tasks() if t['status'] == 'completed']
        active = [t for t in task_manager.get_all_tasks() if t['status'] == 'active']
        missed = [t for t in task_manager.get_all_tasks() if t['status'] == 'missed']

        assert len(completed) == 1
        assert len(active) == 1
        assert len(missed) == 1
        assert stats['completed'] == 1
        assert stats['active'] == 1
        assert stats['missed'] == 1

    def test_record_distraction_event(self, task_manager):
        """TC-T12: Distraction event count increments."""
        task = task_manager.add_task('Math', 60)
        task_manager.record_distraction_event(task['id'])
        task_manager.record_distraction_event(task['id'])
        task_manager.record_distraction_event(task['id'])
        assert task_manager.get_task(task['id'])['distraction_events'] == 3

    def test_update_focus_score(self, task_manager):
        """TC-T13: Focus score averages correctly."""
        task = task_manager.add_task('Math', 60)
        task_manager.update_focus_score(task['id'], 0.8)
        assert task_manager.get_task(task['id'])['focus_score_avg'] == 0.8
        task_manager.update_focus_score(task['id'], 0.6)
        assert task_manager.get_task(task['id'])['focus_score_avg'] == 0.7


# ============================================================
#  7. DISTRACTION-AWARE PREDICTION TESTS
# ============================================================

class TestDistractionAware:

    def test_distraction_reduces_probability(self, planner, ideal_student, distracted_state):
        """TC-DA01: Distraction should reduce probability."""
        clean_result = planner.predict(ideal_student)
        distracted_result = planner.predict(ideal_student, distraction_state=distracted_state)
        assert distracted_result['task_completion_probability'] < clean_result['task_completion_probability']
        assert distracted_result['distraction_adjustment'] > 0

    def test_focused_state_no_reduction(self, planner, ideal_student, focused_state):
        """TC-DA02: Focused state should not reduce probability."""
        result = planner.predict(ideal_student, distraction_state=focused_state)
        assert result['distraction_adjustment'] == 0

    def test_distraction_adjustment_capped(self, planner, ideal_student):
        """TC-DA03: Max adjustment is 30%."""
        extreme = {
            'is_distracted': True, 'confidence': 1.0,
            'final_prob': 0.99, 'dominant_app': 'youtube.com',
            'label': 'DISTRACTED', 'app_category': 1.0, 'distraction_streak': 5
        }
        result = planner.predict(ideal_student, distraction_state=extreme)
        assert result['distraction_adjustment'] <= 0.30

    def test_distraction_result_fields(self, planner, ideal_student, distracted_state):
        """TC-DA04: Result contains live_distraction info."""
        result = planner.predict(ideal_student, distraction_state=distracted_state)
        assert 'live_distraction' in result
        ld = result['live_distraction']
        for key in ['is_distracted', 'confidence', 'dominant_app', 'streak']:
            assert key in ld

    def test_original_probability_preserved(self, planner, ideal_student, distracted_state):
        """TC-DA05: original_probability is pre-adjustment value."""
        result = planner.predict(ideal_student, distraction_state=distracted_state)
        assert result['original_probability'] >= result['task_completion_probability']


# ============================================================
#  8. AUTO-RESCHEDULE TESTS
# ============================================================

class TestAutoReschedule:

    def test_extreme_distraction_triggers_reschedule(self, planner, sample_schedule):
        """TC-AR01: confidence > 0.95 triggers reschedule."""
        planner_fresh = AdaptivePlanner()
        if planner_fresh.model is None:
            planner_fresh.train()
        # Clear any persisted tasks
        planner_fresh.task_manager.tasks = {}
        planner_fresh.task_manager.next_id = 1

        task = planner_fresh.task_manager.add_task('Math', 60, 'high', '5-6 PM')
        planner_fresh.task_manager.start_task(task['id'])

        extreme_state = {
            'is_distracted': True, 'confidence': 0.97,
            'final_prob': 0.95, 'dominant_app': 'youtube.com',
            'distraction_streak': 1
        }

        data = {'age': 20, 'study_hours_per_day': 4, 'sleep_hours': 7,
                'total_social_hours': 1, 'schedule': sample_schedule}

        result = planner_fresh.predict(data, distraction_state=extreme_state)
        assert 'reschedule_info' in result
        assert result['reschedule_info']['rescheduled'] is True
        assert result['reschedule_info']['reason'] == 'extreme_distraction'

    def test_no_reschedule_when_focused(self, planner, focused_state, sample_schedule):
        """TC-AR02: Focused state should not trigger reschedule."""
        planner_fresh = AdaptivePlanner()
        if planner_fresh.model is None:
            planner_fresh.train()
        planner_fresh.task_manager.tasks = {}
        planner_fresh.task_manager.next_id = 1

        task = planner_fresh.task_manager.add_task('Math', 60, 'high', '5-6 PM')
        planner_fresh.task_manager.start_task(task['id'])

        data = {'age': 20, 'study_hours_per_day': 8, 'sleep_hours': 8,
                'total_social_hours': 0, 'schedule': sample_schedule}

        result = planner_fresh.predict(data, distraction_state=focused_state)
        assert 'reschedule_info' not in result

    def test_no_reschedule_without_active_task(self, planner, sample_schedule):
        """TC-AR03: No reschedule if no active task."""
        planner_fresh = AdaptivePlanner()
        if planner_fresh.model is None:
            planner_fresh.train()
        # Ensure no tasks at all
        planner_fresh.task_manager.tasks = {}
        planner_fresh.task_manager.next_id = 1

        extreme_state = {
            'is_distracted': True, 'confidence': 0.98,
            'final_prob': 0.95, 'dominant_app': 'youtube.com',
            'distraction_streak': 5
        }

        data = {'age': 20, 'study_hours_per_day': 4, 'sleep_hours': 7,
                'total_social_hours': 1, 'schedule': sample_schedule}

        result = planner_fresh.predict(data, distraction_state=extreme_state)
        assert 'reschedule_info' not in result

    def test_streak_reset_on_focus(self):
        """TC-AR04: Distraction streak resets when focused."""
        planner_fresh = AdaptivePlanner()
        if planner_fresh.model is None:
            planner_fresh.train()

        planner_fresh.distraction_streak = 5
        focused = {
            'is_distracted': False, 'confidence': 0.9,
            'final_prob': 0.1, 'dominant_app': 'pycharm64.exe',
            'distraction_streak': 0
        }

        data = {'age': 20, 'study_hours_per_day': 5, 'sleep_hours': 7,
                'total_social_hours': 0}
        planner_fresh.predict(data, distraction_state=focused)
        assert planner_fresh.distraction_streak == 0


# ============================================================
#  9. FEATURE PREPARATION TESTS
# ============================================================

class TestFeaturePreparation:

    def test_prepare_returns_dataframe(self, planner, ideal_student):
        """TC-FP01: Returns a DataFrame."""
        X = planner._prepare_features(ideal_student)
        assert hasattr(X, 'shape')
        assert X.shape[0] == 1

    def test_prepare_correct_columns(self, planner, ideal_student):
        """TC-FP02: Output columns match feature_columns."""
        X = planner._prepare_features(ideal_student)
        assert list(X.columns) == planner.feature_columns

    def test_prepare_handles_missing_fields(self, planner):
        """TC-FP03: Missing fields use defaults."""
        X = planner._prepare_features({})
        assert X.shape == (1, len(planner.feature_columns))

    def test_gender_encoding_female(self, planner):
        """TC-FP04: Female -> gender_Male=0, gender_Other=0."""
        X = planner._prepare_features({'gender': 'Female'})
        assert X['gender_Male'].values[0] == 0
        assert X['gender_Other'].values[0] == 0

    def test_gender_encoding_male(self, planner):
        """TC-FP05: Male -> gender_Male=1."""
        X = planner._prepare_features({'gender': 'Male'})
        assert X['gender_Male'].values[0] == 1

    def test_job_encoding(self, planner):
        """TC-FP06: Yes -> part_time_job_Yes=1."""
        X = planner._prepare_features({'part_time_job': 'Yes'})
        assert X['part_time_job_Yes'].values[0] == 1


# ============================================================
#  10. API ENDPOINT TESTS
# ============================================================

class TestAPIEndpoints:

    @pytest.fixture(autouse=True)
    def check_server(self):
        import requests
        try:
            r = requests.get('http://127.0.0.1:5000/api/status', timeout=2)
            if r.status_code != 200:
                pytest.skip("API server not returning 200")
        except Exception:
            pytest.skip("API server not running on port 5000")

    def test_planner_predict_endpoint(self):
        """TC-API01: POST /api/planner/predict returns 200."""
        import requests
        data = {'age': 20, 'gender': 'Male', 'part_time_job': 'No',
                'study_hours_per_day': 5, 'sleep_hours': 7, 'total_social_hours': 1}
        r = requests.post('http://127.0.0.1:5000/api/planner/predict', json=data)
        assert r.status_code == 200
        assert 'task_completion_probability' in r.json()

    def test_planner_tasks_crud(self):
        """TC-API02: Task CRUD via API."""
        import requests
        base = 'http://127.0.0.1:5000/api/planner'

        r = requests.post(f'{base}/tasks', json={
            'subject': 'Test Task', 'duration_minutes': 30,
            'priority': 'medium', 'scheduled_slot': '5-6 PM'
        })
        assert r.status_code == 200
        task_id = r.json()['task']['id']

        r = requests.get(f'{base}/tasks')
        assert r.status_code == 200

        r = requests.post(f'{base}/tasks/{task_id}/start')
        assert r.status_code == 200

        r = requests.post(f'{base}/tasks/{task_id}/complete')
        assert r.status_code == 200

    def test_planner_health_endpoint(self):
        """TC-API03: GET /api/planner/health returns model status."""
        import requests
        r = requests.get('http://127.0.0.1:5000/api/planner/health')
        assert r.status_code == 200
        assert 'model_loaded' in r.json()

    def test_distraction_check_endpoint(self):
        """TC-API04: GET /api/planner/distraction-check returns state."""
        import requests
        r = requests.get('http://127.0.0.1:5000/api/planner/distraction-check')
        assert r.status_code == 200


# ============================================================
#  11. EDGE CASE TESTS
# ============================================================

class TestEdgeCases:

    def test_zero_study_zero_social(self, planner):
        """TC-E01: Both study and social at 0."""
        data = {'age': 20, 'study_hours_per_day': 0, 'sleep_hours': 8,
                'total_social_hours': 0}
        result = planner.predict(data)
        assert 0.0 <= result['task_completion_probability'] <= 1.0

    def test_max_values(self, planner):
        """TC-E02: Maximum realistic values."""
        data = {'age': 50, 'study_hours_per_day': 16, 'sleep_hours': 12,
                'total_social_hours': 16}
        result = planner.predict(data)
        assert 0.0 <= result['task_completion_probability'] <= 1.0

    def test_minimum_age(self, planner):
        """TC-E03: Very young student."""
        data = {'age': 13, 'study_hours_per_day': 4, 'sleep_hours': 9,
                'total_social_hours': 1}
        result = planner.predict(data)
        assert 0.0 <= result['task_completion_probability'] <= 1.0

    def test_string_number_inputs(self, planner):
        """TC-E04: String numbers handled by float() conversion."""
        data = {'age': '20', 'study_hours_per_day': '5', 'sleep_hours': '7',
                'total_social_hours': '2'}
        result = planner.predict(data)
        assert 0.0 <= result['task_completion_probability'] <= 1.0

    def test_empty_schedule(self, planner, ideal_student):
        """TC-E05: Empty schedule should not crash."""
        ideal_student['schedule'] = []
        result = planner.predict(ideal_student)
        assert result is not None

    def test_repeated_predictions_stable(self, planner, ideal_student):
        """TC-E06: Same input gives same probability."""
        results = [planner.predict(ideal_student)['task_completion_probability']
                   for _ in range(5)]
        assert all(r == results[0] for r in results)


# ============================================================
#  12. PERSISTENCE & STREAK TESTS
# ============================================================

class TestPersistenceAndStreaks:

    def test_task_persists_to_disk(self):
        """TC-PS01: Added task is saved to JSON file."""
        tm = TaskManager()
        tm.tasks = {}
        tm.next_id = 9000
        task = tm.add_task('Persistence Test', 30)
        assert os.path.exists(tm.tasks_file)
        with open(tm.tasks_file, 'r') as f:
            data = json.load(f)
        assert task['id'] in data['tasks']
        # Cleanup
        tm.delete_task(task['id'])

    def test_streak_increments_on_focus(self):
        """TC-PS02: Streak increments when focused."""
        tm = TaskManager()
        tm.focus_streak = 0
        tm.best_streak = 0
        tm.total_focused_sessions = 0
        tm.total_sessions = 0
        tm.badges = []

        tm.update_streak(True)
        assert tm.focus_streak == 1
        tm.update_streak(True)
        assert tm.focus_streak == 2
        assert tm.best_streak == 2

    def test_streak_resets_on_distraction(self):
        """TC-PS03: Streak resets to 0 when distracted."""
        tm = TaskManager()
        tm.focus_streak = 5
        tm.best_streak = 5
        tm.total_focused_sessions = 5
        tm.total_sessions = 5
        tm.badges = []

        tm.update_streak(False)
        assert tm.focus_streak == 0
        assert tm.best_streak == 5  # best preserved

    def test_badge_awarded_at_milestone(self):
        """TC-PS04: Badge awarded when milestone reached."""
        tm = TaskManager()
        tm.focus_streak = 0
        tm.best_streak = 0
        tm.total_focused_sessions = 0
        tm.total_sessions = 0
        tm.badges = []

        new_badges = tm.update_streak(True)
        assert any(b['id'] == 'first_focus' for b in new_badges)

    def test_badge_not_duplicated(self):
        """TC-PS05: Same badge not awarded twice."""
        tm = TaskManager()
        tm.focus_streak = 0
        tm.best_streak = 0
        tm.total_focused_sessions = 0
        tm.total_sessions = 0
        tm.badges = []

        tm.update_streak(True)  # earns first_focus
        new = tm.update_streak(True)  # should NOT earn first_focus again
        assert not any(b['id'] == 'first_focus' for b in new)

    def test_streak_info_returned(self, planner, ideal_student):
        """TC-PS06: Prediction result contains streak_info."""
        result = planner.predict(ideal_student)
        si = result['streak_info']
        assert 'focus_streak' in si
        assert 'best_streak' in si
        assert 'badges' in si
        assert 'focus_rate' in si

    def test_session_history(self):
        """TC-PS07: Session history tracks completed and missed."""
        tm = TaskManager()
        tm.tasks = {}
        tm.next_id = 1
        tm.history = []

        t1 = tm.add_task('Math', 60)
        t2 = tm.add_task('Physics', 45)
        tm.start_task(t1['id'])
        tm.complete_task(t1['id'])
        tm.miss_task(t2['id'])

        hist = tm.get_session_history()
        assert len(hist['completed_sessions']) == 1
        assert len(hist['missed_sessions']) == 1
        assert hist['total_study_minutes'] == 60


# ============================================================
#  MAIN
# ============================================================

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short', '-x'])
