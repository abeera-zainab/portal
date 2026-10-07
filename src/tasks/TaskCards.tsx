import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Person } from "../types";
import { TEAMS, isTaskAssignable, personTeams, sharesTeam, useDatabase, visibleTasks } from "../store";
import { sortTasks, summarizeTasks, tasksByPerson, tasksByTeam } from "./taskStats";
import { DueDate, PriorityBadge, StatusBadge } from "./TaskUi";

const GREEN = "#1f6b4a";
const AMBER = "#9a5b12";
const MUTED = "#8a8178";

const tooltipStyle = {
  background: "#fffdf8",
  border: "1px solid #e4d9c8",
  borderRadius: 12,
  fontSize: 13,
};

/** Admin and team lead dashboards: status donut, per-team bars, and (for leads) a per-person table. */
export function TaskOverviewCard({ person }: { person: Person }) {
  const db = useDatabase();
  const navigate = useNavigate();
  const admin = person.role === "admin";
  const teams = admin ? TEAMS.map((team) => team.id) : personTeams(person);

  const scope = useMemo(() => {
    const tasks = visibleTasks(person, db.tasks, db.people);
    if (admin) return tasks;
    return tasks.filter((task) => {
      const assignee = db.people.find((item) => item.userId === task.assigneeUserId);
      return Boolean(assignee && sharesTeam(person, assignee));
    });
  }, [db.tasks, db.people, person, admin]);

  const summary = useMemo(() => summarizeTasks(scope), [scope]);
  const byTeam = useMemo(() => tasksByTeam(scope, db.people, teams), [scope, db.people, teams]);
  const roster = useMemo(
    () => db.people.filter((item) => isTaskAssignable(item) && !admin && sharesTeam(person, item)),
    [db.people, admin, person]
  );
  const byPerson = useMemo(() => (admin ? [] : tasksByPerson(scope, roster)), [admin, scope, roster]);

  const goTo = (query: Record<string, string>) => {
    const params = new URLSearchParams(admin ? { view: "all" } : { view: "team" });
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    navigate(`/tasks/list?${params.toString()}`);
  };

  const mix = [
    { name: "Open", value: summary.open, color: MUTED, status: "open" },
    { name: "In progress", value: summary.inProgress, color: AMBER, status: "in_progress" },
    { name: "Done", value: summary.done, color: GREEN, status: "done" },
  ].filter((slice) => slice.value > 0);

  return (
    <>
      <div className="dash-charts">
        <article className="card">
          <div className="calendar-head">
            <div>
              <h2>Tasks</h2>
              <p className="muted">
                {summary.total} total · {summary.open + summary.inProgress} active · {summary.overdue} overdue · {summary.completionRate}% done
              </p>
            </div>
            <Link className="btn secondary" to="/tasks">
              Analytics
            </Link>
          </div>
          <div className="chart-box">
            {summary.total === 0 ? (
              <p className="muted chart-empty">No tasks yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} onClick={(slice) => goTo({ status: String((slice as { status?: string }).status ?? "") })}>
                    {mix.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="card">
          <h2>Tasks by team</h2>
          <p className="muted">Click a bar to open those tasks.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byTeam}>
                <CartesianGrid stroke="#e4d9c8" vertical={false} />
                <XAxis dataKey="team" tick={{ fill: "#6d645b", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#6d645b", fontSize: 12 }} width={32} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="open" name="Open" stackId="s" fill={MUTED} cursor="pointer" onClick={(bar) => goTo({ team: bar.payload.teamId, status: "open" })} />
                <Bar dataKey="inProgress" name="In progress" stackId="s" fill={AMBER} cursor="pointer" onClick={(bar) => goTo({ team: bar.payload.teamId, status: "in_progress" })} />
                <Bar dataKey="done" name="Done" stackId="s" fill={GREEN} cursor="pointer" radius={[6, 6, 0, 0]} onClick={(bar) => goTo({ team: bar.payload.teamId, status: "done" })} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      {!admin ? (
        <article className="card">
          <h2>Tasks by person</h2>
          <p className="muted">Everyone on your team with at least one task.</p>
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Assigned</th>
                <th>Active</th>
                <th>Done</th>
                <th>Overdue</th>
              </tr>
            </thead>
            <tbody>
              {byPerson.length === 0 ? (
                <tr>
                  <td colSpan={5}>No tasks assigned yet.</td>
                </tr>
              ) : (
                byPerson.map((row) => (
                  <tr key={row.person.userId}>
                    <td>{row.person.name}</td>
                    <td>{row.assigned}</td>
                    <td>{row.open + row.inProgress}</td>
                    <td>{row.done}</td>
                    <td>{row.overdue ? <span className="due overdue">{row.overdue}</span> : 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>
      ) : null}
    </>
  );
}

/** Employee dashboard: my counts and my next few tasks. */
export function MyTasksCard({ person }: { person: Person }) {
  const db = useDatabase();
  const mine = useMemo(() => sortTasks(db.tasks.filter((task) => task.assigneeUserId === person.userId)), [db.tasks, person.userId]);
  const summary = summarizeTasks(mine);
  const next = mine.filter((task) => task.status !== "done").slice(0, 5);

  return (
    <article className="card">
      <div className="calendar-head">
        <div>
          <h2>My tasks</h2>
          <p className="muted">What is assigned to you right now.</p>
        </div>
        <Link className="btn secondary" to="/tasks/list?view=mine">
          All my tasks
        </Link>
      </div>
      <div className="task-summary" style={{ marginTop: 12 }}>
        <Link className="chip" to="/tasks/list?view=mine&status=open">
          Open <strong>{summary.open}</strong>
        </Link>
        <Link className="chip" to="/tasks/list?view=mine&status=in_progress">
          In progress <strong>{summary.inProgress}</strong>
        </Link>
        <Link className="chip" to="/tasks/list?view=mine&status=done">
          Done <strong>{summary.done}</strong>
        </Link>
        <Link className="chip danger" to="/tasks/list?view=mine&overdue=1">
          Overdue <strong>{summary.overdue}</strong>
        </Link>
      </div>
      {next.length === 0 ? (
        <p className="muted" style={{ marginTop: 14 }}>
          Nothing open. You are all caught up.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Priority</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {next.map((task) => (
              <tr key={task.id}>
                <td>
                  <Link className="name-btn" to={`/tasks/${task.id}`}>
                    {task.title}
                  </Link>
                </td>
                <td>
                  <PriorityBadge priority={task.priority} />
                </td>
                <td>
                  <DueDate task={task} />
                </td>
                <td>
                  <StatusBadge status={task.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

/** Person detail page: that person's tasks with counts. */
export function PersonTasksCard({ person, viewer }: { person: Person; viewer: Person | null }) {
  const db = useDatabase();
  const tasks = useMemo(
    () => sortTasks(visibleTasks(viewer, db.tasks, db.people).filter((task) => task.assigneeUserId === person.userId)),
    [db.tasks, db.people, viewer, person.userId]
  );
  if (!viewer || viewer.role === "hr" || !isTaskAssignable(person)) return null;
  const summary = summarizeTasks(tasks);
  const canAssign = viewer.role === "admin" || sharesTeam(viewer, person);

  return (
    <section className="card">
      <div className="card-title">
        <h2>Tasks</h2>
        {canAssign && viewer.userId !== person.userId ? (
          <Link className="btn secondary" to={`/tasks/new?person=${encodeURIComponent(person.userId)}`}>
            Assign a task
          </Link>
        ) : null}
      </div>
      <div className="task-summary">
        <span className="chip">
          Assigned <strong>{summary.total}</strong>
        </span>
        <span className="chip">
          Active <strong>{summary.open + summary.inProgress}</strong>
        </span>
        <span className="chip">
          Done <strong>{summary.done}</strong>
        </span>
        <span className="chip danger">
          Overdue <strong>{summary.overdue}</strong>
        </span>
      </div>
      {tasks.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>
          No tasks assigned yet.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Priority</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.slice(0, 8).map((task) => (
              <tr key={task.id}>
                <td>
                  <Link className="name-btn" to={`/tasks/${task.id}`}>
                    {task.title}
                  </Link>
                </td>
                <td>
                  <PriorityBadge priority={task.priority} />
                </td>
                <td>
                  <DueDate task={task} />
                </td>
                <td>
                  <StatusBadge status={task.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
