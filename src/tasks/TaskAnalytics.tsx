import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Person } from "../types";
import { PeriodChart } from "../PeriodChart";
import type { PeriodBar } from "../PeriodChart";
import { TEAMS, canAssignTasks, hasLeadRights, isTaskAssignable, personTeams, sharesTeam, useDatabase, visibleTasks } from "../store";
import { summarizeTasks, taskTrend, tasksByPerson, tasksByTeam } from "./taskStats";
import { TaskList } from "./TaskList";

const GREEN = "#1f6b4a";
const AMBER = "#9a5b12";
const LEAVE = "#1d4e89";
const MUTED = "#8a8178";
const RED = "#9b2c2c";

const tooltipStyle = {
  background: "#fffdf8",
  border: "1px solid #e4d9c8",
  borderRadius: 12,
  fontSize: 13,
};

export const TASK_BARS: PeriodBar[] = [
  { key: "created", name: "Created", color: LEAVE },
  { key: "completed", name: "Completed", color: GREEN },
];

/** Landing page for /tasks: analytics for people who assign work, the task list for everyone else. */
export function TasksHome({ person }: { person: Person }) {
  return canAssignTasks(person) ? <TaskAnalytics person={person} /> : <TaskList person={person} />;
}

export function TaskAnalytics({ person }: { person: Person }) {
  const db = useDatabase();
  const navigate = useNavigate();
  const [range, setRange] = useState<"week" | "month">("week");
  const admin = person.role === "admin";

  const scope = useMemo(() => {
    const tasks = visibleTasks(person, db.tasks, db.people);
    if (admin) return tasks;
    return tasks.filter((task) => {
      const assignee = db.people.find((item) => item.userId === task.assigneeUserId);
      return task.createdBy === person.userId || Boolean(assignee && sharesTeam(person, assignee));
    });
  }, [db.tasks, db.people, person, admin]);

  const teams = admin ? TEAMS.map((team) => team.id) : personTeams(person);
  const summary = useMemo(() => summarizeTasks(scope), [scope]);
  const byTeam = useMemo(() => tasksByTeam(scope, db.people, teams), [scope, db.people, teams]);
  const roster = useMemo(
    () => db.people.filter((item) => isTaskAssignable(item) && (admin || sharesTeam(person, item))),
    [db.people, admin, person]
  );
  const byPerson = useMemo(() => tasksByPerson(scope, roster), [scope, roster]);
  const personBars = useMemo(
    () =>
      [...byPerson]
        .sort((a, b) => b.assigned - a.assigned || a.person.name.localeCompare(b.person.name))
        .map((row) => ({
          userId: row.person.userId,
          name: row.person.name,
          total: row.assigned,
          done: row.done,
          overdue: row.overdue,
          inProgress: row.inProgress,
        })),
    [byPerson]
  );
  const trend = useMemo(() => taskTrend(scope, range), [scope, range]);

  if (!canAssignTasks(person)) return <Navigate to="/tasks/list" replace />;

  const goTo = (query: Record<string, string>) => {
    const params = new URLSearchParams(admin ? { view: "all" } : { view: "team" });
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    navigate(`/tasks/list?${params.toString()}`);
  };

  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Tasks</h1>
        </div>
        <div className="filters">
          <Link className="btn secondary" to={`/tasks/list?view=${admin ? "all" : "team"}`}>
            Task list
          </Link>
          <Link className="btn" to="/tasks/new">
            New task
          </Link>
        </div>
      </div>

      <div className="dash-stats">
        <button type="button" className="card stat dash-hit" onClick={() => goTo({})}>
          <span>Total tasks</span>
          <strong>{summary.total}</strong>
        </button>
        <button type="button" className="card stat dash-hit" onClick={() => goTo({ status: "open" })}>
          <span>Open</span>
          <strong>{summary.open}</strong>
        </button>
        <button type="button" className="card stat dash-hit" onClick={() => goTo({ status: "in_progress" })}>
          <span>In progress</span>
          <strong className="tone-amber">{summary.inProgress}</strong>
        </button>
        <button type="button" className="card stat dash-hit" onClick={() => goTo({ status: "done" })}>
          <span>Done</span>
          <strong className="tone-green">{summary.done}</strong>
        </button>
        <button type="button" className="card stat dash-hit" onClick={() => goTo({ overdue: "1" })}>
          <span>Overdue</span>
          <strong className="tone-red">{summary.overdue}</strong>
        </button>
        <article className="card stat">
          <span>Completion rate</span>
          <strong className="tone-green">{summary.completionRate}%</strong>
        </article>
        <article className="card stat">
          <span>Done this week</span>
          <strong>{summary.doneThisWeek}</strong>
        </article>
        <article className="card stat">
          <span>Avg days to complete</span>
          <strong>{summary.avgDaysToComplete === null ? "—" : summary.avgDaysToComplete}</strong>
        </article>
      </div>

      <article className="card">
        <h2>Tasks per person</h2>
        <p className="muted">
          Total given, completed, overdue, and in progress for everyone with a task.
          {admin ? " Click a bar to open that person's tasks." : ""}
        </p>
        <div className="chart-box" style={{ height: Math.max(240, personBars.length * 48 + 60) }}>
          {personBars.length === 0 ? (
            <p className="muted chart-empty">No tasks assigned yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={personBars} layout="vertical" margin={{ left: 8, right: 24 }} barCategoryGap={14} barGap={2}>
                <CartesianGrid stroke="#e4d9c8" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: "#6d645b", fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fill: "#1c1915", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f7f2e8" }} />
                <Legend />
                <Bar dataKey="total" name="Total given" fill={LEAVE} radius={[0, 4, 4, 0]} cursor={admin ? "pointer" : undefined} onClick={(bar) => admin && goTo({ person: bar.payload.userId })} />
                <Bar dataKey="done" name="Completed" fill={GREEN} radius={[0, 4, 4, 0]} cursor={admin ? "pointer" : undefined} onClick={(bar) => admin && goTo({ person: bar.payload.userId, status: "done" })} />
                <Bar dataKey="overdue" name="Overdue" fill={RED} radius={[0, 4, 4, 0]} cursor={admin ? "pointer" : undefined} onClick={(bar) => admin && goTo({ person: bar.payload.userId, overdue: "1" })} />
                <Bar dataKey="inProgress" name="In progress" fill={AMBER} radius={[0, 4, 4, 0]} cursor={admin ? "pointer" : undefined} onClick={(bar) => admin && goTo({ person: bar.payload.userId, status: "in_progress" })} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <div className="dash-charts">
        <article className="card">
          <h2>By team</h2>
          <p className="muted">Open, in progress, and done per team. Click a bar to open those tasks.</p>
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

        <article className="card">
          <div className="calendar-head">
            <div>
              <h2>{range === "week" ? "This week" : "This month"}</h2>
              <p className="muted">Tasks created and completed each day. The line is how many were still open.</p>
            </div>
            <div className="filters">
              <button type="button" className={range === "week" ? "chip on" : "chip"} onClick={() => setRange("week")}>
                Week
              </button>
              <button type="button" className={range === "month" ? "chip on" : "chip"} onClick={() => setRange("month")}>
                Month
              </button>
            </div>
          </div>
          <div className="chart-box">
            <PeriodChart data={trend} bars={TASK_BARS} trendKey="openAtEnd" trendName="Still open" trendColor={AMBER} />
          </div>
        </article>
      </div>

      <article className="card">
        <h2>By person</h2>
        <p className="muted">Everyone with at least one task. Click a name to see their tasks.</p>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              {admin ? <th>Team</th> : null}
              <th>Assigned</th>
              <th>Open</th>
              <th>In progress</th>
              <th>Done</th>
              <th>Overdue</th>
              <th>Completion</th>
            </tr>
          </thead>
          <tbody>
            {byPerson.length === 0 ? (
              <tr>
                <td colSpan={admin ? 8 : 7}>No tasks assigned yet.</td>
              </tr>
            ) : (
              byPerson.map((row) => (
                <tr key={row.person.userId}>
                  <td>
                    {admin ? (
                      <Link className="name-btn" to={`/tasks/list?view=all&person=${encodeURIComponent(row.person.userId)}`}>
                        {row.person.name}
                      </Link>
                    ) : (
                      row.person.name
                    )}
                  </td>
                  {admin ? <td>{personTeams(row.person).map((team) => TEAMS.find((item) => item.id === team)?.name ?? team).join(", ") || "—"}</td> : null}
                  <td>{row.assigned}</td>
                  <td>{row.open}</td>
                  <td>{row.inProgress}</td>
                  <td>{row.done}</td>
                  <td>{row.overdue ? <span className="due overdue">{row.overdue}</span> : 0}</td>
                  <td>{row.completionRate}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </article>
      {hasLeadRights(person) && !admin ? (
        <p className="muted">Counts include tasks for everyone on your team, whoever assigned them.</p>
      ) : null}
    </section>
  );
}
