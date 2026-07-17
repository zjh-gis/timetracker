import type { ActiveTimer } from "./types";

export function localDateKey(value: Date = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function activeSeconds(timer: ActiveTimer, now = Date.now()) {
  if (!timer.runningSince) return timer.accumulatedSeconds;
  const currentSegment = Math.max(
    0,
    Math.floor((now - new Date(timer.runningSince).getTime()) / 1000),
  );
  return timer.accumulatedSeconds + currentSegment;
}

export function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function formatClock(iso: string | null) {
  if (!iso) return "补录";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

