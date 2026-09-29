import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import type { Person, TeamId } from "./types";
import { AccountSettings } from "./AccountSettings";
import { AttendanceCard } from "./AttendanceCard";
import { AdminShell } from "./admin/AdminShell";
import { AttendanceReport } from "./admin/AttendanceReport";
import { LeaveInbox, TeamLeaveBoard } from "./LeaveReview";
import { TeamDashboard } from "./TeamDashboard";
import { UserDetail } from "./admin/PersonDetail";
import {
  AccountSettingsButton,
  DashboardIcon,
  LeaveIcon,
  ReportIcon,
  LeaveNotifications,
  SideLink,
  TeamIcon,
} from "./ShellChrome";
import {
  TEAMS,
  assignTeam,
  attendanceStatus,
  login,
  logout,
  personTeams,
  requestLeave,
  reviewableLeave,
  teamName,
  teamRoster,
  todayKey,
  useDatabase,
  useDbError,
  useDbReady,
  useSession,
} from "./store";

const roleLabel = (person: Person) => {
  if (person.role === "admin") return "Admin";
  const parts: string[] = [];
  if (person.role === "officer" || person.officer) parts.push("Officer");
  if (person.role === "team_lead") parts.push("Team lead");
  if (person.mto) parts.push("MTO");
  if (!parts.length) parts.push("Employee");
  return parts.join(" · ");
};

export default function App() {
  const session = useSession();
  const ready = useDbReady();
  const dbError = useDbError();
  if (!ready) {
    return (
      <div className="login-wrap">
        <p>Connecting to the local PostgreSQL database...</p>
        {dbError ? <p className="error">{dbError}</p> : null}
      </div>
    );
  }
  if (!session) return <Login />;
  if (session.role === "admin") return <AdminShell />;
  return <StaffShell person={session} />;
}

