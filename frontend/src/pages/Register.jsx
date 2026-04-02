// frontend/src/pages/Register.jsx

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Rocket, User, Mail, Lock, Eye, EyeOff, CheckCircle2, Zap, Shield, BarChart3 } from 'lucide-react';

function WaveDivider() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: -1,
        height: '100%',
        width: 70,
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
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

function getStrength(pw) {
  let s = 0;
  if (pw.length >= 8)           s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH = [
  { label: 'Too weak', color: '#ef4444' },
  { label: 'Weak',     color: '#f97316' },
  { label: 'Fair',     color: '#eab308' },
  { label: 'Good',     color: '#22c55e' },
  { label: 'Strong',   color: '#10b981' },
];

export default function Register() {
  const [form,   setForm]   = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState({});
  const [done,   setDone]   = useState(false);
  const navigate = useNavigate();

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())                     e.name     = 'Full name is required.';
    if (!/\S+@\S+\.\S+/.test(form.email))     e.email    = 'Enter a valid email.';
    if (form.password.length < 8)              e.password = 'Minimum 8 characters.';
    if (!accept)                               e.policy   = 'Please accept the terms.';
    return e;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setDone(true);
    setTimeout(() => navigate('/dashboard'), 1400);
  };

  const pwStr    = form.password.length ? getStrength(form.password) : -1;
  const canSubmit = form.name && form.email && form.password.length >= 8 && accept;

  /* ── Reusable field label style ─── */
  const labelStyle = (hasErr) => ({
    display: 'block',
    marginBottom: 8,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: hasErr ? '#ef4444' : '#94a3b8',
  });

  /* ── Reusable input style ───────── */
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

  return (
    /* ── Full-viewport page wrapper ──────────────────────── */
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        overflow: 'hidden',               /* no scrollbars on the page */
        background:
          'radial-gradient(ellipse at 6% 12%, rgba(30,80,200,0.22) 0%, transparent 38%),' +
          'radial-gradient(ellipse at 94% 88%, rgba(14,140,220,0.12) 0%, transparent 36%),' +
          'linear-gradient(160deg, #020b1a 0%, #050d1f 55%, #030a16 100%)',
      }}
    >
      {/* ════════════════════════════════════════════════════
          LEFT PANEL — Blue Branding  (38 % width)
      ════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'relative',
          width: '44%',
          flexShrink: 0,
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 72% 8%,  rgba(160,220,255,0.22) 0%, transparent 38%),' +
            'radial-gradient(circle at 16% 92%, rgba(100,180,255,0.18) 0%, transparent 36%),' +
            'radial-gradient(circle at 44% 52%, rgba(80,160,240,0.10) 0%, transparent 40%),' +
            'linear-gradient(168deg, #1040a0 0%, #1658c0 38%, #1d82dc 75%, #22a0e8 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '52px 40px',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <PanelBlobs />
        <WaveDivider />

        {/* "Welcome to" */}
        <p style={{
          position: 'relative', zIndex: 2,
          fontSize: 13, fontWeight: 600,
          letterSpacing: '0.04em',
          color: 'rgba(255,255,255,0.80)',
        }}>
          Begin with clarity
        </p>

        {/* Centre content */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 22,
        }}>
          {/* Rocket circle */}
          <div style={{
            width: 100, height: 100,
            borderRadius: '50%',
            background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow:
              '0 0 0 16px rgba(255,255,255,0.10),' +
              '0 14px 44px rgba(0,0,0,0.25)',
          }}>
            <Rocket size={36} strokeWidth={2.1} color="#1658c0" />
          </div>

          {/* Brand */}
          <h1
            className="brand-mark"
            style={{
              fontSize: '2.8rem', letterSpacing: '0.03em',
              color: 'white', lineHeight: 1, margin: 0,
            }}
          >
            SDPPS
          </h1>

          {/* Tagline */}
          <p style={{
            fontSize: 13.5, lineHeight: 1.75,
            color: 'rgba(255,255,255,0.72)',
            maxWidth: 280, margin: 0,
          }}>
            Smart Student Distraction Prediction and Prevention System —
            a refined workspace for intelligent focus, adaptive blocking, and study analytics.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 4 }}>
            {[
              { icon: Zap,       label: 'Predictive Insight'   },
              { icon: Shield,    label: 'Adaptive Protection'  },
              { icon: BarChart3, label: 'Focus Analytics' },
            ].map(({ icon: Icon, label }) => (
              <span key={label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 999,
                fontSize: 11.5, fontWeight: 600,
                color: 'rgba(255,255,255,0.88)',
                background: 'rgba(255,255,255,0.13)',
                border: '1px solid rgba(255,255,255,0.22)',
              }}>
                <Icon size={11} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 20,
          fontSize: 10, fontWeight: 700,
          letterSpacing: '0.18em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.50)',
        }}>
          <span>Create More</span>
          <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.3)' }} />
          <span>Discover More</span>
        </div>
      </div>
      {/* ══ END LEFT PANEL ══ */}


      {/* ════════════════════════════════════════════════════
          RIGHT PANEL — Form  (62 % width, full height, scrollable)
      ════════════════════════════════════════════════════ */}
      <div
        style={{
          flex: 1,
          background: '#050d1f',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflowY: 'auto',              /* scroll only the form if needed */
          padding: '40px 48px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* Heading */}
          <div style={{ marginBottom: 36, textAlign: 'center' }}>
            <h2 style={{
              fontSize: '2.1rem', fontWeight: 800,
              color: 'white', letterSpacing: '-0.02em',
              lineHeight: 1.15, margin: 0,
            }}>
              Create your account
            </h2>
            <p style={{ marginTop: 10, fontSize: 13.5, color: '#64748b' }}>
              Join SDPPS and take control of your focus
            </p>
          </div>

          {/* Success banner */}
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
              Account created! Redirecting to dashboard…
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* ── Name ──────────────────────────────── */}
              <div>
                <label style={labelStyle(errors.name)}>Name</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <User size={15} style={{
                    position: 'absolute', left: 14, pointerEvents: 'none',
                    color: errors.name ? '#ef4444' : '#475569',
                  }} />
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    placeholder="Enter your fullname"
                    autoComplete="name"
                    style={inputStyle(errors.name)}
                    onFocus={onFocus}
                    onBlur={onBlur(errors.name)}
                  />
                </div>
                {errors.name && (
                  <p style={{ marginTop: 5, fontSize: 11, color: '#ef4444' }}>⚠ {errors.name}</p>
                )}
              </div>

              {/* ── Email ─────────────────────────────── */}
              <div>
                <label style={labelStyle(errors.email)}>E-mail Address</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Mail size={15} style={{
                    position: 'absolute', left: 14, pointerEvents: 'none',
                    color: errors.email ? '#ef4444' : '#475569',
                  }} />
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => update('email', e.target.value)}
                    placeholder="Enter your mail"
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

              {/* ── Password ──────────────────────────── */}
              <div>
                <label style={labelStyle(errors.password)}>Password</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Lock size={15} style={{
                    position: 'absolute', left: 14, pointerEvents: 'none',
                    color: errors.password ? '#ef4444' : '#475569',
                  }} />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => update('password', e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="new-password"
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

                {/* Strength bar */}
                {form.password.length > 0 && (
                  <div style={{ marginTop: 9 }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[1, 2, 3, 4].map(lvl => (
                        <div key={lvl} style={{
                          flex: 1, height: 3, borderRadius: 999,
                          transition: 'background 0.3s',
                          background: lvl <= pwStr
                            ? STRENGTH[pwStr].color
                            : 'rgba(255,255,255,0.08)',
                        }} />
                      ))}
                    </div>
                    {pwStr >= 0 && (
                      <p style={{
                        marginTop: 4, fontSize: 11, fontWeight: 600,
                        color: STRENGTH[pwStr].color,
                      }}>
                        {STRENGTH[pwStr].label}
                      </p>
                    )}
                  </div>
                )}
                {errors.password && (
                  <p style={{ marginTop: 5, fontSize: 11, color: '#ef4444' }}>⚠ {errors.password}</p>
                )}
              </div>

              {/* ── Terms ─────────────────────────────── */}
              <div>
                <div
                  onClick={() => setAccept(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'flex-start',
                    gap: 10, cursor: 'pointer',
                  }}
                >
                  {/* Custom checkbox box */}
                  <div style={{
                    marginTop: 1, flexShrink: 0,
                    width: 17, height: 17, borderRadius: 4,
                    border: `2px solid ${errors.policy ? '#ef4444' : accept ? '#38bdf8' : 'rgba(255,255,255,0.22)'}`,
                    background: accept ? '#38bdf8' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                    boxSizing: 'border-box',
                  }}>
                    {accept && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5l2.5 2.5 4.5-5"
                          stroke="white" strokeWidth="1.7"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.55 }}>
                    By Signing Up, I Agree with the{' '}
                    <span style={{ fontWeight: 700, color: '#94a3b8' }}>
                      Terms &amp; Conditions
                    </span>.
                  </span>
                </div>
                {errors.policy && (
                  <p style={{ marginTop: 5, fontSize: 11, color: '#ef4444' }}>⚠ {errors.policy}</p>
                )}
              </div>

              {/* ── Sign Up / Sign In buttons ──────────── */}
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <button
                  type="submit"
                  disabled={done}
                  style={{
                    flex: 1, padding: '14px 0',
                    borderRadius: 999, border: 'none',
                    cursor: done ? 'not-allowed' : 'pointer',
                    fontSize: 14.5, fontWeight: 700, color: 'white',
                    background: canSubmit
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d9fef 100%)'
                      : 'linear-gradient(135deg, #1a2e52 0%, #1a3d60 100%)',
                    boxShadow: canSubmit
                      ? '0 4px 24px rgba(37,99,235,0.50)'
                      : 'none',
                    transition: 'all 0.2s',
                    opacity: done ? 0.7 : 1,
                  }}
                >
                  {done ? 'Creating…' : 'Sign Up'}
                </button>

                <Link
                  to="/login"
                  style={{
                    flex: 1, padding: '14px 0',
                    borderRadius: 999,
                    border: '1.5px solid rgba(255,255,255,0.14)',
                    fontSize: 14.5, fontWeight: 700,
                    color: '#94a3b8', textDecoration: 'none',
                    textAlign: 'center', display: 'block',
                    transition: 'all 0.2s', background: 'transparent',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(56,189,248,0.5)';
                    e.currentTarget.style.color = '#38bdf8';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                >
                  Sign In
                </Link>
              </div>

              {/* ── OR ────────────────────────────────── */}
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

              {/* ── Google ────────────────────────────── */}
              <button
                type="button"
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '13px 0', borderRadius: 999,
                  border: '1.5px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.03)',
                  cursor: 'pointer', fontSize: 14, fontWeight: 600,
                  color: '#94a3b8', transition: 'all 0.2s',
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

          {/* Bottom link */}
          <p style={{ marginTop: 28, textAlign: 'center', fontSize: 13.5, color: '#334155' }}>
            Already have an account?{' '}
            <Link
              to="/login"
              style={{ color: '#38bdf8', fontWeight: 600, textDecoration: 'none' }}
              onMouseEnter={e => e.currentTarget.style.color = '#7dd3fc'}
              onMouseLeave={e => e.currentTarget.style.color = '#38bdf8'}
            >
              Sign in here
            </Link>
          </p>

        </div>
      </div>
      {/* ══ END RIGHT PANEL ══ */}

    </div>
  );
}
