from __future__ import annotations

from flask import Flask, jsonify, request

try:
    from content_classification.service import ContentClassifier
except ImportError:  # pragma: no cover - allows running as a script from this folder
    from service import ContentClassifier


app = Flask(__name__)
classifier = ContentClassifier()


def _classify_request():
    data = request.get_json(silent=True) or {}
    result = classifier.classify(
        title=data.get("title", ""),
        url=data.get("url", ""),
        content=data.get("content", ""),
    )
    return jsonify(result)


@app.route("/")
def home():
    return "Backend is running"


@app.route("/api/content/health")
def health():
    return jsonify(classifier.health())


@app.route("/api/content/check", methods=["POST"])
@app.route("/check_content", methods=["POST"])
def check_content():
    try:
        return _classify_request()
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True)
