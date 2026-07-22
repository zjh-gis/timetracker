"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { defaultData, loadData, normalizeData, saveData } from "@/lib/storage";
import { activeSeconds, formatDuration, localDateKey } from "@/lib/time";
import type { ActiveTimer, Category, Task, TimeAccountingData, TimeEntry } from "@/lib/types";
import { CalendarView } from "./CalendarView";
import { EntryList } from "./EntryList";
import { StatsView } from "./StatsView";
import { SyncPanel } from "./SyncPanel";
import { AccountPanel } from "./AccountPanel";
import { AccountStatus } from "./AccountStatus";

type AppTab = "today" | "calendar" | "stats";

function entryFromTimer(timer: ActiveTimer, endedAt: string): TimeEntry {
  return {
    id: crypto.randomUUID(),
    date: localDateKey(new Date(timer.startedAt)),
    startedAt: timer.startedAt,
    endedAt,
    durationSeconds: activeSeconds(timer),
    title: timer.title,
    taskId: timer.taskId,
    categoryId: timer.categoryId,
    note: timer.note,
    createdAt: endedAt,
    updatedAt: endedAt,
  };
}

function timerForTask(task: Task, startedAt: string): ActiveTimer {
  return {
    taskId: task.id,
    title: task.name,
    categoryId: task.categoryId,
    note: "",
    startedAt,
    runningSince: startedAt,
    accumulatedSeconds: 0,
  };
}

type TimeAccountingAppProps = { userId: string; userName: string; userEmail: string };

