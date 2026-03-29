// frontend/src/pages/Planner.jsx — Premium Dark-Only Redesign (Full File)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import {
  ChevronDown, ChevronUp, Plus, Play, CheckCircle2, Trash2, Clock,
  Target, Flame, Award, Brain, Smartphone, CalendarDays, Pause,
  RotateCcw, AlertTriangle, TrendingUp, ArrowRight, X, Calendar,
  ChevronLeft, ChevronRight, Star, Zap, Trophy, BarChart3, Timer,
  ListTodo, Sparkles, User, Briefcase, Moon, MessageCircle, Volume2,
  RefreshCw, BookOpen, Coffee
} from 'lucide-react';

const API = '/api/planner';

/* ═══════════════════════════════════════════════════════════════
   TIME SLOTS
   ═══════════════════════════════════════════════════════════════ */
const TIME_SLOTS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30',
  '20:00','20:30','21:00','21:30','22:00'
];

/* ═══════════════════════════════════════════════════════════════
   PROBABILITY RING
   ═══════════════════════════════════════════════════════════════ */
function ProbabilityRing({ value = 0, size = 120, stroke = 8 }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 70 ? '#22c55e' : pct >= 45 ? '#eab308' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r}
          stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{pct}%</span>
        <span className="text-[10px] text-gray-500 mt-0.5">completion</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINI CALENDAR
   ═══════════════════════════════════════════════════════════════ */
