import { Link } from "react-router-dom";
import { attendanceStatus, historyFor, isPersonActive, personTeams, teamName, useDatabase } from "../store";
import { AssignedTags } from "./PersonDetail";

export function AttendanceList() {
  const db = useDatabase();
  const people = [...db.people].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Attendance report</h1>
          <p className="muted">Open a person to see every check-in and check-out.</p>
        </div>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>ID no</th>
              <th>Teams</th>
              <th>Status</th>
              <th>Days</th>
              <th>Late</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const history = historyFor(person.userId);
              const late = history.filter((record) => record.late).length;
              return (
                <tr key={person.userId}>
                  <td>
                    <Link className="name-btn" to={`/users/${person.userId}`}>
                      {person.name}
                    </Link>
                    <AssignedTags person={person} />
                  </td>
                  <td>{person.userId}</td>
                  <td>{personTeams(person).map((team) => teamName(team)).join(", ") || "—"}</td>
                  <td>
                    {attendanceStatus(person.userId, db.attendance, db.leave) === "late" ? (
                      <span className="badge late">Late</span>
                    ) : attendanceStatus(person.userId, db.attendance, db.leave) === "on_time" ? (
                      <span className="badge">On time</span>
                    ) : attendanceStatus(person.userId, db.attendance, db.leave) === "leave" ? (
                      <span className="badge leave">Leave</span>
                    ) : (
                      <span className="badge wait">Not in</span>
                    )}
                    <div className={isPersonActive(person) ? "status on" : "status off"}>
                      {isPersonActive(person) ? "Active" : "Inactive"}
                    </div>
                  </td>
                  <td>{history.length}</td>
                  <td>{late}</td>
                  <td>
                    <Link className="text-btn" to={`/attendance/${person.userId}`}>
                      View report
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
