import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';

function DividerDots() {
  return (
    <div className="pointer-events-none absolute right-[-26px] top-0 hidden h-full w-[52px] lg:block">
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          key={index}
          className="absolute right-0 h-[78px] w-[78px] rounded-full bg-white"
          style={{ top: `${index * 9.8}%` }}
        />
      ))}
    </div>
  );
}

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const navigate = useNavigate();

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  const inputClass =
    'w-full border-0 border-b bg-transparent px-0 py-2.5 text-[15px] text-slate-700 outline-none transition-colors placeholder:text-slate-400';

  const focusOn = (e) => {
    e.target.style.borderColor = '#5fb6db';
  };

  const focusOff = (e) => {
    e.target.style.borderColor = '#c6d9e3';
  };

  return (
    <div
      className="min-h-screen px-4 py-6 sm:px-6 lg:px-10 lg:py-10"
      style={{
        background:
          'radial-gradient(circle at 12% 18%, rgba(96,165,250,0.18), transparent 20%), linear-gradient(180deg, #040507 0%, #090d17 100%)',
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[26px] bg-white shadow-[0_28px_80px_rgba(0,0,0,0.35)] lg:grid-cols-[0.46fr_0.54fr]">
          <section
            className="relative overflow-hidden px-8 py-10 text-white sm:px-10 sm:py-12"
            style={{
              background:
                'radial-gradient(circle at 20% 86%, rgba(111,199,255,0.24), transparent 32%), linear-gradient(180deg, #1553a6 0%, #1f63bf 55%, #2a87db 100%)',
            }}
          >
            <DividerDots />

            <div
              className="pointer-events-none absolute inset-0 opacity-25"
              style={{
                background:
                  'radial-gradient(circle at 18% 10%, rgba(255,255,255,0.32), transparent 18%), radial-gradient(circle at 88% 24%, rgba(255,255,255,0.22), transparent 16%), radial-gradient(circle at 82% 82%, rgba(255,255,255,0.2), transparent 18%)',
              }}
            />

            <div className="relative z-10 flex h-full flex-col items-center justify-center text-center">
              <p className="text-[15px] font-medium text-white/85">Welcome to</p>

              <div className="mt-10 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-[0_10px_30px_rgba(255,255,255,0.18)]">
                <Rocket size={34} strokeWidth={2.2} color="#1f63bf" />
              </div>

              <h1 className="mt-5 brand-mark text-[2.2rem] text-white">SDPPS</h1>

              <p className="mt-10 max-w-[270px] text-sm leading-6 text-white/80">
                Smart Student Distraction Prediction and Prevention System with focused analytics and adaptive study guidance.
              </p>

              <div className="mt-12 flex items-center gap-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
                <span>Create More</span>
                <span className="h-4 w-px bg-white/35" />
                <span>Discover More</span>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center px-6 py-8 sm:px-10 sm:py-10">
            <form onSubmit={handleSubmit} className="w-full max-w-sm">
              <h2 className="text-center text-[2rem] font-bold tracking-tight text-slate-800">Create your account</h2>

              <div className="mt-10 space-y-6">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="Enter your fullname"
                    required
                    className={inputClass}
                    style={{ borderBottom: '2px solid #c6d9e3' }}
                    onFocus={focusOn}
                    onBlur={focusOff}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">E-mail Address</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="Enter your mail"
                    required
                    className={inputClass}
                    style={{ borderBottom: '2px solid #c6d9e3' }}
                    onFocus={focusOn}
                    onBlur={focusOff}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="Enter your password"
                    required
                    className={inputClass}
                    style={{ borderBottom: '2px solid #c6d9e3' }}
                    onFocus={focusOn}
                    onBlur={focusOff}
                  />
                </div>
              </div>

              <label className="mt-6 flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={acceptPolicy}
                  onChange={(e) => setAcceptPolicy(e.target.checked)}
                  required
                  className="mt-0.5 h-4 w-4 rounded accent-[#1f63bf]"
                />
                <span>
                  By Signing Up, I Agree with{' '}
                  <span className="font-semibold text-slate-700">Terms & Conditions</span>.
                </span>
              </label>

              <div className="mt-10 flex items-center gap-4">
                <button
                  type="submit"
                  disabled={!acceptPolicy || !form.name || !form.email || !form.password}
                  className="flex-1 rounded-full py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'linear-gradient(180deg, #2396ea 0%, #1f63bf 100%)' }}
                >
                  Sign Up
                </button>

                <Link
                  to="/login"
                  className="flex-1 rounded-full border py-3 text-center text-sm font-semibold text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700"
                  style={{ borderColor: '#cfd7e4' }}
                >
                  Sign In
                </Link>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
