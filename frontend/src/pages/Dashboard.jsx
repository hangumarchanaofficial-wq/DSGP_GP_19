import React, { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion, AnimatePresence, useMotionValue, useSpring, useInView,
} from "framer-motion";
import {
  AlarmClock,
  BrainCircuit,
  CheckCheck,
  Coffee,
  Flame,
  Layers3,
  LogOut,
  ScanSearch,
  MessageSquareOff,
  ShieldBan,
  TrendingUp,
  Wifi,
  WifiOff,
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
import { getPlannerApiUrl, sortTasksByStartTime } from "./planner/plannerUtils";

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
      whileHover={{ y: -1, transition: { duration: 0.22 } }}
      className={`rounded-[26px] bg-gradient-to-b from-[#0d1426] to-[#080d18] ${className}`}
      style={{
        boxShadow: glow
          ? `0 0 42px ${glow}18, 0 18px 42px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)`
          : "0 18px 42px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </motion.section>
  );
}

function InnerCell({ children, className = "", style = {} }) {
  return (
    <div
      className={`rounded-2xl bg-[#060b16] ${className}`}
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)", ...style }}
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
function SectionHeading({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-serif text-[1.15rem] text-white lg:text-[1.35rem]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action || null}
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
  const iconMap = {
    "Current Task": Layers3,
    "Focus Score": ScanSearch,
    "Prediction Confidence": ScanSearch,
    "Focused Time": AlarmClock,
  };
  const Icon = iconMap[label];
  return (
    <div
      className="min-h-[124px] rounded-2xl p-4"
      style={{
        background: `linear-gradient(135deg, ${c.from}10 0%, ${c.to}06 100%)`,
        boxShadow: `inset 0 1px 0 ${c.from}18`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
        {Icon ? (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{
              background: `${c.from}12`,
              boxShadow: `inset 0 1px 0 ${c.from}18, 0 10px 20px rgba(0,0,0,0.14)`,
            }}
          >
            <Icon size={15} style={{ color: c.text }} />
          </div>
        ) : null}
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function HeroFocusCard({
  score,
  scoreLabel = "Prediction Confidence",
  isDistracted,
  currentTask,
  focusMinutes,
  message,
  isEmpty = false,
}) {
  const accent = isDistracted ? "#fb7185" : "#34d399";
  const gradient = isDistracted
    ? "linear-gradient(135deg,#fb7185,#f97316)"
    : "linear-gradient(135deg,#34d399,#22d3ee)";

  return (
    <SectionCard
      className="overflow-hidden"
      glow={accent}
    >
      <div className="grid gap-6 p-6 lg:grid-cols-[1.45fr_0.9fr] lg:p-8">
        {/* left */}
        <div className="space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Focus</p>
            <motion.h1
              key={String(isDistracted)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="mt-3 max-w-lg font-serif text-[2rem] font-semibold leading-[1] tracking-[-0.02em] text-white lg:text-[2.8rem]"
            >
              {isEmpty ? "Ready when you are." : isDistracted ? "Refocus now." : "You are focused."}
            </motion.h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-slate-400 lg:text-base">{message}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SmallMetric label="Current Task" value={currentTask} tone="violet" />
            <SmallMetric label={scoreLabel} value={`${score}%`} tone={isDistracted ? "amber" : "emerald"} />
            <SmallMetric label="Focused Time" value={`${focusMinutes} min`} tone="violet" />
          </div>
        </div>

        {/* right — ring */}
        <div className="flex items-center justify-center lg:justify-end">
          <div
            className="relative flex h-[18rem] w-[18rem] items-center justify-center rounded-[34px] bg-slate-950/68 lg:h-[20rem] lg:w-[20rem]"
            style={{ boxShadow: `0 0 40px ${accent}14, 0 22px 50px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.05)` }}
          >
            {/* conic ring */}
            <motion.div
              className="absolute inset-6 rounded-full"
              initial={{ opacity: 0 }}
              animate={isEmpty ? { opacity: [0.45, 0.8, 0.45], rotate: 360 } : { opacity: 1 }}
              transition={isEmpty ? { duration: 8, repeat: Infinity, ease: "linear" } : { duration: 0.8 }}
              style={{
                background: `conic-gradient(${accent} ${score}%, rgba(255,255,255,0.05) ${score}% 100%)`,
              }}
            />
            <div className="absolute inset-10 rounded-full bg-[#060b16]" />
            <div className="relative text-center">
              <motion.div
                key={score}
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="text-6xl font-bold bg-clip-text text-transparent lg:text-[5rem]"
                style={{ backgroundImage: gradient }}
              >
                {score}%
              </motion.div>
              <div className="mt-2 text-[11px] uppercase tracking-[0.34em] text-slate-500">{scoreLabel}</div>
              <div
                className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium"
                style={{
                  background: `${accent}14`,
                  boxShadow: `0 0 14px ${accent}18, inset 0 1px 0 ${accent}24`,
                  color: accent,
                }}
              >
                {isEmpty ? "Awaiting activity" : isDistracted ? "Distracted" : "Focused"}
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
    <SectionCard className="p-5 lg:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg tracking-[0.02em] text-white lg:text-[1.45rem]">Guidance</h2>
        </div>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <InnerCell
            className="p-4"
            style={{
              background: "linear-gradient(180deg, rgba(7,12,24,0.96), rgba(5,9,18,0.98))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px rgba(0,0,0,0.18)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">App</p>
            <p className="mt-3 font-serif text-2xl text-white">{currentApp}</p>
          </InnerCell>
          <InnerCell
            className="p-4"
            style={{
              background: "linear-gradient(180deg, rgba(7,12,24,0.96), rgba(5,9,18,0.98))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px rgba(0,0,0,0.18)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Status</p>
            <div
              className="mt-3 inline-flex rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ background: `${accent}12`, color: accent, boxShadow: `0 0 16px ${accent}16, inset 0 1px 0 ${accent}20` }}
            >
              {category}
            </div>
          </InnerCell>
        </div>
        <div
          className="rounded-[24px] p-5 lg:p-6"
          style={{
            background: `linear-gradient(135deg, rgba(10,18,34,0.98) 0%, ${accent}0f 100%)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 22px 48px rgba(0,0,0,0.24), 0 0 32px ${accent}0a`,
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Next</p>
          <p className="mt-3 max-w-2xl font-serif text-lg leading-tight text-white lg:text-[1.45rem]">{suggestion}</p>
          <p className="mt-2 max-w-xl text-xs leading-6 text-slate-300 lg:text-sm">
            {isDistracted
              ? "Pause distractions and return to study."
              : "Stay on this task and avoid switching apps."}
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

function MetricCard({ label, value, subtext, icon: Icon, tint, isEmpty = false }) {
  return (
    <SectionCard className="min-h-[150px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <div className="mt-2 text-[1.9rem] font-semibold text-white">{value}</div>
          <p className="mt-1 text-sm text-slate-500">{subtext}</p>
        </div>
        <motion.div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          animate={isEmpty ? { scale: [1, 1.08, 1], opacity: [0.65, 1, 0.65] } : undefined}
          transition={isEmpty ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" } : undefined}
          style={{
            background: `${tint}10`,
            boxShadow: `inset 0 1px 0 ${tint}18, 0 10px 24px rgba(0,0,0,0.18)`,
          }}
        >
          <Icon size={16} style={{ color: tint }} />
        </motion.div>
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
      <p className="mt-1 text-sm text-cyan-200">{payload[0].value} hours</p>
    </div>
  );
}

function UsageInsights({ usageData, mostUsedApp, isEmpty = false }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading title="Usage" subtitle="Where your time went today." />
      <div className="mt-5 grid items-center gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <motion.div
          className="flex h-64 items-center justify-center lg:h-[17rem]"
          animate={isEmpty ? { opacity: [0.72, 1, 0.72], y: [0, -3, 0] } : undefined}
          transition={isEmpty ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" } : undefined}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={usageData} dataKey="value" innerRadius={64} outerRadius={96} paddingAngle={4} stroke="none">
                {usageData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#08101f", border: "none", borderRadius: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.8)", color: "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
        <div className="flex flex-col justify-center space-y-3">
          {usageData.map((item) => <UsageLegend key={item.name} color={item.color} label={item.name} value={item.display} />)}
          <div
            className="rounded-3xl p-5"
            style={{ background: "linear-gradient(135deg,#22d3ee0e,#22d3ee04)", boxShadow: "inset 0 1px 0 #22d3ee22, 0 0 30px #22d3ee0a" }}
          >
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/60">Most used</p>
            <p className="mt-2 font-serif text-[1.4rem] text-white">{mostUsedApp}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── focus history ────────────────────────────────────────────────
function FocusHistory({ items, isEmpty = false }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading title="Recent Sessions" />
      <motion.div
        variants={staggerInner(0.1)}
        initial="hidden"
        animate="show"
        className="mt-5 space-y-3"
      >
        {(items.length ? items.slice(0, 5) : Array.from({ length: 5 }, (_, i) => ({
          time: "--:--",
          app: "Waiting for your first session",
          status: "Pending",
          score: 0,
          empty: true,
          key: i,
        }))).map((item, i) => {
          const accent = item.status === "Focused" ? "#34d399" : "#fb7185";
          return (
            <motion.div
              key={item.key ?? `${item.time}-${item.app}-${i}`}
              variants={fadeUp}
              whileHover={{ x: item.empty ? 0 : 4, transition: { duration: 0.2 } }}
              animate={item.empty ? { opacity: [0.55, 0.9, 0.55] } : undefined}
              transition={item.empty ? { duration: 2.8, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" } : undefined}
              className="relative flex flex-col gap-3 rounded-[24px] bg-[#060b16] px-5 py-4 md:flex-row md:items-center md:justify-between overflow-hidden"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 36px rgba(0,0,0,0.18)" }}
            >
              {/* left accent line */}
              <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full" style={{ background: accent }} />
              <div className="flex items-center gap-4 pl-2">
                <div
                  className="rounded-2xl px-4 py-2 text-sm text-slate-200 flex-shrink-0 tabular-nums"
                  style={{ background: "rgba(255,255,255,0.05)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
                >
                  {item.time}
                </div>
                <div>
                  <div className="font-serif text-[1.02rem] text-white lg:text-[1.08rem]">{item.app}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-2 md:pl-0">
                <span
                  className="rounded-full px-4 py-1.5 text-xs font-medium"
                  style={{ background: `${accent}12`, color: accent, boxShadow: `0 0 10px ${accent}14` }}
                >
                  {item.empty ? "Pending" : item.status}
                </span>
                <div
                  className="rounded-2xl px-4 py-2 text-sm text-white"
                  style={{ background: "rgba(255,255,255,0.05)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
                >
                  {item.empty ? "No data" : `Score ${item.score}%`}
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
// Static suggestion config (fallback when backend returns no suggestions)
const STATIC_SUGGESTIONS = [
  { title: "Avoid chat apps during focus blocks", message: "Avoid WhatsApp during study blocks unless it is required for class coordination.", type: "distraction" },
  { title: "Use your best attention window",       message: "You focus best between 10 AM and 12 PM. Schedule your hardest work in that window.", type: "scheduling" },
  { title: "Take a short recovery break",          message: "Take a 5-minute break after this session so the next block starts with better energy.", type: "study_time" },
  { title: "Watch today's distraction trend",      message: "Your distractions increased today compared to yesterday. Reduce context switching this afternoon.", type: "trend_alert" },
];

function SuggestionRow({ title, message, type }) {
  const iconMap = {
    distraction: { Icon: MessageSquareOff, tint: "#fb7185" },
    scheduling: { Icon: BrainCircuit, tint: "#8b5cf6" },
    study_time: { Icon: Coffee, tint: "#34d399" },
    trend_alert: { Icon: TrendingUp, tint: "#f59e0b" },
  };
  const { Icon, tint } = iconMap[type] || { Icon: BrainCircuit, tint: "#8b5cf6" };

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ x: 2, transition: { duration: 0.2 } }}
      className="flex items-start gap-4 rounded-2xl bg-[#060b16] p-4"
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      <div
        className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
        style={{
          background: `${tint}10`,
          boxShadow: `inset 0 1px 0 ${tint}18, 0 10px 24px rgba(0,0,0,0.18)`,
        }}
      >
        <Icon size={16} style={{ color: tint }} />
      </div>
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{message}</div>
      </div>
    </motion.div>
  );
}

function SuggestionsPanel({ suggestions, isEmpty = false }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading title="Suggestions" subtitle="A few smart adjustments." />
      <motion.div variants={staggerInner(0.1)} initial="hidden" animate="show" className="mt-6 space-y-2">
        {(suggestions.length ? suggestions : [
          { title: "Suggestions will appear here", message: "Start a session to unlock personalized guidance.", type: "scheduling" },
          { title: "Track your first study block", message: "Your dashboard learns from activity across the day.", type: "study_time" },
        ]).map((s, i) => (
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
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-semibold">{pct}%</span>
      </div>
      <GlowBar pct={pct} gradient="linear-gradient(90deg,#34d399,#22d3ee)" delay={0.3} />
    </div>
  );
}

function MotivationPanel({ streakDays, badge, badgeDesc, goalMinutes, completedMinutes, isEmpty = false }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading title="Momentum" subtitle="Consistency, rewards, and progress." />
      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr_1fr]">
        {/* streak */}
        <div
          className="rounded-3xl p-5"
          style={{ background: "linear-gradient(135deg,#d9770612,#ea580c08)", boxShadow: "inset 0 1px 0 #d9770622, 0 0 30px #d9770608" }}
        >
          <span className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">Focus streak</span>
          <div className="mt-4 text-4xl font-semibold text-white">
            <AnimNumber value={streakDays} /> days
          </div>
          <p className="mt-2 text-sm text-slate-500">{isEmpty ? "Start today to build your streak." : "Keep the run going tomorrow."}</p>
        </div>

        {/* badge */}
        <div
          className="rounded-3xl p-5"
          style={{ background: "linear-gradient(135deg,#7c3aed12,#4f46e508)", boxShadow: "inset 0 1px 0 #7c3aed22, 0 0 30px #7c3aed08" }}
        >
          <span className="text-[10px] uppercase tracking-[0.18em] text-violet-200/80">Achievement</span>
          <div className="mt-4 font-serif text-[1.35rem] text-white">{badge || "First Focus"}</div>
          <p className="mt-2 text-sm text-slate-500">{badgeDesc || "Complete focused sessions to earn achievements."}</p>
        </div>

        {/* daily goal */}
        <div
          className="rounded-3xl p-5"
          style={{ background: "linear-gradient(135deg,#05966910,#0d948806)", boxShadow: "inset 0 1px 0 #05966922, 0 0 30px #05966908" }}
        >
          <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Daily goal</span>
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
function WeeklyPattern({ data, isEmpty = false }) {
  if (isEmpty) {
    return (
      <SectionCard className="p-6 lg:p-7">
        <SectionHeading title="Weekly Pattern" subtitle="Study hours per day." />
        <div className="mt-5 flex h-64 items-center justify-center rounded-[24px] bg-[#060b16]">
          <motion.div
            className="text-center"
            animate={{ opacity: [0.45, 0.95, 0.45], y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">No data yet</div>
            <div className="mt-3 font-serif text-2xl text-white">No study pattern</div>
            <div className="mt-2 text-sm text-slate-500">
              Complete a few sessions to unlock your weekly hours.
            </div>
          </motion.div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading title="Weekly Pattern" subtitle="Study hours per day." />
      <div className="mt-5 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap={20}>
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
            <Tooltip content={<DashboardBarTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
            <Bar dataKey="hours" radius={[10, 10, 0, 0]} fill="url(#weekGradient)" />
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
function formatTaskTime(task) {
  if (task?.planned_start) {
    const date = new Date(task.planned_start);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
  }

  return task?.scheduled_slot || "Schedule pending";
}

function NextTaskCard({ task, onOpenPlanner }) {
  if (!task) return null;

  return (
    <SectionCard className="p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Next task</p>
          <h2 className="mt-1 font-serif text-[1.35rem] text-white lg:text-[1.6rem]">{task.subject || "Next task"}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-400">
            <span className="rounded-full bg-white/5 px-3 py-1">{formatTaskTime(task)}</span>
            <span className="rounded-full bg-white/5 px-3 py-1">{task.duration_minutes || 0} min</span>
            <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-200">
              {task.status === "active" ? "In progress" : "Upcoming"}
            </span>
          </div>
          {task.notes ? <p className="mt-3 max-w-xl text-sm text-slate-500">{task.notes}</p> : null}
        </div>

        <motion.button
          type="button"
          onClick={onOpenPlanner}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
        >
          Open Planner
        </motion.button>
      </div>
    </SectionCard>
  );
}

function DashboardEmptyState({ onOpenPlanner }) {
  return (
    <SectionCard className="overflow-hidden p-6 lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="relative">
          <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute left-28 top-24 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="relative"
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Dashboard waiting</p>
            <h1 className="mt-3 max-w-xl font-serif text-[2rem] leading-[1.02] text-white lg:text-[3rem]">
              Your study dashboard will light up as soon as activity starts.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-400 lg:text-base">
              Add a task in Adaptive Planner or begin a study session to unlock focus trends, recent sessions, and personalized suggestions.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <motion.button
                type="button"
                onClick={onOpenPlanner}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
              >
                Open Planner
              </motion.button>
              <div className="rounded-full bg-white/5 px-4 py-2.5 text-sm text-slate-300">
                No study data yet
              </div>
            </div>
          </motion.div>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="relative h-[18rem] w-[18rem] lg:h-[21rem] lg:w-[21rem]">
            <motion.div
              className="absolute inset-0 rounded-full border border-white/6"
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-5 rounded-full border border-cyan-400/18"
              animate={{ rotate: -360 }}
              transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute inset-10 rounded-full border border-violet-400/16"
              animate={{ rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-[4.6rem] rounded-full bg-[#060b16]" />
            <motion.div
              className="absolute inset-[6.2rem] rounded-full bg-gradient-to-br from-cyan-400/12 to-violet-500/12 blur-xl"
              animate={{ scale: [0.92, 1.04, 0.92], opacity: [0.5, 0.85, 0.5] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Awaiting first session</div>
                <div className="mt-3 font-serif text-2xl text-white">0 activities</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {["Focus trends", "Recent activity", "Suggestions"].map((label, index) => (
          <motion.div
            key={label}
            className="rounded-[24px] bg-[#060b16] p-5"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
            animate={{ y: [0, -4, 0], opacity: [0.72, 1, 0.72] }}
            transition={{ duration: 3.6, delay: index * 0.25, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
            <div className="mt-4 space-y-3">
              <div className="h-3 w-2/3 rounded-full bg-white/6" />
              <div className="h-3 w-1/2 rounded-full bg-white/5" />
              <div className="h-20 rounded-[20px] bg-gradient-to-br from-white/[0.04] to-white/[0.02]" />
            </div>
          </motion.div>
        ))}
      </div>
    </SectionCard>
  );
}

function usePlannerData() {
  const [analytics, setAnalytics] = useState(null);
  const [streakInfo, setStreakInfo] = useState(null);
  const [tasks, setTasks] = useState([]);

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
          setTasks(Array.isArray(d.tasks) ? d.tasks : []);
        }
      } catch {}
    };
    fetch_();
    const id = setInterval(fetch_, 60_000);
    return () => clearInterval(id);
  }, []);

  return { analytics, streakInfo, tasks };
}

// ─── main Dashboard ───────────────────────────────────────────────
export default function Dashboard() {
  useTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { connected, prediction, history = [], status } = useAgent(2000);
  const { analytics, streakInfo, tasks } = usePlannerData();
  const snapshotTarget = Number(status?.window_size || 10);
  const snapshotCount = Number(status?.snapshots || 0);
  const snapshotsRemaining = Math.max(0, snapshotTarget - snapshotCount);
  const warmupRemainingSeconds = snapshotsRemaining * 60;
  const warmupMinutes = Math.floor(warmupRemainingSeconds / 60);
  const warmupSeconds = warmupRemainingSeconds % 60;
  const warmupLabel = `${warmupMinutes}:${String(warmupSeconds).padStart(2, "0")}`;
  const isWarmup = !Boolean(status?.window_filled) || snapshotCount < snapshotTarget;

  // ── history mapping ──────────────────────────────────────────────
  const fullMappedHistory = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return [];
    return history
      .slice()
      .map((item, i) => {
        const ts = item.timestamp ? new Date(item.timestamp) : null;
        const time = ts && !Number.isNaN(ts.getTime())
          ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : `--:${String(i).padStart(2, "0")}`;
        const app = String(
          item.dominant_app
          || item.current_app
          || item.app
          || item.app_name
          || item.active_app
          || "Unknown"
        ).replace(/\.exe$/i, "");
        const distracted = Boolean(
          item.is_distracted === true
          || item.distracted === true
          || item.prediction === 1
          || item.label === "DISTRACTED"
          || (typeof item.final_prob === "number" && item.final_prob >= 0.5)
        );
        const score = Math.max(0, Math.min(100, Math.round(
          typeof item.final_prob === "number"
            ? ((distracted ? item.final_prob : 1 - item.final_prob) * 100)
            : typeof item.probability === "number"
              ? ((distracted ? item.probability : 1 - item.probability) * 100)
              : typeof item.focus_score === "number"
                ? item.focus_score
                : distracted ? 65 : 65
        )));
        return {
          time,
          app,
          note: distracted ? "Attention shifted away from the study goal" : "Stayed aligned with the study task",
          status: distracted ? "Distracted" : "Focused",
          score,
        };
      });
  }, [history]);

  const mappedHistory = useMemo(
    () => fullMappedHistory.slice().reverse().slice(0, 6),
    [fullMappedHistory],
  );

  // ── live signal ──────────────────────────────────────────────────
  const livePredictionConfidence = useMemo(() => {
    const distracted = Boolean(
      prediction?.is_distracted === true
      || prediction?.prediction === 1
      || prediction?.label === "DISTRACTED"
    );
    if (typeof prediction?.final_prob === "number") {
      return Math.round((distracted ? prediction.final_prob : 1 - prediction.final_prob) * 100);
    }
    if (typeof prediction?.probability === "number") {
      return Math.round((distracted ? prediction.probability : 1 - prediction.probability) * 100);
    }
    if (typeof prediction?.confidence === "number") {
      return Math.round(prediction.confidence * 100);
    }
    return mappedHistory[0]?.score ?? 0;
  }, [mappedHistory, prediction]);

  const isDistracted = Boolean(
    prediction?.is_distracted
    ?? prediction?.prediction === 1
    ?? (mappedHistory[0]?.status === "Distracted")
  );
  const currentApp = String(
    prediction?.dominant_app
    || prediction?.app
    || status?.latest_snapshot?.current_app
    || mappedHistory[0]?.app
    || "Monitoring"
  ).replace(/\.exe$/i, "");
  const currentTask = tasks.find((task) => task?.status === "active")?.subject
    || (isWarmup ? "Collecting focus data" : "No active task");
  const heroMessage = isWarmup
    ? `The dashboard is warming up. ${snapshotsRemaining} snapshot${snapshotsRemaining === 1 ? "" : "s"} left, about ${warmupLabel} remaining before live analytics stabilise.`
    : isDistracted
      ? "Close the distracting app and restart your study block."
      : "Stay with this task a little longer before switching.";
  const category = isWarmup ? "Warming up" : isDistracted ? "Distracting" : "Study-related";
  const suggestion = isWarmup
    ? "Keep the agent running and stay on your study task while the first 10-minute window fills."
    : isDistracted
      ? "Return to your study task now. Silence notifications and start a 5-minute recovery sprint."
      : "Continue this session for 20 more minutes while your attention is stable.";

  // ── computed session stats ───────────────────────────────────────
  const focusedSessions   = fullMappedHistory.filter(h => h.status === "Focused").length;
  const distractedSessions = fullMappedHistory.filter(h => h.status === "Distracted").length;
  const studyMinutes = focusedSessions;
  const completedTasks = tasks.filter((task) => task?.status === "completed").length;
  const focusMinutes = focusedSessions;
  const longestStreakValue = useMemo(() => {
    let best = 0;
    let current = 0;
    fullMappedHistory
      .forEach((item) => {
        if (item.status === "Focused") {
          current += 1;
          best = Math.max(best, current);
        } else {
          current = 0;
        }
      });
    return best;
  }, [fullMappedHistory]);
  const longestStreak = `${longestStreakValue} min`;

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
        hours: Number((((d.study_minutes ?? 0) / 60)).toFixed(1)),
      }));
    }
    return [
      { day: "Mon", hours: 0 }, { day: "Tue", hours: 0 },
      { day: "Wed", hours: 0 }, { day: "Thu", hours: 0 },
      { day: "Fri", hours: 0 }, { day: "Sat", hours: 0 },
      { day: "Sun", hours: 0 },
    ];
  }, [analytics]);

  // ── real suggestions from analytics (or static fallback) ─────────
  const suggestions = useMemo(() => {
    if (isWarmup) {
      return [
        {
          title: "Live analytics are warming up",
          message: `Keep the agent running for ${warmupLabel} more to fill the first prediction window.`,
          type: "scheduling",
        },
      ];
    }
    const raw = analytics?.suggestions;
    if (raw?.length) {
      return raw.map(s => ({ title: s.title, message: s.message, type: s.type }));
    }
    return STATIC_SUGGESTIONS;
  }, [analytics, isWarmup, warmupLabel]);

  // ── study goal from analytics weekly_summary ─────────────────────
  const goalMinutes = 180;
  const completedMinutes = useMemo(() => {
    const wh = analytics?.weekly_summary?.total_study_hours;
    if (typeof wh === "number") return Math.min(goalMinutes, Math.round(wh * 60));
    return Math.min(goalMinutes, studyMinutes);
  }, [analytics, studyMinutes]);

  const mostUsedApp = useMemo(() => {
    if (!fullMappedHistory.length) return "No app yet";
    const counts = fullMappedHistory.reduce((acc, h) => { acc[h.app] = (acc[h.app] || 0) + 1; return acc; }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || currentApp;
  }, [currentApp, fullMappedHistory]);

  const usageData = useMemo(() => ([
    {
      name: "Study apps",
      value: Math.max(0, focusedSessions),
      display: `${focusedSessions}m`,
      color: "#34d399",
    },
    {
      name: "Distracting apps",
      value: Math.max(0, distractedSessions),
      display: `${distractedSessions}m`,
      color: "#fb7185",
    },
    {
      name: "Warm-up left",
      value: Math.max(0, snapshotsRemaining),
      display: isWarmup ? warmupLabel : "0:00",
      color: "#8b5cf6",
    },
  ]), [distractedSessions, focusedSessions, isWarmup, snapshotsRemaining, warmupLabel]);

  const nextPlannerTask = useMemo(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return null;

    const queued = tasks
      .filter((task) => ["active", "pending", "rescheduled"].includes(task?.status))
      .sort(sortTasksByStartTime);

    return queued[0] || null;
  }, [tasks]);

  const studentName = user?.name || user?.full_name || user?.username || user?.email?.split("@")?.[0] || "Student";
  const hasPredictionData = prediction != null;
  const hasHistoryData = Array.isArray(history) && history.length > 0;
  const hasTaskData = Array.isArray(tasks) && tasks.length > 0;
  const hasAnalyticsData = Boolean(
    analytics?.daily_trends?.length ||
    analytics?.suggestions?.length ||
    analytics?.weekly_summary
  );
  const isDashboardEmpty = !hasPredictionData && !hasHistoryData && !hasTaskData && !hasAnalyticsData;

  const handleLogout = async () => {
    try { await logout(); } finally { navigate("/login"); }
  };

  return (
    <div className="flex min-h-screen bg-[#040816] text-white">
      <Sidebar active="Dashboard" />

      <main className="min-h-screen flex-1 overflow-y-auto">
        {/* ── header ── */}
        <header className="sticky top-0 z-20 bg-[#02050d]/96 backdrop-blur-xl"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="font-serif text-lg tracking-[0.02em] text-white lg:text-[1.55rem]">Hi, {studentName}</div>
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
                    ? { background: "#34d39910", boxShadow: "inset 0 1px 0 #34d39918", color: "#6ee7b7" }
                    : { background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}
                >
                  {connected
                    ? <><motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }}><Wifi size={15} /></motion.div> Live session active</>
                    : <><WifiOff size={15} /> Waiting for live session</>}
                </motion.div>
              </AnimatePresence>

              {/* profile */}
              <div
                className="flex items-center gap-4 rounded-full px-4 py-2"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
                  boxShadow: "0 10px 24px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.08)",
                }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#22d3ee)" }}>
                  {studentName.slice(0, 2).toUpperCase()}
                </div>
                <div className="h-8 w-px bg-white/8" />
                <motion.button
                  type="button"
                  onClick={handleLogout}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                >
                  <LogOut size={15} />
                  Logout
                </motion.button>
              </div>
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
            score={isDashboardEmpty ? 0 : livePredictionConfidence}
            scoreLabel="Prediction Confidence"
            isDistracted={isDistracted}
            currentTask={isDashboardEmpty ? "No task yet" : currentTask}
            focusMinutes={isDashboardEmpty ? 0 : focusMinutes}
            message={isDashboardEmpty ? `Waiting for live snapshots. ${warmupLabel} remaining in the initial collection window.` : heroMessage}
            isEmpty={isDashboardEmpty}
          />

          <MotivationPanel
            streakDays={streakDays}
            badge={badge}
            badgeDesc={badgeDesc}
            goalMinutes={goalMinutes}
            completedMinutes={completedMinutes}
            isEmpty={isDashboardEmpty}
          />

          <NextTaskCard task={nextPlannerTask} onOpenPlanner={() => navigate("/planner")} />

          {/* summary 4-up */}
          <motion.div variants={staggerInner()} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Study time" value={isDashboardEmpty ? "0m" : `${studyMinutes}m`} subtext={isDashboardEmpty ? `Warm-up ${warmupLabel} remaining` : "Focused work today"} icon={AlarmClock} tint="#8b5cf6" isEmpty={isDashboardEmpty} />
            <MetricCard label="Distractions" value={isDashboardEmpty ? 0 : distractedSessions} subtext={isDashboardEmpty ? "No signals yet" : "Attention breaks"} icon={ShieldBan} tint="#fb7185" isEmpty={isDashboardEmpty} />
            <MetricCard label="Best streak" value={isDashboardEmpty ? "0 min" : longestStreak} subtext={isDashboardEmpty ? "No sessions yet" : "Longest session"} icon={Flame} tint="#f59e0b" isEmpty={isDashboardEmpty} />
            <MetricCard label="Tasks done" value={isDashboardEmpty ? 0 : completedTasks} subtext={isDashboardEmpty ? "No completed blocks" : "Completed blocks"} icon={CheckCheck} tint="#34d399" isEmpty={isDashboardEmpty} />
          </motion.div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <UsageInsights usageData={usageData} mostUsedApp={isDashboardEmpty ? "No app yet" : mostUsedApp} isEmpty={isDashboardEmpty} />
            <WeeklyPattern data={weeklyPattern} isEmpty={isDashboardEmpty} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <FocusHistory items={isDashboardEmpty ? [] : mappedHistory} isEmpty={isDashboardEmpty} />
            <SuggestionsPanel suggestions={isDashboardEmpty ? [] : suggestions} isEmpty={isDashboardEmpty} />
          </div>
        </motion.div>

        <Footer />
      </main>
    </div>
  );
}
