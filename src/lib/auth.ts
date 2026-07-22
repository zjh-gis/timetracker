import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { pool } from "./db";
import { linkEmail } from "./email";
import { authBaseUrl, authSecret, trustedOrigins } from "./server-env";

export const auth = betterAuth({
  appName: "时迹",
  database: pool,
  baseURL: authBaseUrl(),
  secret: authSecret(),
  trustedOrigins: trustedOrigins(),
  advanced: {
    database: { generateId: "uuid" },
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await linkEmail(user.email, "重置时迹密码", "点击下面的链接设置新密码：", url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await linkEmail(user.email, "验证时迹邮箱", "点击下面的链接完成邮箱验证：", url);
    },
  },
  user: {
    changeEmail: { enabled: true },
    deleteUser: { enabled: true },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
  },
  plugins: [nextCookies()],
});
