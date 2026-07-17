import type { ActiveTimer, Category, Task, TimeAccountingData, TimeEntry } from "./types";

export const STORAGE_KEY = "time-accounting-data-v1";

const DEFAULT_DATA: TimeAccountingData = {
  version: 2,
  categories: [
    { id: "work", name: "主要工作", color: "#276749", isPrimaryWork: true },
    { id: "study", name: "学习", color: "#315eaa", isPrimaryWork: true },
    { id: "life", name: "生活", color: "#b7791f", isPrimaryWork: false },
  ],
  tasks: [],
  entries: [],
  activeTimer: null,
  updatedAt: new Date(0).toISOString(),
};

export function defaultData(): TimeAccountingData {
  return structuredClone(DEFAULT_DATA);
}

export function loadData(): TimeAccountingData {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData();

  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizeData(parsed) ?? defaultData();
  } catch {
    // Invalid local data falls back to a safe empty document.
  }

  return defaultData();
}

type LegacyData = {
  version: 1;
  categories: Category[];
  entries: Array<Omit<TimeEntry, "taskId">>;
  activeTimer: Omit<ActiveTimer, "taskId"> | null;
  updatedAt: string;
};

export function normalizeData(candidate: unknown): TimeAccountingData | null {
  if (typeof candidate !== "object" || candidate === null || !("version" in candidate)) {
    return null;
  }

  if (candidate.version === 2) {
    const current = candidate as Partial<TimeAccountingData>;
    if (!Array.isArray(current.categories) || !Array.isArray(current.tasks) || !Array.isArray(current.entries)) {
      return null;
    }
    return current as TimeAccountingData;
  }

  if (candidate.version !== 1) return null;
  const legacy = candidate as Partial<LegacyData>;
  if (!Array.isArray(legacy.categories) || !Array.isArray(legacy.entries)) return null;

  const taskByKey = new Map<string, Task>();
  const ensureTask = (name: string, categoryId: string) => {
    const key = `${categoryId}\u0000${name}`;
    const existing = taskByKey.get(key);
    if (existing) return existing;
    const task: Task = {
      id: `legacy-task-${taskByKey.size + 1}`,
      name,
      categoryId,
      createdAt: new Date().toISOString(),
    };
    taskByKey.set(key, task);
    return task;
  };

  for (const entry of legacy.entries) ensureTask(entry.title, entry.categoryId);
  if (legacy.activeTimer) ensureTask(legacy.activeTimer.title, legacy.activeTimer.categoryId);

  return {
    version: 2,
    categories: legacy.categories,
    tasks: [...taskByKey.values()],
    entries: legacy.entries.map((entry) => ({
      ...entry,
      taskId: ensureTask(entry.title, entry.categoryId).id,
    })),
    activeTimer: legacy.activeTimer
      ? {
          ...legacy.activeTimer,
          taskId: ensureTask(legacy.activeTimer.title, legacy.activeTimer.categoryId).id,
        }
      : null,
    updatedAt: legacy.updatedAt ?? new Date().toISOString(),
  };
}

export function saveData(data: TimeAccountingData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
