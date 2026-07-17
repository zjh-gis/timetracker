"use client";

import { useMemo, useState } from "react";
import {
  buildMonthGrid,
  dayTotalsInMonth,
  monthLabel,
  shiftMonthKey,
  sumDuration,
} from "@/lib/stats";
import { formatClock, formatDuration, localDateKey } from "@/lib/time";
import type { Category, TimeEntry } from "@/lib/types";
import { EntryList } from "./EntryList";

type CalendarViewProps = {
  entries: TimeEntry[];
  categories: Category[];
  onDeleteEntry: (id: string) => void;
};

export function CalendarView({ entries, categories, onDeleteEntry }: CalendarViewProps) {
  const today = localDateKey();
  const [monthAnchor, setMonthAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);

  const dayMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof dayTotalsInMonth>[number]>();
    for (const day of dayTotalsInMonth(entries, categories, monthAnchor)) {
      map.set(day.date, day);
    }
    return map;
  }, [entries, categories, monthAnchor]);

  const grid = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const selectedEntries = useMemo(
    () =>
      entries
        .filter((entry) => entryOverlapsDate(entry, selectedDate))
        .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")),
    [entries, selectedDate],
  );
  const selectedTotal = sumDuration(selectedEntries);
  const monthTotal = useMemo(
    () => sumDuration(entries.filter((entry) => entry.date.slice(0, 7) === monthAnchor.slice(0, 7))),
    [entries, monthAnchor],
  );

  function goMonth(delta: number) {
    const next = shiftMonthKey(monthAnchor, delta);
    setMonthAnchor(next);
    const nextMonth = next.slice(0, 7);
    if (selectedDate.slice(0, 7) !== nextMonth) {
      setSelectedDate(today.slice(0, 7) === nextMonth ? today : `${nextMonth}-01`);
    }
  }

  return (
    <section className="panel-card calendar-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">CALENDAR</p>
          <h2>日历</h2>
        </div>
        <span className="date-label">本月 {formatDuration(monthTotal)}</span>
      </div>

      <div className="period-nav">
        <button className="nav-chip" onClick={() => goMonth(-1)} aria-label="上一月">
          ‹
        </button>
        <strong>{monthLabel(monthAnchor)}</strong>
        <button className="nav-chip" onClick={() => goMonth(1)} aria-label="下一月">
          ›
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden>
        {["一", "二", "三", "四", "五", "六", "日"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="calendar-grid" role="grid" aria-label={monthLabel(monthAnchor)}>
        {grid.map((cell, index) => {
          if (!cell.date) {
            return <div key={`empty-${index}`} className="calendar-cell empty" />;
          }
          const day = dayMap.get(cell.date);
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          const hasEntries = Boolean(day && day.seconds > 0);
          return (
            <button
              key={cell.date}
              type="button"
              className={`calendar-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${hasEntries ? "has-entries" : ""}`}
              onClick={() => setSelectedDate(cell.date!)}
              aria-pressed={isSelected}
              aria-label={`${cell.date}${hasEntries ? `，${formatDuration(day!.seconds)}` : ""}`}
            >
              <span className="day-number">{Number(cell.date.slice(8))}</span>
              {hasEntries ? (
                <>
                  <div className="day-bars" aria-hidden>
                    {day!.slices.slice(0, 4).map((slice) => (
                      <span
                        key={slice.id}
                        style={{
                          flexGrow: Math.max(slice.seconds, 1),
                          backgroundColor: slice.color,
                        }}
                      />
                    ))}
                  </div>
                  <time className="day-duration">{formatCompact(day!.seconds)}</time>
                </>
              ) : (
                <span className="day-placeholder" />
              )}
            </button>
          );
        })}
      </div>

      <div className="calendar-day-detail">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">DAY</p>
            <h2>{selectedDate}</h2>
          </div>
          <span className="date-label">{formatDuration(selectedTotal)}</span>
        </div>
        <DayTimeline entries={selectedEntries} categories={categories} date={selectedDate} />
        <EntryList
          entries={selectedEntries}
          categories={categories}
          emptyTitle="这一天还没有记录"
          emptyHint="可以回到「今日」开始计时，或稍后再补录。"
          onDelete={onDeleteEntry}
        />
      </div>
    </section>
  );
}

type DayTimelineProps = {
  entries: TimeEntry[];
  categories: Category[];
  date: string;
};

function DayTimeline({ entries, categories, date }: DayTimelineProps) {
  const { start, end } = dayBounds(date);
  const dayLength = end.getTime() - start.getTime();
  const blocks = entries.flatMap((entry) => {
    if (!entry.startedAt || !entry.endedAt) return [];
    const entryStart = new Date(entry.startedAt);
    const entryEnd = new Date(entry.endedAt);
    if (
      Number.isNaN(entryStart.getTime()) ||
      Number.isNaN(entryEnd.getTime()) ||
      entryEnd <= start ||
      entryStart >= end
    ) {
      return [];
    }
    const clippedStart = new Date(Math.max(entryStart.getTime(), start.getTime()));
    const clippedEnd = new Date(Math.min(entryEnd.getTime(), end.getTime()));
    return [{ entry, clippedStart, clippedEnd }];
  });
  const positionedBlocks = layoutTimelineBlocks(blocks);

  return (
    <div className="day-timeline-section">
      <div className="timeline-heading">
        <strong>全天时间轴</strong>
        <span>00:00–24:00</span>
      </div>
      <div className="day-timeline" aria-label={`${date} 的 0 点至 24 点任务时间轴`}>
        <div className="timeline-hours" aria-hidden>
          {Array.from({ length: 25 }, (_, hour) => (
            <span key={hour} style={{ top: `${(hour / 24) * 100}%` }}>
              {String(hour).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        <div className="timeline-track">
          {Array.from({ length: 25 }, (_, hour) => (
            <span
              key={hour}
              className="timeline-grid-line"
              style={{ top: `${(hour / 24) * 100}%` }}
              aria-hidden
            />
          ))}
          {positionedBlocks.map(({ entry, clippedStart, clippedEnd, lane, laneCount }) => {
            const category = categories.find((item) => item.id === entry.categoryId);
            const top = ((clippedStart.getTime() - start.getTime()) / dayLength) * 100;
            const height = ((clippedEnd.getTime() - clippedStart.getTime()) / dayLength) * 100;
            const laneWidth = 100 / laneCount;
            const timeRange = `${formatClock(entry.startedAt)}–${formatClock(entry.endedAt)}`;
            return (
              <div
                key={entry.id}
                className="timeline-task"
                style={{
                  top: `${top}%`,
                  height: `${height}%`,
                  "--timeline-color": category?.color ?? "#657069",
                  "--lane-left": `${lane * laneWidth}%`,
                  "--lane-width": `${laneWidth}%`,
                } as React.CSSProperties}
                title={`${entry.title} · ${timeRange}`}
              >
                <strong>{entry.title}</strong>
                <span>{timeRange}</span>
              </div>
            );
          })}
          {blocks.length === 0 && (
            <p className="timeline-empty">当天还没有带起止时间的任务</p>
          )}
        </div>
      </div>
    </div>
  );
}

type TimelineBlock = {
  entry: TimeEntry;
  clippedStart: Date;
  clippedEnd: Date;
};

type PositionedTimelineBlock = TimelineBlock & {
  lane: number;
  laneCount: number;
};

function layoutTimelineBlocks(blocks: TimelineBlock[]): PositionedTimelineBlock[] {
  // The timeline keeps short tasks tall enough for their names to remain readable.
  // Use the same effective span for collision detection so those visual boxes
  // are placed in separate lanes instead of covering the following task.
  const minimumVisualDuration = 40 * 60 * 1000;
  const sorted = [...blocks].sort(
    (a, b) =>
      a.clippedStart.getTime() - b.clippedStart.getTime() ||
      a.clippedEnd.getTime() - b.clippedEnd.getTime(),
  );
  const positioned: PositionedTimelineBlock[] = [];
  let group: Array<TimelineBlock & { lane: number }> = [];
  let laneEnds: number[] = [];
  let groupEnd = -Infinity;

  function finishGroup() {
    const laneCount = Math.max(laneEnds.length, 1);
    positioned.push(...group.map((block) => ({ ...block, laneCount })));
    group = [];
    laneEnds = [];
    groupEnd = -Infinity;
  }

  for (const block of sorted) {
    const start = block.clippedStart.getTime();
    const end = block.clippedEnd.getTime();
    const visualEnd = Math.max(end, start + minimumVisualDuration);
    if (group.length > 0 && start >= groupEnd) finishGroup();

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(visualEnd);
    } else {
      laneEnds[lane] = visualEnd;
    }
    group.push({ ...block, lane });
    groupEnd = Math.max(groupEnd, visualEnd);
  }
  if (group.length > 0) finishGroup();
  return positioned;
}

function dayBounds(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { start, end };
}

function entryOverlapsDate(entry: TimeEntry, date: string) {
  if (!entry.startedAt || !entry.endedAt) return entry.date === date;
  const { start, end } = dayBounds(date);
  const entryStart = new Date(entry.startedAt);
  const entryEnd = new Date(entry.endedAt);
  if (Number.isNaN(entryStart.getTime()) || Number.isNaN(entryEnd.getTime())) {
    return entry.date === date;
  }
  return entryStart < end && entryEnd > start;
}

function formatCompact(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h${minutes ? `${minutes}m` : ""}`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}
