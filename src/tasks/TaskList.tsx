import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Person, Task, TaskPriority, TaskStatus } from "../types";
import { canAssignTasks, hasLeadRights, isTaskOverdue, sharesTeam, taskTeam, taskTeamLabel, useDatabase, visibleTasks } from "../store";
import { priorityLabel, sortTasks, statusLabel } from "./taskStats";
import { TaskSheet, buildSheetRows } from "./TaskSheet";
import { BackLink } from "./TaskUi";

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
  const team = params.get("team") || "";
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

  const scoped = useMemo(() => {
    const visible = visibleTasks(person, db.tasks, db.people);
    return visible.filter((task) => {
      const assignee = db.people.find((item) => item.userId === task.assigneeUserId);
      if (!inView(view, person, task, assignee)) return false;
      if (team && taskTeam(task, assignee) !== team) return false;
      if (personFilter && task.assigneeUserId !== personFilter) return false;
      return true;
    });
  }, [db.tasks, db.people, person, view, team, personFilter]);

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

  const sheetRows = useMemo(() => buildSheetRows(rows, db.people, db.taskTeams), [rows, db.people, db.taskTeams]);

  // Filters arrive from analytics links; the sheet itself has no filter controls.
  const activeFilters = [
    status ? `${statusLabel(status).toLowerCase()} tasks` : "",
    overdueOnly ? "overdue tasks" : "",
    priority ? `${priorityLabel(priority).toLowerCase()} priority` : "",
    team ? taskTeamLabel(team, db.taskTeams) : "",
    personFilter ? db.people.find((item) => item.userId === personFilter)?.name ?? "" : "",
  ].filter(Boolean);

  return (
    <div className="manage">
      {assigner ? <BackLink to="/tasks">← Back</BackLink> : null}
      <div className="manage-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted">
            {admin
              ? "Every task across the teams. Type your comments straight into the sheet."
              : hasLeadRights(person)
                ? "Your tasks, your team's tasks, and the tasks you assigned. Owners write responses, reviewers write comments."
                : "Write your response in today's column. Reviewers reply in the comments column beside it."}
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
        {activeFilters.length ? (
          <div className="filters sheet-filter-note">
            <span className="muted">Showing {activeFilters.join(" · ")}</span>
            <button
              type="button"
              className="chip"
              onClick={() => set({ status: null, priority: null, team: null, person: null, overdue: null })}
            >
              Show all
            </button>
          </div>
        ) : null}

        <TaskSheet rows={sheetRows} person={person} />
      </section>
    </div>
  );
}
