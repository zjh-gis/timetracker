import type { PoolConnection, RowDataPacket } from "mysql2/promise";
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

type SyncStateRow = RowDataPacket & { revision: number | string; updated_at: Date };
type CategoryRow = RowDataPacket & {
  id: string; name: string; color: string; is_primary_work: number;
};
type TaskRow = RowDataPacket & {
  id: string; name: string; category_id: string; created_at: Date;
};
type EntryRow = RowDataPacket & {
  id: string; date: string; started_at: Date | null; ended_at: Date | null;
  duration_seconds: number; title: string; task_id: string | null;
  category_id: string; note: string; created_at: Date; updated_at: Date;
};
type TimerRow = RowDataPacket & {
  task_id: string; title: string; category_id: string; note: string;
  started_at: Date; running_since: Date | null; accumulated_seconds: number;
};

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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT IGNORE INTO time_sync_state (user_id, revision) VALUES (?, 0)`,
      [session.user.id],
    );
    const [stateRows] = await connection.execute<SyncStateRow[]>(
      `SELECT revision, updated_at FROM time_sync_state WHERE user_id = ? FOR UPDATE`,
      [session.user.id],
    );
    const state = stateRows[0];
    if (!state) throw new Error("sync state missing after insert");
    const currentRevision = Number(state.revision);

    if (currentRevision === 0) {
      const syncedAt = new Date();
      await writeData(connection, session.user.id, data, syncedAt);
      await updateRevision(connection, session.user.id, 1, syncedAt);
      await connection.commit();
      return noStore({ ok: true, revision: 1, data, syncedAt: syncedAt.toISOString() });
    }

    if (!body.hasLocalChanges) {
      const remote = await readData(connection, session.user.id, state.updated_at);
      await connection.commit();
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
      await writeData(connection, session.user.id, data, syncedAt);
      await updateRevision(connection, session.user.id, nextRevision, syncedAt);
      await connection.commit();
      return noStore({ ok: true, revision: nextRevision, data, syncedAt: syncedAt.toISOString() });
    }

    const remote = await readData(connection, session.user.id, state.updated_at);
    await connection.commit();
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
    await connection.rollback();
    console.error("sync failed", error);
    return Response.json({ error: "同步失败，请稍后重试" }, { status: 500 });
  } finally {
    connection.release();
  }
}

async function updateRevision(
  connection: PoolConnection,
  userId: string,
  revision: number,
  syncedAt: Date,
) {
  await connection.execute(
    `UPDATE time_sync_state SET revision = ?, updated_at = ? WHERE user_id = ?`,
    [revision, syncedAt, userId],
  );
}

async function writeData(
  connection: PoolConnection,
  userId: string,
  data: TimeAccountingData,
  now: Date,
) {
  await connection.execute(`UPDATE time_categories SET deleted_at = ? WHERE user_id = ?`, [now, userId]);
  await connection.execute(`UPDATE time_tasks SET deleted_at = ? WHERE user_id = ?`, [now, userId]);
  await connection.execute(`UPDATE time_entries SET deleted_at = ? WHERE user_id = ?`, [now, userId]);

  for (const category of data.categories) {
    await connection.execute(
      `INSERT INTO time_categories
       (user_id, id, name, color, is_primary_work, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL) AS incoming
       ON DUPLICATE KEY UPDATE
       name = incoming.name, color = incoming.color,
       is_primary_work = incoming.is_primary_work,
       updated_at = incoming.updated_at, deleted_at = NULL`,
      [userId, category.id, category.name, category.color, category.isPrimaryWork, now],
    );
  }

  for (const task of data.tasks) {
    await connection.execute(
      `INSERT INTO time_tasks
       (user_id, id, name, category_id, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL) AS incoming
       ON DUPLICATE KEY UPDATE
       name = incoming.name, category_id = incoming.category_id,
       updated_at = incoming.updated_at, deleted_at = NULL`,
      [userId, task.id, task.name, task.categoryId, mysqlDate(task.createdAt), now],
    );
  }

  for (const entry of data.entries) {
    await connection.execute(
      `INSERT INTO time_entries
       (user_id, id, date, started_at, ended_at, duration_seconds, title,
        task_id, category_id, note, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) AS incoming
       ON DUPLICATE KEY UPDATE
       date = incoming.date, started_at = incoming.started_at,
       ended_at = incoming.ended_at, duration_seconds = incoming.duration_seconds,
       title = incoming.title, task_id = incoming.task_id,
       category_id = incoming.category_id, note = incoming.note,
       updated_at = incoming.updated_at, deleted_at = NULL`,
      [
        userId,
        entry.id,
        entry.date,
        mysqlDate(entry.startedAt),
        mysqlDate(entry.endedAt),
        entry.durationSeconds,
        entry.title,
        entry.taskId,
        entry.categoryId,
        entry.note,
        mysqlDate(entry.createdAt),
        mysqlDate(entry.updatedAt),
      ],
    );
  }

  await connection.execute(`DELETE FROM time_active_timers WHERE user_id = ?`, [userId]);
  if (data.activeTimer) {
    const timer = data.activeTimer;
    await connection.execute(
      `INSERT INTO time_active_timers
       (user_id, task_id, title, category_id, note, started_at,
        running_since, accumulated_seconds, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        timer.taskId,
        timer.title,
        timer.categoryId,
        timer.note,
        mysqlDate(timer.startedAt),
        mysqlDate(timer.runningSince),
        timer.accumulatedSeconds,
        now,
      ],
    );
  }
}

