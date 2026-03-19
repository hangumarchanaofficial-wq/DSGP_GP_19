"""
api_server.py — Flask API for the React frontend.
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from desktop_agent.config import BLOCKED_SITES


def create_app(agent):
    app = Flask(__name__)
    CORS(app)

    @app.route("/api/status")
    def status():
        snap = agent.latest_snapshot
        result = agent.latest_prediction
        predictor = agent.predictor

        response = {
            "running": True,
            "snapshots": agent.snapshot_count,
            "window_size": predictor.window_size,
            "window_filled": predictor.ready(),
            "blend_mode": predictor.blend_mode,
            "prediction": None,
            "blocker": {
                "is_blocking": agent.blocking_active,
                "is_admin": agent.blocker.is_admin,
                "blocked_sites": BLOCKED_SITES if agent.blocking_active else [],
            },
        }

        if result:
            response["prediction"] = {
                "label": result["label"],
                "probability": result["final_prob"],
                "bilstm_prob": result["bilstm_prob"],
                "app_category": result["app_cat_score"],
                "app_cat_label": result["app_cat_label"],
                "dominant_app": result["dominant_app"],
                "blend_mode": result["blend_mode"],
                "confidence": result["confidence"],
                "is_distracted": result["label"] == "DISTRACTED",
                "attention": result.get("attention", []),
                "timestamp": result.get("timestamp", ""),
            }

        return jsonify(response)

    @app.route("/api/predict")
    def predict():
        if not agent.predictor.ready():
            return jsonify({
                "error": "Not enough data",
                "snapshots": agent.snapshot_count,
                "window_size": agent.predictor.window_size,
            }), 425
        result = agent.predictor.predict()
        if result:
            agent.latest_prediction = result
        return jsonify(result)

    @app.route("/api/features")
    def features():
        return jsonify({
            "latest_snapshot": agent.latest_snapshot,
            "window_size": len(agent.predictor.window),
            "feature_columns": agent.predictor.feature_columns,
        })

    @app.route("/api/history")
    def history():
        return jsonify(agent.predictor.get_history())

    @app.route("/api/block", methods=["POST"])
    def block():
        agent.blocker.enable()
        agent.blocking_active = True
        return jsonify({"status": "blocking_enabled", "is_blocking": True})

    @app.route("/api/unblock", methods=["POST"])
    def unblock():
        agent.blocker.disable()
        agent.blocking_active = False
        return jsonify({"status": "blocking_disabled", "is_blocking": False})

    return app
