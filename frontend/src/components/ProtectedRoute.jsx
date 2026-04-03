/**
 * ProtectedRoute – redirects unauthenticated users to /login.
 * Shows a full-screen spinner while auth state is being loaded.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #020b1a 0%, #050d1f 55%, #030a16 100%)',
        flexDirection: 'column', gap: 16,
      }}>
        {/* Animated ring */}
        <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation: 'spin 0.9s linear infinite' }}>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <circle cx="24" cy="24" r="20" stroke="rgba(56,189,248,0.18)" strokeWidth="4" fill="none" />
          <path d="M24 4a20 20 0 0 1 20 20" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
        <p style={{ color: '#475569', fontSize: 13, margin: 0, letterSpacing: '0.05em' }}>
          Verifying session…
        </p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}
