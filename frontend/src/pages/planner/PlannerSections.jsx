import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getPlannerApiUrl, getTaskStartTime } from "./plannerUtils";

// ─── Design primitives (mirrors Analytics.jsx) ──────────────────────────────

function Surface({ children, className = "" }) {
  return (
    <div
      className={`rounded-[28px] bg-gradient-to-b from-[#0d1426] to-[#080d18] ${className}`}
      style={{
        boxShadow:
          "0 18px 42px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
      {children}
    </div>
  );
}

// ─── ProbabilityRing ─────────────────────────────────────────────────────────

export function ProbabilityRing({ value, size = 180 }) {
  const pct = Math.round(value * 100);
  const strokeW = 8;
  const r = size / 2 - strokeW - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  const isHigh = pct >= 70;
  const isMid = pct >= 40 && pct < 70;
  const color = isHigh ? "#34d399" : isMid ? "#f59e0b" : "#fb7185";
  const glow = isHigh
    ? "rgba(52,211,153,0.3)"
    : isMid
    ? "rgba(245,158,11,0.3)"
    : "rgba(251,113,133,0.3)";
  const bgGlow = isHigh
    ? "rgba(52,211,153,0.08)"
    : isMid
    ? "rgba(245,158,11,0.08)"
    : "rgba(251,113,133,0.08)";

  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at center, ${bgGlow} 0%, transparent 70%)`,
      }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeW}
        />
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
          style={{
            transition: "stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)",
            filter: `drop-shadow(0 0 8px ${glow})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-semibold tabular-nums"
          style={{ fontSize: size * 0.28, color, lineHeight: 1 }}
        >
          {pct}
        </span>
        <SectionLabel>Percent</SectionLabel>
      </div>
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }) {
  const map = {
    pending:     { color: "#f59e0b", label: "Pending" },
    active:      { color: "#22d3ee", label: "In Progress" },
    completed:   { color: "#34d399", label: "Done" },
    missed:      { color: "#fb7185", label: "Missed" },
    rescheduled: { color: "#a78bfa", label: "Moved" },
  };
  const s = map[status] || map.pending;
  return (
    <span
      className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide"
      style={{ background: `${s.color}18`, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// ─── PriorityDot ─────────────────────────────────────────────────────────────

export function PriorityDot({ priority }) {
  const c = { high: "#fb7185", medium: "#f59e0b", low: "#34d399" };
  return (
    <div
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: c[priority] || c.medium }}
    />
  );
}

// ─── FocusTimer ──────────────────────────────────────────────────────────────

export function FocusTimer({
  onTasksChanged,
  onStartTask,
  notificationsMutedUntil = 0,
  shortBreakActive = false,
  shortBreakRemainingSeconds = 0,
  breakMinutesInput = 15,
  onBreakMinutesChange,
  onStartBreak,
  onEndBreak,
}) {
  const [missedTaskQueue, setMissedTaskQueue] = useState([]);
  const [activeMissedTask, setActiveMissedTask] = useState(null);
  const [processingMissedAction, setProcessingMissedAction] = useState(false);
  const notificationsMuted = Date.now() < notificationsMutedUntil;

  useEffect(() => {
    const interval = setInterval(async () => {
      if (Date.now() < notificationsMutedUntil) return;
      try {
        const res = await fetch(getPlannerApiUrl("/api/planner/check-missed"), {
          method: "POST",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.missed_tasks?.length > 0) {
          setMissedTaskQueue((prev) => {
            const existing = new Set(prev.map((t) => String(t.id)));
            if (activeMissedTask?.id != null)
              existing.add(String(activeMissedTask.id));
            const next = [...prev];
            for (const t of data.missed_tasks) {
              if (!existing.has(String(t.id))) {
                next.push(t);
                existing.add(String(t.id));
              }
            }
            return next;
          });
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(interval);
  }, [activeMissedTask, notificationsMutedUntil]);

  useEffect(() => {
    if (notificationsMuted) return;
    if (!activeMissedTask && missedTaskQueue.length > 0) {
      const [next, ...rest] = missedTaskQueue;
      setActiveMissedTask(next);
      setMissedTaskQueue(rest);
    }
  }, [activeMissedTask, missedTaskQueue, notificationsMuted]);

  const handleMissedTaskAction = async (action) => {
    if (!activeMissedTask || processingMissedAction) return;
    setProcessingMissedAction(true);
    try {
      if (action === "start") {
        if (typeof onStartTask === "function") await onStartTask(activeMissedTask);
        return;
      }
      await fetch(
        getPlannerApiUrl(`/api/planner/tasks/${activeMissedTask.id}/handle-missed`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (typeof onTasksChanged === "function") onTasksChanged();
    } catch (_) {}
    finally {
      setProcessingMissedAction(false);
      setActiveMissedTask(null);
    }
  };

  const breakOptions = [5, 15, 30, 45];
  const selectedBreakSeconds = Math.max(60, Number(breakMinutesInput || 5) * 60);
  const displaySeconds = shortBreakActive
    ? shortBreakRemainingSeconds
    : selectedBreakSeconds;
  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;
  const progress = shortBreakActive
    ? ((selectedBreakSeconds - shortBreakRemainingSeconds) / selectedBreakSeconds) * 100
    : 0;

  return (
    <>
      {/* ── Break Timer Card ── */}
      <Surface className="w-full p-5 md:p-6 lg:p-7 flex flex-col h-full gap-4 md:gap-5 rounded-[30px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <SectionLabel>Break Timer</SectionLabel>
            <h3 className="mt-1 font-serif text-[1rem] md:text-[1.08rem] text-white tracking-tight">
              Take a Breather
            </h3>
          </div>
          <span
            className="px-3 py-1 rounded-full text-[10px] font-semibold tracking-[0.08em]"
            style={{
              background: shortBreakActive
                ? "rgba(52,211,153,0.12)"
                : "rgba(255,255,255,0.035)",
              color: shortBreakActive ? "#34d399" : "#7c8aa5",
              border: shortBreakActive
                ? "1px solid rgba(52,211,153,0.25)"
                : "1px solid rgba(148,163,184,0.10)",
            }}
          >
            {shortBreakActive ? "Running" : "Paused"}
          </span>
        </div>

        {/* Duration Selector */}
        <div className="grid grid-cols-4 gap-2.5">
          {breakOptions.map((m) => {
            const selected = breakMinutesInput === m;
            return (
              <button
                key={m}
                onClick={() =>
                  typeof onBreakMinutesChange === "function" &&
                  onBreakMinutesChange(m)
                }
                disabled={shortBreakActive}
                className="py-2.5 rounded-[18px] text-xs font-semibold transition-all"
                style={{
                  background: selected
                    ? "linear-gradient(135deg,#22d3ee,#8b5cf6)"
                    : "rgba(255,255,255,0.025)",
                  color: selected ? "#fff" : "#7c8aa5",
                  border: selected
                    ? "1px solid transparent"
                    : "1px solid rgba(148,163,184,0.10)",
                  opacity: shortBreakActive && !selected ? 0.35 : 1,
                  boxShadow: selected
                    ? "0 10px 24px rgba(34,211,238,0.20)"
                    : "none",
                }}
              >
                {m}m
              </button>
            );
          })}
        </div>

        {/* Countdown */}
        <div
          className="flex flex-col items-center justify-center rounded-[24px] py-12 md:py-14 px-5 md:px-6 min-h-[420px]"
          style={{
            background: "linear-gradient(180deg, rgba(6,11,22,0.82) 0%, rgba(7,12,22,0.62) 100%)",
            border: "1px solid rgba(148,163,184,0.08)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <span
            className="font-black tabular-nums tracking-tighter"
            style={{
              fontSize: "clamp(3.2rem, 5vw, 4.3rem)",
              lineHeight: 1,
              color: shortBreakActive ? "#34d399" : "#fff",
              textShadow: shortBreakActive
                ? "0 0 24px rgba(52,211,153,0.4)"
                : "none",
            }}
          >
            {String(mins).padStart(2, "0")}
            <span
              style={{
                color: shortBreakActive ? "#34d399" : "#334155",
                opacity: shortBreakActive ? 1 : 0.5,
              }}
            >
              :
            </span>
            {String(secs).padStart(2, "0")}
          </span>
          <p className="mt-3 text-[11px] text-slate-500">
            {shortBreakActive
              ? "Silence mode engaged."
              : "Select a duration, then start."}
          </p>
        </div>

        {/* Progress bar */}
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(148,163,184,0.10)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${Math.max(0, Math.min(progress, 100))}%`,
              background: "linear-gradient(to right,#22d3ee,#8b5cf6)",
              boxShadow: shortBreakActive
                ? "0 0 8px rgba(34,211,238,0.5)"
                : "none",
            }}
          />
        </div>

        {/* Action button */}
        {shortBreakActive ? (
          <button
            onClick={onEndBreak}
            className="w-full py-3 rounded-[18px] text-sm font-semibold transition-all"
            style={{
              background: "rgba(251,113,133,0.1)",
              border: "1px solid rgba(251,113,133,0.3)",
              color: "#fb7185",
            }}
          >
            End Break Early
          </button>
        ) : (
          <button
            onClick={onStartBreak}
            className="w-full py-3 rounded-[18px] text-sm font-semibold text-white transition-all"
            style={{
              background: "linear-gradient(135deg,#22d3ee,#8b5cf6)",
              boxShadow: "0 10px 24px rgba(34,211,238,0.22)",
            }}
          >
            Start Break
          </button>
        )}

        <p className="text-[11px] text-slate-600 text-center leading-relaxed">
          Alerts are silenced for the duration of the break.
        </p>
      </Surface>

      {/* ── Missed Task Modal ── */}
      {activeMissedTask && !notificationsMuted && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{
            background: "rgba(4,8,22,0.78)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            className="w-full max-w-md rounded-[28px] p-7"
            style={{
              background:
                "linear-gradient(160deg,#0d1426 0%,#080d18 100%)",
              boxShadow:
                "0 28px 70px rgba(0,0,0,0.56), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{
                background: "rgba(251,113,133,0.1)",
                border: "1px solid rgba(251,113,133,0.2)",
                color: "#fb7185",
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Missed Task</span>
            </div>

            <h3 className="font-serif text-xl text-white mb-1">
              {activeMissedTask.subject}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Choose what to do with this task.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleMissedTaskAction("reschedule")}
                disabled={processingMissedAction}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white transition-all"
                style={{
                  background:
                    "linear-gradient(135deg,#8b5cf6,#6366f1)",
                  boxShadow: "0 4px 16px rgba(139,92,246,0.25)",
                }}
              >
                {processingMissedAction ? "Working…" : "Reschedule to Next Free Slot"}
              </button>

              <button
                onClick={() => handleMissedTaskAction("start")}
                disabled={processingMissedAction}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(52,211,153,0.1)",
                  border: "1px solid rgba(52,211,153,0.2)",
                  color: "#34d399",
                }}
              >
                {processingMissedAction ? "Working…" : "Start Now"}
              </button>

              <button
                onClick={() => handleMissedTaskAction("delete")}
                disabled={processingMissedAction}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all"
                style={{
                  background: "rgba(251,113,133,0.08)",
                  border: "1px solid rgba(251,113,133,0.18)",
                  color: "#fb7185",
                }}
              >
                {processingMissedAction ? "Working…" : "Delete Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────

const TIME_SLOTS = [
  "5 AM","6 AM","7 AM","8 AM","9 AM","10 AM","11 AM","12 PM",
  "1 PM","2 PM","3 PM","4 PM","5 PM","6 PM","7 PM","8 PM",
  "9 PM","10 PM","11 PM","12 AM",
];

export function Timeline({ tasks }) {
  const now = new Date();
  const currentHour = now.getHours();

  const parsePlannedStartHour = (task) => {
    const startTime = getTaskStartTime(task);
    if (startTime === Number.MAX_SAFE_INTEGER) return -1;
    return new Date(startTime).getHours();
  };

  const tasksByHour = {};
  tasks.forEach((task) => {
    const hour = parsePlannedStartHour(task);
    if (hour >= 0) tasksByHour[hour] = task;
  });

  const statusColor = {
    active:      "#22d3ee",
    completed:   "#34d399",
    missed:      "#fb7185",
    rescheduled: "#a78bfa",
    pending:     "#f59e0b",
  };

  return (
    <div className="space-y-0">
      {TIME_SLOTS.map((slotLabel) => {
        const hourMatch = slotLabel.match(/^(\d+)/);
        let hour = hourMatch ? parseInt(hourMatch[1], 10) : -1;
        if (slotLabel.includes("PM") && hour !== 12) hour += 12;
        if (slotLabel.includes("AM") && hour === 12) hour = 0;

        const isCurrent = hour === currentHour;
        const isPast = hour < currentHour;
        const task = tasksByHour[hour];
        const dotColor = isCurrent
          ? "#22d3ee"
          : task
          ? statusColor[task.status] || "#f59e0b"
          : "rgba(255,255,255,0.08)";

        return (
          <div
            key={slotLabel}
            className="flex gap-4 group"
            style={{ opacity: isPast && !task ? 0.35 : 1 }}
          >
            {/* Time label */}
            <div className="w-12 text-right pt-3 flex-shrink-0">
              <span
                className="text-[11px] font-medium"
                style={{ color: isCurrent ? "#22d3ee" : "#475569" }}
              >
                {slotLabel.split(" ")[0]}
              </span>
              <span className="text-[9px] ml-0.5 text-slate-600">
                {slotLabel.includes("AM") ? "am" : "pm"}
              </span>
            </div>

            {/* Dot + line */}
            <div className="flex flex-col items-center pt-3.5 flex-shrink-0">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 transition-all"
                style={{
                  background: dotColor,
                  boxShadow: isCurrent
                    ? "0 0 0 4px rgba(34,211,238,0.15)"
                    : "none",
                }}
              />
              <div
                className="w-px flex-1 mt-1.5"
                style={{ background: "rgba(255,255,255,0.05)" }}
              />
            </div>

            {/* Task block */}
            <div className="flex-1 pb-3 pt-1.5">
              {task ? (
                <div
                  className="px-4 py-3 rounded-[20px] transition-all"
                  style={{
                    background:
                      task.status === "active"
                        ? "rgba(34,211,238,0.06)"
                        : task.status === "completed"
                        ? "rgba(52,211,153,0.06)"
                        : task.status === "missed"
                        ? "rgba(251,113,133,0.06)"
                        : "rgba(255,255,255,0.02)",
                    border: `1px solid ${
                      task.status === "active"
                        ? "rgba(34,211,238,0.15)"
                        : task.status === "completed"
                        ? "rgba(52,211,153,0.14)"
                        : task.status === "missed"
                        ? "rgba(251,113,133,0.15)"
                        : "rgba(255,255,255,0.04)"
                    }`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="text-sm font-medium truncate text-white"
                      style={{
                        opacity: task.status === "completed" ? 0.6 : 1,
                      }}
                    >
                      {task.subject}
                    </span>
                    <StatusBadge status={task.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-slate-500">
                      {task.scheduled_slot || `${task.duration_minutes} min`}
                    </span>
                    {task.distraction_events > 0 && (
                      <span className="text-[11px] text-slate-600">
                        · {task.distraction_events} distractions
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-8 opacity-0 group-hover:opacity-100 transition-opacity flex items-center px-2">
                  <span className="text-[10px] text-slate-700">Open slot</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
