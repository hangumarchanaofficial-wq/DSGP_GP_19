import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, GraduationCap, ArrowRight, Sparkles, Shield, BarChart2 } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col font-sans">
      <div className="flex flex-1">

      {/* ── Left Branding Panel ─────────────────────── */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-800">

        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-16 left-10 w-72 h-72 bg-blue-300/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-24 right-8 w-80 h-80 bg-indigo-300/15 rounded-full blur-3xl animate-pulse-slow delay-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-300/10 rounded-full blur-3xl animate-pulse-slow delay-1000" />
          {/* Subtle dot grid */}
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/25">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">SDPPS</span>
          </div>

          {/* Hero text */}
          <div className="space-y-8">
            <div>
              <p className="text-blue-200 text-xs font-semibold tracking-widest uppercase mb-4">
                Smart Distraction Prevention
              </p>
              <h1 className="text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
                Welcome back,<br />
                <span className="bg-gradient-to-r from-cyan-300 to-blue-200 bg-clip-text text-transparent">
                  ready to focus?
                </span>
              </h1>
              <p className="mt-6 text-blue-100/75 text-lg leading-relaxed max-w-sm">
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
                <div key={title} className="flex items-center gap-4 bg-white/[0.08] backdrop-blur-sm rounded-xl p-4 border border-white/[0.1] hover:bg-white/[0.13] transition-all duration-300">
                  <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-cyan-300" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{title}</p>
                    <p className="text-blue-200/60 text-xs">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-blue-200/40 text-sm">© 2025 SDPPS. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right Login Form ────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-8 py-12" style={{ background: '#f5f7fa' }}>
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">SDPPS</span>
          </div>

          <h2 className="text-3xl font-extrabold text-gray-900 mb-1">Student Login</h2>
          <p className="text-gray-500 mb-8 text-sm">Access your distraction-free zone.</p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="student@university.edu" required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  className="w-full pl-11 pr-11 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-gray-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer" />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
              <Link to="/forgot" className="text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <button type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 transition-all duration-300 flex items-center justify-center gap-2 group text-sm"
            >
              Log In
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google */}
          <button className="w-full py-3 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl font-semibold text-gray-700 text-sm transition-all flex items-center justify-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-center mt-7 text-gray-500 text-sm">
            New to SDPPS?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
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
