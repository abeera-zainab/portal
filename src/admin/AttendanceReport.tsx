import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AttendanceRecord, LeaveRequest } from "../types";
import { attendanceStatus, canEditAttendance, dayStatusClass, dayStatusLabel, deleteAttendance, formatClock, formatWorked, historyFor, isOnLeave, personTeams, saveAttendance, teamName, todayKey, useDatabase, useSession } from "../store";
import { AssignedTags, canViewPerson, PersonAdjust } from "./PersonDetail";

const FULL_DAY = 8 * 60;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const dayKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

const hoursLabel = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")} hrs`;
};

const startOfWeek = (date: Date) => {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
};

function monthGrid(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const pad = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: { date: Date; outside: boolean }[] = [];
  for (let index = pad; index > 0; index -= 1) {
    cells.push({ date: new Date(year, month, 1 - index), outside: true });
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push({ date: new Date(year, month, day), outside: false });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, cells.length - (pad + days) + 1), outside: true });
  }
  return cells;
}

function AttendanceCalendar({
  history,
  leave,
  userId,
  lateAllowed = false,
}: {
  history: AttendanceRecord[];
  leave: LeaveRequest[];
  userId: string;
  lateAllowed?: boolean;
}) {
  const [mode, setMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState(() => new Date());
  const today = todayKey();
  const byDate = useMemo(() => new Map(history.map((record) => [record.date, record])), [history]);

  const cells =
    mode === "month"
      ? monthGrid(cursor)
      : Array.from({ length: 7 }, (_, index) => {
          const start = startOfWeek(cursor);
          const date = new Date(start);
          date.setDate(start.getDate() + index);
          return { date, outside: false };
        });

  const title =
    mode === "month"
      ? cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : `${cells[0].date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${cells[6].date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;

  const shift = (direction: number) => {
    const next = new Date(cursor);
    if (mode === "month") next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * 7);
    setCursor(next);
  };

  return (
    <section className="card calendar">
      <div className="calendar-head">
        <div className="calendar-nav">
          <button type="button" className="btn secondary" onClick={() => shift(-1)} aria-label="Previous">
            ←
          </button>
          <h2>{title}</h2>
          <button type="button" className="btn secondary" onClick={() => shift(1)} aria-label="Next">
            →
          </button>
        </div>
        <div className="filters">
          <button type="button" className={mode === "week" ? "chip on" : "chip"} onClick={() => setMode("week")}>
            Week
          </button>
          <button type="button" className={mode === "month" ? "chip on" : "chip"} onClick={() => setMode("month")}>
            Month
          </button>
        </div>
      </div>
      <div className="calendar-grid">
        {WEEKDAYS.map((name) => (
          <div key={name} className="calendar-weekday">
            {name}
          </div>
        ))}
        {cells.map(({ date, outside }) => {
          const key = dayKey(date);
          const record = byDate.get(key);
          const onLeave = isOnLeave(userId, leave, key);
          const minutes =
            record?.workedMinutes ??
            (record && !record.checkOut && key === today
              ? Math.max(0, Math.round((Date.now() - new Date(record.checkIn).getTime()) / 60000))
              : undefined);
          const open = Boolean(record && !record.checkOut);
          const status = attendanceStatus(userId, history, leave, date, lateAllowed);
          const late = status === "late";
          const absentee = status === "absentee";
          const tone = onLeave ? "leave" : absentee ? "late" : !record ? "" : late ? "late" : open ? "open" : (minutes ?? 0) >= FULL_DAY ? "full" : "short";
          const width = minutes === undefined ? 0 : Math.min(100, Math.round((minutes / FULL_DAY) * 100));
          return (
            <div key={key} className={`calendar-day${outside ? " outside" : ""}${key === today ? " today" : ""}`}>
              <strong>{date.getDate()}</strong>
              {onLeave ? <span className="badge no">On leave</span> : null}
              {absentee ? <span className="badge no">Absentee</span> : null}
              {!onLeave && minutes !== undefined ? (
                <>
                  <span className={`calendar-hours ${tone}`}>{hoursLabel(minutes)}</span>
                  <span className={`calendar-bar ${tone}`}>
                    <span style={{ width: `${width}%` }} />
                  </span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const timeValue = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
};

function HrAttendanceEditor({ userId, lateAllowed }: { userId: string; lateAllowed: boolean }) {
  const db = useDatabase();
  const history = historyFor(userId);
  const [drafts, setDrafts] = useState<Record<string, { checkIn: string; checkOut: string }>>({});
  const [adding, setAdding] = useState({ date: "", checkIn: "", checkOut: "" });
  const [error, setError] = useState("");

  const save = async (date: string, checkIn: string, checkOut: string) => {
    try {
      await saveAttendance(userId, date, checkIn, checkOut);
      setDrafts((current) => {
        const next = { ...current };
        delete next[date];
        return next;
      });
      setError("");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this attendance.");
      return false;
    }
  };

  const remove = async (date: string) => {
    if (!confirm(`Remove attendance for ${date}?`)) return;
    try {
      await deleteAttendance(userId, date);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this attendance.");
    }
  };

  return (
    <section className="card">
      <h2>Edit attendance</h2>
      <p className="muted">Correct a check-in or check-out, or add a missing day. This is only available to HR.</p>
      {error ? <p className="error">{error}</p> : null}
      <form
        className="row"
        style={{ marginTop: 12 }}
        onSubmit={(event) => {
          event.preventDefault();
          void save(adding.date, adding.checkIn, adding.checkOut).then((saved) => {
            if (saved) setAdding({ date: "", checkIn: "", checkOut: "" });
          });
        }}
      >
        <label>
          Date
          <input type="date" value={adding.date} onChange={(event) => setAdding({ ...adding, date: event.target.value })} required />
        </label>
        <label>
          Check in
          <input type="time" value={adding.checkIn} onChange={(event) => setAdding({ ...adding, checkIn: event.target.value })} required />
        </label>
        <label>
          Check out
          <input type="time" value={adding.checkOut} onChange={(event) => setAdding({ ...adding, checkOut: event.target.value })} />
        </label>
        <button className="btn" type="submit">
          Add day
        </button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Check in</th>
            <th>Check out</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr>
              <td colSpan={5}>No attendance yet.</td>
            </tr>
          ) : (
            history.map((record) => {
              const draft = drafts[record.date] ?? {
                checkIn: timeValue(record.checkIn),
                checkOut: timeValue(record.checkOut),
              };
              const status = attendanceStatus(userId, db.attendance, db.leave, new Date(`${record.date}T12:00:00`), lateAllowed);
              return (
                <tr key={record.date}>
                  <td>{record.date}</td>
                  <td>
                    <input
                      type="time"
                      value={draft.checkIn}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [record.date]: { ...draft, checkIn: event.target.value } }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      value={draft.checkOut}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [record.date]: { ...draft, checkOut: event.target.value } }))
                      }
                    />
                  </td>
                  <td>
                    <span className={dayStatusClass(status)}>{dayStatusLabel(status)}</span>
                  </td>
                  <td>
                    <div className="row">
                      <button className="btn" type="button" onClick={() => void save(record.date, draft.checkIn, draft.checkOut)}>
                        Save
                      </button>
                      <button className="btn secondary" type="button" onClick={() => void remove(record.date)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </section>
  );
}

export function AttendanceReport({ mine = false }: { mine?: boolean }) {
  const { userId: routeUserId = "" } = useParams();
  const session = useSession();
  const userId = mine ? session?.userId ?? "" : routeUserId;
  const db = useDatabase();
  const person = db.people.find((item) => item.userId === userId);
  const history = historyFor(userId);
  const late = person
    ? history.filter(
        (record) =>
          attendanceStatus(person.userId, db.attendance, db.leave, new Date(`${record.date}T12:00:00`), Boolean(person.lateAllowed)) ===
          "late"
      ).length
    : 0;
  const minutes = history.reduce((sum, record) => sum + (record.workedMinutes ?? 0), 0);

  if (!person) {
    return (
      <section className="manage">
        <Link className="back-link" to="/attendance">
          ← Back to attendance
        </Link>
        <p>That person could not be found.</p>
      </section>
    );
  }

  if (person.role === "hr" && session?.role !== "hr") {
    return (
      <section className="manage">
        <p>That person could not be found.</p>
      </section>
    );
  }

  if (!mine && !canViewPerson(session, person)) {
    return (
      <section className="manage">
        <p>{session?.role === "hr" ? "That person could not be found." : "You can only open attendance for people who report to you."}</p>
      </section>
    );
  }

  return (
    <section className="manage">
      {mine ? null : (
        <Link className="back-link" to={session?.role === "employee" || session?.role === "team_lead" || session?.role === "officer" ? `/users/${person.userId}` : "/attendance"}>
          {session?.role === "hr" || session?.role === "admin" ? "← Back to attendance" : "← Back to user"}
        </Link>
      )}
      <div className="manage-head">
        <div>
          <h1>{mine ? "My attendance" : person.name}</h1>
          {mine ? null : <AssignedTags person={person} />}
          <p className="muted">
            {mine ? `${person.name} · ` : ""}
            {person.userId} · @{person.username} · {person.email}
            {personTeams(person).length
              ? ` · ${personTeams(person).map((team) => teamName(team)).join(", ")}`
              : ""}
          </p>
        </div>
        {mine || session?.role === "hr" ? null : (
          <Link className="btn secondary" to={`/users/${person.userId}`}>
            User detail
          </Link>
        )}
      </div>
      {mine || session?.role === "hr" ? null : <PersonAdjust person={person} />}
      {canEditAttendance(session) && !mine ? <HrAttendanceEditor userId={person.userId} lateAllowed={Boolean(person.lateAllowed)} /> : null}
      <AttendanceCalendar history={history} leave={db.leave} userId={person.userId} lateAllowed={Boolean(person.lateAllowed)} />
      <div className="stat-row">
        <div className="card stat">
          <span>Days recorded</span>
          <strong>{history.length}</strong>
        </div>
        <div className="card stat">
          <span>Late check-ins</span>
          <strong>{late}</strong>
        </div>
        <div className="card stat">
          <span>Time tracked</span>
          <strong>{formatWorked(minutes)}</strong>
        </div>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Check in</th>
              <th>Check out</th>
              <th>Time tracked</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={5}>No attendance yet.</td>
              </tr>
            ) : (
              history.map((record) => {
              const status = attendanceStatus(
                person.userId,
                db.attendance,
                db.leave,
                new Date(`${record.date}T12:00:00`),
                Boolean(person.lateAllowed)
              );
              return (
                <tr key={record.date}>
                  <td>{record.date}</td>
                  <td>
                    <span className={dayStatusClass(status)}>{dayStatusLabel(status)}</span>
                  </td>
                  <td>{formatClock(record.checkIn)}</td>
                  <td>{formatClock(record.checkOut)}</td>
                  <td>{formatWorked(record.workedMinutes)}</td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
