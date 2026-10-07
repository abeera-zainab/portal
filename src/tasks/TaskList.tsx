import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Person, Task, TaskPriority, TaskStatus, TeamId } from "../types";
import {
  TEAMS,
  assignableFor,
  canAssignTasks,
  hasLeadRights,
  isTaskOverdue,
  personTeams,
  sharesTeam,
  teamName,
  useDatabase,
  visibleTasks,
} from "../store";
import { sortTasks, summarizeTasks } from "./taskStats";
import { BackLink, DueDate, PriorityBadge, StatusBadge, formatWhen } from "./TaskUi";

type View = "all" | "mine" | "team" | "assigned";

const viewsFor = (person: Person): { id: View; label: string }[] => {
  if (person.role === "admin") {
    return [
      { id: "all", label: "All tasks" },
      { id: "assigned", label: "Assigned by me" },
    ];
  }
  const views: { id: View; label: string }[] = [
    { id: "mine", label: "Mine" },
    { id: "team", label: "Team" },
  ];
  if (hasLeadRights(person)) views.push({ id: "assigned", label: "Assigned by me" });
  return views;
};

const inView = (view: View, person: Person, task: Task, assignee: Person | undefined) => {
  if (view === "all") return true;
  if (view === "mine") return task.assigneeUserId === person.userId;
  if (view === "assigned") return task.createdBy === person.userId;
  return Boolean(assignee && assignee.userId !== person.userId && sharesTeam(person, assignee));
};

export function TaskList({ person }: { person: Person }) {
  const db = useDatabase();
  const [params, setParams] = useSearchParams();
  const views = viewsFor(person);
  const requestedView = params.get("view") as View | null;
  const view: View = views.some((item) => item.id === requestedView) ? (requestedView as View) : views[0].id;
  const status = (params.get("status") || "") as "" | TaskStatus;
  const priority = (params.get("priority") || "") as "" | TaskPriority;
  const team = (params.get("team") || "") as "" | TeamId;
  const personFilter = params.get("person") || "";
  const overdueOnly = params.get("overdue") === "1";
  const admin = person.role === "admin";
  const assigner = canAssignTasks(person);

  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  const people = useMemo(() => (admin ? assignableFor(person, db.people) : []), [admin, person, db.people]);

  const scoped = useMemo(() => {
    const visible = visibleTasks(person, db.tasks, db.people);
    return visible.filter((task) => {
      const assignee = db.people.find((item) => item.userId === task.assigneeUserId);
      if (!inView(view, person, task, assignee)) return false;
      if (team && (!assignee || !personTeams(assignee).includes(team))) return false;
      if (personFilter && task.assigneeUserId !== personFilter) return false;
      return true;
    });
  }, [db.tasks, db.people, person, view, team, personFilter]);

  const summary = useMemo(() => summarizeTasks(scoped), [scoped]);

  const rows = useMemo(
    () =>
      sortTasks(
        scoped.filter((task) => {
          if (status && task.status !== status) return false;
          if (priority && task.priority !== priority) return false;
          if (overdueOnly && !isTaskOverdue(task)) return false;
          return true;
        })
      ),
    [scoped, status, priority, overdueOnly]
  );

  const showAssignee = view !== "mine";
  const showTeam = admin || personTeams(person).length > 1;
  const columns = 5 + (showAssignee ? 1 : 0) + (showTeam ? 1 : 0);

  const chip = (label: string, count: number, active: boolean, onClick: () => void, tone = "") => (
    <button type="button" className={active ? `chip on ${tone}` : `chip ${tone}`} onClick={onClick}>
      {label} <strong>{count}</strong>
    </button>
  );

  return (
    <div className="manage">
      {assigner ? <BackLink to="/tasks">← Back</BackLink> : null}
      <div className="manage-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted">
            {admin
              ? "Every task across the teams. Open a task to review it or leave a comment."
              : hasLeadRights(person)
                ? "Your tasks, your team's tasks, and the tasks you assigned."
                : "Your tasks and the tasks of people on your team."}
          </p>
        </div>
        <div className="filters">
          {assigner ? (
            <Link className="btn secondary" to="/tasks">
              Analytics
            </Link>
          ) : null}
          {assigner ? (
            <Link className="btn" to="/tasks/new">
              New task
            </Link>
          ) : null}
        </div>
      </div>

      {views.length > 1 ? (
        <div className="filters">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              className={view === item.id ? "chip on" : "chip"}
              onClick={() => set({ view: item.id, person: null })}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      <section className="card">
        <div className="task-summary">
          {chip("All", summary.total, !status && !overdueOnly, () => set({ status: null, overdue: null }))}
          {chip("Open", summary.open, status === "open" && !overdueOnly, () => set({ status: "open", overdue: null }))}
          {chip("In progress", summary.inProgress, status === "in_progress" && !overdueOnly, () =>
            set({ status: "in_progress", overdue: null })
          )}
          {chip("Done", summary.done, status === "done" && !overdueOnly, () => set({ status: "done", overdue: null }))}
          {chip("Overdue", summary.overdue, overdueOnly, () => set({ overdue: overdueOnly ? null : "1", status: null }), "danger")}
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          {admin || personTeams(person).length > 1 ? (
            <label>
              Team
              <select value={team} onChange={(event) => set({ team: event.target.value || null })}>
                <option value="">All teams</option>
                {(admin ? TEAMS : TEAMS.filter((item) => personTeams(person).includes(item.id))).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {admin ? (
            <label>
              Person
              <select value={personFilter} onChange={(event) => set({ person: event.target.value || null })}>
                <option value="">Everyone</option>
                {people.map((item) => (
                  <option key={item.userId} value={item.userId}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            Priority
            <select value={priority} onChange={(event) => set({ priority: event.target.value || null })}>
              <option value="">Any priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          {status || priority || team || personFilter || overdueOnly ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => set({ status: null, priority: null, team: null, person: null, overdue: null })}
            >
              Clear filters
            </button>
          ) : null}
        </div>

        <table>
          <thead>
            <tr>
              <th>Task</th>
              {showAssignee ? <th>Assignee</th> : null}
              {showTeam ? <th>Team</th> : null}
              <th>Priority</th>
              <th>Due</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns}>No tasks match this view.</td>
              </tr>
            ) : (
              rows.map((task) => {
                const assignee = db.people.find((item) => item.userId === task.assigneeUserId);
                return (
                  <tr key={task.id} className={task.status === "done" ? "task-row done" : "task-row"}>
                    <td>
                      <Link className="name-btn" to={`/tasks/${task.id}`}>
                        {task.title}
                      </Link>
                      {task.brief ? <small className="task-brief">{task.brief}</small> : null}
                    </td>
                    {showAssignee ? <td>{assignee?.name ?? "Former member"}</td> : null}
                    {showTeam ? (
                      <td>{assignee ? personTeams(assignee).map((item) => teamName(item)).join(", ") || "—" : "—"}</td>
                    ) : null}
                    <td>
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td>
                      <DueDate task={task} />
                    </td>
                    <td>
                      <StatusBadge status={task.status} />
                    </td>
                    <td>{formatWhen(task.updatedAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
