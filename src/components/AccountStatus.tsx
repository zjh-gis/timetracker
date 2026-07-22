"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { clearUserData } from "@/lib/storage";
import { clearSyncSettings } from "@/lib/sync-client";

type AccountStatusProps = { userId: string; name: string; email: string };

export function AccountStatus({ userId, name, email }: AccountStatusProps) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    if (!window.confirm("退出后会清除此设备上的本地副本，请先确认云同步已经完成。继续吗？")) return;
    setBusy(true);
    const result = await authClient.signOut();
    if (result.error) {
      setBusy(false);
      window.alert(result.error.message ?? "退出失败");
      return;
    }
    clearUserData(userId);
    clearSyncSettings(userId);
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
