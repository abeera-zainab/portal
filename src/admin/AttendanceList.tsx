import { useState } from "react";
import { Link } from "react-router-dom";
import type { Database, Person } from "../types";
import { attendanceTotals } from "../attendanceStats";
import type { DayStatus } from "../store";
import {
  attendanceStatus,
  canMarkPresent,
  dayStatusClass,
  dayStatusLabel,
  formatClock,
  isHrPss,
  isWeekend,
  markPresent,
  personTeams,
  roleTags,
  teamName,
  todayKey,
  useDatabase,
  useSession,
} from "../store";

const shiftKey = (day: string, delta: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + delta);
  const next = todayKey(date);
  const today = todayKey();
  return next > today ? today : next;
};

const reportStatusLabel = (status: DayStatus) => {
  if (status === "weekend") return "";
  if (status === "on_time") return "Present";
  if (status === "not_in") return "Absent";
  return dayStatusLabel(status, "Absent");
};

function StatusEdit({
  userId,
  date,
  status,
  marked = false,
}: {
  userId: string;
  date: string;
  status: DayStatus | null;
  marked?: boolean;
}) {
  const session = useSession();
  const [error, setError] = useState("");
  if (!session || !canMarkPresent(session) || !date || date > todayKey() || isWeekend(date)) return null;
  const editable = status === "not_in" || status === "late" || status === "leave" || status === "absentee";
  if (!editable && !marked) return null;

  const run = async () => {
    try {
      setError("");
      await markPresent(userId, date, !marked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this status.");
    }
  };

  return (
    <button type="button" className="icon-btn" onClick={() => void run()} aria-label={marked ? "Undo present" : "Set present"} title={error || (marked ? "Undo present" : "Set present")}>
      {marked ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 7H4v4" />
          <path d="M4 11a8 8 0 1 0 2.3-5.7L4 7" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
          <path d="M13.5 6.5l3 3" />
        </svg>
      )}
    </button>
  );
}

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
      status: status === "weekend" ? "—" : dayStatusLabel(status, "Absent"),
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
  const pss = Boolean(session && isHrPss(session));
  const [reportDay, setReportDay] = useState(todayKey());
  const isToday = reportDay === todayKey();
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
          <p className="muted">Check-in, check-out, and status for the selected day.</p>
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
              <th>Check in</th>
              <th>Check out</th>
              <th>Status</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Late</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
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
                    <Link className="name-btn" to={`/attendance/${person.userId}`}>
                      {person.name}
                    </Link>
                  </td>
                  <td>{beforeJoin ? "—" : formatClock(record?.checkIn)}</td>
                  <td>{beforeJoin ? "—" : formatClock(record?.checkOut)}</td>
                  <td>
                    <div className="status-cell">
                      {beforeJoin || status === "weekend" ? (
                        <span className="muted">{beforeJoin ? "Not joined" : "—"}</span>
                      ) : (
                        <span className={dayStatusClass(status!)}>{reportStatusLabel(status!)}</span>
                      )}
                      {beforeJoin ? null : (
                        <StatusEdit userId={person.userId} date={reportDay} status={status} marked={record?.markedPresent} />
                      )}
                    </div>
                  </td>
                  <td className="tone-green">{totals.present}</td>
                  <td className="tone-absent">{totals.absent}</td>
                  <td className="tone-amber">{totals.late}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
