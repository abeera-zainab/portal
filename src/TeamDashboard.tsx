import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ATTENDANCE_BARS, PeriodChart } from "./PeriodChart";
import { TaskOverviewCard } from "./tasks/TaskCards";
import type { Person, TeamId } from "./types";
import { monthTotals } from "./attendanceStats";
import {
  attendanceHref,
  attendanceStatus,
  canSeeLate,
  isOnLeave,
  formatClock,
  personTeams,
  reviewableLeave,
  teamName,
  teamRoster,
  todayKey,
  useDatabase,
} from "./store";

const GREEN = "#1f6b4a";
const AMBER = "#9a5b12";
const LEAVE = "#1d4e89";
const MUTED = "#8a8178";

const tooltipStyle = {
  background: "#fffdf8",
  border: "1px solid #e4d9c8",
  borderRadius: 12,
  fontSize: 13,
};

type Kind = "present" | "on_time" | "late" | "leave" | "not_in" | "pending";

type Focus = {
  title: string;
  when: Date;
  kind: Kind;
};

const noon = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
};

const periodDays = (mode: "week" | "month") => {
  const today = noon(new Date());
  const start = new Date(today);
  if (mode === "week") {
    const weekday = start.getDay();
    start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  } else {
    start.setDate(1);
  }
  const days: Date[] = [];
  for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    days.push(noon(cursor));
  }
  return days;
};

const kindFromLabel = (label: string): Kind => {
  if (label === "On time") return "on_time";
  if (label === "Late") return "late";
  if (label === "On leave" || label === "Leave") return "leave";
  if (label === "Present") return "present";
  return "not_in";
};

