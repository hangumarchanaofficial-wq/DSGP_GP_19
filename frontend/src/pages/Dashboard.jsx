import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useAgent } from '../hooks/useAgent';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Activity, Shield, Database, Eye, Wifi, WifiOff, BookOpen, LogOut } from 'lucide-react';

/* ── Focus Gauge ─────────────────────────────────── */
function FocusGauge({ score, isDistracted, confidence }) {
  const displayValue = isDistracted ? Math.round(confidence * 100) : score;
  const gaugePercent = isDistracted ? Math.round(confidence * 100) : score;
  const r = 70, cx = 80, cy = 80;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75;
  const offset = arcLen - (gaugePercent / 100) * arcLen;
  const color = isDistracted ? 'var(--danger)' : 'var(--success)';
  const glowColor = isDistracted ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx={cx} cy={cy} r={r} className="gauge-bg"
          strokeDasharray={`${arcLen} ${circ}`}
          transform="rotate(135, 80, 80)" />
        <circle cx={cx} cy={cy} r={r} className="gauge-fill"
          stroke={color}
          strokeDasharray={`${arcLen} ${circ}`}
          strokeDashoffset={offset}
          transform="rotate(135, 80, 80)"
          style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {displayValue}
          <span className="text-lg font-bold" style={{ color: 'var(--text-muted)' }}>%</span>
        </span>
        <span className="text-[11px] font-semibold mt-0.5" style={{ color }}>
          {isDistracted ? 'DISTRACTED' : 'FOCUSED'}
        </span>
      </div>
    </div>
  );
}

/* ── Stat Card ────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor }) {
  return (
    <div className="glass-card glass-card-hover h-full p-5 flex flex-col items-center justify-center text-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: iconBg }}>
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0 flex flex-col items-center">
        <p className="metric-label">{label}</p>
        <p className="metric-value mt-1">{value}</p>
        <p className="text-xs font-medium mt-1 leading-5 min-h-[2.5rem] flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
          {sub || '\u00A0'}
        </p>
      </div>
    </div>
  );
}

/* ── Attention Bar ────────────────────────────────── */
function AttentionBar({ weights }) {
  if (!weights || weights.length === 0) return null;
  const max = Math.max(...weights);
  return (
    <div className="flex items-end gap-[3px] h-12">
      {weights.map((w, i) => {
        const h = max > 0 ? (w / max) * 100 : 0;
        const opacity = 0.3 + (w / (max || 1)) * 0.7;
        return (
          <div key={i} className="flex-1 rounded-sm transition-all duration-500"
            style={{
              height: `${Math.max(h, 4)}%`,
              background: 'var(--accent)',
              opacity,
            }}
            title={`Step ${i + 1}: ${(w * 100).toFixed(1)}%`} />
        );
      })}
    </div>
  );
}

