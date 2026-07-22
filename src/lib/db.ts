import { createPool, type Pool } from "mysql2/promise";
import { databaseUrl } from "./server-env";

const globalDatabase = globalThis as typeof globalThis & { timeTrackerPool?: Pool };

export const pool =
  globalDatabase.timeTrackerPool ??
  createPool({
    uri: databaseUrl(),
    connectionLimit: Number(process.env.DATABASE_POOL_MAX ?? 10),
    waitForConnections: true,
    queueLimit: 0,
    connectTimeout: 8_000,
    enableKeepAlive: true,
    timezone: "Z",
    charset: "utf8mb4",
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });

if (process.env.NODE_ENV !== "production") globalDatabase.timeTrackerPool = pool;
