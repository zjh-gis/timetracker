"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { loadData } from "@/lib/storage";
import { hasUnsyncedLocalChanges } from "@/lib/sync-client";

type AccountStatusProps = { userId: string; name: string; email: string };

export function AccountStatus({ userId, name, email }: AccountStatusProps) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    const hasUnsyncedChanges = hasUnsyncedLocalChanges(userId, loadData(userId));
    const message = hasUnsyncedChanges
      ? "检测到本机还有尚未同步到云端的任务或记录。建议点“取消”，在首页完成云同步后再退出。\n\n仍要退出吗？本机副本会保留，下次使用此账号登录时仍可恢复。"
      : "确定退出当前账号吗？本机数据副本会保留，下次使用此账号登录时仍可恢复。";
    if (!window.confirm(message)) return;
    setBusy(true);
    const result = await authClient.signOut();
    if (result.error) {
      setBusy(false);
      window.alert(result.error.message ?? "退出失败");
      return;
    }
    window.location.assign("/");
  }

  return (
    <div className="account-status" aria-label="当前登录账号">
      <Link className="account-status-profile" href="/account" aria-label="打开账号设置">
        <span className="account-status-dot" aria-hidden="true" />
        <span className="account-status-copy">
          <small>已登录 · {name}</small>
          <strong title={email}>{email}</strong>
        </span>
      </Link>
      <button type="button" disabled={busy} onClick={signOut}>
        {busy ? "退出中…" : "退出"}
      </button>
    </div>
  );
}
