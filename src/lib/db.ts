import { Pool } from "pg";
import { databaseUrl } from "./server-env";

const globalDatabase = globalThis as typeof globalThis & { timeTrackerPool?: Pool };

export const pool =
  globalDatabase.timeTrackerPool ??
  new Pool({
    connectionString: databaseUrl(),
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });

if (process.env.NODE_ENV !== "production") globalDatabase.timeTrackerPool = pool;
