import { Link, useParams } from "react-router-dom";
import { AttendanceCalendar } from "../AttendanceCalendar";
import { formatClock, formatWorked, historyFor, personTeams, teamName, useDatabase, useSession } from "../store";
import { AssignedTags, PersonAdjust } from "./PersonDetail";

export function AttendanceReport({ mine = false }: { mine?: boolean }) {
  const { userId: routeUserId = "" } = useParams();
  const session = useSession();
  const userId = mine ? session?.userId ?? "" : routeUserId;
  const db = useDatabase();
  const person = db.people.find((item) => item.userId === userId);
  const history = historyFor(userId);
  const late = history.filter((record) => record.late).length;
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

  return (
    <section className="manage">
      {mine ? null : (
        <Link className="back-link" to={session?.role === "admin" ? "/attendance" : `/users/${person.userId}`}>
          {session?.role === "admin" ? "← Back to attendance" : "← Back to user"}
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
        {mine ? null : (
          <Link className="btn secondary" to={`/users/${person.userId}`}>
            User detail
          </Link>
        )}
      </div>
      {mine ? null : <PersonAdjust person={person} />}
      <AttendanceCalendar history={history} leave={db.leave} userId={person.userId} />
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
              history.map((record) => (
                <tr key={record.date}>
                  <td>{record.date}</td>
                  <td>
                    <span className={record.late ? "badge late" : "badge"}>{record.late ? "Late" : "On time"}</span>
                  </td>
                  <td>{formatClock(record.checkIn)}</td>
                  <td>{formatClock(record.checkOut)}</td>
                  <td>{formatWorked(record.workedMinutes)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
