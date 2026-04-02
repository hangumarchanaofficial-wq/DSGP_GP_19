import React, { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  Layers3,
  Lightbulb,
  Plus,
  RefreshCw,
  Target,
  TimerReset,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  WandSparkles,
  XCircle,
  Zap,
} from 'lucide-react';

const API = '/api/planner';
const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00',
];

const shell = {
  background: '#000000',
};

const panel = {
  background: 'linear-gradient(180deg, rgba(8,8,8,0.98), rgba(2,2,2,0.98))',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 28,
  boxShadow: '0 22px 56px rgba(0,0,0,0.22)',
};

function textOf(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  for (const key of ['message', 'suggested_action', 'description', 'type']) {
    if (typeof value?.[key] === 'string') return value[key];
  }
  return '';
}

function normalizeText(value, fallback = '--') {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function normalizeTask(task) {
  return {
    ...task,
    subject: normalizeText(task.subject, 'Untitled task'),
    notes: typeof task.notes === 'string' ? task.notes.trim() : '',
    reschedule_reason: typeof task.reschedule_reason === 'string' ? task.reschedule_reason.trim() : '',
  };
}

function trendMeta(trend) {
  if (trend === 'improving') {
    return { icon: TrendingUp, color: '#3ddc97', label: 'Improving' };
  }
  if (trend === 'declining') {
    return { icon: TrendingDown, color: '#ff7f6b', label: 'Declining' };
  }
  return { icon: CalendarDays, color: '#ffcf66', label: 'Stable' };
}

function Panel({ title, eyebrow, action, children }) {
  return (
    <section className="p-5 lg:p-6" style={panel}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? (
            <div
              className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em]"
              style={{ color: 'rgba(207,216,236,0.54)' }}
            >
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function PlannerButton({ children, icon: Icon, onClick, disabled, variant = 'primary' }) {
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #ff8c67, #ffb163)',
      color: '#11151f',
      border: 'none',
    },
    ghost: {
      background: 'rgba(255,255,255,0.04)',
      color: '#f7f8fb',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    subtle: {
      background: 'rgba(92,170,255,0.12)',
      color: '#a9ccff',
      border: '1px solid rgba(92,170,255,0.18)',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition"
      style={{
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...variants[variant],
      }}
    >
      {Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

function MetricBlock({ icon: Icon, label, value, helper, color = '#5caaff' }) {
  return (
    <div
      className="rounded-[24px] p-4"
      style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="mb-4 flex items-center justify-between">
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: 'rgba(207,216,236,0.56)' }}
        >
          {label}
        </span>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ background: `${color}22`, color }}
        >
          <Icon size={18} />
        </div>
      </div>
      <div className="text-3xl font-semibold tracking-tight text-white">{value}</div>
      {helper ? (
        <div className="mt-2 text-xs leading-5" style={{ color: 'rgba(207,216,236,0.64)' }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function StatusTile({ label, value, helper, tone = '#f7f8fb' }) {
  return (
    <div
      className="rounded-[24px] p-4"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'rgba(207,216,236,0.5)' }}
      >
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold text-white" style={{ color: tone }}>
        {value}
      </div>
      <div className="mt-1 text-sm" style={{ color: 'rgba(207,216,236,0.64)' }}>
        {helper}
      </div>
    </div>
  );
}

function TaskPill({ children, color = '#d4d8e2', background = 'rgba(255,255,255,0.08)' }) {
  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-semibold"
      style={{ color, background }}
    >
      {children}
    </span>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div
      className="rounded-[24px] px-6 py-10 text-center"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <Icon size={24} className="mx-auto mb-3" style={{ color: 'rgba(207,216,236,0.42)' }} />
      <div className="text-base font-semibold text-white">{title}</div>
      <div className="mt-2 text-sm" style={{ color: 'rgba(207,216,236,0.62)' }}>
        {body}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-2xl px-3 py-2 text-xs"
      style={{ background: 'rgba(12,16,27,0.96)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
    >
      <div style={{ color: 'rgba(207,216,236,0.62)' }}>{label}</div>
      {payload.map((entry) => (
        <div key={`${entry.dataKey}-${entry.name}`} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </div>
      ))}
    </div>
  );
}

function CapabilityNotice({ capabilities }) {
  const missing = [];
  if (!capabilities.analytics) missing.push('analytics');
  if (!capabilities.schedule) missing.push('smart schedule');
  if (!capabilities.profile) missing.push('profile');

  if (!missing.length) return null;

  return (
    <div
      className="mb-6 flex flex-col gap-3 rounded-[24px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        background: 'rgba(255,127,107,0.08)',
        border: '1px solid rgba(255,127,107,0.16)',
        color: '#ffd0c6',
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-white">Advanced planner services are unavailable</div>
          <div className="mt-1 text-sm" style={{ color: 'rgba(255,220,215,0.82)' }}>
            Missing: {missing.join(', ')}. Restart the desktop agent so the current planner API is loaded.
          </div>
        </div>
      </div>
      <div className="text-xs uppercase tracking-[0.16em]" style={{ color: 'rgba(255,220,215,0.68)' }}>
        Backend mismatch
      </div>
    </div>
  );
}

export default function Planner() {
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({
    age: 21,
    gender: 'Male',
    part_time_job: 0,
    study_hours_per_day: 4,
    sleep_hours: 7,
    total_social_hours: 2,
  });
  const [tasks, setTasks] = useState([]);
  const [taskStats, setTaskStats] = useState({});
  const [streak, setStreak] = useState({ focus_streak: 0, best_streak: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [smartSchedule, setSmartSchedule] = useState(null);
  const [profilerData, setProfilerData] = useState(null);
  const [distraction, setDistraction] = useState(null);
  const [result, setResult] = useState(null);
  const [contentResult, setContentResult] = useState(null);
  const [taskFilter, setTaskFilter] = useState('all');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({
    subject: '',
    duration_minutes: 45,
    priority: 'medium',
    scheduled_slot: '09:00',
    notes: '',
  });
  const [contentDraft, setContentDraft] = useState({ title: '', url: '', content: '' });
  const [capabilities, setCapabilities] = useState({
    analytics: true,
    profile: true,
    schedule: true,
  });

  function updateCapability(key, value) {
    setCapabilities((current) => (current[key] === value ? current : { ...current, [key]: value }));
  }

  async function fetchJson(path, options = {}, capabilityKey = null) {
    const response = await fetch(`${API}${path}`, options);
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (capabilityKey) {
      updateCapability(capabilityKey, response.status !== 404);
    }

    if (!response.ok) {
      const failure = new Error(data?.error || data?.message || `Request failed (${response.status})`);
      failure.status = response.status;
      throw failure;
    }

    return data;
  }

  async function fetchTasks() {
    try {
      const data = await fetchJson('/tasks');
      setTasks((data.tasks || []).map(normalizeTask));
      setTaskStats(data.stats || {});
    } catch {}
  }

  async function fetchAnalytics() {
    try {
      const data = await fetchJson('/analytics', {}, 'analytics');
      setAnalytics(data);
      if (data?.streak_info) setStreak(data.streak_info);
    } catch (err) {
      if (err.status === 404) {
        setAnalytics(null);
      }
    }
  }

  async function fetchProfile() {
    try {
      const data = await fetchJson('/profile', {}, 'profile');
      setProfilerData(data);
    } catch (err) {
      if (err.status === 404) {
        setProfilerData(null);
      }
    }
  }

  async function fetchDistraction() {
    try {
      const data = await fetchJson('/distraction-check');
      setDistraction(data);
    } catch {}
  }

  async function fetchSmartSchedule() {
    setScheduleLoading(true);
    try {
      const data = await fetchJson('/smart-schedule', {}, 'schedule');
      setSmartSchedule(data);
    } catch (err) {
      if (err.status === 404) {
        setSmartSchedule(null);
      }
    } finally {
      setScheduleLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([fetchTasks(), fetchAnalytics(), fetchProfile(), fetchDistraction()]);
  }

  useEffect(() => {
    refreshAll();
    const tasksTimer = setInterval(fetchTasks, 15000);
    const analyticsTimer = setInterval(fetchAnalytics, 60000);
    const distractionTimer = setInterval(fetchDistraction, 20000);

    return () => {
      clearInterval(tasksTimer);
      clearInterval(analyticsTimer);
      clearInterval(distractionTimer);
    };
  }, []);

  useEffect(() => {
    if (tab === 'schedule') fetchSmartSchedule();
    if (tab === 'analytics') fetchAnalytics();
    if (tab === 'profile') fetchProfile();
  }, [tab]);

  async function runPredict() {
    setLoading(true);
    setError('');
    try {
      const body = {
        ...profile,
        part_time_job: profile.part_time_job === 1 ? 'Yes' : 'No',
      };
      const data = await fetchJson('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setResult(data);
      if (data?.streak_info) setStreak(data.streak_info);
      await Promise.all([fetchTasks(), fetchAnalytics(), fetchDistraction()]);
    } catch (err) {
      setError(err.message || 'Planner prediction failed');
    } finally {
      setLoading(false);
    }
  }

  async function runContentCheck() {
    setContentLoading(true);
    setError('');
    try {
      const data = await fetchJson('/content-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentDraft),
      });
      setContentResult(data);
      await fetchAnalytics();
    } catch (err) {
      setError(err.message || 'Content check failed');
    } finally {
      setContentLoading(false);
    }
  }

  async function addTask() {
    if (!newTask.subject.trim()) return;
    try {
      await fetchJson('/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTask),
      });
      setNewTask({
        subject: '',
        duration_minutes: 45,
        priority: 'medium',
        scheduled_slot: '09:00',
        notes: '',
      });
      setShowAddTask(false);
      await Promise.all([fetchTasks(), fetchProfile(), fetchAnalytics(), fetchSmartSchedule()]);
    } catch {}
  }

  async function taskAction(id, action) {
    try {
      await fetchJson(`/tasks/${id}/${action}`, { method: 'POST' });
      await Promise.all([fetchTasks(), fetchAnalytics(), fetchProfile(), fetchDistraction(), fetchSmartSchedule()]);
    } catch {}
  }

  async function removeTask(id) {
    try {
      await fetchJson(`/tasks/${id}`, { method: 'DELETE' });
      await Promise.all([fetchTasks(), fetchAnalytics(), fetchProfile(), fetchSmartSchedule()]);
    } catch {}
  }

  const profileSummary = profilerData || analytics?.productivity_profile || {};
  const weekly = analytics?.trend_analytics?.weekly_summary || {};
  const studyVsDistraction = analytics?.trend_analytics?.study_vs_distraction || {};
  const daily = analytics?.trend_analytics?.daily_trends || [];
  const patterns = analytics?.trend_analytics?.patterns || {};
  const suggestions = analytics?.trend_analytics?.suggestions || [];
  const recommendations = smartSchedule?.recommendations || [];
  const bestHours = profileSummary.best_hours || [];
  const worstHours = profileSummary.worst_hours || [];
  const bestDays = profileSummary.best_days || [];
  const subjects = profileSummary.subject_performance || [];
  const live = distraction?.distraction_state;
  const activeTask = distraction?.active_task ? normalizeTask(distraction.active_task) : tasks.find((task) => task.status === 'active');
  const trend = trendMeta(weekly.trend_direction);
  const TrendIcon = trend.icon;
  const educationalRatio = studyVsDistraction.educational_content_ratio ?? weekly.educational_ratio ?? 0;
  const focusProbability = Math.round(
    (result?.task_completion_probability ?? (taskStats.completion_rate || 0) / 100) * 100,
  );

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'active') {
      return tasks.filter((task) => ['pending', 'active', 'in_progress', 'rescheduled'].includes(task.status));
    }
    if (taskFilter === 'completed') {
      return tasks.filter((task) => task.status === 'completed');
    }
    if (taskFilter === 'missed') {
      return tasks.filter((task) => task.status === 'missed');
    }
    return tasks;
  }, [taskFilter, tasks]);

  const chartData = daily.map((item) => ({
    day: item.date?.slice(5) || '',
    completion: item.completion_rate ?? 0,
    study: item.study_minutes ?? 0,
  }));

  const balanceData = [
    {
      name: 'Study',
      value: studyVsDistraction.study_minutes ?? weekly.total_study_minutes ?? 0,
      fill: '#5caaff',
    },
    {
      name: 'Distract',
      value: studyVsDistraction.distraction_minutes ?? weekly.total_distraction_minutes ?? 0,
      fill: '#ff7f6b',
    },
  ];

  const subjectData = subjects.slice(0, 6).map((subject) => ({
    subject: normalizeText(subject.subject, 'Untitled'),
    completion: Math.round((subject.completion_rate || 0) * 100),
  }));

  const contentState = contentResult?.classification;
  const contentContext = contentResult?.planner_context;
  const contentTone = contentState?.result === 'allow'
    ? { color: '#3ddc97', background: 'rgba(61,220,151,0.14)', label: 'Educational' }
    : contentState?.result === 'block'
      ? { color: '#ff7f6b', background: 'rgba(255,127,107,0.14)', label: 'Non-educational' }
      : { color: '#ffcf66', background: 'rgba(255,207,102,0.14)', label: 'Pending' };

  const tabs = [
    { key: 'overview', label: 'Command Center', icon: Brain },
    { key: 'schedule', label: 'Smart Schedule', icon: WandSparkles },
    { key: 'analytics', label: 'Trend Analytics', icon: BarChart3 },
    { key: 'profile', label: 'Profile', icon: UserRound },
  ];

  const scheduleReady = capabilities.schedule && recommendations.length > 0;
  const profileReady = capabilities.profile && (!!profilerData || !!analytics?.productivity_profile);

  const overviewTab = (
    <div className="space-y-6">
      <Panel
        title="Overview"
        eyebrow="Planner"
        action={(
          <div className="flex flex-wrap gap-3">
            <PlannerButton icon={Brain} onClick={runPredict} disabled={loading}>
              {loading ? 'Running...' : 'Run prediction'}
            </PlannerButton>
            <PlannerButton icon={WandSparkles} variant="ghost" onClick={() => { setTab('schedule'); fetchSmartSchedule(); }}>
              Smart schedule
            </PlannerButton>
            <PlannerButton icon={RefreshCw} variant="ghost" onClick={refreshAll}>
              Refresh
            </PlannerButton>
          </div>
        )}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <MetricBlock
            icon={Target}
            label="Completion outlook"
            value={`${focusProbability}%`}
            helper={result?.planner_decision || 'Awaiting prediction'}
            color="#ffb066"
          />
          <MetricBlock
            icon={TrendIcon}
            label="Weekly direction"
            value={trend.label}
            helper={weekly.trend_delta !== undefined ? `${weekly.trend_delta > 0 ? '+' : ''}${weekly.trend_delta}% vs prior` : 'Not enough history'}
            color={trend.color}
          />
          <MetricBlock
            icon={Clock3}
            label="Best slot"
            value={bestHours[0]?.label || '--'}
            helper={bestHours[0] ? `${Math.round(bestHours[0].rate * 100)}% completion` : 'No ranked hours yet'}
            color="#5caaff"
          />
        </div>
        {error ? (
          <div
            className="mt-4 rounded-[20px] px-4 py-3 text-sm"
            style={{ background: 'rgba(255,127,107,0.12)', border: '1px solid rgba(255,127,107,0.18)', color: '#ffb9ad' }}
          >
            {error}
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Task queue"
          eyebrow="Execution"
          action={(
            <div className="flex flex-wrap gap-2">
              {['all', 'active', 'completed', 'missed'].map((key) => (
                <button
                  key={key}
                  onClick={() => setTaskFilter(key)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize"
                  style={{
                    background: taskFilter === key ? 'rgba(255,176,102,0.18)' : 'rgba(255,255,255,0.04)',
                    color: taskFilter === key ? '#ffcf66' : 'rgba(207,216,236,0.74)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          )}
        >
          <div className="grid gap-4 md:grid-cols-4">
            <MetricBlock icon={Layers3} label="Tasks" value={taskStats.total ?? tasks.length} color="#9ec9ff" />
            <MetricBlock icon={CheckCircle2} label="Completion" value={`${taskStats.completion_rate ?? 0}%`} color="#3ddc97" />
            <MetricBlock icon={Flame} label="Streak" value={streak.focus_streak ?? 0} color="#ffb066" />
            <MetricBlock icon={TimerReset} label="Study" value={`${((weekly.total_study_minutes || 0) / 60).toFixed(1)}h`} color="#c79cff" />
          </div>

          <div
            className="mt-6 rounded-[24px] p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Quick add</div>
                <div className="mt-1 text-xs" style={{ color: 'rgba(207,216,236,0.6)' }}>
                  Add the task now. Optimize the slot later.
                </div>
              </div>
              <PlannerButton variant={showAddTask ? 'subtle' : 'ghost'} icon={Plus} onClick={() => setShowAddTask((value) => !value)}>
                {showAddTask ? 'Hide' : 'Add task'}
              </PlannerButton>
            </div>

            {showAddTask ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <input
                  className="rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                  placeholder="Subject"
                  value={newTask.subject}
                  onChange={(event) => setNewTask((current) => ({ ...current, subject: event.target.value }))}
                />
                <select
                  className="rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                  value={newTask.priority}
                  onChange={(event) => setNewTask((current) => ({ ...current, priority: event.target.value }))}
                >
                  <option value="high">High priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="low">Low priority</option>
                </select>
                <input
                  type="number"
                  min={15}
                  step={15}
                  className="rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                  value={newTask.duration_minutes}
                  onChange={(event) => setNewTask((current) => ({ ...current, duration_minutes: Number(event.target.value) }))}
                />
                <select
                  className="rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                  value={newTask.scheduled_slot}
                  onChange={(event) => setNewTask((current) => ({ ...current, scheduled_slot: event.target.value }))}
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={3}
                  className="rounded-2xl px-4 py-3 text-sm outline-none md:col-span-2"
                  style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                  placeholder="Notes"
                  value={newTask.notes}
                  onChange={(event) => setNewTask((current) => ({ ...current, notes: event.target.value }))}
                />
                <PlannerButton icon={Plus} onClick={addTask}>Save task</PlannerButton>
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-3">
            {filteredTasks.length ? (
              filteredTasks.map((task) => {
                const status = task.status || 'pending';
                const priority = task.priority || 'medium';
                const priorityColor = priority === 'high' ? '#ff7f6b' : priority === 'low' ? '#3ddc97' : '#ffcf66';
                const priorityBackground = priority === 'high'
                  ? 'rgba(255,127,107,0.14)'
                  : priority === 'low'
                    ? 'rgba(61,220,151,0.14)'
                    : 'rgba(255,207,102,0.14)';
                const statusColor = status === 'completed'
                  ? '#3ddc97'
                  : status === 'missed'
                    ? '#ff7f6b'
                    : status === 'active' || status === 'in_progress'
                      ? '#5caaff'
                      : status === 'rescheduled'
                        ? '#ffcf66'
                        : '#d4d8e2';
                const statusBackground = status === 'completed'
                  ? 'rgba(61,220,151,0.14)'
                  : status === 'missed'
                    ? 'rgba(255,127,107,0.14)'
                    : status === 'active' || status === 'in_progress'
                      ? 'rgba(92,170,255,0.14)'
                      : status === 'rescheduled'
                        ? 'rgba(255,207,102,0.14)'
                        : 'rgba(255,255,255,0.08)';

                return (
                  <div
                    key={task.id}
                    className="grid gap-4 rounded-[24px] p-4 lg:grid-cols-[1fr_auto]"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-xl font-semibold text-white">{task.subject}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'rgba(207,216,236,0.62)' }}>
                            <span>{task.duration_minutes} min</span>
                            <span>·</span>
                            <span>{task.scheduled_slot || 'No slot'}</span>
                            {task.focus_score !== undefined ? (
                              <>
                                <span>·</span>
                                <span>Focus {Math.round((task.focus_score || 0) * 100)}%</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <TaskPill color={priorityColor} background={priorityBackground}>{priority}</TaskPill>
                          <TaskPill color={statusColor} background={statusBackground}>{status}</TaskPill>
                        </div>
                      </div>

                      {task.notes ? (
                        <div className="text-sm" style={{ color: 'rgba(207,216,236,0.74)' }}>
                          {task.notes}
                        </div>
                      ) : null}

                      {task.reschedule_reason ? (
                        <div
                          className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs"
                          style={{ background: 'rgba(255,207,102,0.12)', color: '#ffcf66' }}
                        >
                          <AlertTriangle size={14} />
                          Rescheduled: {task.reschedule_reason}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center lg:justify-end">
                      <div className="flex flex-wrap gap-2">
                        {['pending', 'rescheduled'].includes(status) ? (
                          <PlannerButton variant="ghost" icon={ArrowRight} onClick={() => taskAction(task.id, 'start')}>
                            Start
                          </PlannerButton>
                        ) : null}
                        {['active', 'in_progress'].includes(status) ? (
                          <PlannerButton variant="subtle" icon={CheckCircle2} onClick={() => taskAction(task.id, 'complete')}>
                            Complete
                          </PlannerButton>
                        ) : null}
                        {status !== 'completed' ? (
                          <PlannerButton variant="ghost" icon={XCircle} onClick={() => taskAction(task.id, 'miss')}>
                            Miss
                          </PlannerButton>
                        ) : null}
                        <PlannerButton variant="ghost" icon={Trash2} onClick={() => removeTask(task.id)}>
                          Remove
                        </PlannerButton>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState icon={Layers3} title="No tasks in this view" body="Add work or change the filter." />
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Live signals" eyebrow="Decision rail">
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricBlock
                icon={Activity}
                label="Focus state"
                value={live ? (live.is_distracted ? 'Distracted' : 'Focused') : 'Offline'}
                helper={live ? `${Math.round((live.confidence || 0) * 100)}% confidence · ${normalizeText(live.dominant_app, 'unknown app')}` : 'Start the agent to stream focus data'}
                color={live?.is_distracted ? '#ff7f6b' : '#3ddc97'}
              />
              <MetricBlock
                icon={Clock3}
                label="Current task"
                value={activeTask?.subject || 'No active task'}
                helper={activeTask ? `${activeTask.scheduled_slot || '--'} · ${activeTask.duration_minutes} min` : 'Start a task to attach live context'}
                color="#5caaff"
              />
            </div>

            <div
              className="mt-4 rounded-[24px] p-4"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              {result ? (
                <div className="space-y-4">
                  <div className="text-2xl font-semibold text-white">{result.planner_decision}</div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'rgba(207,216,236,0.52)' }}>
                        Final probability
                      </div>
                      <div className="mt-1 text-lg font-semibold text-white">{focusProbability}%</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'rgba(207,216,236,0.52)' }}>
                        Distraction adjust
                      </div>
                      <div className="mt-1 text-lg font-semibold text-white">{result.distraction_adjustment ?? 0}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: 'rgba(207,216,236,0.52)' }}>
                        Content adjust
                      </div>
                      <div className="mt-1 text-lg font-semibold text-white">{result.content_adjustment ?? 0}</div>
                    </div>
                  </div>

                  {result.feedback ? (
                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{ background: 'rgba(255,176,102,0.08)', border: '1px solid rgba(255,176,102,0.16)' }}
                    >
                      <div className="text-sm text-white">{textOf(result.feedback)}</div>
                      {result.feedback.trend_supplement ? (
                        <div className="mt-1 text-xs" style={{ color: 'rgba(255,207,102,0.82)' }}>
                          {result.feedback.trend_supplement}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm" style={{ color: 'rgba(207,216,236,0.64)' }}>
                  Run a prediction to get the next planner decision.
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Content check" eyebrow="Browser">
            <div className="space-y-3">
              <input
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                placeholder="Page title"
                value={contentDraft.title}
                onChange={(event) => setContentDraft((current) => ({ ...current, title: event.target.value }))}
              />
              <input
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                placeholder="Page URL"
                value={contentDraft.url}
                onChange={(event) => setContentDraft((current) => ({ ...current, url: event.target.value }))}
              />
              <textarea
                rows={5}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                placeholder="Visible page content"
                value={contentDraft.content}
                onChange={(event) => setContentDraft((current) => ({ ...current, content: event.target.value }))}
              />
              <PlannerButton icon={BookOpen} onClick={runContentCheck} disabled={contentLoading}>
                {contentLoading ? 'Analyzing...' : 'Analyze content'}
              </PlannerButton>
            </div>

            <div className="mt-5">
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: contentTone.background, color: contentTone.color }}
              >
                <BookOpen size={14} />
                {contentTone.label}
              </div>

              {contentState ? (
                <div className="mt-4 space-y-2 text-sm" style={{ color: 'rgba(207,216,236,0.72)' }}>
                  <div>Label: <span className="font-semibold text-white">{normalizeText(contentState.label, 'unknown')}</span></div>
                  <div>Decision: <span className="font-semibold text-white">{normalizeText(contentState.result, '--')}</span></div>
                  {contentContext?.content_warning ? (
                    <div style={{ color: '#ffb2a6' }}>{contentContext.content_warning}</div>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 text-sm" style={{ color: 'rgba(207,216,236,0.62)' }}>
                  Save a content signal for the next prediction.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );

  const scheduleTab = (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <Panel
        title="Smart schedule"
        eyebrow="Recommendations"
        action={(
          <PlannerButton icon={RefreshCw} variant="ghost" onClick={fetchSmartSchedule} disabled={scheduleLoading}>
            Refresh
          </PlannerButton>
        )}
      >
        {scheduleLoading ? (
          <div className="flex items-center gap-3 rounded-[24px] px-5 py-6 text-sm" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(207,216,236,0.68)' }}>
            <RefreshCw size={18} className="animate-spin" />
            Building recommendations
          </div>
        ) : !capabilities.schedule ? (
          <EmptyState icon={WandSparkles} title="Smart schedule unavailable" body="Restart the desktop agent to enable schedule recommendations." />
        ) : scheduleReady ? (
          <div className="space-y-3">
            {recommendations.map((item) => (
              <div
                key={item.task_id}
                className="grid gap-4 rounded-[24px] p-4 lg:grid-cols-[1fr_auto]"
                style={{
                  background: item.is_peak_hour ? 'rgba(255,176,102,0.08)' : 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-white">{normalizeText(item.subject, 'Untitled task')}</span>
                    <TaskPill
                      color={item.priority === 'high' ? '#ff7f6b' : item.priority === 'low' ? '#3ddc97' : '#ffcf66'}
                      background={item.priority === 'high' ? 'rgba(255,127,107,0.14)' : item.priority === 'low' ? 'rgba(61,220,151,0.14)' : 'rgba(255,207,102,0.14)'}
                    >
                      {normalizeText(item.priority, 'medium')}
                    </TaskPill>
                    {item.is_peak_hour ? <TaskPill color="#ffcf66" background="rgba(255,176,102,0.16)">Peak</TaskPill> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm" style={{ color: 'rgba(207,216,236,0.68)' }}>
                    <span>Current: {normalizeText(item.current_slot, '--')}</span>
                    <span>Recommended: {normalizeText(item.recommended_slot, '--')}</span>
                    <span>{item.duration_minutes} min</span>
                    {item.subject_completion_rate !== null && item.subject_completion_rate !== undefined ? (
                      <span>{Math.round(item.subject_completion_rate * 100)}% subject completion</span>
                    ) : null}
                  </div>
                  <div className="mt-3 text-sm" style={{ color: 'rgba(247,248,251,0.84)' }}>
                    {normalizeText(item.reason, 'No reason provided')}
                  </div>
                </div>
                <div className="flex items-center text-2xl font-semibold text-white lg:justify-end">
                  {normalizeText(item.recommended_slot, '--')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={WandSparkles} title="No recommendations yet" body="Add pending tasks to generate a schedule." />
        )}
      </Panel>
      <div className="space-y-6">
        <Panel title="Optimization inputs" eyebrow="Profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <MetricBlock
              icon={Zap}
              label="Mode"
              value={smartSchedule?.profile_based ? 'Personalized' : 'Default'}
              helper={smartSchedule?.generated_at || 'Generated on demand'}
              color={smartSchedule?.profile_based ? '#3ddc97' : '#ffcf66'}
            />
            <MetricBlock
              icon={CalendarDays}
              label="Best day"
              value={bestDays[0]?.day || '--'}
              helper={bestDays[0] ? `${Math.round(bestDays[0].rate * 100)}% completion` : 'No ranked days yet'}
              color="#5caaff"
            />
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-3 text-sm font-semibold text-white">Best hours</div>
              {bestHours.length ? (
                bestHours.map((hour) => (
                  <div key={hour.hour} className="mb-3 flex items-center gap-3">
                    <span className="w-14 text-sm font-semibold text-white">{hour.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${hour.rate * 100}%`, background: '#ffb066' }} />
                    </div>
                    <span className="w-10 text-right text-xs" style={{ color: 'rgba(207,216,236,0.68)' }}>
                      {Math.round(hour.rate * 100)}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm" style={{ color: 'rgba(207,216,236,0.62)' }}>
                  No ranked hours yet.
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-white">Worst hours</div>
              {worstHours.length ? (
                worstHours.map((hour) => (
                  <div key={hour.hour} className="mb-3 flex items-center gap-3">
                    <span className="w-14 text-sm font-semibold text-white">{hour.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full" style={{ width: `${hour.rate * 100}%`, background: '#ff7f6b' }} />
                    </div>
                    <span className="w-10 text-right text-xs" style={{ color: 'rgba(207,216,236,0.68)' }}>
                      {Math.round(hour.rate * 100)}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm" style={{ color: 'rgba(207,216,236,0.62)' }}>
                  No low-performance hours yet.
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Subject history" eyebrow="Completion">
          {subjectData.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData} margin={{ top: 12, right: 12, bottom: 0, left: -22 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="subject" tick={{ fill: '#aab4c7', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#aab4c7', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="completion" name="Completion %" radius={[10, 10, 0, 0]} fill="#5caaff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="No subject history yet" body="Complete tasks to build subject-level performance." />
          )}
        </Panel>
      </div>
    </div>
  );

  const analyticsTab = (
    <div className="space-y-6">
      {!capabilities.analytics ? (
        <EmptyState icon={BarChart3} title="Analytics unavailable" body="Restart the desktop agent to enable trend analytics." />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <MetricBlock
              icon={CheckCircle2}
              label="Weekly completion"
              value={`${Math.round(weekly.overall_completion_rate || 0)}%`}
              helper={`${weekly.total_tasks_completed ?? 0} completed / ${weekly.total_tasks ?? 0} total`}
              color="#3ddc97"
            />
            <MetricBlock
              icon={TimerReset}
              label="Study volume"
              value={`${weekly.total_study_hours ?? 0}h`}
              helper={`${weekly.avg_daily_study_minutes ?? 0} min average / day`}
              color="#5caaff"
            />
            <MetricBlock
              icon={Activity}
              label="Distraction minutes"
              value={studyVsDistraction.distraction_minutes ?? weekly.total_distraction_minutes ?? 0}
              helper={`${weekly.total_distraction_events ?? 0} recorded events`}
              color="#ff7f6b"
            />
            <MetricBlock
              icon={BookOpen}
              label="Educational ratio"
              value={`${Math.round(educationalRatio || 0)}%`}
              helper="Educational share of tracked content"
              color="#ffcf66"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Panel title="Completion and study trend" eyebrow="7-day view">
              {chartData.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 12, bottom: 0, left: -24 }}>
                      <defs>
                        <linearGradient id="plannerCompletion" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#5caaff" stopOpacity={0.42} />
                          <stop offset="100%" stopColor="#5caaff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: '#aab4c7', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#aab4c7', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="completion" name="Completion %" stroke="#5caaff" fill="url(#plannerCompletion)" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="study" name="Study minutes" stroke="#ffb066" fill="rgba(0,0,0,0)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={BarChart3} title="No trend data yet" body="Trend data will appear after enough daily records." />
              )}
            </Panel>

            <Panel title="Study vs distraction" eyebrow="Balance">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={balanceData} margin={{ top: 10, right: 0, left: -30, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#aab4c7', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#aab4c7', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Minutes" radius={[12, 12, 0, 0]}>
                      {balanceData.map((item) => <Cell key={item.name} fill={item.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Panel title="Patterns" eyebrow="Detected">
              <div className="grid gap-3">
                {[
                  { label: 'Best day', value: patterns.best_day || bestDays[0]?.day || '--' },
                  { label: 'Worst day', value: patterns.worst_day || '--' },
                  { label: 'Most distracted day', value: patterns.most_distracted_day || '--' },
                  { label: 'Active day streak', value: patterns.active_day_streak ?? '--' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-[22px] px-4 py-4"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <span className="text-sm" style={{ color: 'rgba(207,216,236,0.7)' }}>{item.label}</span>
                    <span className="text-sm font-semibold text-white">{item.value}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Suggestions" eyebrow="Guidance">
              {suggestions.length ? (
                <div className="space-y-3">
                  {suggestions.map((item, index) => (
                    <div
                      key={`${item.type || 'suggestion'}-${index}`}
                      className="rounded-[24px] p-4"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,176,102,0.12)', color: '#ffcf66' }}>
                          <Lightbulb size={18} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold capitalize text-white">
                            {item.type ? item.type.replace(/_/g, ' ') : `Suggestion ${index + 1}`}
                          </div>
                          <div className="mt-1 text-sm leading-6" style={{ color: 'rgba(207,216,236,0.74)' }}>
                            {textOf(item)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Lightbulb} title="No suggestions yet" body="Complete tasks and log more history to unlock guidance." />
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );

  const profileTab = (
    <div className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
      <Panel title="Planner profile" eyebrow="Inputs">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm" style={{ color: 'rgba(207,216,236,0.72)' }}>
              <div className="mb-2">Age</div>
              <input
                type="number"
                min={16}
                max={35}
                className="w-full rounded-2xl px-4 py-3 outline-none"
                style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                value={profile.age}
                onChange={(event) => setProfile((current) => ({ ...current, age: Number(event.target.value) }))}
              />
            </label>

            <label className="text-sm" style={{ color: 'rgba(207,216,236,0.72)' }}>
              <div className="mb-2">Gender</div>
              <select
                className="w-full rounded-2xl px-4 py-3 outline-none"
                style={{ background: 'rgba(8,11,18,0.86)', border: '1px solid rgba(255,255,255,0.08)', color: '#f7f8fb' }}
                value={profile.gender}
                onChange={(event) => setProfile((current) => ({ ...current, gender: event.target.value }))}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </label>
          </div>

          {[
            { key: 'study_hours_per_day', label: 'Study hours', min: 0, max: 12 },
            { key: 'sleep_hours', label: 'Sleep hours', min: 3, max: 12 },
            { key: 'total_social_hours', label: 'Social hours', min: 0, max: 10 },
          ].map((field) => (
            <label key={field.key} className="block text-sm" style={{ color: 'rgba(207,216,236,0.72)' }}>
              <div className="mb-2 flex items-center justify-between">
                <span>{field.label}</span>
                <span className="font-semibold text-white">{profile[field.key]}h</span>
              </div>
              <input
                type="range"
                min={field.min}
                max={field.max}
                value={profile[field.key]}
                onChange={(event) => setProfile((current) => ({ ...current, [field.key]: Number(event.target.value) }))}
                className="w-full accent-orange-400"
              />
            </label>
          ))}

          <div>
            <div className="mb-2 text-sm" style={{ color: 'rgba(207,216,236,0.72)' }}>Part-time job</div>
            <div className="flex gap-2">
              {[
                { label: 'Yes', value: 1 },
                { label: 'No', value: 0 },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => setProfile((current) => ({ ...current, part_time_job: item.value }))}
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={{
                    background: profile.part_time_job === item.value ? 'rgba(255,176,102,0.18)' : 'rgba(255,255,255,0.05)',
                    color: profile.part_time_job === item.value ? '#ffcf66' : '#f7f8fb',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <PlannerButton icon={Brain} onClick={runPredict} disabled={loading}>
            {loading ? 'Running...' : 'Run with current profile'}
          </PlannerButton>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title="Profiler summary" eyebrow="Performance">
          {!capabilities.profile ? (
            <EmptyState icon={UserRound} title="Profile summary unavailable" body="Restart the desktop agent to enable productivity profiling." />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <MetricBlock
                icon={Zap}
                label="Best hour"
                value={bestHours[0]?.label || '--'}
                helper={bestHours[0] ? `${Math.round(bestHours[0].rate * 100)}% completion` : 'No history yet'}
                color="#ffb066"
              />
              <MetricBlock
                icon={CalendarDays}
                label="Best day"
                value={bestDays[0]?.day || '--'}
                helper={bestDays[0] ? `${Math.round(bestDays[0].rate * 100)}% completion` : 'No history yet'}
                color="#5caaff"
              />
              <MetricBlock
                icon={BookOpen}
                label="Tracked subjects"
                value={subjects.length}
                helper={`${profileSummary.total_data_points ?? 0} profile points`}
                color="#3ddc97"
              />
            </div>
          )}
        </Panel>

        <Panel title="Subject performance" eyebrow="History">
          {profileReady && subjects.length ? (
            <div className="grid gap-3">
              {subjects.map((subject) => (
                <div
                  key={subject.subject}
                  className="flex flex-col gap-3 rounded-[24px] p-4 md:flex-row md:items-center md:justify-between"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div>
                    <div className="text-base font-semibold text-white">{normalizeText(subject.subject, 'Untitled')}</div>
                    <div className="mt-1 text-sm" style={{ color: 'rgba(207,216,236,0.68)' }}>
                      {subject.total_tasks} tasks · {subject.avg_duration_minutes} min average
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(subject.completion_rate || 0) * 100}%`,
                          background: subject.completion_rate >= 0.7 ? '#3ddc97' : subject.completion_rate >= 0.5 ? '#ffcf66' : '#ff7f6b',
                        }}
                      />
                    </div>
                    <div className="text-lg font-semibold text-white">
                      {Math.round((subject.completion_rate || 0) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={BookOpen} title="No subject performance yet" body="Complete tasks to build subject-level results." />
          )}
        </Panel>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen" style={shell}>
      <Sidebar active="Planner" />

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto">
        <header
          className="sticky top-0 z-30 border-b px-6 py-5 lg:px-10"
          style={{
            borderColor: 'rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(247,248,251,0.7)' }}
              >
                <Brain size={14} />
                Adaptive planner
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-white lg:text-6xl">Adaptive Planner</h1>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:w-[560px]">
              <StatusTile
                label="Live focus"
                value={live ? (live.is_distracted ? 'Distracted' : 'Focused') : 'Offline'}
                helper={live ? `${Math.round((live.confidence || 0) * 100)}% confidence` : '--'}
                tone={live?.is_distracted ? '#ffb2a6' : '#ffffff'}
              />
              <StatusTile
                label="Current task"
                value={activeTask?.subject || '--'}
                helper={activeTask?.scheduled_slot || 'No active task'}
              />
              <StatusTile
                label="Streak"
                value={streak.focus_streak ?? 0}
                helper={`Best ${streak.best_streak ?? 0}`}
              />
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1480px] flex-1 px-6 py-8 lg:px-10">
          <div className="mb-6 flex flex-wrap gap-2">
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition"
                  style={{
                    background: active ? 'linear-gradient(135deg, rgba(255,176,102,0.2), rgba(92,170,255,0.18))' : 'rgba(255,255,255,0.04)',
                    color: active ? '#fff7eb' : 'rgba(207,216,236,0.74)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>

          <CapabilityNotice capabilities={capabilities} />

          {tab === 'overview' ? overviewTab : null}
          {tab === 'schedule' ? scheduleTab : null}
          {tab === 'analytics' ? analyticsTab : null}
          {tab === 'profile' ? profileTab : null}
        </div>

        <Footer />
      </main>
    </div>
  );
}