/* ── Chart Tooltip ────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const dist = val > 50;
  return (
    <div className="glass-card px-3 py-2" style={{ border: `1px solid ${dist ? 'var(--danger)' : 'var(--success)'}` }}>
      <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: dist ? 'var(--danger)' : 'var(--success)' }}>
        {val.toFixed(1)}% distraction
      </p>
    </div>
  );
}

function LoadingDotWave() {
  return (
    <div className="flex items-center gap-2 mt-4">
      {[0, 1, 2].map((idx) => (
        <span
          key={idx}
          className="dashboard-loading-dot"
          style={{ animationDelay: `${idx * 0.18}s` }}
        />
      ))}
    </div>
  );
}

function LoadingTimelineState() {
  return (
    <div className="dashboard-loading-shell h-full rounded-[24px] px-5 py-4">
      <div className="flex items-end justify-between h-full gap-2">
        {[46, 88, 58, 112, 76, 124, 92, 134, 108, 146, 118, 154].map((height, idx) => (
          <div
            key={idx}
            className="dashboard-loading-bar"
            style={{
              height,
              animationDelay: `${idx * 0.07}s`,
              opacity: 0.35 + (idx % 5) * 0.1,
            }}
          />
        ))}
      </div>
      <div className="dashboard-loading-overlay">
        <div className="dashboard-loading-glow" />
        <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Building your first prediction timeline
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          The chart will animate in as soon as the model has enough snapshots.
        </p>
        <LoadingDotWave />
      </div>
    </div>
  );
}

function LoadingDistributionState() {
  return (
    <div className="h-40 rounded-[24px] dashboard-loading-shell flex items-center justify-center gap-8 px-5">
      <div className="dashboard-loading-ring">
        <div className="dashboard-loading-ring-core" />
      </div>
      <div className="space-y-3 min-w-[150px]">
        {[72, 58, 81, 49].map((width, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <span
              className="dashboard-loading-bullet"
              style={{ animationDelay: `${idx * 0.12}s` }}
            />
            <span
              className="dashboard-loading-line"
              style={{ width: `${width}%`, animationDelay: `${idx * 0.08}s` }}
            />
          </div>
        ))}
        <p className="text-xs pt-2" style={{ color: 'var(--text-muted)' }}>
          Collecting app signals...
        </p>
      </div>
    </div>
  );
}

function LoadingRecentActivityState() {
  return (
    <div className="rounded-[24px] dashboard-loading-shell px-4 py-3">
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((rowIdx) => (
          <div key={rowIdx} className="grid grid-cols-7 gap-3 items-center">
            {[18, 26, 22, 20, 18, 24, 14].map((width, cellIdx) => (
              <span
                key={`${rowIdx}-${cellIdx}`}
                className="dashboard-loading-line"
                style={{
                  width: `${width + rowIdx * 6}%`,
                  animationDelay: `${(rowIdx * 7 + cellIdx) * 0.05}s`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center pt-6">
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Logging your first sessions
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Activity rows will appear as predictions are recorded.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard Page ───────────────────────────────── */
export default function Dashboard() {
  const { dark } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    status, connected, prediction, blocker, contentClassifier,
    snapshots, history, toggleBlocking,
  } = useAgent(4000);

  const focusScore = prediction ? Math.round((1 - prediction.probability) * 100) : 0;
  const isDistracted = prediction?.is_distracted ?? false;
  const confidence = prediction?.confidence ?? 0;
  const bilstmProb = prediction?.bilstm_prob ?? 0;
  const appCatScore = prediction?.app_category ?? (status?.latest_snapshot?.app_category_score ?? 0);
  const dominantApp = prediction?.dominant_app ?? '—';
  const attention = prediction?.attention ?? [];
  const blendMode = prediction?.blend_mode ?? '—';
  const label = prediction?.label ?? 'WAITING';
  const currentSnapshot = status?.latest_snapshot ?? {};
  const formatAppName = (app) => {
    const cleaned = (app ?? '').replace('.exe', '').trim();
    return cleaned || 'No app detected';
  };
  const currentAppName = formatAppName(prediction?.dominant_app ?? currentSnapshot.current_app);
  const currentAppScore = prediction?.app_category ?? currentSnapshot.app_category_score ?? 0;
  const currentAppLabel = prediction?.label ?? (connected ? 'COLLECTING' : 'WAITING');
  const blockerState = useMemo(() => {
    if (!blocker) {
      return {
        headerLabel: 'Block Off',
        cardValue: 'OFF',
        detail: 'Blocker unavailable',
        bg: 'var(--accent-bg)',
        color: 'var(--accent)',
        border: 'var(--accent)',
        iconBg: 'var(--bg-elevated)',
        iconColor: 'var(--text-muted)',
      };
    }

    if (blocker.manual_override_enabled) {
      return {
        headerLabel: 'Manual Block On',
        cardValue: 'MANUAL',
        detail: 'Manual override is forcing blocker on',
        bg: 'var(--danger-bg)',
        color: 'var(--danger)',
        border: 'var(--danger)',
        iconBg: 'var(--danger-bg)',
        iconColor: 'var(--danger)',
      };
    }

    if (blocker.auto_block_enabled && blocker.is_blocking) {
      return {
        headerLabel: 'Auto-block Live',
        cardValue: 'AUTO',
        detail: 'Auto-block is actively responding',
        bg: 'var(--warning-bg)',
        color: 'var(--warning)',
        border: 'var(--warning)',
        iconBg: 'var(--warning-bg)',
        iconColor: 'var(--warning)',
      };
    }

    if (blocker.auto_block_enabled) {
      return {
        headerLabel: 'Auto-block Ready',
        cardValue: 'ARMED',
        detail: 'Auto-block is enabled and waiting',
        bg: 'var(--accent-bg)',
        color: 'var(--accent)',
        border: 'var(--accent)',
        iconBg: 'var(--accent-bg)',
        iconColor: 'var(--accent)',
      };
    }

    return {
      headerLabel: 'Block Off',
      cardValue: 'OFF',
      detail: 'Auto-block is disabled',
      bg: 'var(--bg-elevated)',
      color: 'var(--text-muted)',
      border: 'var(--border)',
      iconBg: 'var(--bg-elevated)',
      iconColor: 'var(--text-muted)',
    };
  }, [blocker]);

  // Timeline data
  const timelineData = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.slice(-40).map((h, i) => ({
      time: h.timestamp ? h.timestamp.split(' ')[1]?.substring(0, 5) : `#${i}`,
      distraction: Math.round((h.final_prob ?? 0) * 100),
      bilstm: Math.round((h.bilstm_prob ?? 0) * 100),
    }));
  }, [history]);

  // App distribution
  const appDistribution = useMemo(() => {
    if (!history || history.length === 0) return [];
    const counts = {};
    history.forEach(h => {
      const app = h.dominant_app || 'unknown';
      const short = app.replace('.exe', '').substring(0, 12);
      counts[short] = (counts[short] || 0) + 1;
    });
    const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [history]);

  const lastEntry = history?.length > 0 ? history[history.length - 1] : null;
  const rawFeatures = lastEntry?.raw_features ?? {};

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar active="Dashboard" />

      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">

        {/* ── Header ─────────────────────────── */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
          style={{
            background: dark ? 'rgba(12,14,20,0.85)' : 'rgba(248,249,252,0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
          }}>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
            <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {connected && prediction
                ? `${label} · ${Math.round(confidence * 100)}% confidence · ${dominantApp}`
                : connected ? 'Collecting snapshots...' : 'Agent offline'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Agent Controls Group */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 h-9 rounded-full text-xs font-semibold"
                style={{
                  background: connected ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color: connected ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${connected ? 'transparent' : 'var(--danger)'}`,
                }}>
                <div className={`connection-dot ${connected ? 'online' : 'offline'}`} />
                {connected ? `Live · ${snapshots} snapshots` : 'Offline'}
              </div>

              <button onClick={toggleBlocking} disabled={!connected}
                className="flex items-center gap-2 px-4 h-9 rounded-full text-xs font-bold transition-all disabled:opacity-30 border"
                style={{
                  background: blockerState.bg,
                  color: blockerState.color,
                  borderColor: blockerState.border,
                }}>
                <Shield className="w-3.5 h-3.5" />
                {blockerState.headerLabel}
              </button>
            </div>

            {/* Separator */}
            {user && <div className="w-px h-6" style={{ background: 'var(--border)' }} />}

            {/* User Profile / Logout */}
            {user && (
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {user.name}
                </span>
                <button
                  onClick={async () => { await logout(); navigate('/login'); }}
                  title="Log out"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 36, padding: '0 16px', borderRadius: 999,
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)',
                    color: '#f87171', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                >
                  <LogOut size={14} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="p-6 space-y-5">

          {/* ── Row 1: Gauge + Stats ──────────── */}
          <div className="grid grid-cols-12 gap-5">
            {/* Focus Gauge */}
            <div className="col-span-12 lg:col-span-4 glass-card p-6 flex flex-col items-center justify-center">
              {connected && prediction ? (
                <>
                  <FocusGauge score={focusScore} isDistracted={isDistracted} confidence={confidence} />
                  <div className="flex items-center gap-3 mt-4">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>BiLSTM</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{(bilstmProb * 100).toFixed(1)}%</p>
                    </div>
                    <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>AppCat</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{(appCatScore * 100).toFixed(0)}%</p>
                    </div>
                    <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Blend</p>
                      <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{blendMode}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                    style={{ background: 'var(--bg-elevated)' }}>
                    {connected
                      ? <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                      : <WifiOff className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {connected ? 'Warming up model...' : 'Start the agent'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {connected ? `${snapshots}/10 snapshots collected` : 'python -m desktop_agent.agent'}
                  </p>
                </div>
              )}
            </div>

            {/* Stat Cards */}
            <div className="col-span-12 lg:col-span-8 grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard icon={Activity} label="Confidence"
                value={prediction ? `${Math.round(confidence * 100)}%` : '—'}
                sub={prediction ? label : 'No data'}
                iconBg="var(--accent-bg)" iconColor="var(--accent)" />
              <StatCard icon={Shield} label="Blocker"
                value={blockerState.cardValue}
                sub={blockerState.detail}
                iconBg={blockerState.iconBg}
                iconColor={blockerState.iconColor} />
              <StatCard icon={Database} label="Snapshots"
                value={snapshots || 0} sub="1 per minute"
                iconBg="var(--warning-bg)" iconColor="var(--warning)" />
              <StatCard icon={BookOpen} label="Content"
                value={contentClassifier?.ready ? 'READY' : 'OFFLINE'}
                sub={contentClassifier?.ready ? 'Classifier linked' : (contentClassifier?.error || 'Model unavailable')}
                iconBg={contentClassifier?.ready ? 'var(--success-bg)' : 'var(--bg-elevated)'}
                iconColor={contentClassifier?.ready ? 'var(--success)' : 'var(--text-muted)'} />
            </div>
          </div>

          {/* ── Row 2: Timeline ───────────────── */}
          <div className="glass-card p-6 min-w-0">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Prediction Timeline</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Distraction probability over time · {timelineData.length} data points
                </p>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} /> Final Score
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: 'var(--warning)' }} /> BiLSTM Raw
                </span>
              </div>
            </div>
            <div style={{ height: 220 }}>
              {timelineData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradFinal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="distraction" stroke="var(--accent)" fill="url(#gradFinal)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, stroke: 'var(--accent)', strokeWidth: 2, fill: 'var(--bg-card)' }} />
                    <Area type="monotone" dataKey="bilstm" stroke="var(--warning)" fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <LoadingTimelineState />
              )}
            </div>
          </div>

          {/* ── Row 3: App Distribution + Model Insights + Attention ── */}
          <div className="grid grid-cols-12 gap-5">

            {/* App Distribution */}
            <div className="col-span-12 lg:col-span-4 glass-card p-6 min-w-0">
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>App Distribution</h3>
              {appDistribution.length > 0 ? (
                <>
                  <div className="flex justify-center mb-4">
                    <PieChart width={140} height={140}>
                      <Pie data={appDistribution} dataKey="value" cx="50%" cy="50%"
                        innerRadius={40} outerRadius={65} paddingAngle={3} strokeWidth={0}>
                        {appDistribution.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </div>
                  <div className="space-y-2.5">
                    {appDistribution.map((app) => (
                      <div key={app.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: app.color }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{app.name}</span>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{app.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <LoadingDistributionState />
              )}
            </div>

            {/* Model Insights */}
            <div className="col-span-12 lg:col-span-4 glass-card p-6">
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Model Insights</h3>
              <div className="space-y-4">
                {[
                  { label: 'BiLSTM Probability', value: bilstmProb, color: 'var(--warning)' },
                  { label: 'App Category Score', value: appCatScore, color: 'var(--accent)' },
                  { label: 'Final Distraction', value: prediction?.probability ?? 0, color: isDistracted ? 'var(--danger)' : 'var(--success)' },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                      <span className="text-[11px] font-bold" style={{ color }}>{(value * 100).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(value * 100, 100)}%`, background: color }} />
                    </div>
                  </div>
                ))}

                <div style={{ height: 1, background: 'var(--border)' }} />
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Streak', value: lastEntry?.streak_count ?? 0 },
                    { label: 'Window', value: status?.window_filled ? 'Full' : `${snapshots}/10` },
                    { label: 'Keystrokes', value: rawFeatures.keystroke_count ?? 0 },
                    { label: 'Clicks', value: rawFeatures.mouse_clicks ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-2.5 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                      <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Attention + Current App */}
            <div className="col-span-12 lg:col-span-4 glass-card p-6 flex flex-col">
              <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Attention Weights</h3>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                How much the model attends to each of the 10 window steps
              </p>
              <AttentionBar weights={attention} />

              <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                  Current App
                </p>
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: isDistracted ? 'var(--danger-bg)' : 'var(--success-bg)' }}>
                    <Eye className="w-4 h-4" style={{ color: isDistracted ? 'var(--danger)' : 'var(--success)' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{currentAppName}</p>
                    <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                      {prediction?.app_cat_label ?? 'unknown'} · score {(appCatScore * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{
                      background: isDistracted ? 'var(--danger-bg)' : 'var(--success-bg)',
                      color: isDistracted ? 'var(--danger)' : 'var(--success)',
                    }}>
                    {currentAppLabel}
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
              <div className="grid grid-cols-2 gap-2">
                {[
                  { l: 'Mouse Moves', v: rawFeatures.mouse_moves ?? 0 },
                  { l: 'Scrolls', v: rawFeatures.mouse_scrolls ?? 0 },
                  { l: 'Idle (s)', v: rawFeatures.idle_seconds?.toFixed?.(1) ?? 0 },
                  { l: 'App Switches', v: rawFeatures.app_switches ?? 0 },
                ].map(({ l, v }) => (
                  <div key={l} className="text-center p-2 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{l}</p>
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Activity</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }}>
                    <th className="text-left pb-3 font-semibold">Time</th>
                    <th className="text-left pb-3 font-semibold">App</th>
                    <th className="text-left pb-3 font-semibold">BiLSTM</th>
                    <th className="text-left pb-3 font-semibold">AppCat</th>
                    <th className="text-left pb-3 font-semibold">Final</th>
                    <th className="text-left pb-3 font-semibold">Prediction</th>
                    <th className="text-left pb-3 font-semibold">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {(history ?? []).slice(-10).reverse().map((h, i) => {
                    const dist = (h.final_prob ?? 0) > 0.5;
                    return (
                      <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-2.5 font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {h.timestamp?.split(' ')[1]?.substring(0, 8) ?? '—'}
                        </td>
                        <td className="py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>
                          {(h.dominant_app ?? '').replace('.exe', '').substring(0, 14)}
                        </td>
                        <td className="py-2.5" style={{ color: 'var(--warning)' }}>
                          {((h.bilstm_prob ?? 0) * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5" style={{ color: 'var(--accent)' }}>
                          {((h.app_cat_score ?? 0) * 100).toFixed(0)}%
                        </td>
                        <td className="py-2.5 font-semibold" style={{ color: dist ? 'var(--danger)' : 'var(--success)' }}>
                          {((h.final_prob ?? 0) * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              background: dist ? 'var(--danger-bg)' : 'var(--success-bg)',
                              color: dist ? 'var(--danger)' : 'var(--success)',
                            }}>
                            {h.label ?? '—'}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                          {h.streak_count ?? 0}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!history || history.length === 0) && (
                <div className="pt-2">
                  <LoadingRecentActivityState />
                </div>
              )}
            </div>
          </div>
        </div>
        <style>{`
          .dashboard-loading-shell {
            position: relative;
            overflow: hidden;
            background:
              radial-gradient(circle at top left, rgba(99,102,241,0.14), transparent 34%),
              radial-gradient(circle at bottom right, rgba(245,158,11,0.1), transparent 30%),
              linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015));
            border: 1px solid rgba(255,255,255,0.06);
          }

          .dashboard-loading-shell::before {
            content: "";
            position: absolute;
            inset: -20% auto -20% -35%;
            width: 40%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
            transform: skewX(-18deg);
            animation: dashboardShimmer 2.6s linear infinite;
          }

          .dashboard-loading-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            pointer-events: none;
          }

          .dashboard-loading-glow {
            width: 140px;
            height: 140px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(99,102,241,0.18), transparent 68%);
            filter: blur(4px);
            position: absolute;
            animation: dashboardPulse 2.8s ease-in-out infinite;
          }

          .dashboard-loading-bar {
            flex: 1 1 0%;
            min-width: 12px;
            border-radius: 999px 999px 4px 4px;
            background: linear-gradient(180deg, rgba(139,92,246,0.88), rgba(59,130,246,0.18));
            transform-origin: bottom center;
            animation: dashboardFloatBars 2.2s ease-in-out infinite;
          }

          .dashboard-loading-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: linear-gradient(135deg, #8b5cf6, #f59e0b);
            animation: dashboardDotBounce 0.9s ease-in-out infinite;
          }

          .dashboard-loading-ring {
            width: 92px;
            height: 92px;
            border-radius: 999px;
            border: 10px solid rgba(99,102,241,0.1);
            border-top-color: rgba(99,102,241,0.9);
            border-right-color: rgba(245,158,11,0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: dashboardSpin 3s linear infinite;
          }

          .dashboard-loading-ring-core {
            width: 38px;
            height: 38px;
            border-radius: 999px;
            background: radial-gradient(circle, rgba(255,255,255,0.18), rgba(255,255,255,0.02));
            box-shadow: 0 0 28px rgba(99,102,241,0.25);
          }

          .dashboard-loading-bullet {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: rgba(99,102,241,0.9);
            box-shadow: 0 0 14px rgba(99,102,241,0.35);
            animation: dashboardPulse 2.2s ease-in-out infinite;
          }

          .dashboard-loading-line {
            display: block;
            height: 10px;
            border-radius: 999px;
            background: linear-gradient(90deg, rgba(255,255,255,0.07), rgba(255,255,255,0.18), rgba(255,255,255,0.07));
            animation: dashboardLineBreathe 2.4s ease-in-out infinite;
          }

          @keyframes dashboardShimmer {
            0% { transform: translateX(-10%) skewX(-18deg); }
            100% { transform: translateX(360%) skewX(-18deg); }
          }

          @keyframes dashboardPulse {
            0%, 100% { opacity: 0.45; transform: scale(0.96); }
            50% { opacity: 0.9; transform: scale(1.04); }
          }

          @keyframes dashboardFloatBars {
            0%, 100% { transform: scaleY(0.86); }
            50% { transform: scaleY(1.04); }
          }

          @keyframes dashboardDotBounce {
            0%, 100% { transform: translateY(0); opacity: 0.5; }
            50% { transform: translateY(-5px); opacity: 1; }
          }

          @keyframes dashboardSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes dashboardLineBreathe {
            0%, 100% { opacity: 0.45; transform: scaleX(0.98); }
            50% { opacity: 0.95; transform: scaleX(1); }
          }
        `}</style>
        <Footer />
      </main>
    </div>
  );
}
