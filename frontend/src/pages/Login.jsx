// frontend/src/pages/Login.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Rocket, Mail, Lock, Eye, EyeOff,
  Zap, Shield, BarChart3, ArrowRight, CheckCircle2,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   Wave divider — matches Register exactly
───────────────────────────────────────────────────────────── */
function WaveDivider() {
  return (
    <div style={{
      position: 'absolute', top: 0, right: -1,
      height: '100%', width: 70,
      zIndex: 10, pointerEvents: 'none',
    }}>
      <svg
        viewBox="0 0 70 900"
        preserveAspectRatio="none"
        style={{ height: '100%', width: '100%', display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0,0
             C28,60  0,120  28,180
             C56,240 0,300  28,360
             C56,420 0,480  28,540
             C56,600 0,660  28,720
             C56,780 0,840  28,900
             L70,900 L70,0 Z"
          fill="#050d1f"
        />
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Ambient glow blobs — same as Register
───────────────────────────────────────────────────────────── */
function PanelBlobs() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', borderRadius: '50%',
        width: 380, height: 380, top: -100, right: -80,
        background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 65%)',
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%',
        width: 280, height: 280, bottom: -70, left: -60,
        background: 'radial-gradient(circle, rgba(100,190,255,0.18) 0%, transparent 65%)',
      }} />
      <div style={{
        position: 'absolute', borderRadius: '50%',
        width: 200, height: 200, top: '45%', left: '20%',
        background: 'radial-gradient(circle, rgba(80,160,255,0.10) 0%, transparent 65%)',
      }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Feature card — shown in left panel
───────────────────────────────────────────────────────────── */
function FeatureCard({ icon: Icon, title, desc }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 16px', borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.14)',
        background: hovered ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
        transition: 'all 0.2s', cursor: 'default',
      }}
    >
      {/* Icon badge */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.20)',
      }}>
        <Icon size={17} color="white" />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'white' }}>{title}</p>
        <p style={{ margin: 0, fontSize: 11.5, color: 'rgba(255,255,255,0.58)', marginTop: 2 }}>{desc}</p>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   LOGIN PAGE
