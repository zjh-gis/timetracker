"use client";

import { authClient } from "@/lib/auth-client";
import { AuthScreen } from "./AuthScreen";
import { TimeAccountingApp } from "./TimeAccountingApp";

export function AuthGate() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <main className="loading">正在检查登录状态…</main>;
  if (!session) return <AuthScreen />;
  return (
    <TimeAccountingApp
      key={session.user.id}
      userId={session.user.id}
      userName={session.user.name}
      userEmail={session.user.email}
    />
  );
}
