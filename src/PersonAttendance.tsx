import { useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ATTENDANCE_BARS, PeriodChart } from "./PeriodChart";
import type { Person } from "./types";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { attendanceTotals } from "./attendanceStats";
import { attendanceStatus, todayKey, useDatabase } from "./store";

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

export function PersonAttendance({ person, title = "Attendance" }: { person: Person; title?: string }) {
  const db = useDatabase();
  const [range, setRange] = useState<"week" | "month">("month");
  const totals = attendanceTotals(person, db.attendance, db.leave);
  const recorded = totals.present + totals.absent + totals.leaves;
  const onTime = Math.max(0, totals.present - totals.late);
  const history = db.attendance.filter((record) => record.userId === person.userId);
  const mix = [
    { name: "On time", value: onTime, color: GREEN },
    { name: "Late", value: totals.late, color: AMBER },
    { name: "On leave", value: totals.leaves, color: LEAVE },
    { name: "Absent", value: totals.absent, color: MUTED },
  ];
  const trend = periodDays(range).map((date) => {
    const day = todayKey(date);
    const beforeJoin = Boolean(person.joined && day < person.joined);
    const status = beforeJoin ? null : attendanceStatus(person.userId, db.attendance, db.leave, date, Boolean(person.lateAllowed));
    return {
      day: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      onTime: status === "on_time" ? 1 : 0,
      late: status === "late" ? 1 : 0,
      present: status === "on_time" || status === "late" ? 1 : 0,
      leave: status === "leave" ? 1 : 0,
      absent: status === "not_in" || status === "absentee" ? 1 : 0,
    };
  });

  return (
    <>
      <div className="manage-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">Whole attendance from the day they joined through today.</p>
        </div>
      </div>
      <div className="dash-stats">
        <article className="card stat">
          <span>Total days</span>
          <strong>{recorded}</strong>
        </article>
        <article className="card stat">
          <span>Present</span>
          <strong className="tone-green">{totals.present}</strong>
        </article>
        <article className="card stat">
          <span>Absent</span>
          <strong>{totals.absent}</strong>
        </article>
        <article className="card stat">
          <span>On leave</span>
          <strong className="tone-green">{totals.leaves}</strong>
        </article>
        <article className="card stat">
          <span>Late</span>
          <strong className="tone-amber">{totals.late}</strong>
        </article>
      </div>
      <div className="dash-charts">
        <article className="card">
          <h2>All days</h2>
          <p className="muted">Present, late, leave, and absent across their whole record.</p>
          <div className="chart-box">
            {recorded === 0 ? (
              <p className="muted chart-empty">No attendance yet.</p>
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
              <p className="muted">Bars show each day. The line is the present trend.</p>
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
      <AttendanceCalendar history={history} leave={db.leave} userId={person.userId} lateAllowed={Boolean(person.lateAllowed)} />
    </>
  );
}
