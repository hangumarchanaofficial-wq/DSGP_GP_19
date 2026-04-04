from flask import Flask, jsonify, request
from flask_cors import CORS
import traceback
from datetime import datetime, timedelta
from desktop_agent.blocker import app_family

try:
    from desktop_agent.config import BLOCKED_SITES
except ImportError:
    BLOCKED_SITES = []

_planner = None
_content_classifier = None

def get_planner():
    global _planner
    if _planner is None:
        from adaptive_planner.planner_service import AdaptivePlanner
        _planner = AdaptivePlanner()
    return _planner


def get_content_classifier():
    global _content_classifier
    if _content_classifier is None:
        from content_classification.service import ContentClassifier
        _content_classifier = ContentClassifier()
    return _content_classifier


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


def _parse_planner_datetime(value):
    if not value:
        return None
    text = str(value).strip()
    if not text:
        return None
    candidates = [
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M:%S.%f',
    ]
    for fmt in candidates:
        try:
            return datetime.strptime(text, fmt)
        except Exception:
            continue
    try:
        parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
        if parsed.tzinfo is not None:
            return parsed.astimezone().replace(tzinfo=None)
        return parsed
    except Exception:
        return None


def _next_planner_slot(planner, task):
    latest_end = datetime.now() + timedelta(minutes=15)
    for existing in planner.task_manager.get_all_tasks():
        if existing.get('id') == task.get('id'):
            continue
        existing_end = _parse_planner_datetime(existing.get('planned_end'))
        if existing_end and existing_end > latest_end:
            latest_end = existing_end

    duration = max(int(task.get('duration_minutes') or 60), 1)
    start = latest_end.replace(second=0, microsecond=0) + timedelta(minutes=15)
    end = start + timedelta(minutes=duration)
    return {
        'scheduled_slot': f"{start.strftime('%I:%M %p')} - {end.strftime('%I:%M %p')}",
        'planned_start': start.isoformat(),
        'planned_end': end.isoformat(),
    }


def _normalize_app_name(app_name):
    app = str(app_name or "").strip().lower()
    if not app:
        return ""
    return app if app.endswith(".exe") else f"{app}.exe"