export function TimeAccountingApp({ userId, userName, userEmail }: TimeAccountingAppProps) {
  const [data, setData] = useState<TimeAccountingData>(defaultData);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<AppTab>("today");
  const [newTaskName, setNewTaskName] = useState("");
  const [categoryId, setCategoryId] = useState("work");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6b5aa6");
  const [newCategoryIsPrimary, setNewCategoryIsPrimary] = useState(false);
  const [now, setNow] = useState(0);
  const [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hydrationTask = window.setTimeout(() => {
      const stored = loadData(userId);
      setData(stored);
      setCategoryId(stored.categories[0]?.id ?? "work");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(hydrationTask);
  }, [userId]);

  useEffect(() => {
    if (ready) saveData(data, userId);
  }, [data, ready, userId]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const today = localDateKey();
  const todayEntries = useMemo(
    () =>
      data.entries
        .filter((entry) => entry.date === today)
        .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")),
    [data.entries, today],
  );
  const totalToday = todayEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0);
  const primaryIds = useMemo(
    () =>
      new Set(data.categories.filter((category) => category.isPrimaryWork).map((category) => category.id)),
    [data.categories],
  );
  const primaryToday = todayEntries.reduce(
    (sum, entry) => sum + (primaryIds.has(entry.categoryId) ? entry.durationSeconds : 0),
    0,
  );
  const elapsed = data.activeTimer ? activeSeconds(data.activeTimer, now) : 0;
  const taskTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const entry of todayEntries) {
      if (entry.taskId) totals.set(entry.taskId, (totals.get(entry.taskId) ?? 0) + entry.durationSeconds);
    }
    return totals;
  }, [todayEntries]);

  function update(mutator: (current: TimeAccountingData) => TimeAccountingData) {
    setData((current) => ({ ...mutator(current), updatedAt: new Date().toISOString() }));
  }

  function createTask() {
    const name = newTaskName.trim();
    if (!name) {
      setNotice("先写下任务名称。");
      return;
    }
    if (data.tasks.some((task) => task.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setNotice("已经有同名任务，可以直接点击开始。");
      return;
    }
    const timestamp = new Date().toISOString();
    const task: Task = { id: crypto.randomUUID(), name, categoryId, createdAt: timestamp };
    update((current) => ({ ...current, tasks: [...current.tasks, task] }));
    setNewTaskName("");
    setShowTaskForm(false);
    setNotice(`已创建“${name}”，点击它即可开始。`);
  }

  function createCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setNotice("先填写分类名称。");
      return;
    }
    if (data.categories.some((category) => category.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setNotice("已经有同名分类，可以直接选择。");
      return;
    }
    const category: Category = {
      id: crypto.randomUUID(),
      name,
      color: newCategoryColor,
      isPrimaryWork: newCategoryIsPrimary,
    };
    update((current) => ({ ...current, categories: [...current.categories, category] }));
    setCategoryId(category.id);
    setNewCategoryName("");
    setNewCategoryColor("#6b5aa6");
    setNewCategoryIsPrimary(false);
    setShowCategoryForm(false);
    setNotice(`已添加分类“${name}”。`);
  }

  function clickTask(task: Task) {
    const timestamp = new Date().toISOString();
    const currentTimer = data.activeTimer;
    if (!currentTimer) {
      update((current) => ({ ...current, activeTimer: timerForTask(task, timestamp) }));
      setNotice(`开始：${task.name}`);
      return;
    }

    const completedEntry = entryFromTimer(currentTimer, timestamp);
    if (completedEntry.durationSeconds < 1) {
      setNotice("不足 1 秒，继续计时后再停止。");
      return;
    }

    if (currentTimer.taskId === task.id) {
      update((current) => ({
        ...current,
        activeTimer: null,
        entries: [completedEntry, ...current.entries],
      }));
      setNotice(`已停止：${task.name}`);
      return;
    }

    update((current) => ({
      ...current,
      activeTimer: timerForTask(task, timestamp),
      entries: [completedEntry, ...current.entries],
    }));
    setNotice(`已切换到：${task.name}`);
  }

  function pauseTimer() {
    if (!data.activeTimer?.runningSince) return;
    const seconds = activeSeconds(data.activeTimer);
    update((current) => ({
      ...current,
      activeTimer: current.activeTimer
        ? { ...current.activeTimer, accumulatedSeconds: seconds, runningSince: null }
        : null,
    }));
    setNotice("已暂停；点击继续或点击当前任务结束。");
  }

  function resumeTimer() {
    if (!data.activeTimer || data.activeTimer.runningSince) return;
    update((current) => ({
      ...current,
      activeTimer: current.activeTimer
        ? { ...current.activeTimer, runningSince: new Date().toISOString() }
        : null,
    }));
    setNotice("继续计时。");
  }

  function deleteTask(task: Task) {
    if (data.activeTimer?.taskId === task.id) {
      setNotice("请先停止正在运行的任务。");
      return;
    }
    if (!window.confirm(`删除任务“${task.name}”？历史记录会继续保留。`)) return;
    update((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) }));
    setNotice("任务已删除，历史记录未受影响。");
  }

  function deleteEntry(id: string) {
    if (!window.confirm("删除这条时间记录？")) return;
    update((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }));
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `time-accounting-${today}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("JSON 备份已导出。");
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const candidate = normalizeData(JSON.parse(await file.text()));
      if (!candidate) throw new Error("unsupported");
      if (!window.confirm("导入将替换当前浏览器中的全部记录，继续吗？")) return;
      setData(candidate);
      setNotice("备份恢复成功。");
    } catch {
      setNotice("无法导入：文件不是受支持的版本。");
    }
  }

  if (!ready) return <main className="loading">正在读取本地记录…</main>;

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">PERSONAL TIME LEDGER</p>
          <h1>时迹</h1>
          <p className="subtitle">点一下开始，再点一下结束。</p>
        </div>
        <AccountStatus userId={userId} name={userName} email={userEmail} />
      </header>

      {data.activeTimer && (
        <section className="active-strip">
          <div>
            <span className={`pulse ${data.activeTimer.runningSince ? "" : "paused"}`} />
            <div>
              <small>{data.activeTimer.runningSince ? "正在进行" : "已经暂停"}</small>
              <strong>{data.activeTimer.title}</strong>
            </div>
          </div>
          <time>{formatDuration(elapsed)}</time>
          {data.activeTimer.runningSince ? (
            <button onClick={pauseTimer}>暂停</button>
          ) : (
            <button onClick={resumeTimer}>继续</button>
          )}
        </section>
      )}

      {tab === "today" && (
        <>
          <section className="summary-grid" aria-label="今日概览">
            <article className="summary-card featured">
              <span>今日投入</span>
              <strong>{formatDuration(totalToday)}</strong>
              <small>{todayEntries.length} 条记录</small>
            </article>
            <article className="summary-card">
              <span>主要工作</span>
              <strong>{formatDuration(primaryToday)}</strong>
              <small>{totalToday ? Math.round((primaryToday / totalToday) * 100) : 0}% 的今日投入</small>
            </article>
          </section>

          <section className="tasks-card">
            <div className="section-heading task-heading">
              <div>
                <p className="eyebrow">TASKS</p>
                <h2>我的任务</h2>
              </div>
              <button className="add-task-button" onClick={() => setShowTaskForm((visible) => !visible)}>
                ＋ 新任务
              </button>
            </div>

            {showTaskForm && (
              <div className="task-form">
                <label className="field">
                  <span>具体任务</span>
                  <input
                    value={newTaskName}
                    onChange={(event) => setNewTaskName(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && createTask()}
                    placeholder="例如：开发计时工具"
                    autoFocus
                  />
                </label>
                <label className="field">
                  <span>归属分类</span>
                  <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                    {data.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="category-toggle"
                  type="button"
                  onClick={() => setShowCategoryForm((visible) => !visible)}
                >
                  {showCategoryForm ? "收起分类设置" : "＋ 添加自定义分类"}
                </button>
                {showCategoryForm && (
                  <div className="category-form">
                    <label className="field">
                      <span>分类名称</span>
                      <input
                        value={newCategoryName}
                        onChange={(event) => setNewCategoryName(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && createCategory()}
                        placeholder="例如：健身"
                        maxLength={200}
                      />
                    </label>
                    <label className="color-field">
                      <span>识别颜色</span>
                      <input
                        type="color"
                        value={newCategoryColor}
                        onChange={(event) => setNewCategoryColor(event.target.value)}
                      />
                    </label>
                    <label className="primary-check">
                      <input
                        type="checkbox"
                        checked={newCategoryIsPrimary}
                        onChange={(event) => setNewCategoryIsPrimary(event.target.checked)}
                      />
                      <span>计入“主要工作”统计</span>
                    </label>
                    <button className="button secondary" type="button" onClick={createCategory}>
                      添加并选中
                    </button>
                  </div>
                )}
                <div className="form-actions">
                  <button className="button secondary" onClick={() => setShowTaskForm(false)}>
                    取消
                  </button>
                  <button className="button primary" onClick={createTask}>
                    创建任务
                  </button>
                </div>
              </div>
            )}

            {data.tasks.length === 0 ? (
              <button className="empty-task" onClick={() => setShowTaskForm(true)}>
                <strong>创建第一个任务</strong>
                <span>任务没有数量限制，名称可以写得具体。</span>
              </button>
            ) : (
              <div className="task-grid">
                {data.tasks.map((task) => {
                  const category = data.categories.find((item) => item.id === task.categoryId);
                  const active = data.activeTimer?.taskId === task.id;
                  const total = (taskTotals.get(task.id) ?? 0) + (active ? elapsed : 0);
                  return (
                    <article
                      key={task.id}
                      className={`task-tile ${active ? "active" : ""}`}
                      style={{ "--task-color": category?.color } as React.CSSProperties}
                    >
                      <button className="task-start" onClick={() => clickTask(task)}>
                        <span className="task-symbol">{active ? "■" : "▶"}</span>
                        <strong>{task.name}</strong>
                        <small>{active ? "点击结束" : category?.name}</small>
                        <time>{formatDuration(total)}</time>
                      </button>
                      <button
                        className="task-delete"
                        onClick={() => deleteTask(task)}
                        aria-label={`删除任务${task.name}`}
                      >
                        ×
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
            {notice && (
              <p className="notice" role="status">
                {notice}
              </p>
            )}
          </section>

          <section className="records-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TODAY</p>
                <h2>今日记录</h2>
              </div>
              <span className="date-label">{today}</span>
            </div>
            <EntryList
              entries={todayEntries}
              categories={data.categories}
              emptyTitle="今天还没有记录"
              emptyHint="点击上方任一任务开始计时。"
              onDelete={deleteEntry}
            />
          </section>

          <section className="backup-card">
            <div>
              <p className="eyebrow">YOUR DATA</p>
              <h2>本地数据与备份</h2>
              <p>清理浏览器数据会丢失记录。建议定期导出一份 JSON。</p>
            </div>
            <div className="backup-actions">
              <button className="text-button" onClick={exportData}>
                导出备份
              </button>
              <button className="text-button" onClick={() => importRef.current?.click()}>
                恢复备份
              </button>
              <input ref={importRef} type="file" accept="application/json" hidden onChange={importData} />
            </div>
          </section>
        </>
      )}

      {tab === "calendar" && (
        <CalendarView entries={data.entries} categories={data.categories} onDeleteEntry={deleteEntry} />
      )}

      {tab === "stats" && (
        <StatsView
          entries={data.entries}
          categories={data.categories}
          tasks={data.tasks}
          primaryCategoryIds={primaryIds}
        />
      )}

      <SyncPanel
        userId={userId}
        data={data}
        hidden={tab !== "today"}
        onApplyData={(syncedData) => {
          setData(syncedData);
          setCategoryId(syncedData.categories[0]?.id ?? "work");
        }}
      />

      {tab === "today" && <AccountPanel userId={userId} email={userEmail} />}

      <nav className="tab-bar" aria-label="主导航">
        {(
          [
            ["today", "今日"],
            ["calendar", "日历"],
            ["stats", "统计"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
            aria-current={tab === value ? "page" : undefined}
          >
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
}
