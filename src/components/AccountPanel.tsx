"use client";

import { authClient } from "@/lib/auth-client";
import { clearUserData } from "@/lib/storage";
import { clearSyncSettings } from "@/lib/sync-client";

type AccountPanelProps = { userId: string; email: string };

export function AccountPanel({ userId, email }: AccountPanelProps) {
  async function signOut() {
    if (!window.confirm("退出后会清除此设备上的本地副本，请先确认云同步已经完成。继续吗？")) return;
    const result = await authClient.signOut();
    if (result.error) {
      window.alert(result.error.message ?? "退出失败");
      return;
    }
    clearUserData(userId);
    clearSyncSettings(userId);
    window.location.assign("/");
  }

  async function deleteAccount() {
    const password = window.prompt("注销会永久删除账号、任务和时间记录。请输入当前密码确认：");
    if (!password) return;
    if (!window.confirm("最后确认：账号及云端数据删除后无法恢复，确定注销吗？")) return;
    const result = await authClient.deleteUser({ password });
    if (result.error) {
      window.alert(result.error.message ?? "注销失败");
      return;
    }
    clearUserData(userId);
    clearSyncSettings(userId);
    window.location.assign("/");
  }

  return (
    <section className="account-card">
      <div>
        <p className="eyebrow">ACCOUNT</p>
        <h2>账号与数据</h2>
        <p className="account-email">{email}</p>
      </div>
      <div className="account-actions">
        <button className="text-button" type="button" onClick={signOut}>退出登录</button>
        <button className="text-button danger" type="button" onClick={deleteAccount}>注销账号</button>
      </div>
      <p className="account-note">注销会立即删除云端账号和全部时间数据。操作前建议先导出 JSON 备份。</p>
    </section>
  );
}
