import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AttendanceCalendar } from "../AttendanceCalendar";
import { MarkPresentButton } from "../MarkPresent";
import { PersonAttendance } from "../PersonAttendance";
import { attendanceStatus, canEditAttendance, canMarkPresent, dayStatusClass, dayStatusLabel, deleteAttendance, formatClock, formatWorked, hasLeadRights, historyFor, personTeams, saveAttendance, teamName, todayKey, useDatabase, useSession } from "../store";
import { AssignedTags, canViewPerson, PersonAdjust } from "./PersonDetail";

const BACK: Record<string, { to: string; label: string }> = {
  attendance: { to: "/attendance", label: "← Back to attendance" },
  team: { to: "/team", label: "← Back to team" },
  teams: { to: "/teams", label: "← Back to teams" },
  users: { to: "/users", label: "← Back to users" },
  leave: { to: "/leave", label: "← Back to leave" },
  dashboard: { to: "/dashboard", label: "← Back to dashboard" },
};

const backTarget = (from: string | null, role?: string) => {
  if (from && BACK[from]) return BACK[from];
  if (role === "admin" || role === "hr") return BACK.attendance;
  if (role === "team_lead" || role === "officer") return BACK.team;
  return { to: "/", label: "← Back to dashboard" };
};

const timeValue = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
};

function PresentDay({ userId, lateAllowed }: { userId: string; lateAllowed: boolean }) {
  const db = useDatabase();
  const [day, setDay] = useState(todayKey());
  const status = attendanceStatus(userId, db.attendance, db.leave, new Date(`${day}T12:00:00`), lateAllowed);
  const record = db.attendance.find((item) => item.userId === userId && item.date === day);
  return (
    <section className="card">
      <h2>Set a day to present</h2>
      <p className="muted">Change an absent, late, or leave day to present.</p>
      <div className="row" style={{ marginTop: 12, alignItems: "end" }}>
        <label>
          Day
          <input type="date" max={todayKey()} value={day} onChange={(event) => event.target.value && setDay(event.target.value)} />
        </label>
        <span className={dayStatusClass(status)}>{dayStatusLabel(status, "Absent")}</span>
        <MarkPresentButton userId={userId} date={day} status={status} marked={record?.markedPresent} />
      </div>
    </section>
  );
}

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
  const [searchParams] = useSearchParams();
  const session = useSession();
  const userId = mine ? session?.userId ?? "" : routeUserId;
  const back = backTarget(searchParams.get("from"), session?.role);
  const showProfile = Boolean(session && !mine && session.role !== "hr" && (session.role === "admin" || hasLeadRights(session)));
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
        <Link className="back-link" to={back.to}>
          {back.label}
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
        <Link className="back-link" to={back.to}>
          {back.label}
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
        {showProfile ? (
          <Link className="btn secondary" to={`/users/${person.userId}`}>
            User detail
          </Link>
        ) : null}
      </div>
      {mine || session?.role === "hr" ? null : <PersonAdjust person={person} />}
      {canEditAttendance(session) && !mine ? <HrAttendanceEditor userId={person.userId} lateAllowed={Boolean(person.lateAllowed)} /> : null}
      {!mine && canMarkPresent(session) ? <PresentDay userId={person.userId} lateAllowed={Boolean(person.lateAllowed)} /> : null}
      <PersonAttendance person={person} title="Attendance" />
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
              <th>Day</th>
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
                const when = new Date(`${record.date}T12:00:00`);
                const dayName = Number.isNaN(when.getTime()) ? "—" : when.toLocaleDateString(undefined, { weekday: "long" });
                return (
                  <tr key={record.date}>
                    <td>{record.date}</td>
                    <td>{dayName}</td>
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
