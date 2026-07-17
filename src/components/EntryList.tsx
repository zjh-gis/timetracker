import type { Category, TimeEntry } from "@/lib/types";
import { formatClock, formatDuration } from "@/lib/time";

type EntryListProps = {
  entries: TimeEntry[];
  categories: Category[];
  emptyTitle: string;
  emptyHint: string;
  onDelete?: (id: string) => void;
};

export function EntryList({
  entries,
  categories,
  emptyTitle,
  emptyHint,
  onDelete,
}: EntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <strong>{emptyTitle}</strong>
        <p>{emptyHint}</p>
      </div>
    );
  }

  return (
    <ul className="record-list">
      {entries.map((entry) => {
        const category = categories.find((item) => item.id === entry.categoryId);
        return (
          <li key={entry.id}>
            <span className="category-dot" style={{ backgroundColor: category?.color }} />
            <div className="record-main">
              <strong>{entry.title}</strong>
              <span>
                {formatClock(entry.startedAt)}–{formatClock(entry.endedAt)} · {category?.name}
              </span>
            </div>
            <span className="record-duration">{formatDuration(entry.durationSeconds)}</span>
            {onDelete ? (
              <button
                className="icon-button"
                onClick={() => onDelete(entry.id)}
                aria-label={`删除${entry.title}`}
              >
                ×
              </button>
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ul>
  );
}
