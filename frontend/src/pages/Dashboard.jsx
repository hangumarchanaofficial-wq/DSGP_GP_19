import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion, AnimatePresence, useMotionValue, useSpring, useInView,
} from "framer-motion";
import {
  Activity, AlertTriangle, Award, BookOpen, Brain,
  CheckCircle2, Clock3, Flame, LogOut, ShieldAlert,
  Sparkles, TimerReset, Trophy, Wifi, WifiOff,
  TrendingUp, TrendingDown, Zap, Target, Star,
} from "lucide-react";
import {
  Bar, BarChart, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import { useAgent } from "../hooks/useAgent";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { getPlannerApiUrl } from "./planner/plannerUtils";

// ─── animation presets ───────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1];
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};
const staggerPage = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const staggerInner = (delay = 0) => ({
  hidden: {},
  show:   { transition: { staggerChildren: 0.07, delayChildren: delay } },
});

// ─── animated counter ─────────────────────────────────────────────
function AnimNumber({ value, suffix = "", decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 70, damping: 16 });
  const [display, setDisplay] = useState(0);
  useEffect(() => { if (inView) mv.set(parseFloat(value) || 0); }, [inView, mv, value]);
  useEffect(() => spring.on("change", v => setDisplay(v)), [spring]);
  return <span ref={ref}>{display.toFixed(decimals)}{suffix}</span>;
}

// ─── animated bar ─────────────────────────────────────────────────
function GlowBar({ pct, gradient, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  return (
    <div ref={ref} className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: gradient }}
        initial={{ width: 0 }}
        animate={inView ? { width: `${Math.min(100, Math.max(0, pct))}%` } : { width: 0 }}
        transition={{ duration: 1, ease: EASE, delay }}
      />
    </div>
  );
}

