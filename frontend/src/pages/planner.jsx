import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import { useTheme } from "../context/ThemeContext";
import {
  CalendarCheck,AlertTriangle,Coffee,Brain,Play,X,Trash2,RefreshCw,AlertCircle,
  Zap,Flame,Trophy,TrendingUp,Sparkles,Pause,ArrowRight,ChevronDown,
} from "lucide-react";
import { FocusTimer, PriorityDot, ProbabilityRing, StatusBadge, Timeline } from "./planner/PlannerSections";
import {
  formatClockDuration,
  formatCompactStudyDuration,
  formatHoursMinutesFromSeconds,
  formatSleepDuration,
  formatStudyDuration,
  getSleepDateKey,
  getSleepStorageKey,
  getSliderFillPercentage,
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
  const latestNotificationPermissionRef = useRef(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const lastStartReminderNotificationRef = useRef(null);
  const lastRescheduleNotificationRef = useRef(null);
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

      const res = await fetch(`http://127.0.0.1:5000/api/planner/tasks/${task.id}/start`, {
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
  
      await fetch(`http://127.0.0.1:5000/api/planner/tasks/${activeTaskId}/pause`, {
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
      const res = await fetch(`http://127.0.0.1:5000/api/planner/tasks/${task.id}/resume`, {
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
    
        const res = await fetch(`http://127.0.0.1:5000/api/planner/tasks/${taskId}/complete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            elapsed_seconds: finalElapsedSeconds,
          }),
        });
    
        await res.json();
    
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
  const [activeTab, setActiveTab] = useState("all");
  const [profileOpen, setProfileOpen] = useState(true);

  const [form, setForm] = useState({
    age: 20,
    gender: "Male",
    part_time_job: "No",
    study_hours_per_day: 3,
    sleep_hours: 7,
    total_social_hours: 1.5,
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
  const canShowPrediction = !showInitialSleepPrompt;

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
  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

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
      const res = await fetch("/api/planner/tasks");
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
      const res = await fetch("/api/planner/distraction-check");
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

  // Creates a new planner task after validating the requested start time.
  const handleAddTask = async () => {
    if (
      !newTask.subject.trim() ||
      !newTask.start_hour ||
      !newTask.start_minute ||
      !newTask.start_meridiem
    ) {
      alert("Please enter subject and start time.");
      return;
    }
  
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
        alert("You already have a task at that time.");
        return;
      }
  
      const res = await fetch("/api/planner/tasks", {
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
        alert(errMessage);
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
      console.log("SENDING TASK:", {
        ...newTask,
        planned_start: slotInfo.planned_start,
        planned_end: slotInfo.planned_end,
      });
  
      setShowAddTask(false);
      fetchTasks();
    } catch (err) {
      console.error("Add task error:", err);
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
    setFeedbackRecoveryOpen(false);
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
      const res = await fetch(`/api/planner/tasks/${id}`, {
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

    predictionInFlightRef.current = true;
    setError(null);
    try {
      const activeForm = latestFormRef.current || form;
      const activeTasks = latestTasksRef.current || tasks;
      const schedule = activeTasks.map((t) => ({
        time: t.scheduled_slot || "",
        status: t.status === "completed" ? "occupied" : "free",
      }));
      const res = await fetch("/api/planner/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...activeForm, schedule }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      latestPredictionRef.current = data;
      if (!visiblePredictionRef.current) {
        visiblePredictionRef.current = data;
        setResult(data);
      }
      if (data.task_stats) setTaskStats(data.task_stats);
      if (data.streak_info) setStreakInfo(data.streak_info);
    } catch (err) {
      setError(err.message || "Prediction failed");
    } finally {
      predictionInFlightRef.current = false;
    }
  }, [canShowPrediction]);

 

  // Filters and sorts tasks for the currently selected planner tab.
  const filteredTasks = useMemo(() => {
    let visibleTasks = tasks;

    if (activeTab === "active")
      visibleTasks = tasks.filter(
        (t) =>
          t.status === "active" ||
          t.status === "pending" ||
          t.status === "rescheduled",
      );
    if (activeTab === "completed")
      visibleTasks = tasks.filter((t) => t.status === "completed");
    if (activeTab === "missed")
      visibleTasks = tasks.filter((t) => t.status === "missed");

    return [...visibleTasks].sort(sortTasksByStartTime);
  }, [tasks, activeTab]);

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
  const todayStudyLabel = formatStudyDuration(todayStudySeconds);
  const statusTone = distractionState?.is_distracted ? "#ef4444" : "#10b981";
  const statusLabel = distractionState
    ? distractionState.is_distracted
      ? `Distracted ${Math.round((distractionState.confidence || 0) * 100)}%`
      : "Focused"
    : "Monitoring";

  useEffect(() => {
    latestFormRef.current = form;
  }, [form]);

  useEffect(() => {
    latestTasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      total_social_hours: Number((liveSocialSeconds / 3600).toFixed(2)),
    }));
  }, [liveSocialSeconds]);

  useEffect(() => {
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

  // Applies the newest prediction payload to the visible score card on its own cadence.
  useEffect(() => {
    const id = setInterval(() => {
      if (!canShowPrediction) return;
      if (!latestPredictionRef.current) return;
      if (latestPredictionRef.current === visiblePredictionRef.current) return;
      visiblePredictionRef.current = latestPredictionRef.current;
      setResult(latestPredictionRef.current);
    }, 4000);

    return () => clearInterval(id);
  }, [canShowPrediction]);

  return (
    <div
      className="flex min-h-screen"
      style={{
        background: 'var(--bg-primary)'
      }}
    >
      <Sidebar active="Planner" />

      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <header
          className="sticky top-0 z-30 px-6 lg:px-8 py-4 flex items-center justify-between"
          style={{
            background: dark ? "rgba(8,10,15,0.75)" : "rgba(250,251,253,0.8)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--border)",
            zIndex: 40
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

        <div className="flex-1 px-6 lg:px-8 py-6 max-w-[1440px] mx-auto w-full">
          <section className="glass-card p-6 lg:p-8 mb-6 relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr,0.9fr] gap-5 items-start">
              <div>
                <div
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3 shadow-sm"
                  style={{
                    background: "var(--accent-bg)",
                    color: "var(--accent)",
                    border: "1px solid rgba(124, 58, 237, 0.15)",
                  }}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-semibold">
                    AI Insights & Planning
                  </span>
                </div>
                <h2
                  className="text-2xl font-black leading-tight max-w-[620px] mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {currentTime.getHours() < 12 ? "Good morning! Ready for a productive day?" : currentTime.getHours() < 18 ? "Good afternoon! Keep the momentum going." : "Good evening! Let's finish today strong."}
                </h2>
                <p
                  className="text-sm max-w-[500px] leading-relaxed font-medium"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {currentStreak > 0
                    ? `You're riding a solid ${currentStreak}-day focus streak. Your system is primed—log your tasks, manage distractions, and add to your score.`
                    : `Your workspace is clear. Outline your tasks, secure your focus hours, and start building your productivity streak today.`}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-3">
                {[
                  {
                    label: "Total study time",
                    value: formatCompactStudyDuration(todayStudySeconds),
                    icon: Brain,
                    tone: "#8b5cf6",
                  },
                  {
                    label: "Social time",
                    value: dailySocialLabel,
                    icon: AlertTriangle,
                    tone: socialLimitExceeded ? "#ef4444" : "#f59e0b",
                  },
                  {
                    label: "Sleep time",
                    value: dailySleepLabel,
                    icon: Coffee,
                    tone: "#06b6d4",
                  },
                ].map(({ label, value, icon: Icon, tone }) => (
                  <div key={label} className="glass-card p-5 flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${tone}18`, color: tone }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                        {label}
                      </span>
                    </div>
                    <div
                      className="text-xl font-black tracking-tighter"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <section className="glass-card flex flex-col h-full p-6 transition-all hover:shadow-lg relative overflow-hidden group">
              {/* Subtle background glow when running */}
              <div 
                className={`absolute inset-0 opacity-0 transition-opacity duration-1000 pointer-events-none ${socialTimerRunning ? 'opacity-100' : ''}`}
                style={{
                  background: "radial-gradient(circle at center 30%, rgba(239,68,68,0.05) 0%, transparent 70%)"
                }}
              />
              
              <div className="flex items-start justify-between gap-3 mb-5 relative z-10">
                <div>
                  <p
                    className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Social Timer
                  </p>
                  <h2
                    className="text-sm font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Today&apos;s Time: {dailySocialLabel}
                  </h2>
                </div>
                <div
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold transition-all"
                  style={{
                    background: socialTimerRunning ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.1)",
                    color: socialTimerRunning ? "#ef4444" : "#10b981",
                    border: socialTimerRunning
                      ? "1px solid rgba(239,68,68,0.3)"
                      : "1px solid rgba(16,185,129,0.2)",
                    boxShadow: socialTimerRunning ? "0 0 12px rgba(239,68,68,0.2)" : "none"
                  }}
                >
                  {socialTimerRunning ? "Running" : "Stopped"}
                </div>
              </div>

              <div
                className="rounded-2xl p-5 mb-5 text-center transition-all flex flex-col items-center justify-center relative z-10 flex-1"
                style={{
                  background: "rgba(15,23,42,0.2)",
                  border: "1px solid rgba(245,158,11,0.1)",
                  boxShadow: "inset 0 2px 10px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.02)",
                }}
              >
                <div 
                  className={`text-4xl font-black tracking-tighter transition-all ${socialTimerRunning ? 'scale-105' : ''}`}
                  style={{ 
                    color: socialTimerRunning ? "#ef4444" : "var(--text-primary)", 
                    fontVariantNumeric: "tabular-nums",
                    textShadow: socialTimerRunning ? "0 0 20px rgba(239,68,68,0.4)" : "none"
                  }}
                >
                  {liveSocialTimerLabel}
                </div>
                <p
                  className="text-[10px] mt-2 font-medium"
                  style={{ color: "var(--text-muted)" }}
                >
                  {socialTimerRunning
                    ? "Tracking session live..."
                    : `Saved: ${getSocialStorageKey(sleepDateKey)}`}
                </p>
              </div>

              <div className="relative z-10 w-full">
                <button
                  onClick={socialTimerRunning ? stopSocialTimer : startSocialTimer}
                  className="w-full py-3.5 rounded-xl text-xs font-bold text-white transition-all transform active:scale-[0.98] relative overflow-hidden flex items-center justify-center gap-2"
                  style={{
                    background: socialTimerRunning
                      ? "linear-gradient(to right, rgba(239,68,68,0.2), rgba(220,38,38,0.15))"
                      : "linear-gradient(to right, #f59e0b, #d97706)",
                    border: socialTimerRunning ? "1px solid rgba(239,68,68,0.4)" : "1px solid transparent",
                    color: socialTimerRunning ? "#ef4444" : "#ffffff",
                    boxShadow: socialTimerRunning
                      ? "none"
                      : "0 4px 14px rgba(245,158,11,0.2)",
                  }}
                >
                  <span className="tracking-wide">
                    {socialTimerRunning ? "Stop Timer" : "Start Social Timer"}
                  </span>
                </button>

                <p
                  className="text-[10px] font-medium leading-relaxed mt-4 text-center px-2"
                  style={{ color: socialLimitExceeded ? "#ef4444" : "var(--text-muted)" }}
                >
                  {socialLimitExceeded
                    ? "Warning: Daily social media limit exceeded."
                    : "Auto-stops when a study task begins."}
                </p>
              </div>
            </section>

            <section className="glass-card flex flex-col h-full p-6 transition-all hover:shadow-lg">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-full flex items-center justify-between mb-4 group"
              >
                <div className="text-left">
                  <p
                    className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Inputs
                  </p>
                  <h2
                    className="text-sm font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Student Profile
                  </h2>
                </div>
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors group-hover:bg-[rgba(255,255,255,0.05)]"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                    style={{ color: "var(--text-muted)" }}
                  />
                </div>
              </button>

              <div className={`space-y-6 transition-all duration-300 overflow-hidden ${profileOpen ? 'opacity-100 max-h-[500px]' : 'opacity-0 max-h-0'}`}>
                <div className="grid grid-cols-2 gap-4">
                  {/* Age Input */}
                  <div>
                    <label
                      className="text-[10px] uppercase tracking-wider font-bold block mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Age
                    </label>
                    <div className="relative group">
                      <input
                        type="number"
                        min={14}
                        max={35}
                        value={form.age}
                        onChange={(e) =>
                          update("age", parseInt(e.target.value, 10) || 18)
                        }
                        className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none transition-all"
                        style={{
                          background: "var(--bg-elevated)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Gender Toggle */}
                  <div>
                    <label
                      className="text-[10px] uppercase tracking-wider font-bold block mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Gender
                    </label>
                    <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                      {["Male", "Female"].map((g) => (
                        <button
                          key={g}
                          onClick={() => update("gender", g)}
                          className="flex-1 py-2 rounded-lg text-[11px] font-bold transition-all"
                          style={{
                            background:
                              form.gender === g
                                ? "linear-gradient(135deg, rgba(129,140,248,0.95), rgba(99,102,241,0.85))"
                                : "transparent",
                            color:
                              form.gender === g
                                ? "#fff"
                                : "var(--text-muted)",
                            boxShadow:
                              form.gender === g
                                ? "0 4px 12px rgba(99,102,241,0.25)"
                                : "none",
                          }}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-5 pt-2">
                  {[
                    {
                      key: "study_hours_per_day",
                      label: "Study hours / day",
                      min: 0,
                      max: 12,
                      step: 0.5,
                      color: "#8b5cf6",
                      ticks: [0, 3, 6, 9, 12],
                    },
                    {
                      key: "sleep_hours",
                      label: "Sleep hours / day",
                      min: 0,
                      max: 12,
                      step: 0.5,
                      color: "#06b6d4",
                      ticks: [0, 3, 6, 9, 12],
                    },
                    {
                      key: "total_social_hours",
                      label: "Social media hours",
                      min: 0,
                      max: 5,
                      step: 0.1,
                      color: "#f59e0b",
                      ticks: [0, 1, 2, 3, 4, 5],
                    },
                  ].map(({ key, label, min, max, step, color, ticks }) => (
                    <div key={key} className="group pb-2">
                      <div className="flex justify-between items-center mb-3">
                        <label
                          className="text-[10px] uppercase tracking-wider font-bold transition-colors group-hover:text-[var(--text-secondary)]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {label}
                        </label>
                        <span
                          className="text-sm font-black tracking-tight"
                          style={{ color }}
                        >
                          {form[key]}h
                        </span>
                      </div>
                      <div className="relative w-full h-[6px] rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div 
                           className="absolute top-0 left-0 h-full rounded-full transition-all duration-300 pointer-events-none"
                           style={{ 
                             width: `${getSliderFillPercentage(form[key], min, max)}%`,
                             background: color,
                             boxShadow: `0 0 10px ${color}80`
                           }}
                        />
                        <input
                          type="range"
                          min={min}
                          max={max}
                          step={step}
                          value={form[key]}
                          onChange={(e) =>
                            update(key, parseFloat(e.target.value))
                          }
                          className="absolute inset-0 w-full opacity-0 cursor-pointer"
                        />
                      </div>
                      <div className="relative w-full mt-2 h-4">
                        {ticks.map((tick) => (
                          <div 
                            key={tick}
                            className="absolute flex flex-col items-center -ml-2 w-4"
                            style={{ left: `${((tick - min) / (max - min)) * 100}%` }}
                          >
                            <div className="w-[1px] h-1.5 mb-0.5" style={{ background: "var(--border)" }}></div>
                            <span className="text-[8px] font-semibold" style={{ color: "var(--text-muted)" }}>{tick}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="glass-card flex flex-col h-full p-6 transition-all hover:shadow-lg relative overflow-hidden">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p
                    className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Sleep Log
                  </p>
                  <h2
                    className="text-sm font-bold"
                    style={{ color: "var(--text-primary)" }}
                  >
                    How long did you sleep today?
                  </h2>
                </div>
                <div className="text-right flex flex-col items-end">
                  <p
                    className="text-[9px] uppercase tracking-[0.2em] font-bold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Total today
                  </p>
                  <p
                    className="text-2xl font-black tracking-tighter"
                    style={{ color: "#06b6d4" }}
                  >
                    {dailySleepLabel}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {/* Last Night Stat */}
                <div
                  className="rounded-xl px-4 py-3 flex flex-col justify-center"
                  style={{
                    background: "rgba(15,23,42,0.2)",
                    border: "1px solid rgba(6,182,212,0.1)",
                    boxShadow: "inset 0 2px 10px rgba(0,0,0,0.1)",
                  }}
                >
                  <p
                    className="text-[9px] uppercase tracking-[0.2em] font-bold mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Last night
                  </p>
                  <p
                    className="text-sm font-black"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {initialSleepMinutes > 0 ? initialSleepLabel : "Not added yet"}
                  </p>
                </div>

                {/* Additional Sleep Stat */}
                <div
                  className="rounded-xl px-4 py-3 flex flex-col justify-center"
                  style={{
                    background: "rgba(15,23,42,0.2)",
                    border: "1px solid rgba(16,185,129,0.1)",
                    boxShadow: "inset 0 2px 10px rgba(0,0,0,0.1)",
                  }}
                >
                  <p
                    className="text-[9px] uppercase tracking-[0.2em] font-bold mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Additional sleep
                  </p>
                  <p
                    className="text-sm font-black"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {additionalSleepMinutes > 0 ? additionalSleepLabel : "0m"}
                  </p>
                </div>
              </div>

              {showInitialSleepPrompt && (
                <div
                  className="rounded-2xl p-5 mb-5 relative overflow-hidden"
                  style={{
                    background: "rgba(6,182,212,0.03)",
                    border: "1px solid rgba(6,182,212,0.15)",
                  }}
                >
                  <p
                    className="text-xs font-bold mb-4"
                    style={{ color: "var(--text-primary)" }}
                  >
                    How many hours did you sleep last night?
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label
                        className="text-[10px] uppercase tracking-wider font-bold block mb-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Hours
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={initialSleepInput.hours}
                        onChange={(e) =>
                          updateSleepField("hours", e.target.value, setInitialSleepInput)
                        }
                        className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none transition-all"
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
                        className="text-[10px] uppercase tracking-wider font-bold block mb-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Minutes
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={initialSleepInput.minutes}
                        onChange={(e) =>
                          updateSleepField("minutes", e.target.value, setInitialSleepInput)
                        }
                        className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none transition-all"
                        style={{
                          background: "var(--bg-elevated)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleInitialSleepSubmit}
                    className="w-full py-3.5 rounded-xl text-xs font-bold text-white transition-all transform active:scale-[0.98]"
                    style={{
                      background: "linear-gradient(to right, #0ea5e9, #0284c7)",
                      boxShadow: "0 4px 14px rgba(14,165,233,0.25)",
                    }}
                  >
                    Save Last Night&apos;s Sleep
                  </button>
                </div>
              )}

              <div className="mt-auto">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label
                      className="text-[10px] uppercase tracking-wider font-bold block mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Hours
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={sleepInput.hours}
                      onChange={(e) =>
                        updateSleepField("hours", e.target.value, setSleepInput)
                      }
                      className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none transition-all"
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
                      className="text-[10px] uppercase tracking-wider font-bold block mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Minutes
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={sleepInput.minutes}
                      onChange={(e) =>
                        updateSleepField("minutes", e.target.value, setSleepInput)
                      }
                      className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none transition-all"
                      style={{
                        background: "var(--bg-elevated)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)",
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSleepAdd}
                  className="w-full py-3.5 rounded-xl text-xs font-bold text-white transition-all transform active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(to right, #10b981, #059669)",
                    boxShadow: "0 4px 14px rgba(16,185,129,0.25)",
                  }}
                >
                  Add Additional Sleep Time
                </button>
                
                <p
                  className="text-[10px] font-medium leading-relaxed mt-4 text-center px-2"
                  style={{ color: sleepError ? "#ef4444" : "var(--text-muted)" }}
                >
                  {sleepError || `Logs sync locally under ${getSleepStorageKey(sleepDateKey)}`}
                </p>
              </div>
            </section>
          </section>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-3 space-y-6">
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

            <div className="col-span-12 lg:col-span-5 space-y-6">
              <section className="glass-card h-full p-6 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p
                      className="text-[10px] uppercase tracking-[0.24em] font-semibold mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Queue
                    </p>
                    <h2
                      className="text-sm font-bold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Tasks{" "}
                      {taskStats ? (
                        <span
                          className="font-normal"
                          style={{ color: "var(--text-muted)" }}
                        >
                          ({taskStats.total})
                        </span>
                      ) : (
                        ""
                      )}
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowAddTask(!showAddTask)}
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
                    {showAddTask ? "Close Loader" : "Add Task"}
                  </button>
                </div>

                <div className="flex gap-2 mb-6 flex-wrap p-1 rounded-2xl" style={{ background: "rgba(15,23,42,0.2)", border: "1px solid var(--border)", width: "fit-content" }}>
                  {["all", "active", "completed", "missed"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className="px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all"
                      style={{
                        color: activeTab === tab ? "#fff" : "var(--text-muted)",
                        background:
                          activeTab === tab
                            ? "linear-gradient(to right, #8b5cf6, #6366f1)"
                            : "transparent",
                        border: "1px solid transparent",
                        boxShadow: activeTab === tab ? "0 4px 12px rgba(139,92,246,0.3)" : "none"
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {showAddTask && (
                  <div
                    className="mb-5 p-5 rounded-[24px] space-y-3 planner-subtle"
                    style={{ border: "1px solid var(--border)" }}
                  >
                    <input
                      value={newTask.subject}
                      placeholder="What do you need to study?"
                      onChange={(e) =>
                        setNewTask((t) => ({ ...t, subject: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
                      className="w-full px-0 py-2 text-sm font-medium outline-none bg-transparent placeholder:text-[var(--text-muted)]"
                      style={{
                        color: "var(--text-primary)",
                        borderBottom: "1px solid var(--border)",
                      }}
                      autoFocus
                    />
<div className="space-y-4">
  {/* Duration */}
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

  {/* Start Time */}
  <div>
    <label
      className="text-[10px] font-semibold uppercase tracking-wider block mb-2"
      style={{ color: "var(--text-muted)" }}
    >
      Start Time <span style={{ color: "#ef4444" }}>*</span>
    </label>

    <div className="flex items-center gap-3">
      {/* Hour */}
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

      {/* Minute */}
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

      {/* AM/PM */}
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
                )}

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
                        {activeTab === "all"
                          ? "No tasks yet"
                          : `No ${activeTab} tasks`}
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
        ? "rgba(59,130,246,0.15)"  // 🔵 BLUE
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
        ? "1px solid rgba(59,130,246,0.5)" // 🔵
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
      ⏱ {formatTime(timeLeft)}
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
          alert("Pause the current task before starting another one.");
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
      alert("Cannot delete a running task. Pause it first.");
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

                {taskStats && taskStats.total > 0 && (
                  <div
                    className="mt-6 pt-5"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {taskStats.completed} of {taskStats.total} complete
                      </span>
                      <span
                        className="text-sm font-black"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {taskStats.completion_rate}%
                      </span>
                    </div>
                    <div className="relative w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", boxShadow: "inner 0 1px 3px rgba(0,0,0,0.3)" }}>
                      <div
                        className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 pointer-events-none"
                        style={{
                          width: `${taskStats.completion_rate}%`,
                          background: "linear-gradient(to right, #8b5cf6, #3b82f6)",
                          boxShadow: "0 0 12px rgba(139,92,246,0.6)"
                        }}
                      />
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-6">
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
                        className="text-xs font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <span className={result.prediction === 1 ? "text-emerald-400" : "text-rose-400"}>{(result.task_completion_probability * 100).toFixed(1)}%</span>
                        {" "}probability
                        {result.original_probability !==
                          result.task_completion_probability && (
                          <span style={{ opacity: 0.6 }}>
                            {" "}
                            · base{" "}
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
                              AI Feedback
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
                    Ready to analyze
                  </h3>
                  <p
                    className="text-xs max-w-[280px] leading-relaxed mb-5"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {canShowPrediction
                      ? "Build your task list, tune the profile, and run the planner for a probability-based study recommendation."
                      : "Add last night's sleep in the sleep log first. The prediction will appear after the student saves that entry."}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Tasks in queue", value: tasks.length },
                      { label: "Active now", value: activeCount },
                      { label: "Current streak", value: currentStreak || "—" },
                      {
                        label: "Focus rate",
                        value: focusRate != null ? `${focusRate}%` : "—",
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
            </div>
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
        .planner-card {
          background: linear-gradient(180deg, rgba(16,19,29,0.92), rgba(11,14,22,0.9));
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 18px 48px rgba(2,6,23,0.22);
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
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 30px !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
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
              It’s time to start "{startReminderTask.subject}"
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
