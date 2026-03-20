from flask import Flask, jsonify, request
from flask_cors import CORS
import traceback

try:
    from desktop_agent.config import BLOCKED_SITES
except ImportError:
    BLOCKED_SITES = []

_planner = None

def get_planner():
    global _planner
    if _planner is None:
        from adaptive_planner.planner_service import AdaptivePlanner
        _planner = AdaptivePlanner()
    return _planner


def _get_distraction_state(agent):
    try:
        last = getattr(agent, 'latest_prediction', None)
        if last is None:
            return None
        final_prob = last.get('final_prob', 0.5)
        is_dist = final_prob >= 0.5
        conf = last.get('confidence', abs(final_prob - 0.5) * 2)
        return {
            'is_distracted': is_dist,
            'confidence': conf,
            'final_prob': final_prob,
            'bilstm_prob': last.get('bilstm_prob', 0),
            'dominant_app': last.get('dominant_app', 'unknown'),
            'label': last.get('label', 'UNKNOWN'),
            'app_category': last.get('app_cat_score', 0.5),
            'distraction_streak': last.get('streak_count', 0),
        }
    except Exception:
        return None


def create_app(agent):
    app = Flask(__name__)
    CORS(app)

    # Store prediction history in the app context
    if not hasattr(agent, '_prediction_history'):
        agent._prediction_history = []

    @app.route('/api/status')
    def status():
        snap_count = getattr(agent, 'snapshot_count', 0)
        window_size = agent.predictor.window_size if hasattr(agent, 'predictor') and agent.predictor else 10
        window_filled = snap_count >= window_size

        pred = getattr(agent, 'latest_prediction', None)

        prediction_data = None
        if pred:
            final = pred.get('final_prob', 0)
            is_dist = final >= 0.5
            conf = pred.get('confidence', 0)
            prediction_data = {
                'label': pred.get('label', 'UNKNOWN'),
                'probability': final,
                'is_distracted': is_dist,
                'confidence': conf,
                'bilstm_prob': pred.get('bilstm_prob', 0),
                'bilstm_full': pred.get('bilstm_full', 0),
                'bilstm_recent': pred.get('bilstm_recency', 0),
                'app_category': pred.get('app_cat_score', 0),
                'app_cat_label': pred.get('app_cat_label', 'unknown'),
                'dominant_app': pred.get('dominant_app', ''),
                'blend_mode': pred.get('blend_mode', 'adaptive'),
                'attention': pred.get('attention', []),
                'streak_count': pred.get('streak_count', 0),
            }

        blocking = getattr(agent, 'blocking_active', False)
        blocker_obj = getattr(agent, 'blocker', None)
        is_admin = getattr(blocker_obj, 'is_admin', False) if blocker_obj else False

        blocker_info = {
            'is_blocking': bool(blocking),
            'is_admin': bool(is_admin),
            'blocked_sites': BLOCKED_SITES,
        }

        return jsonify({
            'running': True,
            'snapshots': snap_count,
            'window_size': window_size,
            'window_filled': window_filled,
            'blend_mode': 'adaptive',
            'prediction': prediction_data,
            'blocker': blocker_info,
        })

    @app.route('/api/predict')
    def predict():
        if not hasattr(agent, 'predictor') or agent.predictor is None:
            return jsonify({'error': 'Predictor not ready'}), 503
        snap = getattr(agent, 'latest_snapshot', None)
        if snap is None:
            return jsonify({'error': 'No snapshot available'}), 503
        try:
            result = agent.predictor.predict(snap)
            agent.latest_prediction = result
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/features')
    def features():
        snap = getattr(agent, 'latest_snapshot', {}) or {}
        return jsonify({
            'latest_snapshot': snap,
            'window_size': agent.predictor.window_size if hasattr(agent, 'predictor') and agent.predictor else 10,
            'feature_columns': getattr(agent.predictor, 'feature_columns', []) if hasattr(agent, 'predictor') else [],
        })

    @app.route('/api/history')
    def history():
        return jsonify(agent._prediction_history)

    @app.route('/api/block', methods=['POST'])
    def block():
        if hasattr(agent, 'blocker') and agent.blocker:
            agent.blocker.enable()
            agent.blocking_active = True
            return jsonify({'status': 'blocking_enabled'})
        return jsonify({'error': 'Blocker not available'}), 503

    @app.route('/api/unblock', methods=['POST'])
    def unblock():
        if hasattr(agent, 'blocker') and agent.blocker:
            agent.blocker.disable()
            agent.blocking_active = False
            return jsonify({'status': 'blocking_disabled'})
        return jsonify({'error': 'Blocker not available'}), 503

    # ──────────────────────────────────────────────
    # PLANNER ENDPOINTS
    # ──────────────────────────────────────────────

    @app.route('/api/planner/predict', methods=['POST'])
    def planner_predict():
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No JSON body'}), 400
            required = ['age', 'gender', 'part_time_job',
                        'study_hours_per_day', 'sleep_hours', 'total_social_hours']
            missing = [f for f in required if f not in data]
            if missing:
                return jsonify({'error': f'Missing fields: {missing}'}), 400
            planner = get_planner()
            distraction_state = _get_distraction_state(agent)
            result = planner.predict(data, distraction_state=distraction_state)
            return jsonify(result)
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/health')
    def planner_health():
        try:
            planner = get_planner()
            return jsonify({
                'status': 'ok',
                'model_loaded': planner.model is not None,
                'task_stats': planner.task_manager.get_stats(),
            })
        except Exception as e:
            return jsonify({'status': 'error', 'message': str(e)}), 500

    @app.route('/api/planner/tasks', methods=['GET'])
    def get_tasks():
        try:
            planner = get_planner()
            return jsonify({
                'tasks': planner.task_manager.get_all_tasks(),
                'stats': planner.task_manager.get_stats(),
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/tasks', methods=['POST'])
    def add_task():
        try:
            data = request.get_json()
            if not data or 'subject' not in data:
                return jsonify({'error': 'subject is required'}), 400
            planner = get_planner()
            task = planner.task_manager.add_task(
                subject=data['subject'],
                duration_minutes=data.get('duration_minutes', 60),
                priority=data.get('priority', 'medium'),
                scheduled_slot=data.get('scheduled_slot'),
                notes=data.get('notes', ''),
            )
            return jsonify({'task': task, 'stats': planner.task_manager.get_stats()})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/tasks/<task_id>/start', methods=['POST'])
    def start_task(task_id):
        try:
            planner = get_planner()
            task = planner.task_manager.start_task(task_id)
            if not task:
                return jsonify({'error': 'Task not found'}), 404
            return jsonify({'task': task})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/tasks/<task_id>/complete', methods=['POST'])
    def complete_task(task_id):
        try:
            planner = get_planner()
            task = planner.task_manager.complete_task(task_id)
            if not task:
                return jsonify({'error': 'Task not found'}), 404
            return jsonify({'task': task, 'stats': planner.task_manager.get_stats()})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/tasks/<task_id>/miss', methods=['POST'])
    def miss_task(task_id):
        try:
            planner = get_planner()
            task = planner.task_manager.miss_task(task_id)
            if not task:
                return jsonify({'error': 'Task not found'}), 404
            return jsonify({'task': task, 'stats': planner.task_manager.get_stats()})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/tasks/<task_id>', methods=['DELETE'])
    def delete_task(task_id):
        try:
            planner = get_planner()
            deleted = planner.task_manager.delete_task(task_id)
            if not deleted:
                return jsonify({'error': 'Task not found'}), 404
            return jsonify({'deleted': True, 'stats': planner.task_manager.get_stats()})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/distraction-check', methods=['GET'])
    def distraction_check():
        try:
            planner = get_planner()
            distraction_state = _get_distraction_state(agent)
            active_task = planner.task_manager.get_active_task()
            result = {
                'distraction_state': distraction_state,
                'active_task': active_task,
                'distraction_streak': planner.distraction_streak,
            }
            if distraction_state and active_task:
                schedule_data = []
                for t in planner.task_manager.get_pending_tasks():
                    schedule_data.append({
                        'time': t.get('scheduled_slot', ''),
                        'status': 'free'
                    })
                reschedule = planner._check_distraction_reschedule(
                    distraction_state, schedule_data, active_task)
                if reschedule:
                    result['auto_reschedule'] = reschedule
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return app