export function TeamDashboard({ lead }: { lead: Person }) {
  const db = useDatabase();
  const [range, setRange] = useState<"week" | "month">("month");
  const [focus, setFocus] = useState<Focus | null>(null);
  const members = useMemo(() => teamRoster(lead, db.people), [db.people, lead]);
  const leadTeams = personTeams(lead);

  const stats = useMemo(() => {
    const tally = (date: Date) => {
      const counts = { onTime: 0, late: 0, leave: 0, notIn: 0 };
      for (const person of members) {
        const status = attendanceStatus(person.userId, db.attendance, db.leave, date, Boolean(person.lateAllowed));
        if (status === "weekend") continue;
        if (status === "on_time") counts.onTime += 1;
        else if (status === "late") counts.late += 1;
        else if (status === "leave") counts.leave += 1;
        else counts.notIn += 1;
      }
      return counts;
    };

    const today = tally(new Date());
    const todayMix = [
      { name: "On time", value: today.onTime, color: GREEN },
      { name: "Late", value: today.late, color: AMBER },
      { name: "On leave", value: today.leave, color: LEAVE },
      { name: "Absent", value: today.notIn, color: MUTED },
    ];
    const trend = periodDays(range).map((date) => {
      const counts = tally(date);
      return {
        day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        when: date.getTime(),
        onTime: counts.onTime,
        late: counts.late,
        present: counts.onTime + counts.late,
        leave: counts.leave,
        absent: counts.notIn,
      };
    });

    return {
      present: today.onTime + today.late,
      late: today.late,
      leave: today.leave,
      notIn: today.notIn,
      pending: reviewableLeave(lead, db.people, db.leave).filter((request) => request.status === "pending").length,
      todayMix,
      trend,
    };
  }, [db, lead, members, range]);

  const open = (next: Focus) => {
    setFocus((current) =>
      current && current.title === next.title && current.kind === next.kind && todayKey(current.when) === todayKey(next.when)
        ? null
        : next
    );
  };

  const openToday = (kind: Kind, title: string) => open({ kind, title, when: new Date() });

  const roster = useMemo(() => {
    if (!focus) return [];
    if (focus.kind === "pending") {
      return reviewableLeave(lead, db.people, db.leave)
        .filter((request) => request.status === "pending")
        .map((request) => members.find((person) => person.userId === request.userId))
        .filter((person): person is Person => Boolean(person));
    }
    return members.filter((person) => {
      const status = attendanceStatus(person.userId, db.attendance, db.leave, focus.when, Boolean(person.lateAllowed));
      if (focus.kind === "present") return status === "on_time" || status === "late";
      if (focus.kind === "not_in") return status === "not_in" || status === "absentee";
      return status === focus.kind;
    });
  }, [db, focus, lead, members]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Person[]>();
    for (const person of roster) {
      const label =
        personTeams(person)
          .filter((team) => leadTeams.includes(team))
          .map((team) => teamName(team))
          .join(", ") || "No team";
      const list = groups.get(label) ?? [];
      list.push(person);
      groups.set(label, list);
    }
    return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [leadTeams, roster]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const teamLabel = leadTeams.map((team: TeamId) => teamName(team)).join(", ") || "No team";

  const leaveSpan = (person: Person) => {
    if (!focus) return "";
    const day = todayKey(focus.when);
    const request = db.leave.find(
      (item) => item.userId === person.userId && item.status === "approved" && isOnLeave(person.userId, [item], day)
    );
    if (!request) return "";
    return request.to !== request.from ? `${request.from} to ${request.to}` : request.from;
  };

  return (
    <>
      <p className="muted">
        {todayLabel}. People who report to you{teamLabel ? ` · ${teamLabel}` : ""}. Click a count or a chart to see who it includes. A fourth late day in a row counts as absent.
      </p>

      <div className="dash-stats">
        <button
          type="button"
          className={focus?.kind === "present" ? "card stat dash-hit on" : "card stat dash-hit"}
          onClick={() => openToday("present", "Present today")}
        >
          <span>Present</span>
          <strong className="tone-green">{stats.present}</strong>
        </button>
        {canSeeLate(lead) ? (
          <button
            type="button"
            className={focus?.kind === "late" ? "card stat dash-hit on" : "card stat dash-hit"}
            onClick={() => openToday("late", "Late today")}
          >
            <span>Late</span>
            <strong className="tone-amber">{stats.late}</strong>
          </button>
        ) : null}
        <button
          type="button"
          className={focus?.kind === "not_in" ? "card stat dash-hit on" : "card stat dash-hit"}
          onClick={() => openToday("not_in", "Absent today")}
        >
          <span>Absent</span>
          <strong>{stats.notIn}</strong>
        </button>
        <button
          type="button"
          className={focus?.kind === "leave" ? "card stat dash-hit on" : "card stat dash-hit"}
          onClick={() => openToday("leave", "On leave today")}
        >
          <span>On leave</span>
          <strong className="tone-green">{stats.leave}</strong>
        </button>
        <button
          type="button"
          className={focus?.kind === "pending" ? "card stat dash-hit on" : "card stat dash-hit"}
          onClick={() => openToday("pending", "Pending leave")}
        >
          <span>Pending leave</span>
          <strong className="tone-amber">{stats.pending}</strong>
        </button>
      </div>

      <div className="dash-charts">
        <article className="card">
          <h2>Today</h2>
          <p className="muted">Presence, leave, and absences on your team.</p>
          <div className="chart-box">
            {members.length === 0 ? (
              <p className="muted chart-empty">No one is on your team yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.todayMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={3}
                    onClick={(slice) => openToday(kindFromLabel(String(slice.name)), `${slice.name} today`)}
                  >
                    {stats.todayMix.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend onClick={(item) => openToday(kindFromLabel(String(item.value)), `${item.value} today`)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="card">
          <div className="calendar-head">
            <div>
              <h2>{range === "week" ? "This week" : "This month"}</h2>
              <p className="muted">Bars show each status across the week or month. The line is the present trend.</p>
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
            <PeriodChart data={stats.trend} bars={ATTENDANCE_BARS} trendKey="present" trendName="Present trend" />
          </div>
        </article>
      </div>

      <article className="card">
        <h2>This month</h2>
        <p className="muted">
          {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}. Present, absent, leave, and late days for each person.
        </p>
        <div className="table-card month-wrap">
          <table className="month-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Present</th>
                <th>Absent</th>
                <th>On leave</th>
                <th>Late</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5}>No one is on your team yet.</td>
                </tr>
              ) : (
                [...members]
                  .sort((left, right) => left.name.localeCompare(right.name))
                  .map((person) => {
                    const totals = monthTotals(person, db.attendance, db.leave);
                    return (
                      <tr key={person.userId}>
                        <td>
                          <Link className="name-btn" to={attendanceHref(person.userId, "team")}>
                            {person.name}
                          </Link>
                          <div className="muted">{person.userId}</div>
                        </td>
                        <td>{totals.present}</td>
                        <td>{totals.absent}</td>
                        <td>{totals.leaves}</td>
                        <td>{totals.late}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </article>

      <TaskOverviewCard person={lead} />

      {focus ? (
        <article className="card roster">
          <h2>{focus.title}</h2>
          <p className="muted">
            {roster.length} {roster.length === 1 ? "person" : "people"}
            {leadTeams.length > 1 ? ", grouped by team." : "."}
          </p>
          {grouped.length === 0 ? (
            <p className="muted">No one matches this view.</p>
          ) : (
            grouped.map(([team, people]) => (
              <div key={team} className="roster-team">
                {leadTeams.length > 1 ? <h3>{team}</h3> : null}
                <div className="roster-head">
                  <span>Person</span>
                  <span>In</span>
                  <span>Out</span>
                  <span>Status</span>
                </div>
                <ul>
                  {people.map((person) => {
                    const status = attendanceStatus(person.userId, db.attendance, db.leave, focus.when, Boolean(person.lateAllowed));
                    const record = db.attendance.find(
                      (item) => item.userId === person.userId && item.date === todayKey(focus.when)
                    );
                    const note =
                      focus.kind === "pending"
                        ? "Pending"
                        : focus.kind === "leave" || status === "leave"
                          ? leaveSpan(person) || "On leave"
                          : status === "late"
                            ? "Late"
                            : status === "absentee"
                              ? "Absentee"
                            : status === "on_time"
                              ? "On time"
                              : "Absent";
                    return (
                      <li key={person.userId}>
                        <Link className="roster-person roster-row" to={attendanceHref(person.userId, "team")}>
                          <span>
                            {person.name}
                            <small>{person.userId}</small>
                          </span>
                          <span>{formatClock(record?.checkIn)}</span>
                          <span>{formatClock(record?.checkOut)}</span>
                          <span>{note}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </article>
      ) : null}
    </>
  );
}
