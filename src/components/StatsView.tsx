"use client";

import { useMemo, useState } from "react";
import {
  aggregateByCategory,
  aggregateByTask,
  dailyBarsForPeriod,
  entriesInPeriod,
  monthLabel,
  shiftDateKey,
  shiftMonthKey,
  shiftYearKey,
  sumDuration,
  yearLabel,
  type AggregateSlice,
  type StatsPeriod,
} from "@/lib/stats";
import { formatDuration, localDateKey } from "@/lib/time";
import type { Category, Task, TimeEntry } from "@/lib/types";

type StatsViewProps = {
  entries: TimeEntry[];
  categories: Category[];
  tasks: Task[];
  primaryCategoryIds: Set<string>;
};

type GroupBy = "category" | "task";

export function StatsView({ entries, categories, tasks, primaryCategoryIds }: StatsViewProps) {
  const today = localDateKey();
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [anchorDate, setAnchorDate] = useState(today);
  const [groupBy, setGroupBy] = useState<GroupBy>("category");

  const periodEntries = useMemo(
    () => entriesInPeriod(entries, period, anchorDate),
    [entries, period, anchorDate],
  );
  const total = sumDuration(periodEntries);
  const primaryTotal = periodEntries.reduce(
    (sum, entry) => sum + (primaryCategoryIds.has(entry.categoryId) ? entry.durationSeconds : 0),
    0,
  );
  const slices = useMemo(
    () =>
      groupBy === "category"
        ? aggregateByCategory(periodEntries, categories)
        : aggregateByTask(periodEntries, tasks, categories),
    [groupBy, periodEntries, categories, tasks],
  );
  const bars = useMemo(
    () => dailyBarsForPeriod(entries, period, anchorDate),
    [entries, period, anchorDate],
  );
  const maxBar = Math.max(1, ...bars.map((bar) => bar.seconds));

  function shiftAnchor(delta: number) {
    if (period === "day") setAnchorDate(shiftDateKey(anchorDate, delta));
    else if (period === "month") setAnchorDate(shiftMonthKey(anchorDate, delta));
    else setAnchorDate(shiftYearKey(anchorDate, delta));
  }

  const periodTitle =
    period === "day" ? anchorDate : period === "month" ? monthLabel(anchorDate) : yearLabel(anchorDate);

  return (
    <section className="panel-card stats-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">REPORTS</p>
          <h2>统计</h2>
        </div>
      </div>

      <div className="segmented" role="tablist" aria-label="统计周期">
        {(
          [
            ["day", "日"],
            ["month", "月"],
            ["year", "年"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={period === value}
            className={period === value ? "active" : ""}
            onClick={() => {
              setPeriod(value);
              setAnchorDate(today);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="period-nav">
        <button className="nav-chip" onClick={() => shiftAnchor(-1)} aria-label="上一段">
          ‹
        </button>
        <strong>{periodTitle}</strong>
        <button className="nav-chip" onClick={() => shiftAnchor(1)} aria-label="下一段">
          ›
        </button>
      </div>

      <div className="summary-grid stats-summary">
        <article className="summary-card featured">
          <span>总投入</span>
          <strong>{formatDuration(total)}</strong>
          <small>{periodEntries.length} 条记录</small>
        </article>
        <article className="summary-card">
          <span>主要工作</span>
          <strong>{formatDuration(primaryTotal)}</strong>
          <small>{total ? Math.round((primaryTotal / total) * 100) : 0}% 占比</small>
        </article>
      </div>

      <div className="stats-block">
        <div className="stats-block-heading">
          <h3>时间构成</h3>
          <div className="segmented compact" role="tablist" aria-label="汇总方式">
            <button
              type="button"
              className={groupBy === "category" ? "active" : ""}
              onClick={() => setGroupBy("category")}
            >
              分类
            </button>
            <button
              type="button"
              className={groupBy === "task" ? "active" : ""}
              onClick={() => setGroupBy("task")}
            >
              事项
            </button>
          </div>
        </div>

        {slices.length === 0 ? (
          <div className="empty-state">
            <strong>这段时间还没有记录</strong>
            <p>开始计时后，这里会显示饼图与明细。</p>
          </div>
        ) : (
          <div className="pie-layout">
            <PieChart slices={slices} total={total} />
            <ul className="slice-legend">
              {slices.map((slice) => (
                <li key={slice.id}>
                  <span className="category-dot" style={{ backgroundColor: slice.color }} />
                  <div className="record-main">
                    <strong>{slice.name}</strong>
                    <span>{total ? Math.round((slice.seconds / total) * 100) : 0}%</span>
                  </div>
                  <span className="record-duration">{formatDuration(slice.seconds)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="stats-block">
        <div className="stats-block-heading">
          <h3>{period === "year" ? "每月投入" : period === "month" ? "每日投入" : "当日投入"}</h3>
        </div>
        <div className={`bar-chart ${period === "month" ? "dense" : ""}`} role="img" aria-label="投入柱状图">
          {bars.map((bar) => (
            <div key={bar.date} className="bar-column" title={`${bar.date} ${formatDuration(bar.seconds)}`}>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ height: `${Math.max(bar.seconds ? 8 : 0, (bar.seconds / maxBar) * 100)}%` }}
                />
              </div>
              <span>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PieChart({ slices, total }: { slices: AggregateSlice[]; total: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="pie-wrap">
      <svg viewBox="0 0 140 140" className="pie-svg" aria-hidden>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#e7e5dc" strokeWidth="22" />
        {slices.map((slice, index) => {
          const length = total ? (slice.seconds / total) * circumference : 0;
          const dash = `${length} ${circumference - length}`;
          const current = total
            ? slices.slice(0, index).reduce((sum, item) => sum + item.seconds, 0) / total * circumference
            : 0;
          return (
            <circle
              key={slice.id}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="22"
              strokeDasharray={dash}
              strokeDashoffset={-current}
              transform="rotate(-90 70 70)"
            />
          );
        })}
      </svg>
      <div className="pie-center">
        <small>合计</small>
        <strong>{formatDuration(total)}</strong>
      </div>
    </div>
  );
}
