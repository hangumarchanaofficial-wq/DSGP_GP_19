import { useEffect, useState } from "react";
import {
  AlertTriangle,
} from "lucide-react";
import { getTaskStartTime } from "./plannerUtils";

// Shared planner UI sections live here so the main page is easier to present.
export function ProbabilityRing({ value, size = 180 }) {
  const pct = Math.round(value * 100);
  const strokeW = 8;
  const r = size / 2 - strokeW - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  
  // Determine color matching standard system scale
  const isHigh = pct >= 70;
  const isMid = pct >= 40 && pct < 70;
  const color = isHigh ? "#10b981" : isMid ? "#f59e0b" : "#ef4444";
  const glowColor = isHigh ? "rgba(16,185,129,0.3)" : isMid ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)";
  const bgGlowColor = isHigh ? "rgba(16,185,129,0.12)" : isMid ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)";

  return (
    <div
      className="relative flex items-center justify-center rounded-3xl"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at center, ${bgGlowColor} 0%, rgba(15,23,42,0.6) 60%, transparent 100%)`,
        boxShadow: "inset 0 4px 20px rgba(0,0,0,0.3)",
        border: "1px solid rgba(255,255,255,0.02)"
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
            transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
            filter: `drop-shadow(0 0 10px ${glowColor})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <span
          className="font-black tracking-tighter"
          style={{ 
            fontSize: size * 0.3, 
            color,
            lineHeight: 0.9,
            textShadow: `0 0 24px ${glowColor}`
          }}
        >
          {pct}
        </span>
        <span 
          className="text-[10px] font-bold uppercase tracking-[0.25em] mt-1"
          style={{ color: "var(--text-muted)", opacity: 0.8 }}
        >
          Percent
        </span>
      </div>
    </div>
  );
}

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
        const res = await fetch("/api/planner/check-missed", {
          method: "POST",
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error("Missed task check failed:", errText);
          return;
        }

        const data = await res.json();

        if (data.missed_tasks && data.missed_tasks.length > 0) {
          setMissedTaskQueue((prev) => {
            const existing = new Set(prev.map((t) => String(t.id)));
            if (activeMissedTask?.id != null) {
              existing.add(String(activeMissedTask.id));
            }

            const next = [...prev];
            for (const t of data.missed_tasks) {
              const tid = String(t.id);
              if (!existing.has(tid)) {
                next.push(t);
                existing.add(tid);
              }
            }
            return next;
          });
        }
      } catch (error) {
        console.error("Missed task check error:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeMissedTask, notificationsMutedUntil]);

  useEffect(() => {
    if (notificationsMuted) return;
    if (!activeMissedTask && missedTaskQueue.length > 0) {
      const [nextTask, ...rest] = missedTaskQueue;
      setActiveMissedTask(nextTask);
      setMissedTaskQueue(rest);
    }
  }, [activeMissedTask, missedTaskQueue, notificationsMuted]);

  const handleMissedTaskAction = async (action) => {
    if (!activeMissedTask || processingMissedAction) return;

    setProcessingMissedAction(true);
    try {
      if (action === "start") {
        if (typeof onStartTask === "function") {
          await onStartTask(activeMissedTask);
        }
        return;
      }

      const actionRes = await fetch(
        `/api/planner/tasks/${activeMissedTask.id}/handle-missed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );

      if (!actionRes.ok) {
        const errText = await actionRes.text();
        console.error("Missed task action failed:", errText);
      }

      if (typeof onTasksChanged === "function") {
        onTasksChanged();
      }
    } catch (error) {
      console.error("Missed task action error:", error);
    } finally {
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
      <div className="glass-card flex flex-col h-full p-6 transition-all hover:shadow-lg relative overflow-hidden group">
        {/* Subtle background glow when active */}
        <div 
          className={`absolute inset-0 opacity-0 transition-opacity duration-1000 pointer-events-none ${shortBreakActive ? 'opacity-100' : ''}`}
          style={{
            background: "radial-gradient(circle at center 40%, rgba(16,185,129,0.05) 0%, transparent 60%)"
          }}
        />

        <div className="flex items-start justify-between gap-3 mb-5 relative z-10">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Break Timer
            </p>
            <h2
              className="text-sm font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Take a Breather
            </h2>
          </div>
          <div
            className="px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
            style={{
              background: shortBreakActive ? "rgba(16,185,129,0.15)" : "var(--bg-elevated)",
              color: shortBreakActive ? "#10b981" : "var(--text-muted)",
              border: shortBreakActive
                ? "1px solid rgba(16,185,129,0.3)"
                : "1px solid var(--border)",
              boxShadow: shortBreakActive ? "0 0 12px rgba(16,185,129,0.2)" : "none"
            }}
          >
            {shortBreakActive ? "Running" : "Paused"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5 relative z-10">
          {breakOptions.map((minutes) => (
            <button
              key={minutes}
              onClick={() =>
                typeof onBreakMinutesChange === "function" &&
                onBreakMinutesChange(minutes)
              }
              disabled={shortBreakActive}
              className="px-3 py-3 rounded-xl text-xs font-bold transition-all"
              style={{
                background:
                  breakMinutesInput === minutes
                    ? "linear-gradient(to right, #10b981, #059669)"
                    : "var(--bg-elevated)",
                color: breakMinutesInput === minutes ? "#fff" : "var(--text-muted)",
                border: breakMinutesInput === minutes ? "1px solid transparent" : "1px solid var(--border)",
                opacity: shortBreakActive && breakMinutesInput !== minutes ? 0.4 : 1,
                cursor: shortBreakActive ? "default" : "pointer",
                boxShadow: breakMinutesInput === minutes ? "0 4px 12px rgba(16,185,129,0.25)" : "inset 0 2px 4px rgba(0,0,0,0.05)",
                transform: breakMinutesInput === minutes ? "scale(1.02)" : "scale(1)",
              }}
            >
              {minutes} min
            </button>
          ))}
        </div>

        <div
          className="rounded-2xl p-5 mb-5 text-center transition-all flex flex-col items-center justify-center relative z-10 flex-1"
          style={{
            background: "rgba(15,23,42,0.2)",
            border: "1px solid rgba(16,185,129,0.1)",
            boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.02)",
          }}
        >
          <div
            className={`text-6xl font-black tracking-tighter transition-all ${shortBreakActive ? 'scale-105' : ''}`}
            style={{
              color: shortBreakActive ? "#10b981" : "var(--text-primary)",
              fontVariantNumeric: "tabular-nums",
              textShadow: shortBreakActive ? "0 0 20px rgba(16,185,129,0.4)" : "none"
            }}
          >
            {String(mins).padStart(2, "0")}
            <span
              className={shortBreakActive ? "animate-[pulse_1.5s_ease-in-out_infinite]" : ""}
              style={{
                color: shortBreakActive ? "#10b981" : "var(--text-muted)",
                opacity: shortBreakActive ? 1 : 0.3,
              }}
            >
              :
            </span>
            {String(secs).padStart(2, "0")}
          </div>
          <p
            className="text-[10px] mt-2 font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            {shortBreakActive
              ? "Silence mode engaged."
              : "Select duration before starting break."}
          </p>
        </div>

        <div className="relative z-10 w-full mb-6">
           <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${Math.max(0, Math.min(progress, 100))}%`,
                background: "linear-gradient(to right, #34d399, #10b981)",
                boxShadow: shortBreakActive ? "0 0 10px rgba(16,185,129,0.5)" : "none"
              }}
            />
          </div>
        </div>

        <div className="relative z-10 w-full mt-auto">
          {shortBreakActive ? (
            <button
              onClick={onEndBreak}
              className="w-full py-3.5 rounded-xl text-xs font-bold text-white transition-all transform active:scale-[0.98] relative overflow-hidden flex items-center justify-center"
              style={{
                background: "linear-gradient(to right, rgba(239,68,68,0.2), rgba(220,38,38,0.15))",
                border: "1px solid rgba(239,68,68,0.4)",
                color: "#ef4444",
              }}
            >
              End Break Early
            </button>
          ) : (
            <button
              onClick={onStartBreak}
              className="w-full py-3.5 rounded-xl text-xs font-bold text-white transition-all transform active:scale-[0.98] relative overflow-hidden flex items-center justify-center"
              style={{
                background: "linear-gradient(to right, #10b981, #059669)",
                boxShadow: "0 4px 14px rgba(16,185,129,0.25)",
              }}
            >
              Start Break Timer
            </button>
          )}

          <p
            className="text-[10px] font-medium leading-relaxed mt-4 text-center px-2"
            style={{ color: "var(--text-muted)" }}
          >
            No alerts or reminders will show until the break timer ends.
          </p>
        </div>
      </div>

      {activeMissedTask && !notificationsMuted && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: "rgba(2, 6, 23, 0.72)", backdropFilter: "blur(8px)" }}
        >
          <div
            className="w-full max-w-md rounded-[30px] p-6 planner-card"
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 28px 70px rgba(2,6,23,0.48)",
            }}
          >
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{
                background: "rgba(239,68,68,0.14)",
                color: "#fca5a5",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="text-[11px] font-semibold">Missed Task</span>
            </div>

            <h3
              className="text-xl font-black tracking-tight mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              {activeMissedTask.subject}
            </h3>
            <p
              className="text-xs mb-5"
              style={{ color: "var(--text-secondary)" }}
            >
              Choose what to do with this missed task.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => handleMissedTaskAction("reschedule")}
                disabled={processingMissedAction}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(129,140,248,0.96), rgba(99,102,241,0.82))",
                }}
              >
                {processingMissedAction ? "Working..." : "Reschedule To Next Free Slot"}
              </button>

              <button
                onClick={() => handleMissedTaskAction("start")}
                disabled={processingMissedAction}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold"
                style={{
                  color: "#10b981",
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.2)",
                }}
              >
                {processingMissedAction ? "Working..." : "Start The Task"}
              </button>

              <button
                onClick={() => handleMissedTaskAction("delete")}
                disabled={processingMissedAction}
                className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(239,68,68,0.96), rgba(190,24,93,0.82))",
                }}
              >
                {processingMissedAction ? "Working..." : "Delete Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function StatusBadge({ status }) {
  const m = {
    pending: { color: "#f59e0b", label: "Pending" },
    active: { color: "#10b981", label: "In Progress" },
    completed: { color: "#10b981", label: "Done" },
    missed: { color: "#ef4444", label: "Missed" },
    rescheduled: { color: "#a855f7", label: "Moved" },
  };

  const s = m[status] || m.pending;

  return (
    <span
      className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
      style={{
        background: `${s.color}14`,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

export function PriorityDot({ priority }) {
  const c = { high: "#ef4444", medium: "#f59e0b", low: "#10b981" };
  return (
    <div
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: c[priority] || c.medium }}
    />
  );
}

const TIME_SLOTS = [
  "5 AM",
  "6 AM",
  "7 AM",
  "8 AM",
  "9 AM",
  "10 AM",
  "11 AM",
  "12 PM",
  "1 PM",
  "2 PM",
  "3 PM",
  "4 PM",
  "5 PM",
  "6 PM",
  "7 PM",
  "8 PM",
  "9 PM",
  "10 PM",
  "11 PM",
  "12 AM",
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
    if (hour >= 0) {
      tasksByHour[hour] = task;
    }
  });

  return (
    <div className="space-y-0">
      {TIME_SLOTS.map((slotLabel) => {
        const hourMatch = slotLabel.match(/^(\d+)/);
        let hour = hourMatch ? parseInt(hourMatch[1], 10) : -1;

        if (slotLabel.includes("PM") && hour !== 12) hour += 12;
        if (slotLabel.includes("AM") && hour === 12) hour = 0;

        const isCurrent = hour === currentHour;
        const task = tasksByHour[hour];
        const isPast = hour < currentHour;

        return (
          <div
            key={slotLabel}
            className="flex gap-4 group"
            style={{ opacity: isPast && !task ? 0.42 : 1 }}
          >
            <div className="w-12 text-right pt-3 flex-shrink-0">
              <span
                className="text-[11px] font-medium"
                style={{
                  color: isCurrent ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {slotLabel.split(" ")[0]}
              </span>
              <span
                className="text-[9px] ml-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                {slotLabel.includes("AM") ? "am" : "pm"}
              </span>
            </div>

            <div className="flex flex-col items-center pt-3.5 flex-shrink-0">
              <div
                className="w-2.5 h-2.5 rounded-full transition-all flex-shrink-0"
                style={{
                  background: isCurrent
                    ? "var(--accent)"
                    : task
                    ? task.status === "completed"
                      ? "#10b981"
                      : task.status === "active"
                      ? "#818cf8"
                      : task.status === "missed"
                      ? "#ef4444"
                      : "#f59e0b"
                    : "var(--border)",
                  boxShadow: isCurrent
                    ? "0 0 0 4px rgba(99,102,241,0.15)"
                    : "none",
                }}
              />
              <div
                className="w-px flex-1 mt-1.5"
                style={{ background: "var(--border)", opacity: 0.45 }}
              />
            </div>

            <div className="flex-1 pb-3 pt-1.5">
              {task ? (
                <div
                  className="px-4 py-3 rounded-[20px] transition-all"
                  style={{
                    background:
                      task.status === "active"
                        ? "rgba(99,102,241,0.08)"
                        : task.status === "completed"
                        ? "rgba(16,185,129,0.08)"
                        : task.status === "missed"
                        ? "rgba(239,68,68,0.08)"
                        : "rgba(255,255,255,0.02)",
                    border: `1px solid ${
                      task.status === "active"
                        ? "rgba(99,102,241,0.16)"
                        : task.status === "completed"
                        ? "rgba(16,185,129,0.18)"
                        : task.status === "missed"
                        ? "rgba(239,68,68,0.18)"
                        : "rgba(255,255,255,0.04)"
                    }`,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="text-sm font-semibold truncate"
                      style={{
                        color:
                          task.status === "completed"
                            ? "#10b981"
                            : task.status === "missed"
                            ? "#ef4444"
                            : "var(--text-primary)",
                        textDecoration: "none",
                        opacity: task.status === "completed" ? 0.85 : 1,
                      }}
                    >
                      {task.subject}
                    </span>

                    <StatusBadge status={task.status} />
                  </div>

                  <span
                    className="text-[10px] mt-1.5 block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {task.scheduled_slot || `${task.duration_minutes} min`}
                  </span>

                  <span
                    className="text-[10px] mt-1 block"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {task.duration_minutes} min
                    {task.distraction_events > 0 &&
                      ` · ${task.distraction_events} distractions`}
                  </span>
                </div>
              ) : (
                <div className="h-9 opacity-0 group-hover:opacity-100 transition-opacity flex items-center px-3">
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Open slot
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
