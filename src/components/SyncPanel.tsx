"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadSyncSettings, requestSync, saveSyncSettings } from "@/lib/sync-client";
import type { SyncConflict, SyncSettings, SyncSuccess } from "@/lib/sync-types";
import type { TimeAccountingData } from "@/lib/types";

type SyncPanelProps = {
  userId: string;
  data: TimeAccountingData;
  onApplyData: (data: TimeAccountingData) => void;
  hidden?: boolean;
};

export function SyncPanel({ userId, data, onApplyData, hidden = false }: SyncPanelProps) {
  const [settings, setSettings] = useState<SyncSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("正在连接云端…");
  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const settingsRef = useRef<SyncSettings | null>(null);
  const dataRef = useRef(data);
  const inFlightRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const hydrationTask = window.setTimeout(() => {
      const stored = loadSyncSettings(userId);
      settingsRef.current = stored;
      setSettings(stored);
    }, 0);
    return () => window.clearTimeout(hydrationTask);
  }, [userId]);

  const storeSettings = useCallback((next: SyncSettings) => {
    settingsRef.current = next;
    saveSyncSettings(next);
    setSettings(next);
  }, []);

  const applySuccess = useCallback(
    (response: SyncSuccess, snapshot: TimeAccountingData, currentSettings: SyncSettings) => {
      const localChangedDuringRequest = dataRef.current.updatedAt !== snapshot.updatedAt;
      const remoteDiffersFromSnapshot = JSON.stringify(response.data) !== JSON.stringify(snapshot);
      if (localChangedDuringRequest && remoteDiffersFromSnapshot) {
        setConflict({
          ok: false,
          conflict: true,
          revision: response.revision,
          data: response.data,
          syncedAt: response.syncedAt,
        });
        setMessage("同步期间本机和云端都发生了变化，请选择保留哪一份");
        return;
      }

      if (!localChangedDuringRequest && remoteDiffersFromSnapshot) {
        dataRef.current = response.data;
        onApplyData(response.data);
      }
      storeSettings({
        ...currentSettings,
        revision: response.revision,
        lastSyncedAt: response.syncedAt,
        lastSyncedDataUpdatedAt: localChangedDuringRequest
          ? snapshot.updatedAt
          : response.data.updatedAt,
      });
      setConflict(null);
      setMessage(localChangedDuringRequest ? "已保存，继续同步新变化…" : "数据已安全保存到云端");
    },
    [onApplyData, storeSettings],
  );

  const syncNow = useCallback(
    async (force = false) => {
      const currentSettings = settingsRef.current;
      if (!currentSettings || inFlightRef.current) return;
      const snapshot = dataRef.current;
      inFlightRef.current = true;
      setBusy(true);
      setMessage(force ? "正在用本机数据更新云端…" : "正在同步…");
      try {
        const { response, status } = await requestSync(currentSettings, snapshot, force);
        if (status === 409 || !response.ok) {
          setConflict(response as SyncConflict);
          setMessage("检测到其他设备的新变化，请选择保留哪一份");
          return;
        }
        applySuccess(response, snapshot, currentSettings);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "云同步失败，请稍后重试");
      } finally {
        inFlightRef.current = false;
        setBusy(false);
      }
    },
    [applySuccess],
  );

  useEffect(() => {
    if (!settings || conflict) return;
    const timer = window.setTimeout(() => void syncNow(), 1200);
    return () => window.clearTimeout(timer);
  }, [conflict, data.updatedAt, settings, syncNow]);

  useEffect(() => {
    if (!settings) return;
    const interval = window.setInterval(() => void syncNow(), 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [settings, syncNow]);

  function useRemote() {
    if (!conflict || !settingsRef.current) return;
    if (!window.confirm("使用云端数据将替换本机尚未同步的变化，继续吗？")) return;
    dataRef.current = conflict.data;
    onApplyData(conflict.data);
    storeSettings({
      ...settingsRef.current,
      revision: conflict.revision,
      lastSyncedAt: conflict.syncedAt,
      lastSyncedDataUpdatedAt: conflict.data.updatedAt,
    });
    setConflict(null);
    setMessage("已使用云端数据");
  }

  function overwriteRemote() {
    if (!window.confirm("确定用本机数据覆盖云端版本吗？另一台设备下次同步时会收到这份数据。")) return;
    setConflict(null);
    void syncNow(true);
  }

  return (
    <section className="sync-card" hidden={hidden}>
      <div className="section-heading sync-heading">
        <div>
          <p className="eyebrow">CLOUD SYNC</p>
          <h2>云端同步</h2>
        </div>
        <span className={`sync-indicator ${settings?.lastSyncedAt ? "enabled" : ""}`}>
          {settings?.lastSyncedAt ? "已连接" : "连接中"}
        </span>
      </div>
      <p className="sync-help">登录同一邮箱账号即可在电脑和手机之间同步，无需复制同步码。</p>
      <div className="sync-actions">
        <button className="button primary" type="button" disabled={busy || !settings} onClick={() => void syncNow()}>
          {busy ? "同步中…" : "立即同步"}
        </button>
      </div>
      {conflict && (
        <div className="sync-conflict" role="alert">
          <strong>发现同步冲突</strong>
          <p>本机和另一台设备都有新变化，请选择保留哪一份。操作前可先导出 JSON 备份。</p>
          <div>
            <button className="text-button" type="button" disabled={busy} onClick={useRemote}>使用云端</button>
            <button className="text-button danger-text" type="button" disabled={busy} onClick={overwriteRemote}>用本机覆盖</button>
          </div>
        </div>
      )}
      <p className="sync-status" role="status">
        {message}
        {settings?.lastSyncedAt ? ` · ${new Date(settings.lastSyncedAt).toLocaleString("zh-CN")}` : ""}
      </p>
    </section>
  );
}
