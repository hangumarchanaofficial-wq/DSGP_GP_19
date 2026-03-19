import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import {
  Bell, ChevronDown, AlertTriangle, TrendingUp,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

/* ── Data ─────────────────────────────────────────── */
const focusBarData = [
  { time: '6 AM',  value: 15 },
  { time: '9 AM',  value: 55 },
  { time: '12 PM', value: 90 },
  { time: '3 PM',  value: 42 },
  { time: '6 PM',  value: 30 },
  { time: '9 PM',  value: 20 },
];

const weeklySparkline = [72, 75, 70, 78, 74, 80, 78];
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const distractingApps = [
  {
    name: 'YouTube', time: '45m',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#FF0000">
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.8 15.5V8.5l6.4 3.5-6.4 3.5z"/>
      </svg>
    ),
    bg: 'bg-red-50 dark:bg-red-500/10',
  },
  {
    name: 'Instagram', time: '32m',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="url(#ig)">
        <defs>
          <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f09433"/>
            <stop offset="25%" stopColor="#e6683c"/>
            <stop offset="50%" stopColor="#dc2743"/>
            <stop offset="75%" stopColor="#cc2366"/>
            <stop offset="100%" stopColor="#bc1888"/>
          </linearGradient>
        </defs>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
    bg: 'bg-pink-50 dark:bg-pink-500/10',
  },
  {
    name: 'Discord', time: '18m',
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#5865F2">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057l.003.028a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
    bg: 'bg-indigo-50 dark:bg-indigo-500/10',
  },
];

const subjects = [
  {
    name: 'Advanced Calculus', initials: 'Σ',
    score: 92, change: '+2.4%', positive: true,
    barColor: '#2563eb', bgColor: '#eff6ff', darkBg: 'rgba(37,99,235,0.12)',
    iconBg: '#dbeafe', iconColor: '#2563eb',
  },
  {
    name: 'Organic Chemistry', initials: '⚗',
    score: 74, change: '-1.2%', positive: false,
    barColor: '#f97316', bgColor: '#fff7ed', darkBg: 'rgba(249,115,22,0.12)',
    iconBg: '#ffedd5', iconColor: '#ea580c',
  },
  {
    name: 'History 101', initials: '📜',
    score: 88, change: '+5.0%', positive: true,
    barColor: '#8b5cf6', bgColor: '#f5f3ff', darkBg: 'rgba(139,92,246,0.12)',
    iconBg: '#ede9fe', iconColor: '#7c3aed',
  },
];

/* Heatmap grid — 5 rows × 10 cols */
const heatmapData = [
  [0,0,0,0,0,0,0,0,2,0],
  [0,0,1,0,0,0,0,0,0,0],
  [0,0,0,0,3,0,0,0,1,0],
  [0,1,0,0,0,0,0,2,0,0],
  [0,0,0,0,0,1,0,0,0,0],
];

/* AI Interventions mini bar data */
const aiBarData = [2, 4, 3, 8, 5, 3, 7, 4, 2, 6];

/* ── Circular Progress ────────────────────────────── */
function CircularProgress({ value, size = 120, strokeWidth = 10, color = '#2563eb' }) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
}

/* ── Weekly sparkline (line chart) ───────────────── */
function WeeklySparkline({ data, days }) {
  const W = 280, H = 70;
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / (max - min + 1)) * (H - 8) - 4;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const area = `M${pts[0]} ` + pts.slice(1).map(p => `L${p}`).join(' ') +
    ` L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkGrad)" />
      <polyline points={polyline} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Bar Chart ────────────────────────────────────── */
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value));
  const H = 160;
  return (
    <div className="flex items-end justify-between gap-3 px-2" style={{ height: H }}>
      {data.map((d, i) => {
        const isMax = d.value === max;
        const h = Math.max((d.value / 100) * (H - 10), 6);
        return (
          <div key={i} className="flex flex-col items-center gap-2 flex-1">
            <div
              className="w-full max-w-[48px] rounded-lg transition-all duration-700"
              style={{
                height: h,
                background: isMax ? '#2563eb' : d.value > 10 ? '#93c5fd' : '#e5e7eb',
              }}
            />
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-faint)' }}>
              {d.time}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Heatmap ──────────────────────────────────────── */
function Heatmap({ data }) {
  const lvl = ['', 'hot-1', 'hot-2', 'hot-3'];
  return (
    <div className="space-y-1">
      {data.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((v, ci) => (
            <div key={ci} className={`heatmap-cell ${lvl[v]}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────── */