def _summarize_distracted_apps(agent, blocked_apps):
    blocker_obj = getattr(agent, 'blocker', None)
    blocked_set = {app_family(app) for app in (blocked_apps or [])}
    manual_set = {app_family(app) for app in (blocker_obj.get_manual_blocked_apps() if blocker_obj else [])}
    auto_set = {app_family(app) for app in (blocker_obj.get_auto_blocked_apps() if blocker_obj else [])}
    distracted = {}

    for entry in getattr(agent, '_prediction_history', []) or []:
        if entry.get('label') != 'DISTRACTED':
            continue

        app = app_family(entry.get('dominant_app'))
        if not app:
            continue

        item = distracted.setdefault(app, {
            'app_name': app,
            'display_name': app,
            'count': 0,
            'latest_confidence': 0.0,
            'latest_probability': 0.0,
            'last_seen': None,
            'is_blocked': False,
            'is_manual_blocked': False,
            'is_auto_blocked': False,
            'auto_block_reason': None,
            'protection_reason': blocker_obj.auto_block_reason(app) if blocker_obj else None,
        })
        item['count'] += 1
        item['latest_confidence'] = max(item['latest_confidence'], float(entry.get('confidence', 0) or 0))
        item['latest_probability'] = max(item['latest_probability'], float(entry.get('final_prob', 0) or 0))
        item['last_seen'] = entry.get('timestamp') or item['last_seen']

    results = []
    for app_name, item in distracted.items():
        item['is_blocked'] = app_name in blocked_set
        item['is_manual_blocked'] = app_name in manual_set
        item['is_auto_blocked'] = app_name in auto_set
        item['auto_block_reason'] = getattr(agent, 'auto_blocked_reasons', {}).get(f"{app_name}.exe")
        results.append(item)

    results.sort(key=lambda item: (-item['count'], -item['latest_confidence'], item['app_name']))
    return results


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
        snap = getattr(agent, 'latest_snapshot', None) or {}

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
            'blocked_apps': blocker_obj.get_manual_blocked_apps() if blocker_obj else [],
            'auto_blocked_apps': blocker_obj.get_auto_blocked_apps() if blocker_obj else [],
            'effective_blocked_apps': blocker_obj.get_effective_blocked_apps() if blocker_obj else [],
            'auto_block_enabled': bool(getattr(agent, 'auto_block_enabled', True)),
            'manual_override_enabled': bool(getattr(agent, 'manual_blocking_enabled', False)),
        }

        blocker_info['distracted_apps'] = _summarize_distracted_apps(
            agent,
            blocker_info['effective_blocked_apps'],
        )

        try:
            classifier_info = get_content_classifier().health()
        except Exception as e:
            classifier_info = {
                'status': 'error',
                'ready': False,
                'error': str(e),
            }

        return jsonify({
            'running': True,
            'snapshots': snap_count,
            'window_size': window_size,
            'window_filled': window_filled,
            'blend_mode': 'adaptive',
            'latest_snapshot': {
                'current_app': snap.get('current_app', ''),
                'current_title': snap.get('current_title', ''),
                'app_category_score': snap.get('app_category_score', 0),
            },
            'prediction': prediction_data,
            'blocker': blocker_info,
            'content_classifier': classifier_info,
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
            if hasattr(agent, 'set_manual_blocking'):
                agent.set_manual_blocking(True)
            else:
                agent.blocker.enable()
                agent.blocking_active = True
            return jsonify({'status': 'blocking_enabled'})
        return jsonify({'error': 'Blocker not available'}), 503

    @app.route('/api/unblock', methods=['POST'])
    def unblock():
        if hasattr(agent, 'blocker') and agent.blocker:
            if hasattr(agent, 'set_manual_blocking'):
                agent.set_manual_blocking(False)
            else:
                agent.blocker.disable()
                agent.blocking_active = False
            return jsonify({'status': 'blocking_disabled'})
        return jsonify({'error': 'Blocker not available'}), 503

    @app.route('/api/blocker/settings', methods=['POST'])
    def update_blocker_settings():
        data = request.get_json() or {}
        if 'auto_block_enabled' not in data:
            return jsonify({'error': 'auto_block_enabled is required'}), 400

        enabled = bool(data.get('auto_block_enabled'))
        if hasattr(agent, 'set_auto_block_enabled'):
            agent.set_auto_block_enabled(enabled)
        else:
            agent.auto_block_enabled = enabled

        blocker_obj = getattr(agent, 'blocker', None)
        blocked_apps = blocker_obj.get_manual_blocked_apps() if blocker_obj else []
        return jsonify({
            'status': 'ok',
            'auto_block_enabled': bool(getattr(agent, 'auto_block_enabled', enabled)),
            'manual_override_enabled': bool(getattr(agent, 'manual_blocking_enabled', False)),
            'is_blocking': bool(getattr(agent, 'blocking_active', False)),
            'blocked_apps': blocked_apps,
            'auto_blocked_apps': blocker_obj.get_auto_blocked_apps() if blocker_obj else [],
            'effective_blocked_apps': blocker_obj.get_effective_blocked_apps() if blocker_obj else [],
            'distracted_apps': _summarize_distracted_apps(
                agent,
                blocker_obj.get_effective_blocked_apps() if blocker_obj else [],
            ),
        })

    @app.route('/api/blocker/apps')
    def blocker_apps():
        blocker_obj = getattr(agent, 'blocker', None)
        blocked_apps = blocker_obj.get_manual_blocked_apps() if blocker_obj else []
        return jsonify({
            'blocked_apps': blocked_apps,
            'auto_blocked_apps': blocker_obj.get_auto_blocked_apps() if blocker_obj else [],
            'effective_blocked_apps': blocker_obj.get_effective_blocked_apps() if blocker_obj else [],
            'distracted_apps': _summarize_distracted_apps(
                agent,
                blocker_obj.get_effective_blocked_apps() if blocker_obj else [],
            ),
        })

    @app.route('/api/blocker/apps', methods=['POST'])
    def update_blocker_app():
        blocker_obj = getattr(agent, 'blocker', None)
        if not blocker_obj:
            return jsonify({'error': 'Blocker not available'}), 503

        data = request.get_json() or {}
        app_name = data.get('app_name', '')
        action = data.get('action', '').strip().lower()
        normalized_app = _normalize_app_name(app_name)

        if not normalized_app:
            return jsonify({'error': 'app_name is required'}), 400
        if action not in {'block', 'unblock'}:
            return jsonify({'error': 'action must be block or unblock'}), 400

        if action == 'block':
            blocked_apps = blocker_obj.add_blocked_app(normalized_app)
        else:
            blocked_apps = blocker_obj.remove_blocked_app(normalized_app)

        return jsonify({
            'status': 'ok',
            'blocked_apps': blocked_apps,
            'auto_blocked_apps': blocker_obj.get_auto_blocked_apps(),
            'effective_blocked_apps': blocker_obj.get_effective_blocked_apps(),
            'distracted_apps': _summarize_distracted_apps(agent, blocker_obj.get_effective_blocked_apps()),
        })

    @app.route('/api/content/health')
    def content_health():
        try:
            return jsonify(get_content_classifier().health())
        except Exception as e:
            return jsonify({'status': 'error', 'ready': False, 'error': str(e)}), 500

    @app.route('/api/content/check', methods=['POST'])
    def content_check():
        try:
            data = request.get_json() or {}
            result = get_content_classifier().classify(
                title=data.get('title', ''),
                url=data.get('url', ''),
                content=data.get('content', ''),
            )
            return jsonify(result)
        except RuntimeError as e:
            return jsonify({'error': str(e)}), 503
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500

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
            # Optional content_state from browser extension / frontend
            content_state = data.pop('content_state', None)
            # Also accept latest content state stored on agent (set by browser extension)
            if content_state is None:
                content_state = getattr(agent, 'latest_content_state', None)
            active_task = planner.task_manager.get_active_task()
            if active_task is None:
                pending_tasks = planner.task_manager.get_pending_tasks()
                active_task = pending_tasks[0] if pending_tasks else None
            result = planner.predict(
                data,
                task=active_task,
                distraction_state=distraction_state,
                content_state=content_state,
            )
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
                'today_study_seconds': planner.task_manager.get_today_study_seconds(),
                'streak_info': planner.task_manager.get_streak_info(),
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
                planned_start=data.get('planned_start'),
                planned_end=data.get('planned_end'),
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

    @app.route('/api/planner/tasks/<task_id>/pause', methods=['POST'])
    def pause_task(task_id):
        try:
            planner = get_planner()
            data = request.get_json() or {}
            task = planner.task_manager.pause_task(
                task_id,
                remaining_seconds=data.get('remaining_seconds'),
                elapsed_seconds=data.get('elapsed_seconds'),
            )
            if not task:
                return jsonify({'error': 'Task not found'}), 404
            return jsonify({'task': task, 'stats': planner.task_manager.get_stats()})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/tasks/<task_id>/resume', methods=['POST'])
    def resume_task(task_id):
        try:
            planner = get_planner()
            task = planner.task_manager.resume_task(task_id)
            if not task:
                return jsonify({'error': 'Task not found'}), 404
            return jsonify({'task': task})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/tasks/<task_id>/complete', methods=['POST'])
    def complete_task(task_id):
        try:
            planner = get_planner()
            data = request.get_json(silent=True) or {}
            # Use planner wrapper so profiler + trend analyzer are updated
            task = planner.complete_task(task_id, elapsed_seconds=data.get('elapsed_seconds'))
            if not task:
                return jsonify({'error': 'Task not found'}), 404
            return jsonify({'task': task, 'stats': planner.task_manager.get_stats()})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/tasks/<task_id>/miss', methods=['POST'])
    def miss_task(task_id):
        try:
            planner = get_planner()
            # Use planner wrapper so profiler + trend analyzer are updated
            task = planner.miss_task(task_id)
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

    @app.route('/api/planner/check-missed', methods=['POST'])
    def check_missed_tasks():
        try:
            planner = get_planner()
            missed = planner.task_manager.get_missed_tasks()
            return jsonify({'missed_tasks': missed})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/tasks/<task_id>/handle-missed', methods=['POST'])
    def handle_missed_task(task_id):
        try:
            planner = get_planner()
            task = planner.task_manager.get_task(task_id)
            if not task:
                return jsonify({'error': 'Task not found'}), 404

            data = request.get_json() or {}
            action = data.get('action')

            if action == 'delete':
                planner.task_manager.delete_task(task_id)
                return jsonify({'deleted': True, 'stats': planner.task_manager.get_stats()})

            if action == 'reschedule':
                slot = _next_planner_slot(planner, task)
                updated = planner.task_manager.reschedule_task(
                    task_id,
                    slot['scheduled_slot'],
                    reason='missed_task_rescheduled',
                    planned_start=slot['planned_start'],
                    planned_end=slot['planned_end'],
                )
                return jsonify({'task': updated, 'stats': planner.task_manager.get_stats()})

            return jsonify({'error': 'Unsupported action'}), 400
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/analytics')
    def planner_analytics():
        try:
            planner = get_planner()
            return jsonify(planner.get_analytics())
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/smart-schedule')
    def planner_smart_schedule():
        try:
            planner = get_planner()
            return jsonify(planner.get_smart_schedule())
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/profile')
    def planner_profile():
        try:
            planner = get_planner()
            return jsonify(planner.profiler.get_profile_summary())
        except Exception as e:
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500

    @app.route('/api/planner/content-check', methods=['POST'])
    def planner_content_check():
        """
        Classify content (title/url/text) and store the result on the agent
        so the next planner predict call can use it automatically.
        """
        try:
            data = request.get_json() or {}
            classifier = get_content_classifier()
            content_result = classifier.classify(
                title=data.get('title', ''),
                url=data.get('url', ''),
                content=data.get('content', ''),
            )
            # Store latest content state on agent for automatic pickup
            agent.latest_content_state = content_result

            # Also let the planner analyze it immediately
            planner = get_planner()
            context = planner.analyze_content_context(content_result)
            return jsonify({
                'classification': content_result,
                'planner_context': context,
            })
        except RuntimeError as e:
            return jsonify({'error': str(e)}), 503
        except Exception as e:
            traceback.print_exc()
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
