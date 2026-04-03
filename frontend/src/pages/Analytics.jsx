import { useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
import { useAgent } from '../hooks/useAgent';
import { useTheme } from '../context/ThemeContext';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  AlertTriangle,
  Activity,
  BarChart3,
} from 'lucide-react';

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

function EmptyAnalyticsState({ connected }) {
  const statusTone = connected ? 'var(--accent)' : 'var(--warning)';
  const message = connected
    ? 'Collecting live focus signals. Analytics will form as new predictions are recorded.'
    : 'Start the agent to begin capturing focus signals and unlock session analytics.';
  const detail = connected
    ? 'The panel is listening for snapshots, app activity, and confidence changes.'
    : 'Once the monitoring agent is running, this space will animate into charts and timeline data.';

  return (
    <div
      className="glass-card relative overflow-hidden p-6 sm:p-8 lg:p-10"
      style={{
        minHeight: 260,
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 92%, transparent), color-mix(in srgb, var(--bg-elevated) 88%, transparent))',
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-80"
        style={{
          background: `
            radial-gradient(circle at 18% 22%, color-mix(in srgb, var(--accent) 20%, transparent) 0, transparent 30%),
            radial-gradient(circle at 82% 28%, color-mix(in srgb, ${connected ? 'var(--success)' : 'var(--warning)'} 18%, transparent) 0, transparent 26%),
            linear-gradient(135deg, transparent 0%, color-mix(in srgb, var(--accent) 6%, transparent) 48%, transparent 100%)
          `,
        }}
      />

      <div className="relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="max-w-xl">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em]"
            style={{
              color: statusTone,
              background: 'color-mix(in srgb, var(--bg-secondary) 78%, transparent)',
              border: '1px solid color-mix(in srgb, var(--border) 78%, transparent)',
            }}
          >
            <span className="analytics-empty-dot" style={{ background: statusTone }} />
            {connected ? 'Signal stream active' : 'Signal stream idle'}
          </div>

          <h2
            className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ color: 'var(--text-primary)' }}
          >
            {connected ? 'Your analytics canvas is warming up.' : 'No analytics yet.'}
          </h2>

          <p className="mt-3 max-w-lg text-sm leading-7 sm:text-[15px]" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
          <p className="mt-2 max-w-lg text-xs leading-6 sm:text-sm" style={{ color: 'var(--text-muted)' }}>
            {detail}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {[
              { icon: Activity, label: connected ? 'Listening for predictions' : 'Awaiting agent startup' },
              { icon: Clock, label: 'Timeline fills in after a few snapshots' },
              { icon: BarChart3, label: 'Charts appear automatically once data lands' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-2 rounded-2xl px-3 py-2"
                style={{
                  background: 'color-mix(in srgb, var(--bg-secondary) 82%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--border) 78%, transparent)',
                }}
              >
                <Icon className="h-4 w-4" style={{ color: statusTone }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-[360px] items-center justify-center">
          <div className="analytics-empty-ring analytics-empty-ring--outer" />
          <div className="analytics-empty-ring analytics-empty-ring--mid" />
          <div className="analytics-empty-ring analytics-empty-ring--inner" />

          <div
            className="analytics-empty-core relative flex h-44 w-44 items-center justify-center rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, color-mix(in srgb, var(--accent) 30%, transparent), color-mix(in srgb, var(--bg-card) 92%, transparent) 58%, var(--bg-primary) 100%)',
              border: '1px solid color-mix(in srgb, var(--border) 74%, transparent)',
              boxShadow: '0 20px 60px color-mix(in srgb, var(--accent) 12%, transparent)',
            }}
          >
            <div className="absolute inset-[18px] rounded-full analytics-empty-grid" />

            <div className="absolute flex h-32 w-32 items-end justify-center gap-2">
              {[34, 60, 46, 78, 52].map((height, index) => (
                <span
                  key={height}
                  className="analytics-empty-bar"
                  style={{
                    height,
                    animationDelay: `${index * 140}ms`,
                    background: index === 3
                      ? 'linear-gradient(180deg, var(--success), color-mix(in srgb, var(--accent) 72%, var(--success)))'
                      : 'linear-gradient(180deg, color-mix(in srgb, var(--accent) 88%, white), color-mix(in srgb, var(--accent) 42%, transparent))',
                  }}
                />
              ))}
            </div>

            <div
              className="absolute top-5 right-6 flex h-10 w-10 items-center justify-center rounded-full analytics-empty-orb"
              style={{
                background: 'color-mix(in srgb, var(--bg-secondary) 76%, transparent)',
                border: '1px solid color-mix(in srgb, var(--border) 76%, transparent)',
              }}
            >
              <Activity className="h-4 w-4" style={{ color: statusTone }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { dark } = useTheme();
  const { history, connected } = useAgent(5000);

  const stats = useMemo(() => {
    if (!history || history.length === 0) return null;

    const focused = history.filter((h) => h.label === 'FOCUSED').length;
    const distracted = history.filter((h) => h.label === 'DISTRACTED').length;
    const total = history.length;
    const focusRate = total > 0 ? Math.round((focused / total) * 100) : 0;
    const avgConf = history.reduce((s, h) => s + (h.confidence ?? 0), 0) / total;
    const avgBilstm = history.reduce((s, h) => s + (h.bilstm_prob ?? 0), 0) / total;
    const peakDist = Math.max(...history.map((h) => h.final_prob ?? 0));

    const appTime = {};
    history.forEach((h) => {
      const app = (h.dominant_app ?? 'unknown').replace('.exe', '');
      appTime[app] = (appTime[app] || 0) + 1;
    });

    const topApps = Object.entries(appTime)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, mins]) => ({ name: name.substring(0, 14), minutes: mins }));

    const hourly = {};
    history.forEach((h) => {
      const hour = h.timestamp?.split(' ')[1]?.substring(0, 2) ?? '00';
      if (!hourly[hour]) hourly[hour] = { focused: 0, distracted: 0 };
      if (h.label === 'FOCUSED') hourly[hour].focused++;
      else hourly[hour].distracted++;
    });

    const hourlyData = Object.entries(hourly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, data]) => ({ hour: `${hour}:00`, ...data }));

    const catSplit = [
      { name: 'Focused', value: focused, color: 'var(--success)' },
      { name: 'Distracted', value: distracted, color: 'var(--danger)' },
    ];

    return {
      focusRate,
      avgConf,
      avgBilstm,
      peakDist,
      topApps,
      hourlyData,
      catSplit,
      focused,
      distracted,
      total,
    };
  }, [history]);

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
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-8 py-4"
          style={{
            background: dark ? 'rgba(12,14,20,0.85)' : 'rgba(248,249,252,0.85)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Analytics</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Session analysis · {history?.length ?? 0} snapshots recorded
            </p>
          </div>
        </header>

        <div className="p-6 space-y-5">
          {!stats ? (
            <EmptyAnalyticsState connected={connected} />
          ) : (
            <>
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

              <div className="glass-card p-6 min-w-0">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Distraction Timeline</h3>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Final distraction score across snapshots. Values above 50% are treated as distracted.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 lg:w-[280px]">
                    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Avg BiLSTM</p>
                      <p className="mt-1 text-base font-bold" style={{ color: 'var(--warning)' }}>{(stats.avgBilstm * 100).toFixed(0)}%</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Avg Confidence</p>
                      <p className="mt-1 text-base font-bold" style={{ color: 'var(--accent)' }}>{(stats.avgConf * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </div>
                <div style={{ height: 250 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeline} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gFinal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="idx"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={28}
                        tickFormatter={(value) => `${value}`}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => `${v}%`}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine
                        y={50}
                        stroke="var(--danger)"
                        strokeDasharray="5 5"
                        ifOverflow="extendDomain"
                        label={{ value: 'Distracted threshold', fill: 'var(--text-muted)', fontSize: 10, position: 'insideTopRight' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="final"
                        name="Final distraction"
                        stroke="var(--accent)"
                        fill="url(#gFinal)"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 4, stroke: 'var(--accent)', strokeWidth: 2, fill: 'var(--bg-card)' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 lg:col-span-5 glass-card p-6 min-w-0">
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
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: colors[i % colors.length] }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-3 glass-card p-6 flex flex-col items-center">
                  <h3 className="text-sm font-bold mb-4 self-start" style={{ color: 'var(--text-primary)' }}>Session Split</h3>
                  <PieChart width={120} height={120}>
                    <Pie
                      data={stats.catSplit}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={55}
                      paddingAngle={4}
                      strokeWidth={0}
                    >
                      {stats.catSplit.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  <div className="flex gap-4 mt-4">
                    {stats.catSplit.map((c) => (
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

      <style>{`
        .analytics-empty-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          box-shadow: 0 0 0 0 currentColor;
          animation: analyticsPulseDot 1.8s ease-out infinite;
        }

        .analytics-empty-ring {
          position: absolute;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
          animation: analyticsRingFloat 7s ease-in-out infinite;
        }

        .analytics-empty-ring--outer {
          width: 100%;
          height: 100%;
          opacity: 0.34;
        }

        .analytics-empty-ring--mid {
          width: 78%;
          height: 78%;
          opacity: 0.42;
          animation-delay: -2.1s;
        }

        .analytics-empty-ring--inner {
          width: 56%;
          height: 56%;
          opacity: 0.56;
          animation-delay: -4.2s;
        }

        .analytics-empty-core {
          animation: analyticsCoreBreathe 6s ease-in-out infinite;
        }

        .analytics-empty-grid {
          border-radius: inherit;
          background-image:
            linear-gradient(color-mix(in srgb, var(--border) 35%, transparent) 1px, transparent 1px),
            linear-gradient(90deg, color-mix(in srgb, var(--border) 35%, transparent) 1px, transparent 1px);
          background-size: 18px 18px;
          mask-image: radial-gradient(circle, rgba(0,0,0,0.95) 42%, rgba(0,0,0,0) 78%);
          opacity: 0.45;
        }

        .analytics-empty-bar {
          width: 12px;
          border-radius: 999px;
          box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 16%, transparent);
          transform-origin: bottom center;
          animation: analyticsBarPulse 1.9s ease-in-out infinite;
        }

        .analytics-empty-orb {
          animation: analyticsOrbDrift 4.8s ease-in-out infinite;
          box-shadow: 0 10px 30px color-mix(in srgb, var(--accent) 10%, transparent);
        }

        @keyframes analyticsPulseDot {
          0% { transform: scale(0.9); box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 40%, transparent); opacity: 0.8; }
          70% { transform: scale(1.1); box-shadow: 0 0 0 12px transparent; opacity: 1; }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 transparent; opacity: 0.82; }
        }

        @keyframes analyticsRingFloat {
          0%, 100% { transform: scale(0.98) rotate(0deg); }
          50% { transform: scale(1.03) rotate(8deg); }
        }

        @keyframes analyticsCoreBreathe {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-6px) scale(1.02); }
        }

        @keyframes analyticsBarPulse {
          0%, 100% { transform: scaleY(0.82); opacity: 0.7; }
          50% { transform: scaleY(1.08); opacity: 1; }
        }

        @keyframes analyticsOrbDrift {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(-6px, 8px, 0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .analytics-empty-dot,
          .analytics-empty-ring,
          .analytics-empty-core,
          .analytics-empty-bar,
          .analytics-empty-orb {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
