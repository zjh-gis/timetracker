import type { TimeAccountingData } from "./types";

export type SyncRequest = {
  baseRevision: number | null;
  hasLocalChanges: boolean;
  force: boolean;
  data: TimeAccountingData;
};

export type SyncSuccess = {
  ok: true;
  revision: number;
  data: TimeAccountingData;
  syncedAt: string;
};

export type SyncConflict = {
  ok: false;
  conflict: true;
  revision: number;
  data: TimeAccountingData;
  syncedAt: string;
};

export type SyncResponse = SyncSuccess | SyncConflict;

export type SyncSettings = {
  userId: string;
  revision: number | null;
  lastSyncedAt: string | null;
  lastSyncedDataUpdatedAt: string | null;
};
