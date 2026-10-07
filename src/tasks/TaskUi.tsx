import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Task, TaskPriority, TaskStatus } from "../types";
import { isTaskOverdue, todayKey } from "../store";
import { priorityLabel, statusLabel } from "./taskStats";

/**
 * Back link that returns to the previous page when the user navigated here inside the app,
 * and falls back to `to` when the page was opened directly (new tab, bookmark, refresh).
 */
export function BackLink({ to, children = "← Back" }: { to: string; children?: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasHistory = location.key !== "default" && window.history.length > 1;
  if (!hasHistory) {
    return (
      <Link className="back-link" to={to}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className="back-link" onClick={() => navigate(-1)}>
      {children}
    </button>
  );
}

export const formatWhen = (iso: string | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export const formatDay = (day: string | undefined) => {
  if (!day) return "—";
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const className = status === "done" ? "badge" : status === "in_progress" ? "badge late" : "badge wait";
  return <span className={className}>{statusLabel(status)}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <span className={`badge priority-${priority}`}>{priorityLabel(priority)}</span>;
}

export function DueDate({ task }: { task: Task }) {
  if (!task.dueDate) return <span className="muted">—</span>;
  const overdue = isTaskOverdue(task);
  const dueToday = task.status !== "done" && task.dueDate === todayKey();
  const className = overdue ? "due overdue" : dueToday ? "due soon" : "due";
  return (
    <span className={className}>
      {formatDay(task.dueDate)}
      {overdue ? " · Overdue" : dueToday ? " · Today" : ""}
    </span>
  );
}

export function StatusSelect({ value, onChange }: { value: TaskStatus; onChange: (status: TaskStatus) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as TaskStatus)}>
      <option value="open">Open</option>
      <option value="in_progress">In progress</option>
      <option value="done">Done</option>
    </select>
  );
}

export function PrioritySelect({ value, onChange }: { value: TaskPriority; onChange: (priority: TaskPriority) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value as TaskPriority)}>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
  );
}
