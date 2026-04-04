import { useMemo } from "react";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import { useAgent } from "../hooks/useAgent";
import { useTheme } from "../context/ThemeContext";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BrainCircuit,
  Flame,
  Hourglass,
  MoonStar,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

function Surface({ children, className = "" }) {
  return (
    <section
      className={`rounded-[28px] bg-gradient-to-b from-[#0d1426] to-[#080d18] ${className}`}
      style={{
        boxShadow:
          "0 18px 42px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </section>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h2 className="font-serif text-[1.2rem] text-white lg:text-[1.45rem]">{title}</h2>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function StatCard({ label, value, note, icon: Icon, tint }) {
  return (
    <Surface className="min-h-[148px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
          <div className="mt-2 text-[2rem] font-semibold text-white">{value}</div>
          <div className="mt-1 text-sm text-slate-500">{note}</div>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: `${tint}10`,
            boxShadow: `inset 0 1px 0 ${tint}18, 0 10px 24px rgba(0,0,0,0.18)`,
          }}
        >
          <Icon size={16} style={{ color: tint }} />
        </div>
      </div>
    </Surface>
  );
}

function ChartTooltip({ active, payload, label, suffix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: "#091120",
        boxShadow: "0 10px 28px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <p className="text-xs text-slate-400">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="mt-1 text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
          {suffix}
        </p>
      ))}
    </div>
  );
}

