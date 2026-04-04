import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import { useTheme } from "../context/ThemeContext";
import {
  CalendarCheck,AlertTriangle,Coffee,Brain,Play,X,Trash2,RefreshCw,AlertCircle,
  Zap,Flame,Trophy,TrendingUp,Sparkles,Pause,ArrowRight,
} from "lucide-react";
import { FocusTimer, PriorityDot, ProbabilityRing, StatusBadge } from "./planner/PlannerSections";
import {
  formatClockDuration,
  formatCompactStudyDuration,
  formatHoursMinutesFromSeconds,
  formatSleepDuration,
  getSleepDateKey,
  getPlannerApiUrl,
  getSocialStorageKey,
  getTaskStartTime,
  parseDateValue,
  readSleepEntry,
  readSocialEntry,
  sortTasksByStartTime,
  writeSleepEntry,
  writeSocialEntry,
  clampSleepMinutes,
} from "./planner/plannerUtils";


// Main planner page that combines task management, timers, and prediction results.
export default function Planner() {
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const predictionInFlightRef = useRef(false);
  const latestFormRef = useRef(null);
  const latestTasksRef = useRef([]);
  const latestPredictionRef = useRef(null);
  const visiblePredictionRef = useRef(null);
  const addTaskInputRef = useRef(null);
  // Tracks which form fields the user has manually overridden via sliders.
  // Once a field is in this set, auto-sync from live timers is skipped for it.
  const userEditedFields = useRef(new Set());
  // Bumped whenever userEditedFields changes so live/manual badges re-render.
  const [manualFieldsVersion, setManualFieldsVersion] = useState(0);
  const latestNotificationPermissionRef = useRef(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const lastStartReminderNotificationRef = useRef(null);
  const lastRescheduleNotificationRef = useRef(null);
  // Smart suggestion cooldown: prevent repetitive distraction messages.
  // A new suggestion is shown only when the distraction probability changes
  // by more than ±15% OR at least 20 minutes have elapsed since the last one.
  const lastSuggestionTimeRef = useRef(0);
  const lastSuggestionProbRef = useRef(null);
  const [activeTaskRemainingAtStart, setActiveTaskRemainingAtStart] = useState(0);
  const [activeTaskSessionStartedAt, setActiveTaskSessionStartedAt] = useState(null);
  const [socialSeconds, setSocialSeconds] = useState(0);
  const [socialTimerRunning, setSocialTimerRunning] = useState(false);
  const [socialTimerStartedAt, setSocialTimerStartedAt] = useState(null);
  const [socialTimerTick, setSocialTimerTick] = useState(0);
  const [socialStorageLoaded, setSocialStorageLoaded] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(() =>
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  // Demo note: the shared helpers/UI pieces were moved into ./planner/*
  // so this file mostly shows the planner state, effects, and API flow.

  // Calculates the elapsed time for the current social-media session.
  const getCurrentSocialSessionSeconds = useCallback(() => {
    if (!socialTimerRunning || !socialTimerStartedAt) return 0;
    const startedAt = parseDateValue(socialTimerStartedAt);
    if (!startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 1000));
  }, [socialTimerRunning, socialTimerStartedAt]);

  // Syncs the browser notification permission into React state and refs.
  const syncNotificationPermission = useCallback(() => {
    const nextPermission =
      typeof Notification !== "undefined" ? Notification.permission : "unsupported";
    latestNotificationPermissionRef.current = nextPermission;
    setNotificationPermission(nextPermission);
    return nextPermission;
  }, []);

  // Requests browser notification access when the user has not decided yet.
  const requestBrowserNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") return "unsupported";

    const currentPermission = syncNotificationPermission();
    if (currentPermission !== "default") return currentPermission;

    try {
      const nextPermission = await Notification.requestPermission();
      latestNotificationPermissionRef.current = nextPermission;
      setNotificationPermission(nextPermission);
      return nextPermission;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return latestNotificationPermissionRef.current;
    }
  }, [syncNotificationPermission]);

  // Shows a browser notification for reminders and planner alerts.
  const showBrowserNotification = useCallback(
    async ({ title, body, tag }) => {
      if (typeof window === "undefined" || typeof Notification === "undefined") return;
      if (document.visibilityState === "visible") return;

      let permission = latestNotificationPermissionRef.current;
      if (permission === "default") {
        permission = await requestBrowserNotificationPermission();
      }

      if (permission !== "granted") return;

      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            body,
            tag,
            renotify: true,
            requireInteraction: true,
          });
          return;
        }

        const notification = new Notification(title, {
          body,
          tag,
          renotify: true,
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error("Failed to show browser notification:", error);
      }
    },
    [requestBrowserNotificationPermission],
  );

  // Starts a study session and mirrors the backend timer state in the UI.
  const handleStartTimer = async (task) => {
    try {
      if (socialTimerRunning) {
        stopSocialTimer();
      }

      const res = await fetch(getPlannerApiUrl(`/api/planner/tasks/${task.id}/start`), {
        method: "POST"
      });
  
      const data = await res.json();
  
      setActiveTaskId(task.id);
      const nextRemainingSeconds =
        data.task?.remaining_seconds ??
        data.remaining_seconds ??
        task.remaining_seconds ??
        task.duration_minutes * 60;
      const sessionStartedAt = data.task?.session_started_at ?? data.task?.start_time ?? new Date().toISOString();

      setTimeLeft(nextRemainingSeconds);
      setActiveTaskRemainingAtStart(nextRemainingSeconds);
      setActiveTaskSessionStartedAt(sessionStartedAt);
      setIsRunning(true);
  
      fetchTasks();
    } catch (error) {
      console.error("Start timer error:", error);
    }
  };

  // Pauses the current task and stores the latest elapsed time.
  const handlePauseTimer = async () => {
    try {
      if (!activeTaskId) return;
      const elapsedSeconds = getCurrentSessionElapsedSeconds();
  
      await fetch(getPlannerApiUrl(`/api/planner/tasks/${activeTaskId}/pause`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          remaining_seconds: timeLeft,
          elapsed_seconds: elapsedSeconds,
        })
      });
  
      setIsRunning(false);
      setActiveTaskId(null);
      setTimeLeft(0);
      setActiveTaskRemainingAtStart(0);
      setActiveTaskSessionStartedAt(null);
  
      fetchTasks();
    } catch (error) {
      console.error("Pause timer error:", error);
    }
  };
  // Resumes a previously started task from its saved remaining time.
  const handleResumeTimer = async (task) => {
    try {
      const res = await fetch(getPlannerApiUrl(`/api/planner/tasks/${task.id}/resume`), {
        method: "POST"
      });
  
      const data = await res.json();
  
      setActiveTaskId(task.id);
      const nextRemainingSeconds =
        data.task?.remaining_seconds ??
        data.remaining_seconds ??
        task.remaining_seconds ??
        task.duration_minutes * 60;
      const sessionStartedAt = data.task?.session_started_at ?? data.task?.start_time ?? new Date().toISOString();

      setTimeLeft(nextRemainingSeconds);
      setActiveTaskRemainingAtStart(nextRemainingSeconds);
      setActiveTaskSessionStartedAt(sessionStartedAt);
      setIsRunning(true);
  
      fetchTasks();
    } catch (error) {
      console.error("Resume timer error:", error);
    }
  };

  // Computes how many seconds have passed in the active study session.
  const getCurrentSessionElapsedSeconds = useCallback(() => {
    if (!activeTaskSessionStartedAt) return 0;

    const startedAt = parseDateValue(activeTaskSessionStartedAt);
    if (!startedAt) {
      return Math.max(0, activeTaskRemainingAtStart - timeLeft);
    }

    const elapsedSeconds = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    return Math.max(0, Math.min(activeTaskRemainingAtStart, elapsedSeconds));
  }, [activeTaskRemainingAtStart, activeTaskSessionStartedAt, timeLeft]);

  // Keeps the on-screen countdown in sync once a task session is active.
  useEffect(() => {
    let timer;
  
    if (isRunning && activeTaskId && activeTaskSessionStartedAt) {
      timer = setInterval(() => {
        const elapsedSeconds = getCurrentSessionElapsedSeconds();
        const nextRemaining = Math.max(0, activeTaskRemainingAtStart - elapsedSeconds);

        setTimeLeft(nextRemaining);

        if (nextRemaining <= 0) {
          setIsRunning(false);
          autoCompleteTask(activeTaskId, activeTaskRemainingAtStart);
        }
      }, 1000);
    }

    return () => clearInterval(timer);
  }, [
    activeTaskId,
    activeTaskRemainingAtStart,
    activeTaskSessionStartedAt,
    getCurrentSessionElapsedSeconds,
    isRunning,
  ]);

  // Finishes a task early using the current tracked study time.
  const handleFinishTask = async (task) => {
    try {
      const elapsedSeconds =
        String(task.id) === String(activeTaskId)
          ? getCurrentSessionElapsedSeconds()
          : 0;
  
      await autoCompleteTask(task.id, elapsedSeconds);
    } catch (error) {
      console.error("Finish task error:", error);
    }
  };

   

    // Completes a task automatically when its countdown reaches zero.
    const autoCompleteTask = async (taskId, elapsedSeconds = null) => {
      try {
        let finalElapsedSeconds = elapsedSeconds;

        if (finalElapsedSeconds === null && String(taskId) === String(activeTaskId)) {
          finalElapsedSeconds = getCurrentSessionElapsedSeconds();
        }
    
        const res = await fetch(getPlannerApiUrl(`/api/planner/tasks/${taskId}/complete`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            elapsed_seconds: finalElapsedSeconds,
          }),
        });
    
        const data = await res.json();

        // The backend now records actual_duration_seconds on the completed task.
        // The study_hours_per_day slider auto-syncs from todayStudySeconds (via
        // fetchTasks → persistedTodayStudySeconds), so no manual update is needed here.
    
        setActiveTaskId(null);
        setTimeLeft(0);
        setIsRunning(false);
        setActiveTaskRemainingAtStart(0);
        setActiveTaskSessionStartedAt(null);
    
        fetchTasks();
      } catch (error) {
        console.error("Auto complete error:", error);
      }
    };

  // Formats a countdown value into mm:ss for the task controls.
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const { dark } = useTheme();

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    age: 20,
    gender: "Male",
    part_time_job: "No",
    study_hours_per_day: 0,
    sleep_hours: 0,
    total_social_hours: 0,
  });
  const [sleepDateKey, setSleepDateKey] = useState(() => getSleepDateKey());
  const [dailySleepMinutes, setDailySleepMinutes] = useState(0);
  const [initialSleepMinutes, setInitialSleepMinutes] = useState(0);
  const [additionalSleepMinutes, setAdditionalSleepMinutes] = useState(0);
  const [showInitialSleepPrompt, setShowInitialSleepPrompt] = useState(false);
  const [initialSleepInput, setInitialSleepInput] = useState({
    hours: "",
    minutes: "",
  });
  const [sleepInput, setSleepInput] = useState({
    hours: "",
    minutes: "",
  });
  const [sleepError, setSleepError] = useState("");
  const hasPlannerInputs = useMemo(
    () =>
      Number(form.age) > 0 &&
      typeof form.gender === "string" &&
      form.gender.length > 0 &&
      typeof form.part_time_job === "string" &&
      form.part_time_job.length > 0 &&
      Number(form.study_hours_per_day) >= 0 &&
      Number(form.sleep_hours) >= 0 &&
      Number(form.total_social_hours) >= 0,
    [form],
  );
  const canShowPrediction = hasPlannerInputs;

  // Stops the social-media timer and persists the accumulated time.
  const stopSocialTimer = useCallback(() => {
    if (!socialTimerRunning) return;

    const elapsedSeconds = getCurrentSocialSessionSeconds();
    const nextTotal = socialSeconds + elapsedSeconds;

    setSocialSeconds(nextTotal);
    setSocialTimerRunning(false);
    setSocialTimerStartedAt(null);
    setSocialTimerTick(0);
    writeSocialEntry(sleepDateKey, nextTotal, false, null);
  }, [getCurrentSocialSessionSeconds, sleepDateKey, socialSeconds, socialTimerRunning]);

  const [tasks, setTasks] = useState([]);
  const [taskStats, setTaskStats] = useState(null);
  const [streakInfo, setStreakInfo] = useState(null);
  const [persistedTodayStudySeconds, setPersistedTodayStudySeconds] = useState(0);
  const [showAddTask, setShowAddTask] = useState(false);
  const [addTaskError, setAddTaskError] = useState("");
  const [taskOverviewMode, setTaskOverviewMode] = useState("ongoing");
  
  const [newTask, setNewTask] = useState({
    subject: '',
    duration_minutes: 60,
    priority: 'medium',
    scheduled_slot: '',
    start_hour: '12',
    start_minute: '00',
    start_meridiem: 'AM',
    notes: '',
  });

  const [distractionState, setDistractionState] = useState(null);
  const [rescheduleAlert, setRescheduleAlert] = useState(null);
  const [plannerNotice, setPlannerNotice] = useState(null);
  const [startReminderTask, setStartReminderTask] = useState(null);
  const [startReminderCooldown, setStartReminderCooldown] = useState({});
  const [showBreakDurationPicker, setShowBreakDurationPicker] = useState(false);
  const [breakMinutesInput, setBreakMinutesInput] = useState(15);
  const [shortBreakEndAt, setShortBreakEndAt] = useState(null);
  const [shortBreakRemainingSeconds, setShortBreakRemainingSeconds] = useState(0);
  const [breakMotivationIndex, setBreakMotivationIndex] = useState(0);
  const notificationsMutedUntil = shortBreakEndAt || 0;
  const shortBreakActive = !!shortBreakEndAt && Date.now() < shortBreakEndAt;
  

  // Updates a single field inside the student profile form state.
  // For slider fields (study, sleep, social), mark as user-edited to prevent auto-sync override.
  const update = (key, val) => {
    if (["study_hours_per_day", "sleep_hours", "total_social_hours"].includes(key)) {
      if (!userEditedFields.current.has(key)) {
        userEditedFields.current.add(key);
        setManualFieldsVersion((v) => v + 1);
      }
    }
    setForm((f) => ({ ...f, [key]: val }));
  };
  const showPlannerNotice = useCallback((title, message, tone = "warning") => {
    setPlannerNotice({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      tone,
    });
  }, []);

  // Validates and updates the hour/minute inputs used for sleep logging.
  const updateSleepField = (field, value, setter) => {
    if (value === "") {
      setter((prev) => ({ ...prev, [field]: "" }));
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return;

    if (field === "hours") {
      setter((prev) => ({ ...prev, hours: String(Math.min(24, parsed)) }));
      return;
    }

    setter((prev) => ({ ...prev, minutes: String(Math.min(59, parsed)) }));
  };

  // Converts the sleep input fields into a single total-minutes value.
  const getSleepInputMinutes = ({ hours, minutes }) => {
    const parsedHours = Number(hours || 0);
    const parsedMinutes = Number(minutes || 0);

    if (
      Number.isNaN(parsedHours) ||
      Number.isNaN(parsedMinutes) ||
      parsedHours < 0 ||
      parsedMinutes < 0
    ) {
      return null;
    }

    if (parsedHours > 24 || parsedMinutes > 59) return null;
    return parsedHours * 60 + parsedMinutes;
  };

  // Applies a new sleep entry and updates both local state and local storage.
  const applySleepMinutes = (minutesToAdd, { replace = false, requireInitial = false } = {}) => {
    const parsedMinutes = clampSleepMinutes(minutesToAdd);
    const nextInitialMinutes = replace ? parsedMinutes : initialSleepMinutes;
    const nextAdditionalMinutes = replace
      ? additionalSleepMinutes
      : additionalSleepMinutes + parsedMinutes;
    const nextTotal = nextInitialMinutes + nextAdditionalMinutes;
    const nextInitialLogged = requireInitial || replace || !showInitialSleepPrompt;

    if (parsedMinutes < 0) {
      setSleepError("Sleep time cannot be negative.");
      return false;
    }

    if ((!replace && parsedMinutes === 0) || nextTotal > 24 * 60) {
      setSleepError("Please enter a realistic sleep value between 0 minutes and 24 hours.");
      return false;
    }

    writeSleepEntry(
      sleepDateKey,
      nextTotal,
      nextInitialLogged,
      nextInitialMinutes,
      nextAdditionalMinutes,
    );
    setDailySleepMinutes(nextTotal);
    setInitialSleepMinutes(nextInitialMinutes);
    setAdditionalSleepMinutes(nextAdditionalMinutes);
    setShowInitialSleepPrompt(!nextInitialLogged);
    setSleepError("");
    return true;
  };
  // Converts a 12-hour time input into 24-hour values for scheduling.
  const convertTo24Hour = (hour, minute, meridiem) => {
    let h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
  
    if (meridiem === "PM" && h !== 12) h += 12;
    if (meridiem === "AM" && h === 12) h = 0;
  
    return { hour24: h, minute: m };
  };
  
  // Formats a 24-hour clock time into the planner's 12-hour display format.
  const format12Hour = (hours24, minutes) => {
    const meridiem = hours24 >= 12 ? "PM" : "AM";
    let hour12 = hours24 % 12;
    if (hour12 === 0) hour12 = 12;
  
    return `${hour12}:${String(minutes).padStart(2, "0")} ${meridiem}`;
  };
  
  // Builds the scheduled slot, start time, and end time for a new task.
  const calculateTimeSlot = (task) => {
    const { hour24, minute } = convertTo24Hour(
      task.start_hour,
      task.start_minute,
      task.start_meridiem
    );
  
    const startDate = new Date();
    startDate.setHours(hour24, minute, 0, 0);
  
    const endDate = new Date(startDate.getTime() + task.duration_minutes * 60000);
  
    const startLabel = format12Hour(startDate.getHours(), startDate.getMinutes());
    const endLabel = format12Hour(endDate.getHours(), endDate.getMinutes());
  
    return {
      scheduled_slot: `${startLabel} - ${endLabel}`,
      planned_start: startDate.toISOString(),
      planned_end: endDate.toISOString(),
    };
  };


  // Pulls the latest planner task list and summary stats from the backend.
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(getPlannerApiUrl("/api/planner/tasks"));
      if (res.ok) {
        const d = await res.json();
        setTasks(d.tasks || []);
        setTaskStats(d.stats || null);
        setPersistedTodayStudySeconds(Number(d.today_study_seconds || 0));
        if (d.streak_info) setStreakInfo(d.streak_info);
      }
    } catch (_) {}
  }, []);

  // Fetches distraction status and any automatic rescheduling decisions.
  const fetchDistraction = useCallback(async () => {
    try {
      if (Date.now() < notificationsMutedUntil) return;
      const res = await fetch(getPlannerApiUrl("/api/planner/distraction-check"));
      if (res.ok) {
        const d = await res.json();
        setDistractionState(d.distraction_state);
        if (d.auto_reschedule) {
          setRescheduleAlert(d.auto_reschedule);
          fetchTasks();
        }
      }
    } catch (_) {}
  }, [fetchTasks, notificationsMutedUntil]);

  useEffect(() => {
    fetchTasks();
    fetchDistraction();
    const i = setInterval(() => {
      fetchTasks();
      fetchDistraction();
    }, 10000);
    return () => clearInterval(i);
  }, [fetchTasks, fetchDistraction]);

  useEffect(() => {
    syncNotificationPermission();

    const handleVisibilityOrFocus = () => {
      syncNotificationPermission();
    };

    const requestOnInteraction = () => {
      if (latestNotificationPermissionRef.current !== "default") return;
      requestBrowserNotificationPermission();
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pointerdown", requestOnInteraction, { passive: true });
    window.addEventListener("keydown", requestOnInteraction);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pointerdown", requestOnInteraction);
      window.removeEventListener("keydown", requestOnInteraction);
    };
  }, [requestBrowserNotificationPermission, syncNotificationPermission]);

  useEffect(() => {
    const syncSleepDate = () => {
      const nextDateKey = getSleepDateKey();
      setSleepDateKey((prev) => (prev === nextDateKey ? prev : nextDateKey));
    };

    syncSleepDate();
    const id = setInterval(syncSleepDate, 60000);
    window.addEventListener("focus", syncSleepDate);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", syncSleepDate);
    };
  }, []);

  useEffect(() => {
    const entry = readSleepEntry(sleepDateKey);
    setDailySleepMinutes(entry.totalMinutes);
    setInitialSleepMinutes(entry.initialMinutes);
    setAdditionalSleepMinutes(entry.additionalMinutes);
    setShowInitialSleepPrompt(!entry.initialLogged);
    setSleepError("");
    setInitialSleepInput({ hours: "", minutes: "" });
    setSleepInput({ hours: "", minutes: "" });
  }, [sleepDateKey]);

  useEffect(() => {
    setSocialStorageLoaded(false);
    const entry = readSocialEntry(sleepDateKey);
    setSocialSeconds(entry.totalSeconds);
    setSocialTimerRunning(entry.isRunning);
    setSocialTimerStartedAt(entry.startedAt);
    setSocialTimerTick(0);
    setSocialStorageLoaded(true);
  }, [sleepDateKey]);

  useEffect(() => {
    // Only auto-sync if the user hasn't manually adjusted this slider
    if (userEditedFields.current.has("sleep_hours")) return;
    setForm((prev) => ({
      ...prev,
      sleep_hours: Number((dailySleepMinutes / 60).toFixed(2)),
    }));
  }, [dailySleepMinutes]);

  useEffect(() => {
    if (!socialTimerRunning || !socialTimerStartedAt) return;

    const id = setInterval(() => {
      setSocialTimerTick((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(id);
  }, [socialTimerRunning, socialTimerStartedAt]);

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!socialStorageLoaded) return;

    writeSocialEntry(
      sleepDateKey,
      socialSeconds,
      socialTimerRunning,
      socialTimerRunning ? socialTimerStartedAt : null,
    );
  }, [sleepDateKey, socialSeconds, socialStorageLoaded, socialTimerRunning, socialTimerStartedAt]);

  useEffect(() => {
    if (Date.now() < notificationsMutedUntil) return;
    if (startReminderTask) return;

    const now = Date.now();
    const dueTasks = tasks
      .filter((t) => {
        const pendingLike = t.status === "pending" || t.status === "rescheduled";
        if (!pendingLike || !t.planned_start) return false;

        const startTs = new Date(t.planned_start).getTime();
        if (Number.isNaN(startTs) || now < startTs) return false;

        if (t.planned_end) {
          const endTs = new Date(t.planned_end).getTime();
          if (!Number.isNaN(endTs) && now >= endTs) return false;
        }

        const coolDownUntil = startReminderCooldown[t.id] || 0;
        return now >= coolDownUntil;
      })
      .sort(
        (a, b) =>
          new Date(a.planned_start).getTime() - new Date(b.planned_start).getTime(),
      );

    if (dueTasks.length > 0) {
      const nextTask = dueTasks[0];
      setStartReminderTask(nextTask);
      setStartReminderCooldown((prev) => ({
        ...prev,
        [nextTask.id]: Date.now() + 60 * 1000,
      }));
    }
  }, [tasks, startReminderTask, startReminderCooldown, notificationsMutedUntil]);

  useEffect(() => {
    if (Date.now() < notificationsMutedUntil) {
      setStartReminderTask(null);
      return;
    }
    if (!startReminderTask) return;
    const latestTask = tasks.find((t) => String(t.id) === String(startReminderTask.id));
    if (!latestTask) {
      setStartReminderTask(null);
      return;
    }
    if (latestTask.status !== "pending" && latestTask.status !== "rescheduled") {
      setStartReminderTask(null);
      return;
    }
    setStartReminderTask(latestTask);
  }, [tasks, startReminderTask, notificationsMutedUntil]);

  useEffect(() => {
    if (!startReminderTask || shortBreakActive) return;

    const reminderKey = `${startReminderTask.id}:${startReminderTask.scheduled_slot || "planned"}`;
    if (lastStartReminderNotificationRef.current === reminderKey) return;

    lastStartReminderNotificationRef.current = reminderKey;
    showBrowserNotification({
      title: "Study task reminder",
      body: `It's time to start "${startReminderTask.subject}"${startReminderTask.scheduled_slot ? ` at ${startReminderTask.scheduled_slot}` : ""}.`,
      tag: `planner-start-${startReminderTask.id}`,
    });
  }, [shortBreakActive, showBrowserNotification, startReminderTask]);

  useEffect(() => {
    if (!rescheduleAlert || shortBreakActive) return;

    const rescheduleKey = `${rescheduleAlert.task_subject}:${rescheduleAlert.new_slot}`;
    if (lastRescheduleNotificationRef.current === rescheduleKey) return;

    lastRescheduleNotificationRef.current = rescheduleKey;
    showBrowserNotification({
      title: "Task rescheduled",
      body: `"${rescheduleAlert.task_subject}" moved to ${rescheduleAlert.new_slot}.`,
      tag: `planner-reschedule-${rescheduleAlert.task_subject}`,
    });
  }, [rescheduleAlert, shortBreakActive, showBrowserNotification]);

  useEffect(() => {
    if (!shortBreakEndAt) return;
    const tick = () => {
      const remain = Math.max(0, Math.ceil((shortBreakEndAt - Date.now()) / 1000));
      setShortBreakRemainingSeconds(remain);
      if (remain <= 0) setShortBreakEndAt(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [shortBreakEndAt]);

  useEffect(() => {
    if (!shortBreakActive) return;
    const id = setInterval(() => {
      setBreakMotivationIndex((prev) => (prev + 1) % 5);
    }, 8000);
    return () => clearInterval(id);
  }, [shortBreakActive]);

  useEffect(() => {
    if (!plannerNotice) return;
    const id = setTimeout(() => setPlannerNotice(null), 4200);
    return () => clearTimeout(id);
  }, [plannerNotice]);

  // Creates a new planner task after validating the requested start time.
  const handleAddTask = async () => {
    if (
      !newTask.subject.trim() ||
      !newTask.start_hour ||
      !newTask.start_minute ||
      !newTask.start_meridiem
    ) {
      setAddTaskError("Add a subject before creating the task.");
      addTaskInputRef.current?.focus();
      showPlannerNotice(
        "Task details missing",
        "Add a subject and choose a start time before creating the session.",
      );
      return;
    }

    setAddTaskError("");
  
    try {
      const slotInfo = calculateTimeSlot(newTask);
      const newTaskStartTime = new Date(slotInfo.planned_start).getTime();
      const existingTaskAtSameTime = tasks.find((task) => {
        const taskStartTime = getTaskStartTime(task);
        return (
          taskStartTime !== Number.MAX_SAFE_INTEGER &&
          taskStartTime === newTaskStartTime
        );
      });

      if (existingTaskAtSameTime) {
        setAddTaskError("That start time is already reserved.");
        showPlannerNotice(
          "Time slot already reserved",
          "That start time is already assigned. Pick another slot to keep the plan clean.",
        );
        return;
      }
  
      const res = await fetch(getPlannerApiUrl("/api/planner/tasks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTask,
          scheduled_slot: slotInfo.scheduled_slot,
          planned_start: slotInfo.planned_start,
          planned_end: slotInfo.planned_end,
        }),
      });
  
      if (!res.ok) {
        let errMessage = "Failed to add task.";
        try {
          const errData = await res.json();
          errMessage = errData.error || errMessage;
        } catch (_) {
          const errText = await res.text();
          console.error("Add task failed:", errText);
        }
        setAddTaskError(errMessage);
        showPlannerNotice("Unable to add task", errMessage);
        return;
      }
  
      await res.json();
  
      setNewTask({
        subject: "",
        duration_minutes: 60,
        priority: "medium",
        scheduled_slot: "",
        start_hour: "12",
        start_minute: "00",
        start_meridiem: "AM",
        notes: "",
      });
      setAddTaskError("");
      console.log("SENDING TASK:", {
        ...newTask,
        planned_start: slotInfo.planned_start,
        planned_end: slotInfo.planned_end,
      });
  
      setShowAddTask(false);
      fetchTasks();
    } catch (err) {
      console.error("Add task error:", err);
      setAddTaskError("The task could not be saved right now.");
      showPlannerNotice(
        "Planner request failed",
        "The task could not be saved right now. Try again in a moment.",
      );
    }
  };

  // Starts the task that was surfaced by the reminder popup.
  const handleStartReminderStart = async () => {
    if (!startReminderTask) return;
    await handleStartTimer(startReminderTask);
    setStartReminderTask(null);
  };

  // Defers the start reminder for a short cooldown period.
  const handleStartReminderLater = () => {
    if (!startReminderTask) return;
    setStartReminderCooldown((prev) => ({
      ...prev,
      [startReminderTask.id]: Date.now() + 2 * 60 * 1000,
    }));
    setStartReminderTask(null);
  };

  // Starts a break timer that temporarily mutes planner alerts.
  const startShortBreak = () => {
    const mins = Number(breakMinutesInput);
    const clamped = Math.max(1, Math.min(59, Math.floor(mins || 0)));
    const endAt = Date.now() + clamped * 60 * 1000;
    setShortBreakEndAt(endAt);
    setShortBreakRemainingSeconds(clamped * 60);
    setShowBreakDurationPicker(false);
  };

  // Pre-fills the add-task form with a quick short study session.
  const handleAddSmallTask = () => {
    const now = new Date();
    const hr = now.getHours();
    const min = now.getMinutes();
    const roundedMin = Math.ceil(min / 15) * 15;
    const normalizedDate = new Date(now);
    normalizedDate.setMinutes(roundedMin === 60 ? 0 : roundedMin, 0, 0);
    if (roundedMin === 60) normalizedDate.setHours(hr + 1);

    const hour24 = normalizedDate.getHours();
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const minute = String(normalizedDate.getMinutes()).padStart(2, "0");
    const meridiem = hour24 >= 12 ? "PM" : "AM";

    setNewTask((prev) => ({
      ...prev,
      subject: prev.subject || "Quick revision",
      duration_minutes: 15,
      priority: "low",
      start_hour: String(hour12),
      start_minute: minute,
      start_meridiem: meridiem,
    }));
    setShowAddTask(true);
    setShowBreakDurationPicker(false);
  };

  const breakMotivationMessages = [
    "Take your rest. You have earned this pause.",
    "Breathe in, breathe out. You are doing great.",
    "Reset your mind now. Your next focus block will be stronger.",
    "Small breaks build big consistency. Keep going.",
    "Relax for a moment. Progress is still progress.",
  ];

  // Saves the first sleep entry that unlocks prediction for the day.
  const handleInitialSleepSubmit = () => {
    const minutes = getSleepInputMinutes(initialSleepInput);

    if (minutes == null) {
      setSleepError("Enter valid sleep hours and minutes.");
      return;
    }

    if (minutes > 24 * 60) {
      setSleepError("Sleep time cannot be more than 24 hours.");
      return;
    }

    if (applySleepMinutes(minutes, { replace: true, requireInitial: true })) {
      setInitialSleepInput({ hours: "", minutes: "" });
    }
  };

  // Adds extra sleep time after the initial sleep entry has been recorded.
  const handleSleepAdd = () => {
    const minutes = getSleepInputMinutes(sleepInput);

    if (minutes == null) {
      setSleepError("Enter valid sleep hours and minutes.");
      return;
    }

    if (minutes === 0) {
      setSleepError("Add at least 1 minute of sleep.");
      return;
    }

    if (applySleepMinutes(minutes)) {
      setSleepInput({ hours: "", minutes: "" });
    }
  };

  // Starts tracking the current social-media session from now.
  const startSocialTimer = () => {
    if (socialTimerRunning) return;

    const startedAt = new Date().toISOString();
    setSocialTimerRunning(true);
    setSocialTimerStartedAt(startedAt);
    setSocialTimerTick(0);
    writeSocialEntry(sleepDateKey, socialSeconds, true, startedAt);
  };
  
  // Deletes a selected task and refreshes the planner state.
  const deleteTask = async (id) => {
    try {
      const res = await fetch(getPlannerApiUrl(`/api/planner/tasks/${id}`), {
        method: "DELETE",
      });
  
      if (!res.ok) {
        const errText = await res.text();
        console.error("Delete task failed:", errText);
        return;
      }
  
      await res.json();
      fetchTasks();
    } catch (error) {
      console.error("Delete task error:", error);
    }
  };

  // Main prediction request: sends the latest student inputs + task schedule to the API.
  const handlePredict = useCallback(async () => {
    if (!canShowPrediction) {
      setError(null);
      return;
    }

    if (predictionInFlightRef.current) return;

    // â”€â”€ Zero-input short-circuit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // When all activity values are zero (no manual data entered,
    // no live data tracked), skip the API call and show 0%.
    const activeForm = latestFormRef.current || form;
    const study = Number(activeForm.study_hours_per_day || 0);
    const sleep = Number(activeForm.sleep_hours || 0);
    const social = Number(activeForm.total_social_hours || 0);
    const allZero = study < 0.01 && sleep < 0.01 && social < 0.01;

    if (allZero) {
      const zeroResult = {
        success: true,
        task_completion_probability: 0,
        prediction: 0,
        recommendation: "no_data",
        confidence_tier: "none",
        planner_decision: "Fill in the planner inputs to generate a prediction.",
        feedback: {
          feedback_type: "recovery",
          message: "Enter your study, sleep, and social hours to get a meaningful prediction.",
          suggested_action: "Fill in the planner inputs above to generate your plan.",
        },
      };
      latestPredictionRef.current = zeroResult;
      visiblePredictionRef.current = zeroResult;
      setResult(zeroResult);
      return;
    }
    // â”€â”€ End zero-input short-circuit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    predictionInFlightRef.current = true;
    setError(null);
    try {
      const activeTasks = latestTasksRef.current || tasks;
      const schedule = activeTasks.map((t) => ({
        time: t.scheduled_slot || "",
        status: t.status === "completed" ? "occupied" : "free",
      }));
      const res = await fetch(getPlannerApiUrl("/api/planner/predict"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...activeForm, schedule }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data?.success === false) {
        throw new Error(data.error || "Prediction failed");
      }
      if (typeof data?.task_completion_probability !== "number") {
        throw new Error("Planner prediction response is missing task_completion_probability");
      }
      latestPredictionRef.current = data;

      // ── Smart suggestion cooldown ──────────────────────────────────
      // Only update the visible suggestion when distraction probability
      // changes by >15% OR it has been >20 minutes since the last update.
      const newProb = typeof data.task_completion_probability === "number"
        ? data.task_completion_probability
        : 0;
      const lastProb = lastSuggestionProbRef.current;
      const now = Date.now();
      const msSinceLastSuggestion = now - lastSuggestionTimeRef.current;
      const COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes
      const PROB_CHANGE_THRESHOLD = 0.15;  // 15% swing

      const probChanged = lastProb === null
        || Math.abs(newProb - lastProb) >= PROB_CHANGE_THRESHOLD;
      const cooldownExpired = msSinceLastSuggestion >= COOLDOWN_MS;

      if (probChanged || cooldownExpired) {
        visiblePredictionRef.current = data;
        setResult(data);
        lastSuggestionProbRef.current = newProb;
        lastSuggestionTimeRef.current = now;
      }
      // Always persist the latest raw prediction (used for ring/badge updates)
      setResult((prev) => ({
        ...prev,
        task_completion_probability: data.task_completion_probability,
        prediction: data.prediction,
        confidence_tier: data.confidence_tier,
      }));
      if (data.task_stats) setTaskStats(data.task_stats);
      if (data.streak_info) setStreakInfo(data.streak_info);
    } catch (err) {
      setError(err.message || "Prediction failed");
    } finally {
      predictionInFlightRef.current = false;
    }
  }, [canShowPrediction]);

  const filteredTasks = useMemo(() => [...tasks].sort(sortTasksByStartTime), [tasks]);

  const feedbackConf = {
    recovery: { icon: Coffee, color: "#ef4444" },
    missed_support: { icon: CalendarCheck, color: "#f59e0b" },
    refocus: { icon: Brain, color: "#f59e0b" },
    streak: { icon: Flame, color: "#10b981" },
    praise: { icon: Trophy, color: "#10b981" },
    encourage: { icon: TrendingUp, color: "#818cf8" },
    distraction_warning: { icon: AlertCircle, color: "#ef4444" },
    auto_reschedule: { icon: RefreshCw, color: "#a855f7" },
  };

  const completedCount = taskStats?.completed || 0;
  const totalCount = taskStats?.total || tasks.length || 0;
  const currentStreak = streakInfo?.current_streak || 0;
  const focusRate = streakInfo ? Math.round(streakInfo.focus_rate || 0) : null;
  const activeCount = tasks.filter((t) => t.status === "active").length;
  const pendingCount = tasks.filter(
    (t) => t.status === "pending" || t.status === "rescheduled",
  ).length;
  const dailySleepLabel = formatSleepDuration(dailySleepMinutes);
  const initialSleepLabel = formatSleepDuration(initialSleepMinutes);
  const additionalSleepLabel = formatSleepDuration(additionalSleepMinutes);
  const liveSocialSeconds =
    socialSeconds + (socialTimerRunning ? getCurrentSocialSessionSeconds() : 0);
  const dailySocialLabel = formatHoursMinutesFromSeconds(liveSocialSeconds);
  const liveSocialTimerLabel = formatClockDuration(liveSocialSeconds);
  const socialLimitExceeded = liveSocialSeconds >= 2 * 3600;
  const todayStudySeconds =
    persistedTodayStudySeconds + (isRunning && activeTaskId ? getCurrentSessionElapsedSeconds() : 0);
  const statusTone = distractionState?.is_distracted ? "#ef4444" : "#10b981";
  const statusLabel = distractionState
    ? distractionState.is_distracted
      ? `Distracted ${Math.round((distractionState.confidence || 0) * 100)}%`
      : "Focused"
    : "Monitoring";
  const activeTask =
    tasks.find((t) => String(t.id) === String(activeTaskId)) ||
    tasks.find((t) => t.status === "active") ||
    null;
  const nextPlannedTask =
    [...tasks]
      .filter((t) => t.status === "pending" || t.status === "rescheduled")
      .sort(sortTasksByStartTime)[0] || null;
  const plannerSummaryText = activeTask
    ? `You are currently working on ${activeTask.subject}.`
    : nextPlannedTask
      ? `Your next planned task is ${nextPlannedTask.subject}.`
      : "Add your first task to build a simple study plan for today.";
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const recentCompletedTasks = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.status === "completed")
        .sort((a, b) => getTaskStartTime(b) - getTaskStartTime(a))
        .slice(0, 5),
    [tasks],
  );
  const recentMissedTasks = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.status === "missed")
        .sort((a, b) => getTaskStartTime(b) - getTaskStartTime(a))
        .slice(0, 5),
    [tasks],
  );
  const ongoingOverviewTask = activeTask || nextPlannedTask || null;
  const planningConfidencePct = Math.round((result?.task_completion_probability || 0) * 100);
  const plannerHeroTitle = result
    ? result.recommendation === "no_data"
      ? "Enter your inputs to start."
      : result.prediction === 1
        ? "Your plan is holding."
        : "Your plan needs adjustment."
    : activeTask
      ? "Stay with the active block."
      : "Build a plan that adapts.";
  const plannerHeroCopy = result?.planner_decision
    || result?.feedback?.message
    || plannerSummaryText;
  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  useEffect(() => {
    latestTasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    // Only auto-sync if the user hasn't manually adjusted this slider
    if (userEditedFields.current.has("total_social_hours")) return;
    setForm((prev) => ({
      ...prev,
      total_social_hours: Number((liveSocialSeconds / 3600).toFixed(2)),
    }));
  }, [liveSocialSeconds]);

  useEffect(() => {
    // Only auto-sync if the user hasn't manually adjusted this slider
    if (userEditedFields.current.has("study_hours_per_day")) return;
    setForm((prev) => ({
      ...prev,
      study_hours_per_day: Number((todayStudySeconds / 3600).toFixed(2)),
    }));
  }, [todayStudySeconds]);

  useEffect(() => {
    if (canShowPrediction) return;

    visiblePredictionRef.current = null;
    setResult(null);
    setError(null);
  }, [canShowPrediction]);

  // Runs a prediction immediately when the page state changes enough to rebuild the callback.
  useEffect(() => {
    handlePredict();
  }, [handlePredict]);

  // Polls the backend regularly so the prediction can update during the demo.
  useEffect(() => {
    const id = setInterval(() => {
      handlePredict();
    }, 3000);

    return () => clearInterval(id);
  }, [handlePredict]);

  // Applies the newest prediction numeric values (ring, badge) on its own cadence,
  // but does NOT overwrite the visible feedback/suggestion while the cooldown is active.
  useEffect(() => {
    const id = setInterval(() => {
      if (!canShowPrediction) return;
      if (!latestPredictionRef.current) return;
      if (latestPredictionRef.current === visiblePredictionRef.current) return;
      const latest = latestPredictionRef.current;
      // Only propagate probability-ring updates; leave feedback text to cooldown logic.
      setResult((prev) => {
        if (!prev) return latest;
        return {
          ...prev,
          task_completion_probability: latest.task_completion_probability,
          prediction: latest.prediction,
          confidence_tier: latest.confidence_tier,
        };
      });
    }, 4000);

    return () => clearInterval(id);
  }, [canShowPrediction]);


  return (
    <div className="flex min-h-screen bg-[#040816] text-white">
      <Sidebar active="Planner" />

      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 backdrop-blur-xl lg:px-8"
          style={{
            background: "rgba(2,5,13,0.92)",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            zIndex: 40,
          }}
        >
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] uppercase tracking-[0.25em] font-bold mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Smart Planning
            </p>
            <h1
              className="text-lg font-black tracking-tight leading-none mb-1"
              style={{ color: "var(--text-primary)" }}
            >
              Planner
            </h1>
            <p
              className="text-[11px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          <div
            className="hidden md:flex flex-col items-center justify-center px-6 py-2 rounded-2xl flex-shrink-0"
            style={{
              background: dark ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)",
              border: "1px solid var(--border)",
              boxShadow: dark ? "inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            <p
              className="text-[9px] uppercase tracking-[0.2em] font-bold mb-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Current time
            </p>
            <p
              className="text-xl font-black tracking-tighter"
              style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
            >
              {currentTime.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          </div>

          <div className="flex-1 flex items-center justify-end gap-2.5">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
              style={{
                background: `var(--bg-card)`,
                border: `1px solid var(--border)`,
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: statusTone,
                  boxShadow: `0 0 8px ${statusTone}`,
                  animation: "pulse 2s infinite",
                }}
              />
              <span className="text-[11px] font-bold" style={{ color: statusTone }}>{statusLabel}</span>
            </div>
            
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <span className="text-[11px] font-bold" style={{ color: "#818cf8" }}>
                {totalCount > 0
                  ? `${completedCount}/${totalCount} completed`
                  : "No tasks"}
              </span>
            </div>

            <button
              onClick={() => {
                if (notificationPermission !== "granted") {
                  requestBrowserNotificationPermission();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all hover:opacity-80"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                cursor: notificationPermission === "granted" ? "default" : "pointer",
              }}
            >
              <span 
                className="text-[11px] font-bold"
                style={{
                  color: notificationPermission === "granted" ? "#10b981" : notificationPermission === "denied" ? "#ef4444" : "#f59e0b"
                }}
              >
                {notificationPermission === "granted"
                  ? "Notifications on"
                  : notificationPermission === "denied"
                    ? "Notifications blocked"
                    : "Enable notifications"}
              </span>
            </button>
          </div>
        </header>

        {rescheduleAlert && !shortBreakActive && (
          <div className="max-w-[1440px] mx-auto w-full px-6 lg:px-8 pt-5">
            <div
              className="p-4 rounded-[24px] flex items-center gap-3 planner-card"
              style={{
                background: "rgba(168,85,247,0.06)",
                border: "1px solid rgba(168,85,247,0.12)",
              }}
            >
              <RefreshCw
                className="w-4 h-4 flex-shrink-0"
                style={{ color: "#a855f7" }}
              />
              <p
                className="text-xs flex-1"
                style={{ color: "var(--text-secondary)" }}
              >
                <strong style={{ color: "#a855f7" }}>Auto-rescheduled</strong> "
                {rescheduleAlert.task_subject}" moved to{" "}
                {rescheduleAlert.new_slot}
              </p>
              <button
                onClick={() => setRescheduleAlert(null)}
                className="p-1 rounded-lg hover:opacity-60"
              >
                <X
                  className="w-3.5 h-3.5"
                  style={{ color: "var(--text-muted)" }}
                />
              </button>
            </div>
          </div>
        )}

        {plannerNotice && (
          <div className="max-w-[1440px] mx-auto w-full px-6 lg:px-8 pt-5">
            <div
              className="p-4 rounded-[24px] flex items-start gap-3 planner-card"
              style={{
                background:
                  plannerNotice.tone === "danger"
                    ? "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(127,29,29,0.22))"
                    : "linear-gradient(135deg, rgba(129,140,248,0.12), rgba(17,24,39,0.38))",
                border:
                  plannerNotice.tone === "danger"
                    ? "1px solid rgba(248,113,113,0.28)"
                    : "1px solid rgba(129,140,248,0.24)",
                boxShadow:
                  plannerNotice.tone === "danger"
                    ? "0 18px 45px rgba(127,29,29,0.18), inset 0 1px 0 rgba(255,255,255,0.05)"
                    : "0 18px 45px rgba(79,70,229,0.16), inset 0 1px 0 rgba(255,255,255,0.05)",
                animation: "plannerNoticeEnter 260ms ease-out",
              }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background:
                    plannerNotice.tone === "danger"
                      ? "rgba(239,68,68,0.16)"
                      : "rgba(129,140,248,0.16)",
                  color: plannerNotice.tone === "danger" ? "#f87171" : "#818cf8",
                }}
              >
                <AlertCircle className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[10px] uppercase tracking-[0.24em] font-black"
                    style={{
                      color: plannerNotice.tone === "danger" ? "#fca5a5" : "#a5b4fc",
                    }}
                  >
                    Planner notice
                  </span>
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: plannerNotice.tone === "danger" ? "#f87171" : "#818cf8",
                    }}
                  />
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Action needed
                  </span>
                </div>
                <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {plannerNotice.title}
                </p>
                <p className="text-xs leading-6" style={{ color: "var(--text-secondary)" }}>
                  {plannerNotice.message}
                </p>
              </div>

              <button
                onClick={() => setPlannerNotice(null)}
                className="p-1.5 rounded-xl hover:opacity-75 transition-opacity"
                aria-label="Dismiss planner notice"
              >
                <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-[1440px] mx-auto w-full px-6 lg:px-8 pt-5">
            <div
              className="p-4 rounded-[24px] flex items-start gap-3 planner-card"
              style={{
                background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(127,29,29,0.22))",
                border: "1px solid rgba(248,113,113,0.28)",
                boxShadow: "0 18px 45px rgba(127,29,29,0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: "rgba(239,68,68,0.16)",
                  color: "#f87171",
                }}
              >
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  Planner prediction failed
                </p>
                <p className="text-xs leading-6" style={{ color: "var(--text-secondary)" }}>
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1440px] mx-auto w-full">
          <section className="glass-card p-6 lg:p-8 mb-6 relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.9fr] gap-6 items-start">
              <div>
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 shadow-sm"
                  style={{
                    background: "rgba(129,140,248,0.12)",
                    color: "#a5b4fc",
                    border: "1px solid rgba(129,140,248,0.18)",
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">
                    Adaptive Planner
                  </span>
                </div>
                <p
                  className="text-[10px] uppercase tracking-[0.28em] font-bold mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  Smart Planning Workspace
                </p>
                <h2
                  className="text-[2rem] lg:text-[3.4rem] font-black leading-[0.95] tracking-tight max-w-[700px] mb-4"
                  style={{ color: "var(--text-primary)" }}
                >
                  {plannerHeroTitle}
                </h2>
                <p
                  className="text-sm lg:text-base max-w-[620px] leading-8 font-medium mb-6"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {plannerHeroCopy}
                </p>

                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      label: "Current Task",
                      value: activeTask?.subject || "No active task",
                      icon: CalendarCheck,
                      tone: "#8b5cf6",
                    },
                    {
                      label: "Prediction Confidence",
                      value: `${planningConfidencePct}%`,
                      icon: Zap,
                      tone: result?.prediction === 1 ? "#34d399" : "#f59e0b",
                    },
                    {
                      label: "Focused Time",
                      value: formatCompactStudyDuration(todayStudySeconds),
                      icon: Brain,
                      tone: "#06b6d4",
                    },
                  ].map(({ label, value, icon: Icon, tone }) => (
                    <div
                      key={label}
                      className="rounded-[28px] p-5 transition-all"
                      style={{
                        background: "linear-gradient(180deg, rgba(20,24,38,0.92), rgba(10,14,24,0.92))",
                        border: "1px solid rgba(255,255,255,0.04)",
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 36px rgba(2,6,23,0.22)`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[10px] uppercase tracking-[0.22em] font-bold" style={{ color: "var(--text-muted)" }}>
                          {label}
                        </span>
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center"
                          style={{ background: `${tone}14`, boxShadow: `inset 0 1px 0 ${tone}20` }}
                        >
                          <Icon className="w-4 h-4" style={{ color: tone }} />
                        </div>
                      </div>
                      <div className="mt-6 text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="rounded-[34px] p-6 flex flex-col items-center justify-center min-h-[360px]"
                style={{
                  background: "linear-gradient(180deg, rgba(13,17,31,0.95), rgba(8,11,20,0.95))",
                  border: "1px solid rgba(255,255,255,0.04)",
                  boxShadow: "0 24px 50px rgba(2,6,23,0.24), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <ProbabilityRing value={result?.task_completion_probability || 0} />
                <p
                  className="mt-5 text-[11px] uppercase tracking-[0.3em] font-bold"
                  style={{ color: "var(--text-muted)" }}
                >
                  Plan Status
                </p>
                <div
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{
                    background: result?.recommendation === "no_data"
                      ? "rgba(100,116,139,0.12)"
                      : result?.prediction === 1 ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                    color: result?.recommendation === "no_data"
                      ? "#94a3b8"
                      : result?.prediction === 1 ? "#34d399" : "#fb7185",
                    border: `1px solid ${result?.recommendation === "no_data"
                      ? "rgba(100,116,139,0.2)"
                      : result?.prediction === 1 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
                  }}
                >
                  <span className="text-sm font-semibold">
                    {result
                      ? result.recommendation === "no_data"
                        ? "No Data"
                        : result.prediction === 1
                          ? "Focused"
                          : "Needs Adjustment"
                      : "Monitoring"}
                  </span>
                </div>
                <p className="mt-4 text-center text-sm leading-7 max-w-[280px]" style={{ color: "var(--text-secondary)" }}>
                  {result?.feedback?.message || plannerSummaryText}
                </p>
              </div>
            </div>
          </section>

          <section className="mb-6">
            <div className="grid grid-cols-1 gap-6">
            <section className="glass-card flex flex-col h-full p-6 lg:p-7">
              <div className="text-left mb-5">
                <p
                  className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1"
                  style={{ color: "var(--text-muted)" }}
                  >
                  Task Overview
                </p>
                <h2
                  className="text-sm font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Switch between ongoing, completed, and missed work
                </h2>
                <p
                  className="text-[11px] mt-2 leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  View one task state at a time instead of showing every category together.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  { key: "ongoing", label: "Ongoing", count: ongoingOverviewTask ? 1 : 0, color: "#8b5cf6" },
                  { key: "completed", label: "Completed", count: recentCompletedTasks.length, color: "#34d399" },
                  { key: "missed", label: "Missed", count: recentMissedTasks.length, color: "#fb7185" },
                ].map((item) => {
                  const active = taskOverviewMode === item.key;

                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTaskOverviewMode(item.key)}
                      className="px-4 py-2 rounded-full text-[11px] font-semibold transition-all"
                      style={{
                        background: active ? `${item.color}20` : "rgba(15,23,42,0.6)",
                        color: active ? item.color : "var(--text-secondary)",
                        border: active ? `1px solid ${item.color}45` : "1px solid rgba(255,255,255,0.06)",
                        boxShadow: active ? `0 10px 20px ${item.color}18` : "none",
                      }}
                    >
                      {item.label} ({item.count})
                    </button>
                  );
                })}
              </div>

              <div
                className="rounded-[24px] p-5 mb-6"
                style={{
                  background: "linear-gradient(180deg, rgba(10,15,27,0.98), rgba(7,10,18,0.98))",
                  border: "1px solid rgba(255,255,255,0.05)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                {taskOverviewMode === "ongoing" ? (
                  ongoingOverviewTask ? (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                          {activeTask ? "Running now" : "Next up"}
                        </p>
                        <p className="mt-3 text-2xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                          {ongoingOverviewTask.subject}
                        </p>
                        <p className="mt-2 text-[11px] leading-6" style={{ color: "var(--text-secondary)" }}>
                          {ongoingOverviewTask.scheduled_slot || "No scheduled slot"}
                        </p>
                        <p className="text-[11px] leading-6" style={{ color: "var(--text-secondary)" }}>
                          {activeTask ? `Remaining: ${formatTime(timeLeft)}` : "Start this task from the queue when ready."}
                        </p>
                        {activeTask && (
                          <div className="mt-5">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                                Session Progress
                              </span>
                              <span className="text-[11px] font-semibold" style={{ color: "#a5b4fc" }}>
                                {Math.round(
                                  Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      ((activeTaskRemainingAtStart - timeLeft) / Math.max(activeTaskRemainingAtStart, 1)) * 100,
                                    ),
                                  ),
                                )}
                                %
                              </span>
                            </div>
                            <div
                              className="relative h-3 overflow-hidden rounded-full"
                              style={{
                                background: "rgba(15,23,42,0.88)",
                                border: "1px solid rgba(129,140,248,0.12)",
                                boxShadow: "inset 0 1px 4px rgba(0,0,0,0.35)",
                              }}
                            >
                              <div
                                className="planner-ongoing-loader absolute inset-y-0 left-0 rounded-full"
                                style={{
                                  width: `${Math.max(
                                    6,
                                    Math.min(
                                      100,
                                      ((activeTaskRemainingAtStart - timeLeft) / Math.max(activeTaskRemainingAtStart, 1)) * 100,
                                    ),
                                  )}%`,
                                  background:
                                    "linear-gradient(90deg, rgba(129,140,248,0.88), rgba(56,189,248,0.9), rgba(52,211,153,0.88))",
                                  boxShadow: "0 0 18px rgba(99,102,241,0.28)",
                                }}
                              />
                              <div
                                className="planner-ongoing-loader-glow absolute inset-y-[2px] rounded-full"
                                style={{
                                  width: `${Math.max(
                                    6,
                                    Math.min(
                                      100,
                                      ((activeTaskRemainingAtStart - timeLeft) / Math.max(activeTaskRemainingAtStart, 1)) * 100,
                                    ),
                                  )}%`,
                                }}
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                                Elapsed {formatTime(Math.max(0, activeTaskRemainingAtStart - timeLeft))}
                              </span>
                              <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                                Remaining {formatTime(timeLeft)}
                              </span>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                              <button
                                onClick={() => handleFinishTask(activeTask)}
                                className="px-4 py-2 rounded-xl text-[11px] font-semibold"
                                style={{
                                  color: "#10b981",
                                  background: "rgba(16,185,129,0.12)",
                                  border: "1px solid rgba(16,185,129,0.22)",
                                }}
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => {
                                  if (activeTaskId === activeTask.id && isRunning) {
                                    showPlannerNotice(
                                      "Task canâ€™t be removed yet",
                                      "Pause the running session first, then remove it from your queue.",
                                    );
                                    return;
                                  }
                                  deleteTask(activeTask.id);
                                }}
                                className="px-4 py-2 rounded-xl text-[11px] font-semibold"
                                style={{
                                  color: "#ef4444",
                                  background: "rgba(239,68,68,0.1)",
                                  border: "1px solid rgba(239,68,68,0.2)",
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <span
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                        style={{
                          background: activeTask ? "rgba(16,185,129,0.12)" : "rgba(129,140,248,0.12)",
                          color: activeTask ? "#34d399" : "#a5b4fc",
                          border: activeTask ? "1px solid rgba(16,185,129,0.24)" : "1px solid rgba(129,140,248,0.24)",
                        }}
                      >
                        {activeTask ? "Ongoing" : "Queued"}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                      No ongoing task right now. Use the add-task form below to create the next study block.
                    </p>
                  )
                ) : (
                  <div className="space-y-3">
                    {(taskOverviewMode === "completed" ? recentCompletedTasks : recentMissedTasks).length > 0 ? (
                      (taskOverviewMode === "completed" ? recentCompletedTasks : recentMissedTasks).map((task) => (
                        <div
                          key={`${taskOverviewMode}-${task.id}`}
                          className="flex items-center justify-between gap-4 rounded-[18px] px-4 py-3"
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                              {task.subject}
                            </p>
                            <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                              {task.scheduled_slot || "No scheduled slot"}
                            </p>
                          </div>
                          <span
                            className="text-[11px] font-semibold whitespace-nowrap"
                            style={{ color: taskOverviewMode === "completed" ? "#34d399" : "#fb7185" }}
                          >
                            {task.duration_minutes}m
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        {taskOverviewMode === "completed"
                          ? "No completed tasks yet. Finished tasks will appear here."
                          : "No missed tasks so far. Missed tasks will appear here if a block is skipped."}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div
                className="rounded-[24px] p-5 planner-subtle"
                style={{ border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between gap-4 mb-5">
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-[0.22em] font-semibold mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Add Task
                    </p>
                    <h3
                      className="text-sm font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Create the next study block from here
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAddTask((prev) => !prev)}
                    className="px-5 h-10 rounded-xl flex items-center justify-center transition-all text-xs font-bold transform active:scale-95"
                    style={{
                      background: showAddTask
                        ? "rgba(239,68,68,0.15)"
                        : "linear-gradient(to right, #10b981, #059669)",
                      color: showAddTask ? "#ef4444" : "#ffffff",
                      border: showAddTask
                        ? "1px solid rgba(239,68,68,0.3)"
                        : "1px solid transparent",
                      boxShadow: showAddTask
                        ? "none"
                        : "0 4px 12px rgba(16,185,129,0.3)",
                    }}
                  >
                    {showAddTask ? "Close Form" : "Add Task"}
                  </button>
                </div>

                {showAddTask ? (
                  <div className="space-y-3">
                    <input
                      ref={addTaskInputRef}
                      value={newTask.subject}
                      placeholder="What do you need to study?"
                      onChange={(e) => {
                        setNewTask((t) => ({ ...t, subject: e.target.value }));
                        if (addTaskError) setAddTaskError("");
                      }}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                      className="w-full px-0 py-2 text-sm font-medium outline-none bg-transparent placeholder:text-[var(--text-muted)]"
                      style={{
                        color: "var(--text-primary)",
                        borderBottom: `1px solid ${addTaskError ? "rgba(248,113,113,0.45)" : "var(--border)"}`,
                      }}
                      autoFocus
                    />
                    {addTaskError && (
                      <p
                        className="text-[11px] font-medium"
                        style={{ color: "#f87171" }}
                      >
                        {addTaskError}
                      </p>
                    )}

                    <div className="space-y-4">
                      <div>
                        <label
                          className="text-[10px] font-semibold uppercase tracking-wider block mb-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Duration
                        </label>

                        <div className="flex gap-2">
                          {[15, 30, 60, 90].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() =>
                                setNewTask((t) => ({
                                  ...t,
                                  duration_minutes: d,
                                }))
                              }
                              className="flex-1 py-3 rounded-2xl text-xs font-semibold transition-all"
                              style={{
                                background:
                                  newTask.duration_minutes === d
                                    ? "linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))"
                                    : "var(--bg-secondary)",
                                color: newTask.duration_minutes === d ? "#fff" : "#cbd5f5",
                                border:
                                  newTask.duration_minutes === d
                                    ? "none"
                                    : "1px solid var(--border)",
                                boxShadow:
                                  newTask.duration_minutes === d
                                    ? "0 10px 20px rgba(99,102,241,0.25)"
                                    : "none",
                              }}
                            >
                              {d === 60 ? "1 hour" : d === 90 ? "1.5 hours" : `${d} mins`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label
                          className="text-[10px] font-semibold uppercase tracking-wider block mb-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Start Time <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <div className="flex items-center gap-3">
                          <select
                            value={newTask.start_hour}
                            onChange={(e) =>
                              setNewTask((t) => ({
                                ...t,
                                start_hour: e.target.value,
                              }))
                            }
                            className="w-[110px] px-4 py-3 rounded-2xl text-sm font-semibold outline-none text-center"
                            style={{
                              background: "var(--bg-secondary)",
                              color: "#ffffff",
                              border: "1px solid var(--border)",
                              WebkitTextFillColor: "#ffffff",
                            }}
                          >
                            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"].map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>

                          <span className="text-xl font-bold" style={{ color: "#818cf8" }}>
                            :
                          </span>

                          <select
                            value={newTask.start_minute}
                            onChange={(e) =>
                              setNewTask((t) => ({
                                ...t,
                                start_minute: e.target.value,
                              }))
                            }
                            className="w-[110px] px-4 py-3 rounded-2xl text-sm font-semibold outline-none text-center"
                            style={{
                              background: "var(--bg-secondary)",
                              color: "#ffffff",
                              border: "1px solid var(--border)",
                              WebkitTextFillColor: "#ffffff",
                            }}
                          >
                            {["00", "15", "30", "45"].map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>

                          <div className="flex gap-2">
                            {["AM", "PM"].map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() =>
                                  setNewTask((t) => ({
                                    ...t,
                                    start_meridiem: m,
                                  }))
                                }
                                className="px-4 py-3 rounded-2xl text-xs font-semibold transition-all"
                                style={{
                                  background:
                                    newTask.start_meridiem === m
                                      ? "linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))"
                                      : "var(--bg-secondary)",
                                  color: newTask.start_meridiem === m ? "#fff" : "#cbd5f5",
                                  border:
                                    newTask.start_meridiem === m
                                      ? "none"
                                      : "1px solid var(--border)",
                                  boxShadow:
                                    newTask.start_meridiem === m
                                      ? "0 10px 20px rgba(99,102,241,0.25)"
                                      : "none",
                                }}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleAddTask}
                        className="flex-1 py-3 rounded-2xl text-[11px] font-semibold text-white"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))",
                          boxShadow: "0 16px 28px rgba(99,102,241,0.18)",
                        }}
                      >
                        Add Task
                      </button>
                      <button
                        onClick={() => setShowAddTask(false)}
                        className="px-4 py-3 rounded-2xl text-[11px] font-semibold"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-[20px] px-4 py-4"
                    style={{
                      background: "rgba(9,14,24,0.75)",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                      Create your next study block here. The queue below will then show the scheduled task list only.
                    </p>
                  </div>
                )}
              </div>

              {false && <div className="space-y-4 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      className="text-[10px] uppercase tracking-[0.18em] font-bold block mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Age
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={80}
                      value={form.age}
                      onChange={(e) => update("age", Math.min(80, Math.max(10, Number(e.target.value || 0))))}
                      className="w-full px-4 py-3 rounded-2xl text-sm font-semibold outline-none transition-all"
                      style={{
                        background: "var(--bg-elevated)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      className="text-[10px] uppercase tracking-[0.18em] font-bold block mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Gender
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {["Male", "Female"].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => update("gender", option)}
                          className="px-4 py-3 rounded-2xl text-xs font-semibold transition-all"
                          style={{
                            background:
                              form.gender === option
                                ? "linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))"
                                : "var(--bg-secondary)",
                            color: form.gender === option ? "#fff" : "#cbd5f5",
                            border:
                              form.gender === option
                                ? "none"
                                : "1px solid var(--border)",
                            boxShadow:
                              form.gender === option
                                ? "0 10px 20px rgba(99,102,241,0.25)"
                                : "none",
                          }}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    className="text-[10px] uppercase tracking-[0.18em] font-bold block mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Part-time job
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["No", "Yes"].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => update("part_time_job", option)}
                        className="px-4 py-3 rounded-2xl text-xs font-semibold transition-all"
                        style={{
                          background:
                            form.part_time_job === option
                              ? "linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.76))"
                              : "var(--bg-secondary)",
                          color: form.part_time_job === option ? "#fff" : "#cbd5f5",
                          border:
                            form.part_time_job === option
                              ? "none"
                              : "1px solid var(--border)",
                          boxShadow:
                            form.part_time_job === option
                              ? "0 10px 20px rgba(16,185,129,0.2)"
                              : "none",
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>}

              {false && (<div className="space-y-5">
                {[
                  {
                    key: "study_hours_per_day",
                    label: "Study hours",
                    helper: "How many hours you studied today",
                    min: 0,
                    max: 12,
                    step: 0.5,
                    color: "#8b5cf6",
                  },
                  {
                    key: "sleep_hours",
                    label: "Sleep hours",
                    helper: "How much sleep you got today",
                    min: 0,
                    max: 12,
                    step: 0.5,
                    color: "#06b6d4",
                  },
                  {
                    key: "total_social_hours",
                    label: "Social time",
                    helper: "Time spent on social media today",
                    min: 0,
                    max: 5,
                    step: 0.1,
                    color: "#f59e0b",
                  },
                ].map(({ key, label, helper, min, max, step, color }) => {
                  // manualFieldsVersion ensures this re-evaluates when fields are added/removed
                  // eslint-disable-next-line no-unused-expressions
                  void manualFieldsVersion;
                  const isManual = userEditedFields.current.has(key);
                  // Compute the live-tracked raw value for this key
                  const liveVal = key === "study_hours_per_day"
                    ? Number((todayStudySeconds / 3600).toFixed(2))
                    : key === "total_social_hours"
                    ? Number((liveSocialSeconds / 3600).toFixed(2))
                    : key === "sleep_hours"
                    ? Number((dailySleepMinutes / 60).toFixed(2))
                    : null;
                  return (
                  <div key={key}>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                          {label}
                        </p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {helper}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isManual ? (
                          <button
                            onClick={() => {
                              userEditedFields.current.delete(key);
                              setManualFieldsVersion((v) => v + 1);
                              if (liveVal !== null) {
                                setForm((f) => ({ ...f, [key]: liveVal }));
                              }
                            }}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition-all"
                            style={{
                              background: "rgba(251,113,133,0.12)",
                              color: "#fb7185",
                              border: "1px solid rgba(251,113,133,0.25)",
                            }}
                          >
                            manual Â· reset
                          </button>
                        ) : (
                          <span
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "rgba(52,211,153,0.1)",
                              color: "#34d399",
                              border: "1px solid rgba(52,211,153,0.2)",
                            }}
                          >
                            live
                          </span>
                        )}
                        <span className="text-sm font-black tracking-tight" style={{ color }}>
                          {form[key]}h
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={form[key]}
                      onChange={(e) => update(key, parseFloat(e.target.value))}
                      className="slider-input w-full"
                      style={{
                        "--slider-fill": `${((form[key] - min) / (max - min)) * 100}%`,
                        "--slider-color": color,
                      }}
                    />
                  </div>
                  );
                })}
              </div>)}
            </section>
            </div>
          </section>

          <div className="grid grid-cols-12 gap-5 xl:gap-6 items-stretch">
            <div className="col-span-12 lg:col-span-5 xl:col-span-4 space-y-6 h-full">
              <FocusTimer
                onTasksChanged={fetchTasks}
                onStartTask={handleStartTimer}
                notificationsMutedUntil={notificationsMutedUntil}
                shortBreakActive={shortBreakActive}
                shortBreakRemainingSeconds={shortBreakRemainingSeconds}
                breakMinutesInput={breakMinutesInput}
                onBreakMinutesChange={setBreakMinutesInput}
                onStartBreak={startShortBreak}
                onEndBreak={() => setShortBreakEndAt(null)}
              />

            </div>

            <div className="col-span-12 lg:col-span-7 xl:col-span-8 space-y-6 h-full">
              <section
                className="h-full p-5 md:p-6 flex flex-col rounded-[30px]"
                style={{
                  background: "linear-gradient(160deg, rgba(11,17,31,0.98) 0%, rgba(7,11,20,0.99) 100%)",
                  border: "1px solid rgba(148,163,184,0.10)",
                  boxShadow: "0 30px 60px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <div className="mb-4 md:mb-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] font-bold mb-1" style={{ color: "#475569" }}>
                    Planner Inputs
                  </p>
                  <h2 className="text-[15px] md:text-base font-black tracking-tight" style={{ color: "#f8fafc" }}>
                    Model Inputs
                  </h2>
                </div>

                <div
                  className="mb-2 p-4 md:p-5 rounded-[26px] max-w-[960px]"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.015) 100%)",
                    border: "1px solid rgba(148,163,184,0.10)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 10px 28px rgba(0,0,0,0.18)",
                  }}
                >
                  <div className="mb-4">
                    <p className="text-[10px] uppercase tracking-[0.22em] font-bold mb-1" style={{ color: "#475569" }}>
                      Model Inputs
                    </p>
                    <h3 className="text-sm font-black tracking-tight mb-1" style={{ color: "#f1f5f9" }}>
                      Profile and study signals for the planner model
                    </h3>
                    <p className="text-[11px] leading-relaxed max-w-[52ch]" style={{ color: "#475569" }}>
                      Keep these values realistic so the prediction reflects your actual study day.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-[160px,1fr] gap-3 md:gap-4 mb-4">
                    <div>
                      <label
                        className="text-[10px] uppercase tracking-[0.18em] font-bold block mb-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Age
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={80}
                        value={form.age}
                        onChange={(e) => update("age", Math.min(80, Math.max(10, Number(e.target.value || 0))))}
                        className="w-full px-4 py-3 rounded-[20px] text-sm font-semibold outline-none transition-all"
                        style={{
                          background: "rgba(5,10,20,0.92)",
                          color: "#f8fafc",
                          border: "1px solid rgba(148,163,184,0.10)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          className="text-[10px] uppercase tracking-[0.18em] font-bold block mb-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Gender
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {["Male", "Female"].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => update("gender", option)}
                              className="px-3.5 py-3 rounded-[18px] text-xs font-semibold transition-all"
                              style={{
                                background:
                                  form.gender === option
                                    ? "linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.74))"
                                    : "rgba(10,16,30,0.72)",
                                color: form.gender === option ? "#fff" : "#cbd5f5",
                                border: form.gender === option ? "none" : "1px solid rgba(148,163,184,0.10)",
                                boxShadow:
                                  form.gender === option
                                    ? "0 10px 24px rgba(99,102,241,0.24)"
                                    : "none",
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label
                          className="text-[10px] uppercase tracking-[0.18em] font-bold block mb-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Part-time job
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {["No", "Yes"].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => update("part_time_job", option)}
                              className="px-3.5 py-3 rounded-[18px] text-xs font-semibold transition-all"
                              style={{
                                background:
                                  form.part_time_job === option
                                    ? "linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.76))"
                                    : "rgba(10,16,30,0.72)",
                                color: form.part_time_job === option ? "#fff" : "#cbd5f5",
                                border: form.part_time_job === option ? "none" : "1px solid rgba(148,163,184,0.10)",
                                boxShadow:
                                  form.part_time_job === option
                                    ? "0 10px 24px rgba(16,185,129,0.18)"
                                    : "none",
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        key: "study_hours_per_day",
                        label: "Study hours",
                        helper: "How many hours you studied today",
                        min: 0,
                        max: 12,
                        step: 0.5,
                        color: "#8b5cf6",
                      },
                      {
                        key: "sleep_hours",
                        label: "Sleep hours",
                        helper: "How much sleep you got today",
                        min: 0,
                        max: 12,
                        step: 0.5,
                        color: "#06b6d4",
                      },
                      {
                        key: "total_social_hours",
                        label: "Social time",
                        helper: "Time spent on social media today",
                        min: 0,
                        max: 5,
                        step: 0.1,
                        color: "#f59e0b",
                      },
                    ].map(({ key, label, helper, min, max, step, color }) => {
                      void manualFieldsVersion;
                      const isManual = userEditedFields.current.has(key);
                      const liveVal = key === "study_hours_per_day"
                        ? Number((todayStudySeconds / 3600).toFixed(2))
                        : key === "total_social_hours"
                        ? Number((liveSocialSeconds / 3600).toFixed(2))
                        : Number((dailySleepMinutes / 60).toFixed(2));

                      return (
                        <div
                          key={key}
                          className="rounded-[20px] px-3 py-3"
                          style={{
                            background: "rgba(255,255,255,0.015)",
                            border: "1px solid rgba(148,163,184,0.08)",
                          }}
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div>
                              <p className="text-[13px] font-semibold" style={{ color: "#f8fafc" }}>
                                {label}
                              </p>
                              <p className="text-[10px]" style={{ color: "#475569" }}>
                                {helper}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-base font-black tracking-tight" style={{ color }}>
                                {form[key]}h
                              </span>
                            </div>
                          </div>
                          <div className="mb-2 flex items-center justify-between px-1">
                            {Array.from({ length: 5 }).map((_, idx) => {
                              const stopValue = min + ((max - min) / 4) * idx;
                              const active = form[key] >= stopValue;
                              return (
                                <div
                                  key={`${key}-tick-${idx}`}
                                  className="flex flex-col items-center gap-1"
                                  style={{ width: "20%" }}
                                >
                                  <div
                                    className="h-1 rounded-full transition-all"
                                    style={{
                                      width: idx === 0 || idx === 4 ? 18 : 28,
                                      background: active ? color : "rgba(148,163,184,0.18)",
                                      boxShadow: active ? `0 0 10px ${color}33` : "none",
                                    }}
                                  />
                                  <span
                                    className="text-[9px] font-medium tabular-nums"
                                    style={{
                                      color: active ? "#94a3b8" : "#475569",
                                    }}
                                  >
                                    {`${Number(stopValue.toFixed(1))}h`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <input
                            type="range"
                            min={min}
                            max={max}
                            step={step}
                            value={form[key]}
                            onChange={(e) => update(key, parseFloat(e.target.value))}
                            className="slider-input w-full"
                            style={{
                              "--slider-fill": `${((form[key] - min) / (max - min)) * 100}%`,
                              "--slider-color": color,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {false && (
                <div
                  className="space-y-2 max-h-[560px] overflow-y-auto pr-1"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "var(--border) transparent",
                  }}
                >
                  {filteredTasks.length === 0 ? (
                    <div className="py-16 text-center rounded-[24px] planner-subtle">
                      <p
                        className="text-xs font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No tasks yet. Add one small study task to get started.
                      </p>
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <div
  key={task.id}
  className="group flex items-center gap-3 px-4 py-4 rounded-[22px] transition-all planner-task-row"
  style={{
    background:
      activeTaskId === task.id && isRunning
        ? "linear-gradient(135deg, rgba(16,185,129,0.35), rgba(5,150,105,0.32))"
        : task.status === "completed"
        ? "rgba(16,185,129,0.12)"
        : task.status === "pending"
        ? "rgba(239,68,68,0.10)"
        : task.status === "missed"
        ? "rgba(127,29,29,0.45)"
        : task.status === "rescheduled"
        ? "rgba(59,130,246,0.15)"  // ðŸ”µ BLUE
        : "var(--bg-card)",
  
    border:
      activeTaskId === task.id && isRunning
        ? "1px solid rgba(16,185,129,0.7)"
        : task.status === "completed"
        ? "1px solid rgba(16,185,129,0.4)"
        : task.status === "pending"
        ? "1px solid rgba(239,68,68,0.35)"
        : task.status === "missed"
        ? "1px solid rgba(239,68,68,0.45)"
        : task.status === "rescheduled"
        ? "1px solid rgba(59,130,246,0.5)" // ðŸ”µ
        : "1px solid transparent",
    boxShadow:
      activeTaskId === task.id && isRunning
        ? "0 18px 32px rgba(16,185,129,0.24)"
        : "none",
  }}
>
                        <PriorityDot priority={task.priority} />
                        <div className="flex-1 min-w-0 flex flex-col items-center text-center">
  <div className="flex items-center gap-2 justify-center flex-wrap">
    <span
      className="text-sm font-semibold"
      style={{
        color:
          activeTaskId === task.id && isRunning
            ? "#ecfdf5"
            : task.status === "completed"
            ? "#10b981"
            : task.status === "pending"
            ? "#ef4444"
            : "var(--text-primary)",
        textDecoration: "none",
        opacity:
          activeTaskId === task.id && isRunning
            ? 1
            : task.status === "completed"
            ? 0.85
            : 1,
      }}
    >
      {task.subject}
    </span>
    <StatusBadge status={task.status} />
  </div>

  <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
    <span
      className="text-[11px]"
      style={{
        color:
          activeTaskId === task.id && isRunning
            ? "rgba(236,253,245,0.92)"
            : "var(--text-muted)",
      }}
    >
      {task.duration_minutes}m
    </span>

    {task.scheduled_slot && (
      <span
        className="text-[11px]"
        style={{
          color:
            activeTaskId === task.id && isRunning
              ? "rgba(236,253,245,0.92)"
              : "var(--text-muted)",
        }}
      >
        {task.scheduled_slot}
      </span>
    )}

    {task.studied_seconds > 0 && (
      <span
        className="text-[11px] font-medium"
        style={{ color: "#10b981" }}
      >
        Studied: {Math.floor(task.studied_seconds / 60)}m {task.studied_seconds % 60}s
      </span>
    )}

    {task.distraction_events > 0 && (
      <span
        className="text-[11px] font-medium"
        style={{ color: "#ef4444" }}
      >
        {task.distraction_events} distr.
      </span>
    )}
  </div>
</div>
                        <div className="flex items-center gap-1 opacity-100 transition-opacity">
                        {activeTaskId === task.id ? (
  <div className="flex items-center gap-2">
    <span
      className="text-xs font-semibold whitespace-nowrap px-2.5 py-1 rounded-lg"
      style={{
        color: "#ecfdf5",
        background: "rgba(5,150,105,0.35)",
        border: "1px solid rgba(236,253,245,0.3)",
      }}
    >
      â± {formatTime(timeLeft)}
    </span>

    {isRunning ? (
      <>
        <button
          onClick={handlePauseTimer}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ color: '#f59e0b', background: 'rgba(245,158,11,0.08)' }}
        >
          <Pause className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => handleFinishTask(task)}
          className="px-3 h-8 rounded-xl flex items-center justify-center text-xs font-semibold whitespace-nowrap"
          style={{ color: '#10b981', background: 'rgba(16,185,129,0.12)' }}
        >
          Finished
        </button>
      </>
    ) : (
      <button
        onClick={() => handleResumeTimer(task)}
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ color: '#10b981', background: 'rgba(16,185,129,0.08)' }}
      >
        <Play className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
) : (
  (task.status === 'pending' || task.status === 'rescheduled' || task.status === 'active') && (
    <button
      onClick={() => {
        if (activeTaskId && isRunning) {
          showPlannerNotice(
            "Task already in progress",
            "Pause the current session before launching a different task.",
          );
          return;
        }

        if (task.remaining_seconds && task.remaining_seconds < task.duration_minutes * 60) {
          handleResumeTimer(task);
        } else {
          handleStartTimer(task);
        }
      }}
      className="w-8 h-8 rounded-xl flex items-center justify-center"
      style={{
        color: '#818cf8',
        background: 'rgba(129,140,248,0.08)',
      }}
    >
      <Play className="w-3.5 h-3.5" />
    </button>
  )
)}

<button
  onClick={() => {
    if (activeTaskId === task.id && isRunning) {
      showPlannerNotice(
        "Task canâ€™t be removed yet",
        "Pause the running session first, then remove it from your queue.",
      );
      return;
    }
    deleteTask(task.id);
  }}
  disabled={activeTaskId === task.id && isRunning}
  className="w-8 h-8 rounded-xl flex items-center justify-center"
  style={{
    color: (activeTaskId === task.id && isRunning) ? '#6b7280' : '#ef4444',
    background: (activeTaskId === task.id && isRunning)
      ? 'rgba(107,114,128,0.12)'
      : 'rgba(239,68,68,0.08)',
    cursor: (activeTaskId === task.id && isRunning) ? 'not-allowed' : 'pointer',
    opacity: (activeTaskId === task.id && isRunning) ? 0.5 : 1
  }}
>
  <Trash2 className="w-3.5 h-3.5" />
</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                )}

              </section>
            </div>

            {false && <div className="col-span-12 lg:col-span-4 space-y-6">
              {result ? (
                <>
                  <div className="glass-card p-6 flex flex-col items-center justify-center">
                    <div className="flex flex-col items-center text-center">
                      <ProbabilityRing
                        value={result.task_completion_probability}
                      />

                      <div className="mt-6 mb-4 flex items-center justify-center gap-2">
                        <span
                          className="px-3.5 py-1.5 rounded-full text-[11px] font-bold"
                          style={{
                            background:
                              result.prediction === 1
                                ? "rgba(16,185,129,0.12)"
                                : "rgba(239,68,68,0.12)",
                            color:
                              result.prediction === 1 ? "#10b981" : "#ef4444",
                            border: `1px solid ${result.prediction === 1 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                            boxShadow: `0 2px 10px ${result.prediction === 1 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)"}`
                          }}
                        >
                          {result.prediction === 1 ? "Can Complete" : "At Risk"}
                        </span>
                        {result.distraction_adjustment > 0 && (
                          <span
                            className="px-3.5 py-1.5 rounded-full text-[11px] font-bold"
                            style={{
                              background: "rgba(168,85,247,0.12)",
                              color: "#c084fc",
                              border: "1px solid rgba(168,85,247,0.3)",
                              boxShadow: "0 2px 10px rgba(168,85,247,0.15)"
                            }}
                          >
                            Adjusted
                          </span>
                        )}
                      </div>

                      <h3
                        className="text-lg font-bold leading-snug mb-1.5 max-w-[280px]"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {result.planner_decision}
                      </h3>

                      <p
                        className="text-xs font-medium max-w-[280px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className={result.prediction === 1 ? "text-emerald-400" : "text-rose-400"}>{(result.task_completion_probability * 100).toFixed(1)}%</span>
                        {" "}chance of finishing your current plan
                        {result.original_probability !==
                          result.task_completion_probability && (
                          <span style={{ opacity: 0.6 }}>
                            {" "}
                            Â· base{" "}
                            {(result.original_probability * 100).toFixed(1)}%
                          </span>
                        )}
                      </p>

                      {result.new_slot && (
                        <div
                          className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl"
                          style={{ background: "rgba(99,102,241,0.06)" }}
                        >
                          <CalendarCheck
                            className="w-3.5 h-3.5"
                            style={{ color: "#818cf8" }}
                          />
                          <span
                            className="text-[11px] font-semibold"
                            style={{ color: "#818cf8" }}
                          >
                            Rescheduled to {result.new_slot}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {result.reschedule_info && (
                    <div
                      className="p-4 rounded-[24px] planner-card"
                      style={{
                        border: "1px solid rgba(168,85,247,0.3)",
                        boxShadow: "inset 0 0 20px rgba(168,85,247,0.05), 0 18px 48px rgba(2,6,23,0.22)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <RefreshCw
                          className="w-4 h-4 flex-shrink-0 mt-0.5"
                          style={{ color: "#a855f7" }}
                        />
                        <div>
                          <p
                            className="text-xs font-semibold"
                            style={{ color: "#a855f7" }}
                          >
                            Rescheduled
                          </p>
                          <p
                            className="text-[11px] mt-0.5"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            "{result.reschedule_info.task_subject}" to{" "}
                            {result.reschedule_info.new_slot}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.feedback &&
                    (() => {
                      const cfg = feedbackConf[
                        result.feedback.feedback_type
                      ] || { icon: Sparkles, color: "#818cf8" };
                      const Icon = cfg.icon;
                      const suggested = result.feedback.suggested_action || "";
                      const recoveryEligible =
                        suggested.toLowerCase().includes("lighter task") &&
                        suggested.toLowerCase().includes("short break");
                      return (
                        <div className="p-5 rounded-[28px] planner-card">
                          <div className="flex items-center gap-2 mb-4">
                            <Icon
                              className="w-4 h-4"
                              style={{ color: cfg.color }}
                            />
                            <h3
                              className="text-xs font-semibold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              Simple advice
                            </h3>
                          </div>
                          <p
                            className="text-xs leading-relaxed mb-3"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {result.feedback.message}
                          </p>
                          <div
                            className="flex items-center gap-2 pt-3"
                            style={{ borderTop: "1px solid var(--border)" }}
                          >
                            <ArrowRight
                              className="w-3 h-3"
                              style={{ color: cfg.color }}
                            />
                            <p
                              className="text-[11px] font-semibold"
                              style={{ color: cfg.color }}
                            >
                              {suggested}
                            </p>
                          </div>

                          {recoveryEligible && (
                            <div
                              className="mt-3 p-3 rounded-2xl"
                              style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div className="grid grid-cols-1 gap-2">
                                <button
                                  onClick={() => setShowBreakDurationPicker((prev) => !prev)}
                                  className="w-full py-2.5 rounded-xl text-[11px] font-semibold"
                                  style={{
                                    color: "#34d399",
                                    background: "rgba(52,211,153,0.12)",
                                    border: "1px solid rgba(52,211,153,0.24)",
                                  }}
                                >
                                  Take Break
                                </button>

                                <button
                                  onClick={handleAddSmallTask}
                                  className="w-full py-2.5 rounded-xl text-[11px] font-semibold text-white"
                                  style={{
                                    background:
                                      "linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.76))",
                                  }}
                                >
                                  Add Small Task
                                </button>
                              </div>

                              {showBreakDurationPicker && (
                                <div className="mt-3 flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    max={59}
                                    value={breakMinutesInput}
                                    onChange={(e) =>
                                      setBreakMinutesInput(
                                        Math.min(
                                          59,
                                          Math.max(1, parseInt(e.target.value || "1", 10)),
                                        ),
                                      )
                                    }
                                    className="w-20 px-3 py-2 rounded-xl text-xs font-semibold outline-none planner-input"
                                    style={{
                                      background: "var(--bg-elevated)",
                                      color: "var(--text-primary)",
                                      border: "1px solid var(--border)",
                                    }}
                                  />
                                  <span
                                    className="text-[11px]"
                                    style={{ color: "var(--text-muted)" }}
                                  >
                                    minutes (max 59)
                                  </span>
                                  <button
                                    onClick={startShortBreak}
                                    className="ml-auto px-3 py-2 rounded-xl text-[11px] font-semibold text-white"
                                    style={{
                                      background:
                                        "linear-gradient(135deg, rgba(52,211,153,0.95), rgba(16,185,129,0.82))",
                                    }}
                                  >
                                    Start Break
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                  {result.social_alert && (
                    <div
                      className="p-5 rounded-[28px] planner-card"
                      style={{
                        border: "1px solid rgba(245,158,11,0.3)",
                        boxShadow: "inset 0 0 20px rgba(245,158,11,0.05), 0 18px 48px rgba(2,6,23,0.22)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle
                          className="w-4 h-4 flex-shrink-0 mt-0.5"
                          style={{ color: "#f59e0b" }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4
                              className="text-xs font-semibold"
                              style={{ color: "#f59e0b" }}
                            >
                              Social Media Alert
                            </h4>
                            <span
                              className="text-[10px] font-semibold"
                              style={{ color: "#f59e0b" }}
                            >
                              #{result.social_alert.alert_count}
                            </span>
                          </div>
                          <p
                            className="text-xs leading-relaxed"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {result.social_alert.message}
                          </p>
                          <p
                            className="text-[10px] mt-2"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {result.social_alert.suggested_action}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-6 rounded-[30px] planner-card planner-empty">
                  <div
                    className="w-16 h-16 rounded-[24px] mb-5 flex items-center justify-center"
                    style={{ background: "rgba(129,140,248,0.12)" }}
                  >
                    <Sparkles
                      className="w-7 h-7"
                      style={{ color: "var(--accent)" }}
                    />
                  </div>
                  <h3
                    className="text-xl font-bold tracking-tight mb-2"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Planner ready
                  </h3>
                  <p
                    className="text-xs max-w-[280px] leading-relaxed mb-5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {canShowPrediction
                      ? "Add your inputs and tasks. The planner will show a study suggestion automatically."
                      : "Fill the planner inputs to generate a study prediction."}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Tasks in queue", value: tasks.length },
                      { label: "Active now", value: activeCount },
                      { label: "Current streak", value: currentStreak || "â€”" },
                      {
                        label: "Focus rate",
                        value: focusRate != null ? `${focusRate}%` : "â€”",
                      },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="rounded-[20px] p-4 planner-subtle"
                      >
                        <div
                          className="text-lg font-black tracking-tight"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {value}
                        </div>
                        <div
                          className="text-[10px] mt-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>}
          </div>
        </div>
        <Footer />
      </main>

     


      <style>{`
        .planner-hero {
          background:
            radial-gradient(circle at top left, rgba(129,140,248,0.22), transparent 34%),
            radial-gradient(circle at bottom right, rgba(56,189,248,0.12), transparent 28%),
            linear-gradient(180deg, rgba(13,16,28,0.96), rgba(11,14,22,0.92));
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 26px 60px rgba(2,6,23,0.3);
        }
        .glass-card,
        .planner-card {
          background: linear-gradient(180deg, rgba(13,20,38,0.98), rgba(8,13,24,0.98));
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 22px 48px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04);
        }
        .planner-subtle {
          background: rgba(255,255,255,0.03);
        }
        .planner-stat {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
        }
        .planner-action {
          background:
            radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 34%),
            linear-gradient(135deg, rgba(99,102,241,0.88), rgba(79,70,229,0.78));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 28px 56px rgba(79,70,229,0.28);
        }
        .planner-task-row {
          background: rgba(255,255,255,0.02);
          border: 1px solid transparent;
        }
        .planner-task-row:hover {
          background: rgba(255,255,255,0.04);
          border-color: rgba(255,255,255,0.06);
          transform: translateY(-1px);
        }
        .planner-empty {
          background:
            radial-gradient(circle at top left, rgba(129,140,248,0.18), transparent 34%),
            linear-gradient(180deg, rgba(16,19,29,0.92), rgba(11,14,22,0.9));
        }
        .planner-input:focus {
          border-color: rgba(129,140,248,0.45) !important;
          box-shadow: 0 0 0 4px rgba(129,140,248,0.08);
        }
        .slider-input {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(
            90deg,
            var(--slider-color, var(--accent)) 0%,
            var(--slider-color, var(--accent)) var(--slider-fill, 0%),
            rgba(255,255,255,0.08) var(--slider-fill, 0%),
            rgba(255,255,255,0.08) 100%
          );
          outline: none;
        }
        .slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 0;
          height: 0;
          border-radius: 0;
          background: transparent;
          cursor: pointer;
          border: 0;
          box-shadow: none;
          transition: none;
        }
        .slider-input::-moz-range-thumb {
          width: 0;
          height: 0;
          border-radius: 0;
          background: transparent;
          cursor: pointer;
          border: 0;
          box-shadow: none;
        }
        select {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          color-scheme: dark;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 30px !important;
        }
        select option {
          background: #0b1120;
          color: #f8fafc;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes plannerLoaderShift {
          0% { filter: saturate(0.95) brightness(0.98); }
          50% { filter: saturate(1.08) brightness(1.06); }
          100% { filter: saturate(0.95) brightness(0.98); }
        }
        @keyframes plannerLoaderGlow {
          0% { transform: translateX(-18%); opacity: 0.18; }
          50% { opacity: 0.42; }
          100% { transform: translateX(118%); opacity: 0.14; }
        }
        .planner-ongoing-loader {
          animation: plannerLoaderShift 2.8s ease-in-out infinite;
        }
        .planner-ongoing-loader-glow {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent);
          animation: plannerLoaderGlow 2.2s linear infinite;
        }
        @keyframes plannerNoticeEnter {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.985);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {shortBreakActive && (
        <div className="fixed top-4 right-4 z-[72] w-[min(92vw,360px)]">
          <div
            className="rounded-[22px] p-4 planner-card"
            style={{
              border: "1px solid rgba(52,211,153,0.24)",
              boxShadow: "0 20px 42px rgba(2,6,23,0.42)",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold" style={{ color: "#34d399" }}>
                Break Time
              </p>
              <button
                onClick={() => setShortBreakEndAt(null)}
                className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                style={{ color: "var(--text-secondary)", background: "rgba(255,255,255,0.06)" }}
              >
                End
              </button>
            </div>
            <div className="text-lg font-bold" style={{ color: "#34d399" }}>
              {formatTime(shortBreakRemainingSeconds)}
            </div>
            <p className="text-xs mt-2 font-medium" style={{ color: "var(--text-primary)" }}>
              {breakMotivationMessages[breakMotivationIndex]}
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              Alerts and notifications are paused until break ends.
            </p>
          </div>
        </div>
      )}

      {startReminderTask && !shortBreakActive && (
        <div className="fixed bottom-5 right-5 z-[70] w-[min(92vw,380px)]">
          <div
            className="rounded-[24px] p-4 planner-card"
            style={{
              border: "1px solid rgba(129,140,248,0.24)",
              boxShadow: "0 20px 42px rgba(2,6,23,0.42)",
            }}
          >
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-2"
              style={{
                background: "rgba(129,140,248,0.14)",
                border: "1px solid rgba(129,140,248,0.22)",
                color: "#a5b4fc",
              }}
            >
              <Play className="w-3 h-3" />
              <span className="text-[10px] font-semibold">Start Reminder</span>
            </div>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              Itâ€™s time to start "{startReminderTask.subject}"
            </p>
            <p className="text-[11px] mb-3" style={{ color: "var(--text-muted)" }}>
              Scheduled at {startReminderTask.scheduled_slot || "planned time"}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleStartReminderStart}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(129,140,248,0.96), rgba(99,102,241,0.8))",
                  boxShadow: "0 12px 20px rgba(99,102,241,0.24)",
                }}
              >
                Start Now
              </button>
              <button
                onClick={handleStartReminderLater}
                className="px-3.5 py-2.5 rounded-xl text-[11px] font-semibold"
                style={{
                  color: "var(--text-secondary)",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                Remind Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
