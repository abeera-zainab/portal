import type { Person, Task, TaskPriority, TaskStatus } from "../types";
import { TEAMS, isTaskOverdue, taskTeam, todayKey } from "../store";

export const TASK_STATUSES: TaskStatus[] = ["open", "in_progress", "done"];
export const TASK_PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

export const statusLabel = (status: TaskStatus) =>
  status === "in_progress" ? "In progress" : status === "done" ? "Done" : "Open";

export const priorityLabel = (priority: TaskPriority) => priority.charAt(0).toUpperCase() + priority.slice(1);

const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
const STATUS_RANK: Record<TaskStatus, number> = { open: 0, in_progress: 1, done: 2 };

/** Open and in-progress first, then nearest due date, then priority, then most recently updated. */
export const sortTasks = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    const doneA = a.status === "done" ? 1 : 0;
    const doneB = b.status === "done" ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    if (a.dueDate !== b.dueDate) {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    return b.updatedAt.localeCompare(a.updatedAt);
  });

export interface TaskSummary {
  total: number;
  open: number;
  inProgress: number;
  done: number;
  overdue: number;
  high: number;
  medium: number;
  low: number;
  doneThisWeek: number;
  doneThisMonth: number;
  completionRate: number;
  avgDaysToComplete: number | null;
}

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const weekday = copy.getDay();
  copy.setDate(copy.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return copy;
};

const startOfMonth = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(1);
  return copy;
};

export function summarizeTasks(tasks: Task[], now = new Date()): TaskSummary {
  const today = todayKey(now);
  const weekStart = startOfWeek(now).getTime();
  const monthStart = startOfMonth(now).getTime();
  const summary: TaskSummary = {
    total: tasks.length,
    open: 0,
    inProgress: 0,
    done: 0,
    overdue: 0,
    high: 0,
    medium: 0,
    low: 0,
    doneThisWeek: 0,
    doneThisMonth: 0,
    completionRate: 0,
    avgDaysToComplete: null,
  };
  let completionDays = 0;
  let completed = 0;
  for (const task of tasks) {
    if (task.status === "open") summary.open += 1;
    else if (task.status === "in_progress") summary.inProgress += 1;
    else summary.done += 1;
    summary[task.priority] += 1;
    if (isTaskOverdue(task, today)) summary.overdue += 1;
    if (task.status === "done" && task.completedAt) {
      const finished = new Date(task.completedAt).getTime();
      if (finished >= weekStart) summary.doneThisWeek += 1;
      if (finished >= monthStart) summary.doneThisMonth += 1;
      const started = new Date(task.createdAt).getTime();
      if (!Number.isNaN(finished) && !Number.isNaN(started)) {
        completionDays += Math.max(0, (finished - started) / 86_400_000);
        completed += 1;
      }
    }
  }
  summary.completionRate = tasks.length ? Math.round((summary.done / tasks.length) * 100) : 0;
  summary.avgDaysToComplete = completed ? Math.round((completionDays / completed) * 10) / 10 : null;
  return summary;
}

export interface TeamTaskRow {
  teamId: string;
  team: string;
  open: number;
  inProgress: number;
  done: number;
  overdue: number;
  total: number;
}

export function tasksByTeam(
  tasks: Task[],
  people: Person[],
  teams: { id: string; name: string }[] = TEAMS
): TeamTaskRow[] {
  const today = todayKey();
  return teams.map((item) => {
    const row: TeamTaskRow = {
      teamId: item.id,
      team: item.name,
      open: 0,
      inProgress: 0,
      done: 0,
      overdue: 0,
      total: 0,
    };
    for (const task of tasks) {
      const assignee = people.find((person) => person.userId === task.assigneeUserId);
      if (taskTeam(task, assignee) !== item.id) continue;
      row.total += 1;
      if (task.status === "open") row.open += 1;
      else if (task.status === "in_progress") row.inProgress += 1;
      else row.done += 1;
      if (isTaskOverdue(task, today)) row.overdue += 1;
    }
    return row;
  });
}

export interface PersonTaskRow {
  person: Person;
  assigned: number;
  open: number;
  inProgress: number;
  done: number;
  overdue: number;
  completionRate: number;
}

export function tasksByPerson(tasks: Task[], people: Person[]): PersonTaskRow[] {
  const today = todayKey();
  const rows: PersonTaskRow[] = [];
  for (const person of people) {
    const mine = tasks.filter((task) => task.assigneeUserId === person.userId);
    if (!mine.length) continue;
    const row: PersonTaskRow = { person, assigned: mine.length, open: 0, inProgress: 0, done: 0, overdue: 0, completionRate: 0 };
    for (const task of mine) {
      if (task.status === "open") row.open += 1;
      else if (task.status === "in_progress") row.inProgress += 1;
      else row.done += 1;
      if (isTaskOverdue(task, today)) row.overdue += 1;
    }
    row.completionRate = Math.round((row.done / mine.length) * 100);
    rows.push(row);
  }
  return rows.sort((a, b) => b.open + b.inProgress - (a.open + a.inProgress) || a.person.name.localeCompare(b.person.name));
}

export interface TaskTrendRow {
  day: string;
  created: number;
  completed: number;
  openAtEnd: number;
  [key: string]: string | number;
}

const noon = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
};

export function taskTrend(tasks: Task[], mode: "week" | "month", now = new Date()): TaskTrendRow[] {
  const today = noon(now);
  const start = mode === "week" ? startOfWeek(today) : startOfMonth(today);
  start.setHours(12, 0, 0, 0);
  const rows: TaskTrendRow[] = [];
  for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    const key = todayKey(cursor);
    const label = cursor.toLocaleDateString(undefined, mode === "week" ? { weekday: "short" } : { day: "numeric" });
    let created = 0;
    let completed = 0;
    let openAtEnd = 0;
    for (const task of tasks) {
      const createdKey = task.createdAt.slice(0, 10);
      const completedKey = task.completedAt ? todayKey(new Date(task.completedAt)) : null;
      if (todayKey(new Date(task.createdAt)) === key) created += 1;
      if (completedKey === key) completed += 1;
      if (createdKey <= key && (!completedKey || completedKey > key)) openAtEnd += 1;
    }
    rows.push({ day: label, created, completed, openAtEnd });
  }
  return rows;
}
