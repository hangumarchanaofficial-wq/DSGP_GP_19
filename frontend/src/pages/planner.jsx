import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useTheme } from '../context/ThemeContext';
import {
  CalendarCheck, AlertTriangle, CheckCircle, Coffee, Brain, Plus, Play, Check, X,
  Trash2, RefreshCw, AlertCircle, Zap, Target, ChevronLeft, ChevronRight, Flame,
  Trophy, TrendingUp, Sparkles, Eye, Pause, SkipForward, ArrowRight, ChevronDown,
} from 'lucide-react';

function ProbabilityRing({ value, size = 168 }) {
  const pct = Math.round(value * 100);
  const strokeW = 7;
  const r = (size / 2) - strokeW - 6;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center rounded-[34px]" style={{
      width: size,
      height: size,
      background: 'radial-gradient(circle at 30% 30%, rgba(129,140,248,0.18), rgba(129,140,248,0.04) 44%, transparent 72%)',
    }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeW} opacity="0.28" />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease', filter: 'drop-shadow(0 0 12px rgba(129,140,248,0.18))' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black" style={{ fontSize: size * 0.26, color, lineHeight: 1 }}>{pct}</span>
        <span className="text-[9px] font-semibold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>
          percent
        </span>
      </div>
    </div>
  );
}

function MiniCalendar({ selectedDate, onSelect }) {
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const days = [];

  for (let i = 0; i < firstDay; i += 1) days.push(null);
  for (let i = 1; i <= daysInMonth; i += 1) days.push(i);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isSelected = (d) => d && selectedDate && d === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();

  return (
    <div className="rounded-[28px] p-5 planner-card planner-subtle">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => setViewDate(new Date(year, month - 1))} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        </button>
        <span className="text-[14px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {monthNames[month]} {year}
        </span>
        <button onClick={() => setViewDate(new Date(year, month + 1))} className="p-2 rounded-xl hover:bg-[var(--bg-elevated)] transition-colors">
          <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium py-1.5" style={{ color: 'var(--text-muted)' }}>{d}</div>
        ))}
        {days.map((d, i) => (
          <button
            key={`${d || 'blank'}-${i}`}
            disabled={!d}
            onClick={() => d && onSelect(new Date(year, month, d))}
            className="aspect-square flex items-center justify-center text-[11px] font-medium rounded-xl transition-all"
            style={{
              background: isSelected(d)
                ? 'linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))'
                : isToday(d)
                  ? 'rgba(129,140,248,0.08)'
                  : 'transparent',
              color: isSelected(d) ? '#fff' : isToday(d) ? 'var(--accent)' : d ? 'var(--text-secondary)' : 'transparent',
              fontWeight: isToday(d) || isSelected(d) ? 700 : 500,
              boxShadow: isSelected(d) ? '0 12px 24px rgba(99,102,241,0.24)' : 'none',
            }}
          >
            {d || ''}
          </button>
        ))}
      </div>
    </div>
  );
}

