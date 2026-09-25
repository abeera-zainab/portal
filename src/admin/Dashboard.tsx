import { useMemo } from "react";
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
import {
  TEAMS,
  attendanceStatus,
  isPersonActive,
  personTeams,
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

const dayAtNoon = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - offset);
  return date;
};

export function Dashboard() {
  const db = useDatabase();

  const stats = useMemo(() => {
    const staff = db.people.filter((person) => person.role !== "admin" && isPersonActive(person));
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
      { name: "On time", value: today.onTime, color: GREEN },
      { name: "Late", value: today.late, color: AMBER },
      { name: "On leave", value: today.leave, color: LEAVE },
      { name: "Not in", value: today.notIn, color: MUTED },
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
      return { team: team.name.replace(/^PSS /, ""), ...counts };
    });

    const trend = Array.from({ length: 14 }, (_, index) => {
      const date = dayAtNoon(13 - index);
      const counts = tally(date);
      return {
        day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        present: counts.onTime + counts.late,
        late: counts.late,
        leave: counts.leave,
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
  }, [db]);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">{todayLabel}</p>
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
        <article className="card stat">
          <span>Present</span>
          <strong className="tone-green">{stats.present}</strong>
        </article>
        <article className="card stat">
          <span>Late check-ins</span>
          <strong className="tone-amber">{stats.late}</strong>
        </article>
        <article className="card stat">
          <span>On leave</span>
          <strong className="tone-leave">{stats.leave}</strong>
        </article>
        <article className="card stat">
          <span>Not in</span>
          <strong>{stats.notIn}</strong>
        </article>
        <article className="card stat">
          <span>Pending leave</span>
          <strong className="tone-amber">{stats.pending}</strong>
        </article>
      </div>

      <div className="dash-charts">
        <article className="card">
          <h2>Today</h2>
          <p className="muted">On time, late, leave, and not checked in.</p>
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
                  >
                    {stats.todayMix.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} />
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
          <h2>By team</h2>
          <p className="muted">Today’s attendance in each PSS team.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byTeam}>
                <CartesianGrid stroke="#e4d9c8" vertical={false} />
                <XAxis dataKey="team" tick={{ fill: "#6d645b", fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: "#6d645b", fontSize: 12 }} width={32} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="onTime" name="On time" stackId="status" fill={GREEN} />
                <Bar dataKey="late" name="Late" stackId="status" fill={AMBER} />
                <Bar dataKey="leave" name="On leave" stackId="status" fill={LEAVE} />
                <Bar dataKey="notIn" name="Not in" stackId="status" fill={MUTED} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>

      <article className="card">
        <h2>Last 14 days</h2>
        <p className="muted">Present, late check-ins, and approved leave.</p>
        <div className="chart-box chart-box-wide">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={stats.trend}>
              <CartesianGrid stroke="#e4d9c8" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "#6d645b", fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fill: "#6d645b", fontSize: 12 }} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="present" name="Present" stroke={GREEN} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="late" name="Late" stroke={AMBER} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="leave" name="On leave" stroke={LEAVE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
