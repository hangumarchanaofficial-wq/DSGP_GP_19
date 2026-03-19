import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAgent } from '../hooks/useAgent';
import Sidebar from '../components/Sidebar';
import { Bell, Zap, TrendingUp, TrendingDown, Clock, Flame, Wifi, WifiOff } from 'lucide-react';

/* ── Static Data (fallback when agent is offline) ──── */
const fallbackSessions = [
  { id: 1, title: 'Advanced Calculus', time: '09:00 – 10:30', status: 'completed', emoji: '📐' },
  { id: 2, title: 'Organic Chemistry', time: '11:00 – 12:30', status: 'active',    emoji: '⚗️' },
  { id: 3, title: 'Linear Algebra',    time: '14:00 – 15:30', status: 'upcoming',  emoji: '📘' },
  { id: 4, title: 'German B1',         time: '17:00 – 18:00', status: 'upcoming',  emoji: '🌍' },
];

const defaultDistracting = [
  { name: 'YouTube',   time: '45m', pct: 70, color: '#ef4444' },
  { name: 'Instagram', time: '32m', pct: 50, color: '#ec4899' },
  { name: 'Reddit',    time: '18m', pct: 28, color: '#f97316' },
  { name: 'Twitter',   time: '12m', pct: 16, color: '#64748b' },
];

