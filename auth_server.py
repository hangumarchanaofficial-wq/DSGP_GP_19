"""
SDPPS Authentication Server
Port: 5001
Endpoints:
  POST /auth/register  – create account
  POST /auth/login     – return JWT access token
  POST /auth/logout    – client-side token drop (stateless JWT)
  GET  /auth/me        – return current user info
  GET  /auth/verify    – validate token, 200 = ok / 401 = expired/invalid
"""

import os
import re
import sqlite3
import hashlib
import hmac
import base64
import json
import time
import secrets
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS

# ──────────────────────────────────────────────────────────
#  CONFIG
# ──────────────────────────────────────────────────────────
SECRET_KEY   = os.environ.get("SDPPS_SECRET", secrets.token_hex(32))
TOKEN_TTL    = int(os.environ.get("SDPPS_TOKEN_TTL", 60 * 60 * 24 * 7))   # 7 days
DB_PATH      = os.path.join(os.path.dirname(__file__), "common", "users.db")

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

# ──────────────────────────────────────────────────────────
#  DATABASE
# ──────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT    NOT NULL,
                email       TEXT    NOT NULL UNIQUE,
                password    TEXT    NOT NULL,
                created_at  TEXT    NOT NULL,
                last_login  TEXT
            )
        """)
        conn.commit()


# ──────────────────────────────────────────────────────────
#  PASSWORD HASHING – PBKDF2-HMAC-SHA256
# ──────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk   = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, dk_hex = stored.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


# ──────────────────────────────────────────────────────────
#  MINIMAL JWT (HS256) – no external lib required
# ──────────────────────────────────────────────────────────
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * pad)


def make_token(user_id: int, email: str) -> str:
    header  = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({
        "sub":   user_id,
        "email": email,
        "iat":   int(time.time()),
        "exp":   int(time.time()) + TOKEN_TTL,
    }).encode())
    sig_input = f"{header}.{payload}".encode()
    sig = _b64url(hmac.new(SECRET_KEY.encode(), sig_input, "sha256").digest())
    return f"{header}.{payload}.{sig}"


def decode_token(token: str) -> dict:
    """Returns payload dict or raises ValueError."""
    try:
        header, payload, sig = token.split(".")
    except ValueError:
        raise ValueError("Malformed token")

    # Verify signature
    sig_input = f"{header}.{payload}".encode()
    expected  = _b64url(hmac.new(SECRET_KEY.encode(), sig_input, "sha256").digest())
    if not hmac.compare_digest(sig, expected):
        raise ValueError("Invalid signature")

    data = json.loads(_b64url_decode(payload))
    if data.get("exp", 0) < time.time():
        raise ValueError("Token expired")
    return data


def get_current_user():
    """Parse Bearer token from header. Returns user Row or None."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None, "No token provided"
    token = auth[7:]
    try:
        payload = decode_token(token)
    except ValueError as exc:
        return None, str(exc)

    with get_db() as conn:
        user = conn.execute(
            "SELECT id, name, email, created_at, last_login FROM users WHERE id = ?",
            (payload["sub"],)
        ).fetchone()
    if not user:
        return None, "User not found"
    return user, None


# ──────────────────────────────────────────────────────────
#  FLASK APP
# ──────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/auth/*": {"origins": "*"}})

init_db()


def bad(msg: str, code: int = 400):
    return jsonify({"error": msg}), code


# ── REGISTER ───────────────────────────────────────────────
@app.route("/auth/register", methods=["POST"])
def register():
    data     = request.get_json(silent=True) or {}
    name     = str(data.get("name",     "")).strip()
    email    = str(data.get("email",    "")).strip().lower()
    password = str(data.get("password", "")).strip()

    # Validation
    if not name:
        return bad("Name is required.")
    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return bad("Enter a valid email address.")
    if len(password) < 6:
        return bad("Password must be at least 6 characters.")
    if len(password) > 128:
        return bad("Password too long.")

    hashed = hash_password(password)
    now    = datetime.utcnow().isoformat()

    try:
        with get_db() as conn:
            conn.execute(
                "INSERT INTO users (name, email, password, created_at) VALUES (?,?,?,?)",
                (name, email, hashed, now),
            )
            conn.commit()
            user = conn.execute(
                "SELECT id, name, email, created_at, last_login FROM users WHERE email = ?", (email,)
            ).fetchone()
    except sqlite3.IntegrityError:
        return bad("An account with that email already exists.", 409)

    token = make_token(user["id"], user["email"])
    return jsonify({
        "message": "Account created successfully.",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "created_at": user["created_at"],
            "last_login": user["last_login"],
        },
    }), 201


# ── LOGIN ──────────────────────────────────────────────────
@app.route("/auth/login", methods=["POST"])
def login():
    data     = request.get_json(silent=True) or {}
    email    = str(data.get("email",    "")).strip().lower()
    password = str(data.get("password", "")).strip()

    if not email or not password:
        return bad("Email and password are required.")

    with get_db() as conn:
        user = conn.execute(
            "SELECT id, name, email, password, created_at FROM users WHERE email = ?", (email,)
        ).fetchone()

    if not user or not verify_password(password, user["password"]):
        return bad("Invalid email or password.", 401)

    # Update last_login
    last_login = datetime.utcnow().isoformat()
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET last_login=? WHERE id=?",
            (last_login, user["id"]),
        )
        conn.commit()

    token = make_token(user["id"], user["email"])
    return jsonify({
        "message": "Login successful.",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "created_at": user["created_at"],
            "last_login": last_login,
        },
    })


# ── LOGOUT (stateless – client drops the token) ────────────
@app.route("/auth/logout", methods=["POST"])
def logout():
    # For stateless JWT we just tell the client to discard the token.
    # If you want server-side revocation, add a blocklist table here.
    return jsonify({"message": "Logged out successfully."})


# ── ME ─────────────────────────────────────────────────────
@app.route("/auth/me", methods=["GET"])
def me():
    user, err = get_current_user()
    if err:
        return bad(err, 401)
    return jsonify({
        "id":         user["id"],
        "name":       user["name"],
        "email":      user["email"],
        "created_at": user["created_at"],
        "last_login": user["last_login"],
    })


# ── VERIFY ─────────────────────────────────────────────────
@app.route("/auth/verify", methods=["GET"])
def verify():
    """Returns 200 if token is valid, 401 otherwise."""
    user, err = get_current_user()
    if err:
        return bad(err, 401)
    return jsonify({"valid": True, "user_id": user["id"]})


# ── HEALTH ─────────────────────────────────────────────────
@app.route("/auth/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "SDPPS Auth Server"})


# ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("[Auth] SDPPS Authentication Server starting on http://127.0.0.1:5001")
    app.run(host="127.0.0.1", port=5001, debug=False)
