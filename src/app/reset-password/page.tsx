"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("正在验证重置链接…");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const task = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const nextToken = params.get("token");
      setToken(nextToken);
      setMessage(nextToken ? "" : "重置链接无效或已过期，请重新申请。");
    }, 0);
    return () => window.clearTimeout(task);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message ?? "密码重置失败，请重新申请链接");
      return;
    }
    setMessage("密码已经更新，其他设备的旧会话已失效。现在可以返回登录。");
    setToken(null);
  }

  return (
    <main className="auth-shell single">
      <section className="auth-card">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h2>设置新密码</h2>
        {token && (
          <form onSubmit={submit}>
            <label className="field">
              <span>新密码</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={128} required autoComplete="new-password" />
            </label>
            <button className="button primary full" disabled={busy}>{busy ? "正在保存…" : "更新密码"}</button>
          </form>
        )}
        {message && <p className="auth-message" role="status">{message}</p>}
        <Link className="auth-back" href="/">返回登录</Link>
      </section>
    </main>
  );
}
