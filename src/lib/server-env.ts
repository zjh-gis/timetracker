const DEVELOPMENT_AUTH_SECRET = "development-only-secret-change-before-production-0001";

export function databaseUrl() {
  return process.env.DATABASE_URL;
}

export function authSecret() {
  return process.env.BETTER_AUTH_SECRET ?? DEVELOPMENT_AUTH_SECRET;
}

export function authBaseUrl() {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

export function assertProductionEnvironment() {
  if (process.env.NODE_ENV !== "production") return;
  const missing = [
    "DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL",
    "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM",
    "NEXT_PUBLIC_OPERATOR_NAME", "NEXT_PUBLIC_SUPPORT_EMAIL",
  ].filter(
    (name) => !process.env[name],
  );
  if (missing.length > 0) {
    throw new Error(`生产环境缺少必要配置：${missing.join(", ")}`);
  }
  if (process.env.BETTER_AUTH_SECRET === DEVELOPMENT_AUTH_SECRET) {
    throw new Error("生产环境不得使用开发认证密钥");
  }
}

export function trustedOrigins() {
  const configured = process.env.BETTER_AUTH_TRUSTED_ORIGINS
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return configured?.length ? configured : [authBaseUrl()];
}
