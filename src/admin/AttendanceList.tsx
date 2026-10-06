import { useState } from "react";
import { Link } from "react-router-dom";
import type { Database, Person } from "../types";
import { attendanceTotals } from "../attendanceStats";
import {
  attendanceStatus,
  canEditAttendance,
  dayStatusClass,
  dayStatusLabel,
  formatClock,
  isHrPss,
  personTeams,
  roleTags,
  teamName,
  todayKey,
  useDatabase,
  useSession,
} from "../store";
import { MarkPresentButton } from "../MarkPresent";
import { AssignedTags } from "./PersonDetail";

const shiftKey = (day: string, delta: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + delta);
  const next = todayKey(date);
  const today = todayKey();
  return next > today ? today : next;
};

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function downloadDayReport(people: Person[], db: Database, day: string) {
  const when = new Date(`${day}T12:00:00`);
  const title = Number.isNaN(when.getTime())
    ? day
    : when.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const rows = people.map((person) => {
    const record = db.attendance.find((item) => item.userId === person.userId && item.date === day);
    const status = attendanceStatus(person.userId, db.attendance, db.leave, when, Boolean(person.lateAllowed));
    return {
      name: person.name,
      userId: person.userId,
      teams: personTeams(person).map((team) => teamName(team)).join(", ") || "No team",
      roles: roleTags(person),
      checkIn: record ? formatClock(record.checkIn) : "—",
      checkOut: record?.checkOut ? formatClock(record.checkOut) : "—",
      status: dayStatusLabel(status, "Absent"),
    };
  });
  const counts = rows.reduce(
    (tally, row) => {
      tally[row.status] = (tally[row.status] ?? 0) + 1;
      return tally;
    },
    {} as Record<string, number>
  );
  const summary = ["On time", "Late", "Absentee", "Leave", "Weekend", "Absent"]
    .map((label) => `${label}: ${counts[label] ?? 0}`)
    .join(" · ");
  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.userId)}</td>
        <td class="tags">${row.roles.map((tag) => `<span class="tag ${escapeHtml(tag.id)}">${escapeHtml(tag.label)}</span>`).join("")}</td>
        <td>${escapeHtml(row.teams)}</td>
        <td>${escapeHtml(row.checkIn)}</td>
        <td>${escapeHtml(row.checkOut)}</td>
        <td>${escapeHtml(row.status)}</td>
      </tr>`
    )
    .join("");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>PSS attendance · ${escapeHtml(day)}</title>
  <style>
    body { margin: 32px; color: #1c1916; font-family: Georgia, "Times New Roman", serif; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    h1 { margin: 0; font-size: 28px; }
    p { margin: 6px 0 0; color: #5c534b; }
    button { border: 1px solid #1f6b4a; background: #1f6b4a; color: #fff; border-radius: 8px; padding: 8px 14px; font: inherit; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e4d9c8; }
    th { font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: #6d645b; }
    .tags { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 12px; background: #f3ecdf; color: #4a4036; }
    .tag.officer { background: #f4e7cf; color: #9a5b12; }
    .tag.team_lead { background: #e5f2eb; color: #1f6b4a; }
    .tag.mto { background: #efe4c8; color: #6b4e12; }
    @media print {
      body { margin: 12px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>PSS Attendance</h1>
      <p>${escapeHtml(title)}</p>
      <p>${escapeHtml(summary)}</p>
    </div>
    <button type="button" onclick="window.print()">Print</button>
  </header>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>User ID</th>
        <th>Role</th>
        <th>Teams</th>
        <th>Check in</th>
        <th>Check out</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${body || "<tr><td colspan=\"7\">No one to report.</td></tr>"}
    </tbody>
  </table>
</body>
</html>`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance-${day}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

export function AttendanceList() {
  const db = useDatabase();
  const session = useSession();
  const hr = session?.role === "hr";
  const editor = canEditAttendance(session);
  const pss = Boolean(session && isHrPss(session));
  const [reportDay, setReportDay] = useState(todayKey());
  const isToday = reportDay === todayKey();
  const dayLabel = new Date(`${reportDay}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const people = db.people
    .filter((person) => {
      if (pss) return person.role !== "hr" && person.role !== "admin";
      if (hr) return true;
      return person.role !== "hr";
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const reportPeople = people.filter((person) => person.role !== "hr" && person.role !== "admin");

  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Attendance report</h1>
          <p className="muted">
            {editor
              ? "Every registered person, including past days. Open a person to correct check-in and check-out times."
              : pss
                ? "Every registered person, including past days. View only. Download the selected day as a printable HTML file."
                : "Every registered person, including past days. Open a person to see every check-in and check-out."}
          </p>
        </div>
        <form
          className="row"
          onSubmit={(event) => {
            event.preventDefault();
            if (pss) downloadDayReport(reportPeople, db, reportDay);
          }}
        >
          <button type="button" className="btn secondary" onClick={() => setReportDay(shiftKey(reportDay, -1))} aria-label="Previous day">
            ←
          </button>
          <label>
            Day
            <input
              type="date"
              max={todayKey()}
              value={reportDay}
              onChange={(event) => event.target.value && setReportDay(event.target.value > todayKey() ? todayKey() : event.target.value)}
              required
            />
          </label>
          <button
            type="button"
            className="btn secondary"
            disabled={isToday}
            onClick={() => setReportDay(shiftKey(reportDay, 1))}
            aria-label="Next day"
          >
            →
          </button>
          {pss ? (
            <button className="btn" type="submit">
              Download HTML
            </button>
          ) : null}
        </form>
      </div>
      <div className="table-card">
        <table className="report-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Teams</th>
              <th>Total days</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Holiday</th>
              <th>Total leaves</th>
              <th>Check in</th>
              <th>Check out</th>
              <th>{isToday ? "Today" : dayLabel}</th>
              <th>Total late days</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const teams = personTeams(person);
              const totals = attendanceTotals(person, db.attendance, db.leave);
              const when = new Date(`${reportDay}T12:00:00`);
              const beforeJoin = Boolean(person.joined && reportDay < person.joined);
              const status = beforeJoin
                ? null
                : attendanceStatus(person.userId, db.attendance, db.leave, when, Boolean(person.lateAllowed));
              const record = db.attendance.find((item) => item.userId === person.userId && item.date === reportDay);
              return (
                <tr key={person.userId}>
                  <td>
                    <Link className="name-btn" to={hr ? `/attendance/${person.userId}` : `/users/${person.userId}`}>
                      {person.name}
                    </Link>
                    <AssignedTags person={person} />
                  </td>
                  <td>
                    {teams.length ? (
                      <div className="domain-list">
                        {teams.map((team) => (
                          <span key={team} className="badge team">
                            {teamName(team)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{totals.total}</td>
                  <td>{totals.present}</td>
                  <td>{totals.absent}</td>
                  <td>{totals.weekend}</td>
                  <td>{totals.leaves}</td>
                  <td>{beforeJoin ? "—" : formatClock(record?.checkIn)}</td>
                  <td>{beforeJoin ? "—" : formatClock(record?.checkOut)}</td>
                  <td>
                    {beforeJoin ? (
                      <span className="badge wait">Not joined</span>
                    ) : (
                      <span className={dayStatusClass(status!)}>{dayStatusLabel(status!, "Absent")}</span>
                    )}
                    {beforeJoin ? null : (
                      <MarkPresentButton userId={person.userId} date={reportDay} status={status} marked={record?.markedPresent} />
                    )}
                  </td>
                  <td>{totals.late}</td>
                  <td>
                    <Link className="text-btn" to={`/attendance/${person.userId}`}>
                      {editor ? "Edit report" : "View report"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