export default function Analytics() {
  const { dark } = useTheme();
  const [period, setPeriod] = useState('Last 7 Days');
  const [activityPeriod, setActivityPeriod] = useState('Daily');
  const activeDay = 'Thu';

  return (
    <div className="flex min-h-screen page-bg">
      <Sidebar active="Analytics" />

      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">

        {/* ── Top Bar ─────────────────────────── */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 border-b"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <nav className="breadcrumb">
            <span className="parent">Dashboard</span>
            <span className="sep">/</span>
            <span className="current">Analytics</span>
          </nav>
          <div className="flex items-center gap-3">
            <button
              className="btn-ghost flex items-center gap-2"
              onClick={() => setPeriod(p => p === 'Last 7 Days' ? 'Last 30 Days' : 'Last 7 Days')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {period}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            <button className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors btn-ghost border-0">
              <Bell className="w-4.5 h-4.5" style={{ color: 'var(--text-muted)' }} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />
            </button>
          </div>
        </header>

        {/* ── Main Content ────────────────────── */}
        <main className="flex-1 p-6 space-y-6">

          {/* Row 1 — Focus Score | Weekly Trend | Completion Rate */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            {/* Focus Score */}
            <div className="card p-6 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Focus Score</h2>
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-600 dark:bg-green-500/15 dark:text-green-400">
                  <TrendingUp className="w-3 h-3" /> +5% vs last week
                </span>
              </div>
              <div className="flex flex-col items-center flex-1 justify-center py-2">
                <div className="relative">
                  <CircularProgress value={78} size={130} strokeWidth={10} color="#2563eb" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>78%</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Productivity</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
                Great job! You are in the top 10%.
              </p>
            </div>

            {/* Weekly Trend */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Weekly Trend</h2>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Focus Hours
                </div>
              </div>
              <div className="h-20 mb-5">
                <WeeklySparkline data={weeklySparkline} days={weekDays} />
              </div>
              <div className="flex justify-between">
                {weekDays.map(day => (
                  <span
                    key={day}
                    className={`text-[11px] font-semibold ${
                      day === activeDay
                        ? 'text-blue-600 dark:text-blue-400'
                        : ''
                    }`}
                    style={day !== activeDay ? { color: 'var(--text-faint)' } : {}}
                  >
                    {day}
                  </span>
                ))}
              </div>
            </div>

            {/* Completion Rate — dark card */}
            <div
              className="rounded-2xl p-6 flex flex-col"
              style={{
                background: dark ? '#0d1526' : '#1a2035',
                minHeight: 200,
              }}
            >
              <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Completion Rate
              </p>
              <p className="text-5xl font-bold text-white leading-none mb-2">85%</p>
              <div className="h-1.5 w-full rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <div className="h-full rounded-full bg-blue-500" style={{ width: '85%' }} />
              </div>
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
                45 of 53 planned sessions completed.
              </p>
              <div className="mt-auto">
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white border transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)' }}
                >
                  View Details <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Row 2 — Focus Activity | Distraction Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* Focus Activity Bar Chart */}
            <div className="card p-6 lg:col-span-2">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Focus Activity</h3>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Peak productivity recorded between{' '}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">10 AM – 12 PM</span>
                  </p>
                </div>
                <button
                  className="btn-ghost flex items-center gap-1"
                  onClick={() => setActivityPeriod(p => p === 'Daily' ? 'Weekly' : 'Daily')}
                >
                  {activityPeriod} <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <div className="mt-6">
                <BarChart data={focusBarData} />
              </div>
            </div>

            {/* Distraction Insights */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Distraction Insights</h3>
              </div>

              {/* Heatmap */}
              <p className="stat-label mb-3">Focus Loss Heatmap</p>
              <Heatmap data={heatmapData} />
              <p className="text-xs mt-2 mb-5" style={{ color: 'var(--text-faint)' }}>
                High frequency of interruptions in late evening (8PM – 10PM).
              </p>

              {/* Top Distracting Apps */}
              <p className="stat-label mb-3">Top Distracting Apps</p>
              <div className="space-y-3 mb-5">
                {distractingApps.map(app => (
                  <div key={app.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={`icon-badge ${app.bg} rounded-xl`}>
                        {app.icon}
                      </div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {app.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {app.time}
                    </span>
                  </div>
                ))}
              </div>

              {/* AI Interventions */}
              <div className="flex items-center justify-between mb-2">
                <p className="stat-label">AI Interventions</p>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>12 alerts</span>
              </div>
              <div className="flex items-end gap-1 h-10">
                {aiBarData.map((v, i) => {
                  const h = (v / 10) * 40;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: h,
                        background: i === 7 ? '#2563eb' : '#bfdbfe',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Row 3 — Subject Performance */}
          <div className="card p-6">
            <h3 className="font-bold text-base mb-5" style={{ color: 'var(--text-primary)' }}>
              Subject Performance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {subjects.map(subj => (
                <div
                  key={subj.name}
                  className="rounded-xl p-5 border transition-all duration-200 hover:shadow-md"
                  style={{
                    background: dark ? subj.darkBg : subj.bgColor,
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold"
                      style={{ background: dark ? 'rgba(255,255,255,0.08)' : subj.iconBg, color: subj.iconColor }}
                    >
                      {subj.initials}
                    </div>
                    <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {subj.name}
                    </p>
                  </div>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      {subj.score}%
                    </span>
                    <span className={`text-sm font-semibold ${subj.positive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                      {subj.change}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${subj.score}%`, background: subj.barColor }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}