// frontend/src/pages/Dashboard.jsx  ── COMPLETE REPLACEMENT ──────────────────

import React, { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion, useMotionValue, useSpring, useInView,
} from "framer-motion";
import {
  AlarmClock, BrainCircuit, CheckCheck, Coffee, Flame,
  Layers3, LogOut, ScanSearch, MessageSquareOff, ShieldBan,
  TrendingUp, Wifi, WifiOff,
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
import { sortTasksByStartTime } from "./planner/plannerUtils";

// ─── animation presets ────────────────────────────────────────────────────────
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

// ─── animated counter ─────────────────────────────────────────────────────────
function AnimNumber({ value, suffix = "", decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 70, damping: 16 });
  const [display, setDisplay] = useState(0);
  useEffect(() => { if (inView) mv.set(parseFloat(value) || 0); }, [inView, mv, value]);
  useEffect(() => spring.on("change", (v) => setDisplay(v)), [spring]);
  return <span ref={ref}>{display.toFixed(decimals)}{suffix}</span>;
}

// ─── animated glow bar ────────────────────────────────────────────────────────
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

// ─── card primitives ──────────────────────────────────────────────────────────
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

// ─── hero focus card ──────────────────────────────────────────────────────────
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
        {Icon && (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: `${c.from}12`, boxShadow: `inset 0 1px 0 ${c.from}18, 0 10px 20px rgba(0,0,0,0.14)` }}
          >
            <Icon size={15} style={{ color: c.text }} />
          </div>
        )}
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
  const gradient = isDistracted ? "linear-gradient(135deg,#fb7185,#f97316)" : "linear-gradient(135deg,#34d399,#22d3ee)";
  return (
    <SectionCard className="overflow-hidden" glow={accent}>
      <div className="grid gap-6 p-6 lg:grid-cols-[1.45fr_0.9fr] lg:p-8">
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
            <SmallMetric label="Current Task" value={currentTask}           tone="violet" />
            <SmallMetric label={scoreLabel}   value={`${score}%`}           tone={isDistracted ? "amber" : "emerald"} />
            <SmallMetric label="Focused Time" value={`${focusMinutes} min`} tone="violet" />
          </div>
        </div>
        <div className="flex items-center justify-center lg:justify-end">
          <div
            className="relative flex h-[18rem] w-[18rem] items-center justify-center rounded-[34px] bg-slate-950/68 lg:h-[20rem] lg:w-[20rem]"
            style={{ boxShadow: `0 0 40px ${accent}14, 0 22px 50px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.05)` }}
          >
            <motion.div
              className="absolute inset-6 rounded-full"
              initial={{ opacity: 0 }}
              animate={isEmpty ? { opacity: [0.45, 0.8, 0.45], rotate: 360 } : { opacity: 1 }}
              transition={isEmpty ? { duration: 8, repeat: Infinity, ease: "linear" } : { duration: 0.8 }}
              style={{ background: `conic-gradient(${accent} ${score}%, rgba(255,255,255,0.05) ${score}% 100%)` }}
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
                style={{ background: `${accent}14`, boxShadow: `0 0 14px ${accent}18, inset 0 1px 0 ${accent}24`, color: accent }}
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

// ─── guidance card ─────────────────────────────────────────────────────────
function GuidanceCard({ currentApp, isDistracted, suggestion, category }) {
  const accent = isDistracted ? "#fb7185" : "#22d3ee";
  return (
    <SectionCard className="p-5 lg:p-6">
      <SectionHeading title="Guidance" />
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          <InnerCell className="p-4" style={{ background: "linear-gradient(180deg,rgba(7,12,24,0.96),rgba(5,9,18,0.98))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">App</p>
            <p className="mt-3 font-serif text-2xl text-white">{currentApp}</p>
          </InnerCell>
          <InnerCell className="p-4" style={{ background: "linear-gradient(180deg,rgba(7,12,24,0.96),rgba(5,9,18,0.98))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
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
          style={{ background: `linear-gradient(135deg,rgba(10,18,34,0.98) 0%,${accent}0f 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 32px ${accent}0a` }}
        >
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Next</p>
          <p className="mt-3 max-w-2xl font-serif text-lg leading-tight text-white lg:text-[1.45rem]">{suggestion}</p>
          <p className="mt-2 max-w-xl text-xs leading-6 text-slate-300 lg:text-sm">
            {isDistracted ? "Pause distractions and return to study." : "Stay on this task and avoid switching apps."}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── metric cards ──────────────────────────────────────────────────────────
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
          style={{ background: `${tint}10`, boxShadow: `inset 0 1px 0 ${tint}18, 0 10px 24px rgba(0,0,0,0.18)` }}
        >
          <Icon size={16} style={{ color: tint }} />
        </motion.div>
      </div>
    </SectionCard>
  );
}

// ─── usage pie ────────────────────────────────────────────────────────────
function UsageLegend({ color, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-[#060b16]" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
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
    <div className="rounded-2xl px-4 py-3" style={{ background: "#08101f", boxShadow: "0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)" }}>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="mt-1 text-sm text-cyan-200">{payload[0].value} hrs</p>
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
          <div className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg,#22d3ee0e,#22d3ee04)", boxShadow: "inset 0 1px 0 #22d3ee22, 0 0 30px #22d3ee0a" }}>
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/60">Most used</p>
            <p className="mt-2 font-serif text-[1.4rem] text-white">{mostUsedApp}</p>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── focus history ────────────────────────────────────────────────────────
function FocusHistory({ items, isEmpty = false }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading title="Recent Sessions" />
      <motion.div variants={staggerInner(0.1)} initial="hidden" animate="show" className="mt-5 space-y-3">
        {(items.length ? items.slice(0, 5) : Array.from({ length: 5 }, (_, i) => ({
          time: "--:--", app: "Waiting for your first session",
          status: "Pending", score: 0, empty: true, key: i,
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
              <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full" style={{ background: accent }} />
              <div className="flex items-center gap-4 pl-2">
                <div className="rounded-2xl px-4 py-2 text-sm text-slate-200 flex-shrink-0 tabular-nums" style={{ background: "rgba(255,255,255,0.05)" }}>
                  {item.time}
                </div>
                <div className="font-serif text-[1.02rem] text-white lg:text-[1.08rem]">{item.app}</div>
              </div>
              <div className="flex items-center gap-3 pl-2 md:pl-0">
                <span className="rounded-full px-4 py-1.5 text-xs font-medium" style={{ background: `${accent}12`, color: accent }}>
                  {item.empty ? "Pending" : item.status}
                </span>
                <div className="rounded-2xl px-4 py-2 text-sm text-white" style={{ background: "rgba(255,255,255,0.05)" }}>
                  {item.empty ? "No data" : `${item.scoreLabel || "Confidence"} ${item.scoreText || `${item.score}%`}`}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </SectionCard>
  );
}

// ─── suggestions ──────────────────────────────────────────────────────────
function SuggestionRow({ title, message, type }) {
  const iconMap = {
    distraction:  { Icon: MessageSquareOff, tint: "#fb7185" },
    scheduling:   { Icon: BrainCircuit,     tint: "#8b5cf6" },
    study_time:   { Icon: Coffee,           tint: "#34d399" },
    trend_alert:  { Icon: TrendingUp,       tint: "#f59e0b" },
    missed_tasks: { Icon: ShieldBan,        tint: "#f59e0b" },
    balance:      { Icon: CheckCheck,       tint: "#34d399" },
  };
  const { Icon, tint } = iconMap[type] || { Icon: BrainCircuit, tint: "#8b5cf6" };
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ x: 2, transition: { duration: 0.2 } }}
      className="flex items-start gap-4 rounded-2xl bg-[#060b16] p-4"
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}
    >
      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl" style={{ background: `${tint}10`, boxShadow: `inset 0 1px 0 ${tint}18` }}>
        <Icon size={16} style={{ color: tint }} />
      </div>
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="mt-1 text-sm text-slate-500">{message}</div>
      </div>
    </motion.div>
  );
}

function SuggestionsPanel({ suggestions }) {
  return (
    <SectionCard className="p-6 lg:p-7">
      <SectionHeading title="Suggestions" subtitle="A few smart adjustments." />
      <motion.div variants={staggerInner(0.1)} initial="hidden" animate="show" className="mt-6 space-y-2">
        {(suggestions.length ? suggestions : [
          { title: "Suggestions will appear here", message: "Start a session to unlock personalized guidance.", type: "scheduling" },
          { title: "Track your first study block", message: "Your dashboard learns from activity across the day.", type: "study_time" },
        ]).map((s, i) => (
          <SuggestionRow key={i} title={s.title} message={s.message || s.text || ""} type={s.type} />
        ))}
      </motion.div>
    </SectionCard>
  );
}

// ─── motivation / streak ──────────────────────────────────────────────────
function GoalProgress({ label, value, max }) {
  const pct = Math.max(0, Math.min(100, Math.round((value / Math.max(1, max)) * 100)));
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
        <div className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg,#d9770612,#ea580c08)", boxShadow: "inset 0 1px 0 #d9770622" }}>
          <span className="text-[10px] uppercase tracking-[0.18em] text-amber-200/80">Focus streak</span>
          <div className="mt-4 text-4xl font-semibold text-white"><AnimNumber value={streakDays} /> days</div>
          <p className="mt-2 text-sm text-slate-500">{isEmpty ? "Start today to build your streak." : "Keep the run going tomorrow."}</p>
        </div>
        <div className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg,#7c3aed12,#4f46e508)", boxShadow: "inset 0 1px 0 #7c3aed22" }}>
          <span className="text-[10px] uppercase tracking-[0.18em] text-violet-200/80">Achievement</span>
          <div className="mt-4 font-serif text-[1.35rem] text-white">{badge || "First Focus"}</div>
          <p className="mt-2 text-sm text-slate-500">{badgeDesc || "Complete focused sessions to earn achievements."}</p>
        </div>
        <div className="rounded-3xl p-5" style={{ background: "linear-gradient(135deg,#05966910,#0d948806)", boxShadow: "inset 0 1px 0 #05966922" }}>
          <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-200/80">Daily goal</span>
          <div className="mt-4 space-y-3">
            <GoalProgress label={`${completedMinutes} of ${goalMinutes} min`} value={completedMinutes} max={goalMinutes} />
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── weekly pattern bar chart ─────────────────────────────────────────────
function WeeklyPattern({ data, isEmpty = false }) {
  if (isEmpty) {
    return (
      <SectionCard className="p-6 lg:p-7">
        <SectionHeading title="Weekly Pattern" subtitle="Study hours per day." />
        <div className="mt-5 flex h-64 items-center justify-center rounded-[24px] bg-[#060b16]">
          <motion.div className="text-center" animate={{ opacity: [0.45, 0.95, 0.45], y: [0, -3, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">No data yet</div>
            <div className="mt-3 font-serif text-2xl text-white">No study pattern</div>
            <div className="mt-2 text-sm text-slate-500">Complete a few sessions to unlock your weekly hours.</div>
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

// ─── next task card ────────────────────────────────────────────────────────
function formatTaskTime(task) {
  if (task?.planned_start) {
    const d = new Date(task.planned_start);
    if (!Number.isNaN(d.getTime())) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
          {task.notes && <p className="mt-3 max-w-xl text-sm text-slate-500">{task.notes}</p>}
        </div>
        <motion.button type="button" onClick={onOpenPlanner} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100">
          Open Planner
        </motion.button>
      </div>
    </SectionCard>
  );
}

// ─── empty state ───────────────────────────────────────────────────────────
function DashboardEmptyState({ onOpenPlanner }) {
  return (
    <SectionCard className="overflow-hidden p-6 lg:p-8">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div className="relative">
          <div className="absolute -left-10 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute left-28 top-24 h-32 w-32 rounded-full bg-violet-500/10 blur-3xl" />
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="relative">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Dashboard waiting</p>
            <h1 className="mt-3 max-w-xl font-serif text-[2rem] leading-[1.02] text-white lg:text-[3rem]">
              Your study dashboard will light up as soon as activity starts.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-400 lg:text-base">
              Add a task in Adaptive Planner or begin a study session to unlock focus trends, recent sessions, and personalized suggestions.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <motion.button type="button" onClick={onOpenPlanner} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-100">
                Open Planner
              </motion.button>
              <div className="rounded-full bg-white/5 px-4 py-2.5 text-sm text-slate-300">No study data yet</div>
            </div>
          </motion.div>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="relative h-[18rem] w-[18rem] lg:h-[21rem] lg:w-[21rem]">
            <motion.div className="absolute inset-0 rounded-full border border-white/6" animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: "linear" }} />
            <motion.div className="absolute inset-5 rounded-full border border-cyan-400/18" animate={{ rotate: -360 }} transition={{ duration: 18, repeat: Infinity, ease: "linear" }} />
            <motion.div className="absolute inset-10 rounded-full border border-violet-400/16" animate={{ rotate: 360 }} transition={{ duration: 14, repeat: Infinity, ease: "linear" }} />
            <div className="absolute inset-[4.6rem] rounded-full bg-[#060b16]" />
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
          <motion.div key={label} className="rounded-[24px] bg-[#060b16] p-5" style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}
            animate={{ y: [0, -4, 0], opacity: [0.72, 1, 0.72] }} transition={{ duration: 3.6, delay: index * 0.25, repeat: Infinity, ease: "easeInOut" }}>
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

// ─── planner data hook ────────────────────────────────────────────────────
// Uses RELATIVE paths so the Vite proxy forwards /api → 127.0.0.1:5000
function usePlannerData() {
  const [analytics, setAnalytics] = useState(null);
  const [streakInfo, setStreakInfo] = useState(null);
  const [tasks, setTasks]         = useState([]);

  const load = useCallback(async () => {
    try {
      const [aRes, tRes] = await Promise.all([
        fetch("/api/planner/analytics"),
        fetch("/api/planner/tasks"),
      ]);
      if (aRes.ok) setAnalytics(await aRes.json());
      if (tRes.ok) {
        const d = await tRes.json();
        if (d.streak_info) setStreakInfo(d.streak_info);
        setTasks(Array.isArray(d.tasks) ? d.tasks : []);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  return { analytics, streakInfo, tasks };
}

// ─── main Dashboard ────────────────────────────────────────────────────────
export default function Dashboard() {
  useTheme();
  const navigate    = useNavigate();
  const { user, logout } = useAuth();

  // useAgent polls GET /api/status every 4 s
  // status.prediction = { final_prob, prediction (0/1), feedback, ... }
  // status.blocker    = { is_blocking, is_admin, ... }
  // history items     = { timestamp, dominant_app, is_distracted, final_prob, label, ... }
  const { connected, prediction, history = [], status } = useAgent(4000);
  const { analytics, streakInfo, tasks } = usePlannerData();

  // ── fallback history rows (shown until real data arrives) ───────────────
  const fallbackHistory = useMemo(() => [
    { time: "09:10 AM", app: "Chrome",           status: "Focused",    score: 87 },
    { time: "10:05 AM", app: "WhatsApp Desktop",  status: "Distracted", score: 43 },
    { time: "11:30 AM", app: "VS Code",           status: "Focused",    score: 91 },
    { time: "01:20 PM", app: "YouTube",           status: "Distracted", score: 38 },
  ], []);

  // ── map backend history items to UI rows ────────────────────────────────
  // Backend GET /api/history returns array of snapshot dicts:
  //   { timestamp, dominant_app, is_distracted, final_prob, label, ... }
  const mappedHistory = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return fallbackHistory;
    return history.slice(-6).reverse().map((item, i) => {
      const ts   = item.timestamp ? new Date(item.timestamp) : null;
      const time = ts && !Number.isNaN(ts.getTime())
        ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "--:--";

      // dominant_app is the field the backend stores
      const app  = item.dominant_app || item.app_name || item.active_app || item.app || "Unknown";

      const distracted = Boolean(
        item.is_distracted === true
        || item.distracted === true
        || item.prediction === 1
        || item.label === "DISTRACTED"
        || (typeof item.final_prob === "number" && item.final_prob >= 0.5)
      );

      // final_prob is distraction probability (0–1); focus score = 1 – final_prob
      const rawProb = typeof item.final_prob === "number" ? item.final_prob
                    : typeof item.probability === "number" ? item.probability
                    : distracted ? 0.75 : 0.2;
      const score = Math.max(
        0,
        Math.min(100, Math.round((distracted ? rawProb : 1 - rawProb) * 100)),
      );

      return {
        time,
        app,
        status: distracted ? "Distracted" : "Focused",
        score,
        scoreLabel: "Confidence",
        scoreText: `${score}%`,
      };
    });
  }, [history, fallbackHistory]);

  // ── live focus score from agent prediction ──────────────────────────────
  // prediction = status?.prediction → { final_prob, prediction (0/1), feedback, ... }
  const liveFinalProb =
    typeof prediction?.probability === "number"
      ? prediction.probability
      : typeof prediction?.final_prob === "number"
        ? prediction.final_prob
        : null;
  const liveIsDistracted = prediction
    ? Boolean(
        prediction.is_distracted
        || prediction.prediction === 1
        || prediction.label === "DISTRACTED"
      )
    : false;
  const liveConfidenceScore = liveFinalProb !== null
    ? Math.max(
      0,
      Math.min(100, Math.round((liveIsDistracted ? liveFinalProb : 1 - liveFinalProb) * 100)),
    )
    : 0;

  // ── current app from latest status snapshot ─────────────────────────────
  // status?.latest_snapshot?.dominant_app  OR  status?.window_current
  const currentApp = status?.latest_snapshot?.current_app
    || status?.latest_snapshot?.dominant_app
    || status?.current_app
    || (history.length > 0 ? (history[history.length - 1]?.dominant_app || "Monitoring") : "Monitoring");

  // ── feedback / suggestion text from prediction ───────────────────────────
  const feedbackMessage = prediction?.feedback?.message
    || prediction?.message
    || (liveIsDistracted
      ? "You appear distracted. Close unneeded apps and return to your study material."
      : connected
        ? "Your current focus level looks healthy. Keep your study session going."
        : "Connect the desktop agent to start monitoring your focus in real time.");

  const suggestionText = prediction?.feedback?.suggestion
    || prediction?.suggestion
    || (liveIsDistracted ? "Switch back to your study app." : "Maintain your current workflow.");

  const contentCategory = prediction?.content_label
    || prediction?.label
    || (liveIsDistracted ? "Distracted" : "Focused");

  // ── focused minutes from today's history ────────────────────────────────
  const focusedMinutes = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return 0;
    // Each snapshot is taken ~every few seconds; assume 5 s per snapshot
    const focusedSnaps = history.filter((h) => !Boolean(
      h.is_distracted === true
      || h.distracted === true
      || h.prediction === 1
      || h.label === "DISTRACTED"
      || (typeof h.final_prob === "number" && h.final_prob >= 0.5)
    ));
    return Math.round((focusedSnaps.length * 5) / 60);
  }, [history]);

  // ── distraction count from today's history ──────────────────────────────
  const distractionCount = useMemo(() => {
    if (!Array.isArray(history)) return 0;
    return history.filter((h) => Boolean(
      h.is_distracted === true
      || h.distracted === true
      || h.prediction === 1
      || h.label === "DISTRACTED"
      || (typeof h.final_prob === "number" && h.final_prob >= 0.5)
    )).length;
  }, [history]);

  // ── streak from planner ─────────────────────────────────────────────────
  const currentStreak  = streakInfo?.current_streak  || 0;
  const focusRate      = streakInfo ? Math.round(streakInfo.focus_rate || 0) : 0;
  const badges         = streakInfo?.badges || [];
  const latestBadge    = badges.length > 0 ? badges[badges.length - 1] : null;
  const badgeName      = latestBadge?.name  || latestBadge || "First Focus";
  const badgeDesc      = latestBadge?.description || "Complete focused sessions to earn achievements.";

  // ── task counts ─────────────────────────────────────────────────────────
  const completedCount  = tasks.filter((t) => t.status === "completed").length;
  const totalTaskCount  = tasks.length;

  // ── planner suggestions ──────────────────────────────────────────────────
  const plannerSuggestions = useMemo(() => {
    const raw = analytics?.suggestions || [];
    return raw.slice(0, 4);
  }, [analytics]);

  // ── usage pie data ───────────────────────────────────────────────────────
  // Built from today's history: group by dominant_app, count snapshots
  const usageData = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) {
      return [
        { name: "Study apps",   value: 60, display: "–", color: "#22d3ee" },
        { name: "Social media", value: 25, display: "–", color: "#f97316" },
        { name: "Other",        value: 15, display: "–", color: "#6366f1" },
      ];
    }
    const appCounts = {};
    history.forEach((h) => {
      const app = h.dominant_app || h.app_name || "Other";
      appCounts[app] = (appCounts[app] || 0) + 1;
    });
    const sorted = Object.entries(appCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const colors  = ["#22d3ee", "#f97316", "#6366f1", "#34d399"];
    return sorted.map(([name, count], i) => ({
      name,
      value:   count,
      display: `${Math.round((count / history.length) * 100)}%`,
      color:   colors[i] || "#64748b",
    }));
  }, [history]);

  const mostUsedApp = usageData[0]?.name || "—";

  // ── weekly pattern chart ─────────────────────────────────────────────────
  // analytics.daily_trends = [{ date, study_minutes, completion_rate }, ...]
  const weeklyData = useMemo(() => {
    const trends = analytics?.daily_trends;
    if (!Array.isArray(trends) || trends.length === 0) return [];
    return trends.slice(-7).map((d) => ({
      day:   new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
      hours: parseFloat((d.study_minutes / 60).toFixed(1)),
    }));
  }, [analytics]);

  // ── daily goal: target 2 hours (120 min), actual from planner tasks ──────
  const goalMinutes      = 120;
  const completedMinutes = useMemo(() => {
    return tasks
      .filter((t) => t.status === "completed")
      .reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
  }, [tasks]);

  // ── next pending/active task ─────────────────────────────────────────────
  const nextTask = useMemo(() => {
    const candidates = [...tasks]
      .filter((t) => t.status === "active" || t.status === "pending" || t.status === "rescheduled")
      .sort(sortTasksByStartTime);
    return candidates[0] || null;
  }, [tasks]);

  // ── isEmpty: no real data yet ─────────────────────────────────────────────
  const isEmpty = !connected && history.length === 0 && tasks.length === 0;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Sidebar active="Dashboard" />

      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {/* ── header ──────────────────────────────────────────────────── */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-4 lg:px-8"
          style={{
            background: "rgba(8,10,15,0.80)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-slate-500">Overview</p>
            <h1 className="text-lg font-black tracking-tight leading-none text-white mt-0.5">Dashboard</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* agent connection status */}
            <div
              className="flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{
                background: connected ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${connected ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
              }}
            >
              {connected
                ? <Wifi size={12} style={{ color: "#34d399" }} />
                : <WifiOff size={12} style={{ color: "#fb7185" }} />}
              <span className="text-[11px] font-bold" style={{ color: connected ? "#34d399" : "#fb7185" }}>
                {connected ? "Agent connected" : "Agent offline"}
              </span>
            </div>

            {/* user greeting */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center text-[11px] font-bold text-violet-300">
                  {(user.name || user.email || "U")[0].toUpperCase()}
                </div>
                <span className="text-[12px] font-medium text-slate-300">{user.name || user.email}</span>
              </div>
            )}

            {/* logout */}
            <button
              onClick={async () => { await logout(); navigate("/login"); }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:text-white"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <LogOut size={12} />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </header>

        {/* ── page body ────────────────────────────────────────────────── */}
        <motion.div
          variants={staggerPage}
          initial="hidden"
          animate="show"
          className="flex-1 space-y-5 px-6 py-6 lg:px-8 pb-8"
        >
          {isEmpty ? (
            <DashboardEmptyState onOpenPlanner={() => navigate("/planner")} />
          ) : (
            <>
              {/* Hero focus card — live data from agent */}
              <HeroFocusCard
                score={liveConfidenceScore}
                scoreLabel="Prediction Confidence"
                isDistracted={liveIsDistracted}
                currentTask={nextTask?.subject || (tasks.find((t) => t.status === "active")?.subject) || "No active task"}
                focusMinutes={focusedMinutes}
                message={feedbackMessage}
                isEmpty={!connected && history.length === 0}
              />

              {/* Next task shortcut */}
              <NextTaskCard task={nextTask} onOpenPlanner={() => navigate("/planner")} />

              {/* Guidance card — current app + suggestion */}
              <GuidanceCard
                currentApp={currentApp}
                isDistracted={liveIsDistracted}
                suggestion={suggestionText}
                category={contentCategory}
              />

              {/* 4 metric tiles */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Study time"
                  value={`${Math.floor(focusedMinutes / 60)}h ${focusedMinutes % 60}m`}
                  subtext="focused today"
                  icon={AlarmClock}
                  tint="#22d3ee"
                  isEmpty={history.length === 0}
                />
                <MetricCard
                  label="Distractions"
                  value={distractionCount}
                  subtext="detected today"
                  icon={ShieldBan}
                  tint="#fb7185"
                  isEmpty={history.length === 0}
                />
                <MetricCard
                  label="Streak"
                  value={`${currentStreak}d`}
                  subtext={`${focusRate}% focus rate`}
                  icon={Flame}
                  tint="#f59e0b"
                  isEmpty={tasks.length === 0}
                />
                <MetricCard
                  label="Tasks done"
                  value={`${completedCount}/${totalTaskCount}`}
                  subtext="today's planner"
                  icon={CheckCheck}
                  tint="#34d399"
                  isEmpty={tasks.length === 0}
                />
              </div>

              {/* Usage pie + Focus history side by side */}
              <div className="grid gap-5 lg:grid-cols-2">
                <UsageInsights
                  usageData={usageData}
                  mostUsedApp={mostUsedApp}
                  isEmpty={history.length === 0}
                />
                <FocusHistory items={mappedHistory} isEmpty={history.length === 0} />
              </div>

              {/* Suggestions from planner analytics */}
              <SuggestionsPanel suggestions={plannerSuggestions} />

              {/* Momentum: streak + badge + goal */}
              <MotivationPanel
                streakDays={currentStreak}
                badge={badgeName}
                badgeDesc={badgeDesc}
                goalMinutes={goalMinutes}
                completedMinutes={completedMinutes}
                isEmpty={tasks.length === 0}
              />

              {/* Weekly pattern from planner analytics */}
              <WeeklyPattern data={weeklyData} isEmpty={weeklyData.length === 0} />
            </>
          )}
        </motion.div>

        <Footer />
      </main>
    </div>
  );
}
