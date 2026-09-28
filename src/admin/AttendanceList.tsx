import { Link } from "react-router-dom";
import type { Database, Person } from "../types";
import {
  attendanceStatus,
  isLateCheckIn,
  isOnLeave,
  personTeams,
  teamName,
  todayKey,
  useDatabase,
} from "../store";
import { AssignedTags } from "./PersonDetail";

const eachDay = (from: string, to: string) => {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return days;
  while (cursor <= end) {
    days.push(todayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

function attendanceTotals(person: Person, attendance: Database["attendance"], leave: Database["leave"]) {
  const today = todayKey();
  const history = attendance.filter((record) => record.userId === person.userId);
  const earliest = history.reduce((soonest, record) => (record.date < soonest ? record.date : soonest), today);
  const start = person.joined && person.joined < earliest ? person.joined : earliest;
  const byDate = new Map(history.map((record) => [record.date, record]));
  let present = 0;
  let absent = 0;
  let leaves = 0;
  let late = 0;
  for (const day of eachDay(start, today)) {
    const record = byDate.get(day);
    if (record) {
      present += 1;
      if (record.late || isLateCheckIn(new Date(record.checkIn))) late += 1;
    } else if (isOnLeave(person.userId, leave, day)) {
      leaves += 1;
    } else {
      absent += 1;
    }
  }
  return { total: present + absent + leaves, present, absent, leaves, late };
}

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
              const today = attendanceStatus(person.userId, db.attendance, db.leave);
              return (
                <tr key={person.userId}>
                  <td>
                    <Link className="name-btn" to={`/users/${person.userId}`}>
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
                    {today === "late" ? (
                      <span className="badge late">Late</span>
                    ) : today === "on_time" ? (
                      <span className="badge">On time</span>
                    ) : today === "leave" ? (
                      <span className="badge leave">Leave</span>
                    ) : (
                      <span className="badge wait">Not in</span>
                    )}
                  </td>
                  <td>{totals.late}</td>
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
