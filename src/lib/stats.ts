import type { Category, Task, TimeEntry } from "./types";
import { localDateKey } from "./time";

export type StatsPeriod = "day" | "month" | "year";

export type AggregateSlice = {
  id: string;
  name: string;
  color: string;
  seconds: number;
};

export type DayTotal = {
  date: string;
  seconds: number;
  slices: AggregateSlice[];
};

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function monthLabel(dateKey: string) {
  const date = parseDateKey(dateKey);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function yearLabel(dateKey: string) {
  return `${parseDateKey(dateKey).getFullYear()}年`;
}

export function shiftDateKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function shiftMonthKey(dateKey: string, months: number) {
  const date = parseDateKey(dateKey);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return localDateKey(date);
}

export function shiftYearKey(dateKey: string, years: number) {
  const date = parseDateKey(dateKey);
  date.setFullYear(date.getFullYear() + years);
  return localDateKey(date);
}

export function isSameMonth(a: string, b: string) {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function isSameYear(a: string, b: string) {
  return a.slice(0, 4) === b.slice(0, 4);
}

export function entriesInPeriod(entries: TimeEntry[], period: StatsPeriod, anchorDate: string) {
  if (period === "day") return entries.filter((entry) => entry.date === anchorDate);
  if (period === "month") return entries.filter((entry) => isSameMonth(entry.date, anchorDate));
  return entries.filter((entry) => isSameYear(entry.date, anchorDate));
}

export function sumDuration(entries: TimeEntry[]) {
  return entries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
}

export function aggregateByCategory(entries: TimeEntry[], categories: Category[]): AggregateSlice[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    totals.set(entry.categoryId, (totals.get(entry.categoryId) ?? 0) + entry.durationSeconds);
  }
  return [...totals.entries()]
    .map(([id, seconds]) => {
      const category = categories.find((item) => item.id === id);
      return {
        id,
        name: category?.name ?? "未分类",
        color: category?.color ?? "#657069",
        seconds,
      };
    })
    .filter((slice) => slice.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}

export function aggregateByTask(
  entries: TimeEntry[],
  tasks: Task[],
  categories: Category[],
): AggregateSlice[] {
  const totals = new Map<string, { name: string; color: string; seconds: number }>();
  for (const entry of entries) {
    const key = entry.taskId ?? `title:${entry.title}`;
    const task = entry.taskId ? tasks.find((item) => item.id === entry.taskId) : undefined;
    const category = categories.find((item) => item.id === entry.categoryId);
    const existing = totals.get(key);
    if (existing) {
      existing.seconds += entry.durationSeconds;
    } else {
      totals.set(key, {
        name: task?.name ?? entry.title,
        color: category?.color ?? "#657069",
        seconds: entry.durationSeconds,
      });
    }
  }
  return [...totals.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .filter((slice) => slice.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}

export function dayTotalsInMonth(
  entries: TimeEntry[],
  categories: Category[],
  monthAnchor: string,
): DayTotal[] {
  const monthEntries = entriesInPeriod(entries, "month", monthAnchor);
  const byDate = new Map<string, TimeEntry[]>();
  for (const entry of monthEntries) {
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  }
  return [...byDate.entries()]
    .map(([date, dayEntries]) => ({
      date,
      seconds: sumDuration(dayEntries),
      slices: aggregateByCategory(dayEntries, categories),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildMonthGrid(monthAnchor: string) {
  const anchor = parseDateKey(monthAnchor);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: string | null; inMonth: boolean }> = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ date: null, inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: localDateKey(new Date(year, month, day)), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, inMonth: false });
  }
  return cells;
}

export function dailyBarsForPeriod(
  entries: TimeEntry[],
  period: StatsPeriod,
  anchorDate: string,
): Array<{ label: string; date: string; seconds: number }> {
  if (period === "day") {
    return [
      {
        label: anchorDate.slice(5),
        date: anchorDate,
        seconds: sumDuration(entriesInPeriod(entries, "day", anchorDate)),
      },
    ];
  }

  if (period === "month") {
    const anchor = parseDateKey(anchorDate);
    const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const bars = [];
    for (let day = 1; day <= days; day += 1) {
      const date = localDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), day));
      bars.push({
        label: String(day),
        date,
        seconds: sumDuration(entries.filter((entry) => entry.date === date)),
      });
    }
    return bars;
  }

  const year = parseDateKey(anchorDate).getFullYear();
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    return {
      label: `${month}月`,
      date: `${prefix}-01`,
      seconds: sumDuration(entries.filter((entry) => entry.date.startsWith(prefix))),
    };
  });
}
