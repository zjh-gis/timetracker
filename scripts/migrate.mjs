import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("MIGRATION_DATABASE_URL or DATABASE_URL is required");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sql = await readFile(path.join(root, "migrations", "0001_initial.sql"), "utf8");
const connection = await mysql.createConnection({
  uri: connectionString,
  timezone: "Z",
  charset: "utf8mb4",
  multipleStatements: true,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
});

try {
  await connection.query(sql);
  console.log("Applied MySQL migration 0001_initial");
} finally {
  await connection.end();
}
