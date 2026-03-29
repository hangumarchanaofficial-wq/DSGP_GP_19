from __future__ import annotations

from pathlib import Path
from threading import Lock
from urllib.parse import urlparse

import joblib


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "Models" / "content_classifier_svm.pkl"
VECTORIZER_PATH = BASE_DIR / "Models" / "tfidf_vectorizer.pkl"

_NOISE_WORDS = ("google", "search", "youtube")
_EDUCATION_KEYWORDS = (
    "learn", "tutorial", "course", "math", "science",
    "education", "lecture", "study", "algorithm", "programming",
)
_LOW_SIGNAL_URL_RULES = {
    "youtube.com": {"/", "/feed", "/feed/subscriptions", "/feed/history", "/shorts"},
    "www.youtube.com": {"/", "/feed", "/feed/subscriptions", "/feed/history", "/shorts"},
    "google.com": {"/"},
    "www.google.com": {"/"},
}


class ContentClassifier:
    def __init__(self) -> None:
        self._model = None
        self._vectorizer = None
        self._load_error = None
        self._lock = Lock()

    @property
    def ready(self) -> bool:
        return self._model is not None and self._vectorizer is not None

    def health(self) -> dict:
        if not self.ready:
            self._ensure_loaded()
        return {
            "status": "ok" if self.ready else "error",
            "ready": self.ready,
            "model_path": str(MODEL_PATH),
            "vectorizer_path": str(VECTORIZER_PATH),
            "error": self._load_error,
        }

    def classify(self, *, title: str = "", url: str = "", content: str = "") -> dict:
        self._ensure_loaded()
        if not self.ready:
            raise RuntimeError(self._load_error or "Content classifier failed to load")

        title = (title or "").strip()
        url = (url or "").strip()
        content = (content or "").strip()
        word_count = len(content.split())
        normalized_url = url.lower().strip()

        if self._is_low_signal_page(normalized_url):
            return {
                "result": "pending",
                "reason": "low_signal_page",
                "word_count": word_count,
                "title": title,
                "url": url,
            }

        if word_count < 5:
            return {
                "result": "pending",
                "reason": "not_enough_content",
                "word_count": word_count,
                "title": title,
                "url": url,
            }

        cleaned_text = self._normalize(f"{title} {content[:2000]}")
        keyword_hits = [kw for kw in _EDUCATION_KEYWORDS if kw in cleaned_text]
        prediction = self._predict(cleaned_text, keyword_hits)
        label = "educational" if prediction == 1 else "non_educational"

        return {
            "result": "allow" if prediction == 1 else "block",
            "label": label,
            "prediction": int(prediction),
            "word_count": word_count,
            "title": title,
            "url": url,
            "keyword_hits": keyword_hits,
        }

    def _ensure_loaded(self) -> None:
        if self.ready:
            return
        with self._lock:
            if self.ready:
                return
            try:
                self._model = joblib.load(MODEL_PATH)
                self._vectorizer = joblib.load(VECTORIZER_PATH)
                self._load_error = None
            except Exception as exc:
                self._model = None
                self._vectorizer = None
                self._load_error = str(exc)

    def _normalize(self, text: str) -> str:
        cleaned = text.lower().strip()
        for word in _NOISE_WORDS:
            cleaned = cleaned.replace(word, "")
        return " ".join(cleaned.split())

    def _predict(self, text: str, keyword_hits: list[str]) -> int:
        text_vectorized = self._vectorizer.transform([text])
        prediction = int(self._model.predict(text_vectorized)[0])
        if len(keyword_hits) >= 2:
            return 1
        return prediction

    def _is_low_signal_page(self, url: str) -> bool:
        if not url:
            return False

        parsed = urlparse(url)
        host = parsed.netloc.lower()
        path = parsed.path or "/"

        if host in _LOW_SIGNAL_URL_RULES and path in _LOW_SIGNAL_URL_RULES[host]:
            return True

        # A bare homepage/feed on mixed-use sites is not enough evidence to block.
        if host.endswith("youtube.com") and path == "/":
            return True

        return False