const weekActivity = [48, 62, 44, 80, 56, 72, 60];
const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* ── Mini Area Chart ────────────────────────────────── */
function MiniAreaChart({ data }) {
  const W = 160, H = 40;
  const max = Math.max(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (v / max) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const area = `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ') + ` L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6467f2" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#6467f2" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#miniGrad)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#6467f2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Focus Line Chart ──────────────────────────────── */
function FocusChart({ data }) {
  const W = 500, H = 200;
  const max = Math.max(...data);
  const pts = data.map((v, i) => {
    const x = 40 + (i / (data.length - 1)) * (W - 80);
    const y = H - 20 - (v / max) * (H - 40);
    return { x, y, v };
  });
  const line = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `M${pts[0].x},${pts[0].y} ` +
    pts.slice(1).map(p => `L${p.x},${p.y}`).join(' ') +
    ` L${pts[pts.length - 1].x},${H - 20} L${pts[0].x},${H - 20} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6467f2" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6467f2" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map(v => {
        const y = H - 20 - (v / 100) * (H - 40);
        return <line key={v} x1={40} y1={y} x2={W - 40} y2={y} stroke="currentColor" strokeWidth="0.5" className="text-gray-200 dark:text-white/5" />;
      })}
      <path d={area} fill="url(#focusGrad)" />
      <polyline points={line} fill="none" stroke="#6467f2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke="#6467f2" strokeWidth="2" />)}
      {weekDays.map((d, i) => (
        <text key={i} x={pts[i]?.x ?? 0} y={H - 4} textAnchor="middle" fontSize="10" fill="currentColor" className="text-gray-400 dark:text-gray-600">{d}</text>
      ))}
    </svg>
  );
}

/* ── Agent Connection Badge ────────────────────────── */
function AgentBadge({ connected, windowCurrent, windowSize }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
      connected
        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
        : 'bg-red-50 text-red-500 dark:bg-red-500/15 dark:text-red-400'
    }`}>
      {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {connected ? `Agent Live · ${windowCurrent ?? 0}/${windowSize ?? 10} window` : 'Agent Offline'}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────── */
export default function Dashboard() {
  const { dark, toggle } = useTheme();
  const {
    status, connected, error,
    prediction, blocker,
    windowCurrent, windowSize, snapshots,
    toggleBlocking, forcePrediction,
  } = useAgent(5000);

  // Live values (fallback to static when agent is offline)
  const focusScore = prediction
    ? Math.round((1 - prediction.probability) * 100)
    : 87;
  const isDistracted = prediction?.is_distracted ?? false;
  const confidence = prediction?.confidence ?? 0;
  const probability = prediction?.probability ?? 0;
  const predLabel = prediction?.label ?? 'WAITING';

  const distractingApps = defaultDistracting;
  const sessions = fallbackSessions;

  return (
    <div className="flex min-h-screen page-bg">
      <Sidebar active="Dashboard" />

      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">

        {/* ── Header ──────────────────────────── */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 border-b"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Good morning, Hanguan 👋
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {connected
                ? prediction
                  ? `AI says: ${predLabel} (${Math.round(confidence * 100)}% confidence)`
                  : `Collecting data... ${windowCurrent}/${windowSize} window snapshots`
                : 'Start the desktop agent to enable live predictions.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
          <AgentBadge connected={connected} windowCurrent={windowCurrent} windowSize={windowSize} />
            <button className="btn-ghost" onClick={toggle} aria-label="Toggle theme">
              {dark
                ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-10H21M3 12H2m15.07-6.07l-.71.71M6.64 17.36l-.71.71M17.66 17.66l-.71-.71M7.05 6.64l-.71-.71M12 7a5 5 0 100 10A5 5 0 0012 7z" /></svg>
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 118.646 3.646 7 7 0 0020.354 15.354z" /></svg>}
            </button>
            <button className="relative btn-ghost border-0 w-9 h-9 p-0">
              <Bell className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              {isDistracted && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />}
            </button>
            <button
              className="btn-primary flex items-center gap-2"
              onClick={forcePrediction}
              disabled={!connected || windowCurrent < windowSize}
            >
              <Zap className="w-4 h-4" /> Quick Focus
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6">

          {/* ── Stat Cards ────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Focus Score — LIVE */}
            <div className={`card p-5 ${isDistracted ? 'border-l-4 border-l-red-500' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="stat-label mb-1">Focus Score</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {connected && prediction ? `${focusScore}%` : '—'}
                  </p>
                  {connected && prediction && (
                    <p className={`flex items-center gap-1 text-xs font-semibold mt-1 ${isDistracted ? 'text-red-500' : 'text-emerald-500'}`}>
                      {isDistracted ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                      {isDistracted ? 'Distraction detected' : 'Focused'}
                    </p>
                  )}
                  {!connected && <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Agent offline</p>}
                </div>
                <div className="relative w-14 h-14">
                  <svg className="w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="28" cy="28" r="24" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                    <circle cx="28" cy="28" r="24" fill="none"
                      stroke={isDistracted ? '#ef4444' : '#2563eb'}
                      strokeWidth="5"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - focusScore / 100)}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Study Hours */}
            <div className="card p-5">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="stat-label mb-1">Study Hours</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>6.2h</p>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="h-10 mt-2">
                <MiniAreaChart data={weekActivity} />
              </div>
            </div>

            {/* Distractions — LIVE */}
            <div className="card p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="stat-label mb-1">Blocking</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {blocker?.is_blocking ? 'ON' : 'OFF'}
                  </p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  blocker?.is_blocking
                    ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15'
                    : 'bg-gray-100 text-gray-500 dark:bg-white/5'
                }`}>
                  {blocker?.blocked_sites?.length ?? 0} sites
                </span>
              </div>
              <div className="flex gap-1 mt-2">
                <div className={`h-1.5 flex-1 rounded-full ${blocker?.is_blocking ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/10'}`} />
                <div className="h-1.5 flex-1 rounded-full" style={{ background: 'var(--border)' }} />
                <div className="h-1.5 flex-1 rounded-full" style={{ background: 'var(--border)' }} />
              </div>
            </div>

            {/* Stats: Total data points */}
            <div className="card p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-orange-50 dark:bg-orange-500/15 flex items-center justify-center flex-shrink-0">
                <Flame className="w-7 h-7 text-orange-500" />
              </div>
              <div>
                <p className="stat-label mb-1">Data Points</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {snapshots}
                </p>
                <p className="text-xs font-semibold text-orange-500 mt-1">
                  {windowCurrent >= windowSize ? 'Window ready' : `Window: ${windowCurrent}/${windowSize}`}
                </p>
              </div>
            </div>
          </div>

          {/* ── Focus Activity + Distracting Apps ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="card p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Focus Activity</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Peak intensity hours: 10:00 – 14:00</p>
                </div>
                <select className="btn-ghost text-xs py-1.5 px-3 rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--bg-page)', border: '1px solid var(--border)' }}>
                  <option>Last 7 Days</option>
                  <option>Last 24 Hours</option>
                </select>
              </div>
              <div className="h-48">
                <FocusChart data={weekActivity} />
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Distracting Apps</h3>
                <span className="text-xs font-semibold text-emerald-500 flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" /> 22%
                </span>
              </div>
              <div className="space-y-5">
                {distractingApps.map(app => (
                  <div key={app.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{app.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{app.time}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{ width: `${app.pct}%`, background: app.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={toggleBlocking}
                disabled={!connected}
                className={`w-full mt-8 py-2 text-xs font-semibold rounded-lg transition-colors border ${
                  blocker?.is_blocking
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/25'
                    : 'text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500/25 dark:hover:bg-blue-500/10'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {blocker?.is_blocking ? 'Disable Blocking' : 'Enable Blocking'}
              </button>
            </div>
          </div>

          {/* ── Sessions + AI Insight ──────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <h3 className="font-bold text-base mb-4 px-1" style={{ color: 'var(--text-primary)' }}>Today's Study Sessions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sessions.map(s => {
                  const isActive = s.status === 'active';
                  const isCompleted = s.status === 'completed';
                  const isUpcoming = s.status === 'upcoming';
                  return (
                    <div key={s.id} className={`card p-4 flex items-center gap-3 ${isActive ? 'border-l-4 border-l-blue-500' : ''} ${isUpcoming ? 'opacity-60' : ''}`}>
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${
                        isCompleted ? 'bg-emerald-50 dark:bg-emerald-500/10' : isActive ? 'bg-blue-50 dark:bg-blue-500/10' : 'bg-gray-100 dark:bg-white/5'
                      }`}>{s.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.time}</p>
                      </div>
                      {isCompleted && <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Done</span>}
                      {isActive && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                          <span className="text-[10px] font-bold text-blue-500 uppercase">Live</span>
                        </div>
                      )}
                      {isUpcoming && <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Soon</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Insight — LIVE */}
            <div className="card p-6 flex flex-col" style={{ borderLeft: `3px solid ${isDistracted ? '#ef4444' : '#6467f2'}` }}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDistracted ? 'bg-red-500' : 'bg-indigo-600'}`}>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  AI Insight {connected && <span className="text-[10px] font-normal ml-1 text-emerald-500">LIVE</span>}
                </h4>
              </div>

              {connected && prediction ? (
                <>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-muted)' }}>
                    Your <span className="text-indigo-500 font-bold">BiLSTM model</span> predicts a{' '}
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                      {Math.round(probability * 100)}% chance
                    </span>{' '}
                    of distraction based on your last {snapshots} minutes of behavior.
                  </p>
                  <div className="mt-5">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-faint)' }}>
                      <span>Prediction Confidence</span>
                      <span>{Math.round(confidence * 100)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar-fill" style={{
                        width: `${confidence * 100}%`,
                        background: isDistracted
                          ? 'linear-gradient(90deg, #ef4444, #f97316)'
                          : 'linear-gradient(90deg, #6467f2, #38bdf8)',
                      }} />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-3">
                    {connected
                      ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      : <WifiOff className="w-5 h-5 text-gray-400" />}
                  </div>
                  <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                    {connected
                      ? `Collecting data... ${windowCurrent}/${windowSize} window snapshots needed`
                      : 'Start the desktop agent to see live AI predictions'}
                  </p>
                </div>
              )}

              <button
                onClick={toggleBlocking}
                disabled={!connected}
                className={`mt-5 w-full py-2.5 text-xs font-bold rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  blocker?.is_blocking
                    ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/25'
                    : ''
                }`}
                style={!blocker?.is_blocking ? { borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--bg-page)' } : {}}
              >
                {blocker?.is_blocking ? 'Stop Blocking' : 'Adjust Focus Strategy'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── FABs ──────────────────────────────── */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-50">
        <button
          onClick={toggleBlocking}
          disabled={!connected}
          className={`flex items-center gap-2 px-5 py-3 text-white rounded-full shadow-lg font-bold text-sm transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 ${
            blocker?.is_blocking ? 'bg-emerald-500 shadow-emerald-500/25' : 'bg-rose-500 shadow-rose-500/25'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          {blocker?.is_blocking ? 'Unblock' : 'Block Distractions'}
        </button>
        <button
          onClick={forcePrediction}
          disabled={!connected || windowCurrent < windowSize}
          className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/25 font-bold text-sm transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
        >
          <Zap className="w-4 h-4" />
          {windowCurrent < windowSize ? `${windowCurrent}/${windowSize} ready` : 'Predict Now'}
        </button>
      </div>
    </div>
  );
}
