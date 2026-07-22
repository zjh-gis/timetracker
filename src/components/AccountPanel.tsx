"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { clearUserData, loadData } from "@/lib/storage";
import { clearSyncSettings, hasUnsyncedLocalChanges } from "@/lib/sync-client";

type AccountPanelProps = { userId: string; name: string; email: string };

export function AccountPanel({ userId, name, email }: AccountPanelProps) {
  const [busyAction, setBusyAction] = useState<"sign-out" | "delete" | null>(null);

  function exportData() {
    const data = loadData(userId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `timetracker-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function signOut() {
    const hasUnsyncedChanges = hasUnsyncedLocalChanges(userId, loadData(userId));
    const message = hasUnsyncedChanges
      ? "检测到本机还有尚未同步到云端的任务或记录。建议点“取消”，返回首页完成云同步后再退出。\n\n仍要退出吗？本机副本会保留，下次使用此账号登录时仍可恢复。"
      : "确定退出当前账号吗？本机数据副本会保留，下次使用此账号登录时仍可恢复。";
    if (!window.confirm(message)) return;
    setBusyAction("sign-out");
    const result = await authClient.signOut();
    if (result.error) {
      setBusyAction(null);
      window.alert(result.error.message ?? "退出失败");
      return;
    }
    window.location.assign("/");
  }

  async function deleteAccount() {
    const password = window.prompt("注销会永久删除账号、任务和时间记录。请输入当前密码确认：");
    if (!password) return;
    if (!window.confirm("最后确认：账号及云端数据删除后无法恢复，确定注销吗？")) return;
    setBusyAction("delete");
    const result = await authClient.deleteUser({ password });
    if (result.error) {
      setBusyAction(null);
      window.alert(result.error.message ?? "注销失败");
      return;
    }
    clearUserData(userId);
    clearSyncSettings(userId);
    window.location.assign("/");
  }

  return (
    <section className="account-card">
      <div className="account-overview">
        <p className="eyebrow">ACCOUNT</p>
        <h2>账号信息</h2>
        <dl className="account-details">
          <div>
            <dt>显示名称</dt>
            <dd>{name}</dd>
          </div>
          <div>
            <dt>登录邮箱</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt>账号状态</dt>
            <dd><span className="account-active-dot" aria-hidden="true" />已登录</dd>
          </div>
        </dl>
      </div>

      <div className="account-section">
        <div>
          <h3>数据与登录</h3>
          <p>导出此设备上的完整 JSON 备份，或退出当前账号。退出不会删除本机副本；如有未同步的数据，系统会在退出前提醒。</p>
        </div>
        <div className="account-actions">
          <button className="text-button" type="button" onClick={exportData}>导出数据</button>
          <button className="text-button" type="button" disabled={busyAction !== null} onClick={signOut}>
            {busyAction === "sign-out" ? "退出中…" : "退出登录"}
          </button>
        </div>
      </div>

      <div className="account-section account-danger-zone">
        <div>
          <h3>注销账号</h3>
          <p>立即删除云端账号和全部时间数据。此操作无法撤销，请先导出备份。</p>
        </div>
        <button className="text-button danger" type="button" disabled={busyAction !== null} onClick={deleteAccount}>
          {busyAction === "delete" ? "注销中…" : "永久注销账号"}
        </button>
      </div>
    </section>
  );
}
