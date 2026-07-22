import type { PoolClient } from "pg";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { assertProductionEnvironment } from "@/lib/server-env";
import { allowRequest, requestAddress } from "@/lib/rate-limit";
import { normalizeData } from "@/lib/storage";
import type { SyncRequest } from "@/lib/sync-types";
import type { ActiveTimer, Category, Task, TimeAccountingData, TimeEntry } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  assertProductionEnvironment();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "请先登录" }, { status: 401 });
  if (!allowRequest(`sync:${session.user.id}:${requestAddress(request)}`, 120, 60_000)) {
    return Response.json({ error: "同步请求过于频繁，请稍后重试" }, { status: 429 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return Response.json({ error: "同步数据超过 2 MB 限制" }, { status: 413 });
  }

  let body: Partial<SyncRequest>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return Response.json({ error: "同步数据超过 2 MB 限制" }, { status: 413 });
    }
    body = JSON.parse(raw) as Partial<SyncRequest>;
  } catch {
    return Response.json({ error: "请求格式无效" }, { status: 400 });
  }
  const data = normalizeData(body.data);
  if (!data || !validData(data)) {
    return Response.json({ error: "时间数据格式无效或超过数量限制" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO time_sync_state (user_id, revision) VALUES ($1, 0) ON CONFLICT DO NOTHING`,
      [session.user.id],
    );
    const stateResult = await client.query<{ revision: string; updated_at: Date }>(
      `SELECT revision, updated_at FROM time_sync_state WHERE user_id = $1 FOR UPDATE`,
      [session.user.id],
    );
    const state = stateResult.rows[0];
    if (!state) throw new Error("sync state missing after upsert");
    const currentRevision = Number(state.revision);

    if (currentRevision === 0) {
      const syncedAt = new Date();
      await writeData(client, session.user.id, data, syncedAt);
      await updateRevision(client, session.user.id, 1, syncedAt);
      await client.query("COMMIT");
      return noStore({ ok: true, revision: 1, data, syncedAt: syncedAt.toISOString() });
    }

    if (!body.hasLocalChanges) {
      const remote = await readData(client, session.user.id, state.updated_at);
      await client.query("COMMIT");
      return noStore({
        ok: true,
        revision: currentRevision,
        data: remote,
        syncedAt: state.updated_at.toISOString(),
      });
    }

    if (body.force || body.baseRevision === currentRevision) {
      const nextRevision = currentRevision + 1;
      const syncedAt = new Date();
      await writeData(client, session.user.id, data, syncedAt);
      await updateRevision(client, session.user.id, nextRevision, syncedAt);
      await client.query("COMMIT");
      return noStore({ ok: true, revision: nextRevision, data, syncedAt: syncedAt.toISOString() });
    }

    const remote = await readData(client, session.user.id, state.updated_at);
    await client.query("COMMIT");
    return noStore(
      {
        ok: false,
        conflict: true,
        revision: currentRevision,
        data: remote,
        syncedAt: state.updated_at.toISOString(),
      },
      { status: 409 },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("sync failed", error);
    return Response.json({ error: "同步失败，请稍后重试" }, { status: 500 });
  } finally {
    client.release();
  }
}

async function updateRevision(client: PoolClient, userId: string, revision: number, syncedAt: Date) {
  await client.query(
    `UPDATE time_sync_state SET revision = $2, updated_at = $3 WHERE user_id = $1`,
    [userId, revision, syncedAt],
  );
}

async function writeData(client: PoolClient, userId: string, data: TimeAccountingData, now: Date) {
  await client.query(`UPDATE time_categories SET deleted_at = $2 WHERE user_id = $1`, [userId, now]);
  await client.query(`UPDATE time_tasks SET deleted_at = $2 WHERE user_id = $1`, [userId, now]);
  await client.query(`UPDATE time_entries SET deleted_at = $2 WHERE user_id = $1`, [userId, now]);

  for (const category of data.categories) {
    await client.query(
      `INSERT INTO time_categories
       (user_id, id, name, color, is_primary_work, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (user_id, id) DO UPDATE SET
       name = EXCLUDED.name, color = EXCLUDED.color,
       is_primary_work = EXCLUDED.is_primary_work, updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
      [userId, category.id, category.name, category.color, category.isPrimaryWork, now],
    );
  }
  for (const task of data.tasks) {
    await client.query(
      `INSERT INTO time_tasks
       (user_id, id, name, category_id, created_at, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, NULL)
       ON CONFLICT (user_id, id) DO UPDATE SET
       name = EXCLUDED.name, category_id = EXCLUDED.category_id,
       updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
      [userId, task.id, task.name, task.categoryId, task.createdAt, now],
    );
  }
  for (const entry of data.entries) {
    await client.query(
      `INSERT INTO time_entries
       (user_id, id, date, started_at, ended_at, duration_seconds, title,
        task_id, category_id, note, created_at, updated_at, deleted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL)
       ON CONFLICT (user_id, id) DO UPDATE SET
       date = EXCLUDED.date, started_at = EXCLUDED.started_at,
       ended_at = EXCLUDED.ended_at, duration_seconds = EXCLUDED.duration_seconds,
       title = EXCLUDED.title, task_id = EXCLUDED.task_id,
       category_id = EXCLUDED.category_id, note = EXCLUDED.note,
       updated_at = EXCLUDED.updated_at, deleted_at = NULL`,
      [
        userId, entry.id, entry.date, entry.startedAt, entry.endedAt,
        entry.durationSeconds, entry.title, entry.taskId, entry.categoryId,
        entry.note, entry.createdAt, entry.updatedAt,
      ],
    );
  }

  await client.query(`DELETE FROM time_active_timers WHERE user_id = $1`, [userId]);
  if (data.activeTimer) {
    const timer = data.activeTimer;
    await client.query(
      `INSERT INTO time_active_timers
       (user_id, task_id, title, category_id, note, started_at,
        running_since, accumulated_seconds, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        userId, timer.taskId, timer.title, timer.categoryId, timer.note,
        timer.startedAt, timer.runningSince, timer.accumulatedSeconds, now,
      ],
    );
  }
}

async function readData(client: PoolClient, userId: string, updatedAt: Date): Promise<TimeAccountingData> {
  const categoryRows = await client.query<{
    id: string; name: string; color: string; is_primary_work: boolean;
  }>(`SELECT id, name, color, is_primary_work FROM time_categories WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [userId]);
  const taskRows = await client.query<{
    id: string; name: string; category_id: string; created_at: Date;
  }>(`SELECT id, name, category_id, created_at FROM time_tasks WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at`, [userId]);
  const entryRows = await client.query<{
    id: string; date: string; started_at: Date | null; ended_at: Date | null;
    duration_seconds: number; title: string; task_id: string | null;
    category_id: string; note: string; created_at: Date; updated_at: Date;
  }>(`SELECT id, date::text, started_at, ended_at, duration_seconds, title,
      task_id, category_id, note, created_at, updated_at
      FROM time_entries WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`, [userId]);
  const timerRows = await client.query<{
    task_id: string; title: string; category_id: string; note: string;
    started_at: Date; running_since: Date | null; accumulated_seconds: number;
  }>(`SELECT task_id, title, category_id, note, started_at, running_since, accumulated_seconds
      FROM time_active_timers WHERE user_id = $1`, [userId]);

  const categories: Category[] = categoryRows.rows.map((row) => ({
    id: row.id, name: row.name, color: row.color, isPrimaryWork: row.is_primary_work,
  }));
  const tasks: Task[] = taskRows.rows.map((row) => ({
    id: row.id, name: row.name, categoryId: row.category_id, createdAt: row.created_at.toISOString(),
  }));
  const entries: TimeEntry[] = entryRows.rows.map((row) => ({
    id: row.id,
    date: row.date,
    startedAt: row.started_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null,
    durationSeconds: row.duration_seconds,
    title: row.title,
    taskId: row.task_id,
    categoryId: row.category_id,
    note: row.note,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }));
  const timerRow = timerRows.rows[0];
  const activeTimer: ActiveTimer | null = timerRow
    ? {
        taskId: timerRow.task_id,
        title: timerRow.title,
        categoryId: timerRow.category_id,
        note: timerRow.note,
        startedAt: timerRow.started_at.toISOString(),
        runningSince: timerRow.running_since?.toISOString() ?? null,
        accumulatedSeconds: timerRow.accumulated_seconds,
      }
    : null;
  return { version: 2, categories, tasks, entries, activeTimer, updatedAt: updatedAt.toISOString() };
}

function validData(data: TimeAccountingData) {
  if (data.categories.length > 100 || data.tasks.length > 2_000 || data.entries.length > 20_000) return false;
  const shortText = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
  return (
    data.categories.every((item) => shortText(item.id, 128) && shortText(item.name, 200) && shortText(item.color, 32)) &&
    data.tasks.every((item) => shortText(item.id, 128) && shortText(item.name, 200) && shortText(item.categoryId, 128)) &&
    data.entries.every((item) =>
      shortText(item.id, 128) && shortText(item.title, 200) && shortText(item.note, 2_000) &&
      shortText(item.categoryId, 128) && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      Number.isInteger(item.durationSeconds) && item.durationSeconds >= 0,
    )
  );
}

function noStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}
