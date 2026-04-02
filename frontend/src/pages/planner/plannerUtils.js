// Shared planner helpers live here so the main page stays focused on app flow.
export function getTaskStartTime(task) {
  if (task?.planned_start) {
    const plannedStart = new Date(task.planned_start).getTime();
    if (!Number.isNaN(plannedStart)) return plannedStart;
  }

  if (task?.scheduled_slot) {
    const startPart = task.scheduled_slot.split(" - ")[0]?.trim();
    const match = startPart?.match(/(\d+):(\d+)\s*(AM|PM)/i);

    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const meridiem = match[3].toUpperCase();

      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      return scheduledTime.getTime();
    }
  }

  return Number.MAX_SAFE_INTEGER;
}

export function sortTasksByStartTime(taskA, taskB) {
  const startTimeDiff = getTaskStartTime(taskA) - getTaskStartTime(taskB);
  if (startTimeDiff !== 0) return startTimeDiff;

  const createdAtDiff =
    new Date(taskA?.created_at || 0).getTime() - new Date(taskB?.created_at || 0).getTime();
  if (!Number.isNaN(createdAtDiff) && createdAtDiff !== 0) return createdAtDiff;

  return String(taskA?.id || "").localeCompare(String(taskB?.id || ""));
}

export function getSleepDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSleepStorageKey(dateKey) {
  return `sleep_${dateKey}`;
}

export function clampSleepMinutes(minutes) {
  return Math.max(0, Math.min(24 * 60, Math.floor(Number(minutes) || 0)));
}

export function formatSleepDuration(totalMinutes) {
  const safeMinutes = clampSleepMinutes(totalMinutes);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

export function formatStudyDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `Today's Study Time: ${hours} hours ${minutes} minutes`;
}

export function formatCompactStudyDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} h ${minutes} m`;
}

export function getSocialStorageKey(dateKey) {
  return `social_time_${dateKey}`;
}

export function clampSocialSeconds(seconds) {
  return Math.max(0, Math.floor(Number(seconds) || 0));
}

export function formatHoursMinutesFromSeconds(totalSeconds) {
  const safeSeconds = clampSocialSeconds(totalSeconds);
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export function formatClockDuration(totalSeconds) {
  const safeSeconds = clampSocialSeconds(totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getSliderFillPercentage(value, min, max) {
  const numericValue = Number(value);
  const numericMin = Number(min);
  const numericMax = Number(max);

  if (
    Number.isNaN(numericValue) ||
    Number.isNaN(numericMin) ||
    Number.isNaN(numericMax) ||
    numericMax <= numericMin
  ) {
    return 0;
  }

  const clampedValue = Math.min(Math.max(numericValue, numericMin), numericMax);
  return ((clampedValue - numericMin) / (numericMax - numericMin)) * 100;
}

export function parseDateValue(value) {
  if (!value) return null;

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const fallback = new Date(normalized);
  if (!Number.isNaN(fallback.getTime())) return fallback;

  return null;
}

export function readSleepEntry(dateKey) {
  if (typeof window === "undefined") {
    return {
      totalMinutes: 0,
      initialMinutes: 0,
      additionalMinutes: 0,
      initialLogged: false,
    };
  }

  try {
    const raw = window.localStorage.getItem(getSleepStorageKey(dateKey));
    if (!raw) {
      return {
        totalMinutes: 0,
        initialMinutes: 0,
        additionalMinutes: 0,
        initialLogged: false,
      };
    }

    const parsed = JSON.parse(raw);
    const hasBreakdown =
      parsed && (parsed.initialMinutes != null || parsed.additionalMinutes != null);
    const initialMinutes = hasBreakdown
      ? clampSleepMinutes(parsed?.initialMinutes)
      : Boolean(parsed?.initialLogged)
        ? clampSleepMinutes(parsed?.totalMinutes)
        : 0;
    const additionalMinutes = hasBreakdown
      ? clampSleepMinutes(parsed?.additionalMinutes)
      : 0;

    return {
      totalMinutes: clampSleepMinutes(initialMinutes + additionalMinutes),
      initialMinutes,
      additionalMinutes,
      initialLogged: Boolean(parsed?.initialLogged),
    };
  } catch (error) {
    console.error("Failed to read sleep entry:", error);
    return {
      totalMinutes: 0,
      initialMinutes: 0,
      additionalMinutes: 0,
      initialLogged: false,
    };
  }
}

export function readSocialEntry(dateKey) {
  if (typeof window === "undefined") {
    return { totalSeconds: 0, isRunning: false, startedAt: null };
  }

  try {
    const raw = window.localStorage.getItem(getSocialStorageKey(dateKey));
    if (!raw) return { totalSeconds: 0, isRunning: false, startedAt: null };

    const parsed = JSON.parse(raw);
    return {
      totalSeconds: clampSocialSeconds(parsed?.totalSeconds),
      isRunning: Boolean(parsed?.isRunning),
      startedAt: parsed?.startedAt || null,
    };
  } catch (error) {
    console.error("Failed to read social entry:", error);
    return { totalSeconds: 0, isRunning: false, startedAt: null };
  }
}

export function writeSleepEntry(
  dateKey,
  totalMinutes,
  initialLogged,
  initialMinutes = 0,
  additionalMinutes = 0,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getSleepStorageKey(dateKey),
      JSON.stringify({
        totalMinutes: clampSleepMinutes(totalMinutes),
        initialMinutes: clampSleepMinutes(initialMinutes),
        additionalMinutes: clampSleepMinutes(additionalMinutes),
        initialLogged: Boolean(initialLogged),
      }),
    );
  } catch (error) {
    console.error("Failed to save sleep entry:", error);
  }
}

export function writeSocialEntry(dateKey, totalSeconds, isRunning, startedAt = null) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      getSocialStorageKey(dateKey),
      JSON.stringify({
        totalSeconds: clampSocialSeconds(totalSeconds),
        isRunning: Boolean(isRunning),
        startedAt: startedAt || null,
      }),
    );
  } catch (error) {
    console.error("Failed to save social entry:", error);
  }
}
