"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccountPanel } from "@/components/AccountPanel";
import { authClient } from "@/lib/auth-client";

export default function AccountPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) router.replace("/");
  }, [isPending, router, session]);

  if (isPending) return <main className="loading">正在检查登录状态…</main>;
  if (!session) return <main className="loading">正在返回登录页面…</main>;

  return (
    <main className="account-page">
      <Link className="auth-back" href="/">← 返回时迹</Link>
      <header className="account-page-header">
        <p className="eyebrow">SETTINGS</p>
        <h1>账号设置</h1>
        <p>集中管理账号、数据备份和登录状态。</p>
      </header>
      <AccountPanel
        userId={session.user.id}
        name={session.user.name}
        email={session.user.email}
      />
    </main>
  );
}