export default function Analytics() {
  const { dark } = useTheme();
  const { history = [], connected } = useAgent(5000);

  const analytics = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) {
      return {
        total: 0,
        focused: 0,
        distracted: 0,
        focusRate: 0,
        distractionRate: 0,
        avgScore: 0,
        topApps: [{ name: "No data", count: 0 }],
        trend: Array.from({ length: 8 }, (_, index) => ({ step: index + 1, Focus: 0 })),
        bestHours: [
          { hour: "Mon", count: 0 },
          { hour: "Tue", count: 0 },
          { hour: "Wed", count: 0 },
          { hour: "Thu", count: 0 },
          { hour: "Fri", count: 0 },
        ],
        focusSplit: [
          { name: "Focused", value: 0, color: "#34d399" },
          { name: "Distracted", value: 0, color: "#fb7185" },
        ],
        recommendation: connected
          ? "No data yet. Start a study session to unlock analytics."
          : "No data yet. Start the desktop agent to begin collecting analytics.",
      };
    }

    const total = history.length;
    const focused = history.filter((item) => item.label === "FOCUSED").length;
    const distracted = total - focused;
    const focusRate = Math.round((focused / Math.max(total, 1)) * 100);
    const distractionRate = Math.round((distracted / Math.max(total, 1)) * 100);
    const avgScore = Math.round(
      history.reduce((sum, item) => {
        if (typeof item.final_prob === "number") return sum + (1 - item.final_prob) * 100;
        if (typeof item.confidence === "number") return sum + item.confidence * 100;
        return sum + 50;
      }, 0) / Math.max(total, 1)
    );

    const appCounts = {};
    history.forEach((item) => {
      const app = String(item.dominant_app || item.app || "Unknown").replace(/\.exe$/i, "");
      appCounts[app] = (appCounts[app] || 0) + 1;
    });

    const topApps = Object.entries(appCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const trend = history.slice(-12).map((item, index) => ({
      step: index + 1,
      Focus: Math.round(
        typeof item.final_prob === "number"
          ? (1 - item.final_prob) * 100
          : typeof item.confidence === "number"
          ? item.confidence * 100
          : 50
      ),
    }));

    const hourlyMap = {};
    history.forEach((item) => {
      const rawTs = item.timestamp ? new Date(item.timestamp) : null;
      const hourLabel =
        rawTs && !Number.isNaN(rawTs.getTime())
          ? rawTs.toLocaleTimeString([], { hour: "numeric" })
          : "Now";
      if (!hourlyMap[hourLabel]) hourlyMap[hourLabel] = 0;
      if (item.label === "FOCUSED") hourlyMap[hourLabel] += 1;
    });

    const bestHours = Object.entries(hourlyMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([hour, count]) => ({ hour, count }));

    const focusSplit = [
      { name: "Focused", value: focused, color: "#34d399" },
      { name: "Distracted", value: distracted, color: "#fb7185" },
    ];

    const recommendation =
      distractionRate >= 45
        ? "Distractions are high today. Keep the next study block shorter and quieter."
        : focusRate >= 70
        ? "You are holding attention well. Use this momentum for your hardest task."
        : "Your focus is mixed today. Try one clear 25-minute block before switching apps.";

    return {
      total,
      focused,
      distracted,
      focusRate,
      distractionRate,
      avgScore,
      topApps,
      trend,
      bestHours,
      focusSplit,
      recommendation,
    };
  }, [connected, history]);

  return (
    <div className="flex min-h-screen bg-[#040816] text-white">
      <Sidebar active="Analytics" />

      <main className="flex min-h-screen flex-1 flex-col overflow-y-auto">
        <header
          className="sticky top-0 z-30 px-8 py-4 backdrop-blur-xl"
          style={{
            background: dark ? "rgba(2,5,13,0.92)" : "rgba(248,249,252,0.88)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="mx-auto flex w-full max-w-7xl items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl text-white lg:text-3xl">Analytics</h1>
              <p className="mt-1 text-sm text-slate-500">
                Study patterns, focus behavior, and simple recommendations.
              </p>
            </div>
            <div className="rounded-full bg-white/5 px-4 py-2 text-sm text-slate-300">
              {history.length} snapshots
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6 lg:px-8">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Focus rate" value={`${analytics.focusRate}%`} note="Sessions in control" icon={Sparkles} tint="#34d399" />
                <StatCard label="Average focus" value={`${analytics.avgScore}%`} note="Overall quality today" icon={BrainCircuit} tint="#8b5cf6" />
                <StatCard label="Distractions" value={analytics.distracted} note="Off-task moments" icon={ShieldAlert} tint="#fb7185" />
                <StatCard label="Best run" value={`${analytics.focused}`} note="Focused snapshots" icon={Flame} tint="#f59e0b" />
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Surface className="p-6 lg:p-7">
                  <SectionTitle title="Focus Trend" subtitle="Your most recent focus scores." />
                  <div className="mt-5 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.trend} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="focusTrendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="step" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <Tooltip content={<ChartTooltip suffix="%" />} />
                        <Area type="monotone" dataKey="Focus" stroke="#22d3ee" fill="url(#focusTrendFill)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Surface>

                <Surface className="p-6 lg:p-7">
                  <SectionTitle title="Focus Split" subtitle="Focused versus distracted activity." />
                  <div className="mt-5 grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={analytics.focusSplit} dataKey="value" innerRadius={54} outerRadius={82} paddingAngle={4} stroke="none">
                            {analytics.focusSplit.map((item) => (
                              <Cell key={item.name} fill={item.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      {analytics.focusSplit.map((item) => (
                        <div key={item.name} className="flex items-center justify-between rounded-2xl bg-[#060b16] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                            <span className="text-sm text-slate-300">{item.name}</span>
                          </div>
                          <span className="text-sm font-medium text-white">{item.value}</span>
                        </div>
                      ))}
                      <div className="rounded-[24px] bg-[#060b16] p-4 text-sm text-slate-400">
                        {analytics.recommendation}
                      </div>
                    </div>
                  </div>
                </Surface>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <Surface className="p-6 lg:p-7">
                  <SectionTitle title="Top Apps" subtitle="Where most of your attention went." />
                  <div className="mt-5 space-y-3">
                      {analytics.topApps.map((app) => (
                        <div key={app.name} className="flex items-center justify-between rounded-2xl bg-[#060b16] px-4 py-3">
                          <span className="font-serif text-lg text-white">{app.name}</span>
                          <span className="text-sm text-slate-400">{app.count} sessions</span>
                        </div>
                    ))}
                  </div>
                </Surface>

                <Surface className="p-6 lg:p-7">
                  <SectionTitle title="Best Study Hours" subtitle="The hours where focused activity shows up most." />
                  <div className="mt-5 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.bestHours} barCategoryGap={24}>
                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                        <Tooltip content={<ChartTooltip suffix=" sessions" />} />
                        <Bar dataKey="count" radius={[10, 10, 0, 0]} fill="url(#bestHoursGradient)" />
                        <defs>
                          <linearGradient id="bestHoursGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Surface>
              </div>

              <Surface className="p-6 lg:p-7">
                <SectionTitle title="Reading This Page" subtitle="What these patterns mean for a student." />
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-[24px] bg-[#060b16] p-5">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Focus rate</div>
                    <div className="mt-3 text-sm leading-7 text-slate-400">
                      A higher value means more of your recent activity stayed aligned with study work.
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-[#060b16] p-5">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Top apps</div>
                    <div className="mt-3 text-sm leading-7 text-slate-400">
                      These are the apps most often present while your sessions were being tracked.
                    </div>
                  </div>
                  <div className="rounded-[24px] bg-[#060b16] p-5">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Best hours</div>
                    <div className="mt-3 text-sm leading-7 text-slate-400">
                      Use these times for your hardest tasks when possible.
                    </div>
                  </div>
                </div>
              </Surface>
        </div>

        <Footer />
      </main>
    </div>
  );
}
