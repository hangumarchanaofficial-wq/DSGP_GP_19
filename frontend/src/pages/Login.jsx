import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, Shield, BarChart2 } from 'lucide-react';
import Footer from '../components/Footer';

export default function Login() {
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex flex-1">

      {/* ── Left Branding Panel ─────────────────────── */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden"
        style={{ background: '#000000' }}>

        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-16 left-10 w-72 h-72 rounded-full blur-3xl animate-pulse-slow"
            style={{ background: 'rgba(124,58,237,0.15)' }} />
          <div className="absolute bottom-24 right-8 w-80 h-80 rounded-full blur-3xl animate-pulse-slow delay-700"
            style={{ background: 'rgba(109,40,217,0.12)' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl animate-pulse-slow delay-1000"
            style={{ background: 'rgba(167,139,250,0.06)' }} />
          {/* Subtle dot grid */}
          <div className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.6) 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          />
          {/* Border right */}
          <div className="absolute inset-y-0 right-0 w-px" style={{ background: 'var(--border)' }} />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">

          {/* Logo */}
          <div>
            <span className="brand-mark text-[2rem] text-white">SDPPS</span>
          </div>

          {/* Hero text */}
          <div className="space-y-8">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'var(--accent-light)' }}>
                Smart Distraction Prevention
              </p>
              <h1 className="text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
                Welcome back,<br />
                <span style={{ background: 'linear-gradient(90deg, var(--accent-light), #e9d5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  ready to focus?
                </span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                Log in to predict distractions and optimise your study sessions with advanced AI tools.
              </p>
            </div>

            {/* Feature cards */}
            <div className="space-y-3">
              {[
                { icon: Sparkles, title: 'AI Prediction', desc: 'Predicts distraction 5 min ahead' },
                { icon: Shield,   title: 'Smart Blocking', desc: 'Auto-blocks distracting content' },
                { icon: BarChart2,  title: 'Analytics',     desc: 'Track your focus patterns'       },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title}
                  className="flex items-center gap-4 rounded-xl p-4 border transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(124,58,237,0.15)' }}>
                    <Icon className="w-5 h-5" style={{ color: 'var(--accent-light)' }} />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>© 2025 SDPPS. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right Login Form ────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-8 py-12" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="lg:hidden mb-10">
            <span className="brand-mark text-[1.7rem]" style={{ color: 'var(--text-primary)' }}>SDPPS</span>
          </div>

          <h2 className="text-3xl font-extrabold mb-1" style={{ color: 'var(--text-primary)' }}>Student Login</h2>
          <p className="mb-8 text-sm" style={{ color: 'var(--text-secondary)' }}>Access your distraction-free zone.</p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="student@university.edu" required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full pl-11 pr-11 py-3 rounded-xl border-2 text-sm outline-none transition-all"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}>
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-2 cursor-pointer accent-violet-600"
                  style={{ borderColor: 'var(--border)' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Remember me</span>
              </label>
              <Link to="/forgot" className="text-sm font-semibold transition-colors"
                style={{ color: 'var(--accent)' }}>
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button type="submit"
              className="w-full py-3 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group text-sm"
              style={{ background: 'var(--accent)', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
              onMouseEnter={e => e.currentTarget.style.background = '#6d28d9'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--accent)'}
            >
              Log In
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Google */}
          <button className="w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-3 border-2"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center mt-7 text-sm" style={{ color: 'var(--text-secondary)' }}>
            New to SDPPS?{' '}
            <Link to="/register" className="font-semibold transition-colors" style={{ color: 'var(--accent)' }}>
              Create an account
            </Link>
          </p>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  );
}
