import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Person, TeamId } from "../types";
import {
  TEAMS,
  attendanceStatus,
  isOnLeave,
  isPersonActive,
  personTeams,
  teamName,
  todayKey,
  useDatabase,
} from "../store";

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
  teamId?: TeamId;
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

export function Dashboard() {
  const db = useDatabase();
  const [range, setRange] = useState<"week" | "month">("week");
  const [focus, setFocus] = useState<Focus | null>(null);

  const staff = useMemo(
    () => db.people.filter((person) => person.role !== "admin" && isPersonActive(person)),
    [db.people]
  );

  const stats = useMemo(() => {
    const tally = (date: Date) => {
      const counts = { onTime: 0, late: 0, leave: 0, notIn: 0 };
      for (const person of staff) {
        const status = attendanceStatus(person.userId, db.attendance, db.leave, date);
        if (status === "on_time") counts.onTime += 1;
        else if (status === "late") counts.late += 1;
        else if (status === "leave") counts.leave += 1;
        else counts.notIn += 1;
      }
      return counts;
    };

    const today = tally(new Date());
    const todayMix = [
      { name: "On time", value: today.onTime, color: GREEN, kind: "on_time" as Kind },
      { name: "Late", value: today.late, color: AMBER, kind: "late" as Kind },
      { name: "On leave", value: today.leave, color: LEAVE, kind: "leave" as Kind },
      { name: "Absent", value: today.notIn, color: MUTED, kind: "not_in" as Kind },
    ];

    const byTeam = TEAMS.map((team) => {
      const members = staff.filter((person) => personTeams(person).includes(team.id));
      const counts = { onTime: 0, late: 0, leave: 0, notIn: 0 };
      for (const person of members) {
        const status = attendanceStatus(person.userId, db.attendance, db.leave);
        if (status === "on_time") counts.onTime += 1;
        else if (status === "late") counts.late += 1;
        else if (status === "leave") counts.leave += 1;
        else counts.notIn += 1;
      }
      return { team: team.name.replace(/^PSS /, ""), teamId: team.id, ...counts };
    });

    const trend = periodDays(range).map((date) => {
      const counts = tally(date);
      return {
        day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        when: date.getTime(),
        present: counts.onTime + counts.late,
        late: counts.late,
        leave: counts.leave,
        absent: counts.notIn,
      };
    });

    return {
      users: db.people.length,
      employees: staff.length,
      present: today.onTime + today.late,
      late: today.late,
      leave: today.leave,
      notIn: today.notIn,
      pending: db.leave.filter((request) => request.status === "pending").length,
      todayMix,
      byTeam,
      trend,
    };
  }, [db, range, staff]);

  const open = (next: Focus) => {
    setFocus((current) =>
      current && current.title === next.title && current.kind === next.kind && current.teamId === next.teamId && todayKey(current.when) === todayKey(next.when)
        ? null
        : next
    );
  };

  const openToday = (kind: Kind, title: string, teamId?: TeamId) => {
    open({ kind, title, teamId, when: new Date() });
  };

  const roster = useMemo(() => {
    if (!focus) return [];
    if (focus.kind === "pending") {
      return db.leave
        .filter((request) => request.status === "pending")
        .map((request) => db.people.find((person) => person.userId === request.userId))
        .filter((person): person is Person => Boolean(person));
    }
    return staff.filter((person) => {
      if (focus.teamId && !personTeams(person).includes(focus.teamId)) return false;
      const status = attendanceStatus(person.userId, db.attendance, db.leave, focus.when);
      if (focus.kind === "present") return status === "on_time" || status === "late";
      if (focus.kind === "not_in") return status === "not_in";
      return status === focus.kind;
    });
  }, [db, focus, staff]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Person[]>();
    for (const person of roster) {
      const label = personTeams(person).map((team) => teamName(team)).join(", ") || "No team";
      const list = groups.get(label) ?? [];
      list.push(person);
      groups.set(label, list);
    }
    return [...groups.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  }, [roster]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

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
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">{todayLabel}. Click a count or a chart to see who it includes.</p>
        </div>
      </div>

      <div className="dash-stats">
        <article className="card stat">
          <span>Users</span>
          <strong>{stats.users}</strong>
        </article>
        <article className="card stat">
          <span>Employees</span>
          <strong>{stats.employees}</strong>
        </article>
        <button type="button" className={focus?.kind === "present" && !focus.teamId ? "card stat dash-hit on" : "card stat dash-hit"} onClick={() => openToday("present", "Present today")}>
          <span>Present</span>
          <strong className="tone-green">{stats.present}</strong>
        </button>
        <button type="button" className={focus?.kind === "late" && !focus.teamId ? "card stat dash-hit on" : "card stat dash-hit"} onClick={() => openToday("late", "Late check-ins today")}>
          <span>Late check-ins</span>
          <strong className="tone-amber">{stats.late}</strong>
        </button>
        <button type="button" className={focus?.kind === "leave" && !focus.teamId && todayKey(focus.when) === todayKey() ? "card stat dash-hit on" : "card stat dash-hit"} onClick={() => openToday("leave", "On leave today")}>
          <span>On leave</span>
          <strong className="tone-leave">{stats.leave}</strong>
        </button>
        <button type="button" className={focus?.kind === "not_in" && !focus.teamId ? "card stat dash-hit on" : "card stat dash-hit"} onClick={() => openToday("not_in", "Absent today")}>
          <span>Absent</span>
          <strong>{stats.notIn}</strong>
        </button>
        <button type="button" className={focus?.kind === "pending" ? "card stat dash-hit on" : "card stat dash-hit"} onClick={() => openToday("pending", "Pending leave")}>
          <span>Pending leave</span>
          <strong className="tone-amber">{stats.pending}</strong>
        </button>
      </div>

      <div className="dash-charts">
        <article className="card">
          <h2>Today</h2>
          <p className="muted">Click a slice to see those people.</p>
          <div className="chart-box">
            {stats.employees === 0 ? (
              <p className="muted chart-empty">No active employees yet.</p>
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
          <h2>By team</h2>
          <p className="muted">Click a bar to see that status in that team.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byTeam}>
                <CartesianGrid stroke="#e4d9c8" vertical={false} />
                <XAxis dataKey="team" tick={{ fill: "#6d645b", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#6d645b", fontSize: 12 }} width={32} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="onTime" name="On time" stackId="status" fill={GREEN} cursor="pointer" onClick={(bar) => openToday("on_time", `On time · ${bar.payload.team}`, bar.payload.teamId)} />
                <Bar dataKey="late" name="Late" stackId="status" fill={AMBER} cursor="pointer" onClick={(bar) => openToday("late", `Late · ${bar.payload.team}`, bar.payload.teamId)} />
                <Bar dataKey="leave" name="On leave" stackId="status" fill={LEAVE} cursor="pointer" onClick={(bar) => openToday("leave", `On leave · ${bar.payload.team}`, bar.payload.teamId)} />
                <Bar dataKey="notIn" name="Absent" stackId="status" fill={MUTED} cursor="pointer" radius={[6, 6, 0, 0]} onClick={(bar) => openToday("not_in", `Absent · ${bar.payload.team}`, bar.payload.teamId)} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="card">
        <div className="calendar-head">
          <div>
            <h2>{range === "week" ? "This week" : "This month"}</h2>
            <p className="muted">Click a point to see who was present, late, on leave, or absent that day.</p>
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
        <div className="chart-box chart-box-wide">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={stats.trend}
              onClick={(state) => {
                const point = stats.trend.find((item) => item.day === state.activeLabel);
                if (!point) return;
                const series = String(state.activeDataKey ?? "present");
                const kind = series === "late" ? "late" : series === "leave" ? "leave" : series === "absent" ? "not_in" : "present";
                open({
                  kind,
                  when: new Date(point.when),
                  title: `${series === "leave" ? "On leave" : series === "late" ? "Late" : series === "absent" ? "Absent" : "Present"} · ${point.day}`,
                });
              }}
            >
              <CartesianGrid stroke="#e4d9c8" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#6d645b", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#6d645b", fontSize: 12 }} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend
                onClick={(item) => {
                  const latest = stats.trend[stats.trend.length - 1];
                  if (!latest) return;
                  const series = String(item.dataKey ?? item.value);
                  const kind = series === "late" ? "late" : series === "leave" ? "leave" : series === "absent" ? "not_in" : "present";
                  open({ kind, when: new Date(latest.when), title: `${item.value} · ${latest.day}` });
                }}
              />
              <Line type="monotone" dataKey="present" name="Present" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="late" name="Late" stroke={AMBER} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="leave" name="On leave" stroke={LEAVE} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="absent" name="Absent" stroke={MUTED} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      {focus ? (
        <article className="card roster">
          <h2>{focus.title}</h2>
          <p className="muted">
            {roster.length} {roster.length === 1 ? "person" : "people"}
            {focus.kind === "not_in" ? ", grouped by team." : "."}
          </p>
          {grouped.length === 0 ? (
            <p className="muted">No one matches this view.</p>
          ) : (
            grouped.map(([team, people]) => (
              <div key={team} className="roster-team">
                <h3>{team}</h3>
                <ul>
                  {people.map((person) => {
                    const status = attendanceStatus(person.userId, db.attendance, db.leave, focus.when);
                    const note =
                      focus.kind === "leave" || status === "leave"
                        ? leaveSpan(person)
                        : status === "late"
                          ? "Late"
                          : status === "on_time"
                            ? "On time"
                            : status === "not_in"
                              ? "Absent"
                              : "";
                    return (
                      <li key={person.userId}>
                        <Link className="roster-person" to={`/users/${person.userId}`}>
                          <span>
                            {person.name}
                            <small>{person.userId}</small>
                          </span>
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
    </section>
  );
}