async function readData(
  connection: PoolConnection,
  userId: string,
  updatedAt: Date,
): Promise<TimeAccountingData> {
  const [categoryRows] = await connection.execute<CategoryRow[]>(
    `SELECT id, name, color, is_primary_work
     FROM time_categories WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at`,
    [userId],
  );
  const [taskRows] = await connection.execute<TaskRow[]>(
    `SELECT id, name, category_id, created_at
     FROM time_tasks WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at`,
    [userId],
  );
  const [entryRows] = await connection.execute<EntryRow[]>(
    `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date,
      started_at, ended_at, duration_seconds, title,
      task_id, category_id, note, created_at, updated_at
     FROM time_entries WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [userId],
  );
  const [timerRows] = await connection.execute<TimerRow[]>(
    `SELECT task_id, title, category_id, note, started_at, running_since, accumulated_seconds
     FROM time_active_timers WHERE user_id = ?`,
    [userId],
  );

  const categories: Category[] = categoryRows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    isPrimaryWork: Boolean(row.is_primary_work),
  }));
  const tasks: Task[] = taskRows.map((row) => ({
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    createdAt: row.created_at.toISOString(),
  }));
  const entries: TimeEntry[] = entryRows.map((row) => ({
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
  const timerRow = timerRows[0];
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

function mysqlDate(value: string | null) {
  if (value === null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("invalid date in sync data");
  return date;
}

function validData(data: TimeAccountingData) {
  if (data.categories.length > 100 || data.tasks.length > 2_000 || data.entries.length > 20_000) return false;
  const shortText = (value: unknown, max: number) => typeof value === "string" && value.length <= max;
  const optionalDate = (value: unknown) => value === null || (
    typeof value === "string" && Number.isFinite(Date.parse(value))
  );
  return (
    data.categories.every((item) => shortText(item.id, 128) && shortText(item.name, 200) && shortText(item.color, 32)) &&
    data.tasks.every((item) =>
      shortText(item.id, 128) && shortText(item.name, 200) && shortText(item.categoryId, 128) &&
      typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)),
    ) &&
    data.entries.every((item) =>
      shortText(item.id, 128) && shortText(item.title, 200) && shortText(item.note, 2_000) &&
      shortText(item.categoryId, 128) && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
      optionalDate(item.startedAt) && optionalDate(item.endedAt) &&
      typeof item.createdAt === "string" && Number.isFinite(Date.parse(item.createdAt)) &&
      typeof item.updatedAt === "string" && Number.isFinite(Date.parse(item.updatedAt)) &&
      Number.isInteger(item.durationSeconds) && item.durationSeconds >= 0,
    ) &&
    (!data.activeTimer || (
      shortText(data.activeTimer.taskId, 128) && shortText(data.activeTimer.title, 200) &&
      shortText(data.activeTimer.categoryId, 128) && shortText(data.activeTimer.note, 2_000) &&
      typeof data.activeTimer.startedAt === "string" && Number.isFinite(Date.parse(data.activeTimer.startedAt)) &&
      optionalDate(data.activeTimer.runningSince) && Number.isInteger(data.activeTimer.accumulatedSeconds) &&
      data.activeTimer.accumulatedSeconds >= 0
    ))
  );
}

function noStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}
