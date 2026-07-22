"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up" | "forgot";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name: name.trim() || email.split("@")[0],
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (result.error) throw new Error(result.error.message);
        setMessage("注册申请已提交，请打开邮箱完成验证后登录。");
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (result.error) throw new Error(result.error.message);
        setMessage("如果该邮箱已注册，重置链接会发送到邮箱。");
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          rememberMe: true,
        });
        if (result.error) throw new Error(readableAuthError(result.error.message));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setPassword("");
    setMessage("");
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand">
        <p className="eyebrow">PERSONAL TIME LEDGER</p>
        <h1>时迹</h1>
        <p>记录时间事实，看清生活投向。</p>
      </section>
      <section className="auth-card">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h2>{mode === "sign-in" ? "登录" : mode === "sign-up" ? "创建账号" : "重置密码"}</h2>
        </div>
        <form onSubmit={submit}>
          {mode === "sign-up" && (
            <label className="field">
              <span>称呼</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={80} />
            </label>
          )}
          <label className="field">
            <span>邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          {mode !== "forgot" && (
            <label className="field">
              <span>密码</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                minLength={10}
                maxLength={128}
                required
              />
              {mode === "sign-up" && <small>至少 10 位，建议使用密码管理器生成。</small>}
            </label>
          )}
          {mode === "sign-up" && (
            <label className="consent-check">
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required />
              <span>我已阅读并同意 <Link href="/terms">用户协议</Link> 和 <Link href="/privacy">隐私政策</Link></span>
            </label>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? "请稍候…" : mode === "sign-in" ? "登录" : mode === "sign-up" ? "注册并验证邮箱" : "发送重置邮件"}
          </button>
        </form>
        {message && <p className="auth-message" role="status">{message}</p>}
        <div className="auth-links">
          {mode !== "sign-in" && <button type="button" onClick={() => switchMode("sign-in")}>返回登录</button>}
          {mode === "sign-in" && <button type="button" onClick={() => switchMode("sign-up")}>创建账号</button>}
          {mode === "sign-in" && <button type="button" onClick={() => switchMode("forgot")}>忘记密码</button>}
        </div>
        {mode !== "sign-up" && <p className="auth-consent"><Link href="/terms">用户协议</Link> · <Link href="/privacy">隐私政策</Link></p>}
      </section>
    </main>
  );
}

function readableAuthError(message?: string) {
  if (!message) return "登录失败，请检查邮箱和密码";
  if (/verify|verified/i.test(message)) return "请先打开验证邮件完成邮箱验证";
  if (/credential|password|email/i.test(message)) return "邮箱或密码不正确";
  return message;
}
