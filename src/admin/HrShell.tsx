import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { AccountSettings } from "../AccountSettings";
import { AccountSettingsButton, DashboardIcon, LeaveIcon, ReportIcon, SideLink, TeamIcon } from "../ShellChrome";
import {
  TEAMS,
  attendanceStatus,
  dayStatusClass,
  dayStatusLabel,
  canGrantLeave,
  grantLeave,
  isHrPss,
  isPersonActive,
  logout,
  personTeams,
  useDatabase,
  useSession,
} from "../store";
import { AttendanceList } from "./AttendanceList";
import { AttendanceReport } from "./AttendanceReport";
import { Dashboard } from "./Dashboard";

export function HrShell() {
  const session = useSession();
  if (!session) return <Navigate to="/" replace />;
  const pss = isHrPss(session);
  const grant = canGrantLeave(session);

  return (
    <div className="admin-frame">
      <aside className="sidenav">
        <div className="sidenav-brand">
          <img src="/pss-logo.png?v=3" alt="Pak Surveillance Shield" className="logo logo-side" />
          <strong>PSS</strong>
        </div>
        <p className="nav-label">Menu</p>
        <nav>
          {pss ? (
            <SideLink to="/dashboard" end icon={<DashboardIcon />}>
              Dashboard
            </SideLink>
          ) : null}
          <SideLink to="/attendance" icon={<ReportIcon />}>
            Attendance
          </SideLink>
          <SideLink to="/teams" icon={<TeamIcon />}>
            Teams
          </SideLink>
          {grant ? (
            <SideLink to="/leave" icon={<LeaveIcon />}>
              Leave
            </SideLink>
          ) : null}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="topbar">
          <div className="brand">
            <strong>PSS Attendance</strong>
            <span>{pss ? "HR PSS" : "HR"}</span>
          </div>
          <div className="who">
            <div>
              <strong>{session.name}</strong>
              <div>
                <span>
                  {pss ? "HR PSS" : "HR"} · {session.userId}
                </span>
              </div>
            </div>
            <AccountSettingsButton />
            <button className="btn secondary" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <div className="admin-page">
          <Routes>
            {pss ? <Route path="/dashboard" element={<Dashboard variant="hr" />} /> : null}
            <Route path="/attendance" element={<AttendanceList />} />
            <Route path="/attendance/:userId" element={<AttendanceReport />} />
            <Route path="/teams" element={<HrTeams />} />
            {grant ? <Route path="/leave" element={<GrantLeave />} /> : null}
            <Route path="/account" element={<AccountSettings person={session} />} />
            <Route path="*" element={<Navigate to={pss ? "/dashboard" : "/attendance"} replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function HrTeams() {
  const db = useDatabase();
  const staff = db.people.filter((person) => person.role !== "hr" && person.role !== "admin" && isPersonActive(person));

  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Teams</h1>
          <p className="muted">
            Today’s status for every team. Late is shown here. A fourth late day in a row counts as absent.
          </p>
        </div>
      </div>
      {TEAMS.map((team) => {
        const members = staff
          .filter((person) => personTeams(person).includes(team.id))
          .sort((a, b) => a.name.localeCompare(b.name));
        return (
          <article key={team.id} className="card">
            <h2>{team.name}</h2>
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>User ID</th>
                  <th>Today</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={3}>No one is on this team.</td>
                  </tr>
                ) : (
                  members.map((person) => {
                    const status = attendanceStatus(
                      person.userId,
                      db.attendance,
                      db.leave,
                      new Date(),
                      Boolean(person.lateAllowed)
                    );
                    return (
                      <tr key={person.userId}>
                        <td>
                          <Link className="name-btn" to={`/attendance/${person.userId}`}>
                            {person.name}
                          </Link>
                        </td>
                        <td>{person.userId}</td>
                        <td>
                          <span className={dayStatusClass(status)}>{dayStatusLabel(status, "Absent")}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </article>
        );
      })}
    </section>
  );
}

function GrantLeave() {
  const db = useDatabase();
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const people = db.people
    .filter((person) => person.role !== "hr" && person.role !== "admin" && isPersonActive(person))
    .sort((a, b) => a.name.localeCompare(b.name));
  const recorded = db.leave.filter((request) => {
    if (request.status !== "approved") return false;
    const owner = db.people.find((person) => person.userId === request.userId);
    return Boolean(owner && owner.role !== "hr" && owner.role !== "admin");
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await grantLeave(userId, from, to, reason);
      setReason("");
      setError("");
      setSaved("Leave was recorded.");
    } catch (err) {
      setSaved("");
      setError(err instanceof Error ? err.message : "Could not record leave.");
    }
  };

  return (
    <section className="manage">
      <div className="manage-head">
        <div>
          <h1>Leave</h1>
          <p className="muted">Record approved leave for people on the teams. HR and admin accounts are not listed. It applies as soon as you save it.</p>
        </div>
      </div>
      <section className="card">
        <h2>Put leave</h2>
        <form onSubmit={submit} className="row" style={{ marginTop: 14 }}>
          <label style={{ flex: 1, minWidth: 220 }}>
            Person
            <select value={userId} onChange={(event) => setUserId(event.target.value)} required>
              <option value="">Choose a person</option>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>
                  {person.name} · {person.userId}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} required />
          </label>
          <label>
            To
            <input type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} required />
          </label>
          <label style={{ flex: 1, minWidth: 220 }}>
            Reason
            <input value={reason} onChange={(event) => setReason(event.target.value)} required />
          </label>
          <button className="btn" type="submit">
            Record leave
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
        {saved ? <p className="muted">{saved}</p> : null}
      </section>
      <section className="card">
        <h2>Approved leave</h2>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Dates</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {recorded.length === 0 ? (
              <tr>
                <td colSpan={3}>No approved leave yet.</td>
              </tr>
            ) : (
              recorded.map((request) => {
                const owner = db.people.find((person) => person.userId === request.userId);
                return (
                  <tr key={request.id}>
                    <td>
                      {owner?.name ?? request.userId}
                      <div className="muted">{request.userId}</div>
                    </td>
                    <td>
                      {request.from}
                      {request.to !== request.from ? ` → ${request.to}` : ""}
                    </td>
                    <td>{request.reason}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </section>
  );
}
