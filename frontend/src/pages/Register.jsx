import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, GraduationCap, User, ArrowRight, Check, Sparkles } from 'lucide-react';
import Footer from '../components/Footer';

export default function Register() {
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const navigate = useNavigate();

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const passwordChecks = [
    { label: 'At least 8 characters',    pass: form.password.length >= 8 },
    { label: 'Contains uppercase letter', pass: /[A-Z]/.test(form.password) },
    { label: 'Contains a number',         pass: /\d/.test(form.password) },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  const inputCls = `w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all`;

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <div className="flex flex-1">

      {/* ── Left Branding Panel ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-gradient-to-br from-indigo-500 via-blue-600 to-blue-900">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 right-16 w-80 h-80 bg-indigo-300/20 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-20 left-10 w-72 h-72 bg-cyan-300/15 rounded-full blur-3xl animate-pulse-slow delay-700" />
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/25">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">SDPPS</span>
          </div>

          <div className="space-y-8">
            <div>
              <p className="text-blue-200 text-xs font-semibold tracking-widest uppercase mb-4">Join Today</p>
              <h1 className="text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
                Start your<br />
                <span className="bg-gradient-to-r from-cyan-300 to-blue-200 bg-clip-text text-transparent">
                  focus journey
                </span>
              </h1>
              <p className="mt-6 text-blue-100/75 text-lg leading-relaxed max-w-sm">
                Join SDPPS to enhance your academic focus with AI‑powered distraction prediction and adaptive study tools.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: '5 min', label: 'Early Warning' },
                { value: '78%',   label: 'Accuracy'      },
                { value: '21',    label: 'Features'      },
              ].map(({ value, label }) => (
                <div key={label} className="bg-white/[0.08] backdrop-blur-sm rounded-xl p-4 border border-white/[0.1] text-center">
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-blue-200/60 text-xs mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="bg-white/[0.08] backdrop-blur-sm rounded-2xl p-5 border border-white/[0.1]">
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Sparkles key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-blue-100/80 text-sm italic leading-relaxed">
                "SDPPS helped me understand my distraction patterns and improve my study habits. The early warnings are incredibly useful!"
              </p>
              <p className="text-white font-semibold text-xs mt-3">— Computer Science Student</p>
            </div>
          </div>

          <p className="text-blue-200/40 text-sm">© 2025 SDPPS. All rights reserved.</p>
        </div>
      </div>

      {/* ── Right Form ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-8 py-12 overflow-y-auto" style={{ background: '#f5f7fa' }}>
        <div className="w-full max-w-[420px]">

          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">SDPPS</span>
          </div>

          <h2 className="text-3xl font-extrabold text-gray-900 mb-1">Create your account</h2>
          <p className="text-gray-500 mb-8 text-sm">Join SDPPS to enhance your academic focus.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <input type="text" value={form.name} onChange={e => update('name', e.target.value)}
                  placeholder="Jane Doe" required className={inputCls} />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                  placeholder="student@university.edu" required className={inputCls} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)}
                  placeholder="••••••••" required className={`${inputCls} pr-11`} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.password && (
                <div className="space-y-1.5 pt-2">
                  {passwordChecks.map(({ label, pass }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${pass ? 'bg-green-500' : 'bg-gray-200'}`}>
                        {pass && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={`text-xs transition-colors ${pass ? 'text-green-600' : 'text-gray-400'}`}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
                <input
                  type={showConfirm ? 'text' : 'password'} value={form.confirm} onChange={e => update('confirm', e.target.value)}
                  placeholder="••••••••" required
                  className={`${inputCls} pr-11 ${form.confirm && form.confirm !== form.password ? '!border-red-400 focus:!ring-red-500/10' : ''}`}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.confirm && form.confirm !== form.password && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            {/* Policy */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={acceptPolicy} onChange={e => setAcceptPolicy(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-2 border-gray-300 text-blue-600 cursor-pointer" required />
              <span className="text-sm text-gray-500">
                I accept the{' '}
                <a href="#" className="text-blue-600 font-semibold hover:text-blue-700">Privacy Policy</a>
                <br /><span className="text-xs text-gray-400">We respect your data and privacy.</span>
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={!acceptPolicy || form.password !== form.confirm || !form.password}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 disabled:shadow-none transition-all duration-300 flex items-center justify-center gap-2 group text-sm"
            >
              Create Account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <button className="w-full py-3 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl font-semibold text-gray-700 text-sm transition-all flex items-center justify-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>

          <p className="text-center mt-7 text-gray-500 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  );
}
