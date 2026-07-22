import nodemailer from "nodemailer";

const EMAIL_DEDUPLICATION_MS = 60_000;
const globalEmailState = globalThis as typeof globalThis & {
  recentTransactionalEmails?: Map<string, number>;
};
const recentTransactionalEmails =
  globalEmailState.recentTransactionalEmails ?? new Map<string, number>();
globalEmailState.recentTransactionalEmails = recentTransactionalEmails;

type TransactionalEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendTransactionalEmail(message: TransactionalEmail) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (!host || !user || !password || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP 配置不完整，无法发送账户邮件");
    }
    console.info(`[dev-email] ${message.subject} -> ${message.to}\n${message.text}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  const deliveryKey = `${message.to.trim().toLocaleLowerCase()}:${message.subject}`;
  const now = Date.now();
  for (const [key, sentAt] of recentTransactionalEmails) {
    if (now - sentAt >= EMAIL_DEDUPLICATION_MS) recentTransactionalEmails.delete(key);
  }
  const lastSentAt = recentTransactionalEmails.get(deliveryKey) ?? 0;
  if (now - lastSentAt < EMAIL_DEDUPLICATION_MS) return;

  recentTransactionalEmails.set(deliveryKey, now);
  try {
    await transporter.sendMail({ from, ...message });
  } catch (error) {
    if (recentTransactionalEmails.get(deliveryKey) === now) {
      recentTransactionalEmails.delete(deliveryKey);
    }
    throw error;
  }
}

export function linkEmail(to: string, subject: string, intro: string, url: string) {
  return sendTransactionalEmail({
    to,
    subject,
    text: `${intro}\n\n${url}\n\n如果不是你本人操作，请忽略这封邮件。`,
    html: `<p>${intro}</p><p><a href="${url}">继续操作</a></p><p style="color:#657069;font-size:12px">如果不是你本人操作，请忽略这封邮件。</p>`,
  });
}