function FocusTimer() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState('focus');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds((s) => s - 1), 1000);
    } else {
      clearInterval(intervalRef.current);
      if (seconds === 0 && running) {
        setRunning(false);
        setMode((m) => m === 'focus' ? 'break' : 'focus');
        setSeconds(mode === 'focus' ? 5 * 60 : 25 * 60);
      }
    }
    return () => clearInterval(intervalRef.current);
  }, [running, seconds, mode]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const total = mode === 'focus' ? 25 * 60 : 5 * 60;
  const progress = ((total - seconds) / total) * 100;

  return (
    <div className="rounded-[28px] p-5 planner-card planner-subtle">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h4 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {mode === 'focus' ? 'Focus' : 'Break'}
          </h4>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Pomodoro timer</p>
        </div>
        <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {[{ m: 'focus', l: '25m' }, { m: 'break', l: '5m' }].map(({ m, l }) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setSeconds(m === 'focus' ? 25 * 60 : 5 * 60);
                setRunning(false);
              }}
              className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={{
                background: mode === m ? 'linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-muted)',
                boxShadow: mode === m ? '0 12px 24px rgba(99,102,241,0.2)' : 'none',
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="text-center py-4 mb-5 rounded-[24px]" style={{
        background: 'radial-gradient(circle at top, rgba(129,140,248,0.16), transparent 60%)',
      }}>
        <div className="text-6xl font-black tracking-tight" style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {String(mins).padStart(2, '0')}
          <span style={{ color: running ? 'var(--accent)' : 'var(--text-muted)', opacity: running ? 1 : 0.4 }}>:</span>
          {String(secs).padStart(2, '0')}
        </div>
      </div>

      <div className="w-full h-2 rounded-full overflow-hidden mb-6" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress}%`,
            background: mode === 'focus'
              ? 'linear-gradient(90deg, #818cf8, #6366f1)'
              : 'linear-gradient(90deg, #34d399, #10b981)',
          }}
        />
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => {
            setRunning(false);
            setSeconds(mode === 'focus' ? 25 * 60 : 5 * 60);
          }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setRunning(!running)}
          className="w-14 h-14 rounded-[22px] flex items-center justify-center transition-all"
          style={{
            background: running ? '#ef4444' : 'linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))',
            color: '#fff',
            boxShadow: running ? '0 14px 28px rgba(239,68,68,0.2)' : '0 16px 28px rgba(99,102,241,0.22)',
          }}
        >
          {running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <button
          onClick={() => {
            setRunning(false);
            setMode((m) => m === 'focus' ? 'break' : 'focus');
            setSeconds(mode === 'focus' ? 5 * 60 : 25 * 60);
          }}
          className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const m = {
    pending: { color: '#f59e0b', label: 'Pending' },
    active: { color: '#818cf8', label: 'Active' },
    completed: { color: '#10b981', label: 'Done' },
    missed: { color: '#ef4444', label: 'Missed' },
    rescheduled: { color: '#a855f7', label: 'Moved' },
  };
  const s = m[status] || m.pending;

  return (
    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: `${s.color}14`, color: s.color }}>
      {s.label}
    </span>
  );
}

function PriorityDot({ priority }) {
  const c = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
  return <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c[priority] || c.medium }} />;
}

const TIME_SLOTS = [
  '6-7 AM', '7-8 AM', '8-9 AM', '9-10 AM', '10-11 AM', '11-12 PM',
  '12-1 PM', '1-2 PM', '2-3 PM', '3-4 PM', '4-5 PM', '5-6 PM',
  '6-7 PM', '7-8 PM', '8-9 PM', '9-10 PM', '10-11 PM',
];

function Timeline({ tasks }) {
  const now = new Date();
  const currentHour = now.getHours();

  const slotToHour = (slot) => {
    const match = slot.match(/^(\d+)/);
    if (!match) return -1;
    let h = parseInt(match[1], 10);
    if (slot.includes('PM') && h !== 12) h += 12;
    if (slot.includes('AM') && h === 12) h = 0;
    return h;
  };

  const taskMap = {};
  tasks.forEach((t) => {
    if (t.scheduled_slot) taskMap[t.scheduled_slot] = t;
  });

  return (
    <div className="space-y-0">
      {TIME_SLOTS.map((slot) => {
        const hour = slotToHour(slot);
        const isCurrent = hour === currentHour;
        const task = taskMap[slot];
        const isPast = hour < currentHour;

        return (
          <div key={slot} className="flex gap-4 group" style={{ opacity: isPast && !task ? 0.42 : 1 }}>
            <div className="w-12 text-right pt-3 flex-shrink-0">
              <span className="text-[11px] font-medium" style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-muted)' }}>
                {slot.split('-')[0]}
              </span>
              <span className="text-[9px] ml-0.5" style={{ color: 'var(--text-muted)' }}>
                {slot.includes('AM') ? 'am' : 'pm'}
              </span>
            </div>

            <div className="flex flex-col items-center pt-3.5 flex-shrink-0">
              <div
                className="w-2.5 h-2.5 rounded-full transition-all flex-shrink-0"
                style={{
                  background: isCurrent ? 'var(--accent)' : task ? (
                    task.status === 'completed' ? '#10b981' : task.status === 'active' ? '#818cf8' : 'var(--border)'
                  ) : 'var(--border)',
                  boxShadow: isCurrent ? '0 0 0 4px rgba(99,102,241,0.15)' : 'none',
                }}
              />
              <div className="w-px flex-1 mt-1.5" style={{ background: 'var(--border)', opacity: 0.45 }} />
            </div>

            <div className="flex-1 pb-3 pt-1.5">
              {task ? (
                <div
                  className="px-4 py-3 rounded-[20px] transition-all"
                  style={{
                    background: task.status === 'active' ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${task.status === 'active' ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.04)'}`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="text-[13px] font-semibold truncate"
                      style={{
                        color: 'var(--text-primary)',
                        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                        opacity: task.status === 'completed' ? 0.5 : 1,
                      }}
                    >
                      {task.subject}
                    </span>
                    <StatusBadge status={task.status} />
                  </div>
                  <span className="text-[10px] mt-1.5 block" style={{ color: 'var(--text-muted)' }}>
                    {task.duration_minutes}min
                    {task.distraction_events > 0 && ` · ${task.distraction_events} distractions`}
                  </span>
                </div>
              ) : (
                <div className="h-9 opacity-0 group-hover:opacity-100 transition-opacity flex items-center px-3">
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Open slot</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Planner() {
  const { dark } = useTheme();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('all');
  const [profileOpen, setProfileOpen] = useState(true);

  const [form, setForm] = useState({
    age: 20,
    gender: 'Male',
    part_time_job: 'No',
    study_hours_per_day: 3,
    sleep_hours: 7,
    total_social_hours: 1.5,
  });

  const [tasks, setTasks] = useState([]);
  const [taskStats, setTaskStats] = useState(null);
  const [streakInfo, setStreakInfo] = useState(null);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    subject: '',
    duration_minutes: 60,
    priority: 'medium',
    scheduled_slot: '',
    notes: '',
  });

  const [distractionState, setDistractionState] = useState(null);
  const [rescheduleAlert, setRescheduleAlert] = useState(null);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const getBadgeLabel = (badge) => {
    if (badge == null) return '';
    if (typeof badge === 'string' || typeof badge === 'number') return String(badge);
    if (typeof badge === 'object') {
      if (typeof badge.name === 'string') return badge.name;
      if (typeof badge.description === 'string') return badge.description;
      if (typeof badge.id === 'string' || typeof badge.id === 'number') return `Badge ${badge.id}`;
    }
    return '';
  };

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/planner/tasks');
      if (res.ok) {
        const d = await res.json();
        setTasks(d.tasks || []);
        setTaskStats(d.stats || null);
        if (d.streak_info) setStreakInfo(d.streak_info);
      }
    } catch (_) {}
  }, []);

  const fetchDistraction = useCallback(async () => {
    try {
      const res = await fetch('/api/planner/distraction-check');
      if (res.ok) {
        const d = await res.json();
        setDistractionState(d.distraction_state);
        if (d.auto_reschedule) {
          setRescheduleAlert(d.auto_reschedule);
          fetchTasks();
        }
      }
    } catch (_) {}
  }, [fetchTasks]);

  useEffect(() => {
    fetchTasks();
    fetchDistraction();
    const i = setInterval(() => {
      fetchTasks();
      fetchDistraction();
    }, 10000);
    return () => clearInterval(i);
  }, [fetchTasks, fetchDistraction]);

  const handleAddTask = async () => {
    if (!newTask.subject.trim()) return;
    try {
      const res = await fetch('/api/planner/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        setNewTask({ subject: '', duration_minutes: 60, priority: 'medium', scheduled_slot: '', notes: '' });
        setShowAddTask(false);
        fetchTasks();
      }
    } catch (_) {}
  };

  const taskAction = async (id, action) => {
    try {
      const r = await fetch(`/api/planner/tasks/${id}/${action}`, { method: 'POST' });
      if (r.ok) fetchTasks();
    } catch (_) {}
  };

  const deleteTask = async (id) => {
    try {
      const r = await fetch(`/api/planner/tasks/${id}`, { method: 'DELETE' });
      if (r.ok) fetchTasks();
    } catch (_) {}
  };

  const handlePredict = async () => {
    setLoading(true);
    setError(null);
    try {
      const schedule = tasks.map((t) => ({
        time: t.scheduled_slot || '',
        status: t.status === 'completed' ? 'occupied' : 'free',
      }));
      const res = await fetch('/api/planner/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, schedule }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      if (data.task_stats) setTaskStats(data.task_stats);
      if (data.streak_info) setStreakInfo(data.streak_info);
    } catch (err) {
      setError(err.message || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    if (activeTab === 'all') return tasks;
    if (activeTab === 'active') return tasks.filter((t) => t.status === 'active' || t.status === 'pending' || t.status === 'rescheduled');
    if (activeTab === 'completed') return tasks.filter((t) => t.status === 'completed');
    if (activeTab === 'missed') return tasks.filter((t) => t.status === 'missed');
    return tasks;
  }, [tasks, activeTab]);

  const feedbackConf = {
    recovery: { icon: Coffee, color: '#ef4444' },
    missed_support: { icon: CalendarCheck, color: '#f59e0b' },
    refocus: { icon: Brain, color: '#f59e0b' },
    streak: { icon: Flame, color: '#10b981' },
    praise: { icon: Trophy, color: '#10b981' },
    encourage: { icon: TrendingUp, color: '#818cf8' },
    distraction_warning: { icon: AlertCircle, color: '#ef4444' },
    auto_reschedule: { icon: RefreshCw, color: '#a855f7' },
  };

  const completedCount = taskStats?.completed || 0;
  const totalCount = taskStats?.total || tasks.length || 0;
  const currentStreak = streakInfo?.current_streak || 0;
  const focusRate = streakInfo ? Math.round(streakInfo.focus_rate || 0) : null;
  const activeCount = tasks.filter((t) => t.status === 'active').length;
  const pendingCount = tasks.filter((t) => t.status === 'pending' || t.status === 'rescheduled').length;
  const statusTone = distractionState?.is_distracted ? '#ef4444' : '#10b981';
  const statusLabel = distractionState
    ? distractionState.is_distracted
      ? `Distracted ${Math.round((distractionState.confidence || 0) * 100)}%`
      : 'Focused'
    : 'Monitoring';

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: dark
          ? 'radial-gradient(circle at top left, rgba(99,102,241,0.12), transparent 22%), radial-gradient(circle at top right, rgba(16,185,129,0.08), transparent 20%), var(--bg-primary)'
          : 'radial-gradient(circle at top left, rgba(99,102,241,0.08), transparent 22%), radial-gradient(circle at top right, rgba(16,185,129,0.05), transparent 20%), var(--bg-primary)',
      }}
    >
      <Sidebar active="Planner" />

      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <header
          className="sticky top-0 z-30 px-6 lg:px-8 py-4"
          style={{
            background: dark ? 'rgba(8,10,18,0.78)' : 'rgba(252,252,254,0.82)',
            backdropFilter: 'blur(24px)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center justify-between max-w-[1440px] mx-auto gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Smart Planning
              </p>
              <h1 className="text-[28px] font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Planner
              </h1>
              <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap justify-end">
              <div
                className="flex items-center gap-2 px-3.5 py-2 rounded-full"
                style={{
                  background: `${statusTone}14`,
                  color: statusTone,
                  border: `1px solid ${statusTone}22`,
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusTone, animation: 'pulse 2s infinite' }} />
                <span className="text-[11px] font-semibold">{statusLabel}</span>
              </div>
              {currentStreak > 0 && (
                <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-full" style={{
                  background: 'rgba(245,158,11,0.08)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245,158,11,0.14)',
                }}>
                  <Flame className="w-3 h-3" />
                  <span className="text-[11px] font-semibold">{currentStreak} day streak</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-full" style={{
                background: 'rgba(99,102,241,0.08)',
                color: '#818cf8',
                border: '1px solid rgba(99,102,241,0.14)',
              }}>
                <span className="text-[11px] font-semibold">
                  {totalCount > 0 ? `${completedCount}/${totalCount} completed` : 'No tasks yet'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {rescheduleAlert && (
          <div className="max-w-[1440px] mx-auto w-full px-6 lg:px-8 pt-5">
            <div className="p-4 rounded-[24px] flex items-center gap-3 planner-card" style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)' }}>
              <RefreshCw className="w-4 h-4 flex-shrink-0" style={{ color: '#a855f7' }} />
              <p className="text-[12px] flex-1" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: '#a855f7' }}>Auto-rescheduled</strong> "{rescheduleAlert.task_subject}" moved to {rescheduleAlert.new_slot}
              </p>
              <button onClick={() => setRescheduleAlert(null)} className="p-1 rounded-lg hover:opacity-60">
                <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1440px] mx-auto w-full">
          <section className="planner-hero rounded-[32px] p-6 lg:p-7 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr,0.9fr] gap-6 items-start">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{
                  background: 'rgba(129,140,248,0.1)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(129,140,248,0.18)',
                }}>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">Adaptive study planning</span>
                </div>
                <h2 className="text-[26px] lg:text-[32px] font-black leading-tight max-w-[700px]" style={{ color: 'var(--text-primary)' }}>
                  Build a sharper day with cleaner scheduling, fewer distractions, and clearer execution.
                </h2>
                <p className="text-[13px] mt-3 max-w-[620px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Tune your profile, manage the queue, and run a prediction when you want the planner to rebalance the day.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'In progress', value: activeCount, icon: Play, tone: '#818cf8' },
                  { label: 'Queued', value: pendingCount, icon: Target, tone: '#f59e0b' },
                  { label: 'Focus rate', value: focusRate != null ? `${focusRate}%` : '—', icon: Eye, tone: '#10b981' },
                  { label: 'Today done', value: totalCount > 0 ? `${completedCount}/${totalCount}` : '0/0', icon: CheckCircle, tone: '#38bdf8' },
                ].map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="rounded-[24px] p-4 planner-stat">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${tone}14`, color: tone }}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-[22px] font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{value}</div>
                    <div className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-3 space-y-6">
              <section className="rounded-[28px] p-5 planner-card">
                <button onClick={() => setProfileOpen(!profileOpen)} className="w-full flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      Inputs
                    </p>
                    <h2 className="text-[16px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      Student Profile
                    </h2>
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
                </button>

                {profileOpen && (
                  <div className="space-y-4 pb-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Age</label>
                        <input
                          type="number"
                          min={14}
                          max={35}
                          value={form.age}
                          onChange={(e) => update('age', parseInt(e.target.value, 10) || 18)}
                          className="w-full px-3 py-3 rounded-2xl text-[13px] font-medium outline-none transition-all planner-input"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Gender</label>
                        <div className="flex gap-1.5">
                          {['Male', 'Female'].map((g) => (
                            <button
                              key={g}
                              onClick={() => update('gender', g)}
                              className="flex-1 py-3 rounded-2xl text-[11px] font-semibold transition-all"
                              style={{
                                background: form.gender === g ? 'linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))' : 'var(--bg-elevated)',
                                color: form.gender === g ? '#fff' : 'var(--text-muted)',
                                boxShadow: form.gender === g ? '0 12px 24px rgba(99,102,241,0.2)' : 'none',
                              }}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Part-time Job</label>
                      <div className="flex gap-1.5">
                        {['Yes', 'No'].map((v) => (
                          <button
                            key={v}
                            onClick={() => update('part_time_job', v)}
                            className="flex-1 py-3 rounded-2xl text-[11px] font-semibold transition-all"
                            style={{
                              background: form.part_time_job === v ? 'linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))' : 'var(--bg-elevated)',
                              color: form.part_time_job === v ? '#fff' : 'var(--text-muted)',
                              boxShadow: form.part_time_job === v ? '0 12px 24px rgba(99,102,241,0.2)' : 'none',
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {[
                      { key: 'study_hours_per_day', label: 'Study hours / day', min: 0, max: 12, step: 0.5, color: '#818cf8' },
                      { key: 'sleep_hours', label: 'Sleep hours', min: 3, max: 12, step: 0.5, color: '#38bdf8' },
                      { key: 'total_social_hours', label: 'Social media hours', min: 0, max: 8, step: 0.1, color: '#f59e0b' },
                    ].map(({ key, label, min, max, step, color }) => (
                      <div key={key}>
                        <div className="flex justify-between mb-2">
                          <label className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
                          <span className="text-[12px] font-bold" style={{ color }}>{form[key]}h</span>
                        </div>
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={form[key]}
                          onChange={(e) => update(key, parseFloat(e.target.value))}
                          className="slider-input w-full"
                          style={{ '--slider-color': color }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} />

              <FocusTimer />

              {streakInfo && (
                <section className="rounded-[28px] p-5 planner-card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                        Momentum
                      </p>
                      <h2 className="text-[16px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        Focus Streak
                      </h2>
                    </div>
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                      <Flame className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { v: streakInfo.current_streak, l: 'Current', c: '#f59e0b' },
                      { v: streakInfo.best_streak, l: 'Best', c: '#818cf8' },
                      { v: `${Math.round(streakInfo.focus_rate)}%`, l: 'Rate', c: '#10b981' },
                    ].map(({ v, l, c }) => (
                      <div key={l} className="text-center py-4 rounded-2xl planner-subtle">
                        <div className="text-xl font-black" style={{ color: c }}>{v}</div>
                        <div className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>{l}</div>
                      </div>
                    ))}
                  </div>

                  {streakInfo.badges && streakInfo.badges.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {streakInfo.badges.map((b, i) => {
                        const label = getBadgeLabel(b);
                        if (!label) return null;
                        const key = b && typeof b === 'object' && b.id != null ? `badge-${b.id}` : `badge-${i}`;
                        return (
                          <span key={key} className="px-3 py-1.5 rounded-full text-[10px] font-semibold" style={{
                            background: 'rgba(245,158,11,0.1)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.14)',
                          }}>
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>

            <div className="col-span-12 lg:col-span-5 space-y-6">
              <section className="rounded-[30px] p-5 lg:p-6 planner-card planner-action">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.72)' }}>
                      Planner AI
                    </p>
                    <h2 className="text-[22px] font-black tracking-tight text-white">Predict completion</h2>
                    <p className="text-[12px] mt-2 max-w-[420px]" style={{ color: 'rgba(255,255,255,0.72)' }}>
                      Evaluate your current workload and get schedule-aware guidance before you commit.
                    </p>
                  </div>

                  <button
                    onClick={handlePredict}
                    disabled={loading}
                    className="min-w-[220px] flex items-center justify-center gap-2.5 py-4 px-5 rounded-[22px] text-[13px] font-semibold text-white transition-all disabled:opacity-50 active:scale-[0.99]"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.16)',
                      boxShadow: '0 16px 30px rgba(15,23,42,0.18)',
                    }}
                  >
                    {loading
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <Sparkles className="w-4 h-4" />}
                    {loading ? 'Analyzing...' : 'Run Prediction'}
                  </button>
                </div>
              </section>

              {error && (
                <div className="p-3.5 rounded-2xl text-[12px] font-medium flex items-center gap-2 planner-card" style={{
                  background: 'rgba(239,68,68,0.06)',
                  color: '#ef4444',
                  border: '1px solid rgba(239,68,68,0.12)',
                }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {error}
                </div>
              )}

              <section className="rounded-[30px] p-5 lg:p-6 planner-card">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      Queue
                    </p>
                    <h2 className="text-[18px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      Tasks {taskStats ? <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({taskStats.total})</span> : ''}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAddTask(!showAddTask)}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all"
                    style={{ background: 'var(--bg-elevated)', color: showAddTask ? '#ef4444' : 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    {showAddTask ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex gap-2 mb-5 flex-wrap">
                  {['all', 'active', 'completed', 'missed'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="px-3.5 py-2 rounded-full text-[11px] font-semibold capitalize transition-all"
                      style={{
                        color: activeTab === tab ? '#fff' : 'var(--text-muted)',
                        background: activeTab === tab ? 'linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.75))' : 'transparent',
                        border: activeTab === tab ? '1px solid rgba(129,140,248,0.18)' : '1px solid var(--border)',
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {showAddTask && (
                  <div className="mb-5 p-5 rounded-[24px] space-y-3 planner-subtle" style={{ border: '1px solid var(--border)' }}>
                    <input
                      value={newTask.subject}
                      placeholder="What do you need to study?"
                      onChange={(e) => setNewTask((t) => ({ ...t, subject: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                      className="w-full px-0 py-2 text-[15px] font-medium outline-none bg-transparent placeholder:text-[var(--text-muted)]"
                      style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}
                      autoFocus
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        {
                          label: 'Duration',
                          value: newTask.duration_minutes,
                          onChange: (e) => setNewTask((t) => ({ ...t, duration_minutes: parseInt(e.target.value, 10) })),
                          options: [{ v: 15, l: '15m' }, { v: 30, l: '30m' }, { v: 45, l: '45m' }, { v: 60, l: '1h' }, { v: 90, l: '1.5h' }, { v: 120, l: '2h' }],
                        },
                        {
                          label: 'Priority',
                          value: newTask.priority,
                          onChange: (e) => setNewTask((t) => ({ ...t, priority: e.target.value })),
                          options: [{ v: 'high', l: 'High' }, { v: 'medium', l: 'Medium' }, { v: 'low', l: 'Low' }],
                        },
                        {
                          label: 'Time Slot',
                          value: newTask.scheduled_slot,
                          onChange: (e) => setNewTask((t) => ({ ...t, scheduled_slot: e.target.value })),
                          options: [{ v: '', l: 'Select...' }, ...TIME_SLOTS.map((s) => ({ v: s, l: s }))],
                        },
                      ].map(({ label, value, onChange, options }) => (
                        <div key={label}>
                          <label className="text-[9px] font-medium uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                            {label}
                          </label>
                          <select
                            value={value}
                            onChange={onChange}
                            className="w-full px-3 py-3 rounded-2xl text-[11px] font-medium outline-none appearance-none planner-input"
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                          >
                            {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleAddTask}
                        className="flex-1 py-3 rounded-2xl text-[11px] font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))', boxShadow: '0 16px 28px rgba(99,102,241,0.18)' }}
                      >
                        Add Task
                      </button>
                      <button onClick={() => setShowAddTask(false)} className="px-4 py-3 rounded-2xl text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
                  {filteredTasks.length === 0 ? (
                    <div className="py-16 text-center rounded-[24px] planner-subtle">
                      <p className="text-[12px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {activeTab === 'all' ? 'No tasks yet' : `No ${activeTab} tasks`}
                      </p>
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <div key={task.id} className="group flex items-center gap-3 px-4 py-4 rounded-[22px] transition-all planner-task-row">
                        <PriorityDot priority={task.priority} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold truncate" style={{
                              color: 'var(--text-primary)',
                              textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                              opacity: task.status === 'completed' ? 0.45 : 1,
                            }}>
                              {task.subject}
                            </span>
                            <StatusBadge status={task.status} />
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{task.duration_minutes}m</span>
                            {task.scheduled_slot && <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{task.scheduled_slot}</span>}
                            {task.distraction_events > 0 && <span className="text-[11px] font-medium" style={{ color: '#ef4444' }}>{task.distraction_events} distr.</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(task.status === 'pending' || task.status === 'rescheduled') && (
                            <button onClick={() => taskAction(task.id, 'start')} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: '#818cf8', background: 'rgba(129,140,248,0.08)' }}>
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {task.status === 'active' && (
                            <button onClick={() => taskAction(task.id, 'complete')} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: '#10b981', background: 'rgba(16,185,129,0.08)' }}>
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => deleteTask(task.id)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {taskStats && taskStats.total > 0 && (
                  <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        {taskStats.completed} of {taskStats.total} complete
                      </span>
                      <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                        {taskStats.completion_rate}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{
                        width: `${taskStats.completion_rate}%`,
                        background: 'linear-gradient(90deg, #818cf8, #6366f1)',
                      }} />
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-6">
              {result ? (
                <>
                  {result.distraction_aware && result.live_distraction && (
                    <div className="flex items-center gap-3 p-4 rounded-[24px] planner-card" style={{
                      background: result.live_distraction.is_distracted ? 'rgba(239,68,68,0.04)' : 'rgba(16,185,129,0.04)',
                      border: `1px solid ${result.live_distraction.is_distracted ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}`,
                    }}>
                      <Zap className="w-4 h-4 flex-shrink-0" style={{ color: result.live_distraction.is_distracted ? '#ef4444' : '#10b981' }} />
                      <div className="flex-1">
                        <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {result.live_distraction.is_distracted ? 'Distracted' : 'Focused'} {Math.round(result.live_distraction.confidence * 100)}%
                        </p>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {result.live_distraction.dominant_app}
                          {result.distraction_adjustment > 0 && ` · -${Math.round(result.distraction_adjustment * 100)}%`}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="p-6 rounded-[30px] planner-card">
                    <div className="flex flex-col items-center text-center">
                      <ProbabilityRing value={result.task_completion_probability} />

                      <div className="mt-5 mb-3">
                        <span className="px-3 py-1 rounded-full text-[11px] font-semibold" style={{
                          background: result.prediction === 1 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                          color: result.prediction === 1 ? '#10b981' : '#ef4444',
                        }}>
                          {result.prediction === 1 ? 'Can Complete' : 'At Risk'}
                        </span>
                        {result.distraction_adjustment > 0 && (
                          <span className="ml-1.5 px-2 py-1 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(168,85,247,0.08)', color: '#a855f7' }}>
                            Adjusted
                          </span>
                        )}
                      </div>

                      <h3 className="text-[16px] font-semibold leading-snug mb-1 max-w-[280px]" style={{ color: 'var(--text-primary)' }}>
                        {result.planner_decision}
                      </h3>

                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {(result.task_completion_probability * 100).toFixed(1)}% probability
                        {result.original_probability !== result.task_completion_probability && (
                          <span> · base {(result.original_probability * 100).toFixed(1)}%</span>
                        )}
                      </p>

                      {result.new_slot && (
                        <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)' }}>
                          <CalendarCheck className="w-3.5 h-3.5" style={{ color: '#818cf8' }} />
                          <span className="text-[11px] font-semibold" style={{ color: '#818cf8' }}>
                            Rescheduled to {result.new_slot}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {result.reschedule_info && (
                    <div className="p-4 rounded-[24px] planner-card" style={{ background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)' }}>
                      <div className="flex items-start gap-3">
                        <RefreshCw className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#a855f7' }} />
                        <div>
                          <p className="text-[12px] font-semibold" style={{ color: '#a855f7' }}>Rescheduled</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                            "{result.reschedule_info.task_subject}" to {result.reschedule_info.new_slot}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.feedback && (() => {
                    const cfg = feedbackConf[result.feedback.feedback_type] || { icon: Sparkles, color: '#818cf8' };
                    const Icon = cfg.icon;
                    return (
                      <div className="p-5 rounded-[28px] planner-card">
                        <div className="flex items-center gap-2 mb-4">
                          <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            AI Feedback
                          </h3>
                        </div>
                        <p className="text-[13px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                          {result.feedback.message}
                        </p>
                        <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                          <ArrowRight className="w-3 h-3" style={{ color: cfg.color }} />
                          <p className="text-[11px] font-semibold" style={{ color: cfg.color }}>
                            {result.feedback.suggested_action}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {result.social_alert && (
                    <div className="p-5 rounded-[28px] planner-card" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)' }}>
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-[12px] font-semibold" style={{ color: '#f59e0b' }}>Social Media Alert</h4>
                            <span className="text-[10px] font-semibold" style={{ color: '#f59e0b' }}>#{result.social_alert.alert_count}</span>
                          </div>
                          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {result.social_alert.message}
                          </p>
                          <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
                            {result.social_alert.suggested_action}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 rounded-[30px] planner-card planner-empty">
                  <div className="w-16 h-16 rounded-[24px] mb-5 flex items-center justify-center" style={{ background: 'rgba(129,140,248,0.12)' }}>
                    <Sparkles className="w-7 h-7" style={{ color: 'var(--accent)' }} />
                  </div>
                  <h3 className="text-[20px] font-black tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
                    Ready to analyze
                  </h3>
                  <p className="text-[12px] max-w-[280px] leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
                    Build your task list, tune the profile, and run the planner for a probability-based study recommendation.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Tasks in queue', value: tasks.length },
                      { label: 'Active now', value: activeCount },
                      { label: 'Current streak', value: currentStreak || '—' },
                      { label: 'Focus rate', value: focusRate != null ? `${focusRate}%` : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-[20px] p-4 planner-subtle">
                        <div className="text-[18px] font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{value}</div>
                        <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <section className="rounded-[30px] p-5 lg:p-6 planner-card">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.24em] font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                      Timeline
                    </p>
                    <h2 className="text-[16px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      Today
                    </h2>
                  </div>
                  <div className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div className="max-h-[420px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
                  <Timeline tasks={tasks} />
                </div>
              </section>
            </div>
          </div>
        </div>
        <Footer />
      </main>

      <style>{`
        .planner-hero {
          background:
            radial-gradient(circle at top left, rgba(129,140,248,0.22), transparent 34%),
            radial-gradient(circle at bottom right, rgba(56,189,248,0.12), transparent 28%),
            linear-gradient(180deg, rgba(13,16,28,0.96), rgba(11,14,22,0.92));
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 26px 60px rgba(2,6,23,0.3);
        }
        .planner-card {
          background: linear-gradient(180deg, rgba(16,19,29,0.92), rgba(11,14,22,0.9));
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 18px 48px rgba(2,6,23,0.22);
        }
        .planner-subtle {
          background: rgba(255,255,255,0.03);
        }
        .planner-stat {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .planner-action {
          background:
            radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 34%),
            linear-gradient(135deg, rgba(99,102,241,0.88), rgba(79,70,229,0.78));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 28px 56px rgba(79,70,229,0.28);
        }
        .planner-task-row {
          background: rgba(255,255,255,0.02);
          border: 1px solid transparent;
        }
        .planner-task-row:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.06);
          transform: translateY(-1px);
        }
        .planner-empty {
          background:
            radial-gradient(circle at top left, rgba(129,140,248,0.18), transparent 34%),
            linear-gradient(180deg, rgba(16,19,29,0.92), rgba(11,14,22,0.9));
        }
        .planner-input:focus {
          border-color: rgba(129,140,248,0.45) !important;
          box-shadow: 0 0 0 4px rgba(129,140,248,0.08);
        }
        .slider-input {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          background: rgba(255,255,255,0.08);
          outline: none;
        }
        .slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--slider-color, var(--accent));
          cursor: pointer;
          border: 2px solid var(--bg-primary);
          box-shadow: 0 0 0 1px var(--slider-color, var(--accent)), 0 8px 20px rgba(15,23,42,0.28);
          transition: transform 0.15s;
        }
        .slider-input::-webkit-slider-thumb:hover { transform: scale(1.15); }
        .slider-input::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--slider-color, var(--accent));
          cursor: pointer;
          border: 2px solid var(--bg-primary);
        }
        select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 30px !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
