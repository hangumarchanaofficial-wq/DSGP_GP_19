import { useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useAgent } from '../hooks/useAgent';
import { useTheme } from '../context/ThemeContext';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { TrendingUp, TrendingDown, Clock, Zap, AlertTriangle } from 'lucide-react';

/* ── Custom Tooltip ───────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2">
      <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-bold" style={{ color: p.color }}>
          {p.name}: {p.value?.toFixed?.(1) ?? p.value}%
        </p>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { dark } = useTheme();
  const { history, connected, snapshots } = useAgent(5000);

  // Compute analytics from history
  const stats = useMemo(() => {
    if (!history || history.length === 0) return null;

    const focused = history.filter(h => h.label === 'FOCUSED').length;
    const distracted = history.filter(h => h.label === 'DISTRACTED').length;
    const total = history.length;
    const focusRate = total > 0 ? Math.round((focused / total) * 100) : 0;

    // Avg confidence
    const avgConf = history.reduce((s, h) => s + (h.confidence ?? 0), 0) / total;

    // Avg bilstm
    const avgBilstm = history.reduce((s, h) => s + (h.bilstm_prob ?? 0), 0) / total;

    // Peak distraction
    const peakDist = Math.max(...history.map(h => h.final_prob ?? 0));

    // App time
    const appTime = {};
    history.forEach(h => {
      const app = (h.dominant_app ?? 'unknown').replace('.exe', '');
      appTime[app] = (appTime[app] || 0) + 1;
    });

    const topApps = Object.entries(appTime)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, mins]) => ({ name: name.substring(0, 14), minutes: mins }));

    // Hourly distribution
    const hourly = {};
    history.forEach(h => {
      const hour = h.timestamp?.split(' ')[1]?.substring(0, 2) ?? '00';
      if (!hourly[hour]) hourly[hour] = { focused: 0, distracted: 0 };
      if (h.label === 'FOCUSED') hourly[hour].focused++;
      else hourly[hour].distracted++;
    });
    const hourlyData = Object.entries(hourly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, data]) => ({ hour: `${hour}:00`, ...data }));

    // Category split
    const catSplit = [
      { name: 'Focused', value: focused, color: 'var(--success)' },
      { name: 'Distracted', value: distracted, color: 'var(--danger)' },
    ];

    return { focusRate, avgConf, avgBilstm, peakDist, topApps, hourlyData, catSplit, focused, distracted, total };
  }, [history]);

  // Timeline
  const timeline = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.map((h, i) => ({
      idx: i + 1,
      final: Math.round((h.final_prob ?? 0) * 100),
      bilstm: Math.round((h.bilstm_prob ?? 0) * 100),
      appcat: Math.round((h.app_cat_score ?? 0) * 100),
    }));
  }, [history]);

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar active="Analytics" />

      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
          style={{
            background: dark ? 'rgba(12,14,20,0.85)' : 'rgba(248,249,252,0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
          }}>
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Analytics</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Session analysis · {history?.length ?? 0} snapshots recorded
            </p>
          </div>
        </header>

        <div className="p-6 space-y-5">
          {!stats ? (
            <div className="glass-card p-12 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {connected ? 'Collecting data — analytics will appear after predictions begin.' : 'Start the agent to see analytics.'}
              </p>
            </div>
          ) : (
            <>
              {/* ── Summary Cards ──────────────── */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Focus Rate', value: `${stats.focusRate}%`, icon: TrendingUp, color: 'var(--success)', bg: 'var(--success-bg)' },
                  { label: 'Avg Confidence', value: `${(stats.avgConf * 100).toFixed(0)}%`, icon: Zap, color: 'var(--accent)', bg: 'var(--accent-bg)' },
                  { label: 'Peak Distraction', value: `${(stats.peakDist * 100).toFixed(0)}%`, icon: AlertTriangle, color: 'var(--danger)', bg: 'var(--danger-bg)' },
                  { label: 'Focused', value: stats.focused, icon: TrendingUp, color: 'var(--success)', bg: 'var(--success-bg)' },
                  { label: 'Distracted', value: stats.distracted, icon: TrendingDown, color: 'var(--danger)', bg: 'var(--danger-bg)' },
                ].map(({ label, value, icon: Icon, color, bg }) => (
                  <div key={label} className="glass-card p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                      <Icon className="w-4 h-4" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Full Timeline ──────────────── */}
              <div className="glass-card p-6">
                <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Score Timeline</h3>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Final score, BiLSTM raw, and App Category across all snapshots</p>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gFinal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="idx" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="final" name="Final" stroke="var(--accent)" fill="url(#gFinal)" strokeWidth={2} dot={false} />
                      <Area type="monotone" dataKey="bilstm" name="BiLSTM" stroke="var(--warning)" fill="none" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                      <Area type="monotone" dataKey="appcat" name="AppCat" stroke="var(--success)" fill="none" strokeWidth={1} strokeDasharray="2 4" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── Row: Hourly + Apps + Pie ──── */}
              <div className="grid grid-cols-12 gap-5">

                {/* Hourly Distribution */}
                <div className="col-span-12 lg:col-span-5 glass-card p-6">
                  <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Hourly Breakdown</h3>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.hourlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="focused" name="Focused" fill="var(--success)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="distracted" name="Distracted" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Apps */}
                <div className="col-span-12 lg:col-span-4 glass-card p-6">
                  <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Top Apps by Time</h3>
                  <div className="space-y-3">
                    {stats.topApps.map((app, i) => {
                      const maxMin = stats.topApps[0]?.minutes ?? 1;
                      const pct = (app.minutes / maxMin) * 100;
                      const colors = ['var(--accent)', 'var(--success)', 'var(--warning)', 'var(--danger)', 'var(--text-muted)'];
                      return (
                        <div key={app.name}>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{app.name}</span>
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{app.minutes} min</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Focus/Distracted Split */}
                <div className="col-span-12 lg:col-span-3 glass-card p-6 flex flex-col items-center">
                  <h3 className="text-sm font-bold mb-4 self-start" style={{ color: 'var(--text-primary)' }}>Session Split</h3>
                  <PieChart width={120} height={120}>
                    <Pie data={stats.catSplit} dataKey="value" cx="50%" cy="50%"
                      innerRadius={35} outerRadius={55} paddingAngle={4} strokeWidth={0}>
                      {stats.catSplit.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="flex gap-4 mt-4">
                    {stats.catSplit.map(c => (
                      <div key={c.name} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                        <span className="text-[10px] font-medium" style={{ color: 'var(--text-secondary)' }}>{c.name} ({c.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        <Footer />
      </main>
    </div>
  );
}
