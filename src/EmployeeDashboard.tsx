import { useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ATTENDANCE_BARS, PeriodChart } from "./PeriodChart";
import type { Person } from "./types";
import { monthTotals } from "./attendanceStats";
import { attendanceStatus, formatClock, personTeams, teamName, todayKey, useDatabase } from "./store";

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

const noon = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
};

const periodDays = (mode: "week" | "month", joined?: string) => {
  const today = noon(new Date());
  const start = new Date(today);
  if (mode === "week") {
    const weekday = start.getDay();
    start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  } else {
    start.setDate(1);
  }
  if (joined) {
    const joinedDay = noon(new Date(`${joined}T12:00:00`));
    if (!Number.isNaN(joinedDay.getTime()) && joinedDay > start) start.setTime(joinedDay.getTime());
  }
  const days: Date[] = [];
  for (const cursor = new Date(start); cursor <= today; cursor.setDate(cursor.getDate() + 1)) {
    days.push(noon(cursor));
  }
  return days;
};

const statusLabel = (status: string) => {
  if (status === "on_time") return "On time";
  if (status === "late") return "Late";
  if (status === "absentee") return "Absentee";
  if (status === "leave") return "On leave";
  if (status === "weekend") return "—";
  return "Not in";
};

export function EmployeeDashboard({ person }: { person: Person }) {
  const db = useDatabase();
  const [range, setRange] = useState<"week" | "month">("month");
  const teams = personTeams(person);
  const teamLabel = teams.map((team) => teamName(team)).join(", ") || "No team";
  const month = monthTotals(person, db.attendance, db.leave);
  const today = new Date();
  const todayStatus = attendanceStatus(person.userId, db.attendance, db.leave, today, Boolean(person.lateAllowed));
  const record = db.attendance.find((item) => item.userId === person.userId && item.date === todayKey(today));

  const mix = [
    { name: "On time", value: month.present - month.late, color: GREEN },
    { name: "Late", value: month.late, color: AMBER },
    { name: "On leave", value: month.leaves, color: LEAVE },
    { name: "Absent", value: month.absent, color: MUTED },
  ];

  const trend = useMemo(
    () =>
      periodDays(range, person.joined).map((date) => {
        const status = attendanceStatus(person.userId, db.attendance, db.leave, date, Boolean(person.lateAllowed));
        return {
          day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          onTime: status === "on_time" ? 1 : 0,
          late: status === "late" ? 1 : 0,
          present: status === "on_time" || status === "late" ? 1 : 0,
          leave: status === "leave" ? 1 : 0,
          absent: status === "not_in" || status === "absentee" ? 1 : 0,
        };
      }),
    [db.attendance, db.leave, person.joined, person.lateAllowed, person.userId, range]
  );

  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <p className="muted">
        {todayLabel}. {teamLabel}. Your attendance for this month.
      </p>

      <div className="dash-stats">
        <article className="card stat">
          <span>Present</span>
          <strong className="tone-green">{month.present}</strong>
        </article>
        <article className="card stat">
          <span>Absent</span>
          <strong>{month.absent}</strong>
        </article>
        <article className="card stat">
          <span>On leave</span>
          <strong className="tone-green">{month.leaves}</strong>
        </article>
        <article className="card stat">
          <span>Late</span>
          <strong className="tone-amber">{month.late}</strong>
        </article>
      </div>

      <article className="card">
        <h2>Today</h2>
        <p className="muted">Your check-in and check-out for today.</p>
        <div className="table-card month-wrap">
          <table className="month-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>In</th>
                <th>Out</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{statusLabel(todayStatus)}</td>
                <td>{formatClock(record?.checkIn)}</td>
                <td>{formatClock(record?.checkOut)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <div className="dash-charts">
        <article className="card">
          <h2>This month</h2>
          <p className="muted">
            {today.toLocaleDateString(undefined, { month: "long", year: "numeric" })}. On time, late, leave, and absent days.
          </p>
          <div className="chart-box">
            {month.present + month.absent + month.leaves === 0 ? (
              <p className="muted chart-empty">No days in this month yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
                    {mix.map((slice) => (
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
          <div className="calendar-head">
            <div>
              <h2>{range === "week" ? "This week" : "This month"}</h2>
              <p className="muted">Bars show each day. The line is your present trend.</p>
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
            <PeriodChart data={trend} bars={ATTENDANCE_BARS} trendKey="present" trendName="Present trend" />
          </div>
        </article>
      </div>
    </>
  );
}
