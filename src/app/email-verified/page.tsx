import Link from "next/link";

type EmailVerifiedPageProps = {
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function EmailVerifiedPage({ searchParams }: EmailVerifiedPageProps) {
  const errorValue = (await searchParams).error;
  const error = Array.isArray(errorValue) ? errorValue[0] : errorValue;
  const failed = Boolean(error);

  return (
    <main className="auth-shell single">
      <section className="auth-card verification-result">
        <span className={`verification-icon ${failed ? "failed" : ""}`} aria-hidden="true">
          {failed ? "!" : "✓"}
        </span>
        <p className="eyebrow">EMAIL VERIFICATION</p>
        <h2>{failed ? "确认链接无效" : "邮箱确认成功"}</h2>
        <p>
          {failed
            ? verificationErrorMessage(error)
            : "邮箱已经验证完成，你也已安全登录，可以开始记录时间。"}
        </p>
        <Link className="button primary verification-enter" href="/">
          {failed ? "返回登录" : "进入时迹"}
        </Link>
      </section>
    </main>
  );
}

function verificationErrorMessage(error?: string) {
  if (error === "TOKEN_EXPIRED") return "确认链接已经过期，请返回登录后重新发送验证邮件。";
  if (error === "INVALID_TOKEN") return "确认链接不完整或已经失效，请重新申请验证邮件。";
  return "无法完成邮箱确认，请返回登录后重试。";
}
