import type { TimeAccountingData } from "./types";
import type { SyncRequest, SyncResponse, SyncSettings } from "./sync-types";

function syncSettingsKey(userId: string) {
  return `time-accounting-sync-v2:${userId}`;
}

export function newSyncSettings(userId: string): SyncSettings {
  return {
    userId,
    revision: null,
    lastSyncedAt: null,
    lastSyncedDataUpdatedAt: null,
  };
}

export function loadSyncSettings(userId: string): SyncSettings {
  try {
    const raw = window.localStorage.getItem(syncSettingsKey(userId));
    if (!raw) return newSyncSettings(userId);
    const candidate = JSON.parse(raw) as Partial<SyncSettings>;
    if (candidate.userId !== userId) return newSyncSettings(userId);
    return {
      userId,
      revision: typeof candidate.revision === "number" ? candidate.revision : null,
      lastSyncedAt: candidate.lastSyncedAt ?? null,
      lastSyncedDataUpdatedAt: candidate.lastSyncedDataUpdatedAt ?? null,
    };
  } catch {
    return newSyncSettings(userId);
  }
}

export function saveSyncSettings(settings: SyncSettings) {
  window.localStorage.setItem(syncSettingsKey(settings.userId), JSON.stringify(settings));
}

export function clearSyncSettings(userId: string) {
  window.localStorage.removeItem(syncSettingsKey(userId));
}

export function hasMeaningfulLocalData(data: TimeAccountingData) {
  return data.tasks.length > 0 || data.entries.length > 0 || data.activeTimer !== null;
}

export async function requestSync(
  settings: SyncSettings,
  data: TimeAccountingData,
  force = false,
): Promise<{ response: SyncResponse; status: number }> {
  const hasLocalChanges =
    settings.revision === null
      ? hasMeaningfulLocalData(data)
      : data.updatedAt !== settings.lastSyncedDataUpdatedAt;
  const body: SyncRequest = {
    baseRevision: settings.revision,
    hasLocalChanges,
    force,
    data,
  };
  const result = await fetch("/api/sync/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(body),
  });
  const response = (await result.json()) as SyncResponse | { error?: string };
  if (result.status === 401) throw new Error("登录状态已失效，请重新登录");
  if (result.status !== 200 && result.status !== 409) {
    throw new Error("error" in response && response.error ? response.error : "云同步暂时不可用");
  }
  return { response: response as SyncResponse, status: result.status };
}