function StaffShell({ person }: { person: Person }) {
  return (
    <div className="admin-frame">
      <aside className="sidenav">
        <div className="sidenav-brand">
          <img src="/pss-logo.png?v=3" alt="Pak Surveillance Shield" className="logo logo-side" />
          <strong>PSS</strong>
        </div>
        <LeaveNotifications person={person} />
        <p className="nav-label">Menu</p>
        <nav>
          <SideLink to="/" end icon={<DashboardIcon />}>
            Dashboard
          </SideLink>
          {person.role === "team_lead" ? (
            <SideLink to="/my-attendance" icon={<ReportIcon />}>
              My attendance
            </SideLink>
          ) : null}
          <SideLink to="/leave" end icon={<LeaveIcon />}>
            Leave
          </SideLink>
          {person.role === "team_lead" ? (
            <SideLink to="/team" end icon={<TeamIcon />}>
              Team
            </SideLink>
          ) : null}
        </nav>
      </aside>
      <div className="admin-main">
        <header className="topbar">
          <div className="brand">
            <strong>PSS Attendance</strong>
            <span>{personTeams(person).length ? personTeams(person).map((team) => teamName(team)).join(", ") : roleLabel(person)}</span>
          </div>
          <div className="who">
            <div>
              <strong>{person.name}</strong>
              <div>
                <span>
                  {roleLabel(person)} · {person.userId}
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
            <Route path="/" element={person.role === "team_lead" ? <TeamHome person={person} /> : <AttendanceCard person={person} />} />
            <Route
              path="/my-attendance"
              element={person.role === "team_lead" ? <AttendanceReport mine /> : <Navigate to="/" replace />}
            />
            <Route
              path="/leave"
              element={person.role === "team_lead" ? <TeamLeave person={person} /> : <LeaveCard person={person} />}
            />
            <Route
              path="/team"
              element={person.role === "team_lead" ? <TeamTools lead={person} /> : <Navigate to="/" replace />}
            />
            <Route path="/account" element={<AccountSettings person={person} />} />
            <Route path="/users/:userId" element={<UserDetail backTo="/team" backLabel="← Back to team" />} />
            <Route path="/attendance/:userId" element={<AttendanceReport />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await login(identifier, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <img src="/pss-logo.png?v=3" alt="Pak Surveillance Shield" className="logo logo-login" />
        <h1>PSS Attendance</h1>
        <p className="muted">Sign in with your username or email.</p>
        <div className="row" style={{ marginTop: 18 }}>
          <label style={{ flex: 1 }}>
            Username or email
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
          </label>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <label style={{ flex: 1 }}>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" style={{ marginTop: 16 }} type="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}

function TeamHome({ person }: { person: Person }) {
  const [marking, setMarking] = useState(false);
  return (
    <div className="manage">
      <div className="manage-head">
        <div>
          <h1>Dashboard</h1>
        </div>
        <div className="filters">
          <button type="button" className={marking ? "chip" : "chip on"} onClick={() => setMarking(false)}>
            Team
          </button>
          <button type="button" className={marking ? "chip on" : "chip"} onClick={() => setMarking(true)}>
            Mark your attendance
          </button>
        </div>
      </div>
      {marking ? <AttendanceCard person={person} heading="Mark your attendance" /> : <TeamDashboard lead={person} />}
    </div>
  );
}

function LeaveCard({ person, heading = "Leave" }: { person: Person; heading?: string }) {
  const db = useDatabase();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const mine = db.leave.filter((request) => request.userId === person.userId);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const today = todayKey();
    if (from < today) {
      setError("You cannot request leave for a past date.");
      return;
    }
    try {
      await requestLeave(person.userId, from, to, reason);
      setReason("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request leave.");
    }
  };

  const today = todayKey();

  return (
    <section className="card">
      <h2>{heading}</h2>
      <p className="muted">
        {person.role === "team_lead"
          ? "Team lead leave is sent to an admin."
          : "Your team lead or an admin can approve or reject this."}
      </p>
      <form onSubmit={submit} className="row" style={{ marginTop: 14 }}>
        <label>
          From
          <input type="date" min={today} value={from} onChange={(event) => setFrom(event.target.value)} required />
        </label>
        <label>
          To
          <input type="date" min={from && from > today ? from : today} value={to} onChange={(event) => setTo(event.target.value)} required />
        </label>
        <label style={{ flex: 1, minWidth: 220 }}>
          Reason
          <input value={reason} onChange={(event) => setReason(event.target.value)} required />
        </label>
        <button className="btn" type="submit">
          Request leave
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>Dates</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Rejection reason</th>
          </tr>
        </thead>
        <tbody>
          {mine.length === 0 ? (
            <tr>
              <td colSpan={4}>No leave requests yet.</td>
            </tr>
          ) : (
            mine.map((request) => (
              <tr key={request.id}>
                <td>
                  {request.from}
                  {request.to !== request.from ? ` → ${request.to}` : ""}
                </td>
                <td>{request.reason}</td>
                <td>
                  <StatusBadge status={request.status} />
                </td>
                <td>{request.status === "rejected" ? request.rejectionReason : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

function TeamLeave({ person }: { person: Person }) {
  const [mine, setMine] = useState(false);

  return (
    <div className="manage">
      <div className="manage-head">
        <div>
          <h1>Leave</h1>
        </div>
        <div className="filters">
          <button type="button" className={mine ? "chip" : "chip on"} onClick={() => setMine(false)}>
            Team
          </button>
          <button type="button" className={mine ? "chip on" : "chip"} onClick={() => setMine(true)}>
            Your leave
          </button>
        </div>
      </div>
      {mine ? <LeaveCard person={person} heading="Your leave" /> : <TeamLeaveBoard lead={person} />}
    </div>
  );
}

function TeamTools({ lead }: { lead: Person }) {
  const db = useDatabase();
  const [choices, setChoices] = useState<Record<string, TeamId>>({});
  const [error, setError] = useState("");
  const members = teamRoster(lead, db.people).filter((person) => person.userId !== lead.userId);
  const requests = reviewableLeave(lead, db.people, db.leave);

  return (
    <>
      <section className="card">
        <h2>Team</h2>
        <p className="muted">Today’s attendance. Move someone onto another team.</p>
        {error ? <p className="error">{error}</p> : null}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>User ID</th>
              <th>Today</th>
              <th>Move to</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 ? (
              <tr>
                <td colSpan={4}>No one else is on your team yet.</td>
              </tr>
            ) : (
              members.map((member) => {
                const nextTeam = choices[member.userId] ?? member.team ?? "ops";
                return (
                  <tr key={member.userId}>
                    <td>
                      <Link className="name-btn" to={`/users/${member.userId}`}>
                        {member.name}
                      </Link>
                    </td>
                    <td>{member.userId}</td>
                    <td>
                      {attendanceStatus(member.userId, db.attendance, db.leave) === "late" ? (
                        <span className="badge late">Late</span>
                      ) : attendanceStatus(member.userId, db.attendance, db.leave) === "leave" ? (
                        <span className="badge leave">Leave</span>
                      ) : attendanceStatus(member.userId, db.attendance, db.leave) === "on_time" ? (
                        <span className="badge">On time</span>
                      ) : (
                        <span className="badge wait">Not in</span>
                      )}
                    </td>
                    <td>
                      <div className="row">
                        <select
                          value={nextTeam}
                          onChange={(event) =>
                            setChoices((current) => ({
                              ...current,
                              [member.userId]: event.target.value as TeamId,
                            }))
                          }
                        >
                          {TEAMS.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.name}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn secondary"
                          disabled={nextTeam === member.team}
                          onClick={() => {
                            void (async () => {
                              try {
                                await assignTeam(member.userId, nextTeam);
                                setError("");
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Could not move this person.");
                              }
                            })();
                          }}
                        >
                          Move
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
      <LeaveInbox requests={requests} reviewerId={lead.userId} title="Team leave" />
    </>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const className = status === "approved" ? "badge" : status === "rejected" ? "badge no" : "badge wait";
  return <span className={className}>{status}</span>;
}