// ─── card primitives ─────────────────────────────────────────────
// No border – depth comes from bg contrast + inset highlight + deep shadow
function SectionCard({ children, className = "", glow = null }) {
  return (
    <motion.section
      variants={fadeUp}
      whileHover={{ y: -2, transition: { duration: 0.25 } }}
      className={`rounded-[28px] bg-gradient-to-b from-[#0e1528] to-[#080d1a] ${className}`}
      style={{
        boxShadow: glow
          ? `0 0 60px ${glow}22, 0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)`
          : "0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      {children}
    </motion.section>
  );
}

function InnerCell({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl bg-[#060b16] ${className}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      {children}
    </div>
  );
}

// ─── premium icon container ───────────────────────────────────────
function IconBox({ icon: Icon, color, size = 18, boxSize = "w-10 h-10" }) {
  return (
    <div
      className={`${boxSize} rounded-2xl flex items-center justify-center flex-shrink-0`}
      style={{
        background: `${color}14`,
        boxShadow: `0 0 24px ${color}20, inset 0 1px 0 ${color}28`,
      }}
    >
      <Icon size={size} style={{ color }} />
    </div>
  );
}

// ─── section heading ──────────────────────────────────────────────
function SectionHeading({ icon: Icon, color = "#818cf8", title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <IconBox icon={Icon} color={color} />
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

// ─── hero focus card ──────────────────────────────────────────────
function SmallMetric({ label, value, tone = "violet" }) {
  const cfg = {
    violet:  { from: "#7c3aed", to: "#4f46e5", text: "#c4b5fd" },
    emerald: { from: "#059669", to: "#0d9488", text: "#6ee7b7" },
    amber:   { from: "#d97706", to: "#ea580c", text: "#fcd34d" },
    rose:    { from: "#e11d48", to: "#dc2626", text: "#fda4af" },
  };
  const c = cfg[tone] || cfg.violet;
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: `linear-gradient(135deg, ${c.from}14 0%, ${c.to}08 100%)`,
        boxShadow: `inset 0 1px 0 ${c.from}22`,
      }}
    >
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function HeroFocusCard({ score, isDistracted, currentTask, focusMinutes, message }) {
  const accent = isDistracted ? "#fb7185" : "#34d399";
  const gradient = isDistracted
    ? "linear-gradient(135deg,#fb7185,#f97316)"
    : "linear-gradient(135deg,#34d399,#22d3ee)";

  return (
    <SectionCard
      className="overflow-hidden"
      glow={accent}
    >
      <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_0.8fr] lg:p-8">
        {/* left */}
        <div className="space-y-5">
          <motion.div
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-[0.26em] text-slate-300"
            style={{ background: "rgba(255,255,255,0.05)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
          >
            <Activity size={13} />
            Focus Session
          </motion.div>

          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Current status</p>
            <motion.h1
              key={String(isDistracted)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="mt-3 max-w-xl text-3xl font-semibold leading-tight text-white lg:text-5xl"
            >
              {isDistracted ? "Distraction detected. Let's refocus." : "You are focused. Keep going."}
            </motion.h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300 lg:text-lg">{message}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SmallMetric label="Current Task"  value={currentTask}       tone="violet" />
            <SmallMetric label="Focus Score"   value={`${score}%`}       tone={isDistracted ? "amber" : "emerald"} />
            <SmallMetric label="Focused Time"  value={`${focusMinutes} min`} tone="violet" />
          </div>
        </div>

        {/* right — ring */}
        <div className="flex items-center justify-center">
          <div
            className="relative flex h-64 w-64 items-center justify-center rounded-[32px] bg-slate-950/60"
            style={{ boxShadow: `0 0 40px ${accent}18, inset 0 1px 0 rgba(255,255,255,0.06)` }}
          >
            {/* conic ring */}
            <motion.div
              className="absolute inset-5 rounded-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              style={{
                background: `conic-gradient(${accent} ${score}%, rgba(255,255,255,0.05) ${score}% 100%)`,
              }}
            />
            <div className="absolute inset-8 rounded-full bg-[#060b16]" />
            <div className="relative text-center">
              <motion.div
                key={score}
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="text-6xl font-bold bg-clip-text text-transparent"
                style={{ backgroundImage: gradient }}
              >
                {score}%
              </motion.div>
              <div className="mt-2 text-xs uppercase tracking-[0.38em] text-slate-500">Focus score</div>
              <div
                className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                style={{
                  background: `${accent}14`,
                  boxShadow: `0 0 16px ${accent}20, inset 0 1px 0 ${accent}28`,
                  color: accent,
                }}
              >
                {isDistracted ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                {isDistracted ? "Distracted" : "Focused"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── guidance card ────────────────────────────────────────────────
function GuidanceCard({ currentApp, isDistracted, suggestion, category }) {
  const accent = isDistracted ? "#fb7185" : "#22d3ee";
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading
        icon={Brain}
        color="#a78bfa"
        title="Real-Time Guidance"
        subtitle="Clear feedback about what you are doing right now and what to do next."
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <InnerCell className="p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current app</p>
            <p className="mt-3 text-2xl font-semibold text-white">{currentApp}</p>
          </InnerCell>
          <InnerCell className="p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
            <div
              className="mt-3 inline-flex rounded-full px-3 py-1 text-sm font-medium"
              style={{ background: `${accent}14`, color: accent, boxShadow: `0 0 12px ${accent}18` }}
            >
              {category}
            </div>
          </InnerCell>
        </div>
        <div
          className="rounded-3xl p-5"
          style={{
            background: `linear-gradient(135deg, ${accent}10 0%, ${accent}04 100%)`,
            boxShadow: `inset 0 1px 0 ${accent}20, 0 0 30px ${accent}0a`,
          }}
        >
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Suggestion</p>
          <p className="mt-3 text-lg font-medium text-white">{suggestion}</p>
          <p className="mt-3 text-sm text-slate-300">
            {isDistracted
              ? "Pause the distraction loop now so the next 20 minutes stay productive."
              : "You are in a good rhythm. Protect this block and avoid switching apps."}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── summary metric cards ─────────────────────────────────────────
const METRIC_COLORS = {
  cyan:    "#22d3ee",
  rose:    "#fb7185",
  amber:   "#fbbf24",
  emerald: "#34d399",
};

function MetricCard({ label, value, subtext, icon: Icon, color }) {
  return (
    <SectionCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
          <p className="mt-2 text-sm text-slate-400">{subtext}</p>
        </div>
        <IconBox icon={Icon} color={color} boxSize="w-11 h-11" />
      </div>
    </SectionCard>
  );
}

// ─── app usage pie ────────────────────────────────────────────────
function UsageLegend({ color, label, value }) {
  return (
    <div
      className="flex items-center justify-between rounded-2xl px-4 py-3 bg-[#060b16]"
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

function DashboardBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-2xl px-4 py-3 shadow-2xl"
      style={{ background: "#08101f", boxShadow: "0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)" }}
    >
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="mt-1 text-sm text-cyan-200">{payload[0].value} minutes</p>
    </div>
  );
}

function UsageInsights({ usageData, mostUsedApp }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading icon={BookOpen} color="#22d3ee" title="App Usage Insights" subtitle="A simple view of where your time went today." />
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={usageData} dataKey="value" innerRadius={64} outerRadius={96} paddingAngle={4} stroke="none">
                {usageData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#08101f", border: "none", borderRadius: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.8)", color: "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-3">
          {usageData.map((item) => <UsageLegend key={item.name} color={item.color} label={item.name} value={item.display} />)}
          <div
            className="rounded-3xl p-5"
            style={{ background: "linear-gradient(135deg,#22d3ee0e,#22d3ee04)", boxShadow: "inset 0 1px 0 #22d3ee22, 0 0 30px #22d3ee0a" }}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/60">Most used app</p>
            <p className="mt-3 text-2xl font-semibold text-white">{mostUsedApp}</p>
            <p className="mt-2 text-sm text-slate-300">Keep your most-used apps aligned with your study goal.</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── focus history ────────────────────────────────────────────────
function FocusHistory({ items }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading icon={Clock3} color="#818cf8" title="Focus History" subtitle="Recent sessions presented as a simple study timeline." />
      <motion.div
        variants={staggerInner(0.1)}
        initial="hidden"
        animate="show"
        className="mt-6 space-y-2"
      >
        {items.map((item, i) => {
          const accent = item.status === "Focused" ? "#34d399" : "#fb7185";
          return (
            <motion.div
              key={`${item.time}-${item.app}-${i}`}
              variants={fadeUp}
              whileHover={{ x: 4, transition: { duration: 0.2 } }}
              className="relative flex flex-col gap-3 rounded-2xl bg-[#060b16] p-4 md:flex-row md:items-center md:justify-between overflow-hidden"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
            >
              {/* left accent line */}
              <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full" style={{ background: accent }} />
              <div className="flex items-center gap-4 pl-2">
                <div
                  className="rounded-xl px-3 py-2 text-sm text-slate-300 flex-shrink-0 tabular-nums"
                  style={{ background: "rgba(255,255,255,0.05)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
                >
                  {item.time}
                </div>
                <div>
                  <div className="text-base font-medium text-white">{item.app}</div>
                  <div className="text-sm text-slate-400">{item.note}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-2 md:pl-0">
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium"
                  style={{ background: `${accent}14`, color: accent, boxShadow: `0 0 10px ${accent}18` }}
                >
                  {item.status}
                </span>
                <div
                  className="rounded-xl px-3 py-2 text-sm text-white"
                  style={{ background: "rgba(255,255,255,0.05)" }}
                >
                  Score {item.score}%
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </SectionCard>
  );
}

// ─── suggestions ──────────────────────────────────────────────────
const SUGGESTION_ICON_MAP = {
  trend_alert:  { icon: TrendingDown, color: "#fb7185" },
  distraction:  { icon: AlertTriangle, color: "#fbbf24" },
  study_time:   { icon: Clock3,        color: "#818cf8" },
  balance:      { icon: CheckCircle2,  color: "#34d399" },
  missed_tasks: { icon: AlertTriangle, color: "#fbbf24" },
  content:      { icon: Brain,         color: "#c084fc" },
  scheduling:   { icon: Activity,      color: "#22d3ee" },
  subject:      { icon: BookOpen,      color: "#fbbf24" },
  positive:     { icon: Star,          color: "#34d399" },
  onboarding:   { icon: Zap,           color: "#818cf8" },
};

// Static suggestion config (fallback when backend returns no suggestions)
const STATIC_SUGGESTIONS = [
  { title: "Avoid chat apps during focus blocks", message: "Avoid WhatsApp during study blocks unless it is required for class coordination.", type: "distraction" },
  { title: "Use your best attention window",       message: "You focus best between 10 AM and 12 PM. Schedule your hardest work in that window.", type: "scheduling" },
  { title: "Take a short recovery break",          message: "Take a 5-minute break after this session so the next block starts with better energy.", type: "study_time" },
  { title: "Watch today's distraction trend",      message: "Your distractions increased today compared to yesterday. Reduce context switching this afternoon.", type: "trend_alert" },
];

function SuggestionRow({ title, message, type }) {
  const cfg = SUGGESTION_ICON_MAP[type] || SUGGESTION_ICON_MAP.onboarding;
  const Icon = cfg.icon;
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ x: 4, transition: { duration: 0.2 } }}
      className="flex items-start gap-3 rounded-2xl bg-[#060b16] p-4"
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      <div
        className="mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${cfg.color}14`, boxShadow: `0 0 16px ${cfg.color}20, inset 0 1px 0 ${cfg.color}28` }}
      >
        <Icon size={15} style={{ color: cfg.color }} />
      </div>
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-sm text-slate-400">{message}</div>
      </div>
    </motion.div>
  );
}

function SuggestionsPanel({ suggestions }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading icon={Sparkles} color="#a78bfa" title="Personalized Suggestions" subtitle="Smart recommendations translated into direct student actions." />
      <motion.div variants={staggerInner(0.1)} initial="hidden" animate="show" className="mt-6 space-y-2">
        {suggestions.map((s, i) => (
          <SuggestionRow key={i} title={s.title} message={s.message || s.text} type={s.type} />
        ))}
      </motion.div>
    </SectionCard>
  );
}

// ─── motivation / streak ──────────────────────────────────────────
function GoalProgress({ label, value, max }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-slate-300">{label}</span>
        <span className="text-white font-semibold">{pct}%</span>
      </div>
      <GlowBar pct={pct} gradient="linear-gradient(90deg,#34d399,#22d3ee)" delay={0.3} />
    </div>
  );
}

function MotivationPanel({ streakDays, badge, badgeDesc, goalMinutes, completedMinutes }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading icon={Trophy} color="#fbbf24" title="Momentum & Motivation" subtitle="Build consistency with visible progress, streaks, and small wins." />
      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr_1fr]">
        {/* streak */}
        <div
          className="rounded-3xl p-5"
          style={{ background: "linear-gradient(135deg,#d9770612,#ea580c08)", boxShadow: "inset 0 1px 0 #d9770622, 0 0 30px #d9770608" }}
        >
          <div className="flex items-center gap-2">
            <Flame size={17} style={{ color: "#fbbf24" }} />
            <span className="text-sm uppercase tracking-[0.22em] text-amber-200/80">Focus streak</span>
          </div>
          <div className="mt-4 text-4xl font-semibold text-white">
            <AnimNumber value={streakDays} /> days
          </div>
          <p className="mt-2 text-sm text-slate-300">Keep tomorrow strong to extend your streak.</p>
        </div>

        {/* badge */}
        <div
          className="rounded-3xl p-5"
          style={{ background: "linear-gradient(135deg,#7c3aed12,#4f46e508)", boxShadow: "inset 0 1px 0 #7c3aed22, 0 0 30px #7c3aed08" }}
        >
          <div className="flex items-center gap-2">
            <Award size={17} style={{ color: "#a78bfa" }} />
            <span className="text-sm uppercase tracking-[0.22em] text-violet-200/80">Achievement</span>
          </div>
          <div className="mt-4 text-xl font-semibold text-white">{badge || "First Focus"}</div>
          <p className="mt-2 text-sm text-slate-300">{badgeDesc || "Complete focused sessions to earn achievements."}</p>
        </div>

        {/* daily goal */}
        <div
          className="rounded-3xl p-5"
          style={{ background: "linear-gradient(135deg,#05966910,#0d948806)", boxShadow: "inset 0 1px 0 #05966922, 0 0 30px #05966908" }}
        >
          <div className="flex items-center gap-2">
            <TimerReset size={17} style={{ color: "#34d399" }} />
            <span className="text-sm uppercase tracking-[0.22em] text-emerald-200/80">Daily goal</span>
          </div>
          <div className="mt-4 space-y-3">
            <GoalProgress
              label={`${completedMinutes} of ${goalMinutes} min completed`}
              value={completedMinutes}
              max={goalMinutes}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── weekly pattern bar chart ─────────────────────────────────────
function WeeklyPattern({ data }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading icon={Activity} color="#22d3ee" title="Weekly Pattern" subtitle="When your strongest study blocks happen." />
      <div className="mt-6 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap={20}>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <Tooltip content={<DashboardBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
            <Bar dataKey="minutes" radius={[10, 10, 0, 0]} fill="url(#weekGradient)" />
            <defs>
              <linearGradient id="weekGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#7c3aed" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// ─── planner data hook (streak + analytics) ───────────────────────
function usePlannerData() {
  const [analytics, setAnalytics] = useState(null);
  const [streakInfo, setStreakInfo] = useState(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const [aRes, tRes] = await Promise.all([
          fetch(getPlannerApiUrl("/api/planner/analytics")),
          fetch(getPlannerApiUrl("/api/planner/tasks")),
        ]);
        if (aRes.ok) setAnalytics(await aRes.json());
        if (tRes.ok) {
          const d = await tRes.json();
          if (d.streak_info) setStreakInfo(d.streak_info);
        }
      } catch {}
    };
    fetch_();
    const id = setInterval(fetch_, 60_000);
    return () => clearInterval(id);
  }, []);

  return { analytics, streakInfo };
}

// ─── main Dashboard ───────────────────────────────────────────────
export default function Dashboard() {
  useTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connected, prediction, history = [], status } = useAgent(4000);
  const { analytics, streakInfo } = usePlannerData();

  // ── history mapping ──────────────────────────────────────────────
  const fallbackHistory = useMemo(() => [
    { time: "09:10 AM", app: "Chrome",           note: "Lecture slides and course notes",           status: "Focused",    score: 87 },
    { time: "10:05 AM", app: "WhatsApp Desktop",  note: "Messages interrupted study block",          status: "Distracted", score: 43 },
    { time: "11:30 AM", app: "VS Code",           note: "Working through programming exercises",     status: "Focused",    score: 91 },
    { time: "01:20 PM", app: "YouTube",           note: "Drifted into non-study content",            status: "Distracted", score: 38 },
  ], []);

  const mappedHistory = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return fallbackHistory;
    return history.slice(0, 6).map((item, i) => {
      const ts = item.timestamp ? new Date(item.timestamp) : null;
      const time = ts && !Number.isNaN(ts.getTime())
        ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : fallbackHistory[i % fallbackHistory.length].time;
      const app = item.app || item.app_name || item.active_app || fallbackHistory[i % fallbackHistory.length].app;
      const distracted = Boolean(item.is_distracted ?? item.distracted);
      const score = Math.max(15, Math.min(99, Math.round(
        typeof item.focus_score === "number" ? item.focus_score
        : typeof item.probability === "number" ? (1 - item.probability) * 100
        : fallbackHistory[i % fallbackHistory.length].score
      )));
      return { time, app, note: distracted ? "Attention shifted away from the study goal" : "Stayed aligned with the study task", status: distracted ? "Distracted" : "Focused", score };
    });
  }, [fallbackHistory, history]);

  // ── live signal ──────────────────────────────────────────────────
  const liveFocusScore = useMemo(() => {
    if (typeof prediction?.focus_score === "number") return Math.round(prediction.focus_score);
    if (typeof prediction?.probability === "number") return Math.round((1 - prediction.probability) * 100);
    return mappedHistory[0]?.score ?? 80;
  }, [mappedHistory, prediction]);

  const isDistracted = Boolean(prediction?.is_distracted ?? (mappedHistory[0]?.status === "Distracted"));
  const currentApp = String(prediction?.dominant_app || prediction?.app || status?.latest_snapshot?.current_app || mappedHistory[0]?.app || "Chrome").replace(/\.exe$/i, "");
  const currentTask = isDistracted ? "Return to your study task" : "Deep study block";
  const heroMessage = isDistracted
    ? "A distracting pattern appeared in your current session. Close the off-task app and restart with one small study action."
    : "Your current behavior looks steady and productive. Stay with this task a little longer before switching context.";
  const category = isDistracted ? "Distracting" : "Study-related";
  const suggestion = isDistracted
    ? "Return to your study task now. Silence notifications and start a 5-minute recovery sprint."
    : "Continue this session for 20 more minutes while your attention is stable.";

  // ── computed session stats ───────────────────────────────────────
  const focusedSessions   = mappedHistory.filter(h => h.status === "Focused").length;
  const distractedSessions = mappedHistory.filter(h => h.status === "Distracted").length;
  const studyMinutes      = focusedSessions * 42 + (isDistracted ? 0 : 18);
  const completedTasks    = Math.max(2, focusedSessions);
  const focusMinutes      = Math.max(25, Math.round(studyMinutes / Math.max(focusedSessions, 1)));
  const longestStreak     = `${Math.max(35, focusedSessions * 22)} min`;

  // ── real streak from planner ─────────────────────────────────────
  const streakDays        = streakInfo?.focus_streak ?? 0;
  const latestBadge       = streakInfo?.badges?.at(-1);
  const badge             = latestBadge?.name ?? (isDistracted ? "Bounce Back Learner" : "Deep Focus Achiever");
  const badgeDesc         = latestBadge?.description ?? "You earned this by sustaining focused study blocks with fewer distractions.";

  // ── real weekly pattern from analytics daily_trends ─────────────
  const weeklyPattern = useMemo(() => {
    const trends = analytics?.daily_trends;
    if (trends?.length) {
      return trends.map(d => ({
        day: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
        minutes: d.study_minutes ?? 0,
      }));
    }
    return [
      { day: "Mon", minutes: 95 },  { day: "Tue", minutes: 122 },
      { day: "Wed", minutes: 110 }, { day: "Thu", minutes: 138 },
      { day: "Fri", minutes: 86 },  { day: "Sat", minutes: 74 },
      { day: "Sun", minutes: 118 },
    ];
  }, [analytics]);

  // ── real suggestions from analytics (or static fallback) ─────────
  const suggestions = useMemo(() => {
    const raw = analytics?.suggestions;
    if (raw?.length) {
      return raw.map(s => ({ title: s.title, message: s.message, type: s.type }));
    }
    return STATIC_SUGGESTIONS;
  }, [analytics]);

  // ── study goal from analytics weekly_summary ─────────────────────
  const goalMinutes = 180;
  const completedMinutes = useMemo(() => {
    const wh = analytics?.weekly_summary?.total_study_hours;
    if (typeof wh === "number") return Math.min(goalMinutes, Math.round(wh * 60));
    return Math.min(goalMinutes, studyMinutes + 28);
  }, [analytics, studyMinutes]);

  const mostUsedApp = useMemo(() => {
    const counts = mappedHistory.reduce((acc, h) => { acc[h.app] = (acc[h.app] || 0) + 1; return acc; }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || currentApp;
  }, [currentApp, mappedHistory]);

  const usageData = [
    { name: "Study apps",      value: Math.max(60, studyMinutes),            display: `${Math.max(1, Math.floor(studyMinutes / 60))}h ${studyMinutes % 60}m`, color: "#34d399" },
    { name: "Distracting apps", value: Math.max(15, distractedSessions * 18), display: `${distractedSessions * 18}m`, color: "#fb7185" },
    { name: "Short breaks",    value: 24,                                     display: "24m",                          color: "#8b5cf6" },
  ];

  const studentName = user?.name || user?.full_name || user?.username || user?.email?.split("@")?.[0] || "Student";

  const handleLogout = async () => {
    try { await logout(); } finally { navigate("/login"); }
  };

  return (
    <div className="flex min-h-screen bg-[#040816] text-white">
      <Sidebar active="Dashboard" />

      <main className="min-h-screen flex-1 overflow-y-auto">
        {/* ── header ── */}
        <header className="sticky top-0 z-20 bg-[#040816]/88 backdrop-blur-xl"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.38em] text-cyan-300/70">Smart Student Dashboard</div>
              <div className="mt-2 flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-white lg:text-3xl">SDPPS</h1>
                <span
                  className="rounded-full px-3 py-1 text-xs text-slate-300"
                  style={{ background: "rgba(255,255,255,0.05)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
                >
                  Student view
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* live indicator */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={String(connected)}
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm"
                  style={connected
                    ? { background: "#34d39912", boxShadow: "0 0 16px #34d39920, inset 0 1px 0 #34d39922", color: "#6ee7b7" }
                    : { background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}
                >
                  {connected
                    ? <><motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }}><Wifi size={15} /></motion.div> Live session active</>
                    : <><WifiOff size={15} /> Waiting for live session</>}
                </motion.div>
              </AnimatePresence>

              {/* profile */}
              <div
                className="flex items-center gap-3 rounded-full px-4 py-2"
                style={{ background: "rgba(255,255,255,0.04)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#22d3ee)" }}>
                  {studentName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{studentName}</div>
                  <div className="text-xs text-slate-400">Student profile</div>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handleLogout}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm text-slate-200 transition"
                style={{ background: "rgba(255,255,255,0.04)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
              >
                <LogOut size={15} />
                Logout
              </motion.button>
            </div>
          </div>
        </header>

        {/* ── page content ── */}
        <motion.div
          variants={staggerPage}
          initial="hidden"
          animate="show"
          className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-6 lg:px-8"
        >
          <HeroFocusCard
            score={liveFocusScore}
            isDistracted={isDistracted}
            currentTask={currentTask}
            focusMinutes={focusMinutes}
            message={heroMessage}
          />

          <GuidanceCard currentApp={currentApp} isDistracted={isDistracted} suggestion={suggestion} category={category} />

          {/* summary 4-up */}
          <motion.div variants={staggerInner()} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total study time"       value={`${Math.floor(studyMinutes / 60)}h ${studyMinutes % 60}m`} subtext="Time in focused study apps today"          icon={Clock3}       color="#22d3ee" />
            <MetricCard label="Number of distractions" value={distractedSessions}                                          subtext="Moments that pulled attention away"          icon={ShieldAlert}  color="#fb7185" />
            <MetricCard label="Longest focus streak"   value={longestStreak}                                               subtext="Your best uninterrupted session today"      icon={Flame}        color="#fbbf24" />
            <MetricCard label="Tasks completed"        value={completedTasks}                                              subtext="Study blocks or tasks finished"             icon={CheckCircle2} color="#34d399" />
          </motion.div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <UsageInsights usageData={usageData} mostUsedApp={mostUsedApp} />
            <WeeklyPattern data={weeklyPattern} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <FocusHistory items={mappedHistory} />
            <SuggestionsPanel suggestions={suggestions} />
          </div>

          <MotivationPanel
            streakDays={streakDays}
            badge={badge}
            badgeDesc={badgeDesc}
            goalMinutes={goalMinutes}
            completedMinutes={completedMinutes}
          />

          <Footer />
        </motion.div>
      </main>
    </div>
  );
}