function MiniCalendar({ selectedDate, onSelect }) {
  const [viewDate, setViewDate] = useState(new Date());
  const today = new Date();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const prev = () => setViewDate(new Date(year, month - 1, 1));
  const next = () => setViewDate(new Date(year, month + 1, 1));

  const isToday = (d) => d && today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
  const isSelected = (d) => {
    if (!d || !selectedDate) return false;
    const s = new Date(selectedDate);
    return s.getDate() === d && s.getMonth() === month && s.getFullYear() === year;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-300">{monthName}</span>
        <div className="flex gap-1">
          <button onClick={prev} className="p-1 rounded-md hover:bg-white/[0.06] text-gray-500 transition">
            <ChevronLeft size={14} />
          </button>
          <button onClick={next} className="p-1 rounded-md hover:bg-white/[0.06] text-gray-500 transition">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-[9px] text-gray-600 font-medium py-1">{d}</div>
        ))}
        {days.map((d, i) => (
          <button key={i} disabled={!d}
            onClick={() => d && onSelect(new Date(year, month, d).toISOString().split('T')[0])}
            className={`text-[11px] py-1 rounded-md transition ${
              !d ? '' :
              isSelected(d) ? 'bg-indigo-500 text-white font-bold' :
              isToday(d) ? 'bg-white/[0.08] text-indigo-400 font-semibold' :
              'text-gray-500 hover:bg-white/[0.05] hover:text-gray-300'
            }`}>
            {d || ''}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FOCUS TIMER (25-min Pomodoro)
   ═══════════════════════════════════════════════════════════════ */
function FocusTimer() {
  const TIMER_MODES = {
    focus: { label: 'Focus', seconds: 25 * 60, color: '#818cf8' },
    relax: { label: 'Relax', seconds: 10 * 60, color: '#22c55e' },
  };
  const [mode, setMode] = useState('focus');
  const [seconds, setSeconds] = useState(TIMER_MODES.focus.seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds(s => s - 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, seconds]);

  const totalSeconds = TIMER_MODES[mode].seconds;
  const min = String(Math.floor(seconds / 60)).padStart(2, '0');
  const sec = String(seconds % 60).padStart(2, '0');
  const pct = ((totalSeconds - seconds) / totalSeconds) * 100;

  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] mb-4">
        {Object.entries(TIMER_MODES).map(([key, item]) => (
          <button
            key={key}
            onClick={() => {
              setMode(key);
              setRunning(false);
              setSeconds(item.seconds);
            }}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition ${
              mode === key ? 'text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
            style={mode === key ? { background: `${item.color}22`, color: item.color } : undefined}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="relative inline-flex items-center justify-center w-24 h-24 mb-3">
        <svg width={96} height={96} className="-rotate-90">
          <circle cx={48} cy={48} r={40} stroke="rgba(255,255,255,0.06)" strokeWidth={5} fill="none" />
          <circle cx={48} cy={48} r={40}
            stroke={TIMER_MODES[mode].color} strokeWidth={5} fill="none"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 40}
            strokeDashoffset={2 * Math.PI * 40 - (pct / 100) * 2 * Math.PI * 40}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        </svg>
        <span className="absolute text-lg font-bold text-white">{min}:{sec}</span>
      </div>
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => setRunning(!running)}
          className="p-2 rounded-lg transition"
          style={{ background: `${TIMER_MODES[mode].color}22`, color: TIMER_MODES[mode].color }}>
          {running ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button onClick={() => { setRunning(false); setSeconds(totalSeconds); }}
          className="p-2 rounded-lg bg-white/[0.04] text-gray-500 hover:bg-white/[0.08] transition">
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   STATUS BADGE
   ═══════════════════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const config = {
    pending:    { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Queued' },
    in_progress:{ bg: 'bg-blue-500/10',   text: 'text-blue-400',   label: 'Active' },
    completed:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Done' },
    missed:     { bg: 'bg-red-500/10',     text: 'text-red-400',     label: 'Missed' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.text.replace('text-','bg-')}`} />
      {c.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRIORITY DOT
   ═══════════════════════════════════════════════════════════════ */
function PriorityDot({ priority }) {
  const colors = { high: 'bg-red-400', medium: 'bg-yellow-400', low: 'bg-emerald-400' };
  return <span className={`w-2 h-2 rounded-full ${colors[priority] || colors.medium}`} />;
}

/* ═══════════════════════════════════════════════════════════════
   TIMELINE (hourly schedule)
   ═══════════════════════════════════════════════════════════════ */
function Timeline({ tasks }) {
  const now = new Date();
  const currentHour = now.getHours();

  const scheduled = useMemo(() => {
    const map = {};
    (tasks || []).forEach(t => {
      if (t.scheduled_slot) {
        const hour = parseInt(t.scheduled_slot.split(':')[0], 10);
        if (!map[hour]) map[hour] = [];
        map[hour].push(t);
      }
    });
    return map;
  }, [tasks]);

  const hours = [];
  for (let h = 8; h <= 22; h++) hours.push(h);

  return (
    <div className="space-y-0.5">
      {hours.map(h => {
        const isCurrent = h === currentHour;
        const items = scheduled[h] || [];
        return (
          <div key={h} className={`flex gap-3 py-1.5 px-2 rounded-lg transition ${
            isCurrent ? 'bg-indigo-500/[0.08]' : 'hover:bg-white/[0.02]'
          }`}>
            <span className={`text-[10px] font-mono w-10 shrink-0 pt-0.5 ${
              isCurrent ? 'text-indigo-400 font-bold' : 'text-gray-600'
            }`}>
              {String(h).padStart(2,'0')}:00
            </span>
            <div className="flex-1 min-h-[20px]">
              {items.length > 0 ? items.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-[11px]">
                  <PriorityDot priority={t.priority} />
                  <span className={`${t.status === 'completed' ? 'line-through text-gray-600' : 'text-gray-300'}`}>
                    {t.subject}
                  </span>
                  <StatusBadge status={t.status} />
                </div>
              )) : (
                <div className={`h-px mt-2.5 ${isCurrent ? 'bg-indigo-500/30' : 'bg-white/[0.04]'}`} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BADGE LABEL HELPER
   ═══════════════════════════════════════════════════════════════ */
function getBadgeLabel(badge) {
  if (!badge) return '';
  if (typeof badge === 'string') return badge;
  return badge.name || badge.label || badge.title || JSON.stringify(badge);
}

function getDisplayText(value, keys = ['message', 'suggested_action', 'description', 'type']) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => getDisplayText(item, keys)).filter(Boolean).join(' · ');
  }
  if (typeof value === 'object') {
    for (const key of keys) {
      if (typeof value[key] === 'string' || typeof value[key] === 'number') return String(value[key]);
    }
  }
  return '';
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PLANNER COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function Planner() {
  const { dark } = useTheme();

  /* ── State ── */
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState('all');
  const [showProfile, setShowProfile] = useState(true);

  const [profile, setProfile] = useState({
    age: 21, gender: 'Male', part_time_job: 0,
    study_hours_per_day: 4, sleep_hours: 7, total_social_hours: 2,
  });

  const [tasks, setTasks] = useState([]);
  const [taskStats, setTaskStats] = useState({});
  const [streak, setStreak] = useState({ current_streak: 0, best_streak: 0, badges: [] });
  const [distraction, setDistraction] = useState(null);
  const [rescheduleAlert, setRescheduleAlert] = useState(null);

  const [newTask, setNewTask] = useState({
    subject: '', duration_minutes: 30, priority: 'medium', scheduled_slot: '09:00', notes: ''
  });
  const [showAddTask, setShowAddTask] = useState(false);

  /* ── Helpers ── */
  const updateProfile = (key, val) => setProfile(p => ({ ...p, [key]: val }));

  /* ── Data Fetching ── */
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API}/tasks`);
      if (!res.ok) return;
      const data = await res.json();
      setTasks(data.tasks || []);
      setTaskStats(data.stats || {});
      if (data.streak) setStreak(data.streak);
    } catch { /* silent */ }
  }, []);

  const fetchDistraction = useCallback(async () => {
    try {
      const res = await fetch(`${API}/distraction-check`);
      if (!res.ok) return;
      const data = await res.json();
      setDistraction(data);
      if (data.reschedule_suggestion) {
        setRescheduleAlert(data.reschedule_suggestion);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchDistraction();
    const t1 = setInterval(fetchTasks, 15000);
    const t2 = setInterval(fetchDistraction, 20000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [fetchTasks, fetchDistraction]);

  /* ── Actions ── */
  const predict = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error((await res.json()).detail || 'Prediction failed');
      const data = await res.json();
      setResult(data);
      if (data.streak) setStreak(data.streak);
      fetchTasks();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const addTask = async () => {
    if (!newTask.subject.trim()) return;
    try {
      const res = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        setNewTask({ subject: '', duration_minutes: 30, priority: 'medium', scheduled_slot: '09:00', notes: '' });
        setShowAddTask(false);
        fetchTasks();
      }
    } catch { /* silent */ }
  };

  const taskAction = async (id, action) => {
    try {
      const res = await fetch(`${API}/tasks/${id}/${action}`, { method: 'POST' });
      if (res.ok) fetchTasks();
    } catch { /* silent */ }
  };

  const deleteTask = async (id) => {
    try {
      const res = await fetch(`${API}/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) fetchTasks();
    } catch { /* silent */ }
  };

  /* ── Derived ── */
  const filteredTasks = useMemo(() => {
    if (activeTab === 'all') return tasks;
    if (activeTab === 'active') return tasks.filter(t => t.status === 'in_progress' || t.status === 'pending');
    if (activeTab === 'completed') return tasks.filter(t => t.status === 'completed');
    if (activeTab === 'missed') return tasks.filter(t => t.status === 'missed');
    return tasks;
  }, [tasks, activeTab]);

  const completionRate = useMemo(() => {
    if (!tasks.length) return 0;
    return Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100);
  }, [tasks]);

  const activeTasks = tasks.filter(t => t.status === 'in_progress' || t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const isDistracted = distraction?.is_distracted;
  const resultFeedbackText = getDisplayText(result?.feedback, ['message', 'suggested_action', 'feedback_type']);
  const resultSocialAlertText = getDisplayText(result?.social_alert, ['message', 'suggested_action', 'type']);

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="flex min-h-screen"
      style={{ background: 'radial-gradient(ellipse at 20% 0%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(139,92,246,0.06) 0%, transparent 50%), #0f1117' }}>

      <Sidebar active="Planner" />

      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">

        {/* ── HEADER ── */}
        <header className="sticky top-0 z-30 px-6 lg:px-8 py-4"
          style={{ background: 'rgba(15,17,23,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="max-w-[1440px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10">
                <Brain size={20} className="text-indigo-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Adaptive Planner</h1>
                <p className="text-[11px] text-gray-500">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isDistracted && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-[11px] font-semibold animate-pulse">
                  <AlertTriangle size={12} /> Distracted
                </span>
              )}
              {!isDistracted && distraction && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold">
                  <Target size={12} /> Focused
                </span>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] text-gray-400 text-[11px] font-medium">
                <Flame size={12} className="text-orange-400" />
                {streak.current_streak} day streak
              </div>
            </div>
          </div>
        </header>

        {/* ── RESCHEDULE ALERT ── */}
        {rescheduleAlert && (
          <div className="max-w-[1440px] mx-auto w-full px-6 lg:px-8 pt-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20">
              <AlertTriangle size={18} className="text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-300">Auto-Reschedule Suggested</p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  Distraction detected — consider rescheduling "{rescheduleAlert.task}" to {rescheduleAlert.new_slot || 'a later slot'}.
                </p>
              </div>
              <button onClick={() => setRescheduleAlert(null)}
                className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 transition">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1440px] mx-auto w-full">

          {/* ── HERO STATS ── */}
          <section className="rounded-[28px] p-6 lg:p-7 mb-8"
            style={{
              background: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.1) 0%, transparent 60%), linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 24px 56px rgba(2,6,23,0.3)',
            }}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: ListTodo, label: 'In Progress', value: tasks.filter(t=>t.status==='in_progress').length, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                { icon: Clock,    label: 'Queued',      value: tasks.filter(t=>t.status==='pending').length, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                { icon: Target,   label: 'Focus Rate',  value: `${completionRate}%`, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { icon: CheckCircle2, label: "Today's Done", value: completedTasks.length, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              ].map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                  <div className={`p-2.5 rounded-xl ${bg}`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500 font-medium">{label}</p>
                    <p className="text-xl font-bold text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ══════════════════════════════════════════
             THREE-COLUMN GRID
             ══════════════════════════════════════════ */}
          <div className="grid grid-cols-12 gap-7">

            {/* ── LEFT COLUMN (3 cols) ── */}
            <div className="col-span-12 lg:col-span-3 space-y-5">

              {/* Profile / Input Panel */}
              <div className="rounded-2xl p-5 border border-white/[0.06]"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                <button onClick={() => setShowProfile(!showProfile)}
                  className="w-full flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-indigo-400" />
                    <span className="text-xs font-semibold text-gray-300">Student Profile</span>
                  </div>
                  {showProfile ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </button>

                {showProfile && (
                  <div className="space-y-4">
                    {/* Age */}
                    <div>
                      <div className="flex justify-between mb-1.5">
                        <label className="text-[10px] text-gray-500 font-medium">Age</label>
                        <span className="text-[10px] text-indigo-400 font-bold">{profile.age}</span>
                      </div>
                      <input type="range" min={16} max={35} value={profile.age}
                        onChange={e => updateProfile('age', +e.target.value)}
                        className="w-full h-1 rounded-full bg-white/[0.08] appearance-none cursor-pointer accent-indigo-500" />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="text-[10px] text-gray-500 font-medium block mb-1.5">Gender</label>
                      <div className="flex gap-1.5">
                        {['Male', 'Female'].map(g => (
                          <button key={g} onClick={() => updateProfile('gender', g)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition ${
                              profile.gender === g
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-white/[0.03] text-gray-500 border border-white/[0.06] hover:bg-white/[0.06]'
                            }`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Part-Time Job */}
                    <div>
                      <label className="text-[10px] text-gray-500 font-medium block mb-1.5">Part-Time Job</label>
                      <div className="flex gap-1.5">
                        {[{ l: 'Yes', v: 1 }, { l: 'No', v: 0 }].map(({ l, v }) => (
                          <button key={l} onClick={() => updateProfile('part_time_job', v)}
                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition ${
                              profile.part_time_job === v
                                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-white/[0.03] text-gray-500 border border-white/[0.06] hover:bg-white/[0.06]'
                            }`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sliders */}
                    {[
                      { key: 'study_hours_per_day', label: 'Study Hours', min: 0, max: 12, icon: BookOpen, color: 'text-blue-400' },
                      { key: 'sleep_hours',         label: 'Sleep Hours', min: 3, max: 12, icon: Moon,     color: 'text-purple-400' },
                      { key: 'total_social_hours',  label: 'Social Media', min: 0, max: 10, icon: Smartphone, color: 'text-pink-400' },
                    ].map(({ key, label, min, max, icon: Icon, color }) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Icon size={10} className={color} />
                            <label className="text-[10px] text-gray-500 font-medium">{label}</label>
                          </div>
                          <span className="text-[10px] text-indigo-400 font-bold">{profile[key]}h</span>
                        </div>
                        <input type="range" min={min} max={max} value={profile[key]}
                          onChange={e => updateProfile(key, +e.target.value)}
                          className="w-full h-1 rounded-full bg-white/[0.08] appearance-none cursor-pointer accent-indigo-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mini Calendar */}
              <div className="rounded-2xl p-5 border border-white/[0.06]"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={14} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-gray-300">Calendar</span>
                </div>
                <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />
              </div>

              {/* Focus Timer */}
              <div className="rounded-2xl p-5 border border-white/[0.06]"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Timer size={14} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-gray-300">Focus Timer</span>
                </div>
                <FocusTimer />
              </div>

              {/* Streak & Badges */}
              <div className="rounded-2xl p-5 border border-white/[0.06]"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Flame size={14} className="text-orange-400" />
                  <span className="text-xs font-semibold text-gray-300">Momentum</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <p className="text-lg font-bold text-orange-400">{streak.current_streak}</p>
                    <p className="text-[9px] text-gray-500 font-medium mt-0.5">Current</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <p className="text-lg font-bold text-yellow-400">{streak.best_streak}</p>
                    <p className="text-[9px] text-gray-500 font-medium mt-0.5">Best</p>
                  </div>
                </div>
                {streak.badges && streak.badges.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 font-medium mb-2">Badges</p>
                    <div className="flex flex-wrap gap-1.5">
                      {streak.badges.map((b, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-400 text-[9px] font-semibold">
                          <Trophy size={9} /> {getBadgeLabel(b)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── CENTER COLUMN (5 cols) ── */}
            <div className="col-span-12 lg:col-span-5 space-y-5">

              {/* Predict Button */}
              <button onClick={predict} disabled={loading}
                className="w-full group relative overflow-hidden rounded-2xl p-5 border border-white/[0.08] transition-all hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10"
                style={{
                  background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%), linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/20">
                      {loading ? <RefreshCw size={18} className="text-indigo-400 animate-spin" /> : <Sparkles size={18} className="text-indigo-400" />}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-white">{loading ? 'Analyzing...' : 'Run AI Prediction'}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Random Forest model analysis</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-gray-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
              </button>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertTriangle size={14} className="text-red-400" />
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}

              {/* Prediction Result */}
              {result && (
                <div className="rounded-2xl p-6 border border-white/[0.06]"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                  <div className="flex items-start gap-5">
                    <ProbabilityRing value={result.task_completion_probability ?? result.completion_probability ?? 0} size={110} stroke={7} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white mb-1">
                        {result.planner_decision || 'Prediction Complete'}
                      </p>
                      <p className="text-xs text-gray-400 leading-relaxed mb-3">
                        {resultFeedbackText || 'No additional feedback.'}
                      </p>

                      {/* Social Alert */}
                      {resultSocialAlertText && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-pink-500/[0.08] border border-pink-500/20 mb-3">
                          <Smartphone size={13} className="text-pink-400 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-pink-300">{resultSocialAlertText}</p>
                        </div>
                      )}

                      {/* Stats from prediction */}
                      {result.task_stats && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { l: 'Total', v: result.task_stats.total || 0 },
                            { l: 'Done',  v: result.task_stats.completed || 0 },
                            { l: 'Rate',  v: `${result.task_stats.completion_rate || 0}%` },
                          ].map(({ l, v }) => (
                            <div key={l} className="text-center p-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                              <p className="text-sm font-bold text-white">{v}</p>
                              <p className="text-[9px] text-gray-500">{l}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div
                className="rounded-2xl border border-white/[0.06] p-4 lg:p-5 flex flex-col min-h-[520px] lg:max-h-[calc(100vh-280px)]"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}
              >
                <div className="flex items-center justify-between shrink-0">
                  <div className="flex gap-1">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'active', label: 'Active' },
                      { key: 'completed', label: 'Done' },
                      { key: 'missed', label: 'Missed' },
                    ].map(({ key, label }) => (
                      <button key={key} onClick={() => setActiveTab(key)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition ${
                          activeTab === key
                            ? 'bg-indigo-500/20 text-indigo-400'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowAddTask(!showAddTask)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 text-[11px] font-semibold hover:bg-indigo-500/30 transition">
                    <Plus size={12} /> Add Task
                  </button>
                </div>

                {showAddTask && (
                  <div className="rounded-2xl p-5 border border-indigo-500/20 space-y-3 mt-4 shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(255,255,255,0.02) 100%)' }}>
                    <input type="text" placeholder="Task subject..."
                      value={newTask.subject} onChange={e => setNewTask({ ...newTask, subject: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 transition" />
                    <div className="grid grid-cols-3 gap-2">
                      <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-gray-300 focus:outline-none focus:border-indigo-500/40 transition appearance-none">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <select value={newTask.scheduled_slot} onChange={e => setNewTask({ ...newTask, scheduled_slot: e.target.value })}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-gray-300 focus:outline-none focus:border-indigo-500/40 transition appearance-none">
                        {TIME_SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="number" min={5} max={180} value={newTask.duration_minutes}
                        onChange={e => setNewTask({ ...newTask, duration_minutes: +e.target.value })}
                        className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[11px] text-gray-300 focus:outline-none focus:border-indigo-500/40 transition"
                        placeholder="Min" />
                    </div>
                    <input type="text" placeholder="Notes (optional)..."
                      value={newTask.notes} onChange={e => setNewTask({ ...newTask, notes: e.target.value })}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/40 transition" />
                    <div className="flex gap-2">
                      <button onClick={addTask}
                        className="flex-1 py-2 rounded-xl bg-indigo-500 text-white text-xs font-bold hover:bg-indigo-600 transition">
                        Create Task
                      </button>
                      <button onClick={() => setShowAddTask(false)}
                        className="px-4 py-2 rounded-xl bg-white/[0.04] text-gray-500 text-xs font-medium hover:bg-white/[0.08] transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 mt-4 flex-1 overflow-y-auto pr-1 min-h-0" style={{ scrollbarWidth: 'thin' }}>
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-12 rounded-2xl border border-white/[0.06]"
                      style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.05) 0%, transparent 60%)' }}>
                      <Coffee size={28} className="mx-auto text-gray-600 mb-3" />
                      <p className="text-sm text-gray-500 font-medium">No tasks here</p>
                      <p className="text-[11px] text-gray-600 mt-1">Add a task to get started</p>
                    </div>
                  ) : filteredTasks.map(task => (
                    <div key={task.id}
                      className="group flex items-center gap-3 p-4 rounded-2xl border border-white/[0.06] hover:border-white/[0.1] transition"
                      style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <PriorityDot priority={task.priority} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-[13px] font-semibold truncate ${
                            task.status === 'completed' ? 'line-through text-gray-600' : 'text-gray-200'
                          }`}>
                            {task.subject}
                          </p>
                          <StatusBadge status={task.status} />
                        </div>
                        <div className="flex items-center gap-2.5 mt-1">
                          {task.scheduled_slot && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <Clock size={9} /> {task.scheduled_slot}
                            </span>
                          )}
                          {task.duration_minutes && (
                            <span className="text-[10px] text-gray-500">{task.duration_minutes}m</span>
                          )}
                          {task.notes && (
                            <span className="text-[10px] text-gray-600 truncate max-w-[120px]">{task.notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        {task.status === 'pending' && (
                          <button onClick={() => taskAction(task.id, 'start')}
                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-gray-500 hover:text-blue-400 transition"
                            title="Start">
                            <Play size={13} />
                          </button>
                        )}
                        {(task.status === 'pending' || task.status === 'in_progress') && (
                          <button onClick={() => taskAction(task.id, 'complete')}
                            className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400 transition"
                            title="Complete">
                            <CheckCircle2 size={13} />
                          </button>
                        )}
                        {(task.status === 'pending' || task.status === 'in_progress') && (
                          <button onClick={() => taskAction(task.id, 'miss')}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition"
                            title="Miss">
                            <X size={13} />
                          </button>
                        )}
                        <button onClick={() => deleteTask(task.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition"
                          title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN (4 cols) ── */}
            <div className="col-span-12 lg:col-span-4 space-y-5">

              {/* AI Insights Card */}
              <div className="rounded-2xl p-5 border border-white/[0.06]"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <Brain size={14} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-gray-300">AI Insights</span>
                </div>
                {result ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center mb-2">
                      <ProbabilityRing value={result.task_completion_probability ?? result.completion_probability ?? 0} size={90} stroke={6} />
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.03]">
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        {resultFeedbackText || 'Run prediction to see insights.'}
                      </p>
                    </div>
                    {resultSocialAlertText && (
                      <div className="p-3 rounded-xl bg-pink-500/[0.06] border border-pink-500/15">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Smartphone size={11} className="text-pink-400" />
                          <span className="text-[10px] font-semibold text-pink-400">Social Alert</span>
                        </div>
                        <p className="text-[10px] text-pink-300/80">{resultSocialAlertText}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Sparkles size={24} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-[11px] text-gray-500">Run a prediction to see insights</p>
                  </div>
                )}
              </div>

              {/* Distraction Status */}
              {distraction && (
                <div className="rounded-2xl p-5 border border-white/[0.06]"
                  style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Volume2 size={14} className={isDistracted ? 'text-red-400' : 'text-emerald-400'} />
                    <span className="text-xs font-semibold text-gray-300">Distraction Monitor</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-500">Status</span>
                      <span className={`text-[10px] font-bold ${isDistracted ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isDistracted ? 'Distracted' : 'Focused'}
                      </span>
                    </div>
                    {distraction.confidence !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Confidence</span>
                        <span className="text-[10px] font-bold text-gray-300">
                          {Math.round((distraction.confidence || 0) * 100)}%
                        </span>
                      </div>
                    )}
                    {distraction.dominant_app && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Current App</span>
                        <span className="text-[10px] font-bold text-gray-300">{distraction.dominant_app}</span>
                      </div>
                    )}
                    {distraction.distraction_streak > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Distraction Streak</span>
                        <span className="text-[10px] font-bold text-red-400">{distraction.distraction_streak}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Today's Timeline */}
              <div className="rounded-2xl p-5 border border-white/[0.06]"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays size={14} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-gray-300">Today's Schedule</span>
                </div>
                <div className="max-h-[400px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  <Timeline tasks={tasks} />
                </div>
              </div>

              {/* Quick Stats */}
              <div className="rounded-2xl p-5 border border-white/[0.06]"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)' }}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={14} className="text-indigo-400" />
                  <span className="text-xs font-semibold text-gray-300">Task Statistics</span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Total Tasks',     value: taskStats.total || tasks.length, color: 'text-white' },
                    { label: 'Completed',        value: taskStats.completed || completedTasks.length, color: 'text-emerald-400' },
                    { label: 'Active',           value: taskStats.active || activeTasks.length, color: 'text-blue-400' },
                    { label: 'Completion Rate',  value: `${taskStats.completion_rate || completionRate}%`, color: 'text-indigo-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                      <span className="text-[10px] text-gray-500">{label}</span>
                      <span className={`text-sm font-bold ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <Footer />
      </main>
    </div>
  );
}
