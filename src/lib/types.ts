export type Category = {
  id: string;
  name: string;
  color: string;
  isPrimaryWork: boolean;
};

export type Task = {
  id: string;
  name: string;
  categoryId: string;
  createdAt: string;
};

export type TimeEntry = {
  id: string;
  date: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  title: string;
  taskId: string | null;
  categoryId: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ActiveTimer = {
  taskId: string;
  title: string;
  categoryId: string;
  note: string;
  startedAt: string;
  runningSince: string | null;
  accumulatedSeconds: number;
};

export type TimeAccountingData = {
  version: 2;
  categories: Category[];
  tasks: Task[];
  entries: TimeEntry[];
  activeTimer: ActiveTimer | null;
  updatedAt: string;
};
