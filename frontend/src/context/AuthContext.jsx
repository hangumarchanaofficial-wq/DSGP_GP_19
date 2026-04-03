/**
 * AuthContext – global authentication state for SDPPS
 *
 * Provides:
 *   - user, token, loading, error
 *   - login(email, password)
 *   - register(name, email, password)
 *   - logout()
 *   - isAuthenticated
 *
 * Token is stored in localStorage as "sdpps_token".
 * On mount the context verifies the stored token with the backend.
 * If invalid / expired the user is automatically signed out.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY  = 'sdpps_token';
const AUTH_BASE  = '/auth';   // proxied by Vite → http://127.0.0.1:5001

// ── helper ────────────────────────────────────────────────────────────────────
async function authFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res  = await fetch(`${AUTH_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);   // true while verifying on mount
  const [error,   setError]   = useState(null);

  // ── Verify token on mount / token change ─────────────────────────────────
  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    authFetch('/verify')
      .then(({ ok, data }) => {
        if (!ok) {
          // Token invalid / expired → sign out silently
          _clearSession();
          return;
        }
        // Fetch full profile
        return authFetch('/me').then(({ ok: ok2, data: me }) => {
          if (ok2) setUser(me);
          else _clearSession();
        });
      })
      .catch(() => _clearSession())
      .finally(() => setLoading(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Internal helpers ──────────────────────────────────────────────────────
  function _saveSession(tok, usr) {
    localStorage.setItem(TOKEN_KEY, tok);
    setToken(tok);
    setUser(usr);
    setError(null);
  }

  function _clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  // ── Public actions ─────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setError(null);
    const { ok, data } = await authFetch('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!ok) {
      setError(data.error || 'Login failed.');
      return { success: false, error: data.error || 'Login failed.' };
    }
    _saveSession(data.token, data.user);
    return { success: true };
  }, []);

  const register = useCallback(async (name, email, password) => {
    setError(null);
    const { ok, data } = await authFetch('/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (!ok) {
      setError(data.error || 'Registration failed.');
      return { success: false, error: data.error || 'Registration failed.' };
    }
    _saveSession(data.token, data.user);
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    // Best-effort server-side notification
    await authFetch('/logout', { method: 'POST' }).catch(() => {});
    _clearSession();
  }, []);

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
