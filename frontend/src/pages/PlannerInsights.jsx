/**
 * PlannerInsights.jsx  —  Pro Max edition
 * Live data from three backend endpoints:
 *   /api/planner/analytics   → weekly summary, daily trends, study/distraction ratio, suggestions
 *   /api/planner/profile     → peak hours, best days, subject performance
 *   /api/planner/smart-schedule → recommended task slots
 *
 * Animated with framer-motion v12:
 *   • Staggered card entrance  • Smooth collapsible height
 *   • Animated progress bars   • Hover glow on cards
 *   • Number counter spring    • Sparkline bar cascade
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  motion, AnimatePresence, useMotionValue, useSpring, useInView,
} from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, Clock, BookOpen,
  BarChart3, Zap, AlertTriangle, CheckCircle, Calendar,
  Star, Target, Brain, ChevronDown, ChevronUp, RefreshCw,
} from "lucide-react";
import { getPlannerApiUrl } from "./planner/plannerUtils";

// ─── animation presets ────────────────────────────────────────────
const EASE_OUT = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.5, ease: EASE_OUT } },
};

const stagger = (delay = 0) => ({
  hidden: {},
  show:   { transition: { staggerChildren: 0.08, delayChildren: delay } },
});

// ─── animated number counter ─────────────────────────────────────
function AnimNumber({ value, suffix = "", className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 80, damping: 18 });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (inView) mv.set(parseFloat(value) || 0);
  }, [inView, mv, value]);

  useEffect(() => spring.on("change", (v) => setDisplay(v)), [spring]);

  const raw = parseFloat(value);
  const formatted = Number.isInteger(raw)
    ? Math.round(display).toString()
    : display.toFixed(1);

  return (
    <span ref={ref} className={className}>
      {formatted}{suffix}
    </span>
  );
}

// ─── animated progress bar ───────────────────────────────────────
function MiniBar({ pct, color, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  return (
    <div ref={ref} className="h-1.5 rounded-full overflow-hidden bg-white/8">
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={inView ? { width: `${Math.min(100, Math.max(0, pct))}%` } : { width: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT, delay }}
      />
    </div>
  );
}

// ─── glass card ──────────────────────────────────────────────────
function Card({ children, className = "", glow }) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ scale: 1.008, transition: { duration: 0.2 } }}
      className={`relative rounded-[28px] border border-white/8 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-sm overflow-hidden ${className}`}
    >
      {glow && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ boxShadow: `inset 0 0 40px ${glow}18` }}
        />
      )}
      {children}
    </motion.div>
  );
}

// smaller inner card
function InnerCard({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-slate-950/60 ${className}`}>
      {children}
    </div>
  );
}

// ─── stat pill ───────────────────────────────────────────────────
function StatPill({ label, value, color = "#818cf8", numericValue, suffix = "" }) {
  return (
    <motion.div variants={fadeUp}>
      <InnerCard className="flex flex-col items-center justify-center px-3 py-3 flex-1 min-w-0">
        <span className="text-base font-black tabular-nums leading-none" style={{ color }}>
          {numericValue != null
            ? <AnimNumber value={numericValue} suffix={suffix} />
            : value}
        </span>
        <span className="text-[10px] font-medium mt-1 text-center leading-tight text-slate-500 uppercase tracking-[0.18em]">
          {label}
        </span>
      </InnerCard>
    </motion.div>
  );
}

// ─── suggestion card ─────────────────────────────────────────────
const SUGGESTION_META = {
  trend_alert:  { icon: TrendingDown, color: "#fb7185" },
  distraction:  { icon: AlertTriangle, color: "#fbbf24" },
  study_time:   { icon: Clock,         color: "#818cf8" },
  balance:      { icon: CheckCircle,   color: "#34d399" },
  missed_tasks: { icon: AlertTriangle, color: "#fbbf24" },
  content:      { icon: Brain,         color: "#c084fc" },
  scheduling:   { icon: Calendar,      color: "#22d3ee" },
  subject:      { icon: BookOpen,      color: "#fbbf24" },
  positive:     { icon: Star,          color: "#34d399" },
  onboarding:   { icon: Zap,           color: "#818cf8" },
};

function SuggestionCard({ suggestion, index }) {
  const meta = SUGGESTION_META[suggestion.type] || SUGGESTION_META.onboarding;
  const Icon = meta.icon;
  const priorityColor =
    suggestion.priority === "high"   ? "#fb7185"
    : suggestion.priority === "medium" ? "#fbbf24"
    : "#34d399";

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ x: 4, transition: { duration: 0.2 } }}
      className="rounded-2xl p-4 flex gap-3 cursor-default"
      style={{ background: `${meta.color}0d`, border: `1px solid ${meta.color}25` }}
    >
      <motion.div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: `${meta.color}1a` }}
        whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.4 } }}
      >
        <Icon className="w-4 h-4" style={{ color: meta.color }} />
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-white">{suggestion.title}</span>
          <span
            className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: `${priorityColor}18`, color: priorityColor }}
          >
            {suggestion.priority}
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-slate-400">{suggestion.message}</p>
      </div>
    </motion.div>
  );
}

// ─── weekly summary ──────────────────────────────────────────────
function WeeklySummary({ summary }) {
  const TrendIcon =
    summary.trend_direction === "improving" ? TrendingUp
    : summary.trend_direction === "declining" ? TrendingDown
    : Minus;
  const trendColor =
    summary.trend_direction === "improving" ? "#34d399"
    : summary.trend_direction === "declining" ? "#fb7185"
    : "#fbbf24";

  return (
    <div className="space-y-4">
      <motion.div variants={stagger()} initial="hidden" animate="show" className="flex flex-wrap gap-2">
        <StatPill label="Study hours" numericValue={summary.total_study_hours}        suffix="h" color="#818cf8" />
        <StatPill label="Completed"   numericValue={summary.total_tasks_completed}              color="#34d399" />
        <StatPill label="Missed"      numericValue={summary.total_tasks_missed}                 color="#fb7185" />
        <StatPill label="Completion"  numericValue={summary.overall_completion_rate}  suffix="%" color="#22d3ee" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5, ease: EASE_OUT }}
        className="flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: `${trendColor}0d`, border: `1px solid ${trendColor}25` }}
      >
        <TrendIcon className="w-4 h-4 flex-shrink-0" style={{ color: trendColor }} />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold capitalize" style={{ color: trendColor }}>
            {summary.trend_direction}
          </span>
          <span className="text-xs ml-2 text-slate-400">
            {summary.trend_delta > 0 ? "+" : ""}{summary.trend_delta}% vs previous period
          </span>
        </div>
        <span className="text-[11px] text-slate-500">{summary.recent_completion_rate}% recent</span>
      </motion.div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Distraction events", value: summary.total_distraction_events,              color: "text-amber-300" },
          { label: "Distraction time",   value: `${Math.round(summary.total_distraction_minutes)}m`, color: "text-rose-300" },
        ].map(({ label, value, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 + i * 0.08, duration: 0.4, ease: EASE_OUT }}
          >
            <InnerCard className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">{label}</p>
              <p className={`text-lg font-semibold ${color}`}>{value}</p>
            </InnerCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── 7-day sparkline ─────────────────────────────────────────────
function DailyTrend({ trends }) {
  if (!trends?.length) return null;
  const max = Math.max(...trends.map((d) => d.study_minutes), 1);

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-3">7-day study minutes</p>
      <div className="flex items-end gap-1.5 h-14">
        {trends.map((day, i) => {
          const pct = (day.study_minutes / max) * 100;
          const dayLabel = new Date(day.date).toLocaleDateString("en-US", { weekday: "short" });
          const isToday = day.date === new Date().toISOString().slice(0, 10);
          const barColor = isToday
            ? "linear-gradient(to top,#818cf8,#a78bfa)"
            : day.completion_rate >= 70
            ? "linear-gradient(to top,#10b981,#34d399)"
            : day.completion_rate >= 40
            ? "linear-gradient(to top,#f59e0b,#fbbf24)"
            : "rgba(255,255,255,0.10)";

          return (
            <div
              key={day.date}
              className="flex flex-col items-center flex-1 gap-1"
              title={`${dayLabel}: ${day.study_minutes}m · ${day.completion_rate}% complete`}
            >
              <div className="flex-1 flex items-end w-full">
                <motion.div
                  className="w-full rounded-t"
                  style={{ background: barColor }}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, pct)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.06, ease: EASE_OUT }}
                />
              </div>
              <span className={`text-[9px] font-medium ${isToday ? "text-violet-400" : "text-slate-600"}`}>
                {dayLabel.slice(0, 1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── study vs distraction ────────────────────────────────────────
function StudyVsDistraction({ ratio }) {
  const rows = [
    { label: "Study",               pct: ratio.study_ratio_pct,        color: "#818cf8" },
    { label: "Distraction",         pct: ratio.distraction_ratio_pct,  color: "#fb7185" },
    { label: "Educational content", pct: ratio.educational_content_pct, color: "#34d399" },
  ];
  return (
    <div className="space-y-4">
      {rows.map(({ label, pct, color }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1, duration: 0.5, ease: EASE_OUT }}
        >
          <div className="flex justify-between mb-1.5">
            <span className="text-[12px] text-slate-300">{label}</span>
            <span className="text-[12px] font-semibold" style={{ color }}>{pct}%</span>
          </div>
          <MiniBar pct={pct} color={color} delay={i * 0.1} />
        </motion.div>
      ))}

      <div className="grid grid-cols-2 gap-2 pt-1">
        {[
          { label: "Study hours",  value: ratio.study_hours,         suffix: "h", color: "text-violet-300" },
          { label: "Distracted",   value: ratio.distraction_minutes, suffix: "m", color: "text-rose-300" },
        ].map(({ label, value, suffix, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4 + i * 0.08, duration: 0.4 }}
          >
            <InnerCard className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 mb-1">{label}</p>
              <p className={`text-lg font-semibold ${color}`}>
                <AnimNumber value={value} suffix={suffix} />
              </p>
            </InnerCard>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── productivity profile ────────────────────────────────────────
function HourBar({ rate, label, index }) {
  const color = rate >= 0.7 ? "#34d399" : rate >= 0.45 ? "#fbbf24" : "#fb7185";
  return (
    <motion.div
      variants={fadeUp}
      className="flex items-center gap-3"
    >
      <span className="text-[11px] font-mono text-slate-500 w-14 flex-shrink-0 text-right">{label}</span>
      <div className="flex-1"><MiniBar pct={rate * 100} color={color} delay={index * 0.06} /></div>
      <span className="text-[11px] font-semibold w-9 text-right flex-shrink-0" style={{ color }}>
        {Math.round(rate * 100)}%
      </span>
    </motion.div>
  );
}

function SubjectRow({ subject, index }) {
  const rate = subject.completion_rate;
  const color = rate >= 0.7 ? "#34d399" : rate >= 0.45 ? "#fbbf24" : "#fb7185";
  return (
    <motion.div variants={fadeUp} className="flex items-center gap-3">
      <span className="text-[12px] text-slate-300 capitalize flex-1 truncate">{subject.subject}</span>
      <div className="w-20 flex-shrink-0"><MiniBar pct={rate * 100} color={color} delay={index * 0.06} /></div>
      <span className="text-[11px] font-semibold w-9 text-right flex-shrink-0" style={{ color }}>
        {Math.round(rate * 100)}%
      </span>
      <span className="text-[10px] text-slate-600 w-10 text-right flex-shrink-0">{subject.total_tasks}t</span>
    </motion.div>
  );
}

function ProductivityProfile({ profile }) {
  if (!profile.has_enough_data) {
    return (
      <InnerCard className="px-4 py-6 text-center">
        <Brain className="w-8 h-8 mx-auto mb-3 text-slate-600" />
        <p className="text-sm text-slate-400">
          Complete {Math.max(0, 5 - profile.total_data_points)} more tasks to unlock your peak-hour profile.
        </p>
      </InnerCard>
    );
  }

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-5">
      {profile.best_hours?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-400 mb-2">Peak hours</p>
          <div className="space-y-2">
            {profile.best_hours.map((h, i) => <HourBar key={h.hour} rate={h.rate} label={h.label} index={i} />)}
          </div>
        </div>
      )}
      {profile.worst_hours?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-rose-400 mb-2">Avoid scheduling at</p>
          <div className="space-y-2">
            {profile.worst_hours.map((h, i) => <HourBar key={h.hour} rate={h.rate} label={h.label} index={i} />)}
          </div>
        </div>
      )}
      {profile.best_days?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-violet-400 mb-2">Best days</p>
          <div className="flex flex-wrap gap-2">
            {profile.best_days.map((d, i) => (
              <motion.span
                key={d.dow}
                variants={fadeUp}
                className="px-3 py-1 rounded-full text-[11px] font-semibold border border-violet-400/20 bg-violet-500/10 text-violet-300"
              >
                {d.day} · {Math.round(d.rate * 100)}%
              </motion.span>
            ))}
          </div>
        </div>
      )}
      {profile.subject_performance?.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500 mb-2">Subject performance</p>
          <div className="space-y-3">
            {profile.subject_performance.map((s, i) => <SubjectRow key={s.subject} subject={s} index={i} />)}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── smart schedule ──────────────────────────────────────────────
function SmartSchedule({ schedule }) {
  if (!schedule?.recommended_slots?.length) {
    return (
      <p className="text-sm text-center py-4 text-slate-500">
        No pending tasks to schedule, or model not trained yet.
      </p>
    );
  }

  return (
    <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-2">
      {schedule.recommended_slots.map((slot, i) => (
        <motion.div
          key={i}
          variants={fadeUp}
          whileHover={{ x: 4, transition: { duration: 0.2 } }}
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 border cursor-default ${
            i === 0
              ? "border-violet-400/20 bg-violet-500/10"
              : "border-white/8 bg-slate-950/50"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black ${
              i === 0 ? "bg-violet-500 text-white" : "bg-white/5 text-slate-500"
            }`}
          >
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {slot.subject || slot.task_id || `Slot ${i + 1}`}
            </p>
            <p className="text-[11px] text-slate-500">
              {slot.recommended_slot || slot.scheduled_slot || "—"}
              {slot.score != null && ` · ${(slot.score * 100).toFixed(0)}% score`}
            </p>
          </div>
          {i === 0 && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-violet-400/20 bg-violet-500/10 text-violet-300 flex-shrink-0">
              Best
            </span>
          )}
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── collapsible wrapper ─────────────────────────────────────────
function Collapsible({ title, icon: Icon, color = "#818cf8", badge, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-6 focus:outline-none group"
      >
        <motion.div
          className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18` }}
          whileHover={{ scale: 1.1, rotate: 5, transition: { duration: 0.2 } }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </motion.div>
        <span className="text-base font-semibold text-white flex-1 text-left">{title}</span>
        {badge != null && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: `${color}18`, color }}
          >
            {badge}
          </motion.span>
        )}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
          <ChevronDown className="w-4 h-4 text-slate-600" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-6 pb-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── loading skeleton ────────────────────────────────────────────
function LoadingPulse() {
  return (
    <div className="space-y-3">
      {[60, 85, 50, 72].map((w, i) => (
        <motion.div
          key={i}
          className="h-3 rounded-full bg-white/5"
          style={{ width: `${w}%` }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.6, delay: i * 0.15, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// ─── main export ─────────────────────────────────────────────────
export function PlannerInsights() {
  const [analytics,   setAnalytics]  = useState(null);
  const [profile,     setProfile]    = useState(null);
  const [schedule,    setSchedule]   = useState(null);
  const [loading,     setLoading]    = useState(true);
  const [lastFetch,   setLastFetch]  = useState(null);
  const [fetchError,  setFetchError] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [analyticsRes, profileRes, scheduleRes] = await Promise.all([
        fetch(getPlannerApiUrl("/api/planner/analytics")),
        fetch(getPlannerApiUrl("/api/planner/profile")),
        fetch(getPlannerApiUrl("/api/planner/smart-schedule")),
      ]);
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (profileRes.ok)   setProfile(await profileRes.json());
      if (scheduleRes.ok)  setSchedule(await scheduleRes.json());
      setFetchError(false);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return (
    <motion.div
      variants={stagger(0.05)}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center justify-between px-1">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-slate-500">Insights</p>
          <h2 className="text-xl font-semibold text-white mt-1">Your Learning Profile</h2>
        </div>
        <motion.button
          onClick={fetchAll}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-medium text-slate-400 border border-white/8 bg-white/[0.04] hover:bg-white/[0.07] transition-colors"
          title="Refresh insights"
        >
          <motion.span
            animate={loading ? { rotate: 360 } : { rotate: 0 }}
            transition={loading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
          >
            <RefreshCw className="w-3 h-3" />
          </motion.span>
          Refresh
        </motion.button>
      </motion.div>

      {/* Error banner */}
      <AnimatePresence>
        {fetchError && (
          <motion.div
            key="error"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl px-4 py-3 flex items-center gap-2 border border-rose-400/20 bg-rose-500/10"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <p className="text-sm text-rose-300">
              Could not reach the planner backend. Start the agent and try again.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1 — Weekly summary */}
      <Collapsible title="Weekly Summary" icon={BarChart3} color="#818cf8" defaultOpen>
        {loading ? <LoadingPulse /> : analytics?.weekly_summary ? (
          <div className="space-y-5">
            <WeeklySummary summary={analytics.weekly_summary} />
            {analytics.daily_trends && <DailyTrend trends={analytics.daily_trends} />}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No weekly data yet. Complete some tasks to unlock your summary.</p>
        )}
      </Collapsible>

      {/* 2 — Study vs distraction */}
      <Collapsible title="Study vs Distraction" icon={Zap} color="#fbbf24" defaultOpen={false}>
        {loading ? <LoadingPulse /> : analytics?.study_vs_distraction ? (
          <StudyVsDistraction ratio={analytics.study_vs_distraction} />
        ) : (
          <p className="text-sm text-slate-500">No ratio data yet.</p>
        )}
      </Collapsible>

      {/* 3 — Suggestions */}
      <Collapsible
        title="Suggestions"
        icon={Target}
        color="#34d399"
        badge={analytics?.suggestions?.length || null}
        defaultOpen
      >
        {loading ? <LoadingPulse /> : analytics?.suggestions?.length ? (
          <motion.div variants={stagger()} initial="hidden" animate="show" className="space-y-2">
            {analytics.suggestions.map((s, i) => <SuggestionCard key={i} suggestion={s} index={i} />)}
          </motion.div>
        ) : (
          <p className="text-sm text-slate-500">No suggestions yet. Start tracking tasks to get personalised tips.</p>
        )}
      </Collapsible>

      {/* 4 — Productivity profile */}
      <Collapsible title="Productivity Profile" icon={Brain} color="#c084fc" defaultOpen={false}>
        {loading ? <LoadingPulse /> : profile ? (
          <ProductivityProfile profile={profile} />
        ) : (
          <p className="text-sm text-slate-500">Profile data unavailable.</p>
        )}
      </Collapsible>

      {/* 5 — Smart schedule */}
      <Collapsible title="Smart Schedule" icon={Calendar} color="#22d3ee" defaultOpen={false}>
        {loading ? <LoadingPulse /> : <SmartSchedule schedule={schedule} />}
      </Collapsible>

      {lastFetch && (
        <motion.p
          variants={fadeUp}
          className="text-[11px] text-center text-slate-600 pb-1"
        >
          Last updated {lastFetch.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </motion.p>
      )}
    </motion.div>
  );
}