═════════════════════════════════════════════════════════════ */
export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors,   setErrors]   = useState({});
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const navigate = useNavigate();

  /* validation */
  const validate = () => {
    const e = {};
    if (!/\S+@\S+\.\S+/.test(email))  e.email    = 'Enter a valid email address.';
    if (password.length < 6)           e.password = 'Password must be at least 6 characters.';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    setTimeout(() => { setLoading(false); setDone(true); }, 800);
    setTimeout(() => navigate('/dashboard'), 2000);
  };

  const canSubmit = email && password.length >= 6;

  /* shared input style */
  const inputStyle = (hasErr) => ({
    width: '100%',
    padding: '13px 14px 13px 42px',
    borderRadius: 12,
    border: `1.5px solid ${hasErr ? '#ef4444' : 'rgba(255,255,255,0.10)'}`,
    background: 'rgba(255,255,255,0.04)',
    color: 'white',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  });

  const onFocus = (e) => {
    e.target.style.borderColor = '#38bdf8';
    e.target.style.boxShadow   = '0 0 0 3px rgba(56,189,248,0.15)';
  };
  const onBlur = (hasErr) => (e) => {
    e.target.style.borderColor = hasErr ? '#ef4444' : 'rgba(255,255,255,0.10)';
    e.target.style.boxShadow   = 'none';
  };

  /* label style */
  const labelStyle = (hasErr) => ({
    display: 'block', marginBottom: 8,
    fontSize: 11, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: hasErr ? '#ef4444' : '#94a3b8',
  });

  return (
    /* ── Full-viewport wrapper ─────────────────────── */
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', overflow: 'hidden',
      background:
        'radial-gradient(ellipse at 6% 12%, rgba(30,80,200,0.22) 0%, transparent 38%),' +
        'radial-gradient(ellipse at 94% 88%, rgba(14,140,220,0.12) 0%, transparent 36%),' +
        'linear-gradient(160deg, #020b1a 0%, #050d1f 55%, #030a16 100%)',
    }}>

      {/* ════════════════════════════════════════════════
          LEFT PANEL — Blue Branding  (42 % width)
          Slightly wider than Register to fit feature cards
      ════════════════════════════════════════════════ */}
      <div style={{
        position: 'relative',
        width: '42%',
        flexShrink: 0,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 72% 8%,  rgba(160,220,255,0.22) 0%, transparent 38%),' +
          'radial-gradient(circle at 16% 92%, rgba(100,180,255,0.18) 0%, transparent 36%),' +
          'radial-gradient(circle at 44% 52%, rgba(80,160,240,0.10) 0%, transparent 40%),' +
          'linear-gradient(168deg, #1040a0 0%, #1658c0 38%, #1d82dc 75%, #22a0e8 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '52px 44px',
        color: 'white',
      }}>
        <PanelBlobs />
        <WaveDivider />

        {/* ── Top: Logo ──────────────────────────────── */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              background: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
              flexShrink: 0,
            }}>
              <Rocket size={20} strokeWidth={2.1} color="#1658c0" />
            </div>
            <span
              className="brand-mark"
              style={{ fontSize: '1.6rem', color: 'white', letterSpacing: '0.03em' }}
            >
              SDPPS
            </span>
          </div>
        </div>

        {/* ── Middle: Hero text + Feature cards ─────── */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 32 }}>

          {/* Hero text */}
          <div>
            <p style={{
              margin: '0 0 12px 0',
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.15em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.60)',
            }}>
              Smart Distraction Prevention
            </p>
            <h1 style={{
              margin: 0,
              fontSize: '2.6rem', fontWeight: 900,
              lineHeight: 1.15, letterSpacing: '-0.02em',
              color: 'white',
            }}>
              Welcome back,
              <br />
              <span style={{
                background: 'linear-gradient(90deg, #bfdbfe, #e0f2fe)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                ready to focus?
              </span>
            </h1>
            <p style={{
              margin: '16px 0 0 0',
              fontSize: 14, lineHeight: 1.7,
              color: 'rgba(255,255,255,0.68)',
              maxWidth: 320,
            }}>
              Log in to predict distractions and optimise your
              study sessions with advanced AI tools.
            </p>
          </div>

          {/* Feature cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: Zap,       title: 'AI Prediction',  desc: 'Predicts distraction 5 min ahead'  },
              { icon: Shield,    title: 'Smart Blocking',  desc: 'Auto-blocks distracting content'   },
              { icon: BarChart3, title: 'Focus Analytics', desc: 'Track your focus patterns over time' },
            ].map(props => (
              <FeatureCard key={props.title} {...props} />
            ))}
          </div>
        </div>

        {/* ── Bottom: Copyright ──────────────────────── */}
        <p style={{
          position: 'relative', zIndex: 2,
          margin: 0, fontSize: 11.5,
          color: 'rgba(255,255,255,0.42)',
        }}>
          © 2025 SDPPS. All rights reserved.
        </p>
      </div>
      {/* ══ END LEFT PANEL ══ */}


      {/* ════════════════════════════════════════════════
          RIGHT PANEL — Login Form  (58 % width)
      ════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        background: '#050d1f',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '40px 48px',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* ── Heading ─────────────────────────────── */}
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <h2 style={{
              fontSize: '2.1rem', fontWeight: 800,
              color: 'white', letterSpacing: '-0.02em',
              lineHeight: 1.15, margin: 0,
            }}>
              Student Login
            </h2>
            <p style={{ marginTop: 10, fontSize: 13.5, color: '#64748b' }}>
              Access your distraction-free zone
            </p>
          </div>

          {/* ── Success banner ──────────────────────── */}
          {done && (
            <div style={{
              marginBottom: 24,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '13px 16px', borderRadius: 12,
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.30)',
              color: '#34d399', fontSize: 13.5, fontWeight: 500,
            }}>
              <CheckCircle2 size={18} />
              Login successful! Redirecting to dashboard…
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* ── Email ─────────────────────────── */}
              <div>
                <label style={labelStyle(errors.email)}>Email Address</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={15} style={{
                    position: 'absolute', left: 14, pointerEvents: 'none',
                    color: errors.email ? '#ef4444' : '#475569',
                  }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    autoComplete="email"
                    style={inputStyle(errors.email)}
                    onFocus={onFocus}
                    onBlur={onBlur(errors.email)}
                  />
                </div>
                {errors.email && (
                  <p style={{ marginTop: 5, fontSize: 11, color: '#ef4444' }}>⚠ {errors.email}</p>
                )}
              </div>

              {/* ── Password ──────────────────────── */}
              <div>
                <label style={labelStyle(errors.password)}>Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={15} style={{
                    position: 'absolute', left: 14, pointerEvents: 'none',
                    color: errors.password ? '#ef4444' : '#475569',
                  }} />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{ ...inputStyle(errors.password), paddingRight: 46 }}
                    onFocus={onFocus}
                    onBlur={onBlur(errors.password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute', right: 13,
                      background: 'none', border: 'none',
                      cursor: 'pointer', padding: 4,
                      color: '#475569', display: 'flex', alignItems: 'center',
                    }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p style={{ marginTop: 5, fontSize: 11, color: '#ef4444' }}>⚠ {errors.password}</p>
                )}
              </div>

              {/* ── Remember me + Forgot password ─── */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                {/* Custom remember checkbox */}
                <div
                  onClick={() => setRemember(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
                >
                  <div style={{
                    width: 17, height: 17, borderRadius: 4,
                    border: `2px solid ${remember ? '#38bdf8' : 'rgba(255,255,255,0.22)'}`,
                    background: remember ? '#38bdf8' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', flexShrink: 0,
                    boxSizing: 'border-box',
                  }}>
                    {remember && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5l2.5 2.5 4.5-5"
                          stroke="white" strokeWidth="1.7"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: '#64748b', userSelect: 'none' }}>
                    Remember me
                  </span>
                </div>

                {/* Forgot password */}
                <Link
                  to="/forgot"
                  style={{
                    fontSize: 13, fontWeight: 600,
                    color: '#38bdf8', textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#7dd3fc'}
                  onMouseLeave={e => e.currentTarget.style.color = '#38bdf8'}
                >
                  Forgot password?
                </Link>
              </div>

              {/* ── Log In button ─────────────────── */}
              <button
                type="submit"
                disabled={loading || done}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 999,
                  border: 'none',
                  cursor: loading || done ? 'not-allowed' : 'pointer',
                  fontSize: 14.5, fontWeight: 700,
                  color: 'white',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 8,
                  background: canSubmit
                    ? 'linear-gradient(135deg, #2563eb 0%, #1d9fef 100%)'
                    : 'linear-gradient(135deg, #1a2e52 0%, #1a3d60 100%)',
                  boxShadow: canSubmit
                    ? '0 4px 24px rgba(37,99,235,0.50)'
                    : 'none',
                  transition: 'all 0.2s',
                  opacity: loading || done ? 0.75 : 1,
                }}
                onMouseEnter={e => {
                  if (!canSubmit || loading || done) return;
                  e.currentTarget.style.boxShadow = '0 6px 32px rgba(37,99,235,0.65)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = canSubmit
                    ? '0 4px 24px rgba(37,99,235,0.50)' : 'none';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {loading ? (
                  <>
                    {/* Spinner */}
                    <svg
                      style={{
                        width: 16, height: 16,
                        animation: 'spin 0.8s linear infinite',
                      }}
                      viewBox="0 0 24 24" fill="none"
                    >
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      <circle cx="12" cy="12" r="10"
                        stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                      <path d="M12 2a10 10 0 0 1 10 10"
                        stroke="white" strokeWidth="3"
                        strokeLinecap="round" />
                    </svg>
                    Logging in…
                  </>
                ) : (
                  <>
                    Log In
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* ── OR divider ────────────────────── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: '#334155',
                }}>
                  OR
                </span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
              </div>

              {/* ── Google button ─────────────────── */}
              <button
                type="button"
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 10,
                  padding: '13px 0', borderRadius: 999,
                  border: '1.5px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.03)',
                  cursor: 'pointer', fontSize: 14,
                  fontWeight: 600, color: '#94a3b8',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'rgba(56,189,248,0.40)';
                  e.currentTarget.style.background  = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color       = '#e2e8f0';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                  e.currentTarget.style.background  = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color       = '#94a3b8';
                }}
              >
                <svg style={{ flexShrink: 0, width: 18, height: 18 }} viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

            </div>
          </form>

          {/* ── Bottom register link ─────────────────── */}
          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13.5, color: '#334155' }}>
            New to SDPPS?{' '}
            <Link
              to="/register"
              style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = '#7dd3fc'}
              onMouseLeave={e => e.currentTarget.style.color = '#38bdf8'}
            >
              Create an account
            </Link>
          </p>

        </div>
      </div>
      {/* ══ END RIGHT PANEL ══ */}

    </div>
  );
}
