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
  teamName,
  todayKey,
  useDatabase,
  useSession,
} from "../store";
import { AssignedTags } from "./PersonDetail";

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
  const summary = ["On time", "Late", "Absentee", "Leave", "Absent"]
    .map((label) => `${label}: ${counts[label] ?? 0}`)
    .join(" · ");
  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.userId)}</td>
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
        <th>Teams</th>
        <th>Check in</th>
        <th>Check out</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${body || "<tr><td colspan=\"6\">No one to report.</td></tr>"}
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
  const people = db.people
    .filter((person) => hr || person.role !== "hr")
    .sort((a, b) => a.name.localeCompare(b.name));
  const reportPeople = people.filter((person) => person.role !== "hr");

  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Attendance report</h1>
          <p className="muted">
            {editor
              ? "Open a person to correct check-in and check-out times. A fourth late day in a row counts as absent."
              : pss
                ? "View attendance only. A fourth late day in a row counts as absent. Download one day’s report as a printable HTML file."
                : "Open a person to see every check-in and check-out. A fourth late day in a row counts as absent."}
          </p>
        </div>
        {pss ? (
          <form
            className="row"
            onSubmit={(event) => {
              event.preventDefault();
              downloadDayReport(reportPeople, db, reportDay);
            }}
          >
            <label>
              Report day
              <input type="date" value={reportDay} onChange={(event) => setReportDay(event.target.value)} required />
            </label>
            <button className="btn" type="submit">
              Download HTML
            </button>
          </form>
        ) : null}
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
              <th>Total leaves</th>
              <th>Today status</th>
              <th>Total late days</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const teams = personTeams(person);
              const totals = attendanceTotals(person, db.attendance, db.leave);
              const today = attendanceStatus(person.userId, db.attendance, db.leave, new Date(), Boolean(person.lateAllowed));
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
                  <td>{totals.leaves}</td>
                  <td>
                    <span className={dayStatusClass(today)}>{dayStatusLabel(today, "Absent")}</span>
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
